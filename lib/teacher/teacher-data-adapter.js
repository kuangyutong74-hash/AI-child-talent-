/**
 * teacher-data-adapter.js — 教师端安全数据适配器
 *
 * 纯函数模块。不读写文件、不访问网络、不调用模型、不依赖 Express。
 * 不修改任何输入参数。
 *
 * 将原始 users/bindings/history 数据转换为教师端安全展示格式。
 *
 * 导出：
 *   teacherCanAccessStudent(input)
 *   buildTeacherRoster(input)
 *   buildStudentOverview(input)
 *   buildStudentConversationSummaries(input)
 *   buildStudentConversationDetail(input)
 *   buildStudentInsights(input)
 */

'use strict';

// ============================================================
//  辅助函数
// ============================================================

var hop = Object.prototype.hasOwnProperty;

function safeHasOwn(obj, key) {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return false;
  return hop.call(obj, key);
}

function isNonArrayObject(val) {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function isArray(val) {
  return Array.isArray(val);
}

function isString(val) {
  return typeof val === 'string';
}

function safeString(val) {
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return '';
}

/**
 * 安全截断字符串，不切断 surrogate pair（避免 emoji/特殊字符的 � 乱码）。
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function safeTruncate(str, maxLen) {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  // 从 maxLen 位置往回找，确保不掉在 surrogate pair 中间
  var end = maxLen;
  if (end > 0 && str.charCodeAt(end - 1) >= 0xD800 && str.charCodeAt(end - 1) <= 0xDBFF) {
    // 高代理项在末尾，需要多取一个低代理项
    end = maxLen + 1;
  }
  // 截断后再做一次保护：确保最后字符是完整的
  var out = str.slice(0, end);
  // 如果末尾是高代理项且没有配对，去掉它
  var lastChar = out.charCodeAt(out.length - 1);
  if (lastChar >= 0xD800 && lastChar <= 0xDBFF) {
    out = out.slice(0, -1);
  }
  return out;
}

function safeStringOrNull(val) {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return null;
}

function safeBoolean(val) {
  return val === true;
}

function safeInteger(val, fallback, min) {
  if (typeof val === 'number' && Number.isFinite(val) && Number.isInteger(val) && val >= min) {
    return val;
  }
  if (typeof val === 'string') {
    var parsed = Number(val);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= min) {
      return parsed;
    }
  }
  return fallback;
}

function isValidISODate(str) {
  if (typeof str !== 'string') return false;
  if (str.trim().length === 0) return false;
  var ts = Date.parse(str);
  return !isNaN(ts);
}

function parseDateOrNull(str) {
  if (!isValidISODate(str)) return null;
  return str;
}

function compareDateDesc(a, b) {
  var da = Date.parse(a);
  var db = Date.parse(b);
  if (!isNaN(da) && !isNaN(db)) return db - da;
  if (!isNaN(da)) return -1;
  if (!isNaN(db)) return 1;
  return 0;
}

function nowOrDateNow(input) {
  if (input && isNonArrayObject(input)) {
    var n = safeInteger(input.now, -1, 0);
    if (n >= 0) return n;
  }
  return Date.now();
}

// ============================================================
//  权限验证
// ============================================================

/**
 * 验证教师是否有权限访问指定学生。
 * 使用 Object.prototype.hasOwnProperty.call 安全处理特殊 key。
 *
 * @param {object} input
 * @param {string} input.teacherId
 * @param {string} input.studentId
 * @param {object} input.bindings
 * @returns {boolean}
 */
function teacherCanAccessStudent(input) {
  if (!isNonArrayObject(input)) return false;

  var teacherId = input.teacherId;
  var studentId = input.studentId;
  var bindings = input.bindings;

  if (typeof teacherId !== 'string' || teacherId.trim().length === 0) return false;
  if (typeof studentId !== 'string' || studentId.trim().length === 0) return false;
  if (!isNonArrayObject(bindings)) return false;

  if (!hop.call(bindings, teacherId)) return false;

  var list = bindings[teacherId];
  if (!isArray(list)) return false;

  // 严格比较，不依赖 indexOf 继承链
  for (var i = 0; i < list.length; i++) {
    if (list[i] === studentId) return true;
  }
  return false;
}

// ============================================================
//  学生安全信息
// ============================================================

/**
 * 创建安全的教师端学生对象。
 * 只允许：id, username, studentCode。
 * 禁止：passwordHash, role, createdAt, 及其他字段。
 *
 * @param {object} user
 * @returns {object|null} 安全学生对象，或 null（如果非 student）
 */
function buildSafeStudent(user) {
  if (!isNonArrayObject(user)) return null;
  if (user.role !== 'student') return null;

  var id = typeof user.id === 'string' ? user.id : '';
  var username = typeof user.username === 'string' ? user.username : '';
  var studentCode = safeStringOrNull(user.studentCode);

  return {
    id: id,
    username: username,
    studentCode: studentCode,
  };
}

// ============================================================
//  历史归属
// ============================================================

function historyBelongsToStudent(entry, studentId) {
  if (!isNonArrayObject(entry)) return false;
  if (typeof studentId !== 'string') return false;
  return entry.userId === studentId;
}

// ============================================================
//  日期辅助
// ============================================================

function getValidStartTime(entry) {
  if (!isNonArrayObject(entry)) return null;
  return parseDateOrNull(entry.startTime);
}

function getLatestStartTime(entries) {
  var latest = null;
  if (!isArray(entries)) return null;
  for (var i = 0; i < entries.length; i++) {
    var st = getValidStartTime(entries[i]);
    if (st === null) continue;
    if (latest === null) { latest = st; continue; }
    if (Date.parse(st) > Date.parse(latest)) latest = st;
  }
  return latest;
}

// ============================================================
//  维度与话题
// ============================================================

/**
 * 从合法分析命中指标中提取 topDimensions（前3个）。
 * 按出现次数降序，同次数按首次出现顺序。
 */
function extractTopDimensions(entries) {
  var dimCounts = [];
  var dimFirstSeen = Object.create(null);

  for (var i = 0; i < entries.length; i++) {
    var hits = getValidHits(entries[i]);
    for (var j = 0; j < hits.length; j++) {
      var dim = hits[j].dimension;
      if (dim.length === 0) continue;
      if (!safeHasOwn(dimFirstSeen, dim)) {
        dimFirstSeen[dim] = dimCounts.length;
        dimCounts.push({ dimension: dim, count: 0 });
      }
      dimCounts[dimFirstSeen[dim]].count++;
    }
  }

  // 排序：次数降序，首次出现顺序
  dimCounts.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return dimFirstSeen[a.dimension] - dimFirstSeen[b.dimension];
  });

  var result = [];
  for (var k = 0; k < dimCounts.length && result.length < 3; k++) {
    result.push(dimCounts[k].dimension);
  }
  return result;
}

/**
 * 从 conversationState.active_topic 提取 topTopics（前3个）。
 * 只使用 active_topic，不使用维度、指标、known_facts.key 等。
 */
function extractTopTopics(entries) {
  var topicCounts = [];
  var topicFirstSeen = Object.create(null);

  for (var i = 0; i < entries.length; i++) {
    var cs = getValidConversationState(entries[i]);
    if (cs === null) continue;
    var topic = cs.activeTopic;
    if (topic === null || topic.length === 0) continue;

    if (!safeHasOwn(topicFirstSeen, topic)) {
      topicFirstSeen[topic] = topicCounts.length;
      topicCounts.push({ topic: topic, count: 0 });
    }
    topicCounts[topicFirstSeen[topic]].count++;
  }

  topicCounts.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return topicFirstSeen[a.topic] - topicFirstSeen[b.topic];
  });

  var result = [];
  for (var k = 0; k < topicCounts.length && result.length < 3; k++) {
    result.push(topicCounts[k].topic);
  }
  return result;
}

// ============================================================
//  分析结果安全解析
// ============================================================

function getValidAnalysis(entry) {
  if (!isNonArrayObject(entry)) return null;
  var analysis = entry.analysis;
  if (!isNonArrayObject(analysis)) return null;
  if (analysis.status !== 'done') return null;
  var result = analysis.result;
  if (!isNonArrayObject(result)) return null;
  if (isArray(result)) return null;
  return result;
}

/**
 * 返回分析状态字符串，用于教师端区分"已分析 / 分析失败 / 未分析"。
 *
 * @param {object|null} entry — history entry
 * @returns {string|null} 'done' | 'failed' | null
 */
function getAnalysisStatus(entry) {
  if (!isNonArrayObject(entry)) return null;
  var analysis = entry.analysis;
  if (!isNonArrayObject(analysis)) return null;
  if (analysis.status === 'done') {
    var result = analysis.result;
    if (!isNonArrayObject(result) || isArray(result)) return null;
    return 'done';
  }
  if (analysis.status === 'failed') return 'failed';
  return null;
}

function getValidHits(entry) {
  var result = getValidAnalysis(entry);
  if (result === null) return [];

  var hitsRaw = result['命中指标'];
  if (!isArray(hitsRaw)) return [];

  var hits = [];
  for (var i = 0; i < hitsRaw.length; i++) {
    var h = hitsRaw[i];
    if (!isNonArrayObject(h)) continue;

    var dimension = safeString(h['维度']);
    var indicator = safeString(h['指标']);
    var evidenceSnippet = safeString(h['证据片段']);
    var turnLabel = safeString(h['说话轮次']);
    var signal = safeString(h['信号说明']);
    var strengthNote = safeString(h['强度备注']);
    var strength = safeString(h['strength']);
    var pattern = safeString(h['观察模式']);
    var wasPrompted = h['was_prompted'] === true;
    var promptIntensity = safeString(h['prompt_intensity']);

    // 至少要有 dimension 和 indicator 才视为合法
    if (dimension.length === 0 && indicator.length === 0) continue;

    hits.push({
      dimension: dimension,
      indicator: indicator,
      evidenceSnippet: evidenceSnippet,
      turnLabel: turnLabel,
      signal: signal,
      strengthNote: strengthNote,
      strength: strength,
      pattern: pattern,
      wasPrompted: wasPrompted,
      promptIntensity: promptIntensity,
    });
  }
  return hits;
}

function getValidHitsForEntry(entry) {
  return getValidHits(entry);
}

function getSafetyAlert(entry) {
  var result = getValidAnalysis(entry);
  if (result === null) return false;
  return result['安全提示'] === true;
}

function getSafetyNote(entry) {
  var result = getValidAnalysis(entry);
  if (result === null) return '';
  var note = result['安全提示说明'];
  return typeof note === 'string' ? note : '';
}

// ============================================================
//  conversationState 安全过滤
// ============================================================

/**
 * 只输出白名单字段：
 *   activeTopic, engagement, observationFocus, stage, turnIndex, knownFacts
 * 禁止输出内部控制字段。
 */
function getValidConversationState(entry) {
  if (!isNonArrayObject(entry)) return null;
  var cs = entry.conversationState;
  if (!isNonArrayObject(cs)) return null;

  var activeTopic = null;
  if (typeof cs.active_topic === 'string' && cs.active_topic.trim().length > 0) {
    activeTopic = cs.active_topic.trim();
  }

  var engagement = typeof cs.engagement === 'string' ? cs.engagement.trim() : 'medium';
  // Keep the raw value — invalid values will be counted as 'unknown' by the overview.
  // Do NOT normalize invalid values to 'medium' here.

  var validObservationFocuses = [
    'narrative_organization', 'vocabulary_choice', 'active_topic_tendency',
    'interest_depth_breadth', 'self_reflection', 'value_judgment',
    'adaptive_elaboration', 'none',
  ];
  var observationFocus = 'none';
  if (
    typeof cs.observation_focus === 'string' &&
    validObservationFocuses.indexOf(cs.observation_focus) >= 0
  ) {
    observationFocus = cs.observation_focus;
  }

  var validStages = ['opening', 'interest', 'deepening', 'open_task', 'closing'];
  var stage = 'closing';
  if (typeof cs.stage === 'string' && validStages.indexOf(cs.stage) >= 0) {
    stage = cs.stage;
  }

  var turnIndex = safeInteger(cs.turn_index, 0, 0);

  // knownFacts — 只保留 key/value，过滤 confidence/source_quote
  var knownFacts = [];
  var rawFacts = cs.known_facts;
  if (isArray(rawFacts)) {
    for (var i = 0; i < rawFacts.length; i++) {
      var f = rawFacts[i];
      if (!isNonArrayObject(f)) continue;
      if (f.confidence !== 'explicit') continue;
      var key = safeString(f.key);
      var value = safeString(f.value);
      if (key.length === 0 || value.length === 0) continue;
      knownFacts.push({ key: key, value: value });
    }
  }

  return {
    activeTopic: activeTopic,
    engagement: engagement,
    observationFocus: observationFocus,
    stage: stage,
    turnIndex: turnIndex,
    knownFacts: knownFacts,
  };
}

// ============================================================
//  消息安全过滤
// ============================================================

/**
 * 只保留 role + content。
 * 移除 _ts, topicSource, latencyMs 等。
 * role 只接受 user 或 assistant。
 * content 必须是字符串。
 */
function sanitizeMessages(messages) {
  if (!isArray(messages)) return [];

  var result = [];
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    if (!isNonArrayObject(m)) continue;

    var role = m.role;
    if (role !== 'user' && role !== 'assistant') continue;

    var content = m.content;
    if (typeof content !== 'string') continue;

    result.push({
      role: role,
      content: content,
    });
  }
  return result;
}

// ============================================================
//  辅助：获取学生完成的历史
// ============================================================

function getStudentCompletedHistory(history, studentId) {
  if (!isArray(history)) return [];
  var result = [];
  for (var i = 0; i < history.length; i++) {
    var entry = history[i];
    if (!historyBelongsToStudent(entry, studentId)) continue;
    if (entry.completed === false) continue;
    result.push(entry);
  }
  return result;
}

function getStudentAllHistory(history, studentId) {
  if (!isArray(history)) return [];
  var result = [];
  for (var i = 0; i < history.length; i++) {
    var entry = history[i];
    if (!historyBelongsToStudent(entry, studentId)) continue;
    result.push(entry);
  }
  return result;
}

// ============================================================
//  导出 1: teacherCanAccessStudent
// ============================================================

// ============================================================
//  导出 2: buildTeacherRoster
// ============================================================

/**
 * 构建教师绑定学生的安全名单。
 *
 * @param {object} input
 * @param {string} input.teacherId
 * @param {Array} input.users
 * @param {object} input.bindings
 * @param {Array} input.history
 * @param {number} [input.now] - 可选当前时间戳
 * @returns {Array} 安全的学生名单
 */
function buildTeacherRoster(input) {
  if (!isNonArrayObject(input)) return [];

  var teacherId = input.teacherId;
  var users = isArray(input.users) ? input.users : [];
  var bindings = input.bindings;
  var history = isArray(input.history) ? input.history : [];
  var now = nowOrDateNow(input);

  // 验证教师
  if (typeof teacherId !== 'string' || teacherId.trim().length === 0) return [];
  if (!isNonArrayObject(bindings)) return [];

  // 获取绑定的学生 ID 列表
  if (!hop.call(bindings, teacherId)) return [];
  var boundIds = bindings[teacherId];
  if (!isArray(boundIds)) return [];

  // 构建 studentId → student 映射
  var studentMap = Object.create(null);
  var seenIds = Object.create(null);
  for (var i = 0; i < users.length; i++) {
    var user = users[i];
    if (!isNonArrayObject(user)) continue;
    if (user.role !== 'student') continue;
    if (typeof user.id !== 'string') continue;
    studentMap[user.id] = user;
  }

  // 按绑定顺序输出
  var roster = [];
  for (var j = 0; j < boundIds.length; j++) {
    var sid = boundIds[j];
    if (typeof sid !== 'string') continue;
    if (safeHasOwn(seenIds, sid)) continue;
    seenIds[sid] = true;

    var studentUser = studentMap[sid];
    if (!studentUser) continue;

    var allHistory = getStudentAllHistory(history, sid);
    var completedHistory = [];
    for (var k = 0; k < allHistory.length; k++) {
      if (allHistory[k].completed !== false) {
        completedHistory.push(allHistory[k]);
      }
    }

    var totalConversations = completedHistory.length;
    var lastActiveDate = getLatestStartTime(allHistory);

    var topTopics = extractTopTopics(allHistory);
    var topDimensions = extractTopDimensions(allHistory);

    var insightCount = 0;
    for (var ci = 0; ci < allHistory.length; ci++) {
      insightCount += getValidHitsForEntry(allHistory[ci]).length;
    }

    // recentInsightCount7d
    var recentInsightCount7d = 0;
    var safetyAlertCount = 0;
    var lastSafetyAlertNote = '';
    var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    var cutoff = now - sevenDaysMs;
    for (var ri = 0; ri < allHistory.length; ri++) {
      var st = getValidStartTime(allHistory[ri]);
      // Count safety alerts across all history (completed analysis)
      if (getSafetyAlert(allHistory[ri])) {
        safetyAlertCount++;
        var note = getSafetyNote(allHistory[ri]);
        if (note && note.trim().length > 0) {
          lastSafetyAlertNote = note.trim(); // keep the latest
        }
      }
      // Count realtime safety alerts (in-progress conversations, V2 realtime)
      var rta = allHistory[ri].realtimeSafetyAlerts;
      if (Array.isArray(rta) && rta.length > 0) {
        safetyAlertCount += rta.length;
        var lastRt = rta[rta.length - 1];
        if (lastRt && typeof lastRt.reason === 'string' && lastRt.reason.trim().length > 0) {
          lastSafetyAlertNote = lastRt.reason.trim();
        }
      }
      if (st === null) continue;
      if (Date.parse(st) >= cutoff) {
        recentInsightCount7d += getValidHitsForEntry(allHistory[ri]).length;
      }
    }

    roster.push({
      studentId: sid,
      username: typeof studentUser.username === 'string' ? studentUser.username : '',
      studentCode: safeStringOrNull(studentUser.studentCode),
      totalConversations: totalConversations,
      lastActiveDate: lastActiveDate,
      topTopics: topTopics,
      topDimensions: topDimensions,
      insightCount: insightCount,
      recentInsightCount7d: recentInsightCount7d,
      safetyAlertCount: safetyAlertCount,
      lastSafetyAlertNote: lastSafetyAlertNote,
    });
  }

  return roster;
}

// ============================================================
//  导出 3: buildStudentOverview
// ============================================================

/**
 * 构建单个学生的概述信息。
 *
 * @param {object} input
 * @returns {object} { allowed, reason, student, overview }
 */
function buildStudentOverview(input) {
  if (!isNonArrayObject(input)) {
    return { allowed: false, reason: 'INVALID_INPUT', student: null, overview: null };
  }

  var teacherId = input.teacherId;
  var studentId = input.studentId;
  var users = isArray(input.users) ? input.users : [];
  var bindings = input.bindings;
  var history = isArray(input.history) ? input.history : [];

  // 权限验证
  if (!teacherCanAccessStudent({ teacherId: teacherId, studentId: studentId, bindings: bindings })) {
    return { allowed: false, reason: 'NOT_BOUND', student: null, overview: null };
  }

  // 查找学生
  var studentUser = null;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (!isNonArrayObject(u)) continue;
    if (u.id === studentId) { studentUser = u; break; }
  }

  var safeStudent = buildSafeStudent(studentUser);
  if (safeStudent === null) {
    return { allowed: false, reason: 'STUDENT_NOT_FOUND', student: null, overview: null };
  }

  if (safeStudent.id === '') {
    return { allowed: false, reason: 'STUDENT_NOT_FOUND', student: null, overview: null };
  }

  // 计算概述数据
  var allHistory = getStudentAllHistory(history, studentId);
  var completedHistory = [];
  for (var ci = 0; ci < allHistory.length; ci++) {
    if (allHistory[ci].completed !== false) {
      completedHistory.push(allHistory[ci]);
    }
  }

  var totalConversations = completedHistory.length;

  var totalTurns = 0;
  for (var ti = 0; ti < allHistory.length; ti++) {
    var tc = safeInteger(allHistory[ti].turnCount, 0, 0);
    totalTurns += tc;
  }

  var firstSeen = null;
  for (var fi = 0; fi < allHistory.length; fi++) {
    var st = getValidStartTime(allHistory[fi]);
    if (st !== null) {
      if (firstSeen === null || Date.parse(st) < Date.parse(firstSeen)) {
        firstSeen = st;
      }
    }
  }

  var lastActive = getLatestStartTime(allHistory);

  var topTopics = extractTopTopics(allHistory);
  var topDimensions = extractTopDimensions(allHistory);

  var insightCount = 0;
  for (var ii = 0; ii < allHistory.length; ii++) {
    insightCount += getValidHitsForEntry(allHistory[ii]).length;
  }

  // engagementDistribution
  var engagementDistribution = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (var ei = 0; ei < allHistory.length; ei++) {
    var cs = getValidConversationState(allHistory[ei]);
    // cs 为 null 表示该对话没有 conversationState（如 V1 对话或旧数据）。
    // 此时默认视为 'medium'，与 runtime-state / conversation-state 的默认值一致。
    // 'unknown' 保留给 engagement 字段存在但值非法的情况。
    if (cs === null) {
      engagementDistribution.medium++;
      continue;
    }
    var eng = cs.engagement;
    if (eng === 'high' || eng === 'medium' || eng === 'low') {
      engagementDistribution[eng]++;
    } else {
      engagementDistribution.unknown++;
    }
  }

  return {
    allowed: true,
    reason: null,
    student: safeStudent,
    overview: {
      totalConversations: totalConversations,
      totalTurns: totalTurns,
      firstSeen: firstSeen,
      lastActive: lastActive,
      topTopics: topTopics,
      topDimensions: topDimensions,
      insightCount: insightCount,
      engagementDistribution: engagementDistribution,
    },
  };
}

// ============================================================
//  导出 4: buildStudentConversationSummaries
// ============================================================

/**
 * 构建学生对话摘要列表。
 *
 * @param {object} input
 * @returns {object} { allowed, reason, conversations }
 */
function buildStudentConversationSummaries(input) {
  if (!isNonArrayObject(input)) {
    return { allowed: false, reason: 'INVALID_INPUT', conversations: [] };
  }

  var teacherId = input.teacherId;
  var studentId = input.studentId;
  var bindings = input.bindings;
  var history = isArray(input.history) ? input.history : [];

  if (!teacherCanAccessStudent({ teacherId: teacherId, studentId: studentId, bindings: bindings })) {
    return { allowed: false, reason: 'NOT_BOUND', conversations: [] };
  }

  // 只取该学生的所有历史（不限于 completed）
  var studentHistory = getStudentAllHistory(history, studentId);

  if (studentHistory.length === 0) {
    return { allowed: true, reason: null, conversations: [] };
  }

  // 按 startTime 从新到旧排序
  var sorted = studentHistory.slice();
  sorted.sort(function (a, b) {
    var sa = getValidStartTime(a);
    var sb = getValidStartTime(b);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    var da = Date.parse(sa);
    var db = Date.parse(sb);
    if (da === db) return 0;
    return db - da;
  });

  var conversations = [];
  for (var i = 0; i < sorted.length; i++) {
    var entry = sorted[i];

    // preview — 首条合法 user 消息
    var preview = '';
    var msgs = entry.messages;
    if (isArray(msgs)) {
      for (var mi = 0; mi < msgs.length; mi++) {
        var m = msgs[mi];
        if (!isNonArrayObject(m)) continue;
        if (m.role === 'user' && typeof m.content === 'string') {
          preview = safeTruncate(m.content, 40);
          break;
        }
      }
    }

    var completed = entry.completed !== false;
    var cs = getValidConversationState(entry);

    var activeTopic = null;
    var engagement = null;
    if (cs !== null) {
      activeTopic = cs.activeTopic;
      engagement = cs.engagement;
    }

    // 兜底：conversationState 不可用时，engagement 默认 'medium'
    // 与 runtime-state.sanitizeEnum(, 'medium') 和
    // conversation-state.createInitialConversationState().engagement 保持一致。
    if (engagement === null) {
      engagement = 'medium';
    }

    // Fallback: conversationState 不可用时，从 analysis 的活跃话题补全 topic
    if (activeTopic === null) {
      var analysisResult = getValidAnalysis(entry);
      if (analysisResult) {
        var analysisTopics = analysisResult['活跃话题'];
        if (Array.isArray(analysisTopics) && analysisTopics.length > 0 &&
            analysisTopics[0] && typeof analysisTopics[0].topic === 'string' &&
            analysisTopics[0].topic.trim().length > 0) {
          activeTopic = analysisTopics[0].topic.trim();
        }
      }
    }

    var hits = getValidHitsForEntry(entry);
    var dimensionsFound = [];
    for (var di = 0; di < hits.length; di++) {
      var dim = hits[di].dimension;
      if (dim.length > 0 && dimensionsFound.indexOf(dim) < 0) {
        dimensionsFound.push(dim);
      }
    }

    var analysisStatus = getAnalysisStatus(entry);
    var hasAnalysis = analysisStatus === 'done';

    // Safety alert: from completed analysis OR in-progress V2 realtime alerts
    var hasSafetyAlert = getSafetyAlert(entry);
    var safetyNote = hasSafetyAlert ? getSafetyNote(entry) : '';
    if (!hasSafetyAlert) {
      var rta2 = entry.realtimeSafetyAlerts;
      hasSafetyAlert = Array.isArray(rta2) && rta2.length > 0;
      if (hasSafetyAlert && rta2.length > 0) {
        var last = rta2[rta2.length - 1];
        safetyNote = (last && typeof last.reason === 'string') ? last.reason : '';
      }
    }

    conversations.push({
      id: typeof entry.id === 'string' ? entry.id : '',
      sessionId: typeof entry.sessionId === 'string' ? entry.sessionId : '',
      startTime: getValidStartTime(entry),
      turnCount: safeInteger(entry.turnCount, 0, 0),
      completed: completed,
      preview: preview,
      weather: typeof entry.weather === 'string' ? entry.weather : null,
      activeTopic: activeTopic,
      engagement: engagement,
      dimensionsFound: dimensionsFound,
      insightCount: hits.length,
      hasAnalysis: hasAnalysis,
      analysisStatus: analysisStatus,
      hasSafetyAlert: hasSafetyAlert,
      safetyNote: safetyNote,
    });
  }

  return { allowed: true, reason: null, conversations: conversations };
}

// ============================================================
//  导出 5: buildStudentConversationDetail
// ============================================================

/**
 * 构建单次对话的详细信息。
 *
 * @param {object} input
 * @returns {object} { allowed, reason, conversation }
 */
function buildStudentConversationDetail(input) {
  if (!isNonArrayObject(input)) {
    return { allowed: false, reason: 'INVALID_INPUT', conversation: null };
  }

  var teacherId = input.teacherId;
  var studentId = input.studentId;
  var conversationId = input.conversationId;
  var bindings = input.bindings;
  var history = isArray(input.history) ? input.history : [];

  if (!teacherCanAccessStudent({ teacherId: teacherId, studentId: studentId, bindings: bindings })) {
    return { allowed: false, reason: 'NOT_BOUND', conversation: null };
  }

  if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
    return { allowed: false, reason: 'CONVERSATION_NOT_FOUND', conversation: null };
  }

  // 查找对话
  var target = null;
  for (var i = 0; i < history.length; i++) {
    var entry = history[i];
    if (!isNonArrayObject(entry)) continue;
    if (entry.id !== conversationId) continue;
    if (entry.userId !== studentId) continue;
    target = entry;
    break;
  }

  if (target === null) {
    return { allowed: false, reason: 'CONVERSATION_NOT_FOUND', conversation: null };
  }

  // 安全过滤 messages
  var safeMsgs = sanitizeMessages(target.messages);

  // 安全分析数据
  var analysisData = null;
  var analysisStatus = getAnalysisStatus(target);
  var validAnalysis = getValidAnalysis(target);
  if (validAnalysis !== null) {
    var hits = getValidHitsForEntry(target);
    var safeHits = [];
    for (var hi = 0; hi < hits.length; hi++) {
      safeHits.push({
        dimension: hits[hi].dimension,
        indicator: hits[hi].indicator,
        evidenceSnippet: hits[hi].evidenceSnippet,
        turnLabel: hits[hi].turnLabel,
        signal: hits[hi].signal,
        strengthNote: hits[hi].strengthNote,
        strength: hits[hi].strength,
        wasPrompted: hits[hi].wasPrompted,
        promptIntensity: hits[hi].promptIntensity,
      });
    }

    analysisData = {
      scope: safeString(validAnalysis['分析范围']),
      hits: safeHits,
      safetyAlert: getSafetyAlert(target),
      safetyNote: getSafetyNote(target),
    };
  }

  // 安全 conversationState
  var safeCs = getValidConversationState(target);

  var completed = target.completed !== false;

  // Merge analysis safetyAlerts + realtimeSafetyAlerts
  var detailSafetyAlerts = [];
  if (validAnalysis && getSafetyAlert(target)) {
    detailSafetyAlerts.push({
      source: 'analysis',
      reason: getSafetyNote(target),
      turn: null,
      timestamp: null,
    });
  }
  var rta3 = target.realtimeSafetyAlerts;
  if (Array.isArray(rta3) && rta3.length > 0) {
    for (var ai = 0; ai < rta3.length; ai++) {
      detailSafetyAlerts.push({
        source: 'realtime',
        reason: rta3[ai].reason || '',
        turn: rta3[ai].turn || null,
        timestamp: rta3[ai].timestamp || null,
      });
    }
  }

  return {
    allowed: true,
    reason: null,
    conversation: {
      id: typeof target.id === 'string' ? target.id : '',
      sessionId: typeof target.sessionId === 'string' ? target.sessionId : '',
      startTime: getValidStartTime(target),
      turnCount: safeInteger(target.turnCount, 0, 0),
      completed: completed,
      weather: typeof target.weather === 'string' ? target.weather : null,
      messages: safeMsgs,
      analysis: analysisData,
      analysisStatus: analysisStatus,
      conversationState: safeCs,
      safetyAlerts: detailSafetyAlerts,
    },
  };
}

// ============================================================
//  导出 6: buildStudentInsights
// ============================================================

/**
 * 构建学生的潜能线索列表（TalentInsight 数组）。
 *
 * @param {object} input
 * @returns {object} { allowed, reason, insights }
 */
function buildStudentInsights(input) {
  if (!isNonArrayObject(input)) {
    return { allowed: false, reason: 'INVALID_INPUT', insights: [] };
  }

  var teacherId = input.teacherId;
  var studentId = input.studentId;
  var bindings = input.bindings;
  var history = isArray(input.history) ? input.history : [];

  if (!teacherCanAccessStudent({ teacherId: teacherId, studentId: studentId, bindings: bindings })) {
    return { allowed: false, reason: 'NOT_BOUND', insights: [] };
  }

  // 只取有合法分析的已完成对话
  var studentHistory = getStudentAllHistory(history, studentId);

  // 收集所有合法分析条目的 conversation，构建候选列表
  var candidates = [];
  for (var i = 0; i < studentHistory.length; i++) {
    var entry = studentHistory[i];
    if (getValidAnalysis(entry) === null) continue;
    var hits = getValidHitsForEntry(entry);
    if (hits.length === 0) continue;
    candidates.push({ entry: entry, hits: hits });
  }

  // 按 observedAt 从新到旧排序
  candidates.sort(function (a, b) {
    var sa = getValidStartTime(a.entry);
    var sb = getValidStartTime(b.entry);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    var da = Date.parse(sa);
    var db = Date.parse(sb);
    if (da === db) return 0;
    return db - da;
  });

  // 生成 insights
  var insights = [];
  for (var ci = 0; ci < candidates.length; ci++) {
    var cand = candidates[ci];
    var entry = cand.entry;
    var hits = cand.hits;
    var convId = typeof entry.id === 'string' ? entry.id : '';
    var sessId = typeof entry.sessionId === 'string' ? entry.sessionId : '';
    var observedAt = getValidStartTime(entry);
    var cs = getValidConversationState(entry);
    var topic = cs !== null ? cs.activeTopic : null;

    // Fallback: conversationState 不可用时，从 analysis 的活跃话题补全 topic
    if (topic === null) {
      var validAnalysisForTopic = getValidAnalysis(entry);
      if (validAnalysisForTopic) {
        var analTopics = validAnalysisForTopic['活跃话题'];
        if (Array.isArray(analTopics) && analTopics.length > 0 &&
            analTopics[0] && typeof analTopics[0].topic === 'string' &&
            analTopics[0].topic.trim().length > 0) {
          topic = analTopics[0].topic.trim();
        }
      }
    }

    // 提取该对话的信号质量
    var signalQuality = 'normal';
    var signalQualityReason = '';
    var validAnalysis = getValidAnalysis(entry);
    if (validAnalysis) {
      var sq = validAnalysis['信号质量'];
      if (sq === 'low') {
        signalQuality = 'low';
        signalQualityReason = safeString(validAnalysis['信号质量原因']);
      }
    }

    for (var hi = 0; hi < hits.length; hi++) {
      var hit = hits[hi];
      var insightId = 'insight-' + convId + '-' + hi;

      insights.push({
        id: insightId,
        studentId: studentId,
        conversationId: convId,
        sessionId: sessId,
        source: 'conversation_analysis',
        dimension: hit.dimension,
        indicator: hit.indicator,
        signal: hit.signal,
        evidenceSnippet: hit.evidenceSnippet,
        turnLabel: hit.turnLabel,
        strengthNote: hit.strengthNote,
        pattern: hit.pattern,
        strength: hit.strength,
        signalQuality: signalQuality,
        signalQualityReason: signalQualityReason,
        topic: topic,
        confidence: 'candidate',
        observedAt: observedAt,
        reviewStatus: "unreviewed",
        isWeakSignal: hit.strength === "weak",
      });
    }
  }

  return { allowed: true, reason: null, insights: insights };
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  teacherCanAccessStudent: teacherCanAccessStudent,
  buildTeacherRoster: buildTeacherRoster,
  buildStudentOverview: buildStudentOverview,
  buildStudentConversationSummaries: buildStudentConversationSummaries,
  buildStudentConversationDetail: buildStudentConversationDetail,
  buildStudentInsights: buildStudentInsights,
  // 内部数据解析函数 — 供 lib 目录下其他模块复用（不对外暴露 HTTP 路由）
  getStudentAllHistory: getStudentAllHistory,
  getValidAnalysis: getValidAnalysis,
  getAnalysisStatus: getAnalysisStatus,
  getValidHits: getValidHits,
  getValidStartTime: getValidStartTime,
};
