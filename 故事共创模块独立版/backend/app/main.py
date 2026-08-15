import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.routers import characters, dictionary, observations, stories, talents, tts


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="AI 伯乐 - 故事共创独立版",
    description="与孩子共同创作故事，发现语言与创造力天赋",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(_: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"服务器出了点小问题：{str(exc)[:200]}"},
    )


app.include_router(characters.router, prefix="/api/v1")
app.include_router(stories.router, prefix="/api/v1")
app.include_router(observations.router, prefix="/api/v1")
app.include_router(talents.router, prefix="/api/v1")
app.include_router(dictionary.router, prefix="/api/v1")
app.include_router(tts.router, prefix="/api/v1")


@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "故事共创独立版后端已就绪"}
