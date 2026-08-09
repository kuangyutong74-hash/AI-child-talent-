"""
Configuration management for Career Experience Simulator.
Loads from .env file first, then environment variables.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load .env file (if exists, overrides nothing if variable already set)
load_dotenv(BASE_DIR / ".env", override=True)

STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR / 'career_sim.db'}")

# DeepSeek API (OpenAI-compatible)
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_API_BASE = os.getenv("AI_API_BASE", "https://api.deepseek.com/v1")
AI_MODEL = os.getenv("AI_MODEL", "deepseek-chat")
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "500"))
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.7"))
AI_TIMEOUT = int(os.getenv("AI_TIMEOUT", "30"))
AI_ENABLED = bool(AI_API_KEY)

APP_TITLE = "职业体验模拟器"
APP_VERSION = "1.0.0"
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
# 教师关注队列使用独立密钥保护；未配置时，相关接口保持关闭，避免把学生安全记录暴露出来。
TEACHER_REVIEW_KEY = os.getenv("TEACHER_REVIEW_KEY", "").strip()

DECISION_TOO_FAST_MS = 1000
DECISION_TOO_SLOW_MS = 300000
MAX_MODIFICATION_COUNT = 10
MAX_FOLLOW_UP_ROUNDS = 3
MIN_AGE = 6
MAX_AGE = 14
