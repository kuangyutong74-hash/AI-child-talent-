from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, func, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    has_seen_onboarding: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    age_group: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # "4-7" or "8-12"
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    characters = relationship("Character", back_populates="user", cascade="all, delete-orphan")
