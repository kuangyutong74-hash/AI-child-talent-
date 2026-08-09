from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator


class ObservationOut(BaseModel):
    id: int
    story_id: int
    message_id: int
    turn_number: int

    # New 5-dimension
    vocabulary_semantic: int | None = None
    vocabulary_semantic_examples: str | None = None
    sentence_fluency: int | None = None
    sentence_fluency_examples: str | None = None
    narrative_completeness: int | None = None
    narrative_structure_note: str | None = None
    character_empathy: int | None = None
    character_empathy_examples: str | None = None
    creative_initiative: int | None = None
    creative_initiative_examples: str | None = None

    # Legacy
    vocabulary_richness: int | None = None
    vocabulary_examples: str | None = None
    descriptive_ability: int | None = None
    descriptive_examples: str | None = None
    story_structure: int | None = None
    structure_note: str | None = None
    creativity_flags: str | None = None

    created_at: str | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _dt_to_str(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    model_config = {"from_attributes": True}


class ObservationSummary(BaseModel):
    story_id: int
    total_turns: int
    age_group: str = ""

    # Averages
    avg_vocabulary_semantic: float | None = None
    avg_sentence_fluency: float | None = None
    avg_narrative_completeness: float | None = None
    avg_character_empathy: float | None = None
    avg_creative_initiative: float | None = None
    overall_score: float | None = None

    # Trends
    vocabulary_semantic_trend: str = ""
    sentence_fluency_trend: str = ""
    narrative_completeness_trend: str = ""
    character_empathy_trend: str = ""
    creative_initiative_trend: str = ""

    # Levels
    overall_level: str = ""
    level_label: str = ""
    level_description: str = ""

    # Highlights
    semantic_highlights: list[str] = []
    empathy_highlights: list[str] = []
    initiative_highlights: list[str] = []

    # Meta
    total_words_by_child: int = 0
    avg_words_per_turn: float = 0.0

    # Feedback
    strengths: list[str] = []
    suggestions: list[str] = []
    talent_tags: list[str] = []
