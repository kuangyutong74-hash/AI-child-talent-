from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.character import Character
from app.models.story import Story
from app.models.user import User
from app.services import talent_service

router = APIRouter(prefix="/talents", tags=["talents"])


async def _owned_profile(story_id: int, current_user: User, db: AsyncSession):
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")

    char = await db.get(Character, story.character_id)
    if not char or char.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")

    profile = await talent_service.generate_talent_profile(db, story_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="无法生成创作回顾")
    return profile


@router.get("/{story_id}/feedback")
async def get_child_feedback(
    story_id: int,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return child-friendly feedback without scores, levels or scoring evidence."""
    profile = await _owned_profile(story_id, current_user, db)
    response.headers["Cache-Control"] = "no-store"
    return {
        "story_id": profile.story_id,
        "story_title": profile.story_title,
        "completed": profile.completed,
        "highlights": profile.highlights or ["你和故事导演一起完成了一段属于自己的冒险。"],
        "strengths": profile.strengths or ["你愿意把自己的想法写进故事，并坚持完成了这次创作。"],
        "suggestions": profile.suggestions or ["下次可以为角色增加一句有趣的对话，让故事更生动。"],
    }


@router.get("/{story_id}")
async def get_talent_profile(
    story_id: int,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get three independent 100-point talent reports plus language progress."""
    p = await _owned_profile(story_id, current_user, db)

    response.headers["Cache-Control"] = "no-store"
    return asdict(p)
