from __future__ import annotations

import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.observation import Observation


async def save_observation(
    db: AsyncSession,
    story_id: int,
    message_id: int,
    turn_number: int,
    data: dict,
) -> Observation | None:
    """Save observation data from LLM or fallback. Returns None if data is empty."""
    if not data:
        return None

    obs = Observation(
        story_id=story_id,
        message_id=message_id,
        turn_number=turn_number,

        # New 5-dimension
        vocabulary_semantic=data.get("vocabulary_semantic"),
        vocabulary_semantic_examples=data.get("vocabulary_semantic_examples", ""),
        sentence_fluency=data.get("sentence_fluency"),
        sentence_fluency_examples=data.get("sentence_fluency_examples", ""),
        narrative_completeness=data.get("narrative_completeness"),
        narrative_structure_note=data.get("narrative_structure_note", ""),
        character_empathy=data.get("character_empathy"),
        character_empathy_examples=data.get("character_empathy_examples", ""),
        creative_initiative=data.get("creative_initiative"),
        creative_initiative_examples=data.get("creative_initiative_examples", ""),

        # Legacy
        vocabulary_richness=data.get("vocabulary_richness"),
        vocabulary_examples=data.get("vocabulary_examples", ""),
        descriptive_ability=data.get("descriptive_ability"),
        descriptive_examples=data.get("descriptive_examples", ""),
        story_structure=data.get("story_structure"),
        structure_note=data.get("structure_note", ""),

        creativity_flags=json.dumps(data.get("creativity_flags", []), ensure_ascii=False),
        raw_observation=json.dumps(data, ensure_ascii=False),
    )
    db.add(obs)
    await db.commit()
    await db.refresh(obs)
    return obs
