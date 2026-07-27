"""
🏗️ 智能体基类 — 所有 NPC 智能体继承此类
提供 DeepSeek API 调用 + 关键词降级双层架构
"""

import os
import json
import random
import re
from typing import Optional


class BaseAgent:
    """AI 智能体基类

    双层架构：
      第一层（AI 层）→ DeepSeek API（OpenAI 兼容接口）
      第二层（降级层）→ 关键词匹配 + 预制回复库
    """

    def __init__(self, name: str, system_prompt: str, fallback_responses: dict):
        self.name = name
        self.system_prompt = system_prompt
        self.fallback_responses = fallback_responses

        # ── 读取 .env 配置 ──
        api_key = ""
        api_base = "https://api.deepseek.com/v1"
        model = "deepseek-chat"

        # 从 .env 文件加载
        current_dir = os.path.dirname(os.path.abspath(__file__))
        server_dir = os.path.dirname(current_dir)  # server/
        env_path = os.path.join(server_dir, ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DEEPSEEK_API_KEY="):
                        api_key = line.split("=", 1)[1].strip()
                    elif line.startswith("DEEPSEEK_MODEL="):
                        model = line.split("=", 1)[1].strip()
                    elif line.startswith("DEEPSEEK_BASE_URL="):
                        api_base = line.split("=", 1)[1].strip()

        self.api_key = api_key
        self.model = model
        self.api_base = api_base
        self.ai_enabled = bool(api_key and len(api_key) > 10)

        # ── 初始化 OpenAI 客户端（指向 DeepSeek） ──
        self.client = None
        if self.ai_enabled:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=api_key, base_url=api_base)
            except Exception as e:
                print(f"[{self.name}] OpenAI client init error: {e}")
                self.ai_enabled = False

    # ──────────────────────────────────────────────
    #  公开接口
    # ──────────────────────────────────────────────

    def generate(self, player_input: str, context: dict) -> str:
        """生成智能体回复 — AI 优先，失败或空回复则降级到关键词"""
        if self.ai_enabled and self.client:
            try:
                reply = self._call_api(player_input, context)
                # 空回复或过短回复触发降级（<5字视为无效）
                if not reply or len(reply.strip()) < 5:
                    print(f"[{self.name}] AI returned empty/short reply, → 降级到关键词")
                    return self._fallback(player_input, context)
                return reply
            except Exception as e:
                print(f"[{self.name} API Error] {e}, → 降级到关键词")
                return self._fallback(player_input, context)
        else:
            return self._fallback(player_input, context)

    # ──────────────────────────────────────────────
    #  DeepSeek API 调用
    # ──────────────────────────────────────────────

    def _call_api(self, player_input: str, context: dict) -> str:
        """调用 DeepSeek API（OpenAI 兼容接口）"""
        system = self._build_prompt(context)

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": player_input},
        ]

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.75,
            # 给中文回复留足生成余量。最终字数由角色提示词控制，
            # 不用较小的 token 上限硬切，避免出现“不过……轮”这类半句话。
            max_tokens=400,
        )
        choice = response.choices[0]
        text = choice.message.content.strip()
        finish_reason = getattr(choice, "finish_reason", "")
        if finish_reason == "length":
            print(f"[{self.name}] reply reached token limit; trimming to last complete sentence")
        return self._ensure_complete_reply(text)

    @staticmethod
    def _ensure_complete_reply(text: str) -> str:
        """确保回复停在完整句子处，避免模型输出的残缺尾句进入气泡。"""
        cleaned = (text or "").strip()
        if not cleaned:
            return cleaned

        # 去掉偶尔附带的 Markdown 角色前缀，但保留正文。
        cleaned = re.sub(r"^(彩彩|壳壳|沫沫)\s*[：:]\s*", "", cleaned)

        # 句号、问号、感叹号、省略号或 emoji 结尾都视为完整表达。
        if re.search(r"[。！？!?…]|[\U0001F300-\U0001FAFF]$", cleaned):
            last_char = cleaned[-1]
            if last_char in "。！？!?…" or re.match(r"[\U0001F300-\U0001FAFF]", last_char):
                return cleaned

        # 若末尾是残缺片段，保留前面最后一个完整句子。
        sentence_ends = [m.end() for m in re.finditer(r"[。！？!?…]+", cleaned)]
        if sentence_ends:
            last_end = sentence_ends[-1]
            complete = cleaned[:last_end].strip()
            if len(complete) >= 5:
                return complete

        # 没有任何句末标点时不丢弃有效内容，只补全句号。
        return cleaned.rstrip("，,；;：:、.·…") + "。"

    def _build_prompt(self, context: dict) -> str:
        """将 {变量} 注入系统提示词"""
        prompt = self.system_prompt
        for key, value in context.items():
            prompt = prompt.replace(f"{{{key}}}", str(value))
        return prompt

    # ──────────────────────────────────────────────
    #  关键词降级
    # ──────────────────────────────────────────────

    def _fallback(self, player_input: str, context: dict) -> str:
        """关键词降级回复"""
        category = self.classify(player_input)
        replies = self.fallback_responses.get(
            category,
            self.fallback_responses.get("constructive", ["……"]),
        )
        return random.choice(replies)

    # ──────────────────────────────────────────────
    #  文本分类（单智能体降级用）
    # ──────────────────────────────────────────────

    @staticmethod
    def classify(text: str) -> str:
        """简单文本分类：constructive / off_topic / unfriendly / gibberish"""
        t = text.lower()
        chinese_chars = [c for c in text if "一" <= c <= "鿿"]

        # ── 建设性检测（优先于不礼貌检测，避免"不要吵了"被误判）──
        CONSTRUCTIVE = [
            "对不起", "抱歉", "理解", "明白", "别难过", "别生气",
            "安慰", "抱抱", "加油", "没关系", "分享", "轮流",
            "让一让", "和好", "商量", "公平", "朋友", "一起",
            "开心", "喜欢", "我们", "团结", "合作", "包容",
            "体谅", "退一步", "各退一步", "好好说", "互相",
            "帮助", "支持", "鼓励", "温柔", "冷静", "可以",
            "好的", "行", "试试", "相信", "最棒", "同意",
        ]
        TOPIC = [
            "阳台", "露台", "看书", "跳舞", "音乐", "安静",
            "声音", "大声", "壳壳", "彩彩", "沫沫",
            "调解", "商量", "和好", "分享", "轮流",
            "让步", "公平", "办法", "主意", "方案",
            "解决", "问题", "大家", "合作",
        ]

        topic_score = sum(1 for w in TOPIC if w in t)
        constructive_score = sum(1 for w in CONSTRUCTIVE if w in t)

        if constructive_score >= 1 and topic_score >= 1:
            return "constructive"
        if constructive_score >= 2:
            return "constructive"

        # ── 不礼貌检测（放在gibberish检测之前，避免短脏话被误判）──
        UNFRIENDLY = [
            "不要", "不行", "讨厌", "烦", "滚", "走开",
            "闭嘴", "打你", "笨蛋", "傻瓜", "自私",
            "不公平", "凭什么", "偏不", "怪你", "都怪",
            "烦死了", "讨厌鬼", "偏心", "你错", "蠢",
            "去死", "傻逼", "操", "他妈的", "我靠", "尼玛",
            "滚蛋", "找死", "废材", "蠢货", "欠揍", "打死",
            "去你的", "你去死", "你有病", "神经病",
            "白痴", "弱智", "二百五",
        ]
        if any(w in t for w in UNFRIENDLY):
            return "unfriendly"

        # ── 无意义输入（放在unfriendly之后，避免短脏话被误判）──
        if len(text) < 3:
            return "gibberish"

        if topic_score >= 1:
            return "constructive"
        # 无中文但有意义英文
        if len(chinese_chars) == 0:
            meaningful = any(
                w in t
                for w in [
                    "sorry", "hello", "hi", "yes", "no", "ok",
                    "friend", "share", "help", "good", "nice",
                    "peace", "love", "like", "happy", "together",
                ]
            )
            return "constructive" if meaningful else "gibberish"

        return "off_topic"
