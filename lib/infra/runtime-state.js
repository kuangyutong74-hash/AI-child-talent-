/**
 * runtime-state.js — 运行时状态序列化与清理
 *
 * 纯函数模块。将 conversation-state 序列化为可注入 Prompt 的
 * <runtime_state> XML 块。不修改输入对象。
 *
 * 导出：
 *   sanitizeRuntimeState(state)
 *   serializeRuntimeState(state)
 *
 * 序列化后的格式：
 *   <runtime_state>
 *   turn_index: 3
 *   stage: deepening
 *   question_budget: 1
 *   active_topic: 篮球
 *   engagement: high
 *   observation_focus: narrative_organization
 *   known_facts: [...]
 *   previous_assistant_asked: false
 *   consecutive_short_replies: 0
 *   open_task_completed: false
 *   student_refused_topic: false
 *   </runtime_state>
 */

'use strict';

// ============================================================
//  常量
// ============================================================

var VALID_STAGES = Object.freeze([
  'opening',
  'interest',
  'deepening',
  'open_task',
  'closing',
]);

var VALID_OBSERVATION_FOCUSES = Object.freeze([
  'narrative_organization',
  'vocabulary_choice',
  'active_topic_tendency',
  'interest_depth_breadth',
  'self_reflection',
  'value_judgment',
  'adaptive_elaboration',
  'none',
]);

var VALID_ENGAGEMENTS = Object.freeze(['high', 'medium', 'low']);

// ============================================================
//  基础辅助函数
// ============================================================

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * 允许输出的字段白名单（与 xiaoxin-v2.md 中声明的字段一致）。
 * focus_history 和 used_focuses 是内部控制字段，不得输出。
 */
var ALLOWED_FIELDS = Object.freeze([
  'turn_index',
  'stage',
  'question_budget',
  'active_topic',
  'engagement',
  'observation_focus',
  'known_facts',
  'previous_assistant_asked',
  'consecutive_short_replies',
  'open_task_completed',
  'student_refused_topic',
]);

// ============================================================
//  sanitizeRuntimeState
// ============================================================

/**
 * 清理运行时状态中的所有字段，确保：
 *   - 只有允许的字段出现
 *   - 所有值在合法范围内
 *   - 字符串中的危险标签被转义
 *   - 不修改输入对象
 *
 * @param {object} state - 对话状态对象
 * @returns {object} 清理后的状态副本
 */
function sanitizeRuntimeState(state) {
  var safe = {};

  if (!state || typeof state !== 'object') {
    return createMinimalSafeState();
  }

  // turn_index
  safe.turn_index = sanitizeInt(state.turn_index, 0, 0);

  // stage
  safe.stage = sanitizeStage(state.stage);

  // question_budget — 只能是 0、1 或 2
  safe.question_budget = sanitizeQuestionBudget(state.question_budget);

  // active_topic — 可为 null
  if (state.active_topic === null || state.active_topic === undefined) {
    safe.active_topic = null;
  } else {
    safe.active_topic = sanitizeString(String(state.active_topic), 100);
  }

  // engagement
  safe.engagement = sanitizeEnum(state.engagement, VALID_ENGAGEMENTS, 'medium');

  // observation_focus
  safe.observation_focus = sanitizeEnum(state.observation_focus, VALID_OBSERVATION_FOCUSES, 'none');

  // known_facts — 最小化
  safe.known_facts = sanitizeKnownFacts(state.known_facts);

  // previous_assistant_asked
  safe.previous_assistant_asked = sanitizeBool(state.previous_assistant_asked, false);

  // consecutive_short_replies
  safe.consecutive_short_replies = sanitizeInt(state.consecutive_short_replies, 0, 0);

  // open_task_completed
  safe.open_task_completed = sanitizeBool(state.open_task_completed, false);

  // student_refused_topic
  safe.student_refused_topic = sanitizeBool(state.student_refused_topic, false);

  return safe;
}

// ============================================================
//  serializeRuntimeState
// ============================================================

/**
 * 将对话状态序列化为 <runtime_state> XML 块。
 *
 * @param {object} state - 对话状态对象（可以是原始状态，先自动调用 sanitize）
 * @returns {string} <runtime_state>...</runtime_state> 字符串
 */
function serializeRuntimeState(state) {
  var safe = sanitizeRuntimeState(state);

  var lines = ['<runtime_state>'];

  // 按白名单顺序输出
  for (var i = 0; i < ALLOWED_FIELDS.length; i++) {
    var field = ALLOWED_FIELDS[i];
    var value = safe[field];

    if (field === 'known_facts') {
      lines.push(formatKnownFacts(value));
    } else if (value === null || value === undefined) {
      lines.push(field + ': null');
    } else if (typeof value === 'boolean') {
      lines.push(field + ': ' + value);
    } else if (typeof value === 'number') {
      lines.push(field + ': ' + value);
    } else {
      lines.push(field + ': ' + value);
    }
  }

  lines.push('</runtime_state>');

  return lines.join('\n');
}

// ============================================================
//  格式化已知事实
// ============================================================

/**
 * 将 known_facts 数组格式化为紧凑的单行 JSON 数组字符串。
 * 只保留 key 和 value 字段（source_quote 和 confidence 内部使用，不暴露给模型）。
 */
function formatKnownFacts(facts) {
  if (!Array.isArray(facts) || facts.length === 0) {
    return 'known_facts: []';
  }

  var minimal = [];
  for (var i = 0; i < facts.length; i++) {
    var f = facts[i];
    if (!f || typeof f !== 'object') continue;
    minimal.push({
      key: String(f.key || ''),
      value: String(f.value || ''),
    });
  }

  // 单行 JSON，不做 pretty-print
  try {
    return 'known_facts: ' + JSON.stringify(minimal);
  } catch (_) {
    return 'known_facts: []';
  }
}

// ============================================================
//  字符串清理
// ============================================================

/**
 * 清理字符串中的危险标签。
 * 防止学生内容关闭 <runtime_state> 标签或其他注入。
 */
function sanitizeString(value, maxLen) {
  if (typeof value !== 'string') return '';
  var cleaned = value;
  // 将 <runtime_state> 及其变体替换为 [...] 标记，
  // 避免在 Prompt 中出现裸 XML 标签。
  cleaned = cleaned.replace(/<runtime_state>/gi, '[runtime_state]');
  cleaned = cleaned.replace(/<\/runtime_state>/gi, '[/runtime_state]');
  cleaned = cleaned.replace(/<runtime_state\b/gi, '[runtime_state');
  // 其余尖括号统一转义。
  cleaned = cleaned.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (maxLen && cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen);
  }
  return cleaned;
}

// ============================================================
//  辅助 sanitize 函数
// ============================================================

function sanitizeInt(value, fallback, min) {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= min) {
    return value;
  }
  if (typeof value === 'string') {
    var parsed = Number(value);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= min) {
      return parsed;
    }
  }
  return fallback;
}

function sanitizeBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function sanitizeEnum(value, allowed, fallback) {
  if (typeof value === 'string' && allowed.indexOf(value) >= 0) {
    return value;
  }
  return fallback;
}

/**
 * stage 非法时使用最保守策略：closing。
 * 选择 closing 而非 opening 的原因是：
 *   closing 在 question_budget=0、observation_focus=none 时有最严格的行为约束，
 *   不会造成意外提问或观察引导。opening 虽然也安全，但可能让模型产生
 *   "首轮开始对话"的错觉，引发重新打招呼等不期望行为。
 */
function sanitizeStage(value) {
  if (typeof value === 'string' && VALID_STAGES.indexOf(value) >= 0) {
    return value;
  }
  return 'closing';
}

/**
 * question_budget 非法时返回 0。
 */
function sanitizeQuestionBudget(value) {
  if (value === 0 || value === 1 || value === 2) return value;
  return 0;
}

function sanitizeKnownFacts(value) {
  if (!Array.isArray(value)) return [];

  // 使用 Object.create(null) 防止 __proto__ 等特殊 key 污染索引。
  var indexByKey = Object.create(null);
  var result = [];

  for (var i = 0; i < value.length; i++) {
    var f = value[i];

    // 必须是纯对象（非 null、非数组）
    if (!f || typeof f !== 'object' || Array.isArray(f)) continue;

    // 只接受 explicit 确证事实
    if (f.confidence !== 'explicit') continue;

    // key 和 value 必须是字符串
    if (typeof f.key !== 'string' || typeof f.value !== 'string') continue;

    var rawKey = f.key;
    var rawValue = f.value;

    // trim 后非空才接受
    var trimmedKey = rawKey.trim();
    var trimmedValue = rawValue.trim();
    if (trimmedKey.length === 0 || trimmedValue.length === 0) continue;

    // 安全清理 key 和 value
    var cleanedKey = sanitizeString(trimmedKey, 200);
    var cleanedValue = sanitizeString(trimmedValue, 200);

    // source_quote：字符串时安全清理，否则空字符串
    var cleanedSourceQuote =
      typeof f.source_quote === 'string'
        ? sanitizeString(f.source_quote, 200)
        : '';

    // 输出 confidence 固定为 'explicit'
    var cleaned = {
      key: cleanedKey,
      value: cleanedValue,
      source_quote: cleanedSourceQuote,
      confidence: 'explicit',
    };

    // 按规范化 key 去重
    var normalizedKey = normalizeFactKey(cleanedKey);

    if (!hasOwn(indexByKey, normalizedKey)) {
      indexByKey[normalizedKey] = result.length;
      result.push(cleaned);
      continue;
    }

    var existingIndex = indexByKey[normalizedKey];
    var existing = result[existingIndex];

    // 同 key 不同 value：保留后出现的 explicit 事实
    if (
      normalizeFactValue(existing.value) !==
      normalizeFactValue(cleanedValue)
    ) {
      result[existingIndex] = cleaned;
    }
  }

  return result;
}

function normalizeFactKey(key) {
  return String(key)
    .replace(/\s+/g, '')
    .toLowerCase();
}

function normalizeFactValue(value) {
  return String(value)
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * 创建最小安全状态（输入完全无效时使用）。
 */
function createMinimalSafeState() {
  return {
    turn_index: 0,
    stage: 'closing',
    question_budget: 0,
    active_topic: null,
    engagement: 'medium',
    observation_focus: 'none',
    known_facts: [],
    previous_assistant_asked: false,
    consecutive_short_replies: 0,
    open_task_completed: false,
    student_refused_topic: false,
  };
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  sanitizeRuntimeState,
  serializeRuntimeState,
  ALLOWED_FIELDS,
  VALID_STAGES,
  VALID_OBSERVATION_FOCUSES,
  VALID_ENGAGEMENTS,
};
