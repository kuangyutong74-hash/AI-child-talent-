import unittest

from app.services.content_guard import guard_child_input, sanitize_agent_output
from app.services.llm_service import apply_empathy_keyword_fallback


class ContentGuardRegressionTests(unittest.TestCase):
    def test_fictional_details_in_agent_story_are_not_privacy_redacted(self):
        story_text = "小鹿叫露露，住在彩虹森林的月亮街12号。"
        self.assertEqual(sanitize_agent_output(story_text), story_text)

    def test_normal_school_story_context_is_not_privacy(self):
        for text in ("班级图书角", "整理图书角", "学校里的故事"):
            with self.subTest(text=text):
                result = guard_child_input(text)
                self.assertFalse(result.blocked)
                self.assertFalse(result.has_privacy)

    def test_explicit_private_information_is_still_blocked(self):
        samples = (
            "我家住幸福小区8栋",
            "我的电话是13812345678",
            "我在三年级2班",
        )
        for text in samples:
            with self.subTest(text=text):
                self.assertTrue(guard_child_input(text).blocked)


class EmpathyRecognitionRegressionTests(unittest.TestCase):
    def test_listening_apology_and_cooperation_are_recognized(self):
        text = "亮亮停下来听对方解释，发现只是拿错了零件，于是互相道歉，一起把机器修好了。"
        result = apply_empathy_keyword_fallback({
            "empathy_emotion": 0,
            "empathy_perspective": 0,
            "empathy_prosocial": 0,
            "empathy_conflict": 0,
            "dimension_evidence": {},
        }, text)
        self.assertGreater(result["empathy_perspective"], 0)
        self.assertGreater(result["empathy_prosocial"], 0)
        self.assertGreater(result["empathy_conflict"], 0)
        self.assertIn(text, result["evidence"])

    def test_existing_model_score_is_not_overwritten(self):
        result = apply_empathy_keyword_fallback({
            "empathy_emotion": 0,
            "empathy_perspective": 5,
            "empathy_prosocial": 0,
            "empathy_conflict": 0,
            "dimension_evidence": {},
        }, "他先听对方解释。")
        self.assertEqual(result["empathy_perspective"], 5)


if __name__ == "__main__":
    unittest.main()
