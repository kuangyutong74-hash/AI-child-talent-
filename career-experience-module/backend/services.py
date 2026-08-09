"""
AI Service — Two layers: Mentor (follow-up) + Observer (narrative).
Scoring is anchored in career_data indicators; AI adjusts and narrates.
"""
import json, re
from typing import Optional
from datetime import datetime, timezone
import httpx
from config import *

MULTIPLE_INTELLIGENCES = {
    "linguistic":"语言智能","logical_mathematical":"逻辑数学智能","spatial":"空间智能",
    "bodily_kinesthetic":"身体运动智能","musical":"音乐智能","interpersonal":"人际智能",
    "intrapersonal":"内省智能","naturalistic":"自然观察智能"
}
COMPREHENSIVE_LITERACY = {
    "creativity":"创造力","critical_thinking":"批判性思维","communication":"沟通能力",
    "collaboration":"协作能力","empathy":"同理心","problem_solving":"问题解决能力",
    "decision_making":"决策力","emotional_management":"情绪管理能力"
}
ALL_DIMS = {**MULTIPLE_INTELLIGENCES, **COMPREHENSIVE_LITERACY}

# 年龄不是能力高低的权重，也不用于学生之间比较；它只校准“同一行为证据应如何解释”。
DEVELOPMENTAL_PROFILES = (
    {
        "key": "concrete", "min": 8, "max": 11, "label": "具体运算阶段（8–11岁）",
        "student_note": "你可以从看得见的线索出发，说清楚“发生了什么、所以先做什么”。",
        "teacher_note": "逻辑、判断类证据以具体信息为准：能根据可见风险、规则或先后顺序做出合理因果判断，即为有效证据；不要求抽象比较或多方案权衡。"
    },
    {
        "key": "formal", "min": 12, "max": 14, "label": "形式运算逐步显现（12–14岁）",
        "student_note": "你可以试着比较不同做法，想想条件、可能结果和取舍。",
        "teacher_note": "逻辑、判断类的“较明显线索”需要看到多种可能性、条件比较或取舍权衡；只有一个简单的具体理由，保留为初步线索，而不是直接升级。"
    },
)
ABSTRACT_HEAVY_DIMS = {"logical_mathematical", "critical_thinking", "problem_solving", "decision_making"}

def get_developmental_context(student_age: int | None) -> dict:
    try: age = int(student_age)
    except (TypeError, ValueError): age = 11
    for profile in DEVELOPMENTAL_PROFILES:
        if profile["min"] <= age <= profile["max"]:
            return {**profile, "age": age}
    return {**DEVELOPMENTAL_PROFILES[1], "age": age}

def developmental_choice_note(profile: dict, dim: str) -> str:
    if profile["key"] == "concrete" and dim in ABSTRACT_HEAVY_DIMS:
        return "围绕具体情境线索作出判断（是否形成有效逻辑证据，还要看因果或排序说明）"
    if profile["key"] == "formal" and dim in ABSTRACT_HEAVY_DIMS:
        return "围绕任务线索作出判断（较明显线索还需看到条件、比较或取舍）"
    return "围绕任务线索做出相关选择（初步观察）"


# 年龄差异写在 evidence rule 的“什么算证据”里，而不是写成分数乘数。
# 关键词只用于帮助识别表达类型；选择行为、追问回答和跨情境重复表现会共同构成证据。
CONCRETE_CAUSE_MARKERS = ("因为", "所以", "导致", "受伤", "流血", "危险", "疼", "生病", "安全", "火", "堵", "规则")
CONCRETE_ORDER_MARKERS = ("先", "再", "然后", "优先", "第一", "排序", "按顺序", "步骤")
FORMAL_CONDITION_MARKERS = ("如果", "可能", "否则", "条件", "情况", "风险", "结果")
FORMAL_COMPARISON_MARKERS = ("比较", "另一种", "不同", "同时", "除了", "还要", "方案", "兼顾", "权衡", "取舍", "但是")


def _contains_any(text: str, markers: tuple) -> bool:
    return any(marker in (text or "") for marker in markers)


def evaluate_developmental_evidence(profile: dict, dim: str, choice_text: str, answer: str) -> dict:
    """Return the age-appropriate ECD evidence classification for one response.

    This deliberately does not calculate an age-adjustment score.  It decides
    whether the observed explanation meets the criterion for this age band.
    """
    # 追问证据必须来自学生自己的表达，不能把选项中的“因为 / 同时 / 如果”等词
    # 误当成学生已经完成了推理。
    combined = re.sub(r"\s+", "", answer or '')
    concrete_cause = _contains_any(combined, CONCRETE_CAUSE_MARKERS)
    concrete_order = _contains_any(combined, CONCRETE_ORDER_MARKERS)
    formal_condition = _contains_any(combined, FORMAL_CONDITION_MARKERS)
    formal_comparison = _contains_any(combined, FORMAL_COMPARISON_MARKERS)

    if dim not in ABSTRACT_HEAVY_DIMS:
        return {"kind": "general", "qualifies_strong": bool(answer), "note": ""}

    if profile["key"] == "concrete":
        if concrete_cause or concrete_order:
            return {
                "kind": "valid_concrete",
                "qualifies_strong": True,
                "note": "基于情境中可见的风险、规则或先后顺序作出因果判断，符合 8–11 岁的有效逻辑证据标准。"
            }
        return {
            "kind": "needs_concrete_link",
            "qualifies_strong": False,
            "note": "已记录该选择；若能补充“因为看到了什么、所以先做什么”，即可形成更清楚的具体情境证据。"
        }

    if formal_condition or formal_comparison:
        return {
            "kind": "formal_reasoning",
            "qualifies_strong": True,
            "note": "主动考虑了条件、可能结果、不同方案或取舍，符合 12–14 岁“较明显逻辑线索”的证据标准。"
        }
    if concrete_cause or concrete_order:
        return {
            "kind": "simple_reason",
            "qualifies_strong": False,
            "note": "给出了一个具体理由，作为初步线索保留；要升级为较明显线索，还需比较可能性、条件或取舍。"
        }
    return {
        "kind": "needs_reasoning",
        "qualifies_strong": False,
        "note": "已记录该选择；目前尚未出现可判定为较明显的条件比较、可能性分析或取舍说明。"
    }


# 追问文本不是“写得越长越好”。以下规则只检查能够在文本中直接看到的表达质量，
# 并且只在该情境本来就允许观察对应维度时使用。
ACTION_MARKERS = ("我会", "先", "再", "然后", "可以", "让", "帮", "安排", "检查", "观察", "告诉", "解释", "问", "听", "画", "标", "比较", "选择")
REASON_MARKERS = ("因为", "所以", "为了", "避免", "这样", "结果", "导致", "如果", "可能", "但是")
ORDER_MARKERS = ("先", "再", "然后", "最后", "第一", "接着", "同时", "分成", "按顺序")
TARGET_MARKERS = ("他", "她", "他们", "大家", "家长", "同学", "病人", "队友", "孩子", "居民", "爷爷", "奶奶", "小猫", "动物")
COMMUNICATION_MARKERS = ("问", "听", "解释", "告诉", "安慰", "沟通", "讨论", "回应", "分享", "采访", "提醒")
PERSPECTIVE_MARKERS = ("担心", "害怕", "难过", "紧张", "需要", "愿意", "感受", "想法", "不舒服", "压力")
REFLECTION_MARKERS = ("我发现", "我觉得", "我原来", "后来", "改", "调整", "冷静", "检查一下", "重新", "不急")
SPATIAL_MARKERS = ("路线", "出口", "入口", "通道", "楼梯", "位置", "方向", "左", "右", "地图", "平面图", "绕开", "标出来", "区域")
NATURALISTIC_MARKERS = ("伤口", "体温", "呼吸", "精神", "排便", "饮水", "毛发", "环境", "行为", "变化", "食物", "植物", "动物")
CREATIVE_MARKERS = ("新", "不同", "设计", "创意", "游戏", "故事", "画", "改成", "结合", "办法")
TEXT_QUALITY_DIMS = {"linguistic", "communication", "interpersonal", "intrapersonal", "spatial", "naturalistic", "creativity", "empathy", "collaboration"}


def evaluate_response_quality(dim: str, answer: str) -> dict:
    """Dimension-specific, text-only evidence check for one mentor answer.

    It intentionally does not infer bodily or musical intelligence from prose.
    Those dimensions require future direct-operation tasks.
    """
    text = re.sub(r"\s+", "", answer or "")
    if len(text) < 8:
        return {"kind": "insufficient", "strong": False, "bonus": 0.0,
                "note": "回答较短，已保留参与记录，但不足以判定该维度的表达证据。"}
    action = _contains_any(text, ACTION_MARKERS)
    reason = _contains_any(text, REASON_MARKERS)
    order = _contains_any(text, ORDER_MARKERS)
    coherent = (reason or order) and action
    target = _contains_any(text, TARGET_MARKERS)
    communication = _contains_any(text, COMMUNICATION_MARKERS)
    perspective = _contains_any(text, PERSPECTIVE_MARKERS)

    if dim in {"bodily_kinesthetic", "musical"}:
        return {"kind": "needs_direct_task", "strong": False, "bonus": 0.0,
                "note": "该维度不能仅凭文字回答判断，需要在对应的操作任务中继续观察。"}
    if dim == "linguistic":
        strong = len(text) >= 24 and action and coherent
        return {"kind": "clear_expression" if strong else "partial_expression", "strong": strong,
                "bonus": 1.4 if strong else (0.5 if action else 0.0),
                "note": "表达包含清楚的行动、理由或步骤，内容较连贯。" if strong else "有表达想法，但行动、理由或步骤还不够完整。"}
    if dim == "communication":
        strong = action and target and communication and (reason or perspective)
        return {"kind": "responsive_communication" if strong else "partial_communication", "strong": strong,
                "bonus": 1.4 if strong else (0.5 if communication else 0.0),
                "note": "能面向具体对象说明如何倾听、解释或回应，并交代这样做的原因。" if strong else "出现了沟通动作，但尚未清楚呈现对象、回应方式或目的。"}
    if dim == "interpersonal":
        strong = action and target and perspective and _contains_any(text, ("听", "问", "安慰", "解释", "帮助", "一起", "配合"))
        return {"kind": "perspective_response" if strong else "partial_perspective", "strong": strong,
                "bonus": 1.4 if strong else 0.0,
                "note": "注意到他人的感受或需要，并提出了相应的回应方式。" if strong else "仅凭文字未看到足够的“理解他人—调整回应”证据。"}
    if dim == "intrapersonal":
        strong = action and _contains_any(text, REFLECTION_MARKERS) and (reason or order)
        return {"kind": "self_reflection" if strong else "partial_reflection", "strong": strong,
                "bonus": 1.2 if strong else 0.0,
                "note": "能说明自己如何停下来检查、调整或重新考虑做法。" if strong else "未看到足够的自我觉察或调整过程，不以对话次数推断内省能力。"}
    if dim == "spatial":
        marker_count = sum(1 for marker in SPATIAL_MARKERS if marker in text)
        strong = action and marker_count >= 2 and (reason or order)
        return {"kind": "spatial_plan" if strong else "partial_spatial", "strong": strong,
                "bonus": 1.4 if strong else 0.0,
                "note": "能使用位置、方向或路线信息规划行动，并说明安全或效率上的理由。" if strong else "需要在路线规划、布局或空间操作任务中获得更直接的证据。"}
    if dim == "naturalistic":
        marker_count = sum(1 for marker in NATURALISTIC_MARKERS if marker in text)
        strong = action and marker_count >= 2 and (reason or order)
        return {"kind": "concrete_observation" if strong else "partial_observation", "strong": strong,
                "bonus": 1.4 if strong else 0.0,
                "note": "能依据具体生命或环境特征进行观察、比较或判断。" if strong else "需要看到更多具体观察特征与判断之间的联系。"}
    if dim == "creativity":
        strong = action and _contains_any(text, CREATIVE_MARKERS) and (reason or order)
        return {"kind": "creative_plan" if strong else "partial_creativity", "strong": strong,
                "bonus": 1.3 if strong else 0.0,
                "note": "提出了可执行的新做法，并说明了使用场景或理由。" if strong else "仅凭“有一个想法”不足以判断创造性，需要看到具体方案。"}
    if dim in {"empathy", "collaboration"}:
        strong = action and target and (perspective if dim == "empathy" else _contains_any(text, ("一起", "分工", "配合", "队友", "同学")))
        return {"kind": "social_action" if strong else "partial_social_action", "strong": strong,
                "bonus": 1.2 if strong else 0.0,
                "note": "回答呈现了具体的关照或协作行动。" if strong else "未看到足够具体的关照或协作行动。"}
    return {"kind": "structured_response" if coherent else "partial_response", "strong": coherent,
            "bonus": 1.2 if coherent else (0.5 if action else 0.0),
            "note": "能把行动与理由或步骤连起来说明。" if coherent else "已表达行动想法，但理由或步骤尚不完整。"}

class AIService:
    def __init__(self):
        self.enabled = AI_ENABLED; self.client = None
        if self.enabled:
            try:
                self.client = httpx.AsyncClient(base_url=AI_API_BASE,
                    headers={"Authorization":f"Bearer {AI_API_KEY}","Content-Type":"application/json"},
                    timeout=AI_TIMEOUT)
            except Exception: self.enabled = False; self.client = None

    async def chat(self, system_prompt: str, user_message: str, temperature: float = None, max_tokens: int = None) -> str:
        if not self.enabled or not self.client: return ""
        try:
            r = await self.client.post("/chat/completions", json={
                "model": AI_MODEL, "messages": [
                    {"role":"system","content":system_prompt},
                    {"role":"user","content":user_message}
                ], "temperature": temperature or AI_TEMPERATURE,
                "max_tokens": max_tokens or AI_MAX_TOKENS
            }); r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
        except Exception: return ""

    async def chat_json(self, system_prompt: str, user_message: str, temperature: float = None) -> Optional[dict]:
        text = await self.chat(system_prompt, user_message, temperature, max_tokens=1200)
        if not text: return None
        try:
            m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
            return json.loads(m.group(1) if m else text)
        except: return None

ai_service = AIService()

# 第一层由本地规则完成，避免把未成年人的敏感文本直接交给模型作开放式处理。
# 这是“提示与转介门控”，不是诊断工具；任何关注级别都应由成年人进一步判断。
def assess_student_input(text: str) -> dict:
    value = (text or "").strip()
    compact = re.sub(r"\s+", "", value)

    def result(level: str, category: str, message: str, teacher_summary: str = "") -> dict:
        return {
            "level": level, "category": category, "message": message,
            "teacher_summary": teacher_summary, "needs_attention": level in {"urgent", "attention"},
            "pause_mentor": level in {"urgent", "attention"},
            "exclude_from_evidence": level != "normal", "store_raw": False if level != "normal" else True,
        }

    # 高风险：自伤意念、正在发生的暴力/侵害、明确的即时危险。避免要求孩子补充细节。
    self_harm_words = ("不想活", "不想活了", "想死", "自杀", "自残", "割腕", "跳楼", "消失算了", "伤害自己")
    immediate_danger_words = ("正在打我", "有人打我", "我被打", "家暴", "性侵", "强迫我", "有人要伤害我", "有人威胁我", "不敢回家", "现在很危险")
    concern_words = ("被欺负", "霸凌", "被孤立", "很难过", "一直哭", "没人喜欢我", "害怕上学", "害怕学校", "害怕回家")
    privacy_patterns = (
        r"1[3-9]\d{9}", r"\d{17}[\dXx]", r"\b\d{6}\b",
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
    )
    privacy_words = ("我家住在", "家庭住址", "身份证", "微信号", "手机号", "电话号码", "学校是", "几年级几班", "真实姓名")
    inappropriate_words = ("去死", "杀了", "色情", "裸照", "黄色网站", "约炮")

    if any(word in compact for word in self_harm_words):
        return result("urgent", "self_harm", "谢谢你愿意说出来。现在请先暂停体验，马上告诉身边一位可信任的大人，比如家长、老师或学校心理老师；如果你正处在危险中，请立刻向身边的大人求助。", "检测到可能涉及自我伤害的表达；已暂停常规互动，请由指定成年人尽快人工关注。")
    if any(word in compact for word in immediate_danger_words):
        return result("urgent", "immediate_safety", "谢谢你告诉我。你的安全最重要：现在请先暂停体验，尽快告诉身边可信任的大人；如果你正在遇到危险，请立刻向附近的大人求助。", "检测到可能涉及即时人身安全风险的表达；已暂停常规互动，请由指定成年人尽快人工关注。")
    if any(word in value for word in concern_words):
        return result("attention", "wellbeing", "谢谢你告诉我这些感受。被欺负、害怕或一直难过都值得被认真对待；你可以找信任的家长、老师或学校心理老师聊一聊。", "检测到学生可能需要情绪或同伴关系支持；已暂停常规追问，建议由教师/监护人结合实际情况人工关注。")
    if any(re.search(pattern, compact) for pattern in privacy_patterns) or any(word in value for word in privacy_words):
        return result("privacy", "personal_information", "为了保护你自己，请不要在这里写姓名、住址、电话、学校班级或联系方式。可以只说说你的感受或想法。", "检测到可能的个人信息输入；内容不进入能力证据，建议提醒学生避免在开放输入框留下可识别信息。")
    if any(word in compact for word in inappropriate_words):
        return result("redirect", "unsafe_or_inappropriate", "这里是安全、友善的探索空间。我们可以换一种说法，聊聊你在情境里真实的感受和想法。", "检测到不适宜内容；已温和转向，内容不进入能力证据。")
    return result("normal", "none", "")


def assess_report_eligibility(records: list) -> dict:
    """Decide whether a normal ability report is appropriate for this session.

    Safety and sufficient participation are prerequisites for ECD aggregation.
    This prevents empty answers, pauses, or protected content from being
    converted into apparently positive ability conclusions.
    """
    total = len(records or [])
    safety_levels = []
    meaningful = 0
    for record in records or []:
        answer = (record.get("follow_up_answer") or record.get("followup_answer") or "").strip()
        safety = assess_student_input(answer)
        if safety["level"] != "normal":
            safety_levels.append(safety)
        if safety["level"] == "normal" and len(answer) >= 8:
            meaningful += 1

    urgent = next((item for item in safety_levels if item["level"] == "urgent"), None)
    attention = next((item for item in safety_levels if item["level"] == "attention"), None)
    if urgent or attention:
        item = urgent or attention
        return {"mode": "safety_pause", "level": item["level"], "message": item["message"],
                "total": total, "meaningful": meaningful}
    if total < 3 or meaningful < 2 or (total and meaningful / total < 0.4):
        return {"mode": "insufficient_participation", "level": "participation",
                "message": "这次的参与信息还不够，暂时不能形成能力观察。你可以休息一下，之后从一个小任务重新开始。",
                "total": total, "meaningful": meaningful}
    return {"mode": "ready", "level": "normal", "message": "", "total": total, "meaningful": meaningful}

# ============================================================
# Layer 1: Mentor follow-up (unchanged)
# ============================================================
async def generate_follow_up_question(student_age:int, career_name:str, scenario_title:str,
    scenario_context:str, student_choice:str, previous_choices:list=None, choice_id:str="A") -> str:
    prev_ctx = ""
    if previous_choices:
        parts = [f"- 在「{p.get('scenario_title','')}」中选择了：{p.get('choice_text','')}" for p in previous_choices]
        if parts: prev_ctx = "学生之前的经历：\n"+"\n".join(parts)+"\n\n请自然地关联这些经历来追问。"
    prompt = f"""你是星星导师，陪伴{student_age}岁学生体验{career_name}职业。
情境「{scenario_title}」：{scenario_context}
学生选择了：{student_choice}
{prev_ctx}
请生成一个追问问题（1-2句话，50字内），引导学生反思思考过程。只输出问题。

【未成年人内容安全】
- 不索要姓名、住址、电话、学校班级、联系方式等个人信息；如学生主动提及，也不要追问或复述。
- 不鼓励危险、违法、伤害自己或他人的行为；不使用羞辱、贴标签或评判式语言。
- 如果学生表达被欺负、害怕、持续难过或可能自我伤害的内容，停止常规任务追问，先用一句温和的话确认感受，并建议其向可信任的家长、老师或学校心理老师求助；不要求学生提供更多细节。
- 对无关或不友善内容，温和地把话题带回“你在这个情境中观察到什么、想怎么做”。"""
    q = await ai_service.chat("你是温暖的教育引导者。请直接输出追问问题。", prompt, temperature=0.8)
    if q and len(q)>5: return q
    return f"你做出了这个选择，能跟老师说说你是怎么想的吗？"

def build_follow_up_feedback(answer_text: str, choice_text: str = "") -> str:
    """A short, child-facing mentor summary after the single follow-up round."""
    answer = (answer_text or "").strip()
    safety = assess_student_input(answer)
    if safety["level"] != "normal":
        return safety["message"]
    if len(answer) >= 80:
        return "\u4f60\u628a\u60f3\u6cd5\u8bf4\u5f97\u5f88\u5b8c\u6574\uff0c\u4e0d\u4ec5\u8868\u8fbe\u4e86\u7406\u7531\uff0c\u8fd8\u5c1d\u8bd5\u60f3\u5230\u4e86\u63a5\u4e0b\u6765\u600e\u4e48\u505a\u3002\u8fd9\u6837\u7684\u8865\u5145\u80fd\u5e2e\u52a9\u522b\u4eba\u66f4\u4e86\u89e3\u4f60\u7684\u5224\u65ad\u3002"
    if len(answer) >= 30:
        return "\u4f60\u8865\u5145\u4e86\u81ea\u5df1\u7684\u7406\u7531\uff0c\u8fd9\u8ba9\u8fd9\u4e2a\u9009\u62e9\u4e0d\u53ea\u662f\u201c\u6211\u89c9\u5f97\u201d\uff0c\u800c\u662f\u6709\u4e86\u66f4\u6e05\u695a\u7684\u601d\u8003\u3002\u4e0b\u6b21\u8fd8\u53ef\u4ee5\u8bd5\u8bd5\u8865\u4e00\u4e2a\u5177\u4f53\u4f8b\u5b50\u3002"
    return "\u4f60\u613f\u610f\u5728\u5bfc\u5e08\u8ffd\u95ee\u540e\u518d\u8865\u5145\u60f3\u6cd5\uff0c\u8fd9\u5f88\u91cd\u8981\u3002\u5982\u679c\u80fd\u518d\u8bf4\u8bf4\u201c\u4e3a\u4ec0\u4e48\u201d\u6216\u201c\u51c6\u5907\u600e\u4e48\u505a\u201d\uff0c\u522b\u4eba\u5c31\u80fd\u66f4\u6e05\u695a\u5730\u7406\u89e3\u4f60\u3002"

# ============================================================
# Indicator-based scoring (deterministic, always runs)
# ============================================================
def compute_indicator_scores(records: list, student_age: int | None = None) -> tuple:
    """按 ECD 任务模型汇总证据。

    选择题是弱证据；追问说明、修改与持续对话是更强证据。
    速度只用于数据质量检查，不能折算为能力判断。
    """
    profile = get_developmental_context(student_age)
    all_dims = list(MULTIPLE_INTELLIGENCES.keys()) + list(COMPREHENSIVE_LITERACY.keys())
    evidence = {dim: [] for dim in all_dims}
    points = {dim: 0.0 for dim in all_dims}
    coverage = {dim: set() for dim in all_dims}
    # “较明显线索”必须有符合本年龄段规则的强证据，不能仅由篇幅或选择次数堆出来。
    strong_evidence = {dim: set() for dim in all_dims}

    for record in records:
        scenario_id = record.get("scenario_id") or record.get("scenario_title") or "unknown"
        choice = record.get("choice", {})
        indicators = (choice.get("indicators", {}) or record.get("indicators", {})) if isinstance(choice, dict) else record.get("indicators", {})
        choice_text = (choice.get("text", "") if isinstance(choice, dict) else "") or record.get("choice_text", "")
        task = record.get("ecd", {}) or {}
        observable = set(task.get("observable_dimensions", []))
        rules = task.get("evidence_rules", {})
        claim = task.get("claim", "本情境的任务目标")
        relevant_dims = [dim for dim in indicators if dim in points and (not observable or dim in observable)]

        # 选项只能说明学生在本情境中看重的方向，属于弱证据。
        for dim in relevant_dims:
            # 不能因为每个职业情境都预置了“合作/创意/解决问题”选项，
            # 就把这些通用维度推成每个学生的固定闪光点。
            choice_weight = min(float(rules.get("choice_weight", 1.0)), 0.45)
            points[dim] += choice_weight
            coverage[dim].add(scenario_id)
            evidence[dim].append(f"围绕“{claim}”{developmental_choice_note(profile, dim)}")

        # 直接操作证据优先于文字和选项：例如路线规划、拖拽布局、支持性
        # 对话树等。它由职业日常模块显式写入，不能被“回答写得长”替代。
        for direct in record.get("direct_evidence", []) or []:
            dim = str(direct.get("dimension", ""))
            if dim not in points:
                continue
            points[dim] += float(direct.get("weight", 2.6))
            coverage[dim].add(scenario_id)
            strong_evidence[dim].add(scenario_id)
            detail = str(direct.get("detail", "完成了与该维度对应的直接操作任务。"))
            evidence[dim].append(detail)

        answer = (record.get("follow_up_answer") or record.get("followup_answer") or "").strip()
        input_safety = assess_student_input(answer)
        if answer and input_safety["level"] == "normal":
            for dim in relevant_dims:
                # 抽象推理维度先过年龄段规则；其他维度由各自的内容规则判定。
                # 不再用回答长度或“参与了几轮对话”给语言、沟通等维度自动加分。
                if dim in ABSTRACT_HEAVY_DIMS:
                    age_rule = evaluate_developmental_evidence(profile, dim, choice_text, answer)
                    if age_rule["kind"] in ("valid_concrete", "formal_reasoning"):
                        bonus = float(rules.get("explanation_weight", 1.4))
                        strong_evidence[dim].add(scenario_id)
                    elif age_rule["kind"] == "simple_reason":
                        bonus = 0.8
                    else:
                        bonus = 0.5
                    note = age_rule["note"]
                else:
                    content_rule = evaluate_response_quality(dim, answer)
                    bonus, note = content_rule["bonus"], content_rule["note"]
                    # 对空间、人际和自然观察维度，只有“直接内容证据”才可
                    # 升级；一旦满足对应规则，给予比弱选项更高的区分权重。
                    if content_rule["strong"] and dim in {"spatial", "interpersonal", "naturalistic", "empathy"}:
                        bonus = max(bonus, 2.0)
                    if content_rule["strong"]:
                        strong_evidence[dim].add(scenario_id)
                if bonus > 0:
                    points[dim] += bonus
                    coverage[dim].add(scenario_id)
                evidence[dim].append(note)
        elif answer:
            for dim in relevant_dims:
                evidence[dim].append("该次自由表达触发了内容保护提示，未作为能力证据计入")

        # 修改行为只在该任务确实观察“分析/解决/反思”时才作为相关证据。
        if record.get("modified") or int(record.get("modification_count", 0) or 0) > 0:
            revision_dims = [dim for dim in ("critical_thinking", "problem_solving", "intrapersonal")
                             if dim in points and (not observable or dim in observable)]
            for dim in revision_dims:
                points[dim] += float(rules.get("revision_weight", 1.5))
                coverage[dim].add(scenario_id)
                evidence[dim].append("根据过程中的发现修改或完善了原有想法")

        # 对话轮数只属于参与过程信息，不直接折算为语言、沟通或内省能力。

    def score(dim: str) -> float:
        if points[dim] <= 0:
            return 2.5  # 证据不足，不代表能力较低
        value = 2.7 + min(points[dim], 5.0) * 0.30 + min(len(coverage[dim]) - 1, 2) * 0.15
        return round(max(2.5, min(4.5, value)), 1)

    def level(dim: str) -> str:
        if points[dim] <= 0:
            return "证据不足"
        # 对逻辑、批判思维、解决问题、决策等维度，强线索必须来自年龄段认可的证据类型：
        # 8–11 岁是具体因果/排序；12–14 岁是条件、可能性、比较或取舍。
        if dim in ABSTRACT_HEAVY_DIMS:
            if len(coverage[dim]) >= 2 and len(strong_evidence[dim]) >= 1:
                return "较明显线索"
            return "初步线索"
        # 语言、沟通与多数多元智能维度不能由“写得很长”或“反复点同类选项”升级。
        # 需要至少两次相关任务覆盖，并出现一次对应维度的直接内容证据。
        if dim in TEXT_QUALITY_DIMS:
            if len(coverage[dim]) >= 2 and len(strong_evidence[dim]) >= 1:
                return "较明显线索"
            return "初步线索"
        if len(coverage[dim]) >= 2 and points[dim] >= 3.5:
            return "较明显线索"
        return "初步线索"

    for dim in all_dims:
        if evidence[dim]:
            evidence[dim].insert(0, f"[ECD｜{level(dim)}｜覆盖{len(coverage[dim])}个情境｜{profile['label']}]")
        else:
            evidence[dim].append("[ECD｜证据不足｜本次未获得直接观察]")

    return ({dim: score(dim) for dim in MULTIPLE_INTELLIGENCES},
            {dim: score(dim) for dim in COMPREHENSIVE_LITERACY}, evidence)


def build_workday_process_evidence(process_records: list) -> dict:
    """Translate workday telemetry into a non-scoring, child-safe process note.

    The output is intentionally not fed into compute_indicator_scores. It is
    shown beside ECD evidence as an auxiliary account of participation and
    self-regulation during the career-day simulation.
    """
    if not process_records:
        return {
            "available": False,
            "boundary_note": "\u672c\u6b21\u6682\u65e0\u804c\u4e1a\u65e5\u5e38\u7684\u8fc7\u7a0b\u8bb0\u5f55\u3002\u5b83\u4e0d\u5f71\u54cd\u60c5\u5883\u6a21\u5757\u7684\u80fd\u529b\u89c2\u5bdf\u7ed3\u679c\u3002",
        }

    raw = process_records[-1] or {}
    def number(key, default=0):
        try:
            return max(0, int(raw.get(key, default) or default))
        except (TypeError, ValueError):
            return default

    focus = number("focusMinutes", 0)
    interactions = number("interactionCount", 0)
    hints = number("hintCount", 0)
    retries = number("retryCount", 0)
    adjustments = number("adjustmentCount", 0)
    completed = number("completedStages", 0)
    total = number("stageCount", 0)
    metrics = []
    if completed:
        metrics.append({"label": "\u5b8c\u6210\u7684\u5de5\u4f5c\u9636\u6bb5", "value": f"{completed}{' / '+str(total) if total else ''}"})
    if focus:
        metrics.append({"label": "\u4e13\u6ce8\u4f53\u9a8c", "value": f"{focus}\u5206\u949f"})
    if interactions:
        metrics.append({"label": "\u4e3b\u52a8\u5c1d\u8bd5", "value": f"{interactions}\u6b21"})
    if retries or adjustments:
        metrics.append({"label": "\u91cd\u8bd5\u6216\u8c03\u6574", "value": f"{retries + adjustments}\u6b21"})
    if hints:
        metrics.append({"label": "\u67e5\u770b\u63d0\u793a", "value": f"{hints}\u6b21"})

    process_lines = []
    if completed:
        process_lines.append(f"\u5b8c\u6210\u4e86{completed}\u4e2a\u5de5\u4f5c\u9636\u6bb5")
    if retries or adjustments:
        process_lines.append("\u9047\u5230\u4e0d\u987a\u5229\u65f6\u613f\u610f\u91cd\u8bd5\u6216\u8c03\u6574")
    elif interactions:
        process_lines.append("\u4e3b\u52a8\u5b8c\u6210\u4e86\u4e00\u7cfb\u5217\u64cd\u4f5c\u4efb\u52a1")
    if hints:
        process_lines.append("\u5728\u9700\u8981\u65f6\u501f\u52a9\u4e86\u4efb\u52a1\u63d0\u793a")
    student_summary = "\u3001".join(process_lines) if process_lines else "\u5df2\u4fdd\u5b58\u8fd9\u6b21\u804c\u4e1a\u65e5\u5e38\u7684\u4f53\u9a8c\u8fc7\u7a0b\u3002"
    direct_task_evidence = []
    route_path = raw.get("routePath") or []
    if raw.get("careerId") == "firefighter" and raw.get("routeCompleted"):
        retries = number("retryCount", 0)
        direct_task_evidence.append({
            "dimension": "\u7a7a\u95f4\u667a\u80fd / \u8def\u5f84\u89c4\u5212",
            "level": "\u8f83\u660e\u663e\u7ebf\u7d22" if len(route_path) >= 6 and retries <= 2 else "\u521d\u6b65\u7ebf\u7d22",
            "task": "\u73b0\u573a\u6551\u63f4\u8def\u5f84\u89c4\u5212",
            "detail": f"\u5b8c\u6210\u4e86 {len(route_path)} \u4e2a\u5b89\u5168\u8def\u5f84\u70b9\uff0c\u5e76\u907f\u5f00\u706b\u573a\u5371\u9669\u533a\u57df\uff1b\u91cd\u8bd5 {retries} \u6b21\u3002",
            "boundary": "\u8fd9\u662f\u76f4\u63a5\u64cd\u4f5c\u8bc1\u636e\uff0c\u4f9b\u6559\u5e08\u7aef\u4e0e\u540e\u7eed\u8de8\u4efb\u52a1\u89c2\u5bdf\u4f7f\u7528\uff1b\u4e0d\u5355\u72ec\u51b3\u5b9a\u804c\u4e1a\u7ed3\u8bba\u3002",
        })
    return {
        "available": True,
        "career": raw.get("career") or "\u804c\u4e1a\u65e5\u5e38",
        "metrics": metrics,
        "student_summary": student_summary,
        "boundary_note": "\u60c5\u5883\u5bf9\u8bdd\u4e2d\u7684\u9009\u62e9\u3001\u7406\u7531\u548c\u8ffd\u95ee\u8865\u5145\u662f\u80fd\u529b\u89c2\u5bdf\u7684\u4e3b\u8981\u8bc1\u636e\uff1b\u804c\u4e1a\u65e5\u5e38\u53ea\u8bb0\u5f55\u4f60\u7684\u53c2\u4e0e\u3001\u63d0\u793a\u4f7f\u7528\u548c\u8c03\u6574\u8fc7\u7a0b\uff0c\u4e0d\u4f1a\u88ab\u76f4\u63a5\u6362\u7b97\u6210\u80fd\u529b\u5206\u6570\u3002",
        "teacher_note": "\u5de5\u4f5c\u65e5\u5e38\u6a21\u5757\u63d0\u4f9b\u7684\u662f\u4efb\u52a1\u53c2\u4e0e\u8fc7\u7a0b\u7684\u8f85\u52a9\u89c2\u5bdf\uff0c\u53ef\u4e0e\u60c5\u5883\u6a21\u5757\u7684 ECD \u8bc1\u636e\u94fe\u4e92\u76f8\u53c2\u7167\uff0c\u4f46\u4e0d\u4f5c\u4e3a\u80fd\u529b\u5f3a\u5f31\u6216\u804c\u4e1a\u5339\u914d\u7684\u4f9d\u636e\u3002",
        "direct_task_evidence": direct_task_evidence,
    }


def build_workday_direct_task_records(process_records: list) -> list:
    """Convert only explicit task mechanics into ECD-ready direct evidence.

    Process telemetry (time, hints and retries) stays auxiliary.  This function
    deliberately accepts only mechanics that directly enact a target ability.
    """
    if not process_records:
        return []
    raw = process_records[-1] or {}
    career_id = raw.get("careerId") or raw.get("career_id")
    results = raw.get("stageResults") or []
    output = []

    if career_id == "firefighter" and raw.get("routeCompleted"):
        path = raw.get("routePath") or []
        retries = int(raw.get("retryCount", 0) or 0)
        output.append({
            "scenario_id": "workday_route_planning",
            "scenario_title": "职业日常：救援路线规划",
            "direct_evidence": [{
                "dimension": "spatial", "weight": 3.2,
                "detail": f"在路线规划任务中完成了 {len(path)} 个安全路径点，并避开危险区域；重试 {retries} 次。",
            }],
        })

    # Teacher dialogue is recorded as a structured result by workday.js.
    if career_id == "teacher":
        dialogue = next((item for item in results if isinstance(item, dict) and item.get("type") == "dialogue" and item.get("completed")), None)
        if dialogue:
            turns = int(dialogue.get("supportiveTurns", 0) or 0)
            output.append({
                "scenario_id": "workday_supportive_dialogue",
                "scenario_title": "职业日常：支持性对话",
                "direct_evidence": [{
                    "dimension": "interpersonal", "weight": 3.0,
                    "detail": f"在对话树中连续完成 {turns} 次支持性回应，并根据角色反馈调整说法。",
                }, {
                    "dimension": "empathy", "weight": 2.8,
                    "detail": "在对话树中先回应角色的情绪与需要，再选择下一步支持方式。",
                }],
            })
    return output


def build_report_evidence(records: list, student_age: int | None = None) -> dict:
    """Build child-facing ECD evidence notes without exposing score weights."""
    _, _, evidence = compute_indicator_scores(records, student_age)
    summary = {}
    for dim, label in ALL_DIMS.items():
        items = evidence.get(dim, [])
        header = items[0] if items else ''
        if '\u8f83\u660e\u663e\u7ebf\u7d22' in header:
            level = '\u8f83\u660e\u663e\u7ebf\u7d22'
        elif '\u521d\u6b65\u7ebf\u7d22' in header:
            level = '\u521d\u6b65\u7ebf\u7d22'
        else:
            level = '\u8bc1\u636e\u4e0d\u8db3'
        detail = next((item for item in items if not item.startswith('[ECD')), '')
        summary[label] = {'level': level, 'detail': detail}
    return summary


def build_teacher_evidence(records: list, student_age: int | None = None) -> list:
    """Return traceable ECD evidence chains for the teacher/guardian report."""
    _, _, evidence = compute_indicator_scores(records, student_age)
    chains = []
    for dim, label in ALL_DIMS.items():
        items = evidence.get(dim, [])
        header = items[0] if items else ''
        if '\u8f83\u660e\u663e\u7ebf\u7d22' in header:
            level = '\u8f83\u660e\u663e\u7ebf\u7d22'
        elif '\u521d\u6b65\u7ebf\u7d22' in header:
            level = '\u521d\u6b65\u7ebf\u7d22'
        else:
            level = '\u8bc1\u636e\u4e0d\u8db3'
        traces, claims, coverage = [], [], set()
        for record in records:
            indicators = (record.get('choice', {}) or {}).get('indicators', {}) if isinstance(record.get('choice'), dict) else record.get('indicators', {})
            task = record.get('ecd', {}) or {}
            observable = set(task.get('observable_dimensions', []))
            if dim not in indicators or (observable and dim not in observable):
                continue
            title = record.get('scenario_title') or record.get('scenario_id') or '\u672a\u547d\u540d\u60c5\u5883'
            claim = task.get('claim', '\u672c\u60c5\u5883\u4efb\u52a1')
            coverage.add(title)
            if claim not in claims:
                claims.append(claim)
            actions = ['\u5b8c\u6210\u4e86\u76f8\u5173\u9009\u62e9']
            answer = (record.get('follow_up_answer') or record.get('followup_answer') or '').strip()
            if answer:
                actions.append('\u8865\u5145\u4e86\u81ea\u5df1\u7684\u7406\u7531\u6216\u60f3\u6cd5')
            if record.get('modified') or int(record.get('modification_count', 0) or 0) > 0:
                actions.append('\u5728\u8fc7\u7a0b\u4e2d\u4fee\u6539\u6216\u5b8c\u5584\u4e86\u60f3\u6cd5')
            if int(record.get('follow_up_rounds', record.get('followup_rounds', 0)) or 0) >= 2:
                actions.append('\u6301\u7eed\u53c2\u4e0e\u4e86\u8ffd\u95ee\u4ea4\u6d41')
            traces.append({'scenario': title, 'claim': claim, 'actions': actions, 'answer': answer[:180]})
        chains.append({'dimension': label, 'level': level, 'coverage': len(coverage), 'claims': claims, 'traces': traces})
    return chains

# ============================================================
# Layer 2: AI-powered narrative generation (anchored in indicator scores)
# ============================================================
async def generate_ai_narrative(
    student_age: int, career_name: str,
    int_scores: dict, lit_scores: dict, evidence: dict,
    records: list
) -> Optional[dict]:
    """
    AI's job: read the indicator-anchored scores and evidence,
    write narrative observations. AI can adjust scores by ±0.5
    based on qualitative assessment of follow-up answers.
    """
    if not AI_ENABLED: return None

    developmental_context = get_developmental_context(student_age)
    developmental_evidence_instruction = (
        "8–11岁：具体情境中的因果判断、风险识别或合理排序已经是有效逻辑证据，不能因为没有抽象权衡而降低其证据等级。"
        if developmental_context["key"] == "concrete" else
        "12–14岁：单一具体理由只能称为初步线索；只有出现条件、可能结果、不同方案比较或取舍时，才可称为较明显的逻辑线索。"
    )
    # Build evidence summary for AI
    evidence_lines = [f"【本年龄段 ECD 证据判定】{developmental_evidence_instruction}"]
    for dim_key, dim_label in ALL_DIMS.items():
        evs = evidence.get(dim_key, [])
        score = int_scores.get(dim_key) or lit_scores.get(dim_key, 2.5)
        if evs:
            evidence_lines.append(f"【{dim_label}】指标得分={score} | 证据：{'；'.join(evs[-3:])}")
        else:
            evidence_lines.append(f"【{dim_label}】指标得分={score} | 证据：本情境未直接触发")

    # Build follow-up answers for AI to assess quality
    fu_text = ""
    for i, r in enumerate(records, 1):
        fa = r.get("follow_up_answer", "")
        if fa:
            if assess_student_input(fa)["level"] == "normal":
                fu_text += f"情境{i}追问回答：{fa[:200]}\n"
            else:
                fu_text += f"情境{i}追问回答： （已触发未成年人内容保护，未发送原文）\n"

    prompt = f"""你是教育观察专家。以下是一个{student_age}岁学生在「{career_name}」职业体验中的行为数据。

【ECD观察说明】这些数值不是能力分数，而是系统根据“任务—学生行为—证据”形成的观察线索。
【年龄发展解释】该学生处于“{developmental_context['label']}”。{developmental_context['teacher_note']}
你的任务是依据证据写观察叙事，不能修改分数，也不能把一次选择解释成稳定能力：
1. 只从有直接行为证据的维度中选择“本次闪耀的特质”
2. 将证据不足的维度写为“可继续探索的方向”，不能称为弱项、短板或展现较少
3. 叙事要区分“初步线索”和“较明显线索”，并引用具体任务行为
4. 不评价学生适合或不适合任何职业，也不把发展阶段中的表现写成弱项
5. 选择3个左右的特质和3个左右的探索方向，均使用温暖、具体的语言

【指标分数与证据】
{chr(10).join(evidence_lines)}

【学生追问回答（供质量评估）】
{fu_text if fu_text else '（无追问回答）'}

【跨情境行为摘要】
决策速度：{', '.join([f'情境{i+1}={r.get("decision_time_ms",0)//1000}秒' for i,r in enumerate(records)])}
修改次数：{', '.join([f'情境{i+1}={r.get("modification_count",0)}次' for i,r in enumerate(records)])}

请输出严格JSON：
{{
  "intelligence_scores": {{"linguistic": 3.5, ...}},     ← 可以用调整后的分数
  "literacy_scores": {{"creativity": 3.0, ...}},
  "strengths": [
    {{"name": "维度中文名", "score": 4.5, "description": "温暖的观察描述（40-60字），引用具体情境中的行为"}}
  ],
  "growth_areas": [
    {{"name": "维度中文名", "score": 2.0, "suggestion": "积极正面的探索建议（30-50字），用'可以尝试''有机会的话'等鼓励语"}}
  ],
  "personalized_message": "给学生的个性化寄语（80-120字），温暖有仪式感，提到具体情境中的选择",
  "cross_validation_notes": "跨情境一致性观察：如果学生在不同情境中表现出一致的倾向请描述；如果有变化也好奇地指出"
}}

重要规则：
- 分数调整幅度不超过±0.5，且必须有追问回答中的明确证据支撑
- 如果追问回答为空或敷衍，不做调整，直接用指标分数
- 叙事必须引用具体的行为证据，不能泛泛而谈
- 不使用"弱项""不足""缺乏"等评判词
- 总维度数量应与指标分数一致（16个维度）"""

    result = await ai_service.chat_json(
        "你是教育观察专家。你的评分以指标数据为基础，只做小幅调整。严格输出JSON。",
        prompt, temperature=0.5
    )

    if result and "strengths" in result:
        # Ensure all 16 dimensions are present (fill from indicator scores if missing)
        for k in MULTIPLE_INTELLIGENCES:
            if k not in result.get("intelligence_scores", {}):
                result.setdefault("intelligence_scores", {})[k] = int_scores.get(k, 2.5)
        for k in COMPREHENSIVE_LITERACY:
            if k not in result.get("literacy_scores", {}):
                result.setdefault("literacy_scores", {})[k] = lit_scores.get(k, 2.5)
        return result
    return None


# ============================================================
# Lightweight multi-agent report pipeline (one external model API)
# ============================================================
class EvidenceObserverAgent:
    """Deterministic ECD observer: turns task behavior into traceable evidence."""
    def observe(self, records: list, student_age: int | None = None) -> dict:
        intelligence, literacy, evidence = compute_indicator_scores(records, student_age)
        return {
            "intelligence_scores": intelligence,
            "literacy_scores": literacy,
            "evidence": evidence,
            "evidence_summary": build_report_evidence(records, student_age),
            "developmental_context": get_developmental_context(student_age),
        }


class FeedbackWriterAgent:
    """The only role that may call the configured OpenAI-compatible model endpoint."""
    async def write(self, student_age: int, career_name: str, observation: dict, records: list) -> Optional[dict]:
        return await generate_ai_narrative(
            student_age, career_name,
            observation["intelligence_scores"], observation["literacy_scores"],
            observation["evidence"], records,
        )


class SafetyGuardianAgent:
    """Local child-safety and anti-labeling guardrail; no model call is required."""
    _forbidden = (
        "\u9002\u5408\u6210\u4e3a", "\u4e0d\u9002\u5408", "\u5929\u751f\u9002\u5408", "\u804c\u4e1a\u63a8\u8350",
        "\u5f31\u9879", "\u77ed\u677f", "\u7f3a\u4e4f\u80fd\u529b", "\u80fd\u529b\u4f4e",
    )

    def _safe_text(self, value: object) -> object:
        if not isinstance(value, str):
            return value
        text = value
        for phrase in self._forbidden:
            text = text.replace(phrase, "\u53ef\u4ee5\u7ee7\u7eed\u63a2\u7d22")
        return text

    def review(self, payload: dict) -> dict:
        allowed_dimensions = set(ALL_DIMS.values())
        for field, text_field in (("strengths", "description"), ("growth_areas", "suggestion")):
            safe_items = []
            for item in payload.get(field, []) or []:
                if not isinstance(item, dict) or item.get("name") not in allowed_dimensions:
                    continue
                clean = dict(item)
                clean[text_field] = self._safe_text(clean.get(text_field, ""))
                safe_items.append(clean)
            payload[field] = safe_items[:3]
        for field in ("personalized_message", "cross_validation_notes"):
            payload[field] = self._safe_text(payload.get(field, ""))
        return payload


evidence_observer_agent = EvidenceObserverAgent()
feedback_writer_agent = FeedbackWriterAgent()
safety_guardian_agent = SafetyGuardianAgent()

# ============================================================
# Main analysis entry point
# ============================================================
async def analyze_session_behavior(student_age:int, career_name:str, behavior_records:list) -> dict:
    """
    Two-phase analysis:
    Phase 1 (always): compute indicator-anchored scores (deterministic)
    Phase 2 (if AI): AI reviews scores, writes narratives, adjusts ±0.5
    """
    # Agent 1: deterministic ECD observation.
    observation = evidence_observer_agent.observe(behavior_records, student_age)
    int_scores = observation["intelligence_scores"]
    lit_scores = observation["literacy_scores"]
    evidence = observation["evidence"]

    # Agent 2: one optional model call for a child-friendly narrative.
    ai_result = await feedback_writer_agent.write(student_age, career_name, observation, behavior_records)

    if ai_result:
        return safety_guardian_agent.review({
            "intelligence_scores": int_scores,
            "literacy_scores": lit_scores,
            "strengths": ai_result.get("strengths", []),
            "growth_areas": ai_result.get("growth_areas", []),
            "personalized_message": ai_result.get("personalized_message", ""),
            "cross_validation_notes": ai_result.get("cross_validation_notes", ""),
            "evidence_summary": observation["evidence_summary"],
        })

    # Fallback: template-based narrative from indicator scores
    all_scores = {**{f"i.{k}":v for k,v in int_scores.items()}, **{f"l.{k}":v for k,v in lit_scores.items()}}
    sorted_items = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
    labels = ALL_DIMS
    observed_items = [(k, v) for k, v in sorted_items
                      if "证据不足" not in evidence.get(k.replace("i.", "").replace("l.", ""), [""])[0]]
    top3 = (observed_items or sorted_items)[:3]
    selected_keys = {k for k, _ in top3}
    # “探索方向”来自本次证据不足或尚未入选的维度，不把低数值解释为短板。
    explore_pool = [item for item in sorted_items if item[0] not in selected_keys]
    bottom3 = explore_pool[:3]

    # Build evidence-based descriptions
    def build_desc(k_clean, score):
        evs = evidence.get(k_clean, [])
        if evs:
            return f"在{evs[0].split('→')[0]}中，你展现了{labels.get(k_clean,k_clean)}方面的特质。"
        return f"在体验中，你在{labels.get(k_clean,k_clean)}方面自然地展现了出来。你的选择中透露出这方面的倾向。"

    def build_suggestion(k_clean):
        evs = evidence.get(k_clean, [])
        if not evs:
            return f"{labels.get(k_clean,k_clean)}是一个值得探索的方向——下次可以试着从不同的角度来体验。"
        return f"在{labels.get(k_clean,k_clean)}方面，你已经有了不错的开始。有机会的话可以多尝试不同的方式。"

    return {
        "intelligence_scores": int_scores,
        "literacy_scores": lit_scores,
        "strengths": [{"name": labels.get(k.replace("i.","").replace("l.",""), k), "score": v,
            "description": build_desc(k.replace("i.","").replace("l.",""), v)} for k, v in top3],
        "growth_areas": [{"name": labels.get(k.replace("i.","").replace("l.",""), k), "score": v,
            "suggestion": build_suggestion(k.replace("i.","").replace("l.",""))} for k, v in bottom3],
        "personalized_message": f"你在这次职业体验中展现了独特的思考方式。每一个选择都反映了你对待世界的态度。重要的是你在体验中发现了什么。",
        "cross_validation_notes": "通过多个情境的观察，可以看到你在面对不同情况时自然流露的思考倾向。"
    }

# ============================================================
# Anomaly detection
# ============================================================
def detect_anomalies(records: list) -> list:
    anomalies = []
    times = [r.get("decision_time_ms", 0) for r in records]
    idxs = [r.get("choice_index", -1) for r in records]
    answers = [r.get("follow_up_answer", "") for r in records]
    if times and sum(1 for t in times if 0 < t < DECISION_TOO_FAST_MS) >= len(times) * 0.75:
        anomalies.append("决策速度持续偏快，可能在随机选择。")
    if times and sum(1 for t in times if t > DECISION_TOO_SLOW_MS) >= len(times) * 0.5:
        anomalies.append("决策时间较长，可能在深思熟虑或注意力分散。")
    if len(set(idxs)) == 1 and len(idxs) >= 3:
        anomalies.append("所有情境选择了相同位置的选项，建议核实参与度。")
    if sum(1 for a in answers if not a or len(a.strip()) < 2) >= len(answers) * 0.75:
        anomalies.append("大部分追问回答为空。")
    return anomalies

# ============================================================
# Final report generation
# ============================================================
def select_distinctive_report_strengths(all_evidence: dict, scores: dict) -> list:
    """Select report highlights from *qualified* ECD evidence, not raw score order.

    A scenario option can only provide a weak direction signal.  Therefore a
    dimension may appear in the child-facing "flash point" area only when the
    evidence chain records either a clear signal, or (if no clear signal exists
    anywhere) a small number of initial signals.  This prevents every student
    who completes the same career from receiving the same communication /
    problem-solving / creativity trio.
    """
    clear, initial = [], []
    for dim, items in all_evidence.items():
        header = items[0] if items else ""
        if "\u8f83\u660e\u663e\u7ebf\u7d22" in header:
            clear.append(dim)
        elif "\u521d\u6b65\u7ebf\u7d22" in header:
            initial.append(dim)

    # Clear evidence comes first.  If a learner has no clear evidence yet, do
    # not force a generic Top 3; show at most two carefully worded leads.
    pool = clear if clear else initial
    limit = 3 if clear else 2
    return sorted(pool, key=lambda dim: scores.get(dim, 2.5), reverse=True)[:limit]


async def generate_final_report(student_age:int, student_name:str, career_name:str,
    all_records: list, all_observations: list) -> dict:
    """
    Generate final report by aggregating all scenario observations.
    Uses indicator-anchored scores as the foundation.
    """
    anomalies = detect_anomalies(all_records)

    # Aggregate indicator scores across all scenarios
    agg_int, agg_lit, all_evidence = compute_indicator_scores(all_records, student_age)
    all_scores = {**agg_int, **agg_lit}
    qualified_keys = select_distinctive_report_strengths(all_evidence, all_scores)
    qualified_names = {ALL_DIMS.get(key, key) for key in qualified_keys}

    # If AI enabled, generate cross-scenario narrative
    if AI_ENABLED:
        ai_result = await feedback_writer_agent.write(student_age, career_name, {"intelligence_scores": agg_int, "literacy_scores": agg_lit, "evidence": all_evidence}, all_records)
        if ai_result:
            # The writer may produce eloquent but generic Top 3 items.  Keep
            # only dimensions that passed the deterministic ECD gate above.
            safe_strengths = [item for item in (ai_result.get("strengths", []) or [])
                              if item.get("name") in qualified_names]
            if not safe_strengths:
                safe_strengths = [{
                    "name": ALL_DIMS.get(key, key), "score": all_scores.get(key, 2.5),
                    "description": next((item for item in all_evidence.get(key, [])[1:]
                                         if item and not item.startswith("[ECD")),
                                       "本次体验中收集到了与该方向有关的观察线索。")
                } for key in qualified_keys]
            return safety_guardian_agent.review({
                "intelligence_scores": agg_int,
                "literacy_scores": agg_lit,
                "aggregated_intelligence": agg_int,
                "aggregated_literacy": agg_lit,
                "strengths": safe_strengths,
                "growth_areas": ai_result.get("growth_areas", []),
                "personalized_message": ai_result.get("personalized_message", ""),
                "cross_validation_notes": ai_result.get("cross_validation_notes", ""),
                "anomalies": anomalies,
                "student_name": student_name,
                "career_name": career_name,
                "total_scenarios": len(all_records),
                "generated_at": datetime.now(timezone.utc).isoformat()
            })

    # Fallback
    labels = ALL_DIMS
    all_s = all_scores
    sorted_items = sorted(all_s.items(), key=lambda x: x[1], reverse=True)
    # Do not turn weak, repeated option indicators into a generic Top 3.
    top3 = [(k, all_s.get(k, 2.5)) for k in qualified_keys]
    selected_keys = {k for k, _ in top3}
    # 后续方向表示尚可继续收集的证据，不表示能力排序靠后。
    explore_pool = [item for item in sorted_items if item[0] not in selected_keys]
    bottom3 = explore_pool[:3]

    def build_desc(k, score):
        evs = all_evidence.get(k, [])
        if evs: return f"在多个情境中，你自然地展现了{labels.get(k,k)}方面的特质。比如{evs[0].split('→')[0][:40]}。"
        return f"在体验过程中，你在{labels.get(k,k)}方面展现了自己的独特方式。"

    return {
        "intelligence_scores": agg_int, "literacy_scores": agg_lit,
        "aggregated_intelligence": agg_int, "aggregated_literacy": agg_lit,
        "strengths": [{"name": labels.get(k, k), "score": v, "description": build_desc(k, v)} for k, v in top3],
        "growth_areas": [{"name": labels.get(k, k), "score": v,
            "suggestion": f"{labels.get(k,k)}是一个有意思的方向，下次可以试着从不同角度去探索它。"} for k, v in bottom3],
        "personalized_message": f"亲爱的{student_name}，恭喜你完成了{career_name}的体验之旅！在{len(all_records)}个不同的情境中，你用自己独特的方式做出了选择。希望这次体验让你对自己有了新的认识。",
        "cross_validation_notes": "在不同情境中，你自然地展现了独特的思考和行为方式。" if not anomalies else "在不同情境中，我们看到了一些有趣的模式。",
        "anomalies": anomalies, "student_name": student_name, "career_name": career_name,
        "total_scenarios": len(all_records),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# ============================================================
# Cross-Career Comprehensive Growth Report
# ============================================================
def build_cross_career_summary(sessions_data: list) -> dict:
    """跨职业汇总学生所有已完成体验的证据，形成综合成长报告。

    输入 sessions_data 是一个列表，每个元素包含一次已完成会话的数据：
      - career_name / career_id：职业信息
      - student_age：该次会话时学生的年龄
      - records：行为记录列表（与 all_records 结构一致）

    核心设计原则（与单次报告一致）：
      - 不做能力打分排名，语言保持「线索式」而非「定论式」
      - 证据不足的维度不强行给出结论
      - 继续沿用年龄发展分层规则（DEVELOPMENTAL_PROFILES）
      - 「覆盖范围」从同一职业内的情境数升级为跨职业的情境数
    """
    if not sessions_data:
        return {
            "career_count": 0, "careers": [],
            "dimension_summaries": [], "ai_input": "",
            "single_career_warning": None,
        }

    all_dims = list(MULTIPLE_INTELLIGENCES.keys()) + list(COMPREHENSIVE_LITERACY.keys())

    # 使用最近一次会话的年龄作为主要发展参考
    latest_age = max((int(s.get("student_age", 11) or 11) for s in sessions_data), default=11)
    profile = get_developmental_context(latest_age)

    # 为每个维度收集跨职业证据轨迹
    traces_by_dim = {dim: [] for dim in all_dims}
    careers_set = set()

    for session in sessions_data:
        career_name = session.get("career_name", "")
        career_id = session.get("career_id", "")
        student_age = int(session.get("student_age", latest_age) or latest_age)
        records = session.get("records", [])
        sess_profile = get_developmental_context(student_age)

        careers_set.add(career_name)

        for record in records:
            scenario_title = record.get("scenario_title") or "未命名情境"
            choice_text = record.get("choice_text", "")
            indicators = record.get("indicators", {})
            ecd = record.get("ecd", {}) or {}
            observable = set(ecd.get("observable_dimensions", []))
            claim = ecd.get("claim", "本情境任务")

            # 仅聚合在 indicators 中且在 observable_dimensions 内的维度
            relevant_dims = [
                d for d in indicators
                if d in traces_by_dim and (not observable or d in observable)
            ]

            answer = (record.get("follow_up_answer") or "").strip()
            input_safety = assess_student_input(answer)

            for dim in relevant_dims:
                actions = [f"围绕「{claim}」任务目标做出了相关选择"]

                has_strong = False
                if answer and input_safety["level"] == "normal":
                    age_rule = evaluate_developmental_evidence(sess_profile, dim, choice_text, answer)
                    if dim in ABSTRACT_HEAVY_DIMS:
                        if age_rule["kind"] in ("valid_concrete", "formal_reasoning"):
                            has_strong = True
                            actions.append(f"补充了具体理由，构成较明显证据：{age_rule['note']}")
                        elif age_rule["kind"] == "simple_reason":
                            actions.append(f"补充了简单理由（初步线索）：{age_rule['note']}")
                        else:
                            actions.append("对追问做了回应，但尚未形成年龄对应的有效逻辑证据")
                    elif len(answer) >= 80:
                        has_strong = True
                        actions.append("对追问给出了较完整的理由、步骤或方案")
                    elif len(answer) >= 30:
                        has_strong = True
                        actions.append("对追问补充了具体想法")
                    else:
                        actions.append("回应追问并表达了自己的想法")
                elif answer:
                    actions.append("该次自由表达触发了内容保护提示，未作为能力证据计入")

                if int(record.get("modification_count", 0) or 0) > 0:
                    actions.append("在过程中修改或完善了原有想法")

                if int(record.get("follow_up_rounds", 0) or 0) >= 2 and (
                        not answer or input_safety["level"] == "normal"):
                    actions.append("持续参与追问，愿意进一步澄清或反思")

                traces_by_dim[dim].append({
                    "career_name": career_name,
                    "career_id": career_id,
                    "scenario_title": scenario_title,
                    "claim": claim,
                    "actions": actions,
                    "has_strong": has_strong,
                    "answer_preview": answer[:120] if answer and input_safety["level"] == "normal" else "",
                })

    # 逐维度判定证据等级（升级为跨职业视角）
    career_count = len(careers_set)
    summaries = []

    for dim_key in all_dims:
        traces = traces_by_dim[dim_key]
        label = ALL_DIMS[dim_key]

        if not traces:
            summaries.append({
                "dimension_key": dim_key,
                "dimension_label": label,
                "level": "证据不足",
                "cross_career": False,
                "cross_career_note": "",
                "evidence_traces": [],
                "unique_careers": 0,
                "unique_scenarios": 0,
            })
            continue

        unique_careers = len(set(t["career_name"] for t in traces))
        unique_scenarios = len(set(f"{t['career_name']}|{t['scenario_title']}" for t in traces))
        strong_count = sum(1 for t in traces if t.get("has_strong"))

        # 跨职业判定逻辑：
        # - 同一个维度在多个不同职业中出现，比在同一职业中出现多次更有说服力
        # - 抽象维度仍需年龄校准后的较强证据
        # - 非抽象维度以跨职业覆盖数为主要升级依据
        cross_career = unique_careers >= 2

        if dim_key in ABSTRACT_HEAVY_DIMS:
            # 抽象维度：必须有年龄认可的有效证据 + 跨职业覆盖才能升级
            if cross_career and strong_count >= 1:
                level = "较明显线索"
            elif unique_scenarios >= 2 and strong_count >= 1:
                level = "较明显线索"
            elif unique_careers >= 1:
                level = "初步线索"
            else:
                level = "证据不足"
        else:
            # 非抽象维度：跨职业覆盖本身就是较强信号
            if cross_career:
                level = "较明显线索"
            elif unique_scenarios >= 2 and strong_count >= 1:
                level = "较明显线索"
            elif unique_careers >= 1:
                level = "初步线索"
            else:
                level = "证据不足"

        # 生成跨职业提示语
        cross_note = ""
        if cross_career and level == "较明显线索":
            career_names = sorted(set(t["career_name"] for t in traces))
            cross_note = f"这个特点在{'、'.join(career_names)}等{len(career_names)}个不同类型的职业体验中都有出现，比单一职业内的观察更有参考价值。"
        elif cross_career:
            cross_note = "这个特点在多个职业中有所体现，继续体验可以帮助我们看到更清晰的线索。"

        # 展示层精简：按代表性排序，只保留前5条证据痕迹（存储层不受影响）
        # 排序优先级：强证据 > 回答详细程度 > 跨职业多样性
        total_traces = len(traces)
        traces.sort(key=lambda t: (t.get("has_strong", False), len(t.get("answer_preview", ""))), reverse=True)
        display_traces = traces[:5]

        summaries.append({
            "dimension_key": dim_key,
            "dimension_label": label,
            "level": level,
            "cross_career": cross_career,
            "cross_career_note": cross_note,
            "evidence_traces": display_traces,
            "total_traces": total_traces,
            "unique_careers": unique_careers,
            "unique_scenarios": unique_scenarios,
        })

    # 单职业提示
    single_warning = None
    if career_count <= 1:
        single_warning = "目前只完成了1个职业的体验。继续体验更多职业，能帮助我们看到更稳定的线索——同一个特点如果在不同类型的职业中都出现，会比单一职业内的观察更有说服力。建议至少完成2–3个不同职业后再回来看这份报告。"

    # 构建供 AI 使用的结构化摘要
    ai_input_lines = []
    ai_input_lines.append(f"学生已完成 {career_count} 个职业体验：{'、'.join(sorted(careers_set))}")
    ai_input_lines.append(f"学生当前年龄段：{profile['label']}（{latest_age}岁）")
    ai_input_lines.append("")

    cross_dims = [s for s in summaries if s["cross_career"] and s["level"] == "较明显线索"]
    single_dims = [s for s in summaries if s["level"] in ("初步线索", "较明显线索") and not s["cross_career"]]
    insufficient_dims = [s for s in summaries if s["level"] == "证据不足"]

    if cross_dims:
        ai_input_lines.append("【跨职业反复出现的维度——值得特别关注】")
        for s in cross_dims:
            careers = sorted(set(t["career_name"] for t in s["evidence_traces"]))
            actions_sample = []
            for t in s["evidence_traces"][:4]:
                actions_sample.append(f"  · {t['career_name']}「{t['scenario_title']}」：{'；'.join(t['actions'][-2:])}")
            ai_input_lines.append(f"■ {s['dimension_label']}（出现在{'、'.join(careers)}）")
            ai_input_lines.extend(actions_sample)
        ai_input_lines.append("")

    if single_dims:
        ai_input_lines.append("【仅在一个职业中出现的维度】")
        for s in single_dims:
            ai_input_lines.append(f"- {s['dimension_label']}：仅在{s['evidence_traces'][0]['career_name']}中有观察线索")
        ai_input_lines.append("")

    if insufficient_dims:
        dim_names = [s['dimension_label'] for s in insufficient_dims[:8]]
        ai_input_lines.append(f"【本次尚未获得充分观察的维度】{'、'.join(dim_names)}等")

    return {
        "career_count": career_count,
        "careers": sorted(careers_set),
        "student_age": latest_age,
        "developmental_context": profile,
        "dimension_summaries": summaries,
        "ai_input": "\n".join(ai_input_lines),
        "single_career_warning": single_warning,
    }


async def generate_cross_career_narrative(summary: dict) -> str:
    """基于跨职业汇总证据，生成一段温暖的综合成长小结。

    AI 只做叙事，不自己发明分数或排名。重点提及「哪些特点在不同职业里反复出现」。
    """
    if not AI_ENABLED or summary.get("career_count", 0) == 0:
        return ""

    ai_input = summary.get("ai_input", "")
    developmental_ctx = summary.get("developmental_context", {})
    single_warning = summary.get("single_career_warning", "")

    prompt = f"""你是儿童成长观察专家。以下是一个学生在多个职业体验中的综合行为观察数据。
请基于这些线索，写一段温暖、具体的综合成长小结（200-300字）。

【重要原则——请严格遵守】
1. 你做的是"叙事"，不是"诊断"。使用"线索""观察""倾向""自然展现"等语言，不要用"能力""水平""等级"等评判词。
2. 重点提及那些在不同职业中反复出现的特点——这是最有价值的发现。
3. 证据不足的维度不要强行给出结论，可以温和地说"有些方面还需要更多不同的体验才能看到线索"。
4. 语言温暖、有仪式感，像一位了解孩子的导师在聊天。
5. 如果学生只完成了1个职业，要明确说明"证据还不够，建议继续体验"——不要在证据太少时勉强生成一份看起来很确定的报告。
6. 不要给职业推荐，不要说"适合做什么"，不要给任何打分或排名。

【学生发展背景】
{developmental_ctx.get('label', '')}（{summary.get('student_age', '')}岁）
{developmental_ctx.get('student_note', '')}

【已完成职业】
{summary.get('career_count', 0)}个：{'、'.join(summary.get('careers', []))}

【结构化观察数据】
{ai_input}

{f'【特别提示】{single_warning}' if single_warning else ''}

请直接输出一段温暖的成长小结文字（不要JSON，不要标题，纯文本段落）。"""

    result = await ai_service.chat(
        "你是温暖的儿童成长观察专家。用具体、温暖的语言描述观察到的成长线索。",
        prompt, temperature=0.7, max_tokens=600
    )
    return (result or "").strip()


def build_cross_career_teacher_view(summary: dict) -> list:
    """为教师/家长视图构建跨职业证据链。

    每个维度按「证据不足/初步线索/较明显线索」三档展示，
    包含来自不同职业的具体证据条目。
    """
    chains = []
    for dim_summary in summary.get("dimension_summaries", []):
        traces = dim_summary.get("evidence_traces", [])
        if not traces:
            chains.append({
                "dimension": dim_summary["dimension_label"],
                "level": "证据不足",
                "cover_careers": 0,
                "cover_scenarios": 0,
                "traces": [],
                "note": "跨职业体验中暂未获得该维度的直接观察证据。",
            })
            continue

        # 按职业分组
        by_career = {}
        for t in traces:
            c = t["career_name"]
            if c not in by_career:
                by_career[c] = []
            by_career[c].append(t)

        chain_traces = []
        for career, items in by_career.items():
            for item in items:
                chain_traces.append({
                    "career": career,
                    "scenario": item["scenario_title"],
                    "claim": item["claim"],
                    "actions": item["actions"],
                    "answer_preview": item.get("answer_preview", ""),
                })

        note = ""
        if dim_summary.get("cross_career"):
            careers = set(t["career"] for t in chain_traces)
            note = f"该维度在{'、'.join(sorted(careers))}等{len(careers)}个不同职业中均有体现——跨职业的一致性比单一职业内的观察更有参考价值。"
        elif dim_summary["level"] == "初步线索":
            note = "目前线索仅来自单一职业体验，建议在更多不同类型的职业中继续观察。"

        chains.append({
            "dimension": dim_summary["dimension_label"],
            "level": dim_summary["level"],
            "cover_careers": dim_summary["unique_careers"],
            "cover_scenarios": dim_summary["unique_scenarios"],
            "total_traces": dim_summary.get("total_traces", len(chain_traces)),
            "traces": chain_traces,
            "note": note,
        })

    return chains
