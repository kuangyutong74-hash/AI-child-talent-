from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator


class StoryCreate(BaseModel):
    character_id: int
    theme: str | None = None
    title: str | None = None


class StoryUpdate(BaseModel):
    title: str | None = None
    status: str | None = None


class StoryOut(BaseModel):
    id: int
    character_id: int
    title: str | None = None
    theme: str | None = None
    status: str
    turn_count: int
    full_text: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    @field_validator("started_at", "completed_at", "created_at", "updated_at", mode="before")
    @classmethod
    def _dt_to_str(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    model_config = {"from_attributes": True}


class TurnRequest(BaseModel):
    child_input: str
    force_ending: bool = False
