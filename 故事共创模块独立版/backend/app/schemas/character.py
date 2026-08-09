from __future__ import annotations

from datetime import datetime

from typing import Literal

from pydantic import BaseModel, field_validator


class CharacterCreate(BaseModel):
    nickname: str
    avatar_type: str
    avatar_color: str
    personality: str | None = None
    age_group: Literal["4-7", "8-12"]


class CharacterUpdate(BaseModel):
    age_group: Literal["4-7", "8-12"]


class CharacterOut(BaseModel):
    id: int
    user_id: int
    nickname: str
    avatar_type: str
    avatar_color: str
    personality: str | None = None
    age_group: str | None = None
    created_at: str | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _dt_to_str(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    model_config = {"from_attributes": True}
