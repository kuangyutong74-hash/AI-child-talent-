from types import SimpleNamespace

from app.services.talent_service import (
    _independent_section,
    _ensure_next_steps,
    _language_section,
    _level,
    _measurability,
    _piecewise_score,
    _piecewise_section_score,
    _imagination_gate,
    _empathy_gate,
    _apply_high_order_anchors,
    _progress_bonus,
    _scored_dimensions,
    _section_confidence,
)


def _message(text: str):
    return SimpleNamespace(content=text)


def test_short_low_information_story_is_not_measurable():
    result = _measurability([
        _message("它去。"),
        _message("不知道。"),
        _message("哈哈哈。"),
    ])
    assert result["is_measurable"] is False
    assert result["effective_turn_count"] == 3


def test_invalid_report_still_gets_specific_next_steps():
    suggestions = _ensure_next_steps(
        [],
        [_message("小豆在树下找铃铛。")],
        {"is_valid": False},
        {"is_valid": False},
        {"is_valid": False},
    )
    assert suggestions
    assert "小豆在树下找铃铛" in suggestions[0]
    assert all("分" not in item and "没有证据" not in item for item in suggestions)


def test_empty_story_still_gets_a_positive_next_step():
    suggestions = _ensure_next_steps(
        [],
        [],
        {"is_valid": False},
        {"is_valid": False},
        {"is_valid": False},
    )
    assert len(suggestions) >= 1


def test_complete_story_passes_measurability_gate():
    result = _measurability([
        _message("小兔发现钥匙不见了，所以沿着脚印去森林里寻找。"),
        _message("它听见树洞里有哭声，就停下来问小松鼠为什么难过。"),
        _message("最后它们一起找到钥匙，也把迷路的小鸟送回了家。"),
    ])
    assert result["is_measurable"] is True


def test_observed_scores_have_no_universal_floor():
    dimensions = _scored_dimensions(
        [("测试", "language_vocabulary", 22)],
        {"language_vocabulary": 1},
    )
    assert dimensions[0]["score"] == 4.4
    assert dimensions[0]["observation_status"] == "实测"


def test_missing_dimension_is_unobserved_instead_of_floor_score():
    dimensions = _scored_dimensions(
        [
            ("一", "a", 50),
            ("二", "b", 50),
        ],
        {"a": 4, "b": 0},
    )
    assert dimensions[1]["score"] is None
    assert dimensions[1]["is_unscored"] is True


def test_up_to_two_missing_dimensions_are_cautiously_estimated():
    dimensions = _scored_dimensions(
        [("一", "a", 25), ("二", "b", 25), ("三", "c", 25), ("四", "d", 25)],
        {"a": 4, "b": 2, "c": 0, "d": 0},
        max_estimates=2,
    )
    assert all(item["score"] is not None for item in dimensions)
    assert sum(item["is_imputed"] for item in dimensions) == 2
    assert all(
        item["observation_status"] == "谨慎估算"
        for item in dimensions if item["is_imputed"]
    )


def test_more_than_two_missing_dimensions_are_not_estimated():
    dimensions = _scored_dimensions(
        [("一", "a", 25), ("二", "b", 25), ("三", "c", 25), ("四", "d", 25)],
        {"a": 4, "b": 0, "c": 0, "d": 0},
        max_estimates=2,
    )
    assert sum(item["is_unscored"] for item in dimensions) == 3


def test_language_requires_four_observed_dimensions():
    values = {
        "language_causal_logic": 4,
        "language_plot_memory": 3,
        "language_vocabulary": 3,
        "language_detail": 0,
        "language_character_voice": 0,
        "language_initiative": 0,
    }
    section = _language_section(values, "4-7", True)
    assert section["is_valid"] is False
    assert section["base_score"] == 0


def test_language_with_four_observed_estimates_two_and_remains_valid():
    values = {
        "language_causal_logic": 4,
        "language_plot_memory": 3,
        "language_vocabulary": 3,
        "language_detail": 2,
        "language_character_voice": 0,
        "language_initiative": 0,
    }
    section = _language_section(values, "4-7", True)
    assert section["is_valid"] is True
    assert sum(item["is_imputed"] for item in section["dimensions"]) == 2
    assert all(item["score"] is not None for item in section["dimensions"])
    confidence, level = _section_confidence(
        section["dimensions"],
        [object(), object(), object()],
        True,
    )
    assert confidence == 75
    assert level == "中"


def test_confidence_never_reaches_one_hundred():
    values = {
        "language_causal_logic": 5,
        "language_plot_memory": 5,
        "language_vocabulary": 5,
        "language_detail": 5,
        "language_character_voice": 5,
        "language_initiative": 5,
    }
    section = _language_section(values, "8-12", True)
    confidence, level = _section_confidence(
        section["dimensions"],
        [object(), object(), object(), object(), object()],
        True,
    )
    assert confidence == 95
    assert level == "高"


def test_growth_bonus_requires_reliable_multi_dimension_progress():
    assert _progress_bonus(30, 3, 1, 90) == 0
    assert _progress_bonus(30, 3, 2, 69) == 0
    assert _progress_bonus(30, 1, 2, 90) == 12
    assert _progress_bonus(30, 3, 2, 90) == 15


def test_small_growth_does_not_receive_bonus():
    assert _progress_bonus(2.9, 3, 3, 95) == 0
    assert _progress_bonus(3, 3, 2, 85) == 2


def test_valid_language_score_uses_piecewise_mapping():
    values = {
        "language_causal_logic": 1,
        "language_plot_memory": 1,
        "language_vocabulary": 1,
        "language_detail": 1,
        "language_character_voice": 1,
        "language_initiative": 1,
    }
    section = _language_section(values, "4-7", True)
    assert section["is_valid"] is True
    assert section["raw_ability_percent"] == 20
    assert section["base_score"] == 66


def test_perfect_language_foundation_score_reaches_one_hundred_fifteen():
    values = {
        "language_causal_logic": 5,
        "language_plot_memory": 5,
        "language_vocabulary": 5,
        "language_detail": 5,
        "language_character_voice": 5,
        "language_initiative": 5,
    }
    section = _language_section(values, "8-12", True)
    assert section["base_score"] == 115


def test_independent_section_requires_two_observed_dimensions():
    values = {"a": 4, "b": 0, "c": 0, "d": 0}
    section = _independent_section(
        values,
        [("一", "a"), ("二", "b"), ("三", "c"), ("四", "d")],
        "无法测评",
    )
    assert section["is_valid"] is False
    assert section["score"] == 0


def test_independent_section_with_two_observed_estimates_the_other_two():
    values = {"a": 4, "b": 2, "c": 0, "d": 0}
    section = _independent_section(
        values,
        [("一", "a"), ("二", "b"), ("三", "c"), ("四", "d")],
        "题材不足。",
    )
    assert section["is_valid"] is True
    assert sum(item["is_imputed"] for item in section["dimensions"]) == 2
    assert all(item["score"] is not None for item in section["dimensions"])
    assert section["raw_ability_percent"] == 51
    assert section["score"] == 78.6


def test_piecewise_mapping_expands_high_range():
    assert _piecewise_score(20) == 66
    assert _piecewise_score(50) == 79
    assert _piecewise_score(70) == 94
    assert _piecewise_score(100) == 115
    assert _piecewise_section_score(50) == 78
    assert _piecewise_section_score(100) == 100


def test_reality_only_robot_conflict_does_not_pass_imagination_gate():
    messages = [
        _message("亮亮让两个人说明情况，发现他们拿错了同一盒零件。"),
        _message("圆圆觉得别人故意抢东西，铁头也觉得被误会。他们交换检查记录，再互相道歉。"),
        _message("他们把比赛改成合作搭桥，并约定拿零件前先询问。"),
    ]
    assert _imagination_gate(messages)["passed"] is False
    assert _empathy_gate(messages)["passed"] is True


def test_high_order_cross_turn_story_gets_depth_anchors():
    messages = [
        _message("每天午夜记忆潮会覆盖观测站，只有按顺序播放回声贝壳，控制室才会开启，否则记录会消失。"),
        _message("守站人不是故意阻拦，而是担心岛民的回忆。闻舟复述他的顾虑，提出只开启隔离舱，岛民代表可以随时停止实验。"),
        _message("闻舟记起第一晚的潮纹，保留旧参数，避免失败后无法复原。"),
        _message("大家共同决定下次是否调查失联的海底档案库，让新支线遵守现有规则。"),
    ]
    values = {key: 1 for key in (
        "language_causal_logic", "language_plot_memory", "language_vocabulary",
        "language_detail", "language_character_voice", "language_initiative",
        "empathy_emotion", "empathy_perspective", "empathy_prosocial",
        "empathy_conflict", "imagination_character", "imagination_setting",
        "imagination_rules", "imagination_side_plot",
    )}
    result = _apply_high_order_anchors(values, messages)
    assert result["language_causal_logic"] >= 4.5
    assert result["empathy_perspective"] == 5
    assert result["imagination_rules"] == 5


def test_report_labels_use_the_unified_mapped_scale():
    assert _level(60) == ("developing", "潜力发展型")
    assert _level(74.9) == ("developing", "潜力发展型")
    assert _level(75) == ("balanced", "均衡发展型")
    assert _level(89.9) == ("balanced", "均衡发展型")
    assert _level(90) == ("advantage", "优势型")
    assert _level(115, True) == ("advantage", "优势型")
