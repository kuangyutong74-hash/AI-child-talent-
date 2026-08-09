from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.models.character import Character
from app.schemas.user import AuthResponse, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(req: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if username exists
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="这个用户名已经被使用啦，换一个吧！",
        )

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        display_name=req.display_name or req.username,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # The guide belongs to the first authenticated session only.
    user.has_seen_onboarding = True
    await db.commit()

    token = create_token(user.id)
    return AuthResponse(
        token=token,
        user=UserOut(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            age_group=user.age_group,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
        show_onboarding=True,
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码不对哦，再试试吧！",
        )

    token = create_token(user.id)
    show_onboarding = not user.has_seen_onboarding
    if show_onboarding:
        user.has_seen_onboarding = True
        await db.commit()
    return AuthResponse(
        token=token,
        user=UserOut(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            age_group=user.age_group,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
        show_onboarding=show_onboarding,
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        username=current_user.username,
        display_name=current_user.display_name,
        age_group=current_user.age_group,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


@router.patch("/me/channel")
async def update_channel(
    age_group: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's age group channel."""
    if age_group not in ("4-7", "8-12"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的年龄段")
    current_user.age_group = age_group
    await db.execute(
        update(Character)
        .where(Character.user_id == current_user.id)
        .values(age_group=age_group)
    )
    await db.commit()
    return {"age_group": age_group}
