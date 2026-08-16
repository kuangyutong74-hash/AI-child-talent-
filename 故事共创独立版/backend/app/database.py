from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with engine.connect() as conn:
        await _migrate(conn)


async def _migrate(conn):
    """SQLite 增量迁移。

    注意：PRAGMA table_info 需要在单独的事务中执行，旧版自动迁移里的
    无条件 ALTER + try/except 已不再需要；新增迁移按顺序追加即可。
    """
    # v2：移除账号体系 —— 删除 users 表，重建不含 user_id 的 characters 表。
    # 保留角色、故事、消息与观察数据（去除的只是登录账号相关数据）。
    users_exist = (
        await conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        )
    ).fetchone()
    if users_exist:
        await conn.exec_driver_sql("DROP TABLE users")

    char_columns = {
        row[1]
        for row in (await conn.exec_driver_sql("PRAGMA table_info(characters)")).fetchall()
    }
    if "user_id" in char_columns:
        # SQLite 缺少 DROP COLUMN 之前的重建套路，兼容旧版本 SQLite。
        await conn.exec_driver_sql(
            """
            CREATE TABLE characters_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname VARCHAR(100) NOT NULL,
                avatar_type VARCHAR(50) NOT NULL,
                avatar_color VARCHAR(7) NOT NULL,
                personality TEXT,
                age_group VARCHAR(10),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        await conn.exec_driver_sql(
            """
            INSERT INTO characters_new
                (id, nickname, avatar_type, avatar_color, personality, age_group, created_at)
            SELECT id, nickname, avatar_type, avatar_color, personality, age_group, created_at
            FROM characters
            """
        )
        await conn.exec_driver_sql("DROP TABLE characters")
        await conn.exec_driver_sql("ALTER TABLE characters_new RENAME TO characters")
        await conn.commit()
