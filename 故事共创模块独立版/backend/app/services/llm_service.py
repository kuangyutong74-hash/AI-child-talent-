

from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

from openai import AsyncOpenAI

from app.config import settings
from app.prompts.story_director import build_system_prompt


HEARTBEAT_INTERVAL = 8  # seconds — keep proxies/load-balancers alive


def compute_observation(child_text: str, age_group: str = "") -> dict:
    """Programmatic fallback: analyze child's text for 5 language intelligence dimensions.

    Based on Gardner's Multiple Intelligences (linguistic domain).
    """
    if not child_text or not child_text.strip():
        return {
            "vocabulary_semantic": 1, "vocabulary_semantic_examples": "",
            "sentence_fluency": 1, "sentence_fluency_examples": "",
            "narrative_completeness": 1, "narrative_structure_note": "无输入",
            "character_empathy": 1, "character_empathy_examples": "",
            "creative_initiative": 1, "creative_initiative_examples": "",
            "creativity_flags": [],
        }

    text = child_text.strip()
    words = [w for w in text if w not in '，。！？、；：""''（）']
    word_count = len(text.replace(' ', ''))
    sentences = [s.strip() for s in text.replace("！", "。").replace("？", "。").replace("!", ".").replace("?", ".").split("。") if len(s.strip()) >= 2]

    # ── 1. vocabulary_semantic ──
    modifier_keywords = ["很", "非常", "特别", "极了", "极了", "最", "更", "太",
                        "慢慢", "轻轻", "悄悄", "渐渐", "忽然", "突然", "已经", "正在"]
    emotion_keywords = ["开心", "难过", "害怕", "生气", "惊讶", "兴奋", "担心", "喜欢",
                       "感动", "伤心", "紧张", "骄傲", "害羞", "好奇", "着急", "幸福"]
    concrete_keywords = []  # detected by word length
    metaphor_signals = ["像", "仿佛", "好像", "如同", "似乎", "变成", "成了", "一样"]
    personification_signals = ["说", "笑", "哭", "想", "知道", "告诉", "问", "回答"]

    mod_count = sum(1 for kw in modifier_keywords if kw in text)
    emo_count = sum(1 for kw in emotion_keywords if kw in text)
    long_words = [w for w in text if len(w.encode('utf-8', errors='ignore')) >= 6]  # longer Chinese words
    meta_count = sum(1 for kw in metaphor_signals if kw in text)
    pers_count = sum(1 for kw in personification_signals if kw in text and any(c in text for c in ["：", "「", "\"", "“"]))

    semantic_score = 1
    if mod_count >= 3 and meta_count >= 1: semantic_score = 5
    elif mod_count >= 2 or (meta_count >= 1 and emo_count >= 1): semantic_score = 4
    elif mod_count >= 1 or emo_count >= 1: semantic_score = 3
    elif word_count >= 10: semantic_score = 2

    semantic_examples = []
    if mod_count > 0: semantic_examples.append(f"修饰词×{mod_count}")
    if emo_count > 0: semantic_examples.append(f"情绪词×{emo_count}")
    if meta_count > 0: semantic_examples.append(f"比喻/拟人×{meta_count}")
    semantic_examples_str = "; ".join(semantic_examples) if semantic_examples else ""

    # ── 2. sentence_fluency ──
    fluency = 1
    if len(sentences) >= 4 and all(len(s) >= 5 for s in sentences):
        fluency = 5
    elif len(sentences) >= 3:
        fluency = 4
    elif len(sentences) >= 2:
        fluency = 3
    elif len(sentences) >= 1 and len(sentences[0]) >= 10:
        fluency = 2

    fluency_examples = sentences[0][:80] if sentences else ""

    # ── 3. narrative_completeness ──
    cause_signals = ["因为", "所以", "由于", "于是", "因此"]
    conflict_signals = ["但是", "可是", "突然", "忽然", "没想到", "竟然", "居然", "不过"]
    resolve_signals = ["然后", "后来", "最后", "终于", "结果", "发现", "解决了", "成功了"]
    ending_signals = ["结束", "回家", "离开", "回到", "从此", "以后", "好了", "完了", "故事"]

    cause_count = sum(1 for kw in cause_signals if kw in text)
    conflict_count = sum(1 for kw in conflict_signals if kw in text)
    resolve_count = sum(1 for kw in resolve_signals if kw in text)
    ending_count = sum(1 for kw in ending_signals if kw in text)

    struct_signals = cause_count + conflict_count + resolve_count + ending_count
    completeness = 1
    if cause_count >= 1 and conflict_count >= 1 and resolve_count >= 1: completeness = 5
    elif conflict_count >= 1 and resolve_count >= 1: completeness = 4
    elif cause_count >= 1 or conflict_count >= 1: completeness = 3
    elif len(sentences) >= 2: completeness = 2

    # ── 4. character_empathy ──
    dialogue_signals = ["说", "问", "回答", "喊道", "叫道", "说道", "告诉", "喊", "叫",
                       "：", "「", "」", "\"", "\"", "“", "”"]
    thought_signals = ["想", "觉得", "感到", "认为", "希望", "害怕", "担心", "开心"]
    emotion_in_context = any(kw in text for kw in ["开心", "难过", "害怕", "生气", "哭了", "笑了", "跳起来", "发抖"])

    dialogue_count = sum(1 for kw in dialogue_signals if kw in text)
    thought_count = sum(1 for kw in thought_signals if kw in text)

    empathy = 1
    if dialogue_count >= 3 and thought_count >= 1: empathy = 5
    elif dialogue_count >= 2: empathy = 4
    elif dialogue_count >= 1 or thought_count >= 1: empathy = 3
    elif emotion_in_context: empathy = 2

    empathy_examples = ""
    if dialogue_count >= 1: empathy_examples += f"角色对话×{dialogue_count} "
    if thought_count >= 1: empathy_examples += f"心理活动×{thought_count}"
    empathy_examples = empathy_examples.strip()

    # ── 5. creative_initiative ──
    # Detect if child goes beyond the expected response: new characters, locations, objects
    new_element_signals = 0
    for kw in ["新", "突然出现", "没想到", "其实", "另外", "还有", "之前", "原来", "秘密", "隐藏"]:
        if kw in text: new_element_signals += 1

    # Count unique proper nouns / named entities (rough heuristic: consecutive capital/long words)
    named_count = len([w for w in text if len(w.encode('utf-8', errors='ignore')) >= 9])

    initiative = 1
    if new_element_signals >= 3 and word_count >= 50: initiative = 5
    elif new_element_signals >= 2: initiative = 4
    elif new_element_signals >= 1: initiative = 3
    elif word_count >= 20: initiative = 2

    initiative_examples = f"新增元素×{new_element_signals}" if new_element_signals > 0 else ""

    # ── Adjust for age group ──
    if age_group == "4-7":
        # Younger children: lenient scoring, reward any expression
        semantic_score = min(5, semantic_score + 1)
        fluency = min(5, fluency + 1)
        completeness = min(5, completeness + (0 if word_count < 5 else 1))
        empathy = min(5, empathy + (1 if word_count > 10 else 0))
        initiative = min(5, initiative + 1)

    # ── Creativity flags ──
    flags = []
    for kw, flag in [("突然", "unexpected_twist"), ("像", "metaphor_usage"), ("仿佛", "metaphor_usage"),
                     ("说", "original_dialogue"), ("生气", "emotional_depth"), ("开心", "emotional_depth"),
                     ("哭了", "emotional_depth"), ("笑了", "emotional_depth"),
                     ("好像", "personification"), ("因为", "logical_consistency"), ("所以", "logical_consistency")]:
        if kw in text and flag not in flags:
            flags.append(flag)

    return {
        "vocabulary_semantic": semantic_score,
        "vocabulary_semantic_examples": semantic_examples_str,
        "sentence_fluency": fluency,
        "sentence_fluency_examples": fluency_examples,
        "narrative_completeness": completeness,
        "narrative_structure_note": f"起因×{cause_count} 冲突×{conflict_count} 解决×{resolve_count} 结尾×{ending_count}",
        "character_empathy": empathy,
        "character_empathy_examples": empathy_examples,
        "creative_initiative": initiative,
        "creative_initiative_examples": initiative_examples,
        "creativity_flags": flags,
    }


def upgrade_observation(data: dict) -> dict:
    """Add the standardized rubric fields to a legacy/fallback observation."""
    upgraded = dict(data)
    narrative = int(upgraded.get("narrative_completeness") or 1)
    vocabulary = int(upgraded.get("vocabulary_semantic") or 1)
    empathy = int(upgraded.get("character_empathy") or 1)
    initiative = int(upgraded.get("creative_initiative") or 1)
    fluency = int(upgraded.get("sentence_fluency") or 1)
    defaults = {
        "language_causal_logic": narrative,
        "language_plot_memory": max(0, narrative - 1),
        "language_vocabulary": vocabulary,
        "language_detail": max(0, round((vocabulary + fluency) / 2) - 1),
        "language_character_voice": empathy,
        "language_initiative": initiative,
        "empathy_emotion": empathy,
        "empathy_perspective": max(0, empathy - 1),
        "empathy_prosocial": max(0, empathy - 1),
        "empathy_conflict": max(0, empathy - 1),
        "imagination_character": initiative,
        "imagination_setting": max(0, initiative - 1),
        "imagination_rules": max(0, initiative - 1),
        "imagination_side_plot": max(0, initiative - 1),
        "evidence": [],
    }
    for key, value in defaults.items():
        upgraded.setdefault(key, value)
    return upgraded


def apply_empathy_keyword_fallback(data: dict, child_text: str) -> dict:
    """Recover explicit interpersonal evidence missed by the evaluator.

    This is deliberately conservative: it only fills a zero-valued empathy
    dimension when the child's literal sentence contains a strong, observable
    interaction signal. Existing model scores and evidence are never replaced.
    """
    result = dict(data)
    text = (child_text or "").strip()
    if not text:
        return result

    dimension_evidence = dict(result.get("dimension_evidence") or {})
    rules = {
        "empathy_emotion": (
            ("难过", "伤心", "害怕", "担心", "着急", "生气", "开心", "感动", "紧张",
             "孤单", "委屈", "失望", "害羞", "兴奋", "羡慕", "嫉妒", "安心", "舍不得",
             "不好意思", "后悔", "惊讶"),
            3,
            "孩子明确写出了角色的情绪，可直接观察其情绪识别与表达。",
        ),
        "empathy_perspective": (
            ("听对方解释", "听完他的解释", "听完她的解释", "理解他的", "理解她的",
             "站在对方", "原来他", "原来她", "担心大家", "先听", "明白了他",
             "明白了她", "想到他", "想到她", "想到它", "注意到他", "注意到她",
             "注意到它", "知道他需要", "知道她需要", "知道它需要"),
            3,
            "孩子安排角色倾听或理解对方的原因与处境，体现了换位思考。",
        ),
        "empathy_prosocial": (
            ("一起", "帮助", "帮他", "帮她", "帮它", "陪你", "合作", "分享", "照顾",
             "互相", "递给", "让给", "扶起", "安慰", "鼓励", "等一等", "保护",
             "轮流", "分工", "结伴"),
            3,
            "孩子设计了帮助、陪伴或共同完成任务的行为，体现了互助合作。",
        ),
        "empathy_conflict": (
            ("道歉", "对不起", "和好", "商量", "沟通", "解释", "原谅", "不争吵",
             "停下来听", "和平解决", "先问清楚", "轮流说", "达成约定", "重新分配",
             "各退一步", "一起想办法", "查清误会"),
            3,
            "孩子让角色通过倾听、解释、道歉或协商处理分歧，属于温和解决冲突。",
        ),
    }
    for key, (keywords, fallback_score, analysis) in rules.items():
        if int(result.get(key, 0) or 0) > 0:
            continue
        matched = next((word for word in keywords if word in text), "")
        if not matched:
            continue
        result[key] = fallback_score
        dimension_evidence.setdefault(key, {
            "quote": text[:160],
            "analysis": f"{analysis}识别依据是原话中的“{matched}”。",
            "recall_source": ["semantic_rule"],
            "status": "confirmed",
        })

    result["dimension_evidence"] = dimension_evidence
    result["evidence"] = list(dict.fromkeys(
        item.get("quote", "")
        for item in dimension_evidence.values()
        if isinstance(item, dict) and item.get("quote")
    ))[:3]
    empathy_keys = (
        "empathy_emotion", "empathy_perspective",
        "empathy_prosocial", "empathy_conflict",
    )
    result["character_empathy"] = max(
        1,
        round(sum(int(result.get(key, 0) or 0) for key in empathy_keys) / 4),
    )
    result["character_empathy_examples"] = "；".join(result["evidence"])
    return result


def apply_multilabel_recall(data: dict, child_text: str) -> dict:
    """Recall explicit empathy/imagination evidence without replacing LLM scores.

    Recall is intentionally multi-label: one literal child sentence may support
    several constructs. Rules only fill zero-valued dimensions and every added
    item keeps the exact child quote plus its recall source for audit.
    """
    result = apply_empathy_keyword_fallback(data, child_text)
    text = (child_text or "").strip()
    if not text:
        return result
    evidence = dict(result.get("dimension_evidence") or {})

    def fill(key: str, score: int, matched: str, analysis: str, source: str):
        if int(result.get(key, 0) or 0) > 0:
            return
        result[key] = score
        evidence[key] = {
            "quote": text[:160],
            "analysis": f"{analysis}识别依据是原话中的“{matched}”。",
            "recall_source": [source],
            "status": "confirmed",
        }

    # Human interaction: include indirect emotion and purpose-bearing actions.
    indirect_emotion = (
        "不敢", "躲起来", "低下头", "发抖", "哭了", "笑了", "一直回头",
        "沉默了", "眼圈红了", "松了一口气", "皱起眉", "抱紧", "缩在角落",
    )
    matched = next((word for word in indirect_emotion if word in text), "")
    if matched:
        fill("empathy_emotion", 2, matched, "身体反应或行为直接提供了角色情绪线索。", "semantic_rule")

    perspective_patterns = (
        "因为他", "因为她", "因为它", "考虑到", "怕他", "怕她", "怕它",
        "让他先", "让她先", "让它先", "等他", "等她", "等它",
        "为了不让", "不想让他", "不想让她", "不想让它", "替他想", "替她想",
        "从他的角度", "从她的角度", "需要的是",
    )
    matched = next((word for word in perspective_patterns if word in text), "")
    if not matched and "因为" in text and any(
        word in text for word in ("害怕", "担心", "难过", "着急", "不敢", "迷路")
    ):
        matched = "因为…情绪/处境"
    if matched:
        fill("empathy_perspective", 3, matched, "角色根据他人的原因、需要或处境调整了行动。", "semantic_rule")

    prosocial_patterns = (
        "陪", "扶住", "保护", "分工", "轮流", "递给", "送回", "带着",
        "一起找", "一起修", "一起完成", "结伴", "邀请", "让给", "分享",
        "安慰", "鼓励", "照顾", "扶起", "借给", "留给", "等一等", "为了不让",
    )
    matched = next((word for word in prosocial_patterns if word in text), "")
    if matched:
        fill("empathy_prosocial", 3, matched, "原话包含面向他人的陪伴、支持、合作或保护行为。", "semantic_rule")

    conflict_patterns = (
        "先询问", "先问", "先听", "听完", "互相道歉", "约定", "商量",
        "解释清楚", "避免误会", "改成合作", "不争", "轮流",
        "各退一步", "一起想办法", "查清", "原谅", "重新分配", "和平",
    )
    matched = next((word for word in conflict_patterns if word in text), "")
    if matched:
        fill("empathy_conflict", 3, matched, "角色用倾听、约定、协商或合作替代对抗。", "semantic_rule")

    # Imagination: explicit fantasy entities and mechanisms. Mundane location
    # nouns alone are insufficient; a fantasy modifier or impossible behavior
    # must also occur.
    fantasy_markers = (
        "魔法", "精灵", "云端", "云层", "月亮森林", "钟表城", "甜点王国", "彩虹桥",
        "会说话", "会唱歌", "会打喷嚏", "时间倒流", "发光", "漂浮",
        "隐形", "变成", "飞船", "星球", "传送门", "梦境", "糖果城",
        "会飞", "会变色", "会讲话", "会跳舞", "能听懂", "能打开时空",
        "悬浮", "透明", "星光", "银河", "海底城", "天空岛", "时光",
    )
    fantasy = next((word for word in fantasy_markers if word in text), "")
    character_markers = (
        "小鱼", "小鹿", "机器人", "邮差", "守门人", "精灵", "怪兽",
        "棉花糖", "钥匙", "石板", "地图", "羽毛", "云朵", "影子",
        "玩具", "书本", "钟表", "月亮", "星星", "树木", "小船",
    )
    character = next((word for word in character_markers if word in text), "")
    if fantasy and character:
        fill(
            "imagination_character", 3, f"{fantasy}、{character}",
            "孩子把角色、物品或生物赋予了非日常特征，形成可辨认的原创形象。",
            "semantic_rule",
        )

    setting_markers = (
        "城", "森林", "王国", "邮局", "山洞", "星球", "云层", "树洞", "小路", "桥",
        "岛", "宫殿", "塔", "车站", "海底", "天空", "银河", "迷宫", "花园", "工厂",
    )
    setting = next((word for word in setting_markers if word in text), "")
    if fantasy and setting:
        fill(
            "imagination_setting", 3, f"{fantasy}、{setting}",
            "幻想标记与地点结构同时出现，构成了可感知的虚构场景。",
            "semantic_rule",
        )

    rule_patterns = (
        "只要", "必须", "否则", "每当", "只有", "才能", "规定",
        "一到", "就会", "就能", "时间会", "不受", "不能", "一旦",
        "除非", "每个", "都会", "都要", "不可以", "会自动", "触碰后",
    )
    rule_hits = [word for word in rule_patterns if word in text]
    if len(rule_hits) >= 2 or any(word in text for word in ("时间倒流", "规定", "否则")):
        matched = "、".join(rule_hits[:2]) or next(
            word for word in ("时间倒流", "规定", "否则") if word in text
        )
        fill(
            "imagination_rules", 4, matched,
            "条件、限制或稳定结果构成了故事世界的运行机制。",
            "semantic_rule",
        )

    side_patterns = (
        "新线索", "地图背面", "隐藏", "另一条", "第三枚", "支线",
        "继续调查", "明天继续", "秘密", "小任务", "岔路", "通往",
        "又发现", "还发现", "另一边", "与此同时", "突然收到", "第二个任务",
        "留下记号", "暗号", "伏笔", "神秘声音", "新的地图", "门后还有",
    )
    matched = next((word for word in side_patterns if word in text), "")
    if matched:
        fill(
            "imagination_side_plot", 3, matched,
            "孩子在当前主线之外增加了可继续发展的线索、地点或任务。",
            "semantic_rule",
        )

    result["dimension_evidence"] = evidence
    for item in evidence.values():
        if not isinstance(item, dict):
            continue
        item.setdefault("recall_source", ["llm"])
        item.setdefault("status", "confirmed")
    result["evidence_version"] = max(4, int(result.get("evidence_version", 0) or 0))
    result["evidence"] = list(dict.fromkeys(
        item.get("quote", "")
        for item in evidence.values()
        if isinstance(item, dict) and item.get("quote")
    ))[:6]
    result["character_empathy"] = max(
        1,
        round(sum(int(result.get(key, 0) or 0) for key in (
            "empathy_emotion", "empathy_perspective",
            "empathy_prosocial", "empathy_conflict",
        )) / 4),
    )
    return result


def _try_parse_json_line(line: str) -> dict | None:
    """Try to parse a line as JSON. Returns parsed dict or None.

    Handles common DeepSeek output errors:
    - Unescaped Chinese quotes inside JSON strings (e.g. "text":"他说"你好"")
    - Extra commas or trailing content
    """
    if not line or not line.startswith("{"):
        return None

    # Attempt 1: direct parse
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        pass

    # Attempt 2: replace Chinese double quotes inside JSON string values
    # Pattern: inside "text":"...", replace "" with 「」
    try:
        fixed = _fix_json_quotes(line)
        if fixed != line:
            return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Attempt 3: try to extract a JSON object with regex
    import re
    match = re.search(r'\{.+"type":\s*"(narrative|question|observation|done)".+?\}\s*$', line)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return None


def _fix_json_quotes(text: str) -> str:
    """Replace Chinese double quotes inside JSON string values with corner brackets."""
    import re
    # Find text between "text":" and the closing " before the next JSON key or end
    # This is a simplified heuristic: replace “ and ” inside text values
    result = []
    in_text_value = False
    i = 0
    while i < len(text):
        if not in_text_value and text[i:i+7] == '"text":"':
            result.append(text[i:i+7])
            i += 7
            in_text_value = True
            continue
        if in_text_value:
            if text[i] == '"' and i + 1 < len(text) and text[i+1] == '"':
                result.append('“')  # "
                i += 1
            elif text[i] == '"' and i + 1 < len(text) and text[i+1] == '"':
                result.append('”')  # "
                i += 1
            elif text[i] == '"' and (i + 1 >= len(text) or text[i+1] in ',}'):
                # End of text value
                result.append('"')
                in_text_value = False
            elif text[i] == '"':
                # Unescaped quote inside text — replace with 「
                # Look ahead to find the matching unescaped quote
                result.append('「')  # 「
            else:
                result.append(text[i])
        else:
            result.append(text[i])
        i += 1
    return ''.join(result)


async def _emit_plain_text(plain_text: str, queue: asyncio.Queue):
    """Parse plain-text LLM output into narrative + question events.

    DeepSeek sometimes ignores the JSON Lines format and outputs plain text directly.
    This fallback salvages the content: the story text becomes narrative chunks,
    and the last sentence (if it ends with ? or ？) becomes the question.

    Also strips out any raw JSON-looking lines that leaked through.
    """
    import re

    text = plain_text.strip()
    if not text:
        return

    # ── Strip raw JSON objects/lines that leaked through ──
    # Remove lines that look like {"type":"...",...}
    text = re.sub(r'\{"type"\s*:\s*"(?:narrative|question|observation|done|ending)"[^}]*\}', '', text)
    # Remove standalone JSON fragments
    text = re.sub(r'"type"\s*:\s*"(?:narrative_chunk|question|observation|done)"', '', text)
    text = text.strip()
    if not text:
        return

    # Try to split into narrative + question
    question_markers = ["？", "?", "吗", "呢", "什么", "怎么", "哪里", "哪个"]
    sentences = text.replace("！", "。").replace("?", "？").split("。")

    narrative_parts = []
    question = ""

    found_question = False
    for i, sent in enumerate(sentences):
        sent = sent.strip()
        if not sent:
            continue
        # Check if this sentence looks like a question (last non-empty or contains markers)
        is_last = (i == len(sentences) - 1)
        has_marker = any(m in sent for m in question_markers)
        if (is_last and has_marker) or (has_marker and not found_question and is_last):
            question = sent + ("？" if not sent.endswith(("？", "?")) else "")
            found_question = True
        else:
            narrative_parts.append(sent)

    # Rebuild narrative
    narrative = "。".join(narrative_parts)
    if narrative and not narrative.endswith(("。", "！", "!", ".", "~")):
        narrative += "。"

    # If no question found, craft a generic one
    if not question:
        question = "你觉得接下来会发生什么呢？"

    # Emit narrative in chunks of ~30 chars for streaming effect
    chunk_size = 30
    for i in range(0, len(narrative), chunk_size):
        await queue.put({"type": "narrative_chunk", "text": narrative[i:i + chunk_size]})

    if question:
        await queue.put({"type": "question", "text": question})


class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            timeout=60.0,
        )
        self.model = settings.llm_model

    async def generate_turn(
        self,
        messages: list[dict],
        character_name: str = "",
        character_type: str = "",
        personality: str = "",
        theme: str = "",
        is_first_turn: bool = False,
        age_group: str = "8-12",
    ) -> AsyncGenerator[dict, None]:
        """
        Stream-generate a story turn from the LLM.

        Uses an asyncio.Queue so heartbeat events fire independently
        of LLM chunk arrival.  This prevents proxy/browser timeouts.
        """
        system_prompt = build_system_prompt(
            character_name=character_name,
            character_type=character_type,
            personality=personality,
            theme=theme,
            is_first_turn=is_first_turn,
            age_group=age_group,
        )

        full_messages = [
            {"role": "system", "content": system_prompt},
            *messages,
        ]

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                stream=True,
                temperature=0.8,
                max_tokens=1024,
                timeout=60.0,
            )
        except Exception as e:
            raise LLMServiceError(f"AI 导演暂时无法响应: {str(e)[:100]}")

        # ── Queue-based stream + independent heartbeat ──
        queue: asyncio.Queue[dict | None] = asyncio.Queue(maxsize=32)
        stream_done = asyncio.Event()

        async def pump_chunks():
            """Read LLM chunks → parse JSON Lines (with plain-text prefix handling) → enqueue."""
            import re

            buffer = ""
            pending_plain = ""      # Text accumulated BEFORE first valid JSON line
            seen_valid_json = False  # Whether we've successfully parsed at least one JSON line

            try:
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta.content or ""
                    buffer += delta

                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line:
                            continue

                        # ── Try to parse as JSON (with basic error recovery) ──
                        parsed = _try_parse_json_line(line)
                        if parsed is not None:
                            # Valid JSON found! Flush any pending plain text as narrative
                            seen_valid_json = True
                            if pending_plain.strip():
                                await _emit_plain_text(pending_plain.strip(), queue)
                                pending_plain = ""

                            t = parsed.get("type")
                            if t == "narrative":
                                chunk = {"type": "narrative_chunk", "text": parsed.get("text", "")}
                                if parsed.get("image_prompt"):
                                    chunk["image_prompt"] = parsed["image_prompt"]
                                await queue.put(chunk)
                            elif t == "ending":
                                await queue.put({"type": "ending", "text": parsed.get("text", "")})
                            elif t == "question":
                                await queue.put({"type": "question", "text": parsed.get("text", "")})
                            elif t == "observation":
                                await queue.put({"type": "observation", "data": parsed.get("data", {})})
                            elif t == "done":
                                await queue.put({"type": "done"})
                                stream_done.set()
                                return
                        else:
                            # Not valid JSON
                            if not seen_valid_json:
                                # Haven't seen JSON yet — accumulate as potential prefix
                                pending_plain += line
                            # else: seen JSON before, skip noise between JSON lines

                # ── Stream ended ──
                if buffer.strip():
                    parsed = _try_parse_json_line(buffer.strip())
                    if parsed is not None and parsed.get("type") == "done":
                        await queue.put({"type": "done"})
                        stream_done.set()
                        return
                    if not seen_valid_json:
                        pending_plain += buffer

                # If we never saw valid JSON, treat everything as plain text
                if not seen_valid_json and pending_plain.strip():
                    await _emit_plain_text(pending_plain.strip(), queue)

            except Exception as e:
                import traceback
                traceback.print_exc()
                if pending_plain.strip():
                    await _emit_plain_text(pending_plain.strip(), queue)
            finally:
                await queue.put({"type": "done"})
                stream_done.set()

        async def pump_heartbeats():
            """Send heartbeat events on a fixed cadence."""
            while not stream_done.is_set():
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                if not stream_done.is_set():
                    await queue.put({"type": "heartbeat"})

        # Launch both pumps concurrently
        chunk_task = asyncio.create_task(pump_chunks())
        heartbeat_task = asyncio.create_task(pump_heartbeats())

        # Read from queue and yield until done
        done_received = False
        while not done_received:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_INTERVAL + 2)
            except asyncio.TimeoutError:
                # Queue was silent for too long — inject heartbeat manually
                yield {"type": "heartbeat"}
                continue

            if event is None:
                continue

            if event["type"] == "done":
                done_received = True

            yield event

        # Cleanup
        stream_done.set()
        chunk_task.cancel()
        heartbeat_task.cancel()
        try:
            await asyncio.gather(chunk_task, heartbeat_task, return_exceptions=True)
        except asyncio.CancelledError:
            pass


    async def evaluate_turn(
        self,
        child_text: str,
        age_group: str = "8-12",
        story_context: str = "",
    ) -> dict:
        """Evaluate only the child's words, using prior context for continuity."""
        from app.prompts.talent_evaluator import build_evaluator_prompt

        if not child_text or not child_text.strip():
            return upgrade_observation(compute_observation(child_text, age_group))

        evaluator_prompt = build_evaluator_prompt(age_group)
        user_payload = (
            f"【此前故事上下文（仅供判断承接，不得作为得分证据）】\n"
            f"{story_context[-5000:] or '无'}\n\n"
            f"【本次孩子原话（唯一评分对象）】\n{child_text.strip()}"
        )

        try:
            resp = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": evaluator_prompt},
                    {"role": "user", "content": user_payload},
                ],
                stream=False,
                temperature=0.3,   # Low temp for consistent scoring
                max_tokens=1800,
                timeout=25.0,
            )
            content = (resp.choices[0].message.content or "").strip()
            # Some compatible model providers wrap JSON in Markdown fences.
            if content.startswith("```"):
                content = content.removeprefix("```json").removeprefix("```")
                content = content.removesuffix("```").strip()
            data = json.loads(content)
            keys = (
                "language_causal_logic", "language_plot_memory",
                "language_vocabulary", "language_detail",
                "language_character_voice", "language_initiative",
                "empathy_emotion", "empathy_perspective",
                "empathy_prosocial", "empathy_conflict",
                "imagination_character", "imagination_setting",
                "imagination_rules", "imagination_side_plot",
            )
            score = lambda key: max(0, min(5, int(data.get(key, 0))))
            result = {key: score(key) for key in keys}
            raw_evidence = data.get("dimension_evidence", {})
            dimension_evidence = {}
            if isinstance(raw_evidence, dict):
                for key in keys:
                    item = raw_evidence.get(key, {})
                    if not isinstance(item, dict):
                        continue
                    quote = str(item.get("quote", "")).strip()
                    analysis = str(item.get("analysis", "")).strip()
                    # Reject hallucinated quotes: evidence must be a literal
                    # substring of the child's current contribution.
                    if quote and quote in child_text:
                        dimension_evidence[key] = {
                            "quote": quote[:160],
                            "analysis": analysis[:600],
                        }
            result["dimension_evidence"] = dimension_evidence
            result["evidence_version"] = 3
            result["evidence"] = list(dict.fromkeys(
                item["quote"] for item in dimension_evidence.values() if item["quote"]
            ))[:3]

            # Keep the original columns populated for older code and reports.
            result.update({
                "vocabulary_semantic": max(1, result["language_vocabulary"]),
                "vocabulary_semantic_examples": "；".join(result["evidence"]),
                "sentence_fluency": max(1, result["language_causal_logic"]),
                "sentence_fluency_examples": "",
                "narrative_completeness": max(1, result["language_causal_logic"]),
                "narrative_structure_note": "",
                "character_empathy": max(
                    1,
                    round(sum(result[k] for k in (
                        "empathy_emotion", "empathy_perspective",
                        "empathy_prosocial", "empathy_conflict",
                    )) / 4),
                ),
                "character_empathy_examples": "；".join(result["evidence"]),
                "creative_initiative": max(1, result["language_initiative"]),
                "creative_initiative_examples": "；".join(result["evidence"]),
                "creativity_flags": [],
            })
            return apply_multilabel_recall(result, child_text)
        except Exception:
            # Fallback to programmatic scoring
            return apply_multilabel_recall(
                upgrade_observation(compute_observation(child_text, age_group)),
                child_text,
            )

    async def generate_praise(
        self,
        child_text: str,
        story_context: str = "",
        age_group: str = "8-12",
    ) -> str:
        """Generate one evidence-based, child-friendly praise from Story Fairy."""
        from app.prompts.story_fairy import build_story_fairy_prompt

        text = child_text.strip()
        if not text:
            return ""
        payload = (
            f"【此前故事上下文（仅供理解）】\n{story_context[-3500:] or '无'}\n\n"
            f"【本次孩子原话（唯一夸赞对象）】\n{text}"
        )
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": build_story_fairy_prompt(age_group)},
                    {"role": "user", "content": payload},
                ],
                stream=False,
                temperature=0.6,
                max_tokens=120,
                timeout=10.0,
            )
            content = (response.choices[0].message.content or "").strip()
            if content.startswith("```"):
                content = content.removeprefix("```json").removeprefix("```")
                content = content.removesuffix("```").strip()
            praise = str(json.loads(content).get("praise", "")).strip()
            return praise[:80]
        except Exception:
            excerpt = " ".join(text.split())[:24]
            return f"我注意到你写了“{excerpt}”，这是你亲手加进故事里的好点子！"


class LLMServiceError(Exception):
    pass


# Singleton
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        if not settings.llm_api_key.strip():
            raise LLMServiceError(
                "尚未配置 LLM_API_KEY，请在 story-backend/.env 中填写 DeepSeek 密钥后重启后端"
            )
        _llm_service = LLMService()
    return _llm_service
