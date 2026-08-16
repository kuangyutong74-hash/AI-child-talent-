"""Free Microsoft Edge online speech synthesis with local MP3 caching."""

import hashlib
from pathlib import Path

import edge_tts

from app.config import PROJECT_DIR, settings


CACHE_DIR = PROJECT_DIR / ".cache" / "tts"


class TTSServiceError(Exception):
    pass


def _cache_path(text: str) -> Path:
    identity = "|".join(
        (
            settings.edge_tts_voice,
            settings.edge_tts_rate,
            settings.edge_tts_pitch,
            text,
        )
    )
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{digest}.mp3"


async def synthesize(text: str) -> bytes:
    clean_text = text.strip()
    if not clean_text:
        raise TTSServiceError("朗读内容不能为空")

    cache_path = _cache_path(clean_text)
    if cache_path.exists():
        return cache_path.read_bytes()

    communicate = edge_tts.Communicate(
        clean_text,
        voice=settings.edge_tts_voice,
        rate=settings.edge_tts_rate,
        volume="+0%",
        pitch=settings.edge_tts_pitch,
    )
    audio_parts: list[bytes] = []
    try:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_parts.append(chunk["data"])
    except Exception as exc:
        raise TTSServiceError("免费在线语音服务暂时不可用") from exc

    if not audio_parts:
        raise TTSServiceError("免费在线语音未返回音频")

    audio = b"".join(audio_parts)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(audio)
    return audio
