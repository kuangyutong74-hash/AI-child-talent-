from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator


class UserRegister(BaseModel):
    username: str
    password: str
    display_name: str | None = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str | None = None
    age_group: str | None = None
    created_at: str | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _dt_to_str(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserOut
    show_onboarding: bool = False
