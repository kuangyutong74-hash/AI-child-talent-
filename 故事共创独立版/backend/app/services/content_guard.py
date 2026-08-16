"""
Content safety guard for the story co-creation module.

Scans child input for violent, aggressive, or inappropriate language
and returns a friendly, age-appropriate notice.

All detection is keyword/rule-based (no LLM dependency) for instant response.
"""

import re
from dataclasses import dataclass

# ── Keyword dictionaries ──

# Heavy violence — needs strong redirection
HEAVY_KEYWORDS = {
    "杀死", "杀掉", "打死", "砍死", "炸死", "捅死", "枪毙",
    "自杀", "去死", "死掉", "掐死", "毒死", "烧死",
    "谋杀", "行凶", "凶手", "屠杀", "灭口",
}

ABUSIVE_KEYWORDS = {
    "操你", "草你", "艹你", "草泥马", "操你妈", "你妈死", "你妈妈死",
    "全家死", "死全家", "不得好死", "去你妈", "妈的", "傻逼", "煞笔",
    "沙比", "妈逼", "妈币", "狗东西", "王八蛋",
    "贱人", "废物", "垃圾东西", "滚蛋", "狗日的", "他妈的", "你大爷",
    "脑残", "白痴", "畜生", "婊子",
}

SEXUAL_KEYWORDS = {
    "色情", "做爱", "性交", "强奸", "裸照", "脱光", "摸胸", "下体",
    "鸡巴", "屌", "阴茎", "阴道", "约炮", "约啪", "约p", "打炮",
    "炮友", "嫖娼", "嫖妓", "卖淫", "黄片", "黄片", "AV片",
    "成人片", "黄色录像", "床上运动", "开房", "裸聊", "性骚扰", "猥亵",
}

EDGE_KEYWORDS = {
    "看看腿", "看腿", "露腿", "秀腿", "身材真好", "身材火辣",
    "身材", "大长腿", "性感身材", "胸大", "屁股大", "摸腿", "亲一口", "睡一起",
    "暧昧", "擦边",
}

HORROR_KEYWORDS = {
    "鬼怪", "厉鬼", "恶鬼", "僵尸吃人", "吃人", "剥皮", "肢解",
    "断头", "尸体", "血淋淋", "开膛", "挖眼",
}

# Regexes run on normalized text, so spaces/punctuation between characters
# cannot bypass detection. They cover common homophones and network variants.
ABUSIVE_PATTERNS = (
    re.compile(r"(?:你|他|她)(?:妈|麻|马)(?:逼|比|币|批)"),
    re.compile(r"妈(?:逼|币|批)"),
    re.compile(r"(?:mabi|nima|shabi)"),
    re.compile(r"(?:傻|煞|沙|啥)(?:逼|比|币|批)"),
    re.compile(r"(?:操|艹|草|槽)(?:你|尼)?(?:妈|麻|马)"),
    re.compile(r"(?:你|他|她)?妈(?:的|滴|得)"),
)

RAW_ABUSIVE_PATTERNS = (
    re.compile(r"妈[\s_\-—~～.*＊]+(?:逼|比|币|批)"),
    re.compile(r"傻[\s_\-—~～.*＊]+(?:逼|比|币|批)"),
)

SEXUAL_PATTERNS = (
    re.compile(r"约(?:炮|啪|p)"),
    re.compile(r"(?:打|找|当)(?:炮友|炮)"),
    re.compile(r"(?:裸|黄|色)(?:聊|片|图|照|情)"),
    re.compile(r"(?:做|发生)(?:爱|性关系)"),
    re.compile(r"(?:强奸|猥亵|性骚扰|开房|嫖娼|卖淫)"),
    re.compile(r"(?:yuepao|yuep|zuoai|seqing|luoliao|kaifang)"),
)

VIOLENCE_PATTERNS = (
    re.compile(r"(?:杀|砍|捅|掐|毒|烧|炸|枪毙)(?:死|掉|了)?"),
    re.compile(r"(?:血淋淋|尸体|肢解|剥皮|断头|挖眼|开膛)"),
    re.compile(r"(?:自杀|自残|跳楼|割腕)"),
)

PRIVACY_PATTERNS = (
    re.compile(r"(?<!\d)\d{7,11}(?!\d)"),
    re.compile(r"(?<!\d)\d{15,18}[Xx]?(?!\d)"),
    re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
    re.compile(r"\b\d{3,4}[- ]?\d{7,8}\b"),
    re.compile(r"\b\d{17}[\dXx]\b"),
    re.compile(r"(?:我叫|我的名字是|姓名是)[\u4e00-\u9fff·]{2,8}"),
    re.compile(r"(?:我在|我的学校是)[^，。！？\n]{2,30}(?:学校|小学|中学)"),
    re.compile(r"(?:我住在|家庭住址是|地址是)[^，。！？\n]{3,50}"),
    re.compile(r"(?:我是|我在)[一二三四五六七八九十\d]{1,3}年级"
               r"[\u4e00-\u9fff\d]{0,6}班"),
    re.compile(r"(?:我爸|我妈|家长)(?:叫|电话是|手机号是)[^，。！？\n]{2,30}"),
)

PRIVACY_KEYWORDS = {
    "家庭住址", "家里地址", "我的住址", "住址", "家住",
    "我的学校", "我的班级", "我的姓名", "妈妈电话", "爸爸电话", "家长电话",
    "手机号", "电话号码", "座机", "电话",
}

CIVIL_REMINDER = (
    "刚刚这句话不太文明哦，我们换成温柔好听的文字来讲故事吧，"
    "你可以重新说一说角色想说的话~"
)
INPUT_BLOCK_MESSAGE = (
    "这句话涉及隐私/不太合适，故事里不要填写个人住址、电话这类隐私信息，"
    "也不要写低俗内容，请重新编辑角色台词。"
)
EMPTY_AFTER_CLEAN_MESSAGE = "本次内容包含隐私或不合适内容，请修改后重新创作。"
PARENT_REMINDER = (
    "我们先暂停这一轮故事，请爸爸妈妈陪你一起想一句温柔、友善的话，"
    "准备好后再继续创作吧。"
)
PRIVACY_REMINDER = "不要在故事里填写个人真实信息，保护自己隐私。"

# Moderate violence — needs gentle reminder
MODERATE_KEYWORDS = {
    "杀", "死", "砍", "炸", "枪", "血", "刀", "剑",
    "鞭", "抽", "砸", "摔", "踹", "踢飞",
    "恐怖", "可怕", "魔鬼", "恶魔", "地狱",
}

# Mild — may be okay in context but worth noting
MILD_KEYWORDS = {
    "打", "骂", "揍", "踢", "推", "抢", "偷", "骗",
    "恨", "讨厌", "滚", "笨", "蠢", "傻",
}

# Phrases that are clearly NOT violent (to avoid false positives)
SAFE_PHRASES = {
    "打败怪兽", "打怪兽", "打坏人", "打败坏人",
    "打篮球", "打游戏", "打牌", "打水漂", "打雪仗",
    "打开", "打扫", "打电话", "打招呼", "打喷嚏",
    "打扰", "打算", "打印", "打折", "打针",
    "死党", "笑死", "乐死", "开心死", "高兴死",
    "热血", "血压", "血管", "鲜血", "血型",
    "骂人是不对的", "不能骂人",
}


# ── Engagement signals for child interaction exceptions ──

STUCK_KEYWORDS = {"不知道", "不会", "不知道写什么", "想不到", "没想好", "随便", "都行", "嗯", "哦", "好", "行", "可以", "还行"}
OFF_TOPIC_KEYWORDS = {"游戏", "手机", "零食", "作业", "考试", "分数", "老师批评", "同学欺负", "动画片", "玩具", "奥特曼", "王者荣耀", "吃鸡"}
WANT_TO_STOP_KEYWORDS = {"不想写了", "不想玩了", "好累", "累了", "没意思", "不好玩", "写不动", "不玩了", "结束吧", "算了吧", "不要了"}

@dataclass
class EngagementResult:
    issue_type: str   # "stuck" | "off_topic" | "want_to_stop" | "OK"
    prompt_hint: str  # Extra instruction to inject into the system prompt


def check_engagement(text: str) -> EngagementResult:
    """Detect if the child is stuck, off-topic, or wants to stop.

    Returns EngagementResult with hints for the story director.
    """
    if not text or not text.strip():
        return EngagementResult(issue_type="OK", prompt_hint="")

    normalized = text.strip()

    # 1. Want to stop?
    for kw in WANT_TO_STOP_KEYWORDS:
        if kw in normalized:
            return EngagementResult(
                issue_type="want_to_stop",
                prompt_hint="孩子表达了不想继续的情绪。请用温暖的方式回应：先共情,然后给故事一个简短而温暖的结局,使用ending事件收尾。不要追问。",
            )

    # 2. Stuck / can't think?
    word_count = len(normalized.replace(" ", ""))
    if word_count <= 3:
        return EngagementResult(
            issue_type="stuck",
            prompt_hint='孩子似乎卡住了，回答很短。请给出1-2个具体的续写方向供TA选择，鼓励TA大胆想。不要只说再想想。',
        )
    for kw in STUCK_KEYWORDS:
        if kw == normalized or (kw in normalized and word_count <= 5):
            return EngagementResult(
                issue_type="stuck",
                prompt_hint="孩子的回答很短或表示不知道。请给出2个具体有趣的续写建议让TA选，降低创作压力。先肯定TA之前的贡献再引导。",
            )

    # 3. Off-topic?
    for kw in OFF_TOPIC_KEYWORDS:
        if kw in normalized:
            return EngagementResult(
                issue_type="off_topic",
                prompt_hint='孩子聊到了和故事无关的话题。请用轻松幽默的方式把注意力拉回故事，在下一段叙事中自然地衔接回故事主线。',
            )

    return EngagementResult(issue_type="OK", prompt_hint="")


@dataclass
class SafetyResult:
    is_flagged: bool
    level: str          # "heavy" | "moderate" | "mild" | "safe"
    triggered_word: str
    kind_message: str   # Child-friendly reminder text


@dataclass
class InputGuardResult:
    blocked: bool
    sanitized_text: str
    has_privacy: bool
    category: str
    message: str


@dataclass
class CleanTextResult:
    cleaned_text: str
    removed_count: int
    has_privacy: bool
    has_prohibited: bool


def _normalized_for_detection(text: str) -> str:
    normalized = re.sub(r"[\s_\-—~～,.，。!！?？*＊]+", "", text.lower())
    return (
        normalized.replace("艹", "操")
        .replace("草", "操")
        .replace("槽", "操")
        .replace("尼玛", "你妈")
        .replace("泥马", "你妈")
        .replace("沙比", "傻逼")
        .replace("煞笔", "傻逼")
    )


def _contains_keyword(normalized_text: str, keywords: set[str]) -> bool:
    return any(_normalized_for_detection(word) in normalized_text for word in keywords)


def _matches_any(normalized_text: str, patterns: tuple[re.Pattern, ...]) -> bool:
    return any(pattern.search(normalized_text) for pattern in patterns)


def redact_privacy(text: str) -> tuple[str, bool]:
    sanitized = text
    found = False
    for pattern in PRIVACY_PATTERNS:
        sanitized, count = pattern.subn("[已隐藏的个人信息]", sanitized)
        found = found or count > 0
    if any(keyword in text for keyword in PRIVACY_KEYWORDS):
        found = True
    return sanitized, found


def contains_prohibited_content(text: str) -> bool:
    detection_text = text
    for safe_phrase in SAFE_PHRASES:
        detection_text = detection_text.replace(safe_phrase, " ")
    normalized = _normalized_for_detection(detection_text)
    return _matches_any(text, RAW_ABUSIVE_PATTERNS) or _contains_keyword(
        normalized,
        ABUSIVE_KEYWORDS
        | SEXUAL_KEYWORDS
            | HORROR_KEYWORDS
            | EDGE_KEYWORDS
        | HEAVY_KEYWORDS
        | MODERATE_KEYWORDS,
    ) or any(
        _matches_any(normalized, patterns)
        for patterns in (ABUSIVE_PATTERNS, SEXUAL_PATTERNS, VIOLENCE_PATTERNS)
    )


def guard_child_input(text: str) -> InputGuardResult:
    """Block unsafe language before persistence; redact privacy before use."""
    sanitized, has_privacy = redact_privacy(text.strip())
    if has_privacy:
        return InputGuardResult(
            blocked=True,
            sanitized_text="",
            has_privacy=True,
            category="privacy",
            message=INPUT_BLOCK_MESSAGE,
        )
    detection_text = sanitized
    for safe_phrase in SAFE_PHRASES:
        detection_text = detection_text.replace(safe_phrase, " ")
    normalized = _normalized_for_detection(detection_text)
    categories = (
        ("abuse", ABUSIVE_KEYWORDS, ABUSIVE_PATTERNS),
        ("sexual", SEXUAL_KEYWORDS | EDGE_KEYWORDS, SEXUAL_PATTERNS),
        ("horror", HORROR_KEYWORDS, ()),
        ("violence", HEAVY_KEYWORDS | MODERATE_KEYWORDS, VIOLENCE_PATTERNS),
    )
    for category, keywords, patterns in categories:
        raw_match = category == "abuse" and _matches_any(
            sanitized, RAW_ABUSIVE_PATTERNS
        )
        if (
            raw_match
            or _contains_keyword(normalized, keywords)
            or _matches_any(normalized, patterns)
        ):
            return InputGuardResult(
                blocked=True,
                sanitized_text="",
                has_privacy=has_privacy,
                category=category,
                message=INPUT_BLOCK_MESSAGE,
            )
    return InputGuardResult(
        blocked=False,
        sanitized_text=sanitized,
        has_privacy=has_privacy,
        category="privacy" if has_privacy else "safe",
        message=PRIVACY_REMINDER if has_privacy else "",
    )


def clean_submitted_text(text: str) -> CleanTextResult:
    """Delete complete unsafe/privacy sentences before storage and scoring."""
    sentences = [
        part.strip()
        for part in re.split(r"(?<=[。！？!?；;])|\n+", text)
        if part.strip()
    ]
    safe_sentences = []
    removed_count = 0
    has_privacy = False
    has_prohibited = False
    for sentence in sentences:
        _, sentence_has_privacy = redact_privacy(sentence)
        sentence_has_prohibited = contains_prohibited_content(sentence)
        if sentence_has_privacy or sentence_has_prohibited:
            removed_count += 1
            has_privacy = has_privacy or sentence_has_privacy
            has_prohibited = has_prohibited or sentence_has_prohibited
            continue
        safe_sentences.append(sentence)
    return CleanTextResult(
        cleaned_text="".join(safe_sentences).strip(),
        removed_count=removed_count,
        has_privacy=has_privacy,
        has_prohibited=has_prohibited,
    )


def sanitize_agent_output(text: str) -> str:
    """Keep child-visible model output age-appropriate without redacting fiction.

    Privacy redaction belongs to child-supplied input. Names, addresses and number-like
    details created by the story director are fictional story content and must remain.
    """
    sanitized = text
    replacements = {
        "死亡": "远行", "死去": "去远方生活", "死了": "沉沉睡去",
        "杀死": "安全地拦住", "杀掉": "温和地制止", "打死": "劝它停下来",
        "重伤": "需要好好休息", "鲜血": "红色颜料", "尸体": "沉睡的身影",
        "报复": "好好沟通", "复仇": "寻找和解", "鬼怪": "神秘的小伙伴",
        "恐怖": "神秘", "恶魔": "淘气的角色", "枪": "工具",
        "刀": "小工具", "血": "红色颜料", "死": "睡",
    }
    for unsafe, gentle in replacements.items():
        sanitized = sanitized.replace(unsafe, gentle)
    for word in ABUSIVE_KEYWORDS | SEXUAL_KEYWORDS | HORROR_KEYWORDS:
        sanitized = sanitized.replace(word, "")
    return sanitized.strip()


def check_content(text: str) -> SafetyResult:
    """Scan child input for violent/inappropriate content.

    Returns SafetyResult with a child-friendly message if flagged.
    """
    if not text or not text.strip():
        return SafetyResult(
            is_flagged=False, level="safe", triggered_word="",
            kind_message="",
        )

    # Normalize
    normalized = text.strip()

    # Check safe phrases first (avoid false positives)
    for safe in SAFE_PHRASES:
        if safe in normalized:
            # Remove the safe part before checking
            normalized = normalized.replace(safe, " ")

    # ── Heavy check ──
    for word in HEAVY_KEYWORDS:
        if word in normalized:
            return SafetyResult(
                is_flagged=True,
                level="heavy",
                triggered_word=word,
                kind_message=(
                    "🤗 故事导演注意到你用到了一些不太友好的词语。"
                    "在我们的故事里，我们可以用更温暖的方式解决问题哦！"
                    "比如：用智慧说服、用友谊感化、用团队合作——这些比暴力更有力量呢！"
                ),
            )

    # ── Moderate check ──
    for word in MODERATE_KEYWORDS:
        if word in normalized:
            return SafetyResult(
                is_flagged=True,
                level="moderate",
                triggered_word=word,
                kind_message=(
                    "💛 故事导演想提醒你：在故事中，角色之间的冲突可以有很多积极的解决方式。"
                    "试着想一想：除了对抗，还能用什么方法来化解矛盾呢？"
                ),
            )

    # ── Mild check ──
    for word in MILD_KEYWORDS:
        if word in normalized:
            return SafetyResult(
                is_flagged=True,
                level="mild",
                triggered_word=word,
                kind_message=(
                    "📖 每一个精彩的故事都充满了友善和智慧。"
                    "让我们用更积极的语言来讲述故事吧！"
                ),
            )

    return SafetyResult(
        is_flagged=False, level="safe", triggered_word="", kind_message="",
    )
