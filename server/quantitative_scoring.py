"""
🐬 游戏行为量化评分引擎 v3
纯客观行为数据自动计算，零人工干预。

更新日志 v3 (2026-07-28):
  1. ✅ S1增加半档粒度（4.5分/3.5分/2.5分），解决顶尖玩家区分度不足
  2. ✅ S2的1分阈值从>50%收窄至>45%，覆盖1分档空缺
  3. ✅ 年龄常模配合更精细阈值，9岁vs10岁高水平玩家可分差≥0.5

更新日志 v2:
  1. ✅ 数据完整性校验 → 缺失关键字段时降分 + 标记警告
  2. ✅ 年龄常模非线性化 → S1分段更细，跨年龄组产生区分度
  3. ✅ S3细化 → 区分"完全跳过"(零操作)与"尝试后失败跳过"
  4. ✅ S1默认值调整 → 无操作跳关默认 S1=2（原为3）
  5. ✅ 第三关纳入量化模型 → 新增 S4 社交调解分，权重重新分配

评分模型 v2:
  S1: 关卡耗时得分 → 逻辑空间智能（思维效率、加工速度）
  S2: 无效操作得分 → 专注自控智能（专注度、冲动控制）
  S3: 跳关坚持得分 → 意志坚持智能（坚持性、抗挫折）
  S4: 调解质量得分 → 社交调解智能（同理心、冲突解决）

  综合得分: S = 0.25*S1 + 0.30*S2 + 0.25*S3 + 0.20*S4
     (v1: 0.3*S1 + 0.4*S2 + 0.3*S3)
     降低S2专注权重10%, 拆分给S4社交调解20%

  等级判定: 1.0~5.0 → A/B/C/D/E
"""

from scoring_config import (
    NORM_CONFIG,
    S1_COMMENTARY,
    S2_COMMENTARY,
    S3_COMMENTARY,
    S4_COMMENTARY,
    LEVEL_CONFIG,
)

# ══════════════════════════════════════════════════════════════════
#  1. 数据完整性校验（修复#1）
# ══════════════════════════════════════════════════════════════════

REQUIRED_FIELDS_L1 = {
    "block_drag_count": "拖拽次数",
    "species_placement_attempts": "放置尝试",
    "successful_pairs": "成功配对数",
    "total_operations": "总操作数",
}

REQUIRED_FIELDS_L2 = {
    "pipe_count": "管道数",
    "rotate_count": "旋转次数",
    "successful_pairs": "连通状态",
}

REQUIRED_FIELDS_L3 = {
    "harmony_final": "最终和解度",
    "rounds_used": "对话轮次",
}


def check_data_integrity(
    level1_metrics: dict,
    level2_metrics: dict,
    level3_metrics: dict,
) -> dict:
    """
    检查三个关卡数据的完整性。
    关键字段缺失或全零 → 数据不完整 → 返回警告+乘数因子。

    Returns:
        {"complete": bool, "integrity_ratio": float, "warnings": [str]}
    """
    warnings = []
    missing_count = 0
    total_fields = 0

    # L1 检查
    total_ops = level1_metrics.get("total_operations", 0)
    has_l1_data = total_ops > 0
    for field, label in REQUIRED_FIELDS_L1.items():
        total_fields += 1
        val = level1_metrics.get(field)
        if val is None:
            missing_count += 1
            warnings.append(f"第一关缺失字段：{label}")
        elif has_l1_data and val == 0 and field != "total_operations":
            # 有操作数据但关键指标为零 → 可能异常（如total_ops>0但successful_pairs=0是合理的）
            if field == "successful_pairs":
                pass  # 0对成功也可能是真实情况
            elif field == "block_drag_count":
                missing_count += 0.5
                warnings.append(f"第一关异常：{label}=0 但有操作记录")

    # L2 检查
    l2_ops = level2_metrics.get("total_operations", 0)
    has_l2_data = l2_ops > 0
    for field, label in REQUIRED_FIELDS_L2.items():
        total_fields += 1
        val = level2_metrics.get(field)
        if val is None:
            missing_count += 1
            warnings.append(f"第二关缺失字段：{label}")
        elif has_l2_data and val == 0 and field in ("pipe_count",):
            missing_count += 0.5
            warnings.append(f"第二关异常：{label}=0 但有操作记录")

    # L3 检查
    l3_dur = level3_metrics.get("duration_seconds", 0)
    has_l3_data = l3_dur > 0 or level3_metrics.get("rounds_used", 0) > 0
    for field, label in REQUIRED_FIELDS_L3.items():
        total_fields += 1
        val = level3_metrics.get(field)
        if val is None:
            missing_count += 1
            warnings.append(f"第三关缺失字段：{label}")

    # [修复] 2026-07-26: 脏话行为标记
    unf_count = level3_metrics.get("unfriendly_count", 0)
    if unf_count > 0:
        warnings.append(f"⚠️ 行为提醒：第三关对话中出现 {int(unf_count)} 次不友好/脏话输入")
    if unf_count >= 3:
        warnings.append("🔴 重点关注：对话中输入3次以上不友好语言，建议关注社交表达方式")

    # [修复] 2026-07-27: 检测全关零操作（完全跳过游戏）
    total_ops_all = (
        level1_metrics.get("total_operations", 0)
        + level2_metrics.get("total_operations", 0)
    )
    has_l3_data = level3_metrics.get("rounds_used", 0) > 0 or level3_metrics.get("harmony_final", 0) > 0
    if total_ops_all <= 0 and not has_l3_data:
        warnings.append("⚠️ 数据完整提醒：三个关卡均无操作记录，游戏内容被完全跳过，评分无法反映真实能力")

    # 计算完整性比率
    integrity_ratio = max(0.0, 1.0 - (missing_count / max(total_fields, 1)))

    # 如果有操作数据但缺失大量字段，完整性仍会扣分
    is_complete = integrity_ratio >= 0.7

    return {
        "complete": is_complete,
        "integrity_ratio": round(integrity_ratio, 2),
        "warnings": warnings,
    }


# ══════════════════════════════════════════════════════════════════
#  工具函数
# ══════════════════════════════════════════════════════════════════


def _get_invalid_count(metrics: dict) -> int:
    """从关卡指标中提取无效操作总数"""
    return (
        metrics.get("meaningless_clicks", 0)
        + metrics.get("blank_clicks", 0)
        + metrics.get("random_drags", 0)
        + metrics.get("invalid_drops", 0)
    )


def _get_total_ops(metrics: dict) -> int:
    """从关卡指标中提取总操作数"""
    return metrics.get("total_operations", 0)


# ══════════════════════════════════════════════════════════════════
#  S1 逻辑空间智能（修复#2 常模非线性 + 修复#4 默认值）
# ══════════════════════════════════════════════════════════════════


def calc_S1(
    level1_metrics: dict,
    level2_metrics: dict,
    level3_metrics: dict,
    skip_count: int,
    age: str = "8",
) -> int:
    """
    S1 关卡耗时得分 → 逻辑空间智能

    v2 改进:
      - 分段阈值收窄，引入非线性分布解决天花板效应
      - 无操作跳关默认 S1=2（原为3）
      - 各关卡常模耗时更精细

    v3 改进 (2026-07-28):
      - 引入半档粒度 4.5分/3.5分/2.5分，解决顶尖玩家区分度不足问题
      - 顶层阈值收窄: Rt≤0.25→5分, ≤0.42→4.5分, ≤0.55→4分

    以同年龄段常模均值 T0 为基准，计算相对耗时比:
      Rt = 实际总耗时 / 常模总耗时

    分段规则（v3 非线性+半档）:
      Rt ≤ 0.25 → 5分（思维效率极快）
      0.25~0.42 → 4.5分（思维效率优秀）
      0.42~0.55 → 4分（思维效率良好）
      0.55~0.85 → 3分（思维效率中等）
      0.85~1.20 → 2分（思维效率偏低）
      > 1.20    → 1分（思维效率需关注）
    """
    config = NORM_CONFIG.get(age, NORM_CONFIG["default"])
    norm_total = config["total"]

    if norm_total <= 0:
        return 2

    # 检查是否有任何关卡产生了操作数据
    l1_ops = _get_total_ops(level1_metrics)
    l2_ops = _get_total_ops(level2_metrics)
    total_ops = l1_ops + l2_ops

    # [修复#4] 没有任何操作数据 + 有跳关 → 未真正玩游戏 → S1=2
    if total_ops <= 0 and skip_count > 0:
        return 2

    # 获取各关卡实际耗时，未完成的关卡用常模替代
    def _get_duration(metrics, level_key):
        dur = metrics.get("duration_seconds", 0)
        ops = _get_total_ops(metrics)
        if dur <= 0 and ops <= 0:
            return config[level_key]
        return dur

    l1_dur = _get_duration(level1_metrics, "level1")
    l2_dur = _get_duration(level2_metrics, "level2")
    l3_dur = _get_duration(level3_metrics, "level3")

    actual = l1_dur + l2_dur + l3_dur
    Rt = actual / norm_total

    # [修复#2] 非线性分段 + [v3] 半档粒度区分顶尖玩家
    if Rt <= 0.25:
        return 5.0
    elif Rt <= 0.42:
        return 4.5
    elif Rt <= 0.55:
        return 4.0
    elif Rt <= 0.85:
        return 3.0
    elif Rt <= 1.20:
        return 2.0
    else:
        return 1.0


# ══════════════════════════════════════════════════════════════════
#  S2 专注自控智能（无变化）
# ══════════════════════════════════════════════════════════════════


def calc_S2(level1_metrics: dict, level2_metrics: dict, skip_count: int = 0) -> int:
    """
    S2 无效操作得分 → 专注自控智能

    无效占比 Rp = 无效操作总数 / 总操作数

    v3 更新 (2026-07-28):
      - 1分阈值从>50%收窄至>45%，使极端冲动行为更易触发最低档
      - 零操作+跳过 → 明确返回1分

    分段规则:
      Rp ≤ 10%   → 5分（专注力极强）
      10%~20%    → 4分（专注力良好）
      20%~35%    → 3分（专注力中等）
      35%~45%    → 2分（专注力偏弱）
      > 45%      → 1分（需关注）

    [修复] 2026-07-27: 零操作且跳关 → 返回1分（无法评估专注力，
          而非返回默认3分被误读为"专注力中等"）
    """
    invalid = _get_invalid_count(level1_metrics) + _get_invalid_count(level2_metrics)
    total = _get_total_ops(level1_metrics) + _get_total_ops(level2_metrics)

    if total <= 0:
        # 没有任何操作数据 → 无法评估专注力
        # 如果还跳关了，说明孩子没参与，不能给中等分（原为return 3）
        if skip_count > 0:
            return 1  # 未参与游戏，无法证明专注力
        return 1  # 无操作数据也按最低分处理

    Rp = invalid / total

    if Rp <= 0.10:
        return 5
    elif Rp <= 0.20:
        return 4
    elif Rp <= 0.35:
        return 3
    elif Rp <= 0.45:
        return 2
    else:
        return 1


# ══════════════════════════════════════════════════════════════════
#  S3 意志坚持智能（修复#3：区分完全跳过与尝试后跳过）
# ══════════════════════════════════════════════════════════════════


def calc_S3(
    skip_count: int,
    level1_metrics: dict,
    level2_metrics: dict,
    level3_metrics: dict,
) -> int:
    """
    S3 跳关坚持得分 → 意志坚持智能

    v2 改进:
      引入"完全跳过"概念——跳关且关卡无任何操作数据
      完全跳过比"尝试后失败跳过"扣分更重

    规则:
      0 次跳关                  → 5分（意志力极强）
      1 次跳关（有尝试）         → 4分（意志力良好）
      2 次跳关 或 1次完全跳过   → 3分（意志力中等）
      3 次跳关 或 2次完全跳过   → 2分（意志力偏弱）
      3次以上完全跳过           → 1分（需关注）
    """
    l1_ops = _get_total_ops(level1_metrics)
    l2_ops = _get_total_ops(level2_metrics)
    l3_ops = _get_total_ops(level3_metrics)
    l3_rounds = level3_metrics.get("rounds_used", 0)

    # 计算"完全跳过"的关卡数（跳关且零操作数据）
    complete_skip = 0
    if l1_ops <= 0:
        complete_skip += 1
    if l2_ops <= 0:
        complete_skip += 1
    if l3_ops <= 0 and l3_rounds <= 0:
        complete_skip += 1

    # 无任何跳关
    if skip_count == 0:
        return 5

    # 完全跳过为主 → 更严厉扣分
    if complete_skip >= 3:
        return 1
    if complete_skip >= 2:
        return 2

    # 混合情况：有尝试但最终跳了
    if skip_count >= 3:
        return 2
    elif skip_count == 2:
        return 3
    elif skip_count == 1:
        return 4
    else:
        return 1


# ══════════════════════════════════════════════════════════════════
#  S4 社交调解智能（修复#5：新增）
# ══════════════════════════════════════════════════════════════════


def calc_S4(level3_metrics: dict) -> int:
    """
    S4 调解质量得分 → 社交调解智能（第三关专项）

    基于:
      - harmony_final: 最终和解度 (0~100)
      - rounds_used:   完成对话轮次 (0~3)
      - unfriendly_count: 不友好输入次数（v3 新增直接惩罚）

    v3 更新 (2026-07-28):
      - 增加 unfriendly_count 直接惩罚：每1次不友好降低一档
      - 3次及以上不友好 → 强制 S4=1 分
      - 原始规则略微降低阈值以配合扣分后的和解度

    分段规则（原始，扣分前参考）:
      和解度≥80 且 完成3轮 → 5分
      和解度≥60 且 完成≥2轮 → 4分
      和解度≥40 或 有参与迹 → 3分
      和解度≥20 → 2分
      无数据或极低 → 1分

    扣分后惩罚:
      每出现1次 unfriendly → 得分降1档（至少保留1分）
      累计 ≥3 次 unfriendly → 直接 1 分
    """
    harmony = level3_metrics.get("harmony_final", 0)
    rounds = level3_metrics.get("rounds_used", 0)
    unf = level3_metrics.get("unfriendly_count", 0)

    # 完全没有第三关数据
    if harmony <= 0 and rounds <= 0:
        return 1

    # [v3] 连续3次及以上不友好 → 直接最低分
    if unf >= 3:
        return 1

    # 根据和解度 + 参与轮次综合评定
    if harmony >= 80 and rounds >= 3:
        base = 5
    elif harmony >= 60 and rounds >= 2:
        base = 4
    elif harmony >= 40:
        base = 3
    elif harmony >= 20:
        base = 2
    else:
        base = 1

    # [v3] unfriendly 直接降档惩罚：每1次降1档
    penalty = int(unf)  # 每1次不友好降1档
    return max(1, base - penalty)


# ══════════════════════════════════════════════════════════════════
#  综合计算
# ══════════════════════════════════════════════════════════════════


def calc_comprehensive(S1: int, S2: int, S3: int, S4: int, integrity_ratio: float = 1.0) -> dict:
    """
    计算综合潜能得分和等级

    公式 v2: S = 0.25*S1 + 0.30*S2 + 0.25*S3 + 0.20*S4
      相比v1:
        - 降低S2权重从0.4→0.30（给S4腾空间）
        - S1从0.3→0.25、S3从0.3→0.25（小幅微调）
        - 新增S4占0.20（第三关调解）

    数据完整性降分:
      如果 integrity_ratio < 0.7，综合分乘以减损因子
      完整性越低，减损越多: 乘数 = 0.5 + 0.5*integrity_ratio
      最低乘数0.5，即缺失大半字段时总分腰斩
    """
    score = round(0.25 * S1 + 0.30 * S2 + 0.25 * S3 + 0.20 * S4, 1)

    # [修复#1] 数据完整性降分
    if integrity_ratio < 0.7:
        multiplier = 0.5 + 0.5 * integrity_ratio
        score = round(score * multiplier, 1)
        score = max(1.0, min(5.0, score))

    for cfg in LEVEL_CONFIG:
        if cfg["min"] <= score <= cfg["max"]:
            return {
                "comprehensive_score": score,
                "level": cfg["level"],
                "level_label": cfg["label"],
                "level_color": cfg["color"],
            }

    # fallback
    return {
        "comprehensive_score": score,
        "level": "C级",
        "level_label": "待评估",
        "level_color": "#94a3b8",
    }


def generate_commentary(S1: float, S2: int, S3: int, S4: int) -> dict:
    """基于四项得分查表生成个性化评语"""
    return {
        "S1_commentary": S1_COMMENTARY.get(S1, ""),
        "S2_commentary": S2_COMMENTARY.get(S2, ""),
        "S3_commentary": S3_COMMENTARY.get(S3, ""),
        "S4_commentary": S4_COMMENTARY.get(S4, ""),
    }


# ══════════════════════════════════════════════════════════════════
#  主入口
# ══════════════════════════════════════════════════════════════════


def generate_quantitative_report(request_data: dict) -> dict:
    """
    主入口：生成完整量化评分报告（v2）

    请求格式:
    {
        "student_id": "stu_9527",
        "age": "8",
        "level1_metrics": { ... },
        "level2_metrics": { ... },
        "level3_metrics": { ... },
        "total_skip_count": 0,
    }

    返回:
    {
        "student_id": ...,
        "age": ...,
        "scores": { S1/S2/S3/S4 },
        "comprehensive_score": ...,
        "level": ...,
        "level_label": ...,
        "level_color": ...,
        "commentary": { ... },
        "data_integrity": { ... },  // v2 新增
    }
    """
    l1 = request_data.get("level1_metrics", {})
    l2 = request_data.get("level2_metrics", {})
    l3 = request_data.get("level3_metrics", {})
    age = request_data.get("age", "8")
    skip_count = request_data.get("total_skip_count", 0)

    # [修复#1] 数据完整性校验
    integrity = check_data_integrity(l1, l2, l3)
    integrity_ratio = integrity["integrity_ratio"]

    # 计算四项得分
    S1 = calc_S1(l1, l2, l3, skip_count, age)
    S2 = calc_S2(l1, l2, skip_count)
    S3 = calc_S3(skip_count, l1, l2, l3)
    S4 = calc_S4(l3)

    # 综合得分（含完整性降分）
    comprehensive = calc_comprehensive(S1, S2, S3, S4, integrity_ratio)

    # 评语
    commentary = generate_commentary(S1, S2, S3, S4)

    return {
        "student_id": request_data.get("student_id", ""),
        "age": age,
        "scores": {
            "S1_logical_spatial": S1,
            "S2_focus_self_control": S2,
            "S3_persistence": S3,
            "S4_social_mediation": S4,
        },
        "comprehensive_score": comprehensive["comprehensive_score"],
        "level": comprehensive["level"],
        "level_label": comprehensive["level_label"],
        "level_color": comprehensive["level_color"],
        "commentary": commentary,
        "data_integrity": {
            "complete": integrity["complete"],
            "integrity_ratio": integrity_ratio,
            "warnings": integrity["warnings"],
        },
    }
