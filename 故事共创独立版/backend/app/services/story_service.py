import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import StoryMessage
from app.models.story import Story
from app.services.content_guard import (
    contains_prohibited_content,
    redact_privacy,
    sanitize_agent_output,
)


async def get_story_messages(db: AsyncSession, story_id: int) -> list[dict]:
    """Build message history for LLM context (OpenAI format).

    Only includes the narrative portion of AI messages, not the questions.
    This prevents the LLM from seeing its own questions as conversation context,
    which would cause it to repeat patterns.
    """
    result = await db.execute(
        select(StoryMessage)
        .where(StoryMessage.story_id == story_id)
        .order_by(StoryMessage.turn_number, StoryMessage.id)
    )
    messages = result.scalars().all()

    history = []
    for msg in messages:
        if msg.role == "ai":
            # Extract ONLY the narrative from AI messages (not the question)
            narrative = _extract_narrative(msg)
            history.append({
                "role": "assistant",
                "content": sanitize_agent_output(narrative),
            })
        else:
            if contains_prohibited_content(msg.content):
                continue
            safe_content, _ = redact_privacy(msg.content)
            history.append({"role": "user", "content": safe_content})
    return history


def _extract_narrative(msg: StoryMessage) -> str:
    """Extract just the narrative part from an AI message, excluding the question."""
    # Try parsing ai_raw_response first (most reliable)
    if msg.ai_raw_response:
        try:
            raw = json.loads(msg.ai_raw_response)
            return raw.get("narrative", msg.content)
        except json.JSONDecodeError:
            pass

    # Fallback: content is "narrative\n\nquestion", take only first part
    content = msg.content or ""
    if "\n\n" in content:
        return content.split("\n\n")[0]
    return content


async def save_child_message(
    db: AsyncSession, story_id: int, turn_number: int, content: str
) -> StoryMessage:
    msg = StoryMessage(
        story_id=story_id,
        turn_number=turn_number,
        role="child",
        content=content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def save_ai_message(
    db: AsyncSession,
    story_id: int,
    turn_number: int,
    narrative: str,
    question: str,
    raw_response: str,
) -> StoryMessage:
    full_content = narrative
    if question:
        full_content += "\n\n" + question

    msg = StoryMessage(
        story_id=story_id,
        turn_number=turn_number,
        role="ai",
        content=full_content,
        ai_raw_response=raw_response,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def increment_turn(db: AsyncSession, story_id: int):
    story = await db.get(Story, story_id)
    if story:
        story.turn_count = Story.turn_count + 1
        await db.commit()


async def complete_story(db: AsyncSession, story_id: int):
    """Mark story as completed and build full_text."""
    from datetime import datetime

    story = await db.get(Story, story_id)
    if not story:
        return

    result = await db.execute(
        select(StoryMessage)
        .where(StoryMessage.story_id == story_id)
        .order_by(StoryMessage.turn_number, StoryMessage.id)
    )
    messages = result.scalars().all()

    parts = []
    for msg in messages:
        role_label = "【AI故事导演】" if msg.role == "ai" else "【小作家】"
        parts.append(f"{role_label}\n{msg.content}")

    story.full_text = "\n\n".join(parts)
    story.status = "completed"
    story.completed_at = datetime.utcnow()
    await db.commit()
