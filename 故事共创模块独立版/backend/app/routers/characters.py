from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.character import Character
from app.models.story import Story
from app.schemas.character import CharacterCreate, CharacterOut, CharacterUpdate

router = APIRouter(prefix="/characters", tags=["characters"])


def _story_titles(char: Character) -> list[str]:
    """角色的故事名称列表（无标题的故事以主题代称）。"""
    titles = []
    for story in char.stories:
        if story.is_deleted:
            continue
        titles.append(story.title or story.theme or "未命名故事")
    return titles


@router.get("", response_model=list[CharacterOut])
async def list_characters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Character)
        .options(selectinload(Character.stories))
        .order_by(Character.created_at.desc(), Character.id.desc())
    )
    return [
        CharacterOut(
            id=char.id,
            nickname=char.nickname,
            avatar_type=char.avatar_type,
            avatar_color=char.avatar_color,
            personality=char.personality,
            age_group=char.age_group,
            created_at=char.created_at,
            story_titles=_story_titles(char),
        )
        for char in result.scalars().all()
    ]


@router.post("", response_model=CharacterOut, status_code=status.HTTP_201_CREATED)
async def create_character(req: CharacterCreate, db: AsyncSession = Depends(get_db)):
    char = Character(
        nickname=req.nickname,
        avatar_type=req.avatar_type,
        avatar_color=req.avatar_color,
        personality=req.personality,
        age_group=req.age_group,
    )
    db.add(char)
    await db.commit()
    await db.refresh(char)
    return char


@router.get("/{character_id}", response_model=CharacterOut)
async def get_character(character_id: int, db: AsyncSession = Depends(get_db)):
    char = await db.get(Character, character_id)
    if not char:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在")
    return char


@router.patch("/{character_id}", response_model=CharacterOut)
async def update_character(
    character_id: int,
    req: CharacterUpdate,
    db: AsyncSession = Depends(get_db),
):
    char = await db.get(Character, character_id)
    if not char:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在")
    char.age_group = req.age_group
    await db.commit()
    await db.refresh(char)
    return char


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(character_id: int, db: AsyncSession = Depends(get_db)):
    char = await db.get(Character, character_id)
    if not char:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在")
    await db.delete(char)
    await db.commit()
