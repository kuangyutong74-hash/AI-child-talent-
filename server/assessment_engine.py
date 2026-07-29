"""
🐬 蔚蓝深海基地 · 多维潜能评估引擎
基于加德纳多元智能理论 + 维果茨基社会文化理论 + 埃里克森社会心理阶段
+ 托马斯-切斯气质九维度 + CHEXI儿童执行功能量表

用法:
    from assessment_engine import generate_report
    report = generate_report(all_metrics, level3_dialogue)

返回完整报告结构，分数由公式计算，分析文本由DeepSeek AI生成（降级为模板）
"""

import json
import os
import math
import random
from typing import Optional

# ══════════════════════════════════════════════════════════════════
#  核心算分函数
# ══════════════════════════════════════════════════════════════════

def calc_spatial_visual(metrics: dict) -> float:
    """
    第一关·空间视觉智能
    公式: 基础分 = (合规项总数 / 总判定项) × 7
          修正分 = 3 - (调整重构次数 × 0.3)
          最终得分 = clamp(基础分 + 修正分, 0, 10)
    """
    pair_details = metrics.get("pair_details", [])
    check_history = metrics.get("check_history", [])

    # ── 计算重构次数 ──
    # 重构次数 = 放置调整 + 移除重新放置
    removal_count = metrics.get("removal_count", 0)
    drag_count = metrics.get("block_drag_count", 0)
    # 最少需要8次拖拽（4对配对 × 2个生物），超出部分算重构
    adjust_count = max(0, drag_count - 8) + removal_count

    # ── 合规判定 ──
    # 4组配对各自的合规情况
    compliance_items = []

    for pair in pair_details:
        pid = pair.get("id", "")
        done = pair.get("done", False)

        # 如果配对正确完成，视为合规
        # 距离合规: 用检查历史判断
        # 对于Level1，我们从check_history看第一轮就成功的配对数
        compliance_items.append(done)

    # 从check_history获取更细粒度的信息
    # 第一次检查时已经正确的配对数（一次成功率）
    first_check_done = 0
    total_checks = len(check_history)

    if check_history:
        first = check_history[0]
        for p in first.get("pairs", []):
            if p.get("done"):
                first_check_done += 1

    total_judgments = max(len(pair_details), 4)
    compliant = sum(1 for c in compliance_items if c)

    base_score = (compliant / total_judgments) * 7.0

    # 修正分
    correction = 3.0 - (adjust_count * 0.3)
    correction = max(-2, min(3, correction))

    final = base_score + correction
    return round(max(0, min(10, final)), 1)


def calc_natural_observation(metrics: dict) -> float:
    """
    第一关·自然观察智能
    公式: 最终得分 = 配对成功率 × 10
    微调: 自主快速修正 +0.3~1分；多次重复错误 -0.3~1分
    """
    pair_details = metrics.get("pair_details", [])
    check_history = metrics.get("check_history", [])
    check_attempts = metrics.get("check_attempts", 0)

    if not pair_details:
        return 5.0

    total_pairs = len(pair_details)
    successful = sum(1 for p in pair_details if p.get("done"))

    success_rate = successful / max(total_pairs, 1)
    base = success_rate * 10.0

    # ── 微调 ──
    bonus = 0.0

    # 从检查历史判断自主修正速度
    if len(check_history) >= 2:
        # 快速修正：第一次检查成功数 < 总数，但第二次就全对了
        first_fail = sum(1 for p in check_history[0].get("pairs", []) if not p.get("done"))
        for ch in check_history[1:]:
            remaining = sum(1 for p in ch.get("pairs", []) if not p.get("done"))
            if remaining == 0 and first_fail > 0:
                # 一次修正就全对
                bonus += 0.8
                break
            elif remaining < first_fail:
                bonus += 0.3
                break

    # 多次重复错误扣分
    if check_attempts > 3 and successful < total_pairs:
        bonus -= min(1.0, (check_attempts - 3) * 0.2)

    # 如果一次检查就全对，额外加分
    if check_attempts <= 1 and successful == total_pairs:
        bonus += 0.5

    final = base + bonus
    return round(max(0, min(10, final)), 1)


def calc_logical_mathematical(metrics: dict) -> float:
    """
    第二关·逻辑数理智能
    得分 = 最优路径契合度(60%) + 障碍规避正确率(40%) × 10

    最优路径: 曼哈顿距离最短路径（起点到终点最少管道数）
    障碍规避: 正确放置在非障碍格子的管道比例
    """
    pipe_count = metrics.get("pipe_count", 0)
    rotate_count = metrics.get("rotate_count", 0)
    grid_rows = metrics.get("grid_rows", 8)
    grid_cols = metrics.get("grid_cols", 10)
    is_connected = metrics.get("successful_pairs", 0)

    optimal_path = grid_rows + grid_cols - 2  # 曼哈顿最短路径

    # 至少要用optimal_path根管道才能连通
    if pipe_count == 0:
        return 1.0

    # 最优路径契合度: 越接近最优路径越好
    # 用了optimal_path根管道 = 100%，多一根扣一些
    path_deviation = max(0, pipe_count - optimal_path)
    if path_deviation == 0:
        path_fit = 1.0
    elif pipe_count >= optimal_path * 2:
        path_fit = max(0.1, 1.0 - path_deviation / (optimal_path * 1.5))
    else:
        path_fit = max(0.2, 1.0 - (path_deviation / optimal_path) * 0.5)

    # 障碍规避: 如果连通了，说明基本正确
    # 旋转次数多说明可能规避有问题
    obstacle_avoidance = 0.8 if is_connected else 0.3

    # 旋转扣分: 每次无效旋转降低准确性
    valid_rotations = max(0, rotate_count - pipe_count)  # 超过管道数的旋转可能无效
    rotation_penalty = min(0.3, valid_rotations * 0.05)
    obstacle_avoidance = max(0.1, obstacle_avoidance - rotation_penalty)

    score = (path_fit * 0.6 + obstacle_avoidance * 0.4) * 10.0
    return round(max(0, min(10, score)), 1)


def calc_higher_spatial(metrics: dict) -> float:
    """
    第二关·高阶空间智能
    得分 = 10 - (无效旋转扣分 + 卡顿时间扣分)
    """
    pipe_count = metrics.get("pipe_count", 0)
    rotate_count = metrics.get("rotate_count", 0)
    grid_rows = metrics.get("grid_rows", 8)
    grid_cols = metrics.get("grid_cols", 10)
    is_connected = metrics.get("successful_pairs", 0)

    optimal_path = grid_rows + grid_cols - 2

    # 无效旋转: 超过管道数1.5倍的旋转，或远多于最优路径的旋转
    expected_rotations = optimal_path * 0.5  # 一半的管道需要旋转
    invalid_rotations = max(0, rotate_count - expected_rotations * 2)

    rotation_deduction = min(4, invalid_rotations * 0.5)

    # 卡顿扣分: 管道放置远多于最优路径表示有很多尝试/卡顿
    pipe_overhead = max(0, pipe_count - optimal_path)
    stuck_deduction = min(3, pipe_overhead * 0.3)

    # 如果是连通的，加分
    connection_bonus = 1.0 if is_connected else 0.0

    score = 10.0 - rotation_deduction - stuck_deduction + connection_bonus
    return round(max(0, min(10, score)), 1)


def calc_interpersonal(metrics: dict) -> float:
    """
    第三关·人际社交智能
    新版得分 = 情绪与证据(35%) + 立场/需求区分(25%)
             + 方案质量(25%) + 和解进度(15%) × 10
    对旧版数据保持兼容。
    """
    emotion_correct = metrics.get("emotion_correct", 0)  # 0, 1, 或 2
    harmony_final = metrics.get("harmony_final", 0)
    emotion_rate = emotion_correct / 2.0
    harmony_rate = harmony_final / 100.0

    if any(key in metrics for key in ("evidence_correct", "needs_correct", "solution_quality")):
        evidence_rate = metrics.get("evidence_correct", 0) / 2.0
        needs_rate = metrics.get("needs_correct", 0) / 4.0
        strategy_rate = metrics.get("solution_quality", 0) / 3.0
        reading_rate = (emotion_rate + evidence_rate) / 2.0
        score = (
            reading_rate * 0.35
            + needs_rate * 0.25
            + strategy_rate * 0.25
            + harmony_rate * 0.15
        ) * 10.0
    else:
        card_selected = metrics.get("card_selected", "")
        fair_cards = ["time", "space"]
        strategy_rate = 1.0 if card_selected in fair_cards else 0.0
        score = (emotion_rate * 0.5 + strategy_rate * 0.3 + harmony_rate * 0.2) * 10.0

    return round(max(0, min(10, score)), 1)


def calc_linguistic(metrics: dict, dialogue: list = None) -> float:
    """
    第三关·语言智能
    得分 = LLM情感正向分(60%) + 语言完整度(40%) × 10
    """
    # 从对话中分析
    if not dialogue:
        harmony_final = metrics.get("harmony_final", 0)
        return round(max(1, min(10, harmony_final / 10)), 1)

    # 提取所有玩家发言
    player_messages = [m.get("text", "") for m in dialogue if m.get("role") == "player"]

    if not player_messages:
        harmony = metrics.get("harmony_final", 0)
        return round(max(1, min(10, harmony / 10)), 1)

    # 分析情感正向度
    positive_words = ["对不起", "抱歉", "理解", "明白", "别难过", "别生气",
                      "安慰", "抱抱", "加油", "没关系", "分享", "轮流",
                      "和好", "商量", "公平", "朋友", "一起", "开心",
                      "喜欢", "团结", "合作", "包容", "体谅", "互相",
                      "帮助", "支持", "鼓励", "温柔", "冷静"]

    negative_words = ["不要", "不行", "讨厌", "烦", "滚", "走开",
                      "闭嘴", "打你", "笨蛋", "傻瓜", "自私",
                      "不公平", "凭什么", "偏不", "偏心"]

    total_pos = 0
    total_neg = 0
    total_chars = 0

    for msg in player_messages:
        total_chars += len(msg)
        for w in positive_words:
            if w in msg:
                total_pos += 1
        for w in negative_words:
            if w in msg:
                total_neg += 1

    if total_pos + total_neg == 0:
        sentiment_score = 0.5
    else:
        sentiment_score = total_pos / max(total_pos + total_neg, 1)

    # 语言完整度: 基于平均消息长度和质量
    if not player_messages:
        completeness = 0.3
    else:
        avg_len = sum(len(m) for m in player_messages) / len(player_messages)
        if avg_len >= 15:
            completeness = 1.0
        elif avg_len >= 10:
            completeness = 0.8
        elif avg_len >= 5:
            completeness = 0.6
        else:
            completeness = 0.3

    score = (sentiment_score * 0.6 + completeness * 0.4) * 10.0
    return round(max(0, min(10, score)), 1)


# ══════════════════════════════════════════════════════════════════
#  CHEXI 执行功能专项打分
# ══════════════════════════════════════════════════════════════════

def calc_chexi(all_metrics: dict) -> dict:
    """
    CHEXI执行功能 5个维度
    基于全关卡行为数据汇总打分
    """
    l1 = all_metrics.get("level1", {})
    l2 = all_metrics.get("level2", {})
    l3 = all_metrics.get("level3", {})

    # ── 1. 任务坚持力（无奖励自主坚持） ──
    # 完成所有关卡 = 高坚持
    l1_done = l1.get("successful_pairs", 0)
    l2_done = l2.get("successful_pairs", 0)
    l3_harmony = l3.get("harmony_final", 0)

    completion_score = (l1_done / 4.0) * 0.4 + (1.0 if l2_done else 0) * 0.3 + (l3_harmony / 100.0) * 0.3
    task_persistence = round(completion_score * 10, 1)

    # ── 2. 思维发散与变通力 ──
    # 卡点后是否换了思路（从检查次数和旋转次数判断）
    check_attempts = l1.get("check_attempts", 0)
    rotate_count = l2.get("rotate_count", 0)

    # 适当的检查和旋转说明在尝试不同方法
    if check_attempts <= 1 and l1_done >= 4:
        flexibility = 9.0  # 一次就过说明规划好
    elif check_attempts <= 3 and l1_done >= 4:
        flexibility = 8.0
    elif rotate_count >= l2.get("pipe_count", 0) * 0.5:
        flexibility = 7.0  # 通过旋转尝试不同方案
    elif check_attempts > 5:
        flexibility = 5.0  # 反复检查但可能方法单一
    else:
        flexibility = 6.0

    # ── 3. 抗分心执行能力 ──
    # 评估操作中的分心程度
    drag_count = l1.get("block_drag_count", 0)
    removal_count = l1.get("removal_count", 0)

    if removal_count == 0 and drag_count <= 10:
        anti_distract = 9.0
    elif removal_count <= 2:
        anti_distract = 7.0
    elif removal_count <= 4:
        anti_distract = 5.0
    else:
        anti_distract = 3.0

    # ── 4. 多步骤任务统筹力 ──
    # 第三关完成情况 + 整体通关顺畅度
    rounds_used = l3.get("rounds_used", 0)
    multi_step = 5.0
    if rounds_used >= 3:
        multi_step = 8.0  # 完成全部3轮对话
    elif rounds_used >= 2:
        multi_step = 6.0
    else:
        multi_step = 4.0

    # ── 5. 经验学习预判力 ──
    # 从check_history看学习速度
    check_history = l1.get("check_history", [])
    if len(check_history) <= 1:
        learn_predict = 8.0  # 一次到位
    elif len(check_history) <= 2:
        first_fail = sum(1 for p in check_history[0].get("pairs", []) if not p.get("done"))
        if first_fail <= 2:
            learn_predict = 7.0
        else:
            learn_predict = 6.0
    else:
        learn_predict = 4.0

    return {
        "task_persistence": max(1, min(10, task_persistence)),
        "flexibility": max(1, min(10, flexibility)),
        "anti_distraction": max(1, min(10, anti_distract)),
        "multi_step_planning": max(1, min(10, multi_step)),
        "experience_learning": max(1, min(10, learn_predict)),
    }


# ══════════════════════════════════════════════════════════════════
#  埃里克森人格品质打分
# ══════════════════════════════════════════════════════════════════

def calc_erikson(all_metrics: dict) -> dict:
    """埃里克森6-12岁人格品质"""
    l1 = all_metrics.get("level1", {})
    l3 = all_metrics.get("level3", {})

    # ── 勤勉感 ──
    # 高坚持、高主动 = 高分
    l1_done = l1.get("successful_pairs", 0)
    l3_harmony = l3.get("harmony_final", 0)

    diligence = ((l1_done / 4.0) * 0.5 + (l3_harmony / 100.0) * 0.5) * 10.0
    diligence = max(1, min(10, diligence))

    # ── 自信心与成就动机 ──
    # 快速修正 + 勇敢尝试
    removal_count = l1.get("removal_count", 0)
    check_attempts = l1.get("check_attempts", 0)

    confidence = 5.0
    if l1_done >= 4:
        confidence += 2.0  # 完成所有配对
    if removal_count <= 2:
        confidence += 1.0  # 很少需要删除操作
    if l3_harmony >= 80:
        confidence += 1.5  # 高和解度
    elif l3_harmony >= 50:
        confidence += 0.5

    return {
        "diligence": round(diligence, 1),
        "confidence": round(max(1, min(10, confidence)), 1),
    }


# ══════════════════════════════════════════════════════════════════
#  托马斯-切斯先天气质画像
# ══════════════════════════════════════════════════════════════════

def calc_temperament(all_metrics: dict) -> dict:
    """基于游戏行为生成先天气质画像标签"""
    l1 = all_metrics.get("level1", {})
    l2 = all_metrics.get("level2", {})
    l3 = all_metrics.get("level3", {})

    drag_count = l1.get("block_drag_count", 0)
    removal_count = l1.get("removal_count", 0)
    check_attempts = l1.get("check_attempts", 0)
    pipe_count = l2.get("pipe_count", 0)
    rotate_count = l2.get("rotate_count", 0)
    harmony = l3.get("harmony_final", 0)

    # ── 活动水平 ──
    # 操作总量反映活动水平
    total_actions = drag_count + pipe_count + rotate_count
    if total_actions < 20:
        activity = "偏低（安静沉稳）"
    elif total_actions < 40:
        activity = "适中（动静结合）"
    else:
        activity = "偏高（活跃好动）"

    # ── 趋避性（对新事物趋向/回避） ──
    if check_attempts <= 1 and pipe_count > 0:
        approach = "趋向（大胆尝试）"
    elif check_attempts >= 4:
        approach = "偏回避（谨慎试探）"
    else:
        approach = "平衡（稳步推进）"

    # ── 适应性 ──
    if removal_count <= 1 and check_attempts <= 2:
        adaptability = "强（快速适应）"
    elif removal_count <= 3 and check_attempts <= 4:
        adaptability = "中等（逐步适应）"
    else:
        adaptability = "弱（需要更多时间适应）"

    # ── 反应强度 ──
    if removal_count >= 3 or rotate_count >= pipe_count:
        intensity = "强（反应激烈）"
    else:
        intensity = "温和（反应平和）"

    # ── 坚持性 ──
    if l1.get("successful_pairs", 0) >= 4:
        persistence = "高（坚持到底）"
    elif check_attempts >= 3:
        persistence = "中等（需要鼓励）"
    else:
        persistence = "一般"

    # ── 心境质量 ──
    if harmony >= 80:
        mood = "积极乐观"
    elif harmony >= 50:
        mood = "平和稳定"
    else:
        mood = "偏谨慎"

    # 综合性格标签
    if activity == "偏高（活跃好动）" and approach == "趋向（大胆尝试）":
        label = "灵动探索型"
        desc = "你充满活力，喜欢尝试新事物，动手能力强，勇于探索未知的海洋世界！"
    elif persistence == "高（坚持到底）" and adaptability == "强（快速适应）":
        label = "专注坚持型"
        desc = "你有很强的专注力和毅力，遇到困难不轻易放弃，而且能快速适应新环境！"
    elif approach == "偏回避（谨慎试探）" and intensity == "温和（反应平和）":
        label = "谨慎思考型"
        desc = "你习惯先观察再行动，思考周密，做事沉稳，是一个可靠的小小观察家！"
    elif mood == "积极乐观" and activity == "适中（动静结合）":
        label = "阳光社交型"
        desc = "你性格开朗，乐于助人，善于与人沟通合作，是团队里的小太阳！"
    else:
        label = "沉稳细致型"
        desc = "你做事细心认真，有耐心，专注力好，能够静下心来完成每一项任务！"

    return {
        "label": label,
        "desc": desc,
        "dimensions": {
            "活动水平": activity,
            "趋避性": approach,
            "适应性": adaptability,
            "反应强度": intensity,
            "坚持性": persistence,
            "心境质量": mood,
        }
    }


# ══════════════════════════════════════════════════════════════════
#  AI 文本生成（DeepSeek API）
# ══════════════════════════════════════════════════════════════════

# 尝试导入 AI 客户端
ai_client = None
ai_model = "deepseek-chat"
ai_enabled = False

def _init_ai():
    """初始化 DeepSeek AI 客户端"""
    global ai_client, ai_model, ai_enabled
    if ai_client is not None:
        return

    try:
        from openai import OpenAI

        # 读取 .env
        current_dir = os.path.dirname(os.path.abspath(__file__))
        env_path = os.path.join(current_dir, ".env")
        api_key = ""
        api_base = "https://api.deepseek.com/v1"

        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DEEPSEEK_API_KEY="):
                        api_key = line.split("=", 1)[1].strip()
                    elif line.startswith("DEEPSEEK_MODEL="):
                        ai_model = line.split("=", 1)[1].strip()

        if api_key and len(api_key) > 10:
            ai_client = OpenAI(api_key=api_key, base_url=api_base)
            ai_enabled = True
    except Exception:
        ai_enabled = False


def ai_generate(prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> Optional[str]:
    """调用 DeepSeek 生成文本"""
    _init_ai()
    if not ai_enabled or not ai_client:
        return None

    try:
        resp = ai_client.chat.completions.create(
            model=ai_model,
            messages=[
                {"role": "system", "content": "你是一位儿童发展心理学专家和海洋科普老师。你擅长根据游戏行为数据，为6-12岁儿童生成生动的潜能发展分析。使用温暖、鼓励、具体的语言，避免空洞评价。回复控制在100-200字。"},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        text = resp.choices[0].message.content.strip()
        return text
    except Exception as e:
        print(f"[AI Generate Error] {e}")
        return None


# ══════════════════════════════════════════════════════════════════
#  报告分析模板（降级用）
# ══════════════════════════════════════════════════════════════════

ANALYSIS_TEMPLATES = {
    "spatial": {
        "high": "你在空间布局方面展现了出色的能力！能够精准地将生物放在合适的位置，对距离、区域和层级关系有很好的感知力。这种空间智能在未来的几何学习、绘画、积木搭建中都会发挥重要作用。继续保持你的空间探索精神！🎯",
        "medium": "你具备基本的空间感知能力，能够完成大部分空间布局任务。如果在平时多玩一些拼图、积木、迷宫类的游戏，你的空间智能会发展得更好哦！加油！🧩",
        "low": "空间感知是我们通过练习可以不断提升的能力。建议多尝试立体拼图、绘画、搭积木等活动，慢慢培养对位置、距离的感觉。每一次尝试都是在进步！🌟",
    },
    "naturalist": {
        "high": "你对海洋生物的习性有非常敏锐的观察力！能够准确理解不同生物的共生关系和生存需求，这说明你有一双善于发现的眼睛。这种自然观察能力让你成为一个优秀的自然探索者！🌿",
        "medium": "你对自然生态有基础的认识，能够理解大部分生物之间的关系。多接触大自然、阅读科普绘本，你的自然观察能力一定会越来越强！🦋",
        "low": "每个人都可以成为自然观察家！建议多去动物园、水族馆观察动物们的生活习性，或者在家养一盆植物、一条小鱼，慢慢地你就会发现大自然的奇妙之处！🌺",
    },
    "logical": {
        "high": "你的逻辑推理能力非常出色！能够规划最优路径，巧妙地避开障碍物，这说明你具备优秀的策略思维。这种能力在数学、编程、科学探索中都非常重要！继续加油，小小逻辑家！🧮",
        "medium": "你展现了一定的逻辑规划能力，能够在尝试中找到解决问题的路径。多玩一些策略类桌游（如象棋、围棋），你的逻辑思维会越来越敏捷！🎲",
        "low": "逻辑思维就像肌肉一样需要不断锻炼。建议从简单的迷宫游戏开始，慢慢培养规划路线的感觉。不要怕犯错，每一次错误都是学习的机会！💪",
    },
    "interpersonal": {
        "high": "你拥有出色的人际交往能力！能够准确理解他人的情绪，并提出让大家都能接受的解决方案。这种共情能力和调解技巧是非常珍贵的社会技能，你是一个天生的和平使者！🤝",
        "medium": "你具备基本的社交意识，愿意通过沟通解决问题。试着在日常生活中多表达自己的感受，也多听听小伙伴的想法，你的人际交往能力会越来越强！💬",
        "low": "理解和表达情绪是需要慢慢学习的技能。建议通过角色扮演游戏、绘本故事来认识不同的情绪，学会站在他人的角度思考问题。每一步都是成长！🌱",
    },
    "linguistic": {
        "high": "你的语言表达能力非常出色！能够用清晰、完整的句子表达自己的想法，并且善于使用温暖的语言来安慰和鼓励他人。这种语言天赋在阅读、写作和沟通中都是极大的优势！📚",
        "medium": "你有一定的语言表达能力，能够传达基本的意思。多阅读有趣的故事书，和爸爸妈妈分享你今天经历的事情，你的语言会越来越丰富！🎈",
        "low": "每一个作家都是从讲故事开始的。建议每天坚持阅读10分钟，然后试着用自己的话把故事讲给别人听。慢慢地，你会发现自己的表达越来越棒！✨",
    },
}


def _get_level_text(score: float) -> str:
    if score >= 8.5:
        return "high"
    elif score >= 5.5:
        return "medium"
    else:
        return "low"


def _template_analysis(dimension: str, score: float) -> str:
    level = _get_level_text(score)
    return ANALYSIS_TEMPLATES.get(dimension, {}).get(level, "继续加油！🌟")


# ══════════════════════════════════════════════════════════════════
#  主报告生成入口
# ══════════════════════════════════════════════════════════════════

def generate_report(all_metrics: dict, level3_dialogue: list = None) -> dict:
    """
    生成完整潜能分析报告

    参数:
        all_metrics: {
            "level1": { ... raw_metrics },
            "level2": { ... raw_metrics },
            "level3": { ... raw_metrics },
        }
        level3_dialogue: [
            { "role": "player"|"keke"|"caicai"|"momo", "text": "..." },
            ...
        ]

    返回:
        完整报告字典
    """
    l1 = all_metrics.get("level1", {})
    l2 = all_metrics.get("level2", {})
    l3 = all_metrics.get("level3", {})

    # ══ [修复 v3] 全跳关检测：所有关卡无操作数据 → 返回特殊报告 ══
    l1_has_data = l1.get("total_operations", 0) > 0 or l1.get("block_drag_count", 0) > 0
    l2_has_data = l2.get("total_operations", 0) > 0 or l2.get("pipe_count", 0) > 0
    l3_has_data = l3.get("rounds_used", 0) > 0 or l3.get("harmony_final", 0) > 0
    if not l1_has_data and not l2_has_data and not l3_has_data:
        return {
            "dimension_scores": {
                "空间视觉智能": 1.0,
                "自然观察智能": 1.0,
                "逻辑数理智能": 1.0,
                "人际社交智能": 1.0,
                "语言表达智能": 1.0,
                "专注力与执行能力": 1.0,
            },
            "dimension_analysis": {
                "空间视觉智能": "本次评估未产生游戏操作数据，无法对空间视觉能力进行有效评估。建议在实际参与游戏关卡后重新评估。",
                "自然观察智能": "本次评估未产生游戏操作数据，无法对自然观察能力进行有效评估。建议在实际参与游戏关卡后重新评估。",
                "逻辑数理智能": "本次评估未产生游戏操作数据，无法对逻辑数理能力进行有效评估。建议在实际参与游戏关卡后重新评估。",
                "人际社交智能": "本次评估未产生游戏操作数据，无法对人际社交能力进行有效评估。建议在实际参与游戏关卡后重新评估。",
                "语言表达智能": "本次评估未产生游戏操作数据，无法对语言表达能力进行有效评估。建议在实际参与游戏关卡后重新评估。",
            },
            "chexi": {
                "task_persistence": 1.0,
                "flexibility": 1.0,
                "anti_distraction": 1.0,
                "multi_step_planning": 1.0,
                "experience_learning": 1.0,
            },
            "erikson": {
                "diligence": 1.0,
                "confidence": 1.0,
            },
            "temperament": {
                "label": "未完成评估",
                "desc": "本次游戏中所有关卡均被跳过，未产生足够的操作数据用于评估先天气质。建议在完成实际关卡后重新生成报告。",
                "dimensions": {
                    "活动水平": "—",
                    "趋避性": "—",
                    "适应性": "—",
                    "反应强度": "—",
                    "坚持性": "—",
                    "心境质量": "—",
                },
            },
            "top3_strengths": [],
            "weaknesses": ["空间视觉智能", "自然观察智能", "逻辑数理智能", "人际社交智能", "语言表达智能", "专注力与执行能力"],
            "strength_summary": "本次评估中所有关卡均被跳过，未能采集到足够的游戏行为数据用于识别天赋优势。",
            "weakness_analysis": "由于未实际参与游戏关卡，各维度能力均缺乏评估数据，建议鼓励孩子完成游戏后重新评估。",
            "cognitive_traits": "暂无认知与执行功能评估数据。请在完成实际关卡后重新生成报告。",
            "dialogue_analysis": "",
            "suggestions": "⚠️ 本次游戏所有关卡均被跳过，无法基于实际行为数据提供个性化建议。\n建议鼓励孩子从第一关开始完成游戏后重新生成报告，以获得基于实际游戏行为的准确评估。",
        }

    # ── 计算核心维度分数 ──
    spatial = calc_spatial_visual(l1)
    naturalist = calc_natural_observation(l1)
    logical = calc_logical_mathematical(l2)
    higher_spatial = calc_higher_spatial(l2)
    interpersonal = calc_interpersonal(l3)
    linguistic = calc_linguistic(l3, level3_dialogue)

    # ── 空间视觉智能取两关均值 ──
    spatial_final = round((spatial + higher_spatial) / 2, 1)

    dimension_scores = {
        "空间视觉智能": spatial_final,
        "自然观察智能": naturalist,
        "逻辑数理智能": logical,
        "人际社交智能": interpersonal,
        "语言表达智能": linguistic,
        "专注力与执行能力": 0,  # 后面从CHEXI计算
    }

    # ── CHEXI 执行功能 ──
    chexi = calc_chexi(all_metrics)
    chexi_avg = round(sum(chexi.values()) / len(chexi), 1)
    dimension_scores["专注力与执行能力"] = chexi_avg

    # ── 埃里克森人格品质 ──
    erikson = calc_erikson(all_metrics)

    # ── 先天气质 ──
    temperament = calc_temperament(all_metrics)

    # ── 排序得到前三和后三 ──
    sorted_dims = sorted(dimension_scores.items(), key=lambda x: x[1], reverse=True)
    top3 = sorted_dims[:3]
    bottom = [d for d in sorted_dims if d[1] < 5.5]

    # ── 生成AI分析文本 ──
    # 尝试调用AI，失败则用模板

    # 构造AI prompt
    ai_context = f"""
游戏行为摘要:
- 第一关(珊瑚公寓): 拖拽{l1.get('block_drag_count',0)}次, 移除{l1.get('removal_count',0)}次, 检查{l1.get('check_attempts',0)}次, 成功配对{l1.get('successful_pairs',0)}/4组
- 第二关(洋流电网): 铺设{l2.get('pipe_count',0)}根管道, 旋转{l2.get('rotate_count',0)}次, 连通状态:{'已连通' if l2.get('successful_pairs',0) else '未连通'}
- 第三关(海洋议事厅): 和解度{l3.get('harmony_final',0)}%, 情绪识别{l3.get('emotion_correct',0)}/2正确, 文字证据{l3.get('evidence_correct',0)}/2正确, 需求区分{l3.get('needs_correct',0)}/4正确, 方案质量{l3.get('solution_quality',0)}/3, 使用{l3.get('rounds_used',0)}轮

五大智能得分:
- 空间视觉智能: {spatial_final}/10
- 自然观察智能: {naturalist}/10
- 逻辑数理智能: {logical}/10
- 人际社交智能: {interpersonal}/10
- 语言表达智能: {linguistic}/10

先天气质类型: {temperament['label']}
"""

    # 生成各维度分析
    analysis_texts = {}
    dim_keys = {
        "spatial": "空间视觉智能",
        "naturalist": "自然观察智能",
        "logical": "逻辑数理智能",
        "interpersonal": "人际社交智能",
        "linguistic": "语言表达智能",
    }

    for eng_name, cn_name in dim_keys.items():
        score = dimension_scores[cn_name]

        # 尝试AI生成
        ai_prompt = f"""根据以下游戏行为数据，为一个6-12岁儿童生成一段关于「{cn_name}」的潜能发展分析（100-150字，温暖鼓励的语气）:

{ai_context}

{cn_name}得分: {score}/10

要求: 使用具体、鼓励的语言，分析该维度的表现，并给出发展建议。"""

        ai_text = ai_generate(ai_prompt, max_tokens=300)
        if ai_text:
            analysis_texts[cn_name] = ai_text
        else:
            analysis_texts[cn_name] = _template_analysis(eng_name, score)

    # ── 天赋优势总结（AI生成） ──
    top3_str = "、".join([f"{d[0]}({d[1]}分)" for d in top3])
    strength_prompt = f"""根据以下数据，为一个6-12岁儿童生成「天赋优势总结」（100-150字，温暖鼓励）:

{ai_context}

天赋前三: {top3_str}

分析这些优势在学习和生活中的体现，并给予鼓励。"""

    strength_text = ai_generate(strength_prompt)
    if not strength_text:
        strength_text = f"你的核心优势集中在{top3_str}！这些天赋让你在相关领域表现出色。继续保持，开发你的潜能！🌟"

    # ── 短板分析（AI生成或模板） ──
    if bottom:
        bottom_str = "、".join([f"{d[0]}({d[1]}分)" for d in bottom])
        weakness_prompt = f"""根据以下数据，为一个6-12岁儿童生成「潜能待发展分析」（100-150字，温暖鼓励，不批评）:

{ai_context}

待发展维度: {bottom_str}

用积极的语言解释为什么这些维度还在发展中，并给出具体的提升建议。"""

        weakness_text = ai_generate(weakness_prompt)
        if not weakness_text:
            weakness_text = f"你的{top3_str}表现突出！继续全面发展，每个领域都会进步！💪"
    else:
        weakness_text = "各维度发展均衡，继续保持多元化的学习体验！🌟"

    # ── 认知学习特质（AI生成或模板） ──
    trait_prompt = f"""根据以下儿童游戏行为数据，生成「认知学习特质分析」（100-150字）:

{ai_context}

CHEXI执行功能:
- 任务坚持力: {chexi['task_persistence']}/10
- 思维变通力: {chexi['flexibility']}/10
- 抗分心能力: {chexi['anti_distraction']}/10
- 多步骤统筹: {chexi['multi_step_planning']}/10
- 经验学习力: {chexi['experience_learning']}/10

分析儿童的学习风格、认知特点，用温暖专业的语言。"""

    trait_text = ai_generate(trait_prompt)
    if not trait_text:
        trait_text = f"你的学习特点是：坚持力{chexi['task_persistence']}分、变通力{chexi['flexibility']}分、抗分心{chexi['anti_distraction']}分、规划力{chexi['multi_step_planning']}分、经验学习力{chexi['experience_learning']}分。继续发挥你的优势，在挑战中成长！📈"

    # ── 个性化培养建议（AI生成或模板） ──
    suggestion_prompt = f"""根据以下数据，为6-12岁儿童提供3条「个性化培养建议」（总计150-200字）:

{ai_context}

先天气质: {temperament['label']} - {temperament['desc']}

给出具体、可操作的家庭教育建议，结合日常生活场景。"""

    suggestion_text = ai_generate(suggestion_prompt)
    if not suggestion_text:
        suggestions = []
        if spatial_final < 6:
            suggestions.append("🏗️ 建议多玩立体拼图、乐高、磁力片等建构类玩具，发展空间感知能力。")
        if naturalist < 6:
            suggestions.append("🌿 建议增加户外自然探索时间，饲养小宠物或种植植物，配合科普绘本阅读。")
        if logical < 6:
            suggestions.append("🎲 建议通过策略性桌游或编程启蒙活动培养逻辑规划思维。")
        if interpersonal < 6:
            suggestions.append("🤝 建议多参加团队活动，在安全环境中练习表达感受和倾听他人。")
        if linguistic < 6:
            suggestions.append("📚 建议每天亲子共读，鼓励孩子复述故事并表达自己的观点。")
        if len(suggestions) < 2:
            suggestions.append("🎯 各维度发展均衡，建议继续保持多元化的学习体验！")
        suggestion_text = "\n".join(suggestions[:4])

    # ── 第三关对话分析（AI生成） ──
    dialogue_text = ""
    if level3_dialogue:
        player_msgs = [m for m in level3_dialogue if m.get("role") == "player"]
        dialogue_content = "\n".join([f"第{i+1}轮: {m['text']}" for i, m in enumerate(player_msgs)])

        dialogue_prompt = f"""分析以下6-12岁儿童在「海洋议事厅」调解任务中的对话，从「语言表达」和「人际共情」两个角度进行分析（150-200字）:

对话记录:
{dialogue_content}

要求:
1. 分析语言表达能力（用词、句式、逻辑）
2. 分析共情能力（是否理解他人感受、是否提出建设性方案）
3. 用温暖鼓励的语气给建议
4. 以"💬 对话分析"开头"""

        dialogue_text = ai_generate(dialogue_prompt, max_tokens=400, temperature=0.6)

        if not dialogue_text:
            # 降级分析
            total_msgs = len(player_msgs)
            avg_len = sum(len(m["text"]) for m in player_msgs) / max(total_msgs, 1) if total_msgs > 0 else 0
            harmony_final = l3.get("harmony_final", 0)

            dialogue_text = f"💬 对话分析\n\n"
            dialogue_text += f"小队长在调解中共进行了{total_msgs}轮发言"
            if avg_len >= 10:
                dialogue_text += f"，平均每轮表达{avg_len:.0f}个字，语言表达较为完整。"
            else:
                dialogue_text += f"，表达较为简短，建议鼓励孩子用更完整的句子表达想法。"

            if harmony_final >= 80:
                dialogue_text += f"最终和解度达到{harmony_final}%，说明孩子具有优秀的共情能力和冲突解决意识！"
            elif harmony_final >= 50:
                dialogue_text += f"最终和解度达到{harmony_final}%，展现了良好的沟通意愿和合作精神。"
            else:
                dialogue_text += f"建议多引导孩子关注他人的感受，练习用语言表达理解和关心。"

    # ── 组装完整报告 ──
    report = {
        "dimension_scores": dimension_scores,
        "dimension_analysis": analysis_texts,
        "chexi": chexi,
        "erikson": erikson,
        "temperament": temperament,
        "top3_strengths": top3,
        "weaknesses": bottom,
        "strength_summary": strength_text,
        "weakness_analysis": weakness_text,
        "cognitive_traits": trait_text,
        "dialogue_analysis": dialogue_text,
        "suggestions": suggestion_text,
    }

    return report
