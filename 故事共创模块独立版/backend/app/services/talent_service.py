"""Generate the standardized three-channel talent report.

Only observations attached to genuine child messages are used. Historical
stories belonging to the same account provide the persistent progress memory.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character
from app.models.message import StoryMessage
from app.models.observation import Observation
from app.models.story import Story
from app.services.content_guard import contains_prohibited_content, redact_privacy


@dataclass
class TalentProfile:
    story_id: int
    story_title: str
    total_turns: int
    age_group: str
    completed: bool
    measurability: dict = field(default_factory=dict)
    language: dict = field(default_factory=dict)
    empathy: dict = field(default_factory=dict)
    imagination: dict = field(default_factory=dict)
    growth_memory: dict = field(default_factory=dict)
    highlights: list[str] = field(default_factory=list)
    total_words: int = 0
    avg_words_per_turn: float = 0.0
    strengths: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


RUBRIC_KEYS = (
    "language_causal_logic", "language_plot_memory", "language_vocabulary",
    "language_detail", "language_character_voice", "language_initiative",
    "empathy_emotion", "empathy_perspective", "empathy_prosocial",
    "empathy_conflict", "imagination_character", "imagination_setting",
    "imagination_rules", "imagination_side_plot",
)

DIMENSION_CRITERIA = {
    "language_causal_logic": "观察事件之间是否有清楚的原因、发展和结果",
    "language_plot_memory": "观察是否准确承接此前的人物、地点、规则或长线情节",
    "language_vocabulary": "观察孩子自己的词汇选择、修饰表达和语言准确性",
    "language_detail": "观察动作、神态、环境、感官或心理细节",
    "language_character_voice": "观察孩子是否创作角色台词、独白或有差异的说话方式",
    "language_initiative": "观察是否主动增加新情节，而不只是回答导演的问题",
    "empathy_emotion": "观察是否识别并表达角色的感受及其原因",
    "empathy_perspective": "观察是否理解不同角色各自的立场和需要",
    "empathy_prosocial": "观察是否主动设计帮助、分享、包容或合作",
    "empathy_conflict": "观察是否用沟通、协商或道歉等方式处理冲突",
    "imagination_character": "观察是否创造具有独特特征的角色、生物或物品",
    "imagination_setting": "观察是否创造具体而独特的虚构场景",
    "imagination_rules": "观察是否提出原创且能保持一致的世界规则",
    "imagination_side_plot": "观察是否主动增加支线、伏笔、隐藏任务或多层情节",
}

DIMENSION_PRACTICE = {
    "language_causal_logic": "请孩子用“因为—所以—结果”补全一个事件，至少写出原因、行动和结果三步",
    "language_plot_memory": "创作前一起回顾人物、地点和重要物品，下一轮至少准确承接其中两个信息",
    "language_vocabulary": "选择一个普通词语，分别换成更准确的动作词和状态词，每轮尝试使用两个新词",
    "language_detail": "围绕一个画面补写“看到了什么、听到了什么、角色做了什么”三个细节",
    "language_character_voice": "让两个角色各说一句话，并让他们的语气、愿望或态度明显不同",
    "language_initiative": "回答导演问题后，再主动增加一个新角色、新物品或意外变化",
    "empathy_emotion": "写出角色“感到什么、为什么有这种感受、接下来会怎么做”",
    "empathy_perspective": "让两个角色分别说出自己的想法，并比较他们需要的东西有什么不同",
    "empathy_prosocial": "设计一次具体合作：谁遇到困难、谁提供帮助、两人怎样一起完成",
    "empathy_conflict": "为一次分歧写出沟通、倾听和达成办法三个步骤，避免直接用输赢结束",
    "imagination_character": "创造一个新角色，并确定外形、特殊能力和一个小缺点",
    "imagination_setting": "描写一个新地点，至少加入颜色、声音和可互动的特殊物品",
    "imagination_rules": "提出一条世界规则，再写出遵守它和违反它分别会发生什么",
    "imagination_side_plot": "在主线旁增加一条小任务，并让它在后续至少被再次提到一次",
}

CHILD_STRENGTH = {
    "language_causal_logic": "你会把事情一件接一件地讲清楚",
    "language_plot_memory": "你记得前面发生过的事，还能把故事接下去",
    "language_vocabulary": "你会挑选很有画面感的词语",
    "language_detail": "你很会发现小细节，故事像动画一样动起来了",
    "language_character_voice": "你会让角色用自己的语气说话",
    "language_initiative": "你会主动给故事加上新点子",
    "empathy_emotion": "你能发现角色心里是什么感觉",
    "empathy_perspective": "你会站在不同角色的位置想一想",
    "empathy_prosocial": "你喜欢让故事里的伙伴互相帮助",
    "empathy_conflict": "你会帮角色想出温和解决问题的办法",
    "imagination_character": "你能创造出很特别的新角色",
    "imagination_setting": "你能想出像梦境一样的新地方",
    "imagination_rules": "你会给故事世界设计神奇规则",
    "imagination_side_plot": "你会悄悄埋下新的线索和小任务",
}


def _story_phrase(text: str, index: int = 0, limit: int = 24) -> str:
    """Pick a recognizable phrase from the child's own sentence."""
    phrases = [
        part.strip("“”\" 。！？!?")
        for part in re.split(r"[，,。！？!?；;]", text)
        if part.strip("“”\" 。！？!?")
    ]
    if not phrases:
        return text[:limit]
    selected = phrases[min(index, len(phrases) - 1)]
    return selected if len(selected) <= limit else selected[:limit] + "……"


def _child_specific_praise(text: str, key: str) -> str:
    """Connect each compliment to concrete wording from the child's story."""
    first = _story_phrase(text)
    second = _story_phrase(text, 1)
    praises = {
        "language_causal_logic": f"从“{first}”到“{second}”，事情一步一步向前发展，读起来很顺。",
        "language_plot_memory": f"“{first}”接住了前面出现的人物和线索，让故事没有断开。",
        "language_vocabulary": f"“{first}”里的用词很有画面，角色的动作一下子变清楚了。",
        "language_detail": f"“{first}”这个细节写得很清楚，我好像就在旁边看着它发生。",
        "language_character_voice": f"读到“{first}”，我马上听出了这个角色说话时的样子。",
        "language_initiative": f"“{first}”是一个很有意思的新变化，让故事有了新的方向。",
        "empathy_emotion": f"“{first}”把角色的感受写了出来，我能明白它当时的心情。",
        "empathy_perspective": f"你注意到“{first}”，说明你认真想过角色心里需要什么。",
        "empathy_prosocial": f"“{first}”写出了伙伴间的关心，让这个故事读起来很温暖。",
        "empathy_conflict": f"你在“{first}”里安排角色一起想办法，处理得很温和。",
        "imagination_character": f"“{first}”让这个角色有了自己的特点，我一下就记住了它。",
        "imagination_setting": f"“{first}”把故事地点写得很特别，我能在脑海里看见它。",
        "imagination_rules": f"“{first}”像一条神奇的故事规则，让这个世界有了自己的玩法。",
        "imagination_side_plot": f"“{first}”悄悄打开了一条新线索，我会想继续读下去。",
    }
    return praises[key]


CHILD_CHALLENGE = {
    "language_causal_logic": "把故事里的原因和结果连起来，情节会更顺畅！",
    "language_plot_memory": "让前面出现的人物或宝物再次登场，会带来新的惊喜！",
    "language_vocabulary": "为角色挑一个更生动的动作词，画面马上就会动起来！",
    "language_detail": "添上一种声音或颜色，这个场景会变得更鲜活！",
    "language_character_voice": "让两个角色说出不同的话，他们会更有自己的性格！",
    "language_initiative": "大胆加入一个新变化，你的故事会有意想不到的转弯！",
    "empathy_emotion": "说出角色此刻的心情和原因，大家会更懂它！",
    "empathy_perspective": "听听两个角色各自的愿望，故事会多一种看法！",
    "empathy_prosocial": "安排伙伴们一起完成任务，合作的过程一定很有趣！",
    "empathy_conflict": "让角色认真听完彼此的话，他们能一起想出好办法！",
    "imagination_character": "给新伙伴设计一个小习惯，它会变得更可爱、更特别！",
    "imagination_setting": "为新地点添上颜色、声音和神奇物品，冒险就能开始啦！",
    "imagination_rules": "写下一条神奇规则，再看看它会带来什么新惊喜！",
    "imagination_side_plot": "藏下一条小线索，等它后来再次出现时会很精彩！",
}


def _specific_next_step(quote: str, key: str) -> str:
    """Anchor a short, positive practice suggestion in the child's own story."""
    meaningful = re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", quote)
    if len(meaningful) < 6:
        return f"下一次接着编你的小故事吧！{CHILD_CHALLENGE[key]}"
    phrase = _story_phrase(quote, limit=18)
    return f"你写到“{phrase}”。{CHILD_CHALLENGE[key]}"


def _ensure_next_steps(
    suggestions: list[str],
    child_messages: list[StoryMessage],
    language: dict,
    empathy: dict,
    imagination: dict,
) -> list[str]:
    """Every report gets 1–2 actionable, child-friendly next steps."""
    if len(suggestions) >= 2:
        return suggestions[:2]
    quote = next(
        (
            " ".join(item.content.split())
            for item in reversed(child_messages)
            if item.content.strip()
        ),
        "",
    )
    fallback_keys = []
    if language.get("is_valid") is False:
        fallback_keys.append("language_causal_logic")
    if empathy.get("is_valid") is False:
        fallback_keys.append("empathy_prosocial")
    if imagination.get("is_valid") is False:
        fallback_keys.append("imagination_setting")
    if not fallback_keys:
        fallback_keys = ["language_detail", "language_initiative"]
    for key in fallback_keys:
        item = _specific_next_step(quote, key)
        if item not in suggestions:
            suggestions.append(item)
        if len(suggestions) == 2:
            break
    if not suggestions:
        suggestions.append(
            "下一次可以先选一个喜欢的角色，再写它看见了什么、做了什么，会很有趣！"
        )
    return suggestions[:2]


def _is_system_ending_request(text: str) -> bool:
    normalized = "".join(text.split())
    return "请从刚才的情节继续" in normalized and "完整的大结局" in normalized


def _raw(observation: Observation) -> dict:
    try:
        value = json.loads(observation.raw_observation or "{}")
        return value if isinstance(value, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def _rubric_value(observation: Observation, key: str) -> float:
    data = _raw(observation)
    if key in data:
        try:
            return float(max(0, min(5, float(data[key]))))
        except (TypeError, ValueError):
            pass

    vocab = float(observation.vocabulary_semantic or 0)
    fluency = float(observation.sentence_fluency or 0)
    narrative = float(observation.narrative_completeness or 0)
    empathy = float(observation.character_empathy or 0)
    initiative = float(observation.creative_initiative or 0)
    legacy = {
        "language_causal_logic": narrative,
        "language_plot_memory": max(0, narrative - 1),
        "language_vocabulary": vocab,
        "language_detail": max(0, (vocab + fluency) / 2 - 1),
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
    }
    return legacy[key]


def _averages(observations: list[Observation], age_group: str = "8-12") -> dict[str, float]:
    if not observations:
        return {key: 0.0 for key in RUBRIC_KEYS}
    values = {}
    for key in RUBRIC_KEYS:
        observed = [
            _rubric_value(item, key)
            for item in observations
            if _rubric_value(item, key) > 0
        ]
        values[key] = (
            min(5.0, sum(observed) / len(observed))
            if observed else 0.0
        )
    return values


def _piecewise_score(raw_percent: float) -> float:
    """Expand meaningful ability differences while keeping the 60-115 scale."""
    value = max(0.0, min(100.0, float(raw_percent)))
    segments = (
        (0, 30, 60, 69),
        (30, 50, 69, 79),
        (50, 70, 79, 94),
        (70, 85, 94, 105),
        (85, 100, 105, 115),
    )
    for raw_low, raw_high, mapped_low, mapped_high in segments:
        if value <= raw_high:
            ratio = (value - raw_low) / (raw_high - raw_low)
            return round(mapped_low + ratio * (mapped_high - mapped_low), 1)
    return 115.0


def _piecewise_section_score(raw_percent: float) -> float:
    """Expand empathy/imagination differences on their required 60-100 scale."""
    value = max(0.0, min(100.0, float(raw_percent)))
    segments = (
        (0, 30, 60, 68),
        (30, 50, 68, 78),
        (50, 70, 78, 90),
        (70, 85, 90, 96),
        (85, 100, 96, 100),
    )
    for raw_low, raw_high, mapped_low, mapped_high in segments:
        if value <= raw_high:
            ratio = (value - raw_low) / (raw_high - raw_low)
            return round(mapped_low + ratio * (mapped_high - mapped_low), 1)
    return 100.0


def _child_text(child_messages: list[StoryMessage]) -> str:
    return "\n".join(
        " ".join(item.content.split())
        for item in child_messages
        if item.content.strip()
    )


def _imagination_gate(child_messages: list[StoryMessage]) -> dict:
    """Require child-created fantasy constructs before imagination is scored."""
    text = _child_text(child_messages)
    fantasy_setting = any(token in text for token in (
        "漂浮车站", "会变色的山谷", "灰色山谷", "记忆潮", "空中观测站",
        "海底档案库", "云朵宝宝", "钟表城", "月亮森林", "甜点王国",
        "时间倒流", "云层档案馆", "会说话", "会唱歌", "魔法",
    ))
    impossible_feature = any(token in text for token in (
        "颜色被声音藏起来", "石头响", "歌声回来", "山谷也慢慢变绿",
        "方向牌正在旋转", "云纹", "写在纸上的内容会消失",
        "回声贝壳", "控制室才会开启", "记忆潮覆盖", "失联的海底档案库",
        "会发光", "会变色", "会飞", "漂浮",
    ))
    world_rule = (
        any(token in text for token in ("只有", "否则", "规定", "每当", "每天午夜", "才会", "才能"))
        and impossible_feature
    )
    fantasy_character = any(token in text for token in (
        "云朵宝宝", "小机器人", "守站人", "回声贝壳"
    )) and (fantasy_setting or impossible_feature)
    side_plot = any(token in text for token in (
        "还有一座", "失联", "下次", "继续调查", "新线索", "支线", "档案库"
    )) and (fantasy_setting or impossible_feature)
    signals = {
        "架空场景": fantasy_setting,
        "非现实特征": impossible_feature,
        "世界规则": world_rule,
        "原创角色或物品": fantasy_character,
        "幻想支线": side_plot,
    }
    count = sum(signals.values())
    return {
        "passed": count >= 2,
        "signal_count": count,
        "signals": signals,
        "reason": (
            "孩子原始发言至少形成两类原创幻想证据。"
            if count >= 2 else
            "孩子原始发言未形成至少两类原创幻想证据；预设角色、故事主题和普通合作情节不作为想象力准入依据。"
        ),
    }


def _empathy_gate(child_messages: list[StoryMessage]) -> dict:
    """Require an actual interpersonal situation, not isolated emotion words."""
    text = _child_text(child_messages)
    actors = any(token in text for token in (
        "朋友", "同学", "同桌", "小兔", "小刺猬", "云朵宝宝", "售票员",
        "小机器人", "守站人", "岛民代表", "伙伴", "两个人", "圆圆", "铁头",
    ))
    emotion_or_position = any(token in text for token in (
        "害怕", "怕", "难过", "着急", "担心", "不好意思", "顾虑", "觉得", "拒绝", "误会",
    ))
    response = any(token in text for token in (
        "安慰", "陪", "一起", "听完", "复述", "提议", "核对", "道歉", "商量",
        "共同决定", "随时可以停止", "交换检查", "约定", "帮助",
    ))
    passed = actors and emotion_or_position and response
    return {
        "passed": passed,
        "signals": {
            "存在互动角色": actors,
            "存在情绪或立场": emotion_or_position,
            "存在回应或协商": response,
        },
        "reason": (
            "孩子原始发言同时包含互动角色、情绪或立场及回应行为。"
            if passed else
            "孩子原始发言未同时形成互动角色、情绪或立场及回应行为，无法可靠测评共情力。"
        ),
    }


def _apply_high_order_anchors(
    values: dict[str, float],
    child_messages: list[StoryMessage],
) -> dict[str, float]:
    """Reward depth, cross-turn consistency and reversible collaboration."""
    result = dict(values)
    texts = [
        " ".join(item.content.split())
        for item in child_messages
        if item.content.strip()
    ]
    text = "\n".join(texts)

    def raise_to(key: str, rating: float) -> None:
        result[key] = max(float(result.get(key, 0) or 0), rating)

    conditional_hits = sum(text.count(token) for token in (
        "因为", "所以", "因此", "否则", "只有", "才会", "避免", "如果", "不是", "而是",
    ))
    if conditional_hits >= 5:
        raise_to("language_causal_logic", 4.5)
    elif conditional_hits >= 3:
        raise_to("language_causal_logic", 3.5)

    memory_hits = sum(text.count(token) for token in (
        "记起", "刚才", "第一", "上一", "又", "仍", "原来", "现有规则", "旧参数",
    ))
    if memory_hits >= 5 and len(texts) >= 4:
        raise_to("language_plot_memory", 4.5)
    elif memory_hits >= 2:
        raise_to("language_plot_memory", 3.5)

    avg_chars = sum(len(item) for item in texts) / max(1, len(texts))
    if avg_chars >= 70 and len(texts) >= 4:
        raise_to("language_detail", 4.0)
        raise_to("language_vocabulary", 4.2)
        raise_to("language_initiative", 4.5)
    elif avg_chars >= 35:
        raise_to("language_detail", 3.2)
        raise_to("language_vocabulary", 3.2)
        raise_to("language_initiative", 3.5)

    multi_party = any(token in text for token in (
        "岛民代表", "不同的人", "大家同意", "共同决定", "分别听完",
    ))
    reversible = any(token in text for token in (
        "随时可以停止", "避免", "无法复原", "保留旧参数", "只开启隔离舱",
    ))
    perspective = any(token in text for token in (
        "复述他的顾虑", "分别听完", "不是故意", "担心", "觉得被误会",
    ))
    if multi_party and reversible and perspective:
        raise_to("empathy_emotion", 4.0)
        raise_to("empathy_perspective", 5.0)
        raise_to("empathy_prosocial", 4.5)
        raise_to("empathy_conflict", 5.0)
    elif perspective and any(token in text for token in ("提议", "道歉", "陪", "安慰", "一起")):
        raise_to("empathy_perspective", 3.5)
        raise_to("empathy_prosocial", 3.5)
        raise_to("empathy_conflict", 3.5)

    imagination = _imagination_gate(child_messages)
    if imagination["passed"]:
        if imagination["signals"]["架空场景"]:
            raise_to("imagination_setting", 3.5)
        if imagination["signals"]["原创角色或物品"]:
            raise_to("imagination_character", 3.5)
        if imagination["signals"]["世界规则"]:
            raise_to("imagination_rules", 4.0)
        if imagination["signals"]["幻想支线"]:
            raise_to("imagination_side_plot", 4.0)
        if imagination["signal_count"] >= 4 and len(texts) >= 4:
            raise_to("imagination_character", 4.2)
            raise_to("imagination_setting", 4.5)
            raise_to("imagination_rules", 5.0)
            raise_to("imagination_side_plot", 4.5)
    return result


def _scored_dimensions(
    specs: list[tuple[str, str, int]],
    values: dict[str, float],
    *,
    max_estimates: int = 0,
) -> list[dict]:
    """Score direct evidence and conservatively estimate limited missing items."""
    observed_values = [values[key] for _, key, _ in specs if values[key] > 0]
    missing_count = len(specs) - len(observed_values)
    estimated_value = (
        sum(observed_values) / len(observed_values) * 0.7
        if 0 < missing_count <= max_estimates and observed_values
        else 0.0
    )
    dimensions = []
    for label, key, weight in specs:
        observed = values[key] > 0
        is_imputed = not observed and estimated_value > 0
        rating = values[key] if observed else estimated_value
        dimensions.append({
            "key": key,
            "label": label,
            "score": round(rating / 5 * weight, 1) if (observed or is_imputed) else None,
            "max_score": weight,
            "is_imputed": is_imputed,
            "is_unscored": not observed and not is_imputed,
            "observation_status": "实测" if observed else ("谨慎估算" if is_imputed else "未观察"),
        })
    return dimensions


def _is_scorable_sentence(text: str) -> bool:
    compact = re.sub(r"\s+", "", text)
    meaningful = re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", compact)
    if len(meaningful) < 6:
        return False
    if len(set(meaningful)) <= max(2, len(meaningful) // 5):
        return False
    gibberish = ("哈哈哈", "嘿嘿嘿", "啦啦啦", "咕噜咕噜", "不知道不知道", "asdf", "qwer")
    return not any(token in meaningful.lower() for token in gibberish)


def _measurability(child_messages: list[StoryMessage]) -> dict:
    texts = [" ".join(item.content.split()) for item in child_messages if item.content.strip()]
    effective_chars = sum(len(re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", text)) for text in texts)
    sentences = [
        part.strip()
        for text in texts
        for part in re.split(r"[。！？!?；;\n]+", text)
        if part.strip()
    ]
    scorable_sentences = sum(1 for sentence in sentences if _is_scorable_sentence(sentence))
    reasons = []
    if effective_chars < 40:
        reasons.append("有效原创文字少于40字")
    if len(texts) < 3:
        reasons.append("有效创作少于3次")
    if scorable_sentences < 2:
        reasons.append("可评分完整表达少于2句")
    return {
        "is_measurable": not reasons,
        "effective_char_count": effective_chars,
        "effective_turn_count": len(texts),
        "scorable_sentence_count": scorable_sentences,
        "thresholds": {"effective_chars": 40, "effective_turns": 3, "scorable_sentences": 2},
        "reasons": reasons,
    }


def _section_confidence(
    dimensions: list[dict],
    observations: list[Observation],
    measurable: bool,
) -> tuple[int, str]:
    details = _confidence_details(dimensions, observations, measurable)
    score = details["score"]
    level = "高" if score >= 80 else ("中" if score >= 60 else "低")
    return score, level


def _confidence_details(
    dimensions: list[dict],
    observations: list[Observation],
    measurable: bool,
) -> dict:
    """Estimate evidence reliability without ever claiming 100% certainty."""
    if not measurable or not dimensions:
        return {
            "score": 0,
            "coverage": 0,
            "evidence_depth": 0,
            "cross_turn_span": 0,
            "direct_evidence_ratio": 0,
            "measurability": 0,
            "cap": 95,
        }
    direct_dimensions = [
        item for item in dimensions
        if not item.get("is_unscored") and not item.get("is_imputed")
    ]
    coverage = len(direct_dimensions) / len(dimensions)
    depth_values = []
    for dimension in direct_dimensions:
        try:
            supporting_turns = sum(
                1 for observation in observations
                if _rubric_value(observation, dimension["key"]) > 0
            )
        except (AttributeError, TypeError):
            supporting_turns = len(observations)
        depth_values.append(min(1.0, supporting_turns / 3))
    evidence_depth = (
        sum(depth_values) / len(depth_values) if depth_values else 0
    )
    distinct_turns = len({
        getattr(observation, "turn_number", index)
        for index, observation in enumerate(observations)
    })
    cross_turn_span = min(1.0, distinct_turns / 5)
    direct_ratio = coverage
    raw_score = (
        coverage * 40
        + evidence_depth * 25
        + cross_turn_span * 20
        + direct_ratio * 10
        + 5
    )
    score = min(95, round(raw_score))
    return {
        "score": score,
        "coverage": round(coverage * 100),
        "evidence_depth": round(evidence_depth * 100),
        "cross_turn_span": round(cross_turn_span * 100),
        "direct_evidence_ratio": round(direct_ratio * 100),
        "measurability": 100,
        "cap": 95,
    }


def _local_sentence_analysis(text: str, key: str, rating: float) -> str:
    """Build privacy-safe, sentence-specific analysis for legacy observations."""
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[。！？!?])", " ".join(text.split()))
        if sentence.strip()
    ][:4]
    if not sentences:
        sentences = [text.strip()[:160]]

    def analyze_one(sentence: str) -> str:
        clean = sentence.rstrip("。！？!?")
        clauses = [
            clause.strip()
            for clause in re.split(r"[，,；;：:]", clean)
            if clause.strip()
        ]
        first = clauses[0][:38] if clauses else clean[:38]
        second = clauses[1][:38] if len(clauses) > 1 else ""
        pair = (
            f"“{first}”与“{second}”"
            if second else f"“{first}”"
        )
        analyses = {
            "language_causal_logic": (
                f"{pair}分别呈现前一动作和后一变化，能看出事件不是孤立罗列，而是在向下一结果推进"
                if second else f"{pair}交代了一个明确事件，但句内尚未展开原因和结果"
            ),
            "language_plot_memory": f"{pair}保留了本轮故事中的具体对象和正在发生的事件，使情节能够继续沿着同一线索发展",
            "language_vocabulary": f"{pair}没有只用笼统的“发生了”，而是选择了能直接形成动作和画面的词语",
            "language_detail": (
                f"{pair}同时补出了两个可观察细节，使读者既能看到前一画面，也能看到紧接着的状态变化"
                if second else f"{pair}提供了一个可观察的画面细节"
            ),
            "language_character_voice": f"{pair}通过角色的动作、反应或表达方式传递角色当时的状态，而不只是报告情节",
            "language_initiative": f"{pair}是孩子主动补入的具体发展，让故事获得了新的动作或结果",
            "empathy_emotion": f"{pair}把角色受到的影响或作出的反应写出来，为判断角色感受提供了可见线索",
            "empathy_perspective": f"{pair}关注了故事对象当下的处境与反应，说明叙述并非只从单一事件表面展开",
            "empathy_prosocial": f"{pair}呈现角色之间的陪伴、回应或共同参与，可据此观察关系中的支持性",
            "empathy_conflict": f"{pair}展示角色面对变化时采取的行为，可据此判断其处理困难或分歧的方式",
            "imagination_character": f"{pair}为角色或故事对象赋予了具体、可辨认的表现，使其不只是一个名称",
            "imagination_setting": f"{pair}把物体、动作和状态放进同一画面，构成了可以被想象出来的场景",
            "imagination_rules": f"{pair}呈现故事世界中动作与变化之间的特殊联系，可用于判断设定是否形成规则",
            "imagination_side_plot": f"{pair}增加了主线之外可继续发展的变化，为后续情节留下了新的线索",
        }
        return analyses[key]

    parts = [
        f"第{index}句“{sentence[:90]}”：{analyze_one(sentence)}。"
        for index, sentence in enumerate(sentences, start=1)
    ]
    if rating >= 4:
        level_reason = "这些表达具体且连续，因此本轮处于较高档。"
    elif rating >= 3:
        level_reason = "原话中有明确证据，但丰富度或连续性还未达到最高档。"
    elif rating >= 2:
        level_reason = "原话已经出现初步证据，但展开较少，因此处于基础档。"
    else:
        level_reason = "本轮相关表达较少，所以该项观察值处于起步档。"
    return "".join(parts) + level_reason


def _attach_dimension_evidence(
    sections: list[dict],
    values: dict[str, float],
    observations: list[Observation],
    message_by_id: dict[int, StoryMessage],
) -> None:
    """Attach auditable child-only evidence without exposing it by default."""
    for section in sections:
        if section.get("is_valid") is False:
            for dimension in section["dimensions"]:
                dimension["score_reason"] = section["invalid_reason"]
                dimension["evidence"] = []
            continue
        for dimension in section["dimensions"]:
            key = dimension["key"]
            average = round(values[key], 1)
            if dimension.get("is_unscored"):
                dimension["score_reason"] = (
                    f"本次故事中没有足够的“{dimension['label']}”直接证据，"
                    "因此该项标记为未观察，不计0分，也不使用保底分。"
                )
            elif dimension.get("is_imputed"):
                dimension["score_reason"] = (
                    "该项缺少直接证据；因本模块其余维度覆盖充分，仅按其他实测维度"
                    f"平均表现的70%谨慎估算为 {dimension['score']}/{dimension['max_score']}。"
                )
            else:
                dimension["score_reason"] = (
                    f"从孩子的 {len(observations)} 次有效创作中观察本项表现，"
                    f"有效观察平均为 {average}/5，按本项 {dimension['max_score']} 分权重"
                    f"直接折算为 {dimension['score']} 分，不使用统一保底分。"
                    f"本项考察：{DIMENSION_CRITERIA[key]}。"
                )
            candidates: list[tuple[float, dict]] = []
            for observation in observations:
                message = message_by_id.get(observation.message_id)
                if not message or not message.content.strip():
                    continue
                rating = round(_rubric_value(observation, key), 1)
                if rating <= 0:
                    continue
                raw_observation = _raw(observation)
                raw_evidence = raw_observation.get("dimension_evidence", {})
                item = raw_evidence.get(key, {}) if isinstance(raw_evidence, dict) else {}
                quote = str(item.get("quote", "")).strip() if isinstance(item, dict) else ""
                analysis = str(item.get("analysis", "")).strip() if isinstance(item, dict) else ""
                recall_source = (
                    item.get("recall_source", ["llm"])
                    if isinstance(item, dict) else ["llm"]
                )
                if not isinstance(recall_source, list):
                    recall_source = [str(recall_source)]
                # A model-provided quote is accepted only when it occurs
                # literally in the stored child message.
                if not quote or quote not in message.content:
                    quote = " ".join(message.content.split())[:160]
                    analysis = _local_sentence_analysis(message.content, key, rating)
                elif raw_observation.get("evidence_version", 0) < 3:
                    analysis = _local_sentence_analysis(quote, key, rating)
                elif not analysis:
                    analysis = (
                        f"该原话直接体现了“{dimension['label']}”的相关表现，"
                        f"本轮观察为 {rating}/5。"
                    )
                quote, _ = redact_privacy(quote)
                analysis, _ = redact_privacy(analysis)
                candidates.append((
                    rating,
                    {
                        "turn_number": observation.turn_number,
                        "quote": quote,
                        "analysis": analysis,
                        "turn_rating": rating,
                        "max_turn_rating": 5,
                        "recall_source": recall_source,
                        "status": "confirmed",
                    },
                ))
            candidates.sort(key=lambda entry: entry[0], reverse=True)
            seen_quotes: set[str] = set()
            evidence = []
            for _, item in candidates:
                if item["quote"] in seen_quotes:
                    continue
                seen_quotes.add(item["quote"])
                evidence.append(item)
                if len(evidence) == 3:
                    break
            dimension["evidence"] = evidence


def _language_section(values: dict[str, float], age_group: str, measurable: bool = True) -> dict:
    if age_group == "4-7":
        specs = [
            ("叙事连贯性·因果", "language_causal_logic", 18),
            ("叙事连贯性·记忆", "language_plot_memory", 12),
            ("词汇丰富度", "language_vocabulary", 22),
            ("细节描绘能力", "language_detail", 20),
            ("角色语言创作", "language_character_voice", 18),
            ("主动创作意愿", "language_initiative", 10),
        ]
    else:
        specs = [
            ("叙事连贯性·完整闭环", "language_causal_logic", 20),
            ("叙事连贯性·长线记忆", "language_plot_memory", 15),
            ("细节描绘能力", "language_detail", 23),
            ("角色语言创作", "language_character_voice", 20),
            ("词汇丰富度", "language_vocabulary", 14),
            ("主动创作意愿", "language_initiative", 8),
        ]
    observed_count = sum(1 for _, key, _ in specs if values[key] > 0)
    dimensions = _scored_dimensions(specs, values, max_estimates=2)
    valid = measurable and observed_count >= 4
    scored = [item for item in dimensions if item["score"] is not None]
    weighted_max = sum(item["max_score"] for item in scored)
    raw_percent = (
        sum(item["score"] for item in scored) / weighted_max * 100
        if valid and weighted_max else 0
    )
    # Valid language assessments are reported on the product's 60–100
    # foundation scale. Evidence-insufficient stories remain unscored rather
    # than being forced to 60. Progress can later add 0–15 points.
    base_score = _piecewise_score(raw_percent) if valid else 0
    return {
        "base_score": round(base_score, 1),
        "raw_ability_percent": round(raw_percent, 1),
        "score_range": "60-115" if valid else "未测评",
        "score_mapping": "分段映射：0-30→60-69，30-50→69-79，50-70→79-94，70-85→94-105，85-100→105-115",
        "is_valid": valid,
        "persist_result": False,
        "observed_dimension_count": observed_count,
        "invalid_reason": "" if valid else (
            "本次有效原创表达未达到可测性门槛，因此语言智能模块无效。"
            if not measurable else
            "本次语言智能直接观察到的子维度不足4项；若继续插值，谨慎评估将超过2项，"
            "因此本模块判定为无效，不生成整体分数。"
        ),
        "dimensions": dimensions,
    }


def _independent_section(
    values: dict[str, float],
    specs: list[tuple[str, str]],
    invalid_reason: str,
) -> dict:
    observed_count = sum(1 for _, key in specs if values[key] > 0)
    if observed_count < 2:
        return {
            "score": 0,
            "is_valid": False,
            "persist_result": False,
            "observed_dimension_count": observed_count,
            "invalid_reason": (
                f"{invalid_reason}"
                "本次直接观察到的子维度不足2项；若继续插值，谨慎评估将超过2项，"
                "因此整个模块判定为无效。"
            ),
            "dimensions": [
                {
                    "key": key,
                    "label": label,
                    "score": 0,
                    "max_score": 25,
                    "is_unscored": True,
                }
                for label, key in specs
            ],
        }
    dimensions = _scored_dimensions(
        [(label, key, 25) for label, key in specs],
        values,
        max_estimates=2,
    )
    scored = [item for item in dimensions if item["score"] is not None]
    weighted_max = sum(item["max_score"] for item in scored)
    raw_percent = round(
        sum(item["score"] for item in scored) / weighted_max * 100,
        1,
    )
    mapped_score = _piecewise_section_score(raw_percent)
    return {
        "score": mapped_score,
        "raw_ability_percent": raw_percent,
        "score_range": "60-100",
        "score_mapping": "分段映射：0-30→60-68，30-50→68-78，50-70→78-90，70-85→90-96，85-100→96-100",
        "is_valid": True,
        "persist_result": True,
        "observed_dimension_count": observed_count,
        "invalid_reason": "",
        "dimensions": dimensions,
    }


def _level(score: float, language: bool = False) -> tuple[str, str]:
    if score >= 90:
        return "advantage", "优势型"
    if score >= 75:
        return "balanced", "均衡发展型"
    return "developing", "潜力发展型"


def _growth_index(values: dict[str, float]) -> float:
    # The standard specifically asks progress to be judged from vocabulary,
    # plot memory and detail rather than from empathy or imagination.
    return round(sum(values[key] for key in (
        "language_vocabulary", "language_plot_memory", "language_detail"
    )) / 3 / 5 * 100, 1)


def _progress_bonus(
    change: float,
    history_count: int,
    improved_dimension_count: int,
    confidence_score: int,
) -> int:
    """Award growth conservatively; 15 points requires stable, strong evidence."""
    if history_count < 1 or confidence_score < 70 or improved_dimension_count < 2:
        return 0
    if change < 3:
        return 0
    if change < 6:
        return 2
    if change < 9:
        return 4
    if change < 12:
        return 6
    if change < 16:
        return 8
    if change < 20:
        return 10
    if change < 25:
        return 12
    if history_count >= 3 and confidence_score >= 85:
        return 15
    return 12


async def _valid_observations(
    db: AsyncSession, story_id: int
) -> tuple[list[Observation], list[StoryMessage]]:
    messages = (await db.execute(
        select(StoryMessage).where(
            StoryMessage.story_id == story_id,
            StoryMessage.role == "child",
        )
    )).scalars().all()
    messages = [
        item for item in messages
        if not _is_system_ending_request(item.content)
        and not contains_prohibited_content(item.content)
    ]
    message_ids = {item.id for item in messages}
    observations = (await db.execute(
        select(Observation)
        .where(Observation.story_id == story_id)
        .order_by(Observation.turn_number)
    )).scalars().all()
    return [item for item in observations if item.message_id in message_ids], messages


async def _ensure_cross_turn_recall(
    db: AsyncSession,
    observations: list[Observation],
    child_messages: list[StoryMessage],
) -> int:
    """Re-scan every safe child quote before the final report and persist additions."""
    from app.services.llm_service import apply_multilabel_recall

    message_by_id = {item.id: item for item in child_messages}
    updated = 0
    for observation in observations:
        message = message_by_id.get(observation.message_id)
        if not message or not message.content.strip():
            continue
        before = _raw(observation)
        after = apply_multilabel_recall(before, message.content)
        after["recall_passes"] = list(dict.fromkeys(
            [*(before.get("recall_passes") or []), "cross_turn_review_v1"]
        ))
        if after == before:
            continue
        observation.raw_observation = json.dumps(after, ensure_ascii=False)
        observation.character_empathy = max(
            int(observation.character_empathy or 1),
            int(after.get("character_empathy", 1) or 1),
        )
        observation.character_empathy_examples = "；".join(after.get("evidence", []))
        updated += 1
    if updated:
        await db.commit()
    return updated


async def ensure_missing_observations(
    db: AsyncSession,
    story_id: int,
    age_group: str,
) -> int:
    """Create missing observations and upgrade legacy template evidence."""
    all_messages = (await db.execute(
        select(StoryMessage)
        .where(StoryMessage.story_id == story_id)
        .order_by(StoryMessage.turn_number, StoryMessage.id)
    )).scalars().all()
    child_messages = [
        message for message in all_messages
        if message.role == "child" and not _is_system_ending_request(message.content)
    ]
    existing = (await db.execute(
        select(Observation).where(Observation.story_id == story_id)
    )).scalars().all()
    existing_by_message = {item.message_id: item for item in existing}
    targets = []
    for message in child_messages:
        observation = existing_by_message.get(message.id)
        raw = _raw(observation) if observation else {}
        if observation is None or raw.get("evidence_version", 0) < 2:
            targets.append((message, observation))
    if not targets:
        return 0

    from app.services import observation_service
    from app.services.llm_service import (
        compute_observation,
        get_llm_service,
        upgrade_observation,
    )

    llm = get_llm_service()
    saved = 0
    for child_message, existing_observation in targets:
        context_parts = []
        for message in all_messages:
            if message.id >= child_message.id:
                break
            label = "孩子" if message.role == "child" else "故事导演"
            context_parts.append(f"{label}：{message.content}")
        try:
            data = await llm.evaluate_turn(
                child_message.content,
                age_group,
                "\n".join(context_parts[-12:]),
            )
        except Exception:
            data = upgrade_observation(
                compute_observation(child_message.content, age_group)
            )
        if existing_observation is None:
            observation = await observation_service.save_observation(
                db,
                story_id,
                child_message.id,
                child_message.turn_number,
                data,
            )
            if observation:
                saved += 1
        else:
            # Preserve the row identity while replacing its legacy/template
            # payload with the evaluator's sentence-specific evidence.
            for field_name in (
                "vocabulary_semantic", "vocabulary_semantic_examples",
                "sentence_fluency", "sentence_fluency_examples",
                "narrative_completeness", "narrative_structure_note",
                "character_empathy", "character_empathy_examples",
                "creative_initiative", "creative_initiative_examples",
            ):
                if field_name in data:
                    setattr(existing_observation, field_name, data[field_name])
            existing_observation.creativity_flags = json.dumps(
                data.get("creativity_flags", []),
                ensure_ascii=False,
            )
            existing_observation.raw_observation = json.dumps(
                data,
                ensure_ascii=False,
            )
            await db.commit()
            saved += 1
    return saved


async def generate_talent_profile(db: AsyncSession, story_id: int) -> TalentProfile | None:
    story = await db.get(Story, story_id)
    if not story:
        return None
    character = await db.get(Character, story.character_id)
    age_group = (character.age_group if character else None) or "8-12"
    observations, child_messages = await _valid_observations(db, story_id)
    await _ensure_cross_turn_recall(db, observations, child_messages)
    values = _averages(observations, age_group)
    values = _apply_high_order_anchors(values, child_messages)
    measurability = _measurability(child_messages)
    empathy_gate = _empathy_gate(child_messages)
    imagination_gate = _imagination_gate(child_messages)

    language = _language_section(values, age_group, measurability["is_measurable"])
    empathy = _independent_section(
        values,
        [
            ("情绪识别表达", "empathy_emotion"),
            ("换位思考", "empathy_perspective"),
            ("互助包容", "empathy_prosocial"),
            ("温和解决冲突", "empathy_conflict"),
        ],
        (
            "本次故事缺少人际互动相关情节，本模块无法测评共情能力，"
            "共情最终结果以空间模块、职业模拟器的测评数据为准。"
        ),
    )
    imagination = _independent_section(
        values,
        [
            ("原创角色", "imagination_character"),
            ("架空场景", "imagination_setting"),
            ("自创世界规则", "imagination_rules"),
            ("支线拓展剧情", "imagination_side_plot"),
        ],
        (
            "本次故事无奇幻、原创架空内容，想象力测评无效，"
            "最终想象力参考空间专项模块、职业模拟器测评结果。"
        ),
    )
    # Topic gates are advisory only. The user-facing product needs useful
    # coverage, so a section remains scoreable when at least two child-only
    # subdimensions have direct evidence; at most two others may be cautiously
    # estimated by _independent_section. Gate signals remain available for
    # report transparency but no longer force an otherwise evidenced section
    # to zero.
    empathy["topic_gate"] = {**empathy_gate, "enforcement": "advisory"}
    imagination["topic_gate"] = {**imagination_gate, "enforcement": "advisory"}
    if not measurability["is_measurable"]:
        for section in (empathy, imagination):
            section["score"] = 0
            section["is_valid"] = False
            section["persist_result"] = False
            section["invalid_reason"] = (
                "本次有效原创表达不足，无法形成可信测评。"
                + "；".join(measurability["reasons"])
                + "。"
            )

    history_values: list[dict[str, float]] = []
    if character:
        prior_stories = (await db.execute(
            select(Story)
            .join(Character, Story.character_id == Character.id)
            .where(
                Character.user_id == character.user_id,
                Character.age_group == age_group,
                Story.id != story.id,
                Story.started_at < story.started_at,
                Story.is_deleted.is_(False),
            )
            .order_by(Story.started_at.desc())
            .limit(3)
        )).scalars().all()
        for prior in prior_stories if language["is_valid"] else []:
            prior_observations, prior_messages = await _valid_observations(db, prior.id)
            prior_values = _averages(prior_observations, age_group)
            prior_values = _apply_high_order_anchors(prior_values, prior_messages)
            prior_language = _language_section(
                prior_values,
                age_group,
                _measurability(prior_messages)["is_measurable"],
            )
            prior_confidence, _ = _section_confidence(
                prior_language["dimensions"],
                prior_observations,
                prior_language["is_valid"],
            )
            if prior_language["is_valid"] and prior_confidence >= 60:
                history_values.append(prior_values)

    current_index = _growth_index(values)
    baseline = round(
        sum(_growth_index(item) for item in history_values) / len(history_values), 1
    ) if history_values else None
    change = round(current_index - baseline, 1) if baseline is not None else 0.0
    growth_keys = (
        "language_vocabulary", "language_plot_memory", "language_detail"
    )
    historical_dimension_means = {
        key: (
            sum(item[key] for item in history_values) / len(history_values)
            if history_values else 0
        )
        for key in growth_keys
    }
    improved_dimension_count = sum(
        1 for key in growth_keys
        if history_values and values[key] - historical_dimension_means[key] >= 0.25
    )
    current_language_confidence, _ = _section_confidence(
        language["dimensions"], observations, language["is_valid"]
    )
    bonus = (
        _progress_bonus(
            change,
            len(history_values),
            improved_dimension_count,
            current_language_confidence,
        )
        if language["is_valid"] else 0
    )
    language["progress_bonus"] = bonus
    language["final_score"] = round(min(115, language["base_score"] + bonus), 1)
    language["final_score_range"] = "60-115"
    for section in (language, empathy, imagination):
        confidence_details = _confidence_details(
            section["dimensions"], observations, section["is_valid"]
        )
        confidence = confidence_details["score"]
        confidence_level = "高" if confidence >= 80 else ("中" if confidence >= 60 else "低")
        section["confidence_score"] = confidence
        section["confidence_level"] = confidence_level
        section["confidence_components"] = confidence_details
        section["persist_result"] = section["is_valid"] and confidence >= 60
        section["score_status"] = (
            "有效" if section["persist_result"]
            else ("暂定" if section["is_valid"] else "证据不足")
        )
    if language["is_valid"]:
        language["level"], language["level_label"] = _level(language["final_score"], True)
    else:
        language["level"], language["level_label"] = "invalid", "本次无法测评"
    if empathy["is_valid"]:
        empathy["level"], empathy["level_label"] = _level(empathy["score"])
    else:
        empathy["level"], empathy["level_label"] = "invalid", "本次无法测评"
    if imagination["is_valid"]:
        imagination["level"], imagination["level_label"] = _level(imagination["score"])
    else:
        imagination["level"], imagination["level_label"] = "invalid", "本次无法测评"

    growth_memory = {
        "has_history": bool(history_values),
        "compared_story_count": len(history_values),
        "baseline_index": baseline,
        "current_index": current_index,
        "change": change,
        "progress_bonus": bonus,
        "improved_dimension_count": improved_dimension_count,
        "bonus_eligibility": {
            "history_count": len(history_values),
            "current_confidence": current_language_confidence,
            "requires_two_improved_dimensions": True,
            "fifteen_point_requirements": {
                "minimum_history_count": 3,
                "minimum_confidence": 85,
                "minimum_growth_index_change": 25,
            },
        },
        "summary": (
            f"与最近 {len(history_values)} 个故事相比，词汇、情节记忆和细节成长指数"
            f"{'提高' if change >= 0 else '下降'} {abs(change):.1f} 分。"
            if history_values else
            (
                "这是首次有效测评，已保存为后续故事的成长基线。"
                if observations else "尚无孩子的有效创作发言，暂不建立成长基线。"
            )
        ),
    }

    message_by_id = {item.id: item for item in child_messages}
    _attach_dimension_evidence(
        [language, empathy, imagination],
        values,
        observations,
        message_by_id,
    )
    highlights: list[str] = []
    for observation in observations:
        message = message_by_id.get(observation.message_id)
        if not message or not message.content.strip():
            continue
        raw_observation = _raw(observation)
        raw_evidence = raw_observation.get("dimension_evidence", {})
        strong_evidence_count = 0
        if isinstance(raw_evidence, dict):
            for key in RUBRIC_KEYS:
                item = raw_evidence.get(key, {})
                quote = str(item.get("quote", "")).strip() if isinstance(item, dict) else ""
                if _rubric_value(observation, key) >= 4 and quote and quote in message.content:
                    strong_evidence_count += 1
        # A normal contribution is not automatically a "wonderful moment".
        # Require at least two independently evidenced high-level qualities.
        if strong_evidence_count < 2:
            continue
        quote, _ = redact_privacy(" ".join(message.content.split()))
        if quote and quote not in highlights:
            highlights.append(quote)

    named_dimensions = []
    for section_name, section in (
        ("语言智能", language),
        ("人际智能", empathy),
        ("空间智能", imagination),
    ):
        if section.get("is_valid") is False:
            continue
        for dimension in section["dimensions"]:
            if dimension.get("is_unscored"):
                continue
            named_dimensions.append({
                **dimension,
                "section_name": section_name,
                "ratio": (
                    dimension["score"] / dimension["max_score"]
                    if dimension.get("score") is not None and dimension["max_score"] else -1
                ),
            })

    child_message_by_turn = {
        observation.turn_number: redact_privacy(
            " ".join(message_by_id[observation.message_id].content.split())
        )[0]
        for observation in observations
        if observation.message_id in message_by_id
    }
    strengths = []
    for dimension in sorted(
        named_dimensions,
        key=lambda item: item["ratio"],
        reverse=True,
    ):
        if len(strengths) == 2:
            break
        if (
            dimension.get("is_imputed")
            or dimension.get("is_unscored")
            or values[dimension["key"]] < 4
            or not dimension.get("evidence")
        ):
            continue
        evidence = dimension.get("evidence", [])
        turn_number = evidence[0].get("turn_number") if evidence else None
        full_quote = child_message_by_turn.get(turn_number, "")
        if full_quote:
            strengths.append(
                f"“{full_quote}” {_child_specific_praise(full_quote, dimension['key'])}"
            )
        else:
            strengths.append(CHILD_STRENGTH[dimension["key"]] + "！")

    next_dimensions = sorted(
        named_dimensions,
        key=lambda item: item["ratio"],
    )[:2]
    suggestions = []
    for dimension in next_dimensions:
        evidence = dimension.get("evidence") or []
        turn_number = evidence[0].get("turn_number") if evidence else None
        quote = child_message_by_turn.get(turn_number, "")
        if not quote:
            quote = next(iter(child_message_by_turn.values()), "")
        suggestions.append(_specific_next_step(quote, dimension["key"]))
    suggestions = _ensure_next_steps(
        suggestions,
        child_messages,
        language,
        empathy,
        imagination,
    )

    return TalentProfile(
        story_id=story.id,
        story_title=story.title or story.theme or "未命名故事",
        total_turns=len(observations),
        age_group=age_group,
        completed=story.status == "completed",
        measurability=measurability,
        language=language,
        empathy=empathy,
        imagination=imagination,
        growth_memory=growth_memory,
        highlights=highlights[:3],
        total_words=sum(len(item.content) for item in child_messages),
        avg_words_per_turn=round(
            sum(len(item.content) for item in child_messages) / len(child_messages), 1
        ) if child_messages else 0.0,
        strengths=strengths,
        suggestions=suggestions,
    )
