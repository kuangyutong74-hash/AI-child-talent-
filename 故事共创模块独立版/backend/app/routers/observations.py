import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.character import Character
from app.models.observation import Observation
from app.models.story import Story
from app.models.user import User
from app.schemas.observation import ObservationOut, ObservationSummary

router = APIRouter(prefix="/observations", tags=["observations"])


async def _verify_story_ownership(story_id: int, user: User, db: AsyncSession) -> Story:
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")
    char = await db.get(Character, story.character_id)
    if not char or char.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")
    return story


@router.get("", response_model=list[ObservationOut])
async def get_observations(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_story_ownership(story_id, current_user, db)
    result = await db.execute(
        select(Observation)
        .where(Observation.story_id == story_id)
        .order_by(Observation.turn_number)
    )
    return result.scalars().all()


@router.get("/summary/{story_id}", response_model=ObservationSummary)
async def get_observation_summary(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_story_ownership(story_id, current_user, db)

    result = await db.execute(
        select(Observation).where(Observation.story_id == story_id)
    )
    observations = result.scalars().all()

    if not observations:
        return ObservationSummary(story_id=story_id, total_turns=0, highlights=[])

    vocab_scores = [o.vocabulary_richness for o in observations if o.vocabulary_richness]
    desc_scores = [o.descriptive_ability for o in observations if o.descriptive_ability]
    struct_scores = [o.story_structure for o in observations if o.story_structure]

    all_flags = []
    highlights = []
    for o in observations:
        if o.creativity_flags:
            try:
                flags = json.loads(o.creativity_flags)
                all_flags.extend(flags)
            except json.JSONDecodeError:
                pass
        if o.descriptive_examples:
            highlights.append(o.descriptive_examples)
        if o.vocabulary_examples:
            highlights.append(f"亮点词汇: {o.vocabulary_examples}")

    return ObservationSummary(
        story_id=story_id,
        total_turns=len(observations),
        avg_vocabulary_richness=round(sum(vocab_scores) / len(vocab_scores), 1) if vocab_scores else None,
        avg_descriptive_ability=round(sum(desc_scores) / len(desc_scores), 1) if desc_scores else None,
        avg_story_structure=round(sum(struct_scores) / len(struct_scores), 1) if struct_scores else None,
        all_creativity_flags=list(set(all_flags)),
        highlights=highlights[:10],
    )
