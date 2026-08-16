from app.services.llm_service import apply_multilabel_recall


def blank():
    keys = (
        "language_causal_logic", "language_plot_memory",
        "language_vocabulary", "language_detail",
        "language_character_voice", "language_initiative",
        "empathy_emotion", "empathy_perspective",
        "empathy_prosocial", "empathy_conflict",
        "imagination_character", "imagination_setting",
        "imagination_rules", "imagination_side_plot",
    )
    return {key: 0 for key in keys}


def test_one_sentence_can_recall_multiple_empathy_dimensions():
    text = "米米因为小鹿害怕迷路，就先陪它练习辨认星星。"
    result = apply_multilabel_recall(blank(), text)
    assert result["empathy_emotion"] > 0
    assert result["empathy_perspective"] > 0
    assert result["empathy_prosocial"] > 0


def test_clock_city_recalls_setting_rule_and_character():
    text = "钟表城规定太阳落山后时间会倒流一小时，守门人把线索写在不会倒流的石板上。"
    result = apply_multilabel_recall(blank(), text)
    assert result["imagination_character"] > 0
    assert result["imagination_setting"] > 0
    assert result["imagination_rules"] >= 4


def test_new_map_clue_recalls_side_plot():
    text = "地图背面还有一条通往云层档案馆的小路，他们决定明天继续调查。"
    result = apply_multilabel_recall(blank(), text)
    assert result["imagination_setting"] > 0
    assert result["imagination_side_plot"] > 0


def test_mundane_location_alone_does_not_create_fantasy_setting():
    text = "小禾在学校图书角整理书本。"
    result = apply_multilabel_recall(blank(), text)
    assert result["imagination_setting"] == 0
    assert result["imagination_rules"] == 0


def test_existing_model_score_is_not_overwritten():
    data = blank()
    data["empathy_prosocial"] = 5
    result = apply_multilabel_recall(data, "它陪朋友一起找钥匙。")
    assert result["empathy_prosocial"] == 5


def test_added_evidence_is_literal_and_auditable():
    text = "两个机器人互相道歉，还约定以后先询问再拿零件。"
    result = apply_multilabel_recall(blank(), text)
    item = result["dimension_evidence"]["empathy_conflict"]
    assert item["quote"] in text
    assert item["status"] == "confirmed"
    assert "semantic_rule" in item["recall_source"]


def test_indirect_emotion_and_consideration_are_recalled():
    text = "小熊注意到小鸟缩在角落，就为了不让它更紧张，先把灯光调暗。"
    result = apply_multilabel_recall(blank(), text)
    assert result["empathy_emotion"] > 0
    assert result["empathy_perspective"] > 0
    assert result["empathy_prosocial"] > 0


def test_extended_fantasy_setting_and_rule_are_recalled():
    text = "天空岛上的透明钟表会自动变色，一旦触碰后，所有云朵都会倒着飞。"
    result = apply_multilabel_recall(blank(), text)
    assert result["imagination_character"] > 0
    assert result["imagination_setting"] > 0
    assert result["imagination_rules"] >= 4


def test_extended_side_plot_language_is_recalled():
    text = "与此同时，他们又发现门后还有新的地图，上面留下了一个暗号。"
    result = apply_multilabel_recall(blank(), text)
    assert result["imagination_side_plot"] > 0
