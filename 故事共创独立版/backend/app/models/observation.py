from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, func, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Observation(Base):
    """Language intelligence observation per story turn.

    Five dimensions based on Gardner's Multiple Intelligences (linguistic):
    1. vocabulary_semantic   — 词汇语义敏感度（修饰词、情绪词、具象词、修辞）
    2. sentence_fluency       — 句式与表达流畅度（连贯性、逻辑顺序）
    3. narrative_completeness — 叙事宏观完整度（起因-冲突-解决-结局）
    4. character_empathy      — 角色语言共情（角色台词、心理、情绪独白）
    5. creative_initiative    — 创作主动性（自发新增剧情、细节、拓展）
    """

    __tablename__ = "observations"
    __table_args__ = (
        CheckConstraint("vocabulary_semantic >= 1 AND vocabulary_semantic <= 5", name="ck_vocab_sem"),
        CheckConstraint("sentence_fluency >= 1 AND sentence_fluency <= 5", name="ck_sent_flu"),
        CheckConstraint("narrative_completeness >= 1 AND narrative_completeness <= 5", name="ck_narr_comp"),
        CheckConstraint("character_empathy >= 1 AND character_empathy <= 5", name="ck_char_emp"),
        CheckConstraint("creative_initiative >= 1 AND creative_initiative <= 5", name="ck_creat_init"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    story_id: Mapped[int] = mapped_column(Integer, ForeignKey("stories.id"), nullable=False)
    message_id: Mapped[int] = mapped_column(Integer, ForeignKey("story_messages.id"), nullable=False)
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── New 5-dimension system ──
    vocabulary_semantic: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    vocabulary_semantic_examples: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sentence_fluency: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sentence_fluency_examples: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    narrative_completeness: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    narrative_structure_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    character_empathy: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    character_empathy_examples: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creative_initiative: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    creative_initiative_examples: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Legacy fields (keep for backward compat) ──
    vocabulary_richness: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    vocabulary_examples: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    descriptive_ability: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    descriptive_examples: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    story_structure: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    structure_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    creativity_flags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_observation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    story = relationship("Story", back_populates="observations")
    message = relationship("StoryMessage", back_populates="observation")
