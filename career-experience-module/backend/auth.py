"""
Authentication module — password hashing, token management, FastAPI dependencies.
Uses only Python stdlib (hashlib.pbkdf2_hmac + os.urandom) — no extra deps.
"""
import os
import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, AuthToken, Session


# ---- Password hashing (pbkdf2_hmac, stdlib only) ----

def hash_password(password: str) -> tuple[str, str]:
    """Hash a password with a random salt. Returns (hex_hash, hex_salt)."""
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000, dklen=64)
    return key.hex(), salt.hex()


def verify_password(password: str, salt_hex: str, stored_hash: str) -> bool:
    """Check a password against the stored hash and salt."""
    try:
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000, dklen=64)
        return secrets.compare_digest(key.hex(), stored_hash)
    except (ValueError, TypeError):
        return False


# ---- Token management ----

def generate_auth_token() -> str:
    """Generate a cryptographically random auth token (64 hex chars)."""
    return secrets.token_hex(32)


# ---- User CRUD ----

async def create_user(
    db: AsyncSession,
    username: str,
    password: str,
    display_name: str,
    age: int,
) -> User:
    """Create a new user account. Raises ValueError if username is taken."""
    username = username.strip().lower()
    if not (3 <= len(username) <= 20):
        raise ValueError("用户名需要3–20个字符")
    if len(password) < 4:
        raise ValueError("密码至少需要4个字符")

    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalar_one_or_none():
        raise ValueError("这个用户名已经被注册了，换一个试试？")

    key_hex, salt_hex = hash_password(password)
    user = User(
        id=str(uuid.uuid4()),
        username=username,
        password_hash=key_hex,
        salt=salt_hex,
        display_name=display_name.strip()[:50] or username,
        age=age,
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(db: AsyncSession, username: str, password: str) -> tuple[User, str] | None:
    """Verify credentials and create an auth token. Returns (user, token) or None."""
    username = username.strip().lower()
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if not verify_password(password, user.salt, user.password_hash):
        return None

    token_str = generate_auth_token()
    db.add(AuthToken(id=str(uuid.uuid4()), user_id=user.id, token=token_str))
    await db.flush()
    return user, token_str


async def get_user_by_token(db: AsyncSession, token: str) -> User | None:
    """Look up a user by their auth token. Returns None if invalid/expired."""
    token = token.strip()
    if len(token) < 32:
        return None
    result = await db.execute(
        select(User)
        .join(AuthToken, AuthToken.user_id == User.id)
        .where(AuthToken.token == token)
    )
    return result.scalar_one_or_none()


async def invalidate_token(db: AsyncSession, token: str) -> None:
    """Delete an auth token (logout)."""
    token = token.strip()
    result = await db.execute(select(AuthToken).where(AuthToken.token == token))
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.flush()


# ---- FastAPI dependencies ----

# Will be set after app and async_session are created (in main.py)
_db_sessionmaker = None


def set_db_sessionmaker(sessionmaker):
    global _db_sessionmaker
    _db_sessionmaker = sessionmaker


async def get_db() -> AsyncSession:
    """Yield a database session. Used by FastAPI dependency injection."""
    if _db_sessionmaker is None:
        raise RuntimeError("DB sessionmaker not initialized — call set_db_sessionmaker()")
    async with _db_sessionmaker() as db:
        yield db


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency — extracts and validates the Bearer token.
    Raises 401 if the token is missing or invalid.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="请先登录")
    token = auth.removeprefix("Bearer ").strip()
    user = await get_user_by_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising 401."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.removeprefix("Bearer ").strip()
    return await get_user_by_token(db, token)


# ---- Claim old sessions ----

async def claim_old_sessions(db: AsyncSession, user: User) -> int:
    """Associate completed sessions (user_id IS NULL) with this user account.
    Matches by display_name and by existing student_token patterns.
    Returns the number of sessions claimed.
    """
    # 姓名并不是可靠身份凭据。为了避免把同名学生的体验记录错认领到
    # 当前账号，历史匿名数据不再自动迁移；之后可由教师后台走人工确认流程。
    return 0

    count = 0

    # Strategy 1: match by display_name
    result = await db.execute(
        select(Session).where(
            Session.student_name == user.display_name,
            Session.user_id == None,
            Session.status == "completed",
        )
    )
    for s in result.scalars().all():
        s.user_id = user.id
        count += 1

    # Strategy 2: also match by username as student_name
    if user.username != user.display_name:
        result = await db.execute(
            select(Session).where(
                Session.student_name == user.username,
                Session.user_id == None,
                Session.status == "completed",
            )
        )
        for s in result.scalars().all():
            if s.user_id is None:
                s.user_id = user.id
                count += 1

    await db.flush()
    return count
