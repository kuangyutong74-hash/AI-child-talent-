require('dotenv').config();

const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');
const express = require('express');

const { parseEnvConfig } = require('./lib/infra/env-config');
const { buildSessionCookie } = require('./lib/infra/cookie-helper');
const { securityHeadersMiddleware } = require('./lib/infra/security-headers');

const app = express();

// 安全环境配置（单例，仅在启动时解析一次）
const envConfig = parseEnvConfig();
const PORT = envConfig.PORT;

// DeepSeek API 配置
// 双模型分离策略：
//   ANALYZE = 推理模型，准确率优先（学生潜能分析、报告生成等后台任务）
//   REPLY   = 快模型，低延迟优先（聊天回复、话题建议、回复修正等用户面路径）
// 未配置时均回退到 DEEPSEEK_MODEL，保证向后兼容。
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
const DEEPSEEK_MODEL_ANALYZE = process.env.DEEPSEEK_MODEL_ANALYZE || DEEPSEEK_MODEL;
const DEEPSEEK_MODEL_REPLY = process.env.DEEPSEEK_MODEL_REPLY || DEEPSEEK_MODEL;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';


// 数据目录（可通过环境变量覆盖，供测试使用临时目录）
const { resolveDataDir } = require('./lib/infra/data-dir');
const DATA_DIR = resolveDataDir({
  envValue: process.env.DATA_DIR,
  projectRoot: __dirname,
});

// trust proxy — 仅在显式配置时启用；禁止 true
if (envConfig.TRUST_PROXY !== false) {
  app.set('trust proxy', envConfig.TRUST_PROXY);
}

// 提取的纯函数模块（与生产逻辑完全一致）
const { isFarewellReply } = require('./lib/core/legacy-response-rules');
const { validateChatMessage } = require('./lib/core/chat-input-validation');
const {
  requestChatCompletion,
  ProviderError,
  PROVIDER_ERROR_CODES
} = require('./lib/core/ai-provider-client');

const {
  translateV2ToV1Compatible
} = require('./lib/core/analyze-v2-translator');

const {
  buildBudgetedMessages,
  BUDGET_PRESETS
} = require('./lib/core/chat-context-budget');

// ============================================================
//  后台 AI 调用安全工具
// ============================================================

/**
 * 脱敏记录后台 AI 失败。
 * 不记录 err.message、provider body、API key、学生消息、stack。
 */
function logSanitizedBackgroundError(err) {
  if (err instanceof ProviderError) {
    console.error('Background AI failure: ' + err.code);
  } else if (err && typeof err.code === 'string') {
    console.error('Background AI failure: ' + String(err.code));
  } else {
    console.error('Background AI failure: UNKNOWN');
  }
}

/**
 * 构建 requestChatCompletion 的基础选项（复用 DeepSeek 配置）。
 * @param {Object} [overrides]
 * @returns {Object}
 */
function _providerOptions(overrides) {
  return Object.assign({
    endpoint: DEEPSEEK_BASE_URL + '/chat/completions',
    apiKey: DEEPSEEK_API_KEY,
    model: DEEPSEEK_MODEL_ANALYZE,
  }, overrides || {});
}

// V2 模块延迟加载
let _v2RunTurn = null;
let _v2Cs = null;
function getV2RunTurn() {
  if (!_v2RunTurn) _v2RunTurn = require('./lib/core/v2-turn-runner').runV2Turn;
  return _v2RunTurn;
}
function getV2Cs() {
  if (!_v2Cs) _v2Cs = require('./lib/core/conversation-state');
  return _v2Cs;
}

// V2 会话状态存储（独立于 sessionStore）
const conversationStateStore = new Map();

// 教师端安全数据适配器
const {
  teacherCanAccessStudent,
  buildTeacherRoster,
  buildStudentOverview,
  buildStudentConversationSummaries,
  buildStudentConversationDetail,
  buildStudentInsights,
  getStudentAllHistory,
  getValidAnalysis,
  getValidHits,
} = require('./lib/teacher/teacher-data-adapter');

// 教师端审核系统
const {
  validateReviewPatch,
  buildReviewRecord,
  mergeReviewsIntoInsights,
} = require('./lib/teacher/teacher-insight-review-adapter');
const {
  createTeacherInsightReviewStore,
} = require('./lib/teacher/teacher-insight-review-store');

// 教师端安全信号系统
const {
  validateSafetyPatch,
  buildSafetyRecord,
} = require('./lib/teacher/teacher-safety-signal-adapter');
const {
  createTeacherSafetySignalStore,
} = require('./lib/teacher/teacher-safety-signal-store');

// Insight 关注规则 + Rubric 计算
const {
  computeRubric,
} = require('./lib/core/rubric-computer');
const {
  computeNeedsTeacherAttention,
  computeDimensionAlerts,
} = require('./lib/teacher/insight-attention-rules');

// 教师绑定关系 Store
const {
  createTeacherBindingsStore,
} = require('./lib/teacher/teacher-bindings-store');

// 审核 Store 只在应用生命周期内创建一次
let _reviewStore = null;
function getReviewStore() {
  if (!_reviewStore) {
    _reviewStore = createTeacherInsightReviewStore({
      filePath: path.join(DATA_DIR, 'teacher-insight-reviews.json'),
    });
  }
  return _reviewStore;
}

// 安全信号 Store 只在应用生命周期内创建一次
let _safetySignalStore = null;
function getSafetySignalStore() {
  if (!_safetySignalStore) {
    _safetySignalStore = createTeacherSafetySignalStore({
      filePath: path.join(DATA_DIR, 'teacher-safety-signals.json'),
    });
  }
  return _safetySignalStore;
}

// Bindings Store 只在应用生命周期内创建一次
let _bindingsStore = null;
function getBindingsStore() {
  if (!_bindingsStore) {
    _bindingsStore = createTeacherBindingsStore({
      filePath: path.join(DATA_DIR, 'bindings.json'),
    });
  }
  return _bindingsStore;
}

// 教师绑定邀请 Store
const {
  createTeacherBindingInvitationStore,
} = require('./lib/teacher/teacher-binding-invitation-store');

// 教师绑定服务（跨 Store 协调）
const {
  createTeacherBindingService,
} = require('./lib/teacher/teacher-binding-service');

let _invitationStore = null;
function getInvitationStore() {
  if (!_invitationStore) {
    _invitationStore = createTeacherBindingInvitationStore({
      filePath: path.join(DATA_DIR, 'teacher-binding-invitations.json'),
    });
  }
  return _invitationStore;
}

// Narrative Store 只在应用生命周期内创建一次
let _narrativeStore = null;
function getNarrativeStore() {
  if (!_narrativeStore) {
    _narrativeStore = createTeacherReportNarrativeStore({
      filePath: path.join(DATA_DIR, 'teacher-report-narratives.json'),
    });
  }
  return _narrativeStore;
}

// 安全审计 Store
const {
  createTeacherBindingAuditStore,
} = require('./lib/teacher/teacher-binding-audit-store');

let _auditStore = null;
function getAuditStore() {
  if (!_auditStore) {
    _auditStore = createTeacherBindingAuditStore({
      filePath: path.join(DATA_DIR, 'teacher-binding-audit.jsonl'),
      onWriteFailure: function () {
        console.error('[binding-audit] WRITE_FAILED');
      },
    });
  }
  return _auditStore;
}

// 内存限速器（兑换限速）
const {
  createTeacherBindingRateLimiter,
} = require('./lib/teacher/teacher-binding-rate-limiter');

let _rateLimiter = null;
function getRateLimiter() {
  if (!_rateLimiter) {
    _rateLimiter = createTeacherBindingRateLimiter({
      onGlobalAlert: function (count) {
        console.error('[rate-limiter] GLOBAL_ANOMALY count=' + String(count));
        var audit = getAuditStore();
        audit.appendEvent({
          eventType: 'BINDING_GLOBAL_ANOMALY',
          reasonCategory: 'GLOBAL_ANOMALY',
          outcome: 'ANOMALY',
          occurredAt: new Date().toISOString(),
          actorRole: 'system',
          actorId: 'rate-limiter',
          studentId: null,
          teacherId: null,
          invitationId: null,
        }).catch(function () {});
      },
    });
  }
  return _rateLimiter;
}

// 内存限速器（邀请创建）
let _inviteLimiter = null;
function getInviteRateLimiter() {
  if (!_inviteLimiter) {
    _inviteLimiter = createTeacherBindingRateLimiter({
      teacherFailureLimit: 5,   // 每学生 5 次
      teacherWindowMs: 900000,  // 15 分钟
      ipFailureLimit: 99999,    // IP 不限（仅按学生）
      ipWindowMs: 900000,
      globalAlertLimit: 999999, // 不触发全局
      globalWindowMs: 900000,
    });
  }
  return _inviteLimiter;
}

let _bindingService = null;
function getBindingService() {
  if (!_bindingService) {
    _bindingService = createTeacherBindingService({
      invitationStore: getInvitationStore(),
      bindingsStore: getBindingsStore(),
      auditStore: getAuditStore(),
      getUserById: function (userId) {
        var users = readUsers();
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === userId) return users[i];
        }
        return null;
      },
      generateRawToken: function () {
        return require('crypto').randomBytes(32).toString('base64url');
      },
    });
  }
  return _bindingService;
}

function readBindings() {
  try {
    return getBindingsStore().readAll();
  } catch (err) {
    console.error('[bindings] READ_FAILED');
    throw err;
  }
}

// 教师端阶段性报告适配器
const {
  validateReportRange,
  buildTeacherStageReport,
} = require('./lib/teacher/teacher-stage-report-adapter');

// 教师端 AI 叙事报告适配器 + Store
const {
  buildNarrativePromptInput,
  parseAiNarrativeJson,
  resolveEffectiveModules,
  hasDataChangedSinceLastAiVersion,
  latestModuleConfirmNeedsRefresh,
  getLatestModuleEdit,
} = require('./lib/teacher/teacher-report-narrative-adapter');
const {
  createTeacherReportNarrativeStore,
} = require('./lib/teacher/teacher-report-narrative-store');

// 叙事报告 prompt
const NARRATIVE_REPORT_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, 'prompts', 'narrative-report.md'),
  'utf-8'
);

// V2 Prompt 延迟读取 + 缓存
let _cachedV2Prompts = null;
function getV2Prompts() {
  if (_cachedV2Prompts) return _cachedV2Prompts;
  _cachedV2Prompts = {
    xiaoxin: fs.readFileSync(path.join(__dirname, 'prompts', 'xiaoxin-v2.md'), 'utf-8'),
    analyze: fs.readFileSync(path.join(__dirname, 'prompts', 'analyze-v2.md'), 'utf-8'),
    repair: fs.readFileSync(path.join(__dirname, 'prompts', 'repair.md'), 'utf-8'),
  };
  return _cachedV2Prompts;
}

// 解析 JSON 请求体（显式 body 大小限制）
app.use(express.json({ limit: '100kb' }));

// JSON 解析错误处理中间件（entity.too.large / malformed JSON）
app.use(function (err, req, res, next) {
  if (!err) return next();
  // Only handle JSON parse errors — pass other errors to downstream handlers
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'INVALID_JSON' });
  }
  next(err);
});

// 基础安全响应头（HTML 和 API 统一设置）
app.use(securityHeadersMiddleware);

// 静态文件服务（前端页面）
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 会话历史存储（内存），key: sessionId, value: 消息数组
const sessionStore = new Map();
// 每轮 AI 回复的时间戳，用于计算学生的"耗时"（上一轮回复完→本轮发言，单位秒）
const lastAiReplyTime = new Map();

// ============================================================
//  认证系统 — 数据文件 + helpers
// ============================================================
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// 教师绑定读写统一通过 getBindingsStore() → 第一个 readBindings

// 获取老师邀请码
const TEACHER_INVITE_CODE = process.env.TEACHER_INVITE_CODE || '';

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch { return []; }
}
function writeUsers(data) {
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, USERS_FILE);
}
function readSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch { return {}; }
}
function writeSessions(data) {
  const tmp = SESSIONS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, SESSIONS_FILE);
}

// Cookie 解析
function parseCookies(cookieHeader) {
  const map = {};
  if (!cookieHeader) return map;
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) map[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return map;
}

// Auth 中间件 — 从 cookie 取 token → 查 userId
function authMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.token;
  if (!token) {
    return res.status(401).json({ error: '未登录', code: 'NOT_AUTHENTICATED' });
  }
  const sessions = readSessions();
  const session = sessions[token];
  if (!session) {
    return res.status(401).json({ error: '登录已过期，请重新登录', code: 'SESSION_EXPIRED' });
  }
  // Check expiry
  if (session.expiresAt && Date.now() > session.expiresAt) {
    delete sessions[token];
    writeSessions(sessions);
    return res.status(401).json({ error: '登录已过期，请重新登录', code: 'SESSION_EXPIRED' });
  }
  req.userId = session.userId;
  req.username = session.username;
  next();
}


// ============================================================
//  教师端接口
// ============================================================

// 中间件：仅教师可访问
function teacherOnly(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: '未登录' });
  const users = readUsers();
  const user = users.find(u => u.id === req.userId);
  if (!user || user.role !== 'teacher') {
    return res.status(403).json({ error: '仅教师账号可执行此操作' });
  }
  next();
}

// 中间件：仅学生可访问
function studentOnly(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: '未登录' });
  if (req.userId === 'guest') return res.status(403).json({ error: '访客不可执行此操作' });
  const users = readUsers();
  const user = users.find(u => u.id === req.userId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ error: '仅学生账号可执行此操作' });
  }
  next();
}

// 安全来源 IP（不信任 X-Forwarded-For）
function resolveBindingSourceIp(req) {
  try {
    if (req.socket && req.socket.remoteAddress) {
      var addr = req.socket.remoteAddress;
      if (typeof addr === 'string' && addr.trim().length > 0 && addr.trim().length <= 45) {
        return addr.trim();
      }
    }
  } catch (_) {}
  return 'unknown';
}

// 绑定学生 — 仅接受一次性 bindingToken
app.post('/api/teacher/bind-student', authMiddleware, teacherOnly, (req, res) => {
  try {
    const body = req.body || {};

    // studentCode 字段存在即拒绝（任何类型：string/number/null/object/array/空串）
    const hasStudentCode = Object.prototype.hasOwnProperty.call(body, 'studentCode');

    if (hasStudentCode) {
      return res.status(400).json({ error: 'LEGACY_STUDENT_CODE_BINDING_DISABLED' });
    }

    // bindingToken 必须是非空 string
    var rawBindingToken = body.bindingToken;
    if (typeof rawBindingToken !== 'string' || rawBindingToken.length === 0) {
      return res.status(400).json({ error: 'INVALID_REQUEST' });
    }

    // bindingToken 格式校验
    if (rawBindingToken.length !== 43) {
      return res.status(400).json({ error: 'INVALID_REQUEST' });
    }

    // Rate limiting
    var rateLimiter = getRateLimiter();
    var sourceIp = resolveBindingSourceIp(req);
    var teacherCheck = rateLimiter.checkTeacher(req.userId);
    if (teacherCheck.blocked) {
      getAuditStore().appendEvent({
        eventType: 'BINDING_TOKEN_RATE_LIMITED',
        reasonCategory: 'RATE_LIMIT_TEACHER',
        outcome: 'REJECTED',
        occurredAt: new Date().toISOString(),
        actorRole: 'teacher',
        actorId: req.userId,
        teacherId: req.userId,
        studentId: null,
        invitationId: null,
      }).catch(function () {});
      return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    }

    var ipCheck = rateLimiter.checkIp(sourceIp);
    if (ipCheck.blocked) {
      getAuditStore().appendEvent({
        eventType: 'BINDING_TOKEN_RATE_LIMITED',
        reasonCategory: 'RATE_LIMIT_IP',
        outcome: 'REJECTED',
        occurredAt: new Date().toISOString(),
        actorRole: 'teacher',
        actorId: req.userId,
        teacherId: req.userId,
        studentId: null,
        invitationId: null,
      }).catch(function () {});
      return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
    }

    // Rate limiter checks passed — proceed
    const service = getBindingService();
    service.redeemToken(rawBindingToken, req.userId).then(function (result) {
      // Success does not add to failure counts
      rateLimiter.recordSuccess({ teacherId: req.userId, sourceIp: sourceIp });
      res.json(result);
    }).catch(function (err) {
      var code = err.code;
      if (code === 'INVALID_REQUEST' || code === 'BINDING_TOKEN_INVALID') {
        // Token-level failures count toward rate limits
        rateLimiter.recordFailure({ teacherId: req.userId, sourceIp: sourceIp, category: 'token_redeem' });
        return res.status(400).json({ error: code });
      }
      // INTERNAL_ERROR does NOT count as teacher failure
      console.error('[bindings] REDEEM_FAILED');
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    });
  } catch (err) {
    console.error('[bind-student] UNEXPECTED_ERROR');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================================
//  学生端接口 — binding invitations + teacher management
// ============================================================

// 创建绑定邀请
app.post('/api/student/binding-invitations', authMiddleware, studentOnly, (req, res) => {
  try {
    // Active pending invitation limit (max 5, claimed counts as active)
    var store = getInvitationStore();
    var all = store.readAll();
    var adapter = require('./lib/teacher/teacher-binding-invitation-adapter');
    var activeCount = 0;
    for (var ai = 0; ai < all.length; ai++) {
      if (all[ai].studentId === req.userId) {
        var st = adapter.deriveInvitationState(all[ai], Date.now());
        if (st === 'pending' || st === 'claimed') activeCount++;
      }
    }
    if (activeCount >= 5) {
      return res.status(429).json({ error: 'TOO_MANY_INVITATIONS' });
    }

    // Rate limiting for creation frequency
    var il = getInviteRateLimiter();
    var ic = il.checkTeacher(req.userId);
    if (ic.blocked) {
      return res.status(429).json({ error: 'TOO_MANY_INVITATIONS' });
    }

    const service = getBindingService();
    service.createInvitation(req.userId).then(function (result) {
      // Record success
      il.recordFailure({ teacherId: req.userId, sourceIp: 'n/a', category: 'invite_created' });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.status(201).json({ invitation: result });
    }).catch(function (err) {
      var code = err.code;
      if (code === 'INVALID_REQUEST' || code === 'BINDING_TOKEN_INVALID') {
        return res.status(400).json({ error: code });
      }
      console.error('[invitations] CREATE_FAILED');
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    });
  } catch (err) {
    console.error('[invitations] UNEXPECTED_ERROR');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取邀请列表
app.get('/api/student/binding-invitations', authMiddleware, studentOnly, (req, res) => {
  try {
    var store = getInvitationStore();
    var all = store.readAll();
    var mine = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].studentId === req.userId) {
        var adapter = require('./lib/teacher/teacher-binding-invitation-adapter');
        mine.push({
          id: all[i].id,
          status: adapter.deriveInvitationState(all[i], Date.now()),
          createdAt: all[i].createdAt,
          expiresAt: all[i].expiresAt,
        });
      }
    }
    res.json({ invitations: mine });
  } catch (err) {
    console.error('[invitations] LIST_FAILED');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 撤销邀请
app.delete('/api/student/binding-invitations/:invitationId', authMiddleware, studentOnly, (req, res) => {
  try {
    const service = getBindingService();
    service.revokeInvitation(req.params.invitationId, req.userId).then(function (result) {
      res.json(result);
    }).catch(function (err) {
      if (err.code === 'INVALID_REQUEST') {
        return res.status(400).json({ error: 'INVALID_REQUEST' });
      }
      console.error('[invitations] REVOKE_FAILED');
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    });
  } catch (err) {
    console.error('[invitations] UNEXPECTED_ERROR');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 查看已绑定教师
app.get('/api/student/bound-teachers', authMiddleware, studentOnly, (req, res) => {
  try {
    const service = getBindingService();
    var teachers = service.listTeachersForStudent(req.userId);
    res.json({ teachers: teachers });
  } catch (err) {
    console.error('[bound-teachers] LIST_FAILED');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 解绑教师
app.delete('/api/student/bound-teachers/:teacherId', authMiddleware, studentOnly, (req, res) => {
  try {
    const service = getBindingService();
    service.unbindTeacher(req.params.teacherId, req.userId).then(function (result) {
      res.json(result);
    }).catch(function (err) {
      if (err.code === 'INVALID_REQUEST') {
        return res.status(400).json({ error: 'INVALID_REQUEST' });
      }
      console.error('[bound-teachers] UNBIND_FAILED');
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    });
  } catch (err) {
    console.error('[bound-teachers] UNEXPECTED_ERROR');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取绑定学生列表（真实数据，由 teacher-data-adapter 计算）
app.get('/api/teacher/roster', authMiddleware, teacherOnly, (req, res) => {
  try {
    const users = readUsers();
    const bindings = readBindings();
    const history = readHistory();
    const roster = buildTeacherRoster({
      teacherId: req.userId,
      users,
      bindings,
      history,
      now: Date.now(),
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(roster);

    // 后台同步安全信号
    try {
      _syncSafetySignalsForTeacher(req.userId);
    } catch (_) {}
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 教师查看学生画像 — 权限校验
app.get('/api/teacher/student/:studentId', authMiddleware, teacherOnly, (req, res) => {
  try {
    const bindings = readBindings();
    const teacherList = bindings[req.userId] || [];
    if (!teacherList.includes(req.params.studentId)) {
      return res.status(403).json({ error: '该学生不在你的名单中，请先绑定' });
    }
    const users = readUsers();
    const student = users.find(u => u.id === req.params.studentId);
    if (!student) return res.status(404).json({ error: '学生不存在' });
    res.json({ ok: true, student: { id: student.id, username: student.username, studentCode: student.studentCode || null } });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取学生数据总览
app.get('/api/teacher/student/:studentId/overview', authMiddleware, teacherOnly, (req, res) => {
  try {
    const users = readUsers();
    const bindings = readBindings();
    const history = readHistory();
    const result = buildStudentOverview({
      teacherId: req.userId,
      studentId: req.params.studentId,
      users,
      bindings,
      history,
    });

    if (!result.allowed) {
      if (result.reason === 'NOT_BOUND') {
        return res.status(403).json({ error: 'NOT_BOUND' });
      }
      if (result.reason === 'STUDENT_NOT_FOUND') {
        return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ student: result.student, overview: result.overview });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取学生对话列表
app.get('/api/teacher/student/:studentId/conversations', authMiddleware, teacherOnly, (req, res) => {
  try {
    const users = readUsers();
    const bindings = readBindings();
    const history = readHistory();
    const result = buildStudentConversationSummaries({
      teacherId: req.userId,
      studentId: req.params.studentId,
      users,
      bindings,
      history,
    });

    if (!result.allowed) {
      if (result.reason === 'NOT_BOUND') {
        return res.status(403).json({ error: 'NOT_BOUND' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 合并审核状态到对话列表：计算每条对话有多少未复核的 insight
    const insightsResult = buildStudentInsights({
      teacherId: req.userId,
      studentId: req.params.studentId,
      users,
      bindings,
      history,
    });

    if (insightsResult.allowed) {
      const reviews = getReviewStore().readAll();
      const mergedInsights = mergeReviewsIntoInsights({
        insights: insightsResult.insights,
        reviews: reviews,
        teacherId: req.userId,
      });

      // 用 computeNeedsTeacherAttention 的规则判断哪些 insight 真正需要教师关注
      var rubric = computeRubric(mergedInsights, {
        now: Date.now(),
        windowDays: 90,
        freshnessDays: 30,
      });
      var annotatedInsights = computeNeedsTeacherAttention({
        insights: mergedInsights,
        rubric: rubric,
        reviewHistory: reviews,
        freshnessDays: 30,
      });

      // 按 conversationId 分组统计 needsTeacherAttention 的 insight 数
      const reviewCounts = {};
      for (let i = 0; i < annotatedInsights.length; i++) {
        const ins = annotatedInsights[i];
        const cid = ins.conversationId;
        if (!cid) continue;
        if (!reviewCounts[cid]) reviewCounts[cid] = { total: 0, needsAttention: 0 };
        reviewCounts[cid].total++;
        if (ins.needsTeacherAttention === true) reviewCounts[cid].needsAttention++;
      }

      // 附加到每个对话对象
      for (let j = 0; j < result.conversations.length; j++) {
        const c = result.conversations[j];
        const rc = reviewCounts[c.id];
        c.totalInsightCount = rc ? rc.total : 0;
        c.unreviewedInsightCount = rc ? rc.needsAttention : 0;
        c.needsReview = (rc ? rc.needsAttention : 0) > 0;
      }
    } else {
      // 无法获取 insights 时，所有对话默认不需要复核
      for (let j = 0; j < result.conversations.length; j++) {
        result.conversations[j].totalInsightCount = 0;
        result.conversations[j].unreviewedInsightCount = 0;
        result.conversations[j].needsReview = false;
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ conversations: result.conversations });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取单次对话详情
app.get('/api/teacher/student/:studentId/conversations/:conversationId', authMiddleware, teacherOnly, (req, res) => {
  try {
    const users = readUsers();
    const bindings = readBindings();
    const history = readHistory();
    const result = buildStudentConversationDetail({
      teacherId: req.userId,
      studentId: req.params.studentId,
      conversationId: req.params.conversationId,
      users,
      bindings,
      history,
    });

    if (!result.allowed) {
      if (result.reason === 'NOT_BOUND') {
        return res.status(403).json({ error: 'NOT_BOUND' });
      }
      if (result.reason === 'CONVERSATION_NOT_FOUND') {
        return res.status(404).json({ error: 'CONVERSATION_NOT_FOUND' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ conversation: result.conversation });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取学生潜能线索
app.get('/api/teacher/student/:studentId/insights', authMiddleware, teacherOnly, (req, res) => {
  try {
    const users = readUsers();
    const bindings = readBindings();
    const history = readHistory();
    const result = buildStudentInsights({
      teacherId: req.userId,
      studentId: req.params.studentId,
      users,
      bindings,
      history,
    });

    if (!result.allowed) {
      if (result.reason === 'NOT_BOUND') {
        return res.status(403).json({ error: 'NOT_BOUND' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 合并审核记录
    var reviews;
    try {
      reviews = getReviewStore().readAll();
    } catch (err) {
      // 审核文件损坏 → 500，不泄露内部错误 code
      console.error('[teacher-reviews] readAll failed:', err.message);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    var mergedInsights = mergeReviewsIntoInsights({
      insights: result.insights,
      reviews: reviews,
      teacherId: req.userId,
    });

    // 计算 rubric
    var rubric = computeRubric(mergedInsights, {
      now: Date.now(),
      windowDays: 90,
      freshnessDays: 30,
    });

    // 计算 needsTeacherAttention
    var annotatedInsights = computeNeedsTeacherAttention({
      insights: mergedInsights,
      rubric: rubric,
      reviewHistory: reviews,
      freshnessDays: 30,
    });

    // 计算维度级别提示
    // 拿到该学生的总对话数
    var conversationCount = 0;
    try {
      var convsResult = buildStudentConversationSummaries({
        teacherId: req.userId,
        studentId: req.params.studentId,
        users,
        bindings,
        history,
      });
      if (convsResult.allowed && Array.isArray(convsResult.conversations)) {
        conversationCount = convsResult.conversations.length;
      }
    } catch (_) {}

    var dimensionAlerts = computeDimensionAlerts({
      rubric: rubric,
      conversationCount: conversationCount,
    });

    // 支持筛选
    var filter = req.query.filter;
    var outputInsights = annotatedInsights;
    if (filter === 'needs_attention') {
      outputInsights = [];
      for (var fi = 0; fi < annotatedInsights.length; fi++) {
        if (annotatedInsights[fi].needsTeacherAttention === true) {
          outputInsights.push(annotatedInsights[fi]);
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      insights: outputInsights,
      rubric: rubric,
      dimensionAlerts: dimensionAlerts,
      conversationCount: conversationCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 教师审核潜能线索
app.patch('/api/teacher/student/:studentId/insights/:insightId/review', authMiddleware, teacherOnly, (req, res) => {
  try {
    var studentId = req.params.studentId;
    var insightId = req.params.insightId;

    // 参数验证
    if (typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(404).json({ error: 'INSIGHT_NOT_FOUND' });
    }
    if (typeof insightId !== 'string' || insightId.trim().length === 0) {
      return res.status(404).json({ error: 'INSIGHT_NOT_FOUND' });
    }

    // 验证绑定关系
    var bindings = readBindings();
    var teacherList = bindings[req.userId] || [];
    if (!Array.isArray(teacherList) || teacherList.indexOf(studentId) < 0) {
      return res.status(403).json({ error: 'NOT_BOUND' });
    }

    // 验证学生存在
    var users = readUsers();
    var student = users.find(function (u) { return u.id === studentId && u.role === 'student'; });
    if (!student) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    // 实时获取当前学生的全部 insights
    var history = readHistory();
    var insightsResult = buildStudentInsights({
      teacherId: req.userId,
      studentId: studentId,
      users: users,
      bindings: bindings,
      history: history,
    });
    if (!insightsResult.allowed) {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 查找目标 insight
    var targetInsight = null;
    for (var i = 0; i < insightsResult.insights.length; i++) {
      if (insightsResult.insights[i].id === insightId) {
        targetInsight = insightsResult.insights[i];
        break;
      }
    }
    if (targetInsight === null) {
      return res.status(404).json({ error: 'INSIGHT_NOT_FOUND' });
    }

    // 验证 PATCH 请求体
    var validation = validateReviewPatch(req.body);
    if (!validation.ok) {
      var code = validation.error;
      if (code === 'INVALID_REVIEW_PATCH' || code === 'INVALID_REVIEW_STATUS' || code === 'INVALID_NOTE') {
        return res.status(400).json({ error: code });
      }
      return res.status(400).json({ error: 'INVALID_REVIEW_PATCH' });
    }

    // 查找现有记录
    var reviewStore = getReviewStore();
    var existingReview;
    try {
      existingReview = reviewStore.findOne({
        teacherId: req.userId,
        studentId: studentId,
        insightId: insightId,
      });
    } catch (err) {
      console.error('[teacher-reviews] findOne failed:', err.message);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 构建审核记录
    var now = new Date().toISOString();
    var reviewId = 'review-' + require('crypto').randomUUID();

    var buildResult = buildReviewRecord({
      existingReview: existingReview,
      teacherId: req.userId,
      studentId: studentId,
      insight: targetInsight,
      patch: validation.value,
      now: now,
      reviewId: reviewId,
    });

    if (!buildResult.ok) {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 写入 Store
    var savedRecord;
    try {
      savedRecord = reviewStore.upsert(buildResult.record);
    } catch (err) {
      console.error('[teacher-reviews] upsert failed:', err.message);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 等待写入完成，合并并返回
    savedRecord.then(function (record) {
      try {
        var merged = mergeReviewsIntoInsights({
          insights: [targetInsight],
          reviews: [record],
          teacherId: req.userId,
        });
        res.json({ insight: merged[0] });
      } catch (err) {
        res.status(500).json({ error: 'INTERNAL_ERROR' });
      }
    }).catch(function (err) {
      console.error('[teacher-reviews] upsert then failed:', err.message);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 批量审核 insight（一键确认/拒绝多条线索）
app.post('/api/teacher/student/:studentId/insights/batch-review', authMiddleware, teacherOnly, (req, res) => {
  try {
    var studentId = req.params.studentId;
    var body = req.body;

    if (!body || !Array.isArray(body.insightIds) || body.insightIds.length === 0) {
      return res.status(400).json({ error: 'INVALID_BATCH_REQUEST' });
    }
    if (body.action !== 'confirm' && body.action !== 'reject') {
      return res.status(400).json({ error: 'INVALID_BATCH_ACTION' });
    }

    // 验证绑定关系
    var bindings = readBindings();
    var teacherList = bindings[req.userId] || [];
    if (!Array.isArray(teacherList) || teacherList.indexOf(studentId) < 0) {
      return res.status(403).json({ error: 'NOT_BOUND' });
    }

    // 验证学生存在
    var users = readUsers();
    var student = users.find(function (u) { return u.id === studentId && u.role === 'student'; });
    if (!student) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    // 获取当前全部 insights 以便查找每条 insight 的元数据
    var history = readHistory();
    var insightsResult = buildStudentInsights({
      teacherId: req.userId,
      studentId: studentId,
      users: users,
      bindings: bindings,
      history: history,
    });
    if (!insightsResult.allowed) {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    var reviewStore = getReviewStore();
    var now = new Date().toISOString();
    var targetStatus = body.action === 'confirm' ? 'teacher_confirmed' : 'rejected';
    var patch = { reviewStatus: targetStatus };
    var processed = 0;
    var errors = [];

    for (var ii = 0; ii < body.insightIds.length; ii++) {
      var insightId = body.insightIds[ii];
      if (typeof insightId !== 'string' || insightId.trim().length === 0) continue;

      var targetInsight = null;
      for (var jj = 0; jj < insightsResult.insights.length; jj++) {
        if (insightsResult.insights[jj].id === insightId) {
          targetInsight = insightsResult.insights[jj];
          break;
        }
      }
      if (!targetInsight) continue;

      var existingReview;
      try {
        existingReview = reviewStore.findOne({
          teacherId: req.userId,
          studentId: studentId,
          insightId: insightId,
        });
      } catch (err) { /* 找不到就新建 */ }

      var reviewId = 'review-' + require('crypto').randomUUID();
      var buildResult = buildReviewRecord({
        existingReview: existingReview,
        teacherId: req.userId,
        studentId: studentId,
        insight: targetInsight,
        patch: patch,
        now: now,
        reviewId: reviewId,
      });

      if (buildResult.ok) {
        try {
          reviewStore.upsert(buildResult.record);
          processed++;
        } catch (err) {
          errors.push(insightId);
        }
      }
    }

    res.json({ processed: processed, errors: errors.length, total: body.insightIds.length });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取学生确认记录（线索审核 + 模块编辑历史，统一时间线）
app.get('/api/teacher/student/:studentId/confirm-records', authMiddleware, teacherOnly, (req, res) => {
  try {
    var studentId = req.params.studentId;

    if (typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(400).json({ error: 'INVALID_STUDENT_ID' });
    }

    // 验证绑定关系
    var bindings = readBindings();
    var teacherList = bindings[req.userId] || [];
    if (!Array.isArray(teacherList) || teacherList.indexOf(studentId) < 0) {
      return res.status(403).json({ error: 'NOT_BOUND' });
    }

    // 验证学生存在
    var users = readUsers();
    var student = users.find(function (u) { return u.id === studentId && u.role === 'student'; });
    if (!student) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    // 预加载 history 用于 insight dimension 解析
    var history = readHistory();

    var records = [];

    // 1) 收集线索审核记录
    var reviewStore = getReviewStore();
    var allReviews = reviewStore.readAll();
    for (var ri = 0; ri < allReviews.length; ri++) {
      var rev = allReviews[ri];
      if (rev.studentId !== studentId) continue;
      // 跳过 unreviewed 状态（没有实际审核操作）
      if (rev.reviewStatus === 'unreviewed' && (!rev.note || rev.note.trim().length === 0)) continue;

      var reviewSummary = '线索审核';
      var reviewAction = 'confirm';
      if (rev.reviewStatus === 'rejected') {
        reviewAction = 'reject';
      } else if (rev.reviewStatus === 'unreviewed' && rev.note && rev.note.trim().length > 0) {
        reviewAction = 'edit';
      } else if (rev.reviewStatus === 'teacher_confirmed') {
        reviewAction = 'confirm';
      }

      // 解析 insight dimension（从 history 的 analysis 数据中提取）
      var insightDimension = '';
      var insightObservedAt = '';
      try {
        // insightId 格式: insight-{conversationId}-{hitIndex}
        var insightId = rev.insightId || '';
        var parts = insightId.split('-');
        // parts[0]='insight', parts[1..n-1]=conversationId segments, parts[n]=hitIndex
        if (parts.length >= 3 && parts[0] === 'insight') {
          var hitIndex = parseInt(parts[parts.length - 1], 10);
          var convIdFromInsight = parts.slice(1, parts.length - 1).join('-');
          // 查找对应 conversation
          for (var hi = 0; hi < history.length; hi++) {
            var he = history[hi];
            if (he.id === convIdFromInsight && he.userId === studentId) {
              var analysis = getValidAnalysis(he);
              if (analysis) {
                var hits = getValidHits(he);
                if (hitIndex >= 0 && hitIndex < hits.length) {
                  insightDimension = hits[hitIndex].dimension || '';
                }
              }
              // 获取 observedAt
              var st = he.startTime;
              if (typeof st === 'string' && !isNaN(Date.parse(st))) {
                insightObservedAt = st;
              }
              break;
            }
          }
        }
      } catch (_) {
        // 解析失败，dimension 留空
      }

      records.push({
        timestamp: rev.updatedAt || rev.createdAt,
        type: 'insight_review',
        reviewStatus: rev.reviewStatus,
        action: reviewAction,
        summary: reviewSummary,
        contentPreview: rev.note ? (rev.note.length > 100 ? rev.note.substring(0, 100) + '…' : rev.note) : null,
        note: rev.note || null,
        _raw: {
          insightId: rev.insightId || '',
          conversationId: rev.conversationId || '',
          teacherId: rev.teacherId || '',
          dimension: insightDimension,
          createdAt: rev.createdAt || '',
          updatedAt: rev.updatedAt || '',
          reviewId: rev.id || '',
        },
        _audit: {
          operatorId: rev.teacherId || '',
          statusTimeline: [
            { status: 'AI 系统生成线索', time: insightObservedAt },
            { status: rev.reviewStatus === 'teacher_confirmed' ? '教师确认准确' : rev.reviewStatus === 'rejected' ? '教师标记不准确' : '教师添加备注', time: rev.updatedAt || rev.createdAt || '' },
          ],
          aiVersionNote: '线索审核不直接关联 AI 叙述版本，该线索来自单次对话分析',
        },
      });
    }

    // 2) 收集叙事模块编辑记录
    var narrativeStore = getNarrativeStore();
    var allNarratives = narrativeStore.readAll();
    var MODULE_LABELS = {
      coreFindings: '核心发现',
      dimensionProfile: '分维度画像',
      suggestions: '培养建议',
      evidenceExcerpts: '证据摘录',
    };
    for (var ni = 0; ni < allNarratives.length; ni++) {
      var nar = allNarratives[ni];
      if (nar.studentId !== studentId) continue;
      var edits = nar.moduleEdits;
      if (!Array.isArray(edits)) continue;

      // 获取该 narrative 记录的 AI 版本时间列表
      var aiVersionTimes = [];
      var aiVersions = nar.aiGeneratedVersions;
      if (Array.isArray(aiVersions)) {
        for (var avi = 0; avi < aiVersions.length; avi++) {
          if (aiVersions[avi] && typeof aiVersions[avi].generatedAt === 'string') {
            aiVersionTimes.push(aiVersions[avi].generatedAt);
          }
        }
      }

      // 构建当前 digest 用于判断是否过时
      var currentDigest = null;
      try {
        // 获取学生 history 构建 digest（简化为 insight 数量和 conversationId 集合）
        var studentHistory = getStudentAllHistory(history, studentId);
        var convIds = [];
        var totalInsightCount = 0;
        for (var shi = 0; shi < studentHistory.length; shi++) {
          var she = studentHistory[shi];
          if (she.id) convIds.push(she.id);
          var sheAnalysis = getValidAnalysis(she);
          if (sheAnalysis) {
            var sheHits = getValidHits(she);
            totalInsightCount += sheHits.length;
          }
        }
        var totalTurns = 0;
        for (var sti = 0; sti < studentHistory.length; sti++) {
          totalTurns += (typeof studentHistory[sti].turnCount === 'number' ? studentHistory[sti].turnCount : 0);
        }
        currentDigest = {
          conversationCount: studentHistory.length,
          totalTurns: totalTurns,
          insightCount: totalInsightCount,
          conversationIds: convIds,
        };
      } catch (_) {
        currentDigest = null;
      }

      for (var ei = 0; ei < edits.length; ei++) {
        var edit = edits[ei];
        var moduleLabel = MODULE_LABELS[edit.module] || edit.module;
        // dimReview:* 模块显示特殊标签
        if (edit.module && edit.module.indexOf('dimReview:') === 0) {
          moduleLabel = '维度复核 · ' + edit.module.replace('dimReview:', '');
        }

        // 获取同模块的完整编辑历史（按时间倒序）
        var fullEditHistory = [];
        for (var fei = 0; fei < edits.length; fei++) {
          if (edits[fei].module === edit.module) {
            fullEditHistory.push({
              action: edits[fei].action || 'edit',
              contentPreview: edits[fei].content ? (edits[fei].content.length > 80 ? edits[fei].content.substring(0, 80) + '…' : edits[fei].content) : '',
              editedBy: edits[fei].editedBy || '',
              editedAt: edits[fei].editedAt || '',
            });
          }
        }
        // 按时间倒序
        fullEditHistory.sort(function (a, b) {
          if (a.editedAt > b.editedAt) return -1;
          if (a.editedAt < b.editedAt) return 1;
          return 0;
        });

        // 判断是否过时
        var isSuperseded = false;
        if (edit.action === 'confirm' && currentDigest) {
          isSuperseded = latestModuleConfirmNeedsRefresh(nar, edit.module, currentDigest);
        }

        records.push({
          timestamp: edit.editedAt,
          type: 'narrative_module',
          reviewStatus: edit.action === 'confirm' ? 'teacher_confirmed' : edit.action === 'reject' ? 'rejected' : 'unreviewed',
          action: edit.action,
          summary: '报告模块 · ' + moduleLabel,
          contentPreview: edit.content ? (edit.content.length > 100 ? edit.content.substring(0, 100) + '…' : edit.content) : null,
          note: null,
          _raw: {
            module: edit.module || '',
            editedBy: edit.editedBy || '',
            action: edit.action || '',
            editedAt: edit.editedAt || '',
            inputDigest: edit.inputDigest || null,
          },
          _audit: {
            operatorId: edit.editedBy || '',
            aiVersions: aiVersionTimes,
            fullEditHistory: fullEditHistory,
            isSuperseded: isSuperseded,
          },
        });
      }
    }

    // 3) 按时间倒序排列，最多 200 条
    records.sort(function (a, b) {
      if (a.timestamp > b.timestamp) return -1;
      if (a.timestamp < b.timestamp) return 1;
      return 0;
    });
    if (records.length > 200) {
      records = records.slice(0, 200);
    }

    res.json({ records: records });
  } catch (err) {
    console.error('[teacher-confirm-records] error:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================================
//  教师端 — 安全信号处理 API
// ============================================================

// 获取待处理安全信号计数（轻量，首页用）
app.get('/api/teacher/safety-signals/pending-count', authMiddleware, teacherOnly, (req, res) => {
  try {
    var store = getSafetySignalStore();
    var all = store.readAll();
    var count = 0;
    for (var i = 0; i < all.length; i++) {
      if (all[i].teacherId === req.userId && all[i].status === 'pending') count++;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ pendingCount: count });
  } catch (err) {
    console.error('[safety-signals] pending-count failed:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 列出安全信号（支持 ?status=pending 过滤）
app.get('/api/teacher/safety-signals', authMiddleware, teacherOnly, (req, res) => {
  try {
    var store = getSafetySignalStore();
    var all = store.readAll();
    var filterStatus = req.query.status;

    var signals = [];
    var pendingCount = 0;
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      if (s.teacherId !== req.userId) continue;
      if (s.status === 'pending') pendingCount++;

      // 过滤
      if (filterStatus === 'pending' && s.status !== 'pending') continue;
      if (filterStatus === 'resolved' && s.status === 'pending') continue;

      signals.push(s);
    }

    // 排序：pending 优先，然后按时间倒序
    signals.sort(function (a, b) {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1;
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({ signals: signals, pendingCount: pendingCount });
  } catch (err) {
    console.error('[safety-signals] list failed:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 处理安全信号（更新状态+备注）
app.patch('/api/teacher/safety-signals/:signalId', authMiddleware, teacherOnly, (req, res) => {
  try {
    var signalId = req.params.signalId;
    if (typeof signalId !== 'string' || signalId.trim().length === 0) {
      return res.status(404).json({ error: 'SIGNAL_NOT_FOUND' });
    }

    var store = getSafetySignalStore();
    var existing = store.findBySignalId(signalId);
    if (!existing) {
      return res.status(404).json({ error: 'SIGNAL_NOT_FOUND' });
    }
    if (existing.teacherId !== req.userId) {
      return res.status(403).json({ error: 'NOT_YOUR_SIGNAL' });
    }

    // 验证 PATCH 请求体
    var validation = validateSafetyPatch(req.body);
    if (!validation.ok) {
      var code = validation.error;
      if (code === 'INVALID_SAFETY_PATCH' || code === 'MISSING_STATUS' ||
          code === 'INVALID_STATUS' || code === 'CANNOT_RESET_TO_PENDING' ||
          code === 'INVALID_NOTE' || code === 'NOTE_TOO_LONG' ||
          code === 'NOTE_TOO_SHORT' || code === 'NOTE_REQUIRED') {
        return res.status(400).json({ error: code });
      }
      return res.status(400).json({ error: 'INVALID_SAFETY_PATCH' });
    }

    var now = new Date().toISOString();
    var buildResult = buildSafetyRecord({
      existingRecord: existing,
      teacherId: req.userId,
      patch: validation.value,
      now: now,
    });

    if (!buildResult.ok) {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    store.upsert(buildResult.record).then(function (record) {
      res.json({ signal: record });
    }).catch(function (err) {
      console.error('[safety-signals] upsert failed:', err.message);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    });
  } catch (err) {
    console.error('[safety-signals] patch failed:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 惰性同步安全信号（由 roster API 调用）
function _syncSafetySignalsForTeacher(teacherId) {
  try {
    var store = getSafetySignalStore();
    var existing = store.readAll();

    var users = readUsers();
    var bindings = readBindings();
    var history = readHistory();

    var teacherExisting = [];
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].teacherId === teacherId) teacherExisting.push(existing[i]);
    }

    // 对教师绑定的每个学生，检查其所有对话是否有安全信号需要同步
    var boundIds = bindings[teacherId];
    if (!Array.isArray(boundIds)) return;

    var seenKeys = {};
    for (var j = 0; j < teacherExisting.length; j++) {
      var key = teacherExisting[j].studentId + ':' + teacherExisting[j].conversationId;
      seenKeys[key] = true;
    }

    var now = new Date().toISOString();

    for (var si = 0; si < boundIds.length; si++) {
      var studentId = boundIds[si];

      for (var hi = 0; hi < history.length; hi++) {
        var entry = history[hi];
        if (entry.userId !== studentId) continue;
        if (!entry.analysis || entry.analysis.status !== 'done') continue;
        var result = entry.analysis.result;
        if (!result || typeof result !== 'object' || Array.isArray(result)) continue;
        if (result['安全提示'] !== true) continue;

        var convId = entry.id || '';
        if (!convId) continue;

        var pairKey = studentId + ':' + convId;
        if (seenKeys[pairKey]) continue;
        seenKeys[pairKey] = true;

        // 找到 safety note
        var safetyNote = '';
        if (typeof result['安全提示说明'] === 'string') {
          safetyNote = result['安全提示说明'].trim();
        }

        // 提取话题
        var activeTopic = null;
        if (Array.isArray(result['活跃话题']) && result['活跃话题'].length > 0 &&
            result['活跃话题'][0] && typeof result['活跃话题'][0].topic === 'string') {
          activeTopic = result['活跃话题'][0].topic.trim();
        }

        var record = {
          id: 'safety-' + require('crypto').randomUUID(),
          teacherId: teacherId,
          studentId: studentId,
          conversationId: convId,
          safetyNote: safetyNote,
          conversationStartTime: typeof entry.startTime === 'string' ? entry.startTime : '',
          activeTopic: activeTopic,
          status: 'pending',
          processedBy: null,
          processedAt: null,
          note: null,
          createdAt: now,
          updatedAt: now,
        };

        store.upsert(record).catch(function (e) {
          console.error('[safety-signals] sync upsert failed:', e.message);
        });
      }
    }
  } catch (err) {
    console.error('[safety-signals] sync failed:', err.message);
  }
}

// 获取学生阶段性观察报告
app.get('/api/teacher/student/:studentId/report', authMiddleware, teacherOnly, (req, res) => {
  try {
    var studentId = req.params.studentId;

    // 参数验证
    if (typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    // range: only default to 30d when parameter is completely absent
    var rawRange = req.query.range === undefined ? '30d' : req.query.range;

    var rangeResult = validateReportRange(rawRange);
    if (!rangeResult.ok) {
      return res.status(400).json({ error: 'INVALID_REPORT_RANGE' });
    }
    var range = rangeResult.value;

    // 读取数据
    var users = readUsers();
    var bindings = readBindings();
    var history = readHistory();

    // 权限验证 + 安全 student：复用 teacher-data-adapter 的输出
    var overviewResult = buildStudentOverview({
      teacherId: req.userId,
      studentId: studentId,
      users: users,
      bindings: bindings,
      history: history,
    });

    if (!overviewResult.allowed) {
      if (overviewResult.reason === 'NOT_BOUND') {
        return res.status(403).json({ error: 'NOT_BOUND' });
      }
      if (overviewResult.reason === 'STUDENT_NOT_FOUND') {
        return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    var safeStudent = overviewResult.student;

    // 构建安全 conversations
    var conversationsResult = buildStudentConversationSummaries({
      teacherId: req.userId,
      studentId: studentId,
      users: users,
      bindings: bindings,
      history: history,
    });
    if (!conversationsResult.allowed) {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 构建安全 insights 并合并 Review
    var insightsResult = buildStudentInsights({
      teacherId: req.userId,
      studentId: studentId,
      users: users,
      bindings: bindings,
      history: history,
    });
    if (!insightsResult.allowed) {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 合并审核记录
    var reviews;
    try {
      reviews = getReviewStore().readAll();
    } catch (err) {
      console.error('[teacher-report] readAll failed:', err.message);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    var mergedInsights = mergeReviewsIntoInsights({
      insights: insightsResult.insights,
      reviews: reviews,
      teacherId: req.userId,
    });

    // 构建报告
    var reportResult = buildTeacherStageReport({
      student: safeStudent,
      conversations: conversationsResult.conversations,
      insights: mergedInsights,
      range: range,
      now: Date.now(),
    });

    if (!reportResult.ok) {
      if (reportResult.error === 'INVALID_REPORT_RANGE') {
        return res.status(400).json({ error: 'INVALID_REPORT_RANGE' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 计算导出提醒：needsTeacherAttention && reviewStatus === "unreviewed"
    var exportWarning = null;
    try {
      var rubric = computeRubric(mergedInsights, {
        now: Date.now(),
        windowDays: 90,
        freshnessDays: 30,
      });
      var annotated = computeNeedsTeacherAttention({
        insights: mergedInsights,
        rubric: rubric,
        reviewHistory: reviews,
        freshnessDays: 30,
      });
      var unattendedCount = 0;
      for (var ai = 0; ai < annotated.length; ai++) {
        var aIns = annotated[ai];
        if (aIns.needsTeacherAttention === true && aIns.reviewStatus === 'unreviewed') {
          unattendedCount++;
        }
      }
      if (unattendedCount > 0) {
        exportWarning = {
          unattendedAttentionCount: unattendedCount,
          message: '有 ' + unattendedCount + ' 条建议先看一眼的内容尚未被确认，确定要导出报告吗？',
        };
      }
    } catch (_) {}

    res.setHeader('Cache-Control', 'no-store');
    res.json({ report: reportResult.report, exportWarning: exportWarning });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================================
//  教师端 — AI 叙事报告 API
// ============================================================

// ---- 内部辅助: 构建 narrative 所需的数据 ----

/**
 * 准备 narrative 生成所需的全部数据。
 * 返回 { allowed, student, conversations, insights, report }。
 */
function _prepareNarrativeData(studentId, teacherId) {
  var users = readUsers();
  var bindings = readBindings();
  var history = readHistory();

  var overviewResult = buildStudentOverview({
    teacherId: teacherId,
    studentId: studentId,
    users: users,
    bindings: bindings,
    history: history,
  });
  if (!overviewResult.allowed) return { allowed: false, reason: overviewResult.reason };

  var conversationsResult = buildStudentConversationSummaries({
    teacherId: teacherId,
    studentId: studentId,
    users: users,
    bindings: bindings,
    history: history,
  });
  if (!conversationsResult.allowed) return { allowed: false, reason: 'INTERNAL_ERROR' };

  var insightsResult = buildStudentInsights({
    teacherId: teacherId,
    studentId: studentId,
    users: users,
    bindings: bindings,
    history: history,
  });
  if (!insightsResult.allowed) return { allowed: false, reason: 'INTERNAL_ERROR' };

  var reviews;
  try {
    reviews = getReviewStore().readAll();
  } catch (_) {
    reviews = [];
  }
  var mergedInsights = mergeReviewsIntoInsights({
    insights: insightsResult.insights,
    reviews: reviews,
    teacherId: teacherId,
  });

  var reportResult = buildTeacherStageReport({
    student: overviewResult.student,
    conversations: conversationsResult.conversations,
    insights: mergedInsights,
    range: 'all',
    now: Date.now(),
  });
  if (!reportResult.ok) return { allowed: false, reason: 'INTERNAL_ERROR' };

  return {
    allowed: true,
    student: overviewResult.student,
    conversations: conversationsResult.conversations,
    insights: mergedInsights,
    report: reportResult.report,
  };
}

/**
 * 构建当前数据快照（用于变更检测）。
 */
function _buildNarrativeDigest(narrativeData) {
  var convs = narrativeData.conversations;
  var convIds = [];
  for (var i = 0; i < convs.length; i++) {
    if (convs[i].id) convIds.push(String(convs[i].id));
  }
  var report = narrativeData.report;
  var summary = report.summary || {};
  return {
    conversationCount: typeof summary.conversationCount === 'number' ? summary.conversationCount : convs.length,
    totalTurns: typeof summary.totalTurns === 'number' ? summary.totalTurns : 0,
    insightCount: typeof summary.insightCount === 'number' ? summary.insightCount : 0,
    conversationIds: convIds,
  };
}

/**
 * 后台异步执行 AI 叙事生成（fire-and-forget，不阻塞响应）。
 * 使用 _generationLocks 防止重复生成。
 */
var _generationLocks = Object.create(null);

function _triggerBackgroundNarrativeGeneration(studentId, narrativeData) {
  var lockKey = studentId;
  if (_generationLocks[lockKey]) return; // 已在生成中
  _generationLocks[lockKey] = true;

  var digest = _buildNarrativeDigest(narrativeData);
  var promptInput = buildNarrativePromptInput({ report: narrativeData.report });
  if (!promptInput) {
    delete _generationLocks[lockKey];
    return;
  }

  requestChatCompletion(_providerOptions({
    messages: [
      { role: 'system', content: NARRATIVE_REPORT_SYSTEM_PROMPT },
      { role: 'user', content: promptInput },
    ],
    temperature: 0.5,
    maxTokens: 6000,
    timeoutMs: 60000,
  })).then(function (result) {
    var content = result && result.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      delete _generationLocks[lockKey];
      return;
    }
    return getNarrativeStore().addAiVersion({
      studentId: studentId,
      range: 'all',
      text: content.trim(),
      generatedAt: new Date().toISOString(),
      inputDigest: digest,
    });
  }).then(function () {
    delete _generationLocks[lockKey];
  }).catch(function (err) {
    logSanitizedBackgroundError(err);
    delete _generationLocks[lockKey];
  });
}

/**
 * 从 narrative 记录的 moduleEdits 中扫描维度复核记录。
 * 返回 { <dimKey>: { reviewAction, reviewedAt, inputDigest, conclusionText, conclusionEditedAt } }
 */
function _scanDimensionReviews(record) {
  var result = Object.create(null);
  if (!record || !Array.isArray(record.moduleEdits)) return result;

  for (var ei = 0; ei < record.moduleEdits.length; ei++) {
    var me = record.moduleEdits[ei];
    if (!me || typeof me.module !== 'string') continue;

    var moduleName = me.module;
    if (moduleName.indexOf('dimReview:') === 0) {
      var dimKey = moduleName.substring('dimReview:'.length);
      if (dimKey.length === 0) continue;
      if (!result[dimKey]) result[dimKey] = {};
      result[dimKey].reviewAction = me.action;
      result[dimKey].reviewedAt = me.editedAt;
      result[dimKey].inputDigest = (me.inputDigest && typeof me.inputDigest === 'object' && !Array.isArray(me.inputDigest))
        ? me.inputDigest : null;
    } else if (moduleName.indexOf('dimConclusion:') === 0) {
      var dimKey2 = moduleName.substring('dimConclusion:'.length);
      if (dimKey2.length === 0) continue;
      if (!result[dimKey2]) result[dimKey2] = {};
      result[dimKey2].conclusionText = typeof me.content === 'string' ? me.content : '';
      result[dimKey2].conclusionEditedAt = me.editedAt;
      result[dimKey2].conclusionEditedBy = me.editedBy;
    }
  }
  return result;
}

/**
 * 将 resolveEffectiveModules 的结果格式化为 API 响应格式。
 */
function _formatNarrativeModules(modules) {
  var result = {};
  var KNOWN = ['coreFindings', 'dimensionProfile', 'suggestions', 'evidenceExcerpts'];
  for (var i = 0; i < KNOWN.length; i++) {
    var key = KNOWN[i];
    var m = modules[key];
    result[key] = {
      text: (m && m.text) ? m.text : '',
      source: (m && m.source) ? m.source : 'none',
      outdated: (m && m.outdated) ? true : false,
      editedAt: (m && m.editedAt) ? m.editedAt : null,
      editedBy: (m && m.editedBy) ? m.editedBy : null,
    };
  }
  return result;
}

// ---- GET /api/teacher/student/:studentId/narrative ----

app.get('/api/teacher/student/:studentId/narrative', authMiddleware, teacherOnly, function (req, res) {
  try {
    var studentId = req.params.studentId;
    if (typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    // 准备数据 + 鉴权
    var narrativeData = _prepareNarrativeData(studentId, req.userId);
    if (!narrativeData.allowed) {
      if (narrativeData.reason === 'NOT_BOUND') return res.status(403).json({ error: 'NOT_BOUND' });
      if (narrativeData.reason === 'STUDENT_NOT_FOUND') return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    var store = getNarrativeStore();
    var record = store.findByStudentIdAndRange(studentId, 'all');
    var digest = _buildNarrativeDigest(narrativeData);

    var needsGeneration = false;
    if (hasDataChangedSinceLastAiVersion(record, digest)) {
      needsGeneration = true;
    }
    // 无记录或无任何有效 AI 版本也需生成
    if (!record || !record.aiGeneratedVersions || record.aiGeneratedVersions.length === 0) {
      needsGeneration = true;
    }

    // 解析有效模块
    var modules = resolveEffectiveModules(record);
    var formatted = _formatNarrativeModules(modules);

    // 收集维度复核记录（dimReview / dimConclusion 模块）
    var dimensionReviews = _scanDimensionReviews(record);

    // 确定 generatedAt
    var generatedAt = null;
    if (record && record.aiGeneratedVersions && record.aiGeneratedVersions.length > 0) {
      var lastAv = record.aiGeneratedVersions[record.aiGeneratedVersions.length - 1];
      if (lastAv && lastAv.generatedAt) generatedAt = lastAv.generatedAt;
    }

    // 后台触发 AI 生成（如果数据已变化）
    if (needsGeneration) {
      _triggerBackgroundNarrativeGeneration(studentId, narrativeData);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      modules: formatted,
      generating: needsGeneration,
      generatedAt: generatedAt,
      dimensionReviews: dimensionReviews,
    });
  } catch (err) {
    console.error('[teacher-narrative] GET error:', err.message || 'UNKNOWN');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ---- POST /api/teacher/student/:studentId/narrative/generate ----

app.post('/api/teacher/student/:studentId/narrative/generate', authMiddleware, teacherOnly, function (req, res) {
  try {
    var studentId = req.params.studentId;
    if (typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    // 准备数据 + 鉴权
    var narrativeData = _prepareNarrativeData(studentId, req.userId);
    if (!narrativeData.allowed) {
      if (narrativeData.reason === 'NOT_BOUND') return res.status(403).json({ error: 'NOT_BOUND' });
      if (narrativeData.reason === 'STUDENT_NOT_FOUND') return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // 检查是否已在生成中
    if (_generationLocks[studentId]) {
      return res.status(409).json({ error: 'GENERATION_IN_PROGRESS' });
    }

    var digest = _buildNarrativeDigest(narrativeData);
    var promptInput = buildNarrativePromptInput({ report: narrativeData.report });
    if (!promptInput) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', detail: 'Failed to build narrative prompt input' });
    }

    _generationLocks[studentId] = true;

    requestChatCompletion(_providerOptions({
      messages: [
        { role: 'system', content: NARRATIVE_REPORT_SYSTEM_PROMPT },
        { role: 'user', content: promptInput },
      ],
      temperature: 0.5,
      maxTokens: 6000,
      timeoutMs: 60000,
    })).then(function (result) {
      var content = result && result.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        delete _generationLocks[studentId];
        return res.status(502).json({ error: 'AI_GENERATION_EMPTY' });
      }

      return getNarrativeStore().addAiVersion({
        studentId: studentId,
        range: 'all',
        text: content.trim(),
        generatedAt: new Date().toISOString(),
        inputDigest: digest,
      }).then(function (updatedRecord) {
        delete _generationLocks[studentId];
        var modules = resolveEffectiveModules(updatedRecord);
        res.setHeader('Cache-Control', 'no-store');
        res.json({
          modules: _formatNarrativeModules(modules),
          generatedAt: updatedRecord.aiGeneratedVersions[updatedRecord.aiGeneratedVersions.length - 1].generatedAt,
        });
      });
    }).catch(function (err) {
      logSanitizedBackgroundError(err);
      delete _generationLocks[studentId];
      if (!res.headersSent) {
        res.status(502).json({ error: 'AI_GENERATION_FAILED' });
      }
    });
  } catch (err) {
    console.error('[teacher-narrative] POST generate error:', err.message || 'UNKNOWN');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ---- PATCH /api/teacher/student/:studentId/narrative/module ----

app.patch('/api/teacher/student/:studentId/narrative/module', authMiddleware, teacherOnly, function (req, res) {
  try {
    var studentId = req.params.studentId;
    if (typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    // 鉴权：教师必须与该学生有绑定关系
    var users = readUsers();
    var bindings = readBindings();
    var teacherList = bindings[req.userId];
    if (!Array.isArray(teacherList) || teacherList.indexOf(studentId) < 0) {
      return res.status(403).json({ error: 'NOT_BOUND' });
    }

    var body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'INVALID_BODY' });
    }
    var moduleName = body.module;
    var content = body.content;
    var action = body.action;

    if (typeof moduleName !== 'string' || moduleName.trim().length === 0) {
      return res.status(400).json({ error: 'INVALID_MODULE' });
    }
    if (action !== 'edit' && action !== 'confirm' && action !== 'revert' && action !== 'reject') {
      return res.status(400).json({ error: 'INVALID_ACTION' });
    }
    // revert 不需要 content；edit/confirm 必须提供非空 content
    if (action !== 'revert' && (typeof content !== 'string' || content.trim().length === 0)) {
      return res.status(400).json({ error: 'INVALID_CONTENT' });
    }
    if (action !== 'revert' && content.length > 4000) {
      return res.status(400).json({ error: 'CONTENT_TOO_LONG' });
    }

    var store = getNarrativeStore();

    // 检查当前 narrative 记录是否存在
    var record = store.findByStudentIdAndRange(studentId, 'all');
    // 提取当前最新 AI 版本的生成时间，供过时判定使用
    var currentAiVersionGeneratedAt = null;
    if (record && record.aiGeneratedVersions && record.aiGeneratedVersions.length > 0) {
      var lastAv = record.aiGeneratedVersions[record.aiGeneratedVersions.length - 1];
      if (lastAv && typeof lastAv.generatedAt === 'string') {
        currentAiVersionGeneratedAt = lastAv.generatedAt;
      }
    }
    // 准备 digest（如果记录存在）
    var currentDigest = null;
    try {
      var narrativeData = _prepareNarrativeData(studentId, req.userId);
      if (narrativeData.allowed) {
        currentDigest = _buildNarrativeDigest(narrativeData);
      }
    } catch (_) { /* digest is optional */ }

    var promise;
    if (action === 'revert') {
      promise = store.clearModuleEdits({
        studentId: studentId,
        range: 'all',
        module: moduleName.trim(),
      });
    } else {
      promise = store.addModuleEdit({
        studentId: studentId,
        range: 'all',
        module: moduleName.trim(),
        content: content.trim(),
        action: action,
        editedBy: req.userId,
        editedAt: new Date().toISOString(),
        inputDigest: currentDigest,
        aiVersionGeneratedAt: currentAiVersionGeneratedAt,
      });
    }

    promise.then(function (updatedRecord) {
      var modules = resolveEffectiveModules(updatedRecord);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        modules: _formatNarrativeModules(modules),
      });
    }).catch(function (err) {
      if (err && err.code === 'CONTENT_TOO_LONG') {
        return res.status(400).json({ error: 'CONTENT_TOO_LONG' });
      }
      console.error('[teacher-narrative] PATCH module error:', err && err.message ? err.message : 'UNKNOWN');
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    });
  } catch (err) {
    console.error('[teacher-narrative] PATCH module error:', err.message || 'UNKNOWN');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ---- PATCH /api/teacher/student/:studentId/dimension-review ----
// 保存维度级复核状态（确认/标记不准确/修改结论）+ 证据快照

app.patch('/api/teacher/student/:studentId/dimension-review', authMiddleware, teacherOnly, function (req, res) {
  try {
    var studentId = req.params.studentId;
    if (typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
    }

    // 鉴权
    var bindings = readBindings();
    var teacherList = bindings[req.userId];
    if (!Array.isArray(teacherList) || teacherList.indexOf(studentId) < 0) {
      return res.status(403).json({ error: 'NOT_BOUND' });
    }

    var body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'INVALID_BODY' });
    }
    var dimension = body.dimension;
    var action = body.action;
    var evidenceDigest = body.evidenceDigest;
    var conclusionText = body.conclusionText;

    if (typeof dimension !== 'string' || dimension.trim().length === 0) {
      return res.status(400).json({ error: 'INVALID_DIMENSION' });
    }
    if (action !== 'confirm' && action !== 'reject' && action !== 'modify') {
      return res.status(400).json({ error: 'INVALID_ACTION' });
    }
    // modify 必须提供 conclusionText
    if (action === 'modify' && (typeof conclusionText !== 'string' || conclusionText.trim().length === 0)) {
      return res.status(400).json({ error: 'INVALID_CONCLUSION_TEXT' });
    }
    // evidenceDigest 必须包含基础字段
    if (!evidenceDigest || typeof evidenceDigest !== 'object' || Array.isArray(evidenceDigest)) {
      return res.status(400).json({ error: 'INVALID_EVIDENCE_DIGEST' });
    }
    if (conclusionText && conclusionText.length > 4000) {
      return res.status(400).json({ error: 'CONTENT_TOO_LONG' });
    }

    var dimKey = dimension.trim();
    var store = getNarrativeStore();
    var now = new Date().toISOString();

    var digest = {
      confirmedAt: now,
      insightCount: typeof evidenceDigest.insightCount === 'number' ? evidenceDigest.insightCount : 0,
      insightIds: Array.isArray(evidenceDigest.insightIds) ? evidenceDigest.insightIds.slice() : [],
      latestObservedAt: typeof evidenceDigest.latestObservedAt === 'string' ? evidenceDigest.latestObservedAt : '',
    };

    // 写入 dimReview 模块（复核快照）
    var reviewAction = (action === 'modify') ? 'confirm' : action;
    var reviewPromise = store.addModuleEdit({
      studentId: studentId,
      range: 'all',
      module: 'dimReview:' + dimKey,
      content: dimKey,  // 占位，满足非空校验
      action: reviewAction,
      editedBy: req.userId,
      editedAt: now,
      inputDigest: digest,
    });

    var conclusionPromise = null;
    if (action === 'modify') {
      conclusionPromise = store.addModuleEdit({
        studentId: studentId,
        range: 'all',
        module: 'dimConclusion:' + dimKey,
        content: conclusionText.trim(),
        action: 'edit',
        editedBy: req.userId,
        editedAt: now,
      });
    }

    var allPromises = conclusionPromise
      ? Promise.all([reviewPromise, conclusionPromise])
      : reviewPromise;

    allPromises.then(function () {
      // 重新读取以返回最新状态
      var record = store.findByStudentIdAndRange(studentId, 'all');
      var dimReviews = _scanDimensionReviews(record);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ dimensionReviews: dimReviews });
    }).catch(function (err) {
      if (err && err.code === 'CONTENT_TOO_LONG') {
        return res.status(400).json({ error: 'CONTENT_TOO_LONG' });
      }
      console.error('[dimension-review] PATCH error:', err && err.message ? err.message : 'UNKNOWN');
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    });
  } catch (err) {
    console.error('[dimension-review] PATCH error:', err.message || 'UNKNOWN');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================================
//  System Prompt
// ============================================================

// 分析调用 System Prompt（从 prompts/analyze-v2.md 加载）
const ANALYZE_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, 'prompts', 'analyze-v2.md'),
  'utf-8'
);

/**
 * 安全构建 V2 对话消息数组（用于 generateReply 多轮调用）。
 * 过滤非法条目，只保留 role + content。
 * 不修改输入。
 *
 * @param {Array} history - 历史消息（不含本轮）
 * @param {string} studentMessage - 本轮学生消息
 * @returns {Array<{role: string, content: string}>}
 */
function buildV2ConversationMessages(history, studentMessage) {
  const result = [];

  if (Array.isArray(history)) {
    for (const message of history) {
      if (
        !message ||
        typeof message !== 'object' ||
        Array.isArray(message)
      ) {
        continue;
      }

      if (
        message.role !== 'user' &&
        message.role !== 'assistant'
      ) {
        continue;
      }

      if (typeof message.content !== 'string') {
        continue;
      }

      result.push({
        role: message.role,
        content: message.content,
      });
    }
  }

  result.push({
    role: 'user',
    content:
      typeof studentMessage === 'string'
        ? studentMessage
        : '',
  });

  return result;
}

/**
 * 构建 analyze 回调使用的对话文本（带轮次编号）。
 * 基于 buildV2ConversationMessages 确保安全过滤。
 */
function buildAnalyzeConversation(history, studentMessage) {
  const combined = buildV2ConversationMessages(
    history,
    studentMessage
  );

  let text = '';
  for (let i = 0; i < combined.length; i++) {
    const m = combined[i];
    // 每遇到 user 消息递增轮次
    const round = combined
      .slice(0, i + 1)
      .filter(function (x) { return x.role === 'user'; })
      .length;
    const speaker = m.role === 'user' ? '学生' : '小新';
    text += '第' + round + '轮 ' + speaker + '：' + m.content + '\n';
  }
  return text;
}

// ============================================================
//  运行时初始化（迁移 + guest 清理）
// ============================================================
var _initPromise = null;

function initializeRuntime() {
  if (_initPromise) return _initPromise;

  _initPromise = Promise.resolve().then(function () {
    var skipMigration = process.env.SKIP_MIGRATION === 'true';
    var bindingsStore = getBindingsStore();

    // Guest binding cleanup ALWAYS runs (cannot be skipped via env var)
    var guestCleanup = bindingsStore.removeGuestBindings().then(function (rem) {
      if (rem > 0) console.log('[init] removed ' + rem + ' guest binding(s)');
    }).catch(function (err) {
      console.error('[runtime] GUEST_BINDING_CLEANUP_FAILED');
      throw err;
    });

    if (skipMigration) {
      console.log('[init] SKIP_MIGRATION=true — skipping data migration');
      return guestCleanup;
    }

    var migrationOpts = { bindingsStore: bindingsStore };
    if (process.env.DATA_DIR) {
      migrationOpts.dataDir = DATA_DIR;
    }

    var migration = require('./data/migrate-to-users.js').createMigration(migrationOpts);
    return migration.runAll().then(function () {
      return guestCleanup;
    });
  }).catch(function (err) {
    console.error('[init] RUNTIME INITIALIZATION FAILED');
    _initPromise = null;
    throw err;
  });

  return _initPromise;
}

// ============================================================
//  认证接口
// ============================================================

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    const trimmedUser = username.trim();
    if (trimmedUser.length < 2) {
      return res.status(400).json({ error: '用户名至少需要2个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6位' });
    }
    const users = readUsers();
    if (users.some(u => u.username === trimmedUser)) {
      return res.status(409).json({ error: '该用户名已被注册' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    // 生成不重复的6位studentCode
    let studentCode;
    do { studentCode = String(Math.floor(100000 + Math.random() * 900000)); } while (users.some(u => u.studentCode === studentCode));
    const newUser = {
      id: 'user-' + Date.now(),
      username: trimmedUser,
      passwordHash,
      role: 'student',
      studentCode,
      onboardingDone: false,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeUsers(users);

    // Auto login after register
    const token = require('crypto').randomUUID();
    const sessions = readSessions();
    sessions[token] = {
      userId: newUser.id,
      username: newUser.username,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    writeSessions(sessions);
    res.setHeader('Set-Cookie', buildSessionCookie(token, envConfig.COOKIE_SECURE));
    res.json({ ok: true, user: { id: newUser.id, username: newUser.username, role: newUser.role, studentCode: newUser.studentCode, onboardingDone: false } });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 教师注册（需要邀请码）
app.post('/api/auth/teacher-register', async (req, res) => {
  try {
    const { username, password, inviteCode } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    const trimmedUser = username.trim();
    if (trimmedUser.length < 2) {
      return res.status(400).json({ error: '用户名至少需要2个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6位' });
    }
    if (!TEACHER_INVITE_CODE) {
      return res.status(500).json({ error: '服务端未配置教师邀请码，请在.env中设置 TEACHER_INVITE_CODE' });
    }
    if (inviteCode !== TEACHER_INVITE_CODE) {
      return res.status(403).json({ error: '邀请码不正确，请联系学校管理员获取' });
    }
    const users = readUsers();
    if (users.some(u => u.username === trimmedUser)) {
      return res.status(409).json({ error: '该用户名已被注册' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: 'user-' + Date.now(),
      username: trimmedUser,
      passwordHash,
      role: 'teacher',
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeUsers(users);

    // Auto login after register
    const token = require('crypto').randomUUID();
    const sessions = readSessions();
    sessions[token] = {
      userId: newUser.id,
      username: newUser.username,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    writeSessions(sessions);
    res.setHeader('Set-Cookie', buildSessionCookie(token, envConfig.COOKIE_SECURE));
    res.json({ ok: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    const users = readUsers();
    const user = users.find(u => u.username === username.trim());
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = require('crypto').randomUUID();
    const sessions = readSessions();
    sessions[token] = {
      userId: user.id,
      username: user.username,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    writeSessions(sessions);
    res.setHeader('Set-Cookie', buildSessionCookie(token, envConfig.COOKIE_SECURE));
    res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role, studentCode: user.studentCode || null, onboardingDone: user.onboardingDone === true } });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 登出
app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.token;
  if (token) {
    const sessions = readSessions();
    delete sessions[token];
    writeSessions(sessions);
  }
  res.setHeader('Set-Cookie', buildSessionCookie('', envConfig.COOKIE_SECURE));
  res.json({ ok: true });
});

// 获取当前登录用户
app.get('/api/auth/me', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.token;
  if (!token) {
    return res.status(401).json({ error: '未登录', code: 'NOT_AUTHENTICATED' });
  }
  const sessions = readSessions();
  const session = sessions[token];
  if (!session) {
    return res.status(401).json({ error: '登录已过期', code: 'SESSION_EXPIRED' });
  }
  if (session.expiresAt && Date.now() > session.expiresAt) {
    delete sessions[token];
    writeSessions(sessions);
    return res.status(401).json({ error: '登录已过期', code: 'SESSION_EXPIRED' });
  }
  // 从 users.json 获取完整用户信息（role, studentCode）
  const users = readUsers();
  const user = users.find(u => u.id === session.userId);
  res.json({ ok: true, user: { id: session.userId, username: session.username, role: user ? user.role : 'student', studentCode: user ? user.studentCode || null : null, onboardingDone: user ? user.onboardingDone === true : false } });
});

// 标记新手引导已完成
app.post('/api/auth/onboarding-complete', (req, res) => {
  console.log('[onboarding-complete] 收到请求');
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.token;
  console.log('[onboarding-complete] token:', token ? (token.slice(0, 8) + '...') : '(无)');
  if (!token) {
    console.log('[onboarding-complete] → 401: 无 token');
    return res.status(401).json({ error: '未登录', code: 'NOT_AUTHENTICATED' });
  }
  const sessions = readSessions();
  const session = sessions[token];
  if (!session) {
    console.log('[onboarding-complete] → 401: session 不存在');
    return res.status(401).json({ error: '登录已过期', code: 'SESSION_EXPIRED' });
  }
  console.log('[onboarding-complete] session.userId:', session.userId);
  const users = readUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user) {
    console.log('[onboarding-complete] → 404: 用户不存在');
    return res.status(404).json({ error: '用户不存在' });
  }
  console.log('[onboarding-complete] 写入前 user.onboardingDone:', user.onboardingDone);
  user.onboardingDone = true;
  console.log('[onboarding-complete] 写入后 user.onboardingDone:', user.onboardingDone);
  writeUsers(users);
  console.log('[onboarding-complete] writeUsers 完成, 返回 ok');
  res.json({ ok: true, onboardingDone: true });
});

// 根据最近对话，用 AI 生成 3 个后续话题建议
async function generateSuggestions(sessionHistory, signal) {
  if (!DEEPSEEK_API_KEY) return [];
  try {
    // 只取最近 6 轮（12 条消息）作为上下文
    var recent = sessionHistory.slice(-12);
    var contextText = recent
      .map(function (m) { return (m.role === 'user' ? '学生' : '小新') + '：' + m.content; })
      .join('\n');

    var result = await requestChatCompletion({
      endpoint: `${DEEPSEEK_BASE_URL}/chat/completions`,
      apiKey: DEEPSEEK_API_KEY,
      model: DEEPSEEK_MODEL_REPLY,
      messages: [
        {
          role: 'system',
          content:
            '你是小新，一个陪伴小学生聊天的 AI 伙伴。根据上面的聊天内容，想出 3 个学生可能会感兴趣继续聊下去的话题，每个话题 6~14 个字。用小学生的口吻，轻松有趣。只输出 3 行，每行一个话题，不要编号、不要解释。',
        },
        { role: 'user', content: '以下是聊天记录——\n' + contextText + '\n\n请给出 3 个建议话题，每行一个：' },
      ],
      temperature: 0.9,
      maxTokens: 120,
      timeoutMs: 8000,
      externalSignal: signal,
    });

    var text = (result.content || '').trim();
    // 按行拆分，去掉编号前缀和空行
    var lines = text
      .split('\n')
      .map(function (l) { return l.replace(/^[\d\.\、\-\s]+/, '').trim(); })
      .filter(function (l) { return l.length >= 3 && l.length <= 30; })
      .slice(0, 3);

    return lines.length >= 2 ? lines : [];
  } catch (_) {
    return [];
  }
}

// 多轮会话接口（带历史记忆）
app.post('/chat/session', async (req, res) => {
  const { sessionId, topicSource } = req.body;
    const rawMessage = req.body.message;

    // sessionId 校验
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'INVALID_REQUEST' });
    }

    // 消息校验（类型 / 空值 / 长度 — 在任何写入和 AI 调用之前）
    var msgResult = validateChatMessage(rawMessage);
    if (!msgResult.ok) {
      return res.status(msgResult.status).json({ error: msgResult.error });
    }
    var message = msgResult.message;  // trimmed safe message

    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({
        error: '服务端未配置 DEEPSEEK_API_KEY，请检查 .env 文件',
      });
    }

    // 客户端断开取消: 创建请求级 AbortController
    // 使用 res close 事件检测客户端断开 — res close 在连接关闭时触发，
    // 不会在 Express body 解析完成后误触发
    var disconnectController = new AbortController();
    res.on('close', function () {
      // writableEnded: false 表示响应尚未发送 → 真正的提前断开
      if (!res.writableEnded) {
        disconnectController.abort();
      }
    });

    // 把学生发送消息的时间记录下来，方便以后计算耗时
    const now = Date.now();
    const lastReplyTime = lastAiReplyTime.get(sessionId);
    const durationSec = lastReplyTime ? Math.round((now - lastReplyTime) / 1000) : null;

    // 获取或创建该 session 的历史
    if (!sessionStore.has(sessionId)) {
      // Try to recover from history.json (survives server restarts)
      const history = readHistory();
      const existing = history.find(h => h.sessionId === sessionId && !h.completed && (!h.userId || h.userId === 'guest'));
      if (existing && existing.messages) {
        sessionStore.set(sessionId, existing.messages);
      } else {
        sessionStore.set(sessionId, []);
      }
    }
    const history = sessionStore.get(sessionId);

    // 记录 topicSource（只存不发给 AI，方便以后后端过滤）
    const source = topicSource || 'normal';

    // 把当前用户消息追加到历史
    // 【防重复提交兜底】如果同一session在1秒内收到内容完全相同的连续用户消息，跳过
    const lastMsg = history.length > 0 ? history[history.length - 1] : null;
    const isDup = lastMsg && lastMsg.role === 'user' && lastMsg.content === message
      && lastMsg._ts && (Date.now() - lastMsg._ts < 1000);
    if (isDup) {
      // 找到前一条 AI 回复，直接返回，不重复调用大模型
      const prevAi = history.filter(m => m.role === 'assistant').slice(-1)[0];
      return res.json({ reply: prevAi ? prevAi.content : '（刚刚已经收到你的消息啦）', imageUrl: undefined });
    }

    // ==========================================================
    //  对话主流程
    // ==========================================================
    try {
        // 读取或初始化 conversation state（仅存入局部变量，
        // 只有 runV2Turn 成功后才会持久化到 conversationStateStore）。
        let previousState = conversationStateStore.get(sessionId);

        if (!previousState) {
          const historyEntries = readHistory();
          const entry = historyEntries.find(
            h => h.sessionId === sessionId
          );
          const cs = getV2Cs();
          if (
            entry &&
            entry.conversationState &&
            typeof entry.conversationState === 'object'
          ) {
            previousState = cs.normalizeConversationState(
              entry.conversationState
            );
          } else {
            previousState = cs.createInitialConversationState();
          }
        }

        // 只读快照（不包含本轮学生消息）
        const historySnapshot = history.map(function (m) {
          return { role: m.role, content: m.content };
        });

        // 上下文预算裁剪：analyze 和 generate 共用同一历史窗口
        var V2Budgeted = buildBudgetedMessages({
          systemMessages: [],  // system prompt 在各自回调中单独处理
          history: historySnapshot,
          currentUserMessage: message,
          maxTotalChars: BUDGET_PRESETS.V2_ANALYZE.maxTotalChars,
          maxTurns: BUDGET_PRESETS.V2_ANALYZE.maxTurns,
        });
        var V2BudgetedHistory = V2Budgeted.historyMessages;

        const prompts = getV2Prompts();
        const v2Turn = getV2RunTurn();

        // ---- analyze 回调 ----
        async function analyzeCallback(ctx) {
          const convoText = buildAnalyzeConversation(
            ctx.history,
            ctx.studentMessage
          );

          const systemContent =
            prompts.analyze +
            '\n\n===== RUNTIME STATE =====\n' +
            ctx.runtimeState +
            '\n===== END RUNTIME STATE =====';

          var result;
          try {
            result = await requestChatCompletion({
              endpoint: `${DEEPSEEK_BASE_URL}/chat/completions`,
              apiKey: DEEPSEEK_API_KEY,
              model: DEEPSEEK_MODEL_ANALYZE,
              messages: [
                { role: 'system', content: systemContent },
                { role: 'user', content: convoText },
              ],
              temperature: 0.1,
              maxTokens: 8192,
              timeoutMs: 20000,
              externalSignal: disconnectController.signal,
            });
          } catch (e) {
            // analyze 失败降级: 不中断本轮，继续生成回复
            if (e instanceof ProviderError) {
              if (e.code !== PROVIDER_ERROR_CODES.INTERNAL_ERROR) {
                // 安全日志：不记 provider body/endpoint/err.message
                console.error('[provider] analyze ' + e.code);
              }
            }
            return null;
          }

          const raw = result.content.trim();

          // JSON 解析容错
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {
            const cleaned = raw
              .replace(/^```json\s*/i, '')
              .replace(/```$/i, '')
              .trim();
            try {
              parsed = JSON.parse(cleaned);
            } catch (_2) {
              return null;
            }
          }

          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
          }

          return parsed;
        }

        // ---- generateReply 回调 ----
        async function generateReplyCallback(ctx) {
          const conversationMessages =
            buildV2ConversationMessages(
              ctx.history,
              ctx.studentMessage
            );

          const systemContent =
            prompts.xiaoxin +
            '\n\n===== RUNTIME STATE =====\n' +
            ctx.runtimeState +
            '\n===== END RUNTIME STATE =====';

          var result;
          try {
            result = await requestChatCompletion({
              endpoint: `${DEEPSEEK_BASE_URL}/chat/completions`,
              apiKey: DEEPSEEK_API_KEY,
              model: DEEPSEEK_MODEL_REPLY,
              messages: [
                { role: 'system', content: systemContent },
                ...conversationMessages,
              ],
              timeoutMs: 25000,
              externalSignal: disconnectController.signal,
            });
          } catch (e) {
            if (e instanceof ProviderError) {
              // Re-throw to outer catch → 500 with correct error code
              throw e;
            }
            throw new ProviderError('INTERNAL_ERROR', 'generate callback error');
          }

          var reply = result.content;

          if (typeof reply !== 'string' || reply.trim().length === 0) {
            return '';
          }

          return reply;
        }

        // ---- repairReply 回调 ----
        async function repairReplyCallback(ctx) {
          const userPayload = JSON.stringify({
            student_message: ctx.studentMessage,
            original_reply: ctx.originalReply,
            stage: ctx.state.stage,
            question_budget: ctx.state.question_budget,
            validation_errors: ctx.validationErrors,
            known_facts: (ctx.state.known_facts || []).map(
              function (f) {
                return { key: f.key, value: f.value };
              }
            ),
          });

          try {
            var result = await requestChatCompletion({
              endpoint: `${DEEPSEEK_BASE_URL}/chat/completions`,
              apiKey: DEEPSEEK_API_KEY,
              model: DEEPSEEK_MODEL_REPLY,
              messages: [
                { role: 'system', content: prompts.repair },
                { role: 'user', content: userPayload },
              ],
              temperature: 0.3,
              maxTokens: 200,
              timeoutMs: 10000,
              externalSignal: disconnectController.signal,
            });

            var repaired = result.content;
            return typeof repaired === 'string' && repaired.trim().length > 0
              ? repaired
              : '';
          } catch (_) {
            // repair 失败使用 fallback，不中断成功主回复
            return '';
          }
        }

        // ---- 执行 runV2Turn ----
        const result = await v2Turn({
          previousState: previousState,
          history: V2BudgetedHistory,
          studentMessage: message,
          analyze: analyzeCallback,
          generateReply: generateReplyCallback,
          repairReply: repairReplyCallback,
        });

        // ---- 提交事务 ----
        history.push({
          role: 'user',
          content: message,
          topicSource: source,
          _ts: Date.now(),
        });

        history.push({
          role: 'assistant',
          content: result.finalReply,
        });

        conversationStateStore.set(
          sessionId,
          result.nextState
        );

        lastAiReplyTime.set(sessionId, Date.now());

        // chat-log
        const logEntry = {
          student_input: message,
          ai_response: result.finalReply,
          duration: durationSec,
          choice: null,
          evidence_snippet: null,
          dimension_tag: null,
        };
        try {
          fs.appendFileSync(
            path.join(DATA_DIR, 'chat-log.jsonl'),
            JSON.stringify(logEntry) + '\n',
            'utf-8'
          );
        } catch (_) {}

        // farewell / imageUrl
        let imageUrl = null;
        if (
          isFarewellReply(
            result.finalReply,
            historySnapshot.concat([
              { role: 'user', content: message },
              { role: 'assistant', content: result.finalReply },
            ])
          )
        ) {
          try {
            const fullHistory = history
              .map(function (m) {
                return { role: m.role, content: m.content };
              });
            const prompt = buildImagePromptHeuristic(fullHistory);
            imageUrl =
              'https://image.pollinations.ai/prompt/' +
              encodeURIComponent(prompt) +
              '?width=512&height=512&nologo=true';
          } catch (_) {}
        }

        // Generate suggestions (don't block on failure)
        var suggestions = [];
        try {
          suggestions = await generateSuggestions(history, disconnectController.signal);
        } catch (_) {}

        return res.json({
          reply: result.finalReply,
          imageUrl: imageUrl || undefined,
          suggestions: suggestions,
        });
      } catch (err) {
        // V2 失败不修改 history / state / chat-log
        var httpStatus = 500;
        var errCode = 'INTERNAL_ERROR';
        if (err instanceof ProviderError) {
          httpStatus = err.httpStatus;
          errCode = err.code;
        }
        return res.status(httpStatus).json({
          error: errCode,
        });
      }
});

// 恢复一段历史对话到当前 session（前端点击"继续这段对话"时调用）
app.post('/api/session/restore', authMiddleware, (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    if (!sessionId || !Array.isArray(messages)) {
      return res.status(400).json({ error: '缺少 sessionId 或 messages' });
    }
    // Verify messages belong to this user (check that the history entry exists for this userId)
    const history = readHistory();
    const conv = history.find(h => h.sessionId === sessionId && h.userId === req.userId);
    if (!conv) {
      return res.status(403).json({ error: '无权恢复此对话' });
    }
    sessionStore.set(sessionId, [...messages]);
    res.json({ ok: true, count: messages.length });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 简单单轮对话接口
app.post('/chat/simple', async (req, res) => {
  try {
    const rawMessage = req.body.message;

    // 消息校验（类型 / 空值 / 长度 — 在任何 AI 调用之前）
    var msgResult = validateChatMessage(rawMessage);
    if (!msgResult.ok) {
      return res.status(msgResult.status).json({ error: msgResult.error });
    }
    var message = msgResult.message;  // trimmed safe message

    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({
        error: '服务端未配置 DEEPSEEK_API_KEY，请检查 .env 文件',
      });
    }

    // 客户端断开取消
    var disconnectController = new AbortController();
    res.on('close', function () {
      if (!res.writableEnded) disconnectController.abort();
    });

    // 调用 DeepSeek API（单轮对话，无历史，无 system prompt）
    var simpleResult;
    try {
      simpleResult = await requestChatCompletion({
        endpoint: `${DEEPSEEK_BASE_URL}/chat/completions`,
        apiKey: DEEPSEEK_API_KEY,
        model: DEEPSEEK_MODEL_REPLY,
        messages: [
          { role: 'user', content: message },
        ],
        timeoutMs: 25000,
        externalSignal: disconnectController.signal,
      });
    } catch (err) {
      if (err instanceof ProviderError) {
        return res.status(err.httpStatus).json({ error: err.code });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    res.json({ reply: simpleResult.content });
  } catch (err) {
    // 本地未知异常
    res.status(500).json({
      error: 'INTERNAL_ERROR',
    });
  }
});

// ============================================================
//  历史对话存储 API
// ============================================================
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
function readHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    if (!raw || raw.trim().length === 0) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function writeHistory(data) {
  // Safety: refuse to overwrite history.json with empty data
  if (!Array.isArray(data) || data.length === 0) {
    console.error('[history] REFUSED to write empty array to history.json — this would delete all records');
    return;
  }
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = HISTORY_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, HISTORY_FILE);
}

// 保存/更新一段对话（支持通过 sessionId upsert）
app.post('/api/history', authMiddleware, (req, res) => {
  try {
    const { sessionId, messages, turnCount, weather, weatherLabel, completed, convId } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '缺少 messages 或 messages 为空' });
    }
    if (!messages.some(function(m) { return m && m.role === 'user'; })) {
      return res.status(400).json({ error: '没有用户消息，不保存空对话' });
    }
    const history = readHistory();

    // Upsert: prefer convId match, then sessionId match
    let existingIdx = -1;
    if (convId) {
      existingIdx = history.findIndex(h => h.id === convId && !h.completed);
      if (existingIdx < 0) existingIdx = history.findIndex(h => h.id === convId);
    }
    if (existingIdx < 0 && sessionId) {
      existingIdx = history.findIndex(h => h.sessionId === sessionId && !h.completed);
      if (existingIdx < 0) existingIdx = history.findIndex(h => h.sessionId === sessionId && h.completed);
    }

    const isNew = existingIdx < 0;
    const previousEntry =
      existingIdx >= 0 ? history[existingIdx] : null;

    const entry = {
      id: isNew ? ('conv-' + Date.now()) : history[existingIdx].id,
      userId: existingIdx >= 0 ? history[existingIdx].userId : req.userId,
      sessionId: sessionId || null,
      startTime: isNew ? new Date().toISOString() : history[existingIdx].startTime,
      turnCount: turnCount || messages.filter(m => m.role === 'user').length,
      weather: weather || null,
      completed: completed !== false,
      messages,
    };

    // 保留旧 analysis（如 V1 async analyze 产物）
    if (
      previousEntry &&
      Object.prototype.hasOwnProperty.call(
        previousEntry,
        'analysis'
      )
    ) {
      entry.analysis = previousEntry.analysis;
    }

    // V2 conversationState 持久化
    if (
      sessionId &&
      conversationStateStore.has(sessionId)
    ) {
      entry.conversationState =
        getV2Cs().normalizeConversationState(
          conversationStateStore.get(sessionId)
        );
    } else if (
      previousEntry &&
      Object.prototype.hasOwnProperty.call(
        previousEntry,
        'conversationState'
      )
    ) {
      // 没有新的 state，但旧 entry 已有，保留不删除
      entry.conversationState =
        previousEntry.conversationState;
    }

    // Snapshot the old completed state BEFORE overwriting the entry
    const wasIncomplete = existingIdx >= 0 && !history[existingIdx].completed;

    if (isNew) { history.push(entry); } else { history[existingIdx] = entry; }
    writeHistory(history);

    const action = isNew ? 'created' : 'updated';
    console.log('[结束流程] [1/5] 历史记录保存成功 {' + action + '} ' + entry.id + ' completed=' + entry.completed + ' turns=' + entry.turnCount + ' msgs=' + entry.messages.length);

    // Trigger analysis + journal when completed for the FIRST time.
    // isCompleting = (new & completed) OR (previously incomplete & now completed)
    const isCompleting = entry.completed && (isNew || wasIncomplete);
    console.log('[结束流程] isNew=' + isNew + ' wasIncomplete=' + wasIncomplete + ' isCompleting=' + isCompleting);

    if (isCompleting) {
      console.log('[结束流程] [2/5] 开始异步调用 /analyze (triggerAsyncAnalysis) ...');
      triggerAsyncAnalysis(entry.id, entry.messages);
      const wl = weatherLabel || weather || '晴天';
      console.log('[结束流程] [3/5] 开始异步生成手账本 (triggerAsyncJournal) ...');
      triggerAsyncJournal(entry.id, entry.messages, weather || 'sunny', wl);
    } else {
      console.log('[结束流程] 跳过 analysis + journal (entry.completed=' + entry.completed + ')');
    }

    console.log('[结束流程] [5/5] 保存流程主分支返回响应给前端');
    res.json({ id: entry.id, updated: existingIdx >= 0 });
  } catch (err) {
    console.error('[history] save FAILED:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取自动保存的对话（用于页面刷新恢复）
app.get('/api/history/auto-save', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: '缺少 sessionId' });
    }
    const history = readHistory();
    const entry = history.find(h => h.sessionId === sessionId && h.userId === req.userId && !h.completed);
    if (!entry) {
      return res.status(404).json({ error: '无自动保存记录' });
    }
    res.json({
      sessionId: entry.sessionId,
      messages: entry.messages || [],
      turnCount: entry.turnCount || 0,
      weather: entry.weather || null
    });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 自动保存（每轮对话后调用，标记为未完成）
app.put('/api/history/auto-save', authMiddleware, (req, res) => {
  try {
    const { sessionId, messages, turnCount, weather, convId } = req.body;
    if (!sessionId || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '缺少 sessionId 或 messages' });
    }
    if (!messages.some(function(m) { return m && m.role === 'user'; })) {
      return res.status(400).json({ error: '没有用户消息，不保存空对话' });
    }
    const history = readHistory();
    // 如果有 convId（续接旧对话），优先用 convId 查找原记录
    let existingIdx = -1;
    if (convId) {
      existingIdx = history.findIndex(h => h.id === convId && !h.completed);
      if (existingIdx < 0) existingIdx = history.findIndex(h => h.id === convId);
    }
    if (existingIdx < 0) {
      existingIdx = history.findIndex(h => h.sessionId === sessionId && !h.completed);
    }
    const isNewAuto = existingIdx < 0;
    const previousEntryAuto =
      existingIdx >= 0 ? history[existingIdx] : null;

    const entry = {
      id: existingIdx >= 0 ? history[existingIdx].id : ('conv-' + Date.now()),
      userId: existingIdx >= 0 ? history[existingIdx].userId : req.userId,
      sessionId,
      startTime: existingIdx >= 0 ? history[existingIdx].startTime : new Date().toISOString(),
      turnCount: turnCount || messages.filter(m => m.role === 'user').length,
      weather: weather || null,
      completed: false,
      messages,
    };

    // 保留旧 analysis
    if (
      previousEntryAuto &&
      Object.prototype.hasOwnProperty.call(
        previousEntryAuto,
        'analysis'
      )
    ) {
      entry.analysis = previousEntryAuto.analysis;
    }

    // V2 conversationState 持久化
    if (
      conversationStateStore.has(sessionId)
    ) {
      entry.conversationState =
        getV2Cs().normalizeConversationState(
          conversationStateStore.get(sessionId)
        );
    } else if (
      previousEntryAuto &&
      Object.prototype.hasOwnProperty.call(
        previousEntryAuto,
        'conversationState'
      )
    ) {
      entry.conversationState =
        previousEntryAuto.conversationState;
    }
    if (existingIdx >= 0) {
      history[existingIdx] = entry;
    } else {
      history.push(entry);
    }
    writeHistory(history);
    res.json({ id: entry.id, updated: existingIdx >= 0 });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 列出所有历史对话（摘要，不含完整消息）
app.get('/api/history', authMiddleware, (req, res) => {
  try {
    const history = readHistory().filter(function(h) {
      return h.userId === req.userId &&
        Array.isArray(h.messages) &&
        h.messages.some(function(m) { return m && m.role === 'user'; });
    });
    const summaries = history.map(h => ({
      id: h.id,
      startTime: h.startTime,
      turnCount: h.turnCount,
      weather: h.weather,
      completed: h.completed !== false,
      preview: (h.messages.find(function(m){return m&&m.role==='user'})||{}).content ? (h.messages.find(function(m){return m&&m.role==='user'})||{}).content.slice(0,40) : '(空对话)',
    }));
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 查找用户可访问的历史记录条目（支持学生本人或绑定教师访问）
function findUserHistoryEntry(history, historyId, userId) {
  // 先按学生本人查找
  var entry = history.find(function (h) {
    return h.id === historyId && h.userId === userId;
  });
  if (entry) return entry;

  // 检查是否为教师，允许教师访问已绑定学生的对话
  var users = readUsers();
  var user = users.find(function (u) { return u.id === userId; });
  if (!user || user.role !== 'teacher') return null;

  // 找到该历史记录所属的学生
  var studentEntry = history.find(function (h) { return h.id === historyId; });
  if (!studentEntry) return null;

  var bindings = readBindings();
  if (teacherCanAccessStudent({ teacherId: userId, studentId: studentEntry.userId, bindings: bindings })) {
    return studentEntry;
  }

  return null;
}

// 获取单段对话的完整内容
app.get('/api/history/:id', authMiddleware, (req, res) => {
  try {
    const history = readHistory();
    const entry = findUserHistoryEntry(history, req.params.id, req.userId);
    if (!entry) return res.status(404).json({ error: '对话不存在' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 重新分析一段对话（用于教师端"重试分析"按钮）
app.post('/api/history/:id/reanalyze', authMiddleware, async (req, res) => {
  try {
    const history = readHistory();
    const entry = findUserHistoryEntry(history, req.params.id, req.userId);
    if (!entry) return res.status(404).json({ error: '对话不存在' });
    const idx = history.findIndex(function (h) { return h.id === entry.id; });
    if (idx < 0) return res.status(404).json({ error: '对话不存在' });

    if (!Array.isArray(entry.messages) || entry.messages.length === 0) {
      return res.status(400).json({ error: '对话消息为空，无法分析' });
    }

    console.log('[reanalyze] Starting reanalysis for conversation ' + entry.id + ' (' + entry.messages.length + ' messages)');

    const result = await runAnalyze(entry.messages, { timeoutMs: 60000 });

    if (!result) {
      history[idx].analysis = { status: 'failed' };
      writeHistory(history);
      console.log('[reanalyze] Analysis returned null for ' + entry.id);
      return res.status(502).json({ error: 'AI 分析返回空结果，请稍后重试' });
    }

    var turnCount = (typeof entry.turnCount === 'number') ? entry.turnCount : 0;
    var translated = translateV2ToV1Compatible(result, turnCount);
    history[idx].analysis = {
      status: 'done',
      engineVersion: 'v2-translated',
      result: translated || result,
    };
    writeHistory(history);

    var hitCount = (translated && Array.isArray(translated['命中指标'])) ? translated['命中指标'].length : 0;
    console.log('[reanalyze] Analysis succeeded for ' + entry.id + ' — ' + hitCount + ' hits');
    res.json({ ok: true, hitCount: hitCount });
  } catch (err) {
    logSanitizedBackgroundError(err);
    console.error('[reanalyze] Analysis failed for ' + req.params.id);
    // 标记为 failed
    try {
      const history2 = readHistory();
      const found2 = findUserHistoryEntry(history2, req.params.id, req.userId);
      if (found2) {
        const idx2 = history2.findIndex(function (h) { return h.id === found2.id; });
        if (idx2 >= 0) { history2[idx2].analysis = { status: 'failed' }; writeHistory(history2); }
      }
    } catch (_) {}
    res.status(502).json({ error: '分析请求失败，请稍后重试' });
  }
});

// 删除一条历史记录（同时清理关联的手账本记录）
app.delete('/api/history/:id', authMiddleware, (req, res) => {
  try {
    const history = readHistory();
    const idx = history.findIndex(h => h.id === req.params.id && h.userId === req.userId);
    if (idx < 0) return res.status(404).json({ error: '对话不存在' });
    history.splice(idx, 1);
    writeHistory(history);
    // Also remove linked journal entry
    const journal = readJournal();
    const filtered = journal.filter(e => e.historyId !== req.params.id);
    if (filtered.length < journal.length) writeJournal(filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============================================================
//  异步分析 — 对话结束后自动调用 /analyze，不阻塞响应
// ============================================================
async function runAnalyze(messages, _opts) {
  var timeoutMs = (_opts && typeof _opts.timeoutMs === 'number') ? _opts.timeoutMs : 45000;

  // 规范化并找到最后一个 user 消息
  var cleanMsgs = [];
  for (var mi = 0; mi < messages.length; mi++) {
    var m = messages[mi];
    if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (typeof m.content !== 'string') continue;
    cleanMsgs.push({ role: m.role, content: m.content });
  }

  // 找最后一个 user 消息
  var lastUserIdx = -1;
  for (var ui = cleanMsgs.length - 1; ui >= 0; ui--) {
    if (cleanMsgs[ui].role === 'user') { lastUserIdx = ui; break; }
  }
  if (lastUserIdx < 0) return null;

  var currentUserMessage = cleanMsgs[lastUserIdx].content;
  var historyMsgs = cleanMsgs.slice(0, lastUserIdx);

  // 上下文预算裁剪
  var Budgeted = buildBudgetedMessages({
    systemMessages: [{ role: 'system', content: ANALYZE_SYSTEM_PROMPT.replace('{{对话记录}}', '') }],
    history: historyMsgs,
    currentUserMessage: currentUserMessage,
    maxTotalChars: BUDGET_PRESETS.BACKGROUND_ANALYZE.maxTotalChars,
    maxTurns: BUDGET_PRESETS.BACKGROUND_ANALYZE.maxTurns,
  });

  var allMsgs = Budgeted.historyMessages.concat([
    { role: 'user', content: currentUserMessage },
  ]);

  let convoText = '';
  let round = 0;
  for (const cm of allMsgs) {
    if (cm.role === 'user') round++;
    const speaker = cm.role === 'user' ? '学生' : '小新';
    convoText += `第${round}轮 ${speaker}：${cm.content}\n`;
  }
  const fullPrompt = ANALYZE_SYSTEM_PROMPT.replace('{{对话记录}}', convoText);

  try {
    const { content } = await requestChatCompletion(_providerOptions({
      messages: [
        { role: 'system', content: fullPrompt },
        { role: 'user', content: convoText },
      ],
      temperature: 0.1,
      maxTokens: 8192,
      timeoutMs: timeoutMs,
    }));

    const raw = (content || '').trim();
    try { return JSON.parse(raw); } catch (_) {}
    // Strip markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    try { return JSON.parse(cleaned); } catch (_2) { return null; }
  } catch (err) {
    logSanitizedBackgroundError(err);
    return null;
  }
}

// Fire-and-forget journal creation (called from POST /api/history when completed)
async function triggerAsyncJournal(historyId, messages, weather, weatherLabel) {
  console.log('[journal] [3a/5] triggerAsyncJournal START historyId=' + historyId);
  // Dedup: skip if a journal entry already exists for this historyId
  const journal = readJournal();
  const existing = journal.find(e => e.historyId === historyId);
  if (existing) {
    console.log('[journal] [3a/5] SKIP: entry already exists for historyId=' + historyId + ' (existing=' + existing.id + ')');
    return;
  }

  try {
    // Phase 1: extract distinct events from the conversation via DeepSeek
    console.log('[journal] [3a/5] calling extractConversationEvents...');
    const events = await extractConversationEvents(messages);
    console.log('[journal] [3a/5] extracted ' + events.length + ' event(s)');

    // Phase 2: generate an image for each event using direct translation
    console.log('[journal] [3a/5] generating images for ' + events.length + ' events...');
    const eventEntries = [];
    for (const ev of events) {
      const prompt = await translateEventToImagePrompt(ev.title, ev.description, ev.mood || 'calm');
      console.log('[journal] [3a/5] image prompt generated');
      eventEntries.push({
        id: 'event-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        title: ev.title,
        description: ev.description,
        imageUrl: 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=512&height=512&nologo=true',
        imageStatus: 'ready',
      });
    }

    const entry = {
      id: 'journal-' + Date.now(),
      historyId,
      userId: (readHistory().find(h => h.id === historyId) || {}).userId || 'unknown',
      date: new Date().toISOString(),
      mood: weatherLabel || '晴天',
      moodIcon: weather || 'sunny',
      events: eventEntries,
    };
    journal.push(entry);
    writeJournal(journal);
    console.log('[journal] [3a/5] SUCCESS: created ' + entry.id + ' with ' + eventEntries.length + ' events');
    console.log('[结束流程] [3a/5] 手账本生成成功 ' + entry.id);
  } catch (err) {
    logSanitizedBackgroundError(err);
    console.error('[journal] [3a/5] FAILED');
    console.error('[结束流程] [3a/5] 手账本生成失败');
    try {
      const j2 = readJournal();
      j2.push({
        id: 'journal-' + Date.now(),
        historyId,
        userId: (readHistory().find(h => h.id === historyId) || {}).userId || 'unknown',
        date: new Date().toISOString(),
        mood: weatherLabel || '晴天',
        moodIcon: weather || 'sunny',
        events: [{ id: 'event-' + Date.now(), title: '今日聊天', description: '记录待补充', imageUrl: null, imageStatus: 'pending' }],
      });
      writeJournal(j2);
      console.log('[journal] [3a/5] fallback placeholder saved');
    } catch (_) {}
  }
}

// Translate a Chinese event title+description into a specific English image prompt.
// Uses DeepSeek so every event gets a faithful, non-generic prompt.
async function translateEventToImagePrompt(title, description, mood, _opts) {
  var timeoutMs = (_opts && typeof _opts.timeoutMs === 'number') ? _opts.timeoutMs : 30000;

  const text = title + '：' + description;
  try {
    const { content } = await requestChatCompletion(_providerOptions({
      max_tokens: 200,
      temperature: 0.3,
      timeoutMs: timeoutMs,
      messages: [
        { role: 'system', content: `Translate the Chinese event description below into ONE English sentence (30-60 words) for a children's book image prompt. Include EVERY specific object, action, colour, food, place, and person mentioned.

CRITICAL — MATCH THE MOOD OF THE SCENE:
The emotional mood of this event is: "${mood || 'calm'}".
- If the mood is sad/anxious/angry: use soft cool colors (blues, purples, greys), quiet posture (head down, sitting alone, looking out a window), gentle melancholy — like a sensitive children's book page about difficult feelings. NO smiles, NO bright warm light, NO cheerful energy.
- If the mood is happy/calm: use warm bright colors, relaxed posture — warm and gentle.
- If the mood is mixed: balance both tones, show a quiet moment with subtle emotional complexity.
- NEVER force a happy scene onto a sad story. Stay faithful to the emotional truth of the Chinese text.

After the scene description, append: "children's book illustration style, soft watercolor, cute and whimsical, flat 2D art, 1-2 simple characters only, NOT photorealistic".

Examples:
- (mood: happy) "制作云朵小蛋糕" → "A child decorating a cloud-shaped cake with pink strawberry pieces, blueberries, and creamy white frosting swirls on a bright table, children's book illustration style..."
- (mood: happy) "做水果果汁冻" → "A child pouring mango, grape and orange juice into small round moulds, the frozen jelly shining like colorful gemstones on a plate beside cookies"
- (mood: sad) "考试没考好很沮丧" → "A child sitting alone at a desk with a test paper, head resting on folded arms, soft grey-blue evening light through the window, quiet and still mood"

Output ONLY the English prompt. No markdown.` },
        { role: 'user', content: text },
      ],
    }));

    const prompt = (content || '').trim();
    if (prompt.length > 15) return prompt + ' --ar 4:3';
  } catch (err) {
    logSanitizedBackgroundError(err);
  }
  // Fallback: direct translation using the heuristic keyword table
  return buildImagePromptHeuristic([{ role: 'user', content: text }], mood);
}

// Extract distinct events from a conversation using DeepSeek
async function extractConversationEvents(messages, _opts) {
  var timeoutMs = (_opts && typeof _opts.timeoutMs === 'number') ? _opts.timeoutMs : 30000;

  try {
    // 规范化并找到最后一个 user 消息
    var cleanMsgs = [];
    for (var mi = 0; mi < messages.length; mi++) {
      var m = messages[mi];
      if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      if (typeof m.content !== 'string') continue;
      cleanMsgs.push({ role: m.role, content: m.content });
    }

    // 找最后一个 user 消息
    var lastUserIdx = -1;
    for (var ui = cleanMsgs.length - 1; ui >= 0; ui--) {
      if (cleanMsgs[ui].role === 'user') { lastUserIdx = ui; break; }
    }
    if (lastUserIdx < 0) {
      return [{ title: '今日心情', description: '记录下今天想说的话', mood: 'calm' }];
    }

    var currentUserMessage = cleanMsgs[lastUserIdx].content;
    var historyMsgs = cleanMsgs.slice(0, lastUserIdx);

    // 上下文预算裁剪
    var Budgeted = buildBudgetedMessages({
      systemMessages: [],
      history: historyMsgs,
      currentUserMessage: currentUserMessage,
      maxTotalChars: BUDGET_PRESETS.EXTRACT_EVENTS.maxTotalChars,
      maxTurns: BUDGET_PRESETS.EXTRACT_EVENTS.maxTurns,
    });

    var allMsgs = Budgeted.historyMessages.concat([
      { role: 'user', content: currentUserMessage },
    ]);

    const convoText = allMsgs
      .map(m => (m.role === 'user' ? '学生' : '小新') + '：' + m.content)
      .join('\n');

    const { content } = await requestChatCompletion(_providerOptions({
      messages: [
        { role: 'system', content: `你是一个对话分析助手。读一段学生和AI朋友小新的聊天记录，从中识别出学生提到的、有具体画面感的独立小事件。每个事件应该是一个可以画成插画的小场景。

规则：
- 提取学生主动提到的、有具体场景/动作/画面感的内容（比如"体育课打篮球赢了""小猫汤圆趴在窗台上晒太阳"）
- 也允许提取学生表达的情绪状态和情绪相关的具体情境（例如"和朋友吵架很难过""考试没考好很沮丧""被批评了心情不好""今天被老师表扬了特别开心"），在description里保留真实的情绪基调（正面/负面/复杂），不要美化或强行转向积极
- 每个事件给一个简短标题（不超过15个字）和一句描述（不超过30字，像手账里的记录，忠实于学生的真实感受）
- 每个事件还需要一个 "mood" 字段，根据对话内容判断情绪，取值必须是以下之一：happy / sad / angry / anxious / calm / mixed
- 同一段对话如果只围绕一个主题，就只输出1个事件；如果有明显不同的几个话题切换，最多输出4个事件
- 输出JSON数组格式，不要任何额外文字：
[{"title": "标题", "description": "简短描述", "mood": "happy/sad/angry/anxious/calm/mixed"}, ...]` },
        { role: 'user', content: convoText },
      ],
      maxTokens: 800,
      temperature: 0.3,
      timeoutMs: timeoutMs,
    }));

    const raw = (content || '').trim();
    // Parse JSON, stripping markdown fences if present
    const cleaned = raw.replace(/^```[a-z]*\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 4);
    return [{ title: '今日心情', description: '记录下今天想说的话', mood: 'calm' }];
  } catch (err) {
    logSanitizedBackgroundError(err);
    return [{ title: '今日心情', description: '记录下今天想说的话', mood: 'calm' }];
  }
}

function triggerAsyncAnalysis(historyId, messages) {
  console.log('[结束流程] [2a/5] /analyze 开始执行 (triggerAsyncAnalysis) ...');
  // Fire-and-forget: don't await, don't block, don't throw
  runAnalyze(messages).then(result => {
    if (!result) {
      const history = readHistory(); const idx = history.findIndex(h => h.id === historyId);
      if (idx >= 0) { history[idx].analysis = { status: 'failed' }; writeHistory(history); }
      console.log('[结束流程] [2a/5] /analyze 调用成功但返回空结果，标记为 failed');
      return;
    }
    const history = readHistory(); const idx = history.findIndex(h => h.id === historyId);
    if (idx >= 0) {
      var turnCount = (typeof history[idx].turnCount === 'number') ? history[idx].turnCount : 0;
      var translated = translateV2ToV1Compatible(result, turnCount);
      history[idx].analysis = {
        status: 'done',
        engineVersion: 'v2-translated',
        result: translated || result,
      };
      writeHistory(history);
    }
    console.log('[结束流程] [2a/5] /analyze 调用成功，结果已写入 analysis 字段');
  }).catch((e) => {
    const history = readHistory(); const idx = history.findIndex(h => h.id === historyId);
    if (idx >= 0) { history[idx].analysis = { status: 'failed' }; writeHistory(history); }
    logSanitizedBackgroundError(e);
    console.log('[结束流程] [2a/5] /analyze 调用失败，已写 status:failed');
  });
}

// ============================================================
//  手账本 (Journal) 存储 API
// ============================================================
const JOURNAL_FILE = path.join(DATA_DIR, 'journal.json');
function readJournal() {
  try {
    if (!fs.existsSync(JOURNAL_FILE)) return [];
    const raw = fs.readFileSync(JOURNAL_FILE, 'utf-8');
    if (!raw || raw.trim().length === 0) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function writeJournal(data) {
  // Safety: refuse to overwrite journal.json with empty data
  if (!Array.isArray(data) || data.length === 0) {
    console.error('[journal] REFUSED to write empty array to journal.json — this would delete all records');
    return;
  }
  const dir = path.dirname(JOURNAL_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = JOURNAL_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, JOURNAL_FILE);
}

// 话题关键词 → 主题图标映射（扩充覆盖更多学生话题）
const TOPIC_ICON_MAP = [
  { keywords: ['猫','小猫','猫咪','汤圆','咪咪','喵'], icon: 'cat' },
  { keywords: ['狗','小狗','狗狗','旺财','汪','金毛','泰迪'], icon: 'dog' },
  { keywords: ['兔子','仓鼠','金鱼','乌龟','鹦鹉','鸟','宠物'], icon: 'pet' },
  { keywords: ['篮球','足球','羽毛球','乒乓球','排球','滑板','游泳','跑步','跳绳','运动会','比赛','体育'], icon: 'sports' },
  { keywords: ['数学','语文','英语','考试','作业','老师','学校','上课','补课','学习','复习','预习','课本'], icon: 'study' },
  { keywords: ['画画','钢琴','吉他','跳舞','唱歌','音乐','手工','乐高','积木','书法','编程','机器人'], icon: 'hobby' },
  { keywords: ['朋友','同学','同桌','闺蜜','兄弟','好朋友','吵架','和好','一起玩','出去玩'], icon: 'friends' },
  { keywords: ['妈妈','爸爸','奶奶','爷爷','哥哥','姐姐','弟弟','妹妹','家人','家','回家'], icon: 'family' },
  { keywords: ['好吃','吃','冰淇淋','巧克力','蛋糕','糖果','零食','饭','面','火锅','烧烤','水果'], icon: 'food' },
  { keywords: ['游戏','打游戏','动画','动漫','漫画','小说','追剧','综艺','手机','视频'], icon: 'play' },
  { keywords: ['开心','难过','委屈','哭','感动','生气','害怕','紧张','无聊','烦躁'], icon: 'emotion' },
  { keywords: ['周末','放假','暑假','寒假','旅游','爬山','公园','动物园','游乐园','逛街','生日'], icon: 'life' },
  { keywords: ['花','树','草地','太阳','下雨','雪','星星','月亮','彩虹','春天','夏天','秋天','冬天'], icon: 'nature' },
];

function detectJournalTopic(messages) {
  const allText = messages.map(m => m.content).join(' ');

  let best = null, bestLen = 0;
  for (const entry of TOPIC_ICON_MAP) {
    for (const kw of entry.keywords) {
      if (allText.includes(kw) && kw.length > bestLen) {
        best = { icon: entry.icon, keyword: kw };
        bestLen = kw.length;
      }
    }
  }
  const result = best || { icon: 'sparkle', keyword: '日常' };

  return result;
}

// 根据对话主题和关键词拼一句简短的正能量描述（兜底用；优先由 AI 生成）
function buildFallbackDescription(topicKeyword, weatherLabel) {
  const templates = [
    `那天的话题是关于「${topicKeyword}」的，你把这些感受都记在了心里。`,
    `你和小新聊了很多关于「${topicKeyword}」的事，那些都是属于你的真实时刻。`,
    `这次聊天里，「${topicKeyword}」成了你们之间一段值得记住的对话。`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// 创建手账本记录（同步用启发式prompt保存，异步AI增强描述+图片prompt）
app.post('/api/journal', authMiddleware, async (req, res) => {
  try {
    const { messages, weather, weatherLabel } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '缺少 messages 或 messages 为空' });
    }

    const topic = detectJournalTopic(messages);
    const id = 'journal-' + Date.now();

    // Phase 1: use heuristic prompt (reliable, fast — always succeeds)
    const initialPrompt = buildImagePromptHeuristic(messages);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(initialPrompt)}?width=512&height=512&nologo=true`;

    const entry = {
      id,
      userId: req.userId,
      date: new Date().toISOString(),
      mood: weatherLabel || '晴天',
      moodIcon: weather || 'sunny',
      topicKeyword: topic.keyword,
      topicIcon: topic.icon,
      description: buildFallbackDescription(topic.keyword, weatherLabel),
      descriptionStatus: 'generated',
      imageUrl,
      imageStatus: 'ready',
    };

    const journal = readJournal();
    journal.push(entry);
    writeJournal(journal);

    res.json({ id: entry.id });

    // Phase 2: async AI enhancement of description + image prompt
    enhanceJournalEntry(id, messages);
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});


// Async enhancement of a journal entry (refactored from POST /api/journal)
async function enhanceJournalEntry(journalId, messages, eventId, _opts) {
  var imgTimeoutMs = (_opts && typeof _opts.imgTimeoutMs === 'number') ? _opts.imgTimeoutMs : 30000;
  var descTimeoutMs = (_opts && typeof _opts.descTimeoutMs === 'number') ? _opts.descTimeoutMs : 20000;

  const fullConvo = messages
    .map(m => (m.role === 'user' ? '学生' : '小新') + '：' + m.content)
    .slice(-12)
    .join('\n');

  // Better image prompt (independent from description call)
  try {
    const { content } = await requestChatCompletion(_providerOptions({
      messages: [
        { role: 'system', content: `You write English image prompts for children's book illustrations. Read the Chinese conversation below. Determine the EXACT activity, location, key objects, AND emotional tone mentioned. Then write ONE sentence (30-50 words) in English describing that scene.

CRITICAL: "香蕉球" = a curved football/soccer kick (NOT a literal banana fruit). "彩虹过人" = a football dribbling move. Always translate Chinese sports terms as the SPORTS ACTION, not literal words.

EMOTIONAL TONE RULES:
- If the student expresses sadness, disappointment, frustration, anger, or anxiety: use soft cool/muted colors (blues, greys, purples), quiet body language (head down, sitting alone, looking away), calm melancholy atmosphere. NO smiles, NO cheerful energy.
- If the student expresses happiness or excitement: use warm bright colors, relaxed happy posture.
- Stay faithful to the student's real emotional state — do NOT turn a sad story into a happy scene.

Examples:
- (sad) "考试没考好，妈妈很失望" → "A child sitting quietly at a desk, head resting on folded arms, a test paper nearby, soft grey-blue evening light through the window, calm and still mood"
- (happy) "今天体育课踢足球赢了" → "A child kicking a football on the school sports field, bright afternoon sunlight, energetic posture"

STYLE RULES (apply to EVERY prompt):
- Add ", children's book illustration style, soft watercolor, cute and whimsical, flat 2D art" at the end of the prompt.
- The prompt must clearly describe a SCENE, NOT a crowd of people.
- Limit to 1-2 main characters with simple faces (minimal facial detail). Any extra people MUST be described as "small silhouettes in the background" or "simplified figures far away" — never as detailed individuals.
- Focus on the environment/background and the main character's posture, not facial expressions.
- The words "teammates cheering" or "crowd celebrating" are BANNED — if needed, say "distant figures under trees" instead.
Output ONLY the English prompt with the style words. No markdown, no Chinese.` },
        { role: 'user', content: fullConvo },
      ],
      maxTokens: 120,
      temperature: 0.5,
      timeoutMs: imgTimeoutMs,
    }));

    const better = (content || '').trim();
    if (better && better.length > 10 && !/香蕉|banana/i.test(better)) {
      const betterUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(better + ' --ar 4:3')}?width=512&height=512&nologo=true`;
      const latest = readJournal();
      const idx = latest.findIndex(e => e.id === journalId);
      if (idx >= 0) { latest[idx].imageUrl = betterUrl; writeJournal(latest); }
    }
  } catch (err) {
    logSanitizedBackgroundError(err);
  }

  // Better description (independent from image call)
  try {
    const { content } = await requestChatCompletion(_providerOptions({
      messages: [
        { role: 'system', content: '你是一个手账记录助手。读完一段学生和AI朋友小新的聊天记录，用1-2句忠实于学生情绪的中文描述这次对话中最有记忆点的场景。如果学生表达的是负面情绪（难过、委屈、沮丧等），请保留这种情绪基调，不要美化。不要用"听起来""似乎"这类套话，不要评价学生，直接描绘那个具体场景。控制在30字以内。' },
        { role: 'user', content: `聊天记录：\n${fullConvo}\n\n写一句手账描述：` },
      ],
      maxTokens: 80,
      temperature: 0.7,
      timeoutMs: descTimeoutMs,
    }));

    const aiDesc = (content || '').trim();
    if (aiDesc && aiDesc.length > 2 && !/香蕉船/.test(aiDesc)) {
      const latest = readJournal();
      const idx = latest.findIndex(e => e.id === journalId);
      if (idx >= 0) { latest[idx].description = aiDesc; latest[idx].descriptionStatus = 'generated'; writeJournal(latest); }
    }
  } catch (err) {
    logSanitizedBackgroundError(err);
  }
}

// Direct-translation event-to-image helper: takes a Chinese event title
// and description, returns an English image prompt that faithfully reflects
// the actual content (not a generic fallback).
async function buildImagePromptForEvent(title, description, _opts) {
  var timeoutMs = (_opts && typeof _opts.timeoutMs === 'number') ? _opts.timeoutMs : 30000;

  const chineseText = title + '：' + description;

  try {
    const { content } = await requestChatCompletion(_providerOptions({
      messages: [
        { role: 'system', content: `You are a Chinese-to-English translator for a children's book illustration generator. Translate the following Chinese event description into ONE English sentence (30-50 words) suitable as an image prompt. Include ALL key nouns (objects, people, place, action) from the Chinese text. Then append this style suffix: ", children's book illustration style, soft watercolor, cute and whimsical, flat 2D art, 1-2 simple characters only, NOT photorealistic, NOT photograph, no realistic faces".

Rules:
- Translate the SPECIFIC activity, objects, and location mentioned.
- "三分球" = three-point basketball shot; "体育课" = PE class
- "操场" = school sports field; "教室里" = in a classroom
- "投篮" = shooting a basketball; "欢呼" = cheering
- "小猫" = kitten; "汤圆" = Tangyuan (cat's name)
- "趴在窗台上" = lying on the windowsill
Output ONLY the English prompt. No Chinese, no markdown.` },
        { role: 'user', content: chineseText },
      ],
      maxTokens: 150,
      temperature: 0.3,
      timeoutMs: timeoutMs,
    }));

    const prompt = (content || '').trim();
    if (prompt && prompt.length > 10) return prompt + ' --ar 4:3';
  } catch (err) {
    logSanitizedBackgroundError(err);
  }

  // Absolute fallback: translate Chinese to English using a direct mapping
  // of nouns/verbs from the event text — no AI call, always works.
  const STYLE_TAIL = "children''s book illustration style, soft watercolor, cute and whimsical, flat 2D art, 1-2 simple characters only";
  const words = [];
  // Walk the Chinese text character by character, extracting known nouns/verbs
  const dict = {
    '体育课': 'PE class', '篮球': 'basketball', '打篮球': 'playing basketball',
    '三分球': 'three-point shot', '投篮': 'shooting a basketball',
    '投了': 'scoring', '投': 'shooting', '连投': 'scoring consecutive',
    '全班': 'whole class', '欢呼': 'cheering', '操场': 'school sports field',
    '教室': 'classroom', '小猫': 'kitten', '汤圆': 'Tangyuan the cat',
    '橘猫': 'orange tabby cat', '窗台': 'windowsill', '趴': 'lying',
    '晒太阳': 'basking in sunlight', '萌': 'adorable',
    '放学': 'after school', '回家': 'going home',
    '足球': 'football', '踢': 'kicking', '朋友': 'friend',
    '公园': 'park', '跑步': 'running', '画画': 'painting',
    '钢琴': 'piano', '跳舞': 'dancing', '唱歌': 'singing',
    '比赛': 'game', '赢了': 'won',
  };
  // Try longer matches first
  let remaining = chineseText;
  for (const [cn, en] of Object.entries(dict).sort((a,b) => b[0].length - a[0].length)) {
    if (remaining.includes(cn)) {
      words.push(en);
      remaining = remaining.replace(cn, ' ');
    }
  }
  if (words.length === 0) words.push('a quiet, gentle moment with soft neutral colors');

  const STYLE = "children's book illustration style, soft watercolor, cute and whimsical, flat 2D art, 1-2 simple characters only";
  // Use double-backslash for JS source, single in runtime
  return 'A child ' + words.join(', ') + ', ' + STYLE + ' --ar 4:3';
}

function buildImagePromptHeuristic(messages, mood) {
  const userText = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');

  // ---- Negative emotion keywords — map to subdued/quiet scenes ----
  const negativeEmotions = [
    { keys: ['难过','伤心','哭','流泪','眼泪','想哭','难受','心里难受','心痛'], en: 'sitting quietly by the window, soft grey-blue light, gentle melancholy mood' },
    { keys: ['委屈','冤枉','被误会','被骂','被批评','挨骂','被说'], en: 'sitting alone with head slightly down, soft cool evening light, quiet and withdrawn posture' },
    { keys: ['失望','失落','沮丧','灰心','没考好','考砸了','成绩差','不及格'], en: 'sitting at a desk with head resting on arms, muted blue-grey tones, soft quiet atmosphere' },
    { keys: ['生气','愤怒','发火','讨厌','烦','烦躁','烦死了'], en: 'standing with arms crossed looking away, muted warm-cool contrast, frustrated but restrained mood' },
    { keys: ['紧张','害怕','恐惧','担心','焦虑','不安','慌'], en: 'sitting in a quiet corner, soft muted colors, gentle diffuse light, slightly tense stillness' },
    { keys: ['孤单','寂寞','一个人','没人','不被理解','被孤立'], en: 'a lone figure in a quiet space, soft grey-blue twilight, calm but lonely atmosphere' },
    { keys: ['吵架','吵','打架','闹矛盾','冲突','不开心'], en: 'two figures facing away from each other in soft cool light, quiet tension' },
  ];

  const activities = [
    { keys: ['三分球','投篮','投进','进球','打篮球','篮球','投篮'], en: 'shooting a basketball on an outdoor court, ball arcing toward the hoop' },
    { keys: ['足球','踢足球','踢球','香蕉球','进球'], en: 'kicking a football on a school field' },
    { keys: ['跑步','长跑','短跑','跑'], en: 'running on a track' },
    { keys: ['游泳'], en: 'swimming in a pool' },
    { keys: ['跳舞','舞蹈'], en: 'dancing in a bright studio' },
    { keys: ['画画','画'], en: 'painting a colorful picture' },
    { keys: ['弹钢琴','钢琴'], en: 'playing the piano' },
    { keys: ['弹吉他','吉他'], en: 'playing the guitar' },
    { keys: ['唱歌'], en: 'singing happily' },
    { keys: ['做蛋糕','烘焙'], en: 'baking a cake in a warm kitchen' },
    { keys: ['写作业','做作业'], en: 'doing homework at a desk' },
    { keys: ['看书','读书'], en: 'reading a book by the window' },
    { keys: ['骑车','自行车'], en: 'riding a bicycle in the park' },
    { keys: ['爬山','郊游','春游'], en: 'hiking on a green hill with friends' },
    { keys: ['打游戏'], en: 'playing video games in a cozy room' },
    { keys: ['小猫','小猫','猫咪','猫','汤圆','萌宠','橘猫'], en: 'playing with a cute fluffy orange kitten by the windowsill' },
    { keys: ['狗','小狗','狗狗','金毛','泰迪'], en: 'playing with a happy puppy in a park' },
    { keys: ['欢呼','庆祝','赢了','全班'], en: 'celebrating a sports victory on a sunny school court, classmates cheering' },
  ];
  const places = [
    { keys: ['操场'], en: ', on the school sports field' },
    { keys: ['教室'], en: ', in a bright classroom' },
    { keys: ['公园'], en: ', in a sunny park' },
    { keys: ['海边'], en: ', at the seaside' },
    { keys: ['图书馆'], en: ', in a quiet library' },
    { keys: ['花园'], en: ', in a colorful garden' },
    { keys: ['山上'], en: ', on a green hill' },
    { keys: ['草地','草地'], en: ', on a green meadow' },
    { keys: ['家','家里','房间'], en: ', in a cozy room at home' },
  ];

  // Determine base scene based on mood parameter (takes priority)
  var isNegativeMood = (mood === 'sad' || mood === 'angry' || mood === 'anxious');
  var baseScene;
  if (isNegativeMood) {
    baseScene = 'A child in a quiet, gentle moment, soft cool muted colors, subdued atmosphere';
  } else if (mood === 'mixed') {
    baseScene = 'A child in a quiet, contemplative moment, soft neutral colors, gentle atmosphere';
  } else {
    // Default: neutral (not "happy")
    baseScene = 'A child in a quiet, gentle moment, soft neutral colors';
  }

  // Check negative emotions first — these override activity-based scenes
  var scene = baseScene;
  for (const ne of negativeEmotions) {
    for (const k of ne.keys) {
      if (userText.includes(k)) { scene = 'A child ' + ne.en; break; }
    }
    if (scene !== baseScene) break;
  }

  // If no negative emotion matched, try activity-based scenes (only for non-negative moods)
  if (scene === baseScene && !isNegativeMood) {
    for (const a of activities) {
      for (const k of a.keys) {
        if (userText.includes(k)) { scene = 'A child ' + a.en; break; }
      }
      if (scene !== baseScene) break;
    }
  }

  var location = '';
  for (const p of places) {
    for (const k of p.keys) {
      if (userText.includes(k)) { location = p.en; break; }
    }
    if (location) break;
  }
  // STYLE_LOCK + CHARACTER_GUIDE: enforce illustration style AND limit character density.
  // The CHARACTER_GUIDE prevents model from cramming many detailed faces into one frame,
  // which causes distorted/fused facial features.
  const CHARACTER_GUIDE = 'one or two main characters only, simple faces with minimal detail, any extra figures shown as small simplified silhouettes in the background';
  const STYLE_LOCK = "children's book illustration style, soft watercolor, cute and whimsical, flat 2D art, NOT photorealistic, NOT photograph, no realistic human faces, no 3D render --ar 4:3";
  return scene + location + ', ' + CHARACTER_GUIDE + ', ' + STYLE_LOCK;
}

// 列出所有手账记录
app.get('/api/journal', authMiddleware, (req, res) => {
  try {
    const journal = readJournal().filter(e => e.userId === req.userId);
    const history = readHistory();
    // Consistency guard: drop any journal entry whose historyId doesn't
    // match an existing history record (orphans from out-of-sync cleanups)
    const validIds = new Set(history.map(h => h.id));
    const filtered = journal.filter(e => e.historyId && validIds.has(e.historyId));
    // If orphan records were found, save the cleaned list back to disk
    if (filtered.length < journal.length) {
      writeJournal(filtered);
      console.log('[journal] cleaned ' + (journal.length - filtered.length) + ' orphan record(s)');
    }
    res.json(filtered.reverse());
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 获取单条手账记录
app.get('/api/journal/:id', authMiddleware, (req, res) => {
  try {
    const journal = readJournal();
    const entry = journal.find(e => e.id === req.params.id && e.userId === req.userId);
    if (!entry) return res.status(404).json({ error: '记录不存在' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 删除一条手账本记录
app.delete('/api/journal/:id', authMiddleware, (req, res) => {
  try {
    const journal = readJournal();
    const idx = journal.findIndex(e => e.id === req.params.id && e.userId === req.userId);
    if (idx < 0) return res.status(404).json({ error: '记录不存在' });
    journal.splice(idx, 1);
    writeJournal(journal);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// 手动刷新某条记录的 AI 描述
app.post('/api/journal/:id/refresh-desc', authMiddleware, async (req, res) => {
  res.json({ status: 'not-needed' });
});

// ============================================================
//  小新语录/小知识 API
// ============================================================
const TIPS_FILE = path.join(DATA_DIR, 'tips.json');
const TIPS_FAV_FILE = path.join(DATA_DIR, 'tip-favorites.json');


function readTips() {
  try { return JSON.parse(fs.readFileSync(TIPS_FILE, 'utf-8')); } catch { return []; }
}

function writeTips(data) {
  fs.writeFileSync(TIPS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readTipFavs() {
  try { return JSON.parse(fs.readFileSync(TIPS_FAV_FILE, 'utf-8')); } catch { return []; }
}

function writeTipFavs(data) {
  fs.writeFileSync(TIPS_FAV_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 返回一条随机语录
app.get('/api/tips/random', (_req, res) => {
  const tips = readTips();
  if (tips.length === 0) return res.json(null);
  const tip = tips[Math.floor(Math.random() * tips.length)];
  res.json(tip);
});

// ============================================================
//  每日小发现 — AI 实时生成（自然科普/情绪小贴士/安全知识）
// ============================================================

// 备用卡片池：API 失败时随机选一套
const DISCOVERIES_FALLBACKS = [
  [
    { category: '自然科普', title: '蚂蚁怎么认路', description: '蚂蚁靠触角和气味来认路，一路走一路留下记号。', emoji: '🐜', tag: 'green' },
    { category: '情绪小贴士', title: '紧张时可以这样做', description: '深呼吸三次，让自己像气球一样慢慢放松下来。', emoji: '🎈', tag: 'red' },
    { category: '安全知识', title: '过马路三步骤', description: '一停二看三通过，红灯绿灯要分清再迈步。', emoji: '🚦', tag: 'purple' },
  ],
  [
    { category: '自然科普', title: '为什么雨后会有彩虹', description: '阳光穿过小水滴时被分成七种颜色，就挂在天上了。', emoji: '🌈', tag: 'green' },
    { category: '情绪小贴士', title: '和朋友吵架了', description: '先喝杯水冷静一下，然后试着说出心里的感受。', emoji: '🤝', tag: 'red' },
    { category: '安全知识', title: '不跟陌生人走', description: '不认识的人说带你去好玩的地方，要大声说"不"。', emoji: '🖐️', tag: 'purple' },
  ],
  [
    { category: '自然科普', title: '含羞草为什么害羞', description: '叶子受到触碰会快速合拢，这是它保护自己的方式。', emoji: '🌱', tag: 'green' },
    { category: '情绪小贴士', title: '被别人误解怎么办', description: '先别急着哭，等心情平复了再慢慢把话说清楚。', emoji: '💬', tag: 'red' },
    { category: '安全知识', title: '插座不是玩具', description: '手指和金属东西都不能插进插座孔，电老虎会咬人。', emoji: '⚡', tag: 'purple' },
  ],
];

// ===== 快捷话题生成（复用 DeepSeek API）=====
// POST /api/quick-topics
// Body: { recentMessages } — 最近几轮对话
app.post('/api/quick-topics', async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) {
      return res.json({ topics: [] });
    }

    var recentMessages = req.body && req.body.recentMessages;
    if (!Array.isArray(recentMessages) || recentMessages.length === 0) {
      return res.json({ topics: [] });
    }

    // 构建上下文文本
    var contextText = recentMessages
      .map(function (m) {
        var speaker = m.role === 'user' ? '学生' : '小新';
        return speaker + '：' + (m.content || '');
      })
      .join('\n');

    var systemPrompt =
      '你是一个陪伴儿童聊天的角色"小新"的话题生成器。\n' +
      '请根据当前对话上下文，生成3-4条适合孩子主动分享的简短话题，\n' +
      '每条控制在10-15字以内，风格活泼自然，能引导孩子继续表达。\n' +
      '只返回JSON格式：{"topics": ["话题1", "话题2", "话题3"]}\n' +
      '不要有任何其他文字、解释或markdown标记。';

    var result;
    try {
      result = await requestChatCompletion({
        endpoint: DEEPSEEK_BASE_URL + '/chat/completions',
        apiKey: DEEPSEEK_API_KEY,
        model: DEEPSEEK_MODEL_REPLY,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '以下是最近的聊天记录——\n' + contextText + '\n\n请根据以上对话，生成3-4条适合孩子继续聊下去的话题：' },
        ],
        temperature: 0.9,
        maxTokens: 200,
        timeoutMs: 8000,
      });
    } catch (_) {
      return res.json({ topics: [] });
    }

    var rawText = (result.content || '').trim();

    // 解析 JSON
    var topics = [];
    try {
      var cleaned = rawText;
      // 去掉可能的 markdown 代码块标记
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      var parsed = JSON.parse(cleaned);
      if (parsed && Array.isArray(parsed.topics)) {
        topics = parsed.topics
          .filter(function (t) { return typeof t === 'string' && t.trim().length >= 3 && t.trim().length <= 30; })
          .map(function (t) { return t.trim(); })
          .slice(0, 4);
      }
    } catch (_) {
      // JSON 解析失败，尝试按行解析
      var lines = rawText
        .split('\n')
        .map(function (l) { return l.replace(/^[\d\.\、\-\s]+/, '').trim(); })
        .filter(function (l) { return l.length >= 3 && l.length <= 30; })
        .slice(0, 4);
      if (lines.length >= 2) {
        topics = lines;
      }
    }

    res.json({ topics: topics });
  } catch (_) {
    // 任何异常都返回空，前端 fallback
    res.json({ topics: [] });
  }
});

app.get('/api/discoveries', async (_req, res) => {
  try {
    const { content } = await requestChatCompletion(_providerOptions({
      messages: [
        { role: 'system', content: `你是一个儿童科普助手。请为小学生生成3条"今日小发现"，分别属于以下三个类别：
1. 自然科普：有趣的动植物、自然现象知识
2. 情绪小贴士：帮助孩子理解和调节情绪的实用方法
3. 安全知识：日常生活中的安全小常识

每条要求：
- title：不超过12个字，有趣吸引人
- description：不超过40个字，温暖易懂，像朋友间的悄悄话
- emoji：一个相关的emoji表情

输出纯JSON数组（不要markdown代码块）：
[{"category":"自然科普","title":"...","description":"...","emoji":"..."},
 {"category":"情绪小贴士","title":"...","description":"...","emoji":"..."},
 {"category":"安全知识","title":"...","description":"...","emoji":"..."}]` },
        { role: 'user', content: '请给我一组全新的、和之前不一样的今日小发现' },
      ],
      temperature: 0.8,
      maxTokens: 600,
      timeoutMs: 15000,
    }));

    const raw = (content || '').trim();
    const cleaned = raw.replace(/^```[a-z]*\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length >= 3) {
      const cards = parsed.slice(0, 3).map((c, i) => ({
        category: c.category || ['自然科普', '情绪小贴士', '安全知识'][i],
        title: c.title || '小知识',
        description: c.description || '来发现有趣的事情吧～',
        emoji: c.emoji || ['🌿', '💭', '🛡️'][i],
        tag: { '自然科普': 'green', '情绪小贴士': 'red', '安全知识': 'purple' }[c.category] || 'green',
      }));
      return res.json({ cards });
    }
    throw new Error('invalid format');
  } catch (err) {
    logSanitizedBackgroundError(err);
    // 随机选一套 fallback
    const fallback = DISCOVERIES_FALLBACKS[Math.floor(Math.random() * DISCOVERIES_FALLBACKS.length)];
    res.json({ cards: fallback });
  }
});

// 返回全部语录（可用于分类浏览页）
app.get('/api/tips', (_req, res) => {
  res.json(readTips());
});

// 获取收藏列表（返回已收藏的 tip id 数组）
app.get('/api/tips/favorites', authMiddleware, (req, res) => {
  const favs = readTipFavs();
  res.json(favs[req.userId] || []);
});

// 收藏/取消收藏 — body: { id: "t1", action: "add" | "remove" }
app.post('/api/tips/favorites', authMiddleware, (req, res) => {
  const { id, action } = req.body;
  if (!id || !action) return res.status(400).json({ error: '缺少 id 或 action' });
  const favs = readTipFavs();
  const userFavs = favs[req.userId] || [];
  if (action === 'add') {
    if (!userFavs.includes(id)) userFavs.push(id);
  } else if (action === 'remove') {
    const idx = userFavs.indexOf(id);
    if (idx >= 0) userFavs.splice(idx, 1);
  }
  favs[req.userId] = userFavs;
  writeTipFavs(favs);
  res.json(userFavs);
});

// 收藏/取消收藏 Discovery — 同时存 tip 数据和收藏记录
app.post('/api/favorites', authMiddleware, (req, res) => {
  const { id, action, title, text, cat, emoji } = req.body;
  if (!id || !action) return res.status(400).json({ error: '缺少 id 或 action' });

  // Save/remove tip data
  const tips = readTips();
  if (action === 'add') {
    const exists = tips.find(t => t.id === id);
    if (!exists) {
      tips.push({ id, title: title || id, text: text || '', cat: cat || 'nature', emoji: emoji || '✨' });
      writeTips(tips);
    }
  }
  // Don't delete from tips on remove (others might still have it favorited)

  // Update favorites
  const favs = readTipFavs();
  const userFavs = favs[req.userId] || [];
  if (action === 'add') {
    if (!userFavs.includes(id)) userFavs.push(id);
  } else if (action === 'remove') {
    const idx = userFavs.indexOf(id);
    if (idx >= 0) userFavs.splice(idx, 1);
  }
  favs[req.userId] = userFavs;
  writeTipFavs(favs);
  res.json(userFavs);
});

// 获取当前用户的收藏列表（返回完整 tip 数据，不只是 ID）
app.get('/api/favorites', authMiddleware, (req, res) => {
  const favs = readTipFavs();
  const userFavs = favs[req.userId] || [];
  const tips = readTips();
  const result = userFavs.map(id => tips.find(t => t.id === id)).filter(Boolean);
  res.json(result);
});

// ============================================================
//  分析调用 API（独立于聊天逻辑）
// ============================================================
app.post('/analyze', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '缺少 messages 或 messages 为空' });
    }

    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });
    }

    // 规范化客户端消息并找到最后一个有效 user 消息
    var cleanMsgs = [];
    for (var mi = 0; mi < messages.length; mi++) {
      var m = messages[mi];
      if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      if (typeof m.content !== 'string') continue;
      cleanMsgs.push({ role: m.role, content: m.content });
    }

    // 找最后一个有效 user 消息作为 currentUserMessage
    var lastUserIdx = -1;
    for (var ui = cleanMsgs.length - 1; ui >= 0; ui--) {
      if (cleanMsgs[ui].role === 'user') { lastUserIdx = ui; break; }
    }
    if (lastUserIdx < 0) {
      return res.status(400).json({ error: '缺少有效用户消息' });
    }

    var currentUserMessage = cleanMsgs[lastUserIdx].content;
    var history = cleanMsgs.slice(0, lastUserIdx);

    // 上下文预算裁剪
    var AnalyzeBudgeted = buildBudgetedMessages({
      systemMessages: [{ role: 'system', content: ANALYZE_SYSTEM_PROMPT.replace('{{对话记录}}', '') }],
      history: history,
      currentUserMessage: currentUserMessage,
      maxTotalChars: BUDGET_PRESETS.HTTP_ANALYZE.maxTotalChars,
      maxTurns: BUDGET_PRESETS.HTTP_ANALYZE.maxTurns,
    });

    // 使用裁剪后的历史构建对话文本
    var allMsgs = AnalyzeBudgeted.historyMessages.concat([
      { role: 'user', content: currentUserMessage },
    ]);

    // 客户端断开取消
    var disconnectController = new AbortController();
    res.on('close', function () {
      if (!res.writableEnded) disconnectController.abort();
    });

    // 构建对话文本（带轮次编号）
    let convoText = '';
    let round = 0;
    for (const cm of allMsgs) {
      if (cm.role === 'user') round++;
      const speaker = cm.role === 'user' ? '学生' : '小新';
      convoText += `第${round}轮 ${speaker}：${cm.content}\n`;
    }

    const fullPrompt = ANALYZE_SYSTEM_PROMPT.replace('{{对话记录}}', convoText);

    var analyzeResult;
    try {
      analyzeResult = await requestChatCompletion({
        endpoint: `${DEEPSEEK_BASE_URL}/chat/completions`,
        apiKey: DEEPSEEK_API_KEY,
        model: DEEPSEEK_MODEL_ANALYZE,
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: convoText },
        ],
        temperature: 0.1,
        maxTokens: 8192,
        timeoutMs: 20000,
        externalSignal: disconnectController.signal,
      });
    } catch (err) {
      if (err instanceof ProviderError) {
        return res.status(err.httpStatus).json({ error: err.code });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    const raw = analyzeResult.content.trim();

    // Try to parse as JSON; if model wraps in markdown, strip it
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      // Strip possible markdown fences
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (_2) {
        return res.status(502).json({
          error: 'AI_BAD_RESPONSE',
        });
      }
    }

    res.json(parsed);
  } catch (err) {
    if (err instanceof ProviderError) {
      return res.status(err.httpStatus).json({ error: err.code });
    }
    res.status(500).json({
      error: 'INTERNAL_ERROR',
    });
  }
});

// 仅在直接运行时监听端口（被 require 时不占用端口，供测试使用）
if (require.main === module) {
  initializeRuntime().then(function () {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }).catch(function (err) {
    console.error('[FATAL] Server startup failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  app,
  DATA_DIR,
  initializeRuntime,
  // 测试专用（不暴露给前端，不通过任何 HTTP 路由访问）
  _v2ConversationStateStore: conversationStateStore,
  _resetRateLimiterForTests: function () {
    if (_rateLimiter) _rateLimiter.resetForTests();
    if (_inviteLimiter) _inviteLimiter.resetForTests();
  },
  _getAuditStoreForTests: getAuditStore,
  _getRateLimiterForTests: getRateLimiter,
  // Phase 8A2b: 后台 AI 函数导出供测试
  _runAnalyze: runAnalyze,
  _extractConversationEvents: extractConversationEvents,
  _translateEventToImagePrompt: translateEventToImagePrompt,
  _enhanceJournalEntry: enhanceJournalEntry,
  _buildImagePromptForEvent: buildImagePromptForEvent,
  _buildImagePromptHeuristic: buildImagePromptHeuristic,
  _buildFallbackDescription: buildFallbackDescription,
  _readJournal: readJournal,
  _writeJournal: writeJournal,
  _readHistory: readHistory,
  _writeHistory: writeHistory,
  _logSanitizedBackgroundError: logSanitizedBackgroundError,
};
