from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator


class StoryMessageOut(BaseModel):
    id: int
    story_id: int
    turn_number: int
    role: str
    content: str
    ai_raw_response: str | None = None
    created_at: str | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _dt_to_str(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    model_config = {"from_attributes": True}
