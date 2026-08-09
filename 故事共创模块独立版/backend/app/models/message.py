from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, func, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class StoryMessage(Base):
    __tablename__ = "story_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    story_id: Mapped[int] = mapped_column(Integer, ForeignKey("stories.id"), nullable=False)
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(10), nullable=False)  # "ai" | "child"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    ai_raw_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    story = relationship("Story", back_populates="messages")
    observation = relationship("Observation", back_populates="message", uselist=False, cascade="all, delete-orphan")
