from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.models.user import User
from app.services.tts_service import TTSServiceError, synthesize


router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.post("")
async def create_speech(
    req: TTSRequest,
    _: User = Depends(get_current_user),
):
    try:
        audio = await synthesize(req.text)
    except TTSServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "private, max-age=86400"},
    )
