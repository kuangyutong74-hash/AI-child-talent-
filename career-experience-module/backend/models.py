"""
SQLAlchemy database models for Career Experience Simulator.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Text, DateTime, JSON, ForeignKey, Boolean
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    """用户账号 —— 正式的登录身份，替代浏览器 token 的轻量关联。"""
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(30), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    salt = Column(String(64), nullable=False)
    display_name = Column(String(50), nullable=False)
    age = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    sessions = relationship("Session", back_populates="user")


class AuthToken(Base):
    """登录令牌 —— 客户端存 localStorage，每次请求带在 Authorization 头。"""
    __tablename__ = "auth_tokens"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_name = Column(String(50), nullable=False)
    age = Column(Integer, nullable=False)
    # 轻量学生身份关联（已废弃，保留兼容旧数据）。
    # 新会话优先使用 user_id；student_token 仅作为匿名用户的回退方案。
    student_token = Column(String(64), nullable=True, index=True)
    # 正式账号关联（可为空，兼容未登录用户）
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    career_id = Column(String(50), nullable=False)
    career_name = Column(String(100), nullable=False)
    status = Column(String(20), default="in_progress")
    current_scenario_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    user = relationship("User", back_populates="sessions")
    scenario_records = relationship("ScenarioRecord", back_populates="session", cascade="all, delete-orphan")
    workday_process_records = relationship("WorkdayProcessRecord", back_populates="session", cascade="all, delete-orphan")
    # 安全事件只保存最小化的风险标签与处置状态，不保存学生的敏感原文。
    safety_events = relationship("SafetyEvent", back_populates="session", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="session", uselist=False, cascade="all, delete-orphan")


class ScenarioRecord(Base):
    __tablename__ = "scenario_records"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    scenario_index = Column(Integer, nullable=False)
    scenario_id = Column(String(50), nullable=False)
    scenario_title = Column(String(200), nullable=False)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    is_anomalous = Column(Boolean, default=False)
    anomaly_notes = Column(Text, nullable=True)
    session = relationship("Session", back_populates="scenario_records")
    choice_records = relationship("ChoiceRecord", back_populates="scenario_record", cascade="all, delete-orphan")
    observation_record = relationship("ObservationRecord", back_populates="scenario_record", uselist=False, cascade="all, delete-orphan")


class SafetyEvent(Base):
    """未成年人内容保护事件的最小化留痕。

    仅用于人工关注与流程审计，绝不存储触发检测的原始文本，
    也不作为 ECD 能力判断的输入。
    """
    __tablename__ = "safety_events"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_record_id = Column(String(36), ForeignKey("scenario_records.id", ondelete="SET NULL"), nullable=True)
    level = Column(String(20), nullable=False)  # urgent / attention / privacy / redirect
    category = Column(String(60), nullable=False)
    teacher_summary = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="new")  # new / reviewing / closed
    student_action = Column(String(30), nullable=False, default="not_recorded")
    raw_text_stored = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_note = Column(Text, nullable=True)
    session = relationship("Session", back_populates="safety_events")


class ChoiceRecord(Base):
    __tablename__ = "choice_records"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scenario_record_id = Column(String(36), ForeignKey("scenario_records.id", ondelete="CASCADE"), nullable=False)
    choice_index = Column(Integer, nullable=False)
    choice_id = Column(String(10), nullable=False)
    choice_text = Column(Text, nullable=False)
    decision_time_ms = Column(Integer, nullable=False)
    modification_count = Column(Integer, default=0)
    is_final = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    scenario_record = relationship("ScenarioRecord", back_populates="choice_records")
    follow_up_record = relationship("FollowUpRecord", back_populates="choice_record", uselist=False, cascade="all, delete-orphan")


class FollowUpRecord(Base):
    __tablename__ = "follow_up_records"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    choice_record_id = Column(String(36), ForeignKey("choice_records.id", ondelete="CASCADE"), nullable=False)
    ai_question = Column(Text, nullable=False)
    initial_thought = Column(Text, nullable=True)
    student_answer = Column(Text, nullable=True)
    follow_up_rounds = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    choice_record = relationship("ChoiceRecord", back_populates="follow_up_record")


class ObservationRecord(Base):
    __tablename__ = "observation_records"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scenario_record_id = Column(String(36), ForeignKey("scenario_records.id", ondelete="CASCADE"), nullable=False)
    intelligence_scores = Column(JSON, nullable=True)
    literacy_scores = Column(JSON, nullable=True)
    ai_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    scenario_record = relationship("ScenarioRecord", back_populates="observation_record")


class WorkdayProcessRecord(Base):
    """Participation-process evidence from the separate career workday module.

    This is deliberately stored apart from ECD choice evidence: it supports a
    process reflection but never becomes an ability-score input by itself.
    """
    __tablename__ = "workday_process_records"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    career_id = Column(String(50), nullable=False)
    process_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    session = relationship("Session", back_populates="workday_process_records")


class Report(Base):
    __tablename__ = "reports"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, unique=True)
    overall_intelligence = Column(JSON, nullable=True)
    overall_literacy = Column(JSON, nullable=True)
    strengths = Column(JSON, nullable=True)
    growth_areas = Column(JSON, nullable=True)
    personalized_message = Column(Text, nullable=True)
    cross_validation_notes = Column(Text, nullable=True)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    session = relationship("Session", back_populates="report")
