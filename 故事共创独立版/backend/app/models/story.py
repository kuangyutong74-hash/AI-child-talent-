from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, func, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Story(Base):
    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    character_id: Mapped[int] = mapped_column(Integer, ForeignKey("characters.id"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    theme: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")
    turn_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    safety_violation_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    full_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    character = relationship("Character", back_populates="stories")
    messages = relationship("StoryMessage", back_populates="story", cascade="all, delete-orphan", order_by="StoryMessage.turn_number")
    observations = relationship("Observation", back_populates="story", cascade="all, delete-orphan")
