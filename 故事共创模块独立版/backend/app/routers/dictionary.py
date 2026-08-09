from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.llm_service import get_llm_service

router = APIRouter(prefix="/dictionary", tags=["dictionary"])


@router.get("/lookup")
async def lookup_word(
    word: str,
    age_group: str = "8-12",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Look up a word's definition using DeepSeek, explained in child-friendly language."""
    if not word or not word.strip():
        return {"word": word, "definition": ""}

    word = word.strip()
    llm = get_llm_service()

    # Build age-appropriate prompt
    if age_group == "4-7":
        prompt = f"""请解释词语「{word}」的意思，要求：
- 用4-5岁小朋友能听懂的话解释
- 举一个生活中常见的小例子
- 总共2-3句话，不要超过60个字
- 直接给出解释，不要加前缀（如"这个词的意思是"）"""
    else:
        prompt = f"""请解释词语「{word}」的意思，要求：
- 用8-12岁孩子能听懂的话解释
- 给出词性和一个生动的例句
- 总共2-3句话，不要超过80个字
- 直接给出解释，不要加前缀"""

    try:
        stream = await llm.client.chat.completions.create(
            model=llm.model,
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            temperature=0.3,
            max_tokens=150,
            timeout=10.0,
        )
        definition = stream.choices[0].message.content
        return {"word": word, "definition": definition.strip() if definition else f"暂时没有找到「{word}」的释义"}
    except Exception:
        return {"word": word, "definition": f"网络出了点小问题，稍后再查「{word}」吧~"}
