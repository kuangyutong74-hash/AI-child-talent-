"""
Career Experience Simulator — FastAPI Application
"""
import uuid, traceback, sys, hashlib, re, mimetypes, json, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / "vendor"))
import edge_tts
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Form, Body, Depends, Header
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from config import *
from models import Base, Session, ScenarioRecord, ChoiceRecord, FollowUpRecord, ObservationRecord, WorkdayProcessRecord, Report, User, AuthToken, SafetyEvent
from career_data import CAREERS, SCENARIOS
from services import generate_follow_up_question, build_follow_up_feedback, analyze_session_behavior, generate_final_report, build_report_evidence, build_teacher_evidence, build_workday_process_evidence, build_workday_direct_task_records, get_developmental_context, assess_student_input, assess_report_eligibility, build_cross_career_summary, generate_cross_career_narrative, build_cross_career_teacher_view
from auth import (
    set_db_sessionmaker, get_db, get_current_user, get_current_user_optional,
    create_user, authenticate_user, invalidate_token, generate_auth_token, claim_old_sessions,
)

engine = create_async_engine(DATABASE_URL, echo=DEBUG)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
set_db_sessionmaker(async_session)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Preserve the independent first thought for ZPD comparison on existing Demo databases.
        try:
            columns = (await conn.execute(text("PRAGMA table_info(follow_up_records)"))).mappings().all()
            if "initial_thought" not in {row["name"] for row in columns}:
                await conn.execute(text("ALTER TABLE follow_up_records ADD COLUMN initial_thought TEXT"))
        except Exception as exc:
            print(f"ZPD schema check skipped: {exc}", file=sys.stderr)
        # 轻量学生身份关联：为新数据库或旧数据库补上 student_token 列
        try:
            session_cols = (await conn.execute(text("PRAGMA table_info(sessions)"))).mappings().all()
            if "student_token" not in {row["name"] for row in session_cols}:
                await conn.execute(text("ALTER TABLE sessions ADD COLUMN student_token VARCHAR(64)"))
        except Exception as exc:
            print(f"student_token migration skipped: {exc}", file=sys.stderr)
        # 账号系统：为新数据库或旧数据库补上 user_id 列
        try:
            session_cols2 = (await conn.execute(text("PRAGMA table_info(sessions)"))).mappings().all()
            if "user_id" not in {row["name"] for row in session_cols2}:
                await conn.execute(text("ALTER TABLE sessions ADD COLUMN user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL"))
        except Exception as exc:
            print(f"user_id migration skipped: {exc}", file=sys.stderr)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await engine.dispose()

app = FastAPI(title=APP_TITLE, version="1.0.0", lifespan=lifespan)
# Windows may not know the WebP extension by default; declare it so mobile browsers receive image content correctly.
mimetypes.add_type("image/webp", ".webp")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
TTS_DIR = STATIC_DIR / "tts"
TTS_DIR.mkdir(parents=True, exist_ok=True)
TTS_VOICES = {
    "scene": ("zh-CN-XiaoxiaoNeural", "+0%"),
    "mentor": ("zh-CN-XiaoyiNeural", "-8%"),
    "lively": ("zh-CN-YunxiNeural", "+4%"),
}

@app.get("/api/tts")
async def api_tts(text: str, role: str = "scene"):
    """Generate and cache a short neural-voice clip; browser speech is only a fallback."""
    clean_text = re.sub(r"\s+", " ", text or "").strip()
    clean_text = re.sub(r"[🎯✨💡🔮🎙️]", "", clean_text)
    if not clean_text:
        raise HTTPException(400, detail="缺少朗读内容")
    if len(clean_text) > 500:
        clean_text = clean_text[:500]
    voice, rate = TTS_VOICES.get(role, TTS_VOICES["scene"])
    clip_id = hashlib.sha256(f"{voice}|{rate}|{clean_text}".encode("utf-8")).hexdigest()[:24]
    filename = f"{clip_id}.mp3"
    target = TTS_DIR / filename
    if not target.exists():
        try:
            await edge_tts.Communicate(clean_text, voice=voice, rate=rate).save(str(target))
        except Exception as exc:
            raise HTTPException(503, detail="神经语音暂时不可用") from exc
    return {"url": f"/static/tts/{filename}", "voice": voice}

# === PAGE ROUTES ===
@app.get("/", response_class=HTMLResponse)
async def page_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/careers", response_class=HTMLResponse)
async def page_careers(request: Request):
    # Enrich careers with scenario_titles for the frontend
    enriched = []
    for c in CAREERS:
        c_copy = dict(c)
        c_copy["scenario_titles"] = [s["title"] for s in SCENARIOS.get(c["id"], [])]
        enriched.append(c_copy)
    return templates.TemplateResponse("career_select.html", {"request": request, "careers": enriched})

@app.get("/my-exploration", response_class=HTMLResponse)
async def page_my_exploration(request: Request):
    return templates.TemplateResponse("my_exploration.html", {"request": request})


@app.get("/observer", response_class=HTMLResponse)
async def page_observer_dashboard(request: Request):
    """独立的教师/家长观察台；儿童探索中心仅保留入口。"""
    return templates.TemplateResponse("observer_dashboard.html", {"request": request})

@app.get("/scenario/{session_id}/{scenario_index}", response_class=HTMLResponse)
async def page_scenario(request: Request, session_id: str, scenario_index: int):
    return templates.TemplateResponse("scenario.html", {"request": request, "session_id": session_id, "scenario_index": scenario_index})

@app.get("/workday/{career_id}", response_class=HTMLResponse)
async def page_workday(request: Request, career_id: str):
    career = next((c for c in CAREERS if c["id"] == career_id), None)
    if not career: raise HTTPException(404, detail="职业未找到")
    return templates.TemplateResponse("workday.html", {"request": request, "career": career})

@app.get("/login", response_class=HTMLResponse)
async def page_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/report/{session_id}", response_class=HTMLResponse)
async def page_report(request: Request, session_id: str):
    return templates.TemplateResponse("report.html", {"request": request, "session_id": session_id})

# === API: AUTH ===

@app.post("/api/auth/register")
async def api_auth_register(payload: dict = Body(...)):
    """注册新账号。Body: {username, password, display_name, age}。返回 token。"""
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    display_name = str(payload.get("display_name", "")).strip() or username
    try:
        age = int(payload.get("age", 10))
    except (TypeError, ValueError):
        age = 10
    if age < MIN_AGE or age > MAX_AGE:
        raise HTTPException(400, detail=f"年龄需要在{MIN_AGE}–{MAX_AGE}岁之间")

    async with async_session() as db:
        try:
            user = await create_user(db, username, password, display_name, age)
        except ValueError as e:
            raise HTTPException(409, detail=str(e))

        token_str = generate_auth_token()
        db.add(AuthToken(id=str(uuid.uuid4()), user_id=user.id, token=token_str))

        # 自动关联旧会话
        claimed = await claim_old_sessions(db, user)
        await db.commit()

        return {
            "token": token_str,
            "user": {
                "id": user.id, "username": user.username,
                "display_name": user.display_name, "age": user.age,
            },
            "claimed_sessions": claimed,
        }


@app.post("/api/auth/login")
async def api_auth_login(payload: dict = Body(...)):
    """登录。Body: {username, password}。返回 token。"""
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    async with async_session() as db:
        result = await authenticate_user(db, username, password)
        if result is None:
            raise HTTPException(401, detail="用户名或密码不对，再试试看？")
        user, token_str = result

        # 自动关联旧会话
        claimed = await claim_old_sessions(db, user)
        await db.commit()

        return {
            "token": token_str,
            "user": {
                "id": user.id, "username": user.username,
                "display_name": user.display_name, "age": user.age,
            },
            "claimed_sessions": claimed,
        }


@app.post("/api/auth/logout")
async def api_auth_logout(user: User = Depends(get_current_user), authorization: str = Header("")):
    """登出，使当前 token 失效。"""
    token = authorization.removeprefix("Bearer ").strip()
    async with async_session() as db:
        await invalidate_token(db, token)
        await db.commit()
    return {"success": True}


@app.get("/api/auth/me")
async def api_auth_me(user: User | None = Depends(get_current_user_optional)):
    """检查登录状态，返回当前用户信息。未登录返回 authenticated: false。"""
    if user is None:
        return {"authenticated": False, "user": None}
    return {
        "authenticated": True,
        "user": {
            "id": user.id, "username": user.username,
            "display_name": user.display_name, "age": user.age,
        },
    }


# === API: USER DATA (authenticated) ===

@app.get("/api/user/summary")
async def api_user_summary(user: User = Depends(get_current_user)):
    """已登录用户的跨职业综合成长报告。"""
    async with async_session() as db:
        result = await db.execute(
            select(Session).where(
                Session.user_id == user.id,
                Session.status == "completed",
            ).order_by(Session.completed_at.asc())
        )
        sessions = result.scalars().all()

        if not sessions:
            return {
                "career_count": 0, "careers": [], "student_age": user.age,
                "developmental_context": get_developmental_context(user.age),
                "dimension_summaries": [], "teacher_chains": [],
                "ai_summary": "", "single_career_warning": None,
                "message": "还没有完成过职业体验。去探索一座职业小岛吧！",
            }

        # Load behavioral records for each session (same pattern as single report)
        sessions_data = []
        for session in sessions:
            sr_result = await db.execute(
                select(ScenarioRecord).where(
                    ScenarioRecord.session_id == session.id
                ).order_by(ScenarioRecord.scenario_index)
            )
            srs = sr_result.scalars().all()
            all_records = []
            for sr in srs:
                cr_result = await db.execute(
                    select(ChoiceRecord).where(ChoiceRecord.scenario_record_id == sr.id)
                )
                for c in cr_result.scalars().all():
                    rec = {
                        "scenario_title": sr.scenario_title,
                        "choice_text": c.choice_text, "choice_index": c.choice_index,
                        "choice_id": c.choice_id, "decision_time_ms": c.decision_time_ms,
                        "modification_count": c.modification_count, "indicators": {}, "ecd": {},
                    }
                    fur = await db.execute(select(FollowUpRecord).where(FollowUpRecord.choice_record_id == c.id))
                    fu = fur.scalar_one_or_none()
                    if fu:
                        rec.update(follow_up_question=fu.ai_question, follow_up_answer=fu.student_answer or "", follow_up_rounds=fu.follow_up_rounds)
                    cs = SCENARIOS.get(session.career_id, [])
                    if sr.scenario_index < len(cs):
                        for opt in cs[sr.scenario_index]["options"]:
                            if opt["id"] == c.choice_id:
                                rec["indicators"] = opt.get("indicators", {})
                                rec["ecd"] = cs[sr.scenario_index].get("ecd", {})
                    all_records.append(rec)
            sessions_data.append({
                "career_name": session.career_name, "career_id": session.career_id,
                "student_age": session.age, "records": all_records,
            })

    summary = build_cross_career_summary(sessions_data)
    ai_summary = await generate_cross_career_narrative(summary)
    teacher_chains = build_cross_career_teacher_view(summary)

    return {
        "career_count": summary["career_count"], "careers": summary["careers"],
        "student_age": summary["student_age"],
        "developmental_context": summary["developmental_context"],
        "dimension_summaries": summary["dimension_summaries"],
        "teacher_chains": teacher_chains, "ai_summary": ai_summary,
        "single_career_warning": summary["single_career_warning"], "message": None,
    }


@app.get("/api/user/explored-careers")
async def api_user_explored_careers(user: User = Depends(get_current_user)):
    """返回该用户已完成的职业列表和对应的报告 session_id 映射。"""
    async with async_session() as db:
        result = await db.execute(
            select(Session).where(
                Session.user_id == user.id,
                Session.status == "completed",
            ).order_by(Session.completed_at.desc())
        )
        career_map = {}
        seen = set()
        for s in result.scalars().all():
            if s.career_id not in seen:
                seen.add(s.career_id)
                career_map[s.career_id] = s.id
    return {"explored_careers": list(seen), "career_session_map": career_map}


@app.post("/api/user/mark-explored")
async def api_user_mark_explored(
    payload: dict = Body(...),
    user: User = Depends(get_current_user),
):
    """将一个职业标记为已探索（服务端记录）。"""
    career_id = str(payload.get("career_id", ""))
    # This is a no-op for now — exploration status is derived from completed sessions.
    # The endpoint exists so the frontend can sync without changing localStorage logic.
    return {"success": True, "career_id": career_id}


@app.get("/api/exploration/feed")
async def api_exploration_feed(
    user: User | None = Depends(get_current_user_optional),
    x_student_token: str = Header("", alias="X-Student-Token"),
):
    """A child-safe activity feed and repeat-experience history for the current owner only."""
    student_token = x_student_token.strip()[:64] if len(x_student_token.strip()) >= 8 else ""
    async with async_session() as db:
        if user is not None:
            query = select(Session).where(
                Session.user_id == user.id, Session.status == "completed"
            ).order_by(Session.completed_at.desc())
        elif student_token:
            query = select(Session).where(
                Session.student_token == student_token, Session.status == "completed"
            ).order_by(Session.completed_at.desc())
        else:
            return {"activities": [], "career_history": [], "career_count": 0}
        sessions = (await db.execute(query)).scalars().all()
        if user is not None:
            active_query = select(Session).where(Session.user_id == user.id, Session.status == "in_progress")
        else:
            active_query = select(Session).where(Session.student_token == student_token, Session.status == "in_progress")
        active_sessions = (await db.execute(active_query)).scalars().all()
        session_ids = [item.id for item in sessions]
        workday_map, report_map = {}, {}
        if session_ids:
            workdays = (await db.execute(select(WorkdayProcessRecord).where(WorkdayProcessRecord.session_id.in_(session_ids)))).scalars().all()
            reports = (await db.execute(select(Report).where(Report.session_id.in_(session_ids)))).scalars().all()
            workday_map = {item.session_id: (item.process_data or {}) for item in workdays}
            report_map = {item.session_id: item for item in reports}

    seen_careers = set()
    repeat_counts = {}
    chronological = list(reversed(sessions))
    for item in chronological:
        repeat_counts[item.career_id] = repeat_counts.get(item.career_id, 0) + 1

    activities = []
    for item in sessions:
        seen_careers.add(item.career_id)
        round_no = repeat_counts.get(item.career_id, 1)
        activities.append({
            "type": "repeat" if round_no > 1 else "completed",
            "career_id": item.career_id,
            "career_name": item.career_name,
            "session_id": item.id,
            "round": round_no,
            "scenario_count": len(SCENARIOS.get(item.career_id, [])),
            "completed_at": item.completed_at.isoformat() if item.completed_at else "",
        })
        repeat_counts[item.career_id] = max(0, round_no - 1)

    history = [
        {
            "career_id": item.career_id, "career_name": item.career_name,
            "session_id": item.id,
            "round": sum(1 for earlier in chronological[:idx + 1] if earlier.career_id == item.career_id),
            "completed_at": item.completed_at.isoformat() if item.completed_at else "",
            "scenario_count": len(SCENARIOS.get(item.career_id, [])),
            "workday_process": workday_map.get(item.id, {}),
            "evidence_clues": [str(x.get("name", "")) for x in ((report_map.get(item.id).strengths if report_map.get(item.id) else []) or [])[:3]],
            "student_feedback": (report_map.get(item.id).personalized_message if report_map.get(item.id) else "") or "",
        }
        for idx, item in enumerate(chronological)
    ]
    return {
        "activities": activities,
        "career_history": list(reversed(history)),
        "career_count": len(seen_careers),
        "experience_count": len(sessions),
        "active_careers": [{"career_id": item.career_id, "session_id": item.id, "scenario_index": item.current_scenario_index} for item in active_sessions],
    }


# === API: CAREERS ===
@app.get("/api/careers")
async def api_get_careers():
    return {"careers": [{
        "id":c["id"],"name":c["name"],"icon":c["icon"],"tagline":c["tagline"],
        "description":c["description"],"color":c["color"],"bg_gradient":c["bg_gradient"],
        "difficulty":c["difficulty"],"skills_intro":c["skills_intro"],
        "scenario_count":len(SCENARIOS.get(c["id"],[])),
        "scenario_titles":[s["title"] for s in SCENARIOS.get(c["id"],[])]
    } for c in CAREERS]}

@app.get("/api/sessions/latest-by-career")
async def api_latest_sessions_by_career(
    user: User | None = Depends(get_current_user_optional),
    x_student_token: str = Header("", alias="X-Student-Token"),
):
    """Return only the current student's latest completed session for each career."""
    result_map = {}
    student_token = x_student_token.strip()[:64] if len(x_student_token.strip()) >= 8 else ""
    async with async_session() as db:
        if user is not None:
            completed = await db.execute(
                select(Session).where(
                    Session.user_id == user.id,
                    Session.status == "completed",
                ).order_by(Session.completed_at.desc())
            )
        elif student_token:
            completed = await db.execute(
                select(Session).where(
                    Session.student_token == student_token,
                    Session.status == "completed",
                ).order_by(Session.completed_at.desc())
            )
        else:
            return {"career_session_map": {}}
        seen = set()
        for s in completed.scalars().all():
            if s.career_id not in seen:
                seen.add(s.career_id)
                result_map[s.career_id] = s.id
    return {"career_session_map": result_map}

# === API: SESSION ===
@app.post("/api/session/start")
async def api_start_session(
    student_name: str=Form(...), age: int=Form(...), career_id: str=Form(...),
    student_token: str=Form(""),
    user: User | None = Depends(get_current_user_optional),
):
    # 已登录用户：自动用账号信息覆盖表单（表单参数仍有值作为 fallback）
    if user is not None:
        student_name = user.display_name
        age = user.age

    if not student_name or len(student_name.strip())<1 or len(student_name.strip())>30:
        raise HTTPException(400, detail="名字长度需要在1-30个字符之间")
    if age<MIN_AGE or age>MAX_AGE:
        raise HTTPException(400, detail=f"年龄需要在{MIN_AGE}-{MAX_AGE}岁之间")
    career = next((c for c in CAREERS if c["id"]==career_id), None)
    if not career: raise HTTPException(404, detail="未找到该职业")

    sid = str(uuid.uuid4())
    token = (student_token or "").strip()[:64]
    async with async_session() as db:
        s = Session(id=sid, student_name=student_name.strip(), age=age,
            career_id=career_id, career_name=career["name"],
            student_token=token if token else None,
            user_id=user.id if user else None)
        db.add(s); await db.commit()
    return {"session_id":sid, "career":{"id":career["id"],"name":career["name"],
        "total_scenarios":len(SCENARIOS[career_id])}, "redirect_url":f"/scenario/{sid}/0"}

# === API: SCENARIO ===
@app.get("/api/scenario/{session_id}/{scenario_index}")
async def api_get_scenario(session_id: str, scenario_index: int):
    async with async_session() as db:
        try:
            session = await db.get(Session, session_id)
            if not session: raise HTTPException(404, detail="会话未找到")
            career_s = SCENARIOS.get(session.career_id, [])
            if scenario_index<0 or scenario_index>=len(career_s):
                raise HTTPException(404, detail="情境未找到")
            sc = career_s[scenario_index]

            result = await db.execute(select(ScenarioRecord).where(
                ScenarioRecord.session_id==session_id, ScenarioRecord.scenario_index==scenario_index))
            srs = result.scalars().all()  # use .all() to avoid scalar_one_or_none error
            sr = srs[0] if srs else None
            if not sr:
                sr = ScenarioRecord(id=str(uuid.uuid4()), session_id=session_id,
                    scenario_index=scenario_index, scenario_id=sc["id"], scenario_title=sc["title"])
                db.add(sr); await db.commit(); await db.refresh(sr)
            elif len(srs) > 1:
                # Deduplicate: keep first, delete others
                for extra in srs[1:]:
                    await db.delete(extra)
                await db.commit()

            prev_result = await db.execute(
                select(ChoiceRecord)
                .options(selectinload(ChoiceRecord.scenario_record))
                .join(ChoiceRecord.scenario_record)
                .where(ScenarioRecord.session_id==session_id, ScenarioRecord.scenario_index<scenario_index)
                .order_by(ScenarioRecord.scenario_index))
            prev = prev_result.scalars().all()
            prev_ctx = [{"scenario_title":cr.scenario_record.scenario_title,"choice_text":cr.choice_text,"choice_id":cr.choice_id} for cr in prev]

            session.current_scenario_index = scenario_index; await db.commit()

            return {"scenario":{"id":sc["id"],"index":scenario_index,"title":sc["title"],"scene":sc["scene"],
                "dialogues":sc["dialogues"],"choice_prompt":sc["choice_prompt"],
                "options":[{"id":o["id"],"text":o["text"],"indicators":o.get("indicators",{}),"possible_outcome":o.get("possible_outcome","")} for o in sc["options"]],
                "follow_up_config":sc["follow_up_config"]},
                "progress":{"current":scenario_index+1,"total":len(career_s),"career_name":session.career_name,"career_id":session.career_id},
                "session":{"student_name":session.student_name,"age":session.age},
                "previous_context":prev_ctx, "scenario_record_id":sr.id}
        except HTTPException: raise
        except Exception as e:
            print(f"ERROR in api_get_scenario: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            raise HTTPException(500, detail=str(e))

@app.post("/api/scenario/{session_id}/{scenario_index}/choose")
async def api_submit_choice(session_id:str, scenario_index:int, choice_id:str=Form(...),
    choice_text:str=Form(...), choice_index:int=Form(...), decision_time_ms:int=Form(...),
    modification_count:int=Form(0)):
    async with async_session() as db:
        session = await db.get(Session, session_id)
        if not session: raise HTTPException(404, detail="会话未找到")
        result = await db.execute(select(ScenarioRecord).where(
            ScenarioRecord.session_id==session_id, ScenarioRecord.scenario_index==scenario_index))
        srs = result.scalars().all(); sr = srs[0] if srs else None
        if not sr: raise HTTPException(404, detail="情境记录未找到")

        cr = ChoiceRecord(id=str(uuid.uuid4()), scenario_record_id=sr.id,
            choice_index=choice_index, choice_id=choice_id, choice_text=choice_text,
            decision_time_ms=decision_time_ms, modification_count=modification_count, is_final=True)
        db.add(cr); await db.commit(); await db.refresh(cr)

        prev_result = await db.execute(
            select(ChoiceRecord)
            .options(selectinload(ChoiceRecord.scenario_record))
            .join(ChoiceRecord.scenario_record)
            .where(ScenarioRecord.session_id==session_id)
            .order_by(ScenarioRecord.scenario_index))
        all_c = prev_result.scalars().all()
        prev_choices = [{"scenario_title":c.scenario_record.scenario_title,"choice_text":c.choice_text} for c in all_c[:-1]]

        career_s = SCENARIOS.get(session.career_id, [])
        if scenario_index<len(career_s):
            sd = career_s[scenario_index]
            ctx = " ".join([d["text"] for d in sd["dialogues"]])
            follow_up = await generate_follow_up_question(session.age, session.career_name,
                sd["title"], ctx, choice_text, prev_choices, choice_id)
            fur = FollowUpRecord(id=str(uuid.uuid4()), choice_record_id=cr.id,
                ai_question=follow_up, follow_up_rounds=1)
            db.add(fur); await db.commit()
            return {"has_follow_up":True, "follow_up_question":follow_up,
                "choice_record_id":cr.id, "mentor_name":sd["follow_up_config"]["mentor_name"],
                "next_scenario_index":scenario_index+1 if scenario_index+1<len(career_s) else None,
                "is_last_scenario":scenario_index+1>=len(career_s)}
        return {"has_follow_up":False, "follow_up_question":None,
            "choice_record_id":cr.id, "next_scenario_index":None, "is_last_scenario":True}

@app.post("/api/scenario/{session_id}/{scenario_index}/follow-up")
async def api_submit_follow_up(session_id:str, scenario_index:int,
    answer_text:str=Form(...), choice_record_id:str=Form(...)):
    async with async_session() as db:
        input_safety = assess_student_input(answer_text)
        stored_answer = answer_text if input_safety.get("store_raw", True) else ""
        cr = await db.get(ChoiceRecord, choice_record_id)
        if not cr: raise HTTPException(404, detail="选择记录未找到")
        result = await db.execute(select(FollowUpRecord).where(FollowUpRecord.choice_record_id==choice_record_id))
        fu = result.scalar_one_or_none()
        if fu:
            # Sensitive or identifying text is deliberately not retained in the learning-evidence field.
            fu.student_answer = stored_answer
            fu.follow_up_rounds = 2
            await db.commit()

        session = await db.get(Session, session_id)
        sr_result = await db.execute(select(ScenarioRecord).where(
            ScenarioRecord.session_id==session_id, ScenarioRecord.scenario_index==scenario_index))
        srs2 = sr_result.scalars().all(); sr = srs2[0] if srs2 else None

        if sr:
            sr.completed_at = datetime.now(timezone.utc)
            if input_safety["level"] != "normal":
                sr.is_anomalous = True
                sr.anomaly_notes = json.dumps({
                    "source": "mentor_input", "level": input_safety["level"],
                    "category": input_safety.get("category", ""),
                    "teacher_summary": input_safety.get("teacher_summary", ""),
                    "raw_text_stored": False, "created_at": datetime.now(timezone.utc).isoformat(),
                }, ensure_ascii=False)
                if input_safety.get("pause_mentor"):
                    session.status = "safety_paused"
                # 独立留存最小化安全事件：给人工关注提供“发生了什么类型的保护”，不留学生原文。
                existing_event = await db.execute(select(SafetyEvent).where(
                    SafetyEvent.scenario_record_id == sr.id,
                    SafetyEvent.level == input_safety["level"],
                    SafetyEvent.category == input_safety.get("category", "")
                ))
                if not existing_event.scalar_one_or_none():
                    db.add(SafetyEvent(
                        id=str(uuid.uuid4()), session_id=session.id, scenario_record_id=sr.id,
                        level=input_safety["level"], category=input_safety.get("category", ""),
                        teacher_summary=input_safety.get("teacher_summary", ""),
                        status="new", raw_text_stored=False,
                        student_action="experience_paused" if input_safety.get("pause_mentor") else "gentle_redirect",
                    ))
            behavior = {"scenario_title":sr.scenario_title,"choice_text":cr.choice_text,
                "choice_index":cr.choice_index,"decision_time_ms":cr.decision_time_ms,
                "modification_count":cr.modification_count,
                "follow_up_question":fu.ai_question if fu else "",
                "follow_up_answer":stored_answer,
                "follow_up_rounds":fu.follow_up_rounds if fu else 0,"indicators":{},"ecd":{}}
            cs = SCENARIOS.get(session.career_id, [])
            if scenario_index<len(cs):
                for opt in cs[scenario_index]["options"]:
                    if opt["id"]==cr.choice_id: behavior["indicators"]=opt.get("indicators",{}); behavior["ecd"]=cs[scenario_index].get("ecd",{})
            # A protected input is neither sent to the narrative model nor converted into ECD evidence.
            if not input_safety.get("exclude_from_evidence"):
                obs = await analyze_session_behavior(session.age, session.career_name, [behavior])
                if obs:
                    db.add(ObservationRecord(id=str(uuid.uuid4()), scenario_record_id=sr.id,
                        intelligence_scores=obs.get("intelligence_scores"),
                        literacy_scores=obs.get("literacy_scores"),
                        ai_notes=obs.get("personalized_message","")))
            await db.commit()

        career_s = SCENARIOS.get(session.career_id, [])
        total = len(career_s); is_last = scenario_index+1>=total
        safety_paused = bool(input_safety.get("pause_mentor"))
        action = "pause" if safety_paused else ("redact" if input_safety["level"] == "privacy" else ("redirect" if input_safety["level"] == "redirect" else "continue"))
        return {"success":True,"mentor_feedback":build_follow_up_feedback(answer_text, cr.choice_text),"input_safety_level":input_safety["level"],"input_safety_category":input_safety.get("category",""),"input_safety_message":input_safety.get("message",""),"safety_action":action,"teacher_attention_required":input_safety["needs_attention"],"is_last_scenario":is_last or safety_paused,
            "next_scenario_index":None if safety_paused else (scenario_index+1 if not is_last else None),
            "total_scenarios":total,"completed_scenarios":scenario_index+1,
            "safety_next_step": (
                "请先找一位可信任的大人。此次内容不会进入能力评价；之后可由大人陪伴，从新的轻松任务开始。"
                if safety_paused else ("内容已被保护，不会存入能力证据；修改后可以继续体验。" if action != "continue" else "")
            )}


@app.get("/api/session/{session_id}/safety-status")
async def api_get_safety_status(
    session_id: str,
    user: User | None = Depends(get_current_user_optional),
    x_student_token: str = Header("", alias="X-Student-Token"),
):
    """学生端只可查看自己的保护状态；不返回教师摘要或任何敏感原文。"""
    async with async_session() as db:
        session = await db.get(Session, session_id)
        if not session:
            raise HTTPException(404, detail="体验记录未找到")
        student_token = x_student_token.strip()[:64] if len(x_student_token.strip()) >= 8 else ""
        owned_by_user = user is not None and session.user_id == user.id
        owned_by_browser = user is None and bool(student_token) and session.student_token == student_token
        if not (owned_by_user or owned_by_browser):
            raise HTTPException(404, detail="体验记录未找到")
        result = await db.execute(select(SafetyEvent).where(SafetyEvent.session_id == session_id).order_by(SafetyEvent.created_at.desc()))
        events = result.scalars().all()
        return {
            "session_status": session.status,
            "has_care_pause": any(event.level in {"urgent", "attention"} for event in events),
            "events": [{"level": event.level, "category": event.category, "status": event.status,
                        "created_at": event.created_at.isoformat() if event.created_at else None}
                       for event in events],
        }


@app.get("/api/observer/safety-summary")
async def api_observer_safety_summary(
    user: User | None = Depends(get_current_user_optional),
    x_student_token: str = Header("", alias="X-Student-Token"),
):
    """观察台的最小化安全状态汇总：只返回类别和处理状态，不返回学生原始表达。"""
    student_token = x_student_token.strip()[:64] if len(x_student_token.strip()) >= 8 else ""
    async with async_session() as db:
        query = select(SafetyEvent, Session).join(Session, SafetyEvent.session_id == Session.id)
        if user is not None:
            query = query.where(Session.user_id == user.id)
        elif student_token:
            query = query.where(Session.student_token == student_token)
        else:
            return {"events": [], "pending_count": 0}
        result = await db.execute(query.order_by(SafetyEvent.created_at.desc()))
        events = [{
            "career_name": session.career_name, "level": event.level,
            "category": event.category, "status": event.status,
            "student_action": event.student_action,
            "created_at": event.created_at.isoformat() if event.created_at else None,
            "raw_text_stored": False,
        } for event, session in result.all()]
        return {"events": events, "pending_count": sum(1 for item in events if item["status"] != "closed")}


def _require_teacher_review_key(key: str) -> None:
    """教师队列默认关闭；正式接入时必须使用独立的服务端密钥或教师身份系统。"""
    if not TEACHER_REVIEW_KEY:
        raise HTTPException(503, detail="教师关注队列尚未配置访问密钥")
    if not key or not secrets.compare_digest(key, TEACHER_REVIEW_KEY):
        raise HTTPException(403, detail="无权查看学生安全记录")


@app.get("/api/teacher/safety-events")
async def api_list_teacher_safety_events(
    status: str = "new",
    x_teacher_review_key: str = Header("", alias="X-Teacher-Review-Key"),
):
    """供已授权教师后台调用的最小化关注队列，不返回学生输入原文。"""
    _require_teacher_review_key(x_teacher_review_key)
    allowed = {"new", "reviewing", "closed", "all"}
    if status not in allowed:
        raise HTTPException(400, detail="未知的关注状态")
    async with async_session() as db:
        query = select(SafetyEvent, Session).join(Session, SafetyEvent.session_id == Session.id).order_by(SafetyEvent.created_at.desc())
        if status != "all":
            query = query.where(SafetyEvent.status == status)
        result = await db.execute(query)
        return {"events": [{
            "event_id": event.id, "session_id": session.id, "student_name": session.student_name,
            "age": session.age, "career_name": session.career_name, "level": event.level,
            "category": event.category, "teacher_summary": event.teacher_summary,
            "status": event.status, "student_action": event.student_action,
            "created_at": event.created_at.isoformat() if event.created_at else None,
            "raw_text_stored": False,
        } for event, session in result.all()]}


@app.patch("/api/teacher/safety-events/{event_id}")
async def api_review_teacher_safety_event(
    event_id: str,
    payload: dict = Body(...),
    x_teacher_review_key: str = Header("", alias="X-Teacher-Review-Key"),
):
    """人工处理状态留痕。关闭事件不恢复原会话的能力报告，避免保护事件被“消掉”。"""
    _require_teacher_review_key(x_teacher_review_key)
    new_status = str(payload.get("status", "")).strip()
    if new_status not in {"reviewing", "closed"}:
        raise HTTPException(400, detail="状态只能更新为 reviewing 或 closed")
    note = str(payload.get("reviewer_note", "")).strip()[:300]
    async with async_session() as db:
        event = await db.get(SafetyEvent, event_id)
        if not event:
            raise HTTPException(404, detail="关注记录未找到")
        event.status = new_status
        event.reviewed_at = datetime.now(timezone.utc)
        event.reviewer_note = note or None
        await db.commit()
        return {"success": True, "event_id": event.id, "status": event.status,
                "message": "处理状态已留存。若学生需要继续体验，请从新的轻松任务开始；原会话仍不生成能力结论。"}

# === API: SESSION JOURNEY ===
@app.get("/api/session/{session_id}/scenarios")
async def api_get_session_scenarios(session_id: str):
    """Return the completed journey data required by the report timeline."""
    async with async_session() as db:
        session = await db.get(Session, session_id)
        if not session:
            raise HTTPException(404, detail="会话未找到")

        sr_result = await db.execute(select(ScenarioRecord).where(
            ScenarioRecord.session_id == session_id).order_by(ScenarioRecord.scenario_index))
        scenario_records = sr_result.scalars().all()
        source_scenarios = SCENARIOS.get(session.career_id, [])
        journey = []

        for sr in scenario_records:
            source = source_scenarios[sr.scenario_index] if sr.scenario_index < len(source_scenarios) else {}
            item = {
                "title": sr.scenario_title,
                "scene": source.get("scene", {}),
                "choice_made": None,
                "mentor_question": "",
                "student_answer": "",
            }
            choice_result = await db.execute(select(ChoiceRecord).where(
                ChoiceRecord.scenario_record_id == sr.id))
            choice = choice_result.scalars().first()
            if choice:
                item["choice_made"] = {
                    "text": choice.choice_text,
                    "decision_time_seconds": round((choice.decision_time_ms or 0) / 1000),
                    "modifications": choice.modification_count or 0,
                }
                followup_result = await db.execute(select(FollowUpRecord).where(
                    FollowUpRecord.choice_record_id == choice.id))
                followup = followup_result.scalar_one_or_none()
                if followup:
                    item["mentor_question"] = followup.ai_question or ""
                    item["student_answer"] = followup.student_answer or ""
            journey.append(item)

        return {"scenarios": journey}
@app.post("/api/session/{session_id}/workday-process")
async def api_save_workday_process(session_id: str, payload: dict = Body(...)):
    """Attach locally collected workday process data to its matching session.

    Only a record from the same career is accepted. The data remains auxiliary
    process evidence and is never used as a direct ability-score input.
    """
    async with async_session() as db:
        session = await db.get(Session, session_id)
        if not session:
            raise HTTPException(404, detail="会话未找到")
        career_id = str(payload.get("careerId") or payload.get("career_id") or "")
        career_name = str(payload.get("career") or "")
        if career_id and career_id != session.career_id:
            raise HTTPException(409, detail="职业日常记录与当前体验职业不一致")
        if not career_id and career_name and career_name != session.career_name:
            raise HTTPException(409, detail="职业日常记录与当前体验职业不一致")
        if not career_id:
            career_id = session.career_id

        safe = {}
        for key in ("career", "careerId", "recordedAt"):
            if payload.get(key) is not None:
                safe[key] = str(payload.get(key))[:120]
        for key in ("focusMinutes", "hintCount", "retryCount", "adjustmentCount", "interactionCount", "completedStages", "stageCount"):
            try:
                safe[key] = max(0, min(int(payload.get(key, 0) or 0), 9999))
            except (TypeError, ValueError):
                safe[key] = 0

        found = await db.execute(select(WorkdayProcessRecord).where(
            WorkdayProcessRecord.session_id == session_id,
            WorkdayProcessRecord.career_id == career_id))
        record = found.scalar_one_or_none()
        if record:
            record.process_data = safe
            record.updated_at = datetime.now(timezone.utc)
        else:
            db.add(WorkdayProcessRecord(id=str(uuid.uuid4()), session_id=session_id,
                career_id=career_id, process_data=safe))
        await db.commit()
        return {"success": True, "message": "职业日常过程记录已纳入本次体验报告"}

# === API: REPORT ===
@app.get("/api/report/{session_id}")
async def api_get_report(
    session_id: str,
    user: User | None = Depends(get_current_user_optional),
    x_student_token: str = Header("", alias="X-Student-Token"),
):
    async with async_session() as db:
        session = await db.get(Session, session_id)
        if not session: raise HTTPException(404, detail="会话未找到")
        student_token = x_student_token.strip()[:64] if len(x_student_token.strip()) >= 8 else ""
        owned_by_user = user is not None and session.user_id == user.id
        owned_by_browser = user is None and bool(student_token) and session.student_token == student_token
        if not (owned_by_user or owned_by_browser):
            # Use 404 rather than disclosing whether another student's report exists.
            raise HTTPException(404, detail="报告未找到")
        result = await db.execute(select(Report).where(Report.session_id==session_id))
        existing = result.scalar_one_or_none()

        sr_result = await db.execute(select(ScenarioRecord).where(
            ScenarioRecord.session_id==session_id).order_by(ScenarioRecord.scenario_index))
        srs = sr_result.scalars().all()
        safety_anomalies = []
        for sr in srs:
            if not sr.is_anomalous or not sr.anomaly_notes:
                continue
            try:
                item = json.loads(sr.anomaly_notes)
            except (TypeError, ValueError, json.JSONDecodeError):
                item = {"level": "attention", "category": "unknown"}
            if item.get("level") in {"urgent", "attention"}:
                safety_anomalies.append(item)

        all_records = []
        for sr in srs:
            cr_result = await db.execute(select(ChoiceRecord).where(ChoiceRecord.scenario_record_id==sr.id))
            for c in cr_result.scalars().all():
                rec = {"scenario_title":sr.scenario_title,"choice_text":c.choice_text,
                    "choice_index":c.choice_index,"choice_id":c.choice_id,
                    "decision_time_ms":c.decision_time_ms,"modification_count":c.modification_count,"indicators":{},"ecd":{}}
                fur = await db.execute(select(FollowUpRecord).where(FollowUpRecord.choice_record_id==c.id))
                fu = fur.scalar_one_or_none()
                if fu: rec.update(follow_up_question=fu.ai_question, follow_up_answer=fu.student_answer or "", follow_up_rounds=fu.follow_up_rounds)
                cs = SCENARIOS.get(session.career_id, [])
                if sr.scenario_index<len(cs):
                    for opt in cs[sr.scenario_index]["options"]:
                        if opt["id"]==c.choice_id: rec["indicators"]=opt.get("indicators",{}); rec["ecd"]=cs[sr.scenario_index].get("ecd",{})
                all_records.append(rec)

        all_obs = []
        for sr in srs:
            orr = await db.execute(select(ObservationRecord).where(ObservationRecord.scenario_record_id==sr.id))
            o = orr.scalar_one_or_none()
            if o: all_obs.append({"intelligence_scores":o.intelligence_scores or {},"literacy_scores":o.literacy_scores or {},"ai_notes":o.ai_notes or ""})

        wd_result = await db.execute(select(WorkdayProcessRecord).where(
            WorkdayProcessRecord.session_id == session_id,
            WorkdayProcessRecord.career_id == session.career_id).order_by(WorkdayProcessRecord.updated_at))
        workday_records = [item.process_data or {} for item in wd_result.scalars().all()]
        workday_evidence = build_workday_process_evidence(workday_records)
        # Only structured mechanics such as path planning or a supportive
        # dialogue tree may enter ECD as direct evidence.  Time/hints/retries
        # remain process-only observations.
        all_records.extend(build_workday_direct_task_records(workday_records))
        evidence_summary = build_report_evidence(all_records, session.age)
        teacher_evidence = build_teacher_evidence(all_records, session.age)
        developmental_context = get_developmental_context(session.age)
        if safety_anomalies or session.status == "safety_paused":
            level = "urgent" if any(item.get("level") == "urgent" for item in safety_anomalies) else "attention"
            return {
                "report_mode": "safety_pause", "safety_level": level,
                "student_name": session.student_name, "career_name": session.career_name,
                "career_id": session.career_id, "total_scenarios": len(SCENARIOS.get(session.career_id, [])),
                "student_message": "这次体验已先暂停。请先找身边可信任的大人聊一聊；之后想继续探索时，可以从一个轻松的小任务重新开始。",
                "strengths": [], "growth_areas": [], "intelligence_scores": {}, "literacy_scores": {},
                "aggregated_intelligence": {}, "aggregated_literacy": {},
                "evidence_summary": {}, "teacher_evidence": [], "workday_evidence": workday_evidence,
                "developmental_context": developmental_context,
                "anomalies": [{"level": item.get("level"), "category": item.get("category"), "action": "human_follow_up"} for item in safety_anomalies],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        eligibility = assess_report_eligibility(all_records)
        if eligibility["mode"] != "ready":
            # Safety/participation gates come before scoring and report storage.
            # Do not turn protected content or missing participation into traits.
            return {
                "report_mode": eligibility["mode"], "safety_level": eligibility["level"],
                "student_name": session.student_name, "career_name": session.career_name,
                "career_id": session.career_id, "total_scenarios": len(SCENARIOS.get(session.career_id, [])),
                "student_message": eligibility["message"],
                "strengths": [], "growth_areas": [], "intelligence_scores": {}, "literacy_scores": {},
                "aggregated_intelligence": {}, "aggregated_literacy": {},
                "evidence_summary": {}, "teacher_evidence": [], "workday_evidence": workday_evidence,
                "developmental_context": developmental_context,
                "anomalies": [{"level": eligibility["level"], "action": eligibility["mode"]}],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        if existing:
            return {
                "intelligence_scores": existing.overall_intelligence or {},
                "literacy_scores": existing.overall_literacy or {},
                "aggregated_intelligence": existing.overall_intelligence or {},
                "aggregated_literacy": existing.overall_literacy or {},
                "strengths": existing.strengths or [],
                "growth_areas": existing.growth_areas or [],
                "personalized_message": existing.personalized_message or "",
                "cross_validation_notes": existing.cross_validation_notes or "",
                "evidence_summary": evidence_summary,
                "teacher_evidence": teacher_evidence,
                "workday_evidence": workday_evidence,
                "developmental_context": developmental_context,
                "anomalies": [],
                "student_name": session.student_name,
                "career_name": session.career_name,
                "career_id": session.career_id,
                "total_scenarios": len(SCENARIOS.get(session.career_id, [])),
                "generated_at": existing.generated_at.isoformat() if existing.generated_at else None,
            }

        report_data = await generate_final_report(session.age, session.student_name, session.career_name, all_records, all_obs)
        report_data["evidence_summary"] = evidence_summary
        report_data["teacher_evidence"] = teacher_evidence
        report_data["workday_evidence"] = workday_evidence
        report_data["developmental_context"] = developmental_context
        report_data["career_id"] = session.career_id
        db.add(Report(id=str(uuid.uuid4()), session_id=session_id,
            overall_intelligence=report_data.get("intelligence_scores"),
            overall_literacy=report_data.get("literacy_scores"),
            strengths=report_data.get("strengths"), growth_areas=report_data.get("growth_areas"),
            personalized_message=report_data.get("personalized_message"),
            cross_validation_notes=report_data.get("cross_validation_notes")))
        session.status="completed"; session.completed_at=datetime.now(timezone.utc)
        await db.commit()
        return report_data

# === API: STUDENT CROSS-CAREER SUMMARY ===
@app.get("/api/student/{student_token}/summary")
async def api_student_summary(student_token: str):
    """查询同一 student_token 关联的所有已完成会话，生成跨职业综合成长报告。

    已知限制：student_token 存储在浏览器 localStorage 中，
    更换浏览器或清除缓存会导致 token 丢失，历史记录无法关联。
    后续如需正式的账号系统，可将此机制升级为 user_id。
    """
    if not student_token or len(student_token.strip()) < 8:
        raise HTTPException(400, detail="学生标识无效")

    token = student_token.strip()[:64]

    async with async_session() as db:
        # 查询所有已完成的会话
        result = await db.execute(
            select(Session).where(
                Session.student_token == token,
                Session.status == "completed"
            ).order_by(Session.completed_at.asc())
        )
        sessions = result.scalars().all()

        if not sessions:
            return {
                "career_count": 0,
                "careers": [],
                "student_age": None,
                "developmental_context": None,
                "dimension_summaries": [],
                "teacher_chains": [],
                "ai_summary": "",
                "single_career_warning": None,
                "message": "还没有找到你的体验记录。完成一次职业情境体验后，这里的成长报告会自动更新。",
            }

        # 为每个会话加载行为记录
        sessions_data = []
        for session in sessions:
            sr_result = await db.execute(
                select(ScenarioRecord).where(
                    ScenarioRecord.session_id == session.id
                ).order_by(ScenarioRecord.scenario_index)
            )
            srs = sr_result.scalars().all()

            all_records = []
            for sr in srs:
                cr_result = await db.execute(
                    select(ChoiceRecord).where(ChoiceRecord.scenario_record_id == sr.id)
                )
                for c in cr_result.scalars().all():
                    rec = {
                        "scenario_title": sr.scenario_title,
                        "choice_text": c.choice_text,
                        "choice_index": c.choice_index,
                        "choice_id": c.choice_id,
                        "decision_time_ms": c.decision_time_ms,
                        "modification_count": c.modification_count,
                        "indicators": {},
                        "ecd": {},
                    }
                    fur = await db.execute(
                        select(FollowUpRecord).where(FollowUpRecord.choice_record_id == c.id)
                    )
                    fu = fur.scalar_one_or_none()
                    if fu:
                        rec.update(
                            follow_up_question=fu.ai_question,
                            follow_up_answer=fu.student_answer or "",
                            follow_up_rounds=fu.follow_up_rounds,
                        )
                    cs = SCENARIOS.get(session.career_id, [])
                    if sr.scenario_index < len(cs):
                        for opt in cs[sr.scenario_index]["options"]:
                            if opt["id"] == c.choice_id:
                                rec["indicators"] = opt.get("indicators", {})
                                rec["ecd"] = cs[sr.scenario_index].get("ecd", {})
                    all_records.append(rec)

            sessions_data.append({
                "career_name": session.career_name,
                "career_id": session.career_id,
                "student_age": session.age,
                "records": all_records,
            })

    # 构建跨职业汇总
    summary = build_cross_career_summary(sessions_data)

    # 生成 AI 综合小结
    ai_summary = await generate_cross_career_narrative(summary)

    # 构建教师/家长观察视图
    teacher_chains = build_cross_career_teacher_view(summary)

    return {
        "career_count": summary["career_count"],
        "careers": summary["careers"],
        "student_age": summary["student_age"],
        "developmental_context": summary["developmental_context"],
        "dimension_summaries": summary["dimension_summaries"],
        "teacher_chains": teacher_chains,
        "ai_summary": ai_summary,
        "single_career_warning": summary["single_career_warning"],
        "message": None,
    }


@app.post("/api/student/{student_token}/backfill")
async def api_student_backfill(student_token: str):
    """将历史完成的旧会话关联到当前浏览器 token，使其出现在综合成长报告中。

    已知限制（见 student_token 字段注释）：此轻量方案假设同一浏览器
    对应同一学生。多学生共用浏览器时，旧数据可能会被错误关联。
    后续正式的账号系统可彻底解决此问题。
    """
    if not student_token or len(student_token.strip()) < 8:
        raise HTTPException(400, detail="学生标识无效")

    # 不再根据姓名、出现次数或“孤立会话”猜测记录归属。
    # 这类自动回填会把同名儿童的数据错误关联，违反最小化与准确性原则。
    return {
        "backfilled": 0,
        "message": "为保护每位同学的隐私，旧的未关联记录不会自动认领。",
    }

    token = student_token.strip()[:64]

    async with async_session() as db:
        result = await db.execute(
            select(Session).where(
                Session.student_token == token,
                Session.status == "completed",
            )
        )
        linked_names = {s.student_name for s in result.scalars().all()}

        # 策略：将 student_token 为空的已完成会话中，
        # 名字与已有 token 关联会话匹配的自动关联。
        # 若当前 token 还没有任何关联会话（全新用户），
        # 则不做全量回填以避免误关联其他学生的数据。
        if linked_names:
            orphan_result = await db.execute(
                select(Session).where(
                    (Session.student_token == None) | (Session.student_token == ""),
                    Session.status == "completed",
                    Session.student_name.in_(linked_names),
                )
            )
            orphans = orphan_result.scalars().all()
            count = 0
            for s in orphans:
                s.student_token = token
                count += 1
            await db.commit()
            return {"backfilled": count, "message": f"已关联 {count} 条历史体验记录。"}

        # 全新 token：尝试按最常见的名字回填（保守策略）
        orphan_result = await db.execute(
            select(Session).where(
                (Session.student_token == None) | (Session.student_token == ""),
                Session.status == "completed",
            ).order_by(Session.completed_at.desc()).limit(20)
        )
        orphans = orphan_result.scalars().all()
        if not orphans:
            return {"backfilled": 0, "message": "没有找到需要关联的历史记录。"}

        # 取出现最多的学生名
        name_counts = {}
        for s in orphans:
            name_counts[s.student_name] = name_counts.get(s.student_name, 0) + 1
        top_name = max(name_counts, key=name_counts.get)

        count = 0
        for s in orphans:
            if s.student_name == top_name:
                s.student_token = token
                count += 1
        await db.commit()
        return {"backfilled": count, "message": f"已将 {count} 条「{top_name}」的历史体验记录关联到当前浏览器。"}


@app.exception_handler(HTTPException)
async def http_handler(request: Request, exc: HTTPException):
    if request.url.path.startswith("/api/"): return JSONResponse(status_code=exc.status_code, content={"error":exc.detail})
    return RedirectResponse(url="/", status_code=302)

if __name__ == "__main__":
    import uvicorn; uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
