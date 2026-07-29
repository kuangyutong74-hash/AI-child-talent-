"""
🐬 蔚蓝深海基地 · 第三关《海洋议事厅》多智能体评判系统
FastAPI + DeepSeek API + 双智能体编排

架构:
  编排层 (server.py)  →  接收请求，分类，算分
      ├── 🦀 壳壳智能体 (keke_agent.py)  →  独立 DeepSeek 调用 + 降级
      └── 🐠 彩彩智能体 (caicai_agent.py) →  独立 DeepSeek 调用 + 降级

启动: uvicorn server:app --reload --port 3000
"""

import os
import uuid
import json
import random
import edge_tts
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# ── 多智能体系统 ──
from agents.keke_agent import keke_agent
from agents.caicai_agent import caicai_agent
from agents.momo_agent import momo_agent

# ── 多维潜能评估引擎 ──
from assessment_engine import generate_report

# ── 行为量化评分系统（纯客观数据，零AI依赖） ──
from quantitative_scoring import generate_quantitative_report

# ════════════════════════════════════════════════════════════════
# 应用初始化
# ════════════════════════════════════════════════════════════════

app = FastAPI(title="蔚蓝深海基地 · 第三关多智能体评判系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ════════════════════════════════════════════════════════════════
# Pydantic 模型
# ════════════════════════════════════════════════════════════════


class ChatRequest(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_input: str
    current_round: int = Field(ge=1, le=3)
    current_harmony: float = Field(default=70.0, ge=0, le=100)
    chat_history: list = Field(default_factory=list)


class QuantReportRequest(BaseModel):
    """📊 行为量化评分请求（纯客观数据）"""
    student_id: str = "stu_9527"
    age: str = "8"
    level1_metrics: dict = Field(default_factory=dict)
    level2_metrics: dict = Field(default_factory=dict)
    level3_metrics: dict = Field(default_factory=dict)
    total_skip_count: int = 0


class AgentTurnResponse(BaseModel):
    category: str = Field(description="分类: constructive / off_topic / unfriendly / gibberish")
    score_increment: int = Field(description="本轮进度增加值（unfriendly为负数=扣分）")
    keke_reply: str = Field(description="壳壳回复, 30-50字")
    caicai_reply: str = Field(description="彩彩回复, 30-50字")
    keke_mood: str = Field(description="壳壳情绪: angry / reflective / happy")
    caicai_mood: str = Field(description="彩彩情绪: angry / reflective / happy")
    momo_intervention_needed: bool = Field(description="是否需沫沫保底介入")
    momo_reply: Optional[str] = Field(default=None, description="沫沫保底台词")
    unfriendly_count: int = Field(default=0, description="本轮累计不友好输入次数")
    consecutive_unfriendly: int = Field(default=0, description="连续不友好输入次数")


# ════════════════════════════════════════════════════════════════
# 关键词库（分类 & 算分用）
# ════════════════════════════════════════════════════════════════

KEYWORDS_CONSTRUCTIVE = [
    "对不起", "抱歉", "理解", "明白", "别难过", "别生气",
    "安慰", "抱抱", "加油", "没关系", "分享", "轮流",
    "让一让", "和好", "商量", "公平", "朋友", "一起",
    "开心", "喜欢", "我们", "团结", "合作", "包容",
    "体谅", "退一步", "各退一步", "好好说", "互相",
    "帮助", "支持", "鼓励", "温柔", "冷静", "可以",
    "好的", "行", "试试", "相信", "最棒", "同意",
]

KEYWORDS_UNFRIENDLY = [
    "不要", "不行", "讨厌", "烦", "滚", "走开",
    "闭嘴", "打你", "笨蛋", "傻瓜", "自私",
    "不公平", "凭什么", "偏不", "怪你", "都怪",
    "烦死了", "讨厌鬼", "偏心", "你错", "蠢",
    # 🔴 2026-07-26 扩充：覆盖更多脏话/敏感词
    "去死", "傻逼", "操", "他妈的", "我靠", "尼玛",
    "滚蛋", "找死", "废材", "蠢货", "欠揍", "打死",
    "去你的", "你去死", "你有病", "神经病", "有病吧",
    "我操", "操你", "妈的", "奶奶的", "装什么",
    "你妹", "丫的", "白痴", "弱智", "二百五",
    "滚开", "滚远", "去死吧",
]

TOPIC_KEYWORDS = [
    "阳台", "露台", "看书", "跳舞", "音乐", "安静",
    "声音", "大声", "壳壳", "彩彩", "沫沫",
    "调解", "商量", "和好", "分享", "轮流",
    "让步", "公平", "朋友", "一起",
    "办法", "主意", "方案", "解决", "问题",
    "大家", "合作",
]

# ════════════════════════════════════════════════════════════════
# 沫沫保底机制
# ════════════════════════════════════════════════════════════════

# 沫沫已升级为 AI 智能体（见 agents/momo_agent.py）

# ════════════════════════════════════════════════════════════════
# 核心函数
# ════════════════════════════════════════════════════════════════


def classify_input(text: str) -> str:
    """文本分类：constructive / off_topic / unfriendly / gibberish"""
    t = text.lower()
    chinese_chars = [c for c in text if "一" <= c <= "鿿"]
    particle_chars = set("啊吧吗呢呀哦嗯哈哟呵啦嘛哩诶喔呗咯噻呐")
    content_chars = [c for c in chinese_chars if c not in particle_chars]

    # 🔴 [修复] 2026-07-26: unfriendly 检测优先于 gibberish 长度检测
    #     避免"傻逼"、"滚蛋"等2字脏话被误判为 gibberish
    topic_score = sum(1 for w in TOPIC_KEYWORDS if w in t)
    constructive_score = sum(1 for w in KEYWORDS_CONSTRUCTIVE if w in t)
    has_unfriendly = any(w in t for w in KEYWORDS_UNFRIENDLY)

    # ⭐ 建设性 + 主题词同时出现 → 优先归为建设性（即使用户说了"不要吵"）
    if constructive_score >= 1 and topic_score >= 1:
        return "constructive"
    if constructive_score >= 2:
        return "constructive"

    # unfriendly 检测放在建设性之后但放在gibberish之前
    if has_unfriendly:
        return "unfriendly"

    # gibberish 检测（放在 unfriendly 之后，避免短脏话被误判）
    if len(text) < 3:
        return "gibberish"
    if len(chinese_chars) > 0 and len(content_chars) == 0:
        return "gibberish"
    if len(chinese_chars) == 0:
        meaningful = any(
            w in t
            for w in [
                "hello", "hi", "yes", "no", "ok", "sorry",
                "thanks", "please", "help", "good", "friend",
                "share", "together", "happy", "love", "like",
                "peace", "nice", "great", "super",
            ]
        )
        if not meaningful:
            return "gibberish"

    if topic_score >= 1:
        return "constructive"
    if len(chinese_chars) == 0:
        return "constructive"

    return "off_topic"


def calculate_score(category: str, text: str) -> int:
    """
    计算进度加分 / 扣分

    [修复] 2026-07-26:
      - unfriendly 扣分: 每轮 -10 和解度
      - 原为返回0，现改为负数扣分惩罚
    """
    if category == "unfriendly":
        return -10  # 🔴 unfriendly 扣分惩罚
    if category != "constructive":
        return 0
    t = text.lower()
    count = sum(1 for w in KEYWORDS_CONSTRUCTIVE if w in t)
    if count >= 3 and len(text) >= 10:
        return 15
    if count >= 2 or len(text) >= 8:
        return 12
    return 10


def derive_anger_level(category: str, harmony: float, round_num: int, is_keke: bool) -> int:
    """从和解度和轮次推导愤怒值

    壳壳初始愤怒较高，彩彩较低但更波动
    """
    base = 85 if is_keke else 75
    # 建设性输入大幅降低愤怒
    harmony_factor = 0.5
    round_factor = 10 if is_keke else 8
    if category == "constructive":
        anger = base - harmony * harmony_factor - round_num * round_factor
    elif category == "unfriendly":
        anger = base + 10
    elif category == "gibberish":
        anger = base + 5
    else:  # off_topic
        anger = base - harmony * 0.2 + 5

    return max(0, min(100, int(anger)))


def get_moods(category: str, round_num: int) -> tuple:
    """根据分类和轮次返回 (keke_mood, caicai_mood)"""
    if category == "constructive":
        if round_num == 1:
            return "reflective", "angry"
        elif round_num == 2:
            return "reflective", "reflective"
        else:
            return "happy", "happy"
    elif category == "unfriendly":
        return "angry", "angry"
    else:
        return "reflective", "reflective"


def get_keke_context(text: str, round_num: int, harmony: float, history: list, category: str) -> dict:
    """构建壳壳智能体的上下文"""
    return {
        "anger_level": str(derive_anger_level(category, harmony, round_num, is_keke=True)),
        "current_round": str(round_num),
        "personality": "敏感型",
        "player_input": text,
        "chat_history": json.dumps(history[-4:], ensure_ascii=False) if history else "暂无",
    }


def get_caicai_context(text: str, round_num: int, harmony: float, history: list, category: str) -> dict:
    """构建彩彩智能体的上下文"""
    return {
        "anger_level": str(derive_anger_level(category, harmony, round_num, is_keke=False)),
        "current_round": str(round_num),
        "personality": "冲动型",
        "player_input": text,
        "chat_history": json.dumps(history[-4:], ensure_ascii=False) if history else "暂无",
    }


def _detect_consecutive_unfriendly(chat_history: list, current_category: str) -> int:
    """从对话历史和当前分类检测连续unfriendly次数"""
    consecutive = 1 if current_category == "unfriendly" else 0
    if not chat_history:
        return consecutive
    # 从最近的轮次往回检查
    for entry in reversed(chat_history[-3:]):
        student_text = ""
        if isinstance(entry, dict):
            student_text = entry.get("student", entry.get("text", ""))
        elif isinstance(entry, str):
            student_text = entry
        if not student_text:
            break
        prev_cat = classify_input(student_text)
        if prev_cat == "unfriendly":
            consecutive += 1
        else:
            break
    return consecutive


def multi_agent_response(text: str, round_num: int, harmony: float, history: list) -> AgentTurnResponse:
    """多智能体编排：分类 → 双智能体并行 → 合并结果"""
    category = classify_input(text)
    score_inc = calculate_score(category, text)

    # 🔴 检测连续unfriendly
    consecutive_unf = _detect_consecutive_unfriendly(history, category)
    # 统计历史中总的unfriendly次数
    total_unf = 0
    for entry in history:
        if isinstance(entry, dict):
            student_text = entry.get("student", entry.get("text", ""))
            if student_text and classify_input(student_text) == "unfriendly":
                total_unf += 1
    if category == "unfriendly":
        total_unf += 1

    # ── 构建上下文（含推导的愤怒值） ──
    keke_ctx = get_keke_context(text, round_num, harmony, history, category)
    caicai_ctx = get_caicai_context(text, round_num, harmony, history, category)

    # ── 调用两个智能体 ──
    keke_reply = keke_agent.generate(text, keke_ctx)
    caicai_reply = caicai_agent.generate(text, caicai_ctx)

    # ── 情绪映射 ──
    keke_mood, caicai_mood = get_moods(category, round_num)

    # ── 沫沫保底（增强版） ──
    new_harmony = max(0, min(100, harmony + score_inc))
    # 沫沫只在以下情况介入提供总结：
    #   1. 最后一轮(round >= 3) → 保底总结
    #   2. 和解度已满100% → 大团圆祝贺
    #   ⚠️ 无论学生说什么，都保证走完 3 轮互动（unfriendly 不会提前结束）
    momo_needed = (round_num >= 3 or new_harmony >= 100)

    momo_reply = None
    if momo_needed:
        hist_text = json.dumps(history[-4:], ensure_ascii=False) if history else "暂无"
        momo_reply = momo_agent.generate_final_summary(
            harmony=new_harmony,
            round_num=round_num,
            chat_history=hist_text,
        )

    return AgentTurnResponse(
        category=category,
        score_increment=score_inc,
        keke_reply=keke_reply,
        caicai_reply=caicai_reply,
        keke_mood=keke_mood,
        caicai_mood=caicai_mood,
        momo_intervention_needed=momo_needed,
        momo_reply=momo_reply,
        unfriendly_count=total_unf,
        consecutive_unfriendly=consecutive_unf,
    )


# ════════════════════════════════════════════════════════════════
# API 路由
# ════════════════════════════════════════════════════════════════


@app.get("/")
def root():
    return {
        "service": "蔚蓝深海基地 · 第三关多智能体评判系统",
        "ai_enabled": keke_agent.ai_enabled,
        "agents": [
            {"name": "壳壳🦀", "status": "AI" if keke_agent.ai_enabled else "降级"},
            {"name": "彩彩🐠", "status": "AI" if caicai_agent.ai_enabled else "降级"},
            {"name": "沫沫🐬", "status": "AI" if momo_agent.ai_enabled else "降级"},
        ],
        "ai_provider": "deepseek" if keke_agent.ai_enabled else "fallback_keyword",
        "model": keke_agent.model,
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "ai_enabled": keke_agent.ai_enabled,
        "agents": {
            "keke": "online" if keke_agent.ai_enabled else "fallback",
            "caicai": "online" if caicai_agent.ai_enabled else "fallback",
        },
    }


@app.post("/api/assessment/level3-chat", response_model=dict)
def level3_chat(req: ChatRequest):
    """处理第三关的每一轮对话 — 多智能体编排"""
    if not req.student_input or len(req.student_input.strip()) < 1:
        raise HTTPException(status_code=400, detail="学生输入不能为空")

    text = req.student_input.strip()
    response = multi_agent_response(
        text, req.current_round, req.current_harmony, req.chat_history
    )

    new_harmony = min(100, req.current_harmony + response.score_increment)

    return {
        "success": True,
        "session_id": req.session_id,
        "data": {
            "category": response.category,
            "score_increment": response.score_increment,
            "new_harmony": new_harmony,
            "keke_reply": response.keke_reply,
            "caicai_reply": response.caicai_reply,
            "keke_mood": response.keke_mood,
            "caicai_mood": response.caicai_mood,
            "momo_intervention_needed": response.momo_intervention_needed,
            "momo_reply": response.momo_reply,
            "unfriendly_count": response.unfriendly_count,
            "consecutive_unfriendly": response.consecutive_unfriendly,
        },
    }


# ════════════════════════════════════════════════════════════════
# 📊 多维潜能分析报告生成接口
# ════════════════════════════════════════════════════════════════


class ReportRequest(BaseModel):
    """报告生成请求 — 接收三关完整行为数据"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str = "stu_9527"
    level1_metrics: dict = Field(default_factory=dict)
    level2_metrics: dict = Field(default_factory=dict)
    level3_metrics: dict = Field(default_factory=dict)
    level3_dialogue: list = Field(default_factory=list)


@app.post("/api/assessment/report")
def generate_assessment_report(req: ReportRequest):
    """生成完整多维潜能分析报告"""
    try:
        all_metrics = {
            "level1": req.level1_metrics,
            "level2": req.level2_metrics,
            "level3": req.level3_metrics,
        }

        report = generate_report(all_metrics, req.level3_dialogue)

        return {
            "success": True,
            "session_id": req.session_id,
            "student_id": req.student_id,
            "data": report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"报告生成失败: {str(e)}")


# ════════════════════════════════════════════════════════════════
# 📊 行为量化评分接口（纯客观数据 · 零人工干预 · 零AI依赖）
# ════════════════════════════════════════════════════════════════


@app.post("/api/assessment/quantitative-report")
def quantitative_assessment_report(req: QuantReportRequest):
    """
    生成行为量化评分报告

    基于三段固定分段规则自动计算 S1/S2/S3（各 1-5 整数分），
    加权计算综合潜能得分，查表判定 A/B/C/D/E 等级。

    核心原则:
      - 零人工干预：不允许手动调整分数
      - 零 AI 依赖：评语使用模板倒查表，不调用 LLM
      - 完全可复现：相同输入必得相同输出
      - 适合学术研究：每项得分可追溯到原始行为数据
    """
    try:
        report = generate_quantitative_report(req.dict())

        return {
            "success": True,
            "student_id": req.student_id,
            "data": report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"量化评分失败: {str(e)}")


# ════════════════════════════════════════════════════════════════
# 🎤 Edge TTS 神经网络语音合成接口
# ════════════════════════════════════════════════════════════════

# 角色音色映射（与前端共用）
VOICE_MAP = {
    "momo": "zh-CN-XiaoxiaoNeural",    # 🐬 沫沫 · 温柔明亮女声
    "keke": "zh-CN-YunxiNeural",       # 🦀 壳壳 · 清亮童趣少年声
    "caicai": "zh-CN-XiaoyiNeural",   # 🐠 彩彩 · 傲娇活力少女声
}


@app.get("/api/tts")
async def text_to_speech(
    text: str,
    voice: str = "zh-CN-XiaoxiaoNeural",
    rate: str = "+0%",
    pitch: str = "+0Hz",
    volume: str = "+0%",
):
    """Edge TTS 神经网络语音合成 — 返回 MP3 音频流

    参数:
        text: 要朗读的文本 (UTF-8)
        voice: 微软 Edge 音色代码，默认温柔女声
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="text 不能为空")

    try:
        communicate = edge_tts.Communicate(
            text.strip(),
            voice,
            rate=rate,
            pitch=pitch,
            volume=volume,
        )

        async def audio_stream():
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        return StreamingResponse(
            audio_stream(),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="speech.mp3"',
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS 生成失败: {str(e)}")


@app.get("/api/tts/voices")
async def list_voices():
    """返回所有可用的角色音色映射"""
    return {
        "success": True,
        "voices": VOICE_MAP,
        "default": "zh-CN-XiaoxiaoNeural",
    }


# ════════════════════════════════════════════════════════════════
# 启动入口
# ════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    import sys

    # 避免 Windows GBK 编码问题，用 ascii-safe 的启动信息
    agent_lines = []
    agent_lines.append(f"  [壳壳] {'AI (DeepSeek)' if keke_agent.ai_enabled else '降级模式'}")
    agent_lines.append(f"  [彩彩] {'AI (DeepSeek)' if caicai_agent.ai_enabled else '降级模式'}")
    agent_lines.append(f"  [沫沫] {'AI (DeepSeek)' if momo_agent.ai_enabled else '降级模式'}")

    print_str = (
        f"[OceanBase] Level3 Multi-Agent System\n"
        f"  Engine: Multi-Agent Orchestrator\n"
        + "\n".join(agent_lines)
        + f"\n  Model: {keke_agent.model}\n"
        f"  Server: http://localhost:8005\n"
    )
    sys.stdout.buffer.write(print_str.encode("utf-8"))
    sys.stdout.buffer.flush()
    uvicorn.run(app, host="0.0.0.0", port=8005)
