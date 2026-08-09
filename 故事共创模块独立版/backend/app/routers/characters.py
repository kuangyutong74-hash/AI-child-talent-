from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.character import Character
from app.models.user import User
from app.schemas.character import CharacterCreate, CharacterOut, CharacterUpdate

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("", response_model=list[CharacterOut])
async def list_characters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Character).where(Character.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("", response_model=CharacterOut, status_code=status.HTTP_201_CREATED)
async def create_character(
    req: CharacterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    char = Character(
        user_id=current_user.id,
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
async def get_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    char = await db.get(Character, character_id)
    if not char or char.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在")
    return char


@router.patch("/{character_id}", response_model=CharacterOut)
async def update_character(
    character_id: int,
    req: CharacterUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    char = await db.get(Character, character_id)
    if not char or char.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在")
    char.age_group = req.age_group
    await db.commit()
    await db.refresh(char)
    return char


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    char = await db.get(Character, character_id)
    if not char or char.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在")
    await db.delete(char)
    await db.commit()
