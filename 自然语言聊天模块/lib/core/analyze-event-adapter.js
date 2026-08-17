/**
 * analyze-event-adapter.js — analyze-v2 输出 → conversation-state 事件适配器
 *
 * 纯函数模块。将 analyze-v2 的 JSON 输出映射为 advanceConversationState
 * 所需的 event 对象，并在回复验证后安全更新 previous_assistant_asked。
 *
 * 不读写文件、不访问网络、不调用模型、不修改输入。
 *
 * 导出：
 *   buildConversationEvent(input)   → event object
 *   finalizeConversationStateAfterReply(state, validationResult) → state object
 */

'use strict';

var cs = require('./conversation-state');

// ============================================================
//  辅助函数
// ============================================================

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isNonArrayObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeBool(value) {
  return value === true;
}

function safeEngagement(value) {
  if (
    typeof value === 'string' &&
    cs.VALID_ENGAGEMENTS.indexOf(value) >= 0
  ) {
    return value;
  }
  return null;
}

function safeObservationFocus(value) {
  if (
    typeof value === 'string' &&
    cs.VALID_OBSERVATION_FOCUSES.indexOf(value) >= 0
  ) {
    return value;
  }
  return null;
}

function safeStateEvents(analysis) {
  if (!isNonArrayObject(analysis)) {
    return {};
  }

  var se = analysis.state_events;

  if (!isNonArrayObject(se)) {
    return {};
  }

  return se;
}

// ============================================================
//  buildConversationEvent
// ============================================================

/**
 * 将 analyze-v2 输出转换为 advanceConversationState 的 event 参数。
 *
 * @param {object} input
 * @param {object} input.previousState - 上一轮规范化后的 state
 * @param {object} input.analysis - analyze-v2 的 JSON 输出
 * @param {string} input.studentMessage - 学生本轮消息
 * @returns {object} event 对象（可直接传入 advanceConversationState）
 */
function buildConversationEvent(input) {
  if (!isNonArrayObject(input)) {
    return {};
  }

  var event = {};

  var prevState = cs.normalizeConversationState(
    input.previousState
  );

  var analysis = isNonArrayObject(input.analysis)
    ? input.analysis
    : {};

  var studentMessage =
    typeof input.studentMessage === 'string'
      ? input.studentMessage
      : '';

  var se = safeStateEvents(analysis);

  // ---- 确定性事件 ----

  // isShortReply — 只由纯函数计算
  var isShortReply = cs.isShortStudentReply(
    studentMessage
  );

  if (isShortReply) {
    event.isShortReply = true;
  }

  // engagement — 优先 analysis.engagement
  var nextShortCount = isShortReply
    ? prevState.consecutive_short_replies + 1
    : 0;

  var currentRefusedTopic = safeBool(
    se.student_refused_topic
  );

  var analysisEngagement = safeEngagement(
    analysis.engagement
  );

  if (analysisEngagement !== null) {
    event.engagement = analysisEngagement;
  } else {
    event.engagement = cs.deriveEngagement({
      message: studentMessage,
      consecutive_short_replies: nextShortCount,
      student_refused_topic: currentRefusedTopic,
    });
  }

  // ---- analysis 字段直接映射 ----

  // activeTopic — 第一个合法 topic
  var activeTopics = Array.isArray(
    analysis.active_topics
  )
    ? analysis.active_topics
    : [];

  for (var i = 0; i < activeTopics.length; i++) {
    var at = activeTopics[i];

    if (!isNonArrayObject(at)) {
      continue;
    }

    var topic =
      typeof at.topic === 'string'
        ? at.topic.trim()
        : '';

    if (topic.length > 0) {
      event.activeTopic = topic;
      break;
    }
  }

  // observationFocus — 合法时才输出
  var focus = safeObservationFocus(
    analysis.suggested_next_focus
  );

  if (focus !== null) {
    event.observationFocus = focus;
  }

  // knownFactsToAdd — 通过 mergeKnownFacts 清理
  var rawFacts = Array.isArray(
    analysis.known_facts_to_add
  )
    ? analysis.known_facts_to_add
    : [];

  if (rawFacts.length > 0) {
    var cleaned = cs.mergeKnownFacts([], rawFacts);

    if (cleaned.length > 0) {
      event.knownFactsToAdd = cleaned;
    }
  }

  // ---- state_events 映射（含阶段门控） ----

  // studentAddedNewInfo
  event.studentAddedNewInfo = safeBool(
    se.student_added_new_info
  );

  // studentRefusedTopic — 每轮输出合法 boolean
  event.studentRefusedTopic =
    currentRefusedTopic;

  // openTaskCompleted — 只在 open_task 阶段可为 true
  event.openTaskCompleted =
    prevState.stage === 'open_task' &&
    safeBool(se.open_task_completed);

  // explicitFarewell — 只信任 analyze 判定
  event.explicitFarewell = safeBool(
    se.explicit_farewell
  );

  // allowDeepening — 阶段门控 + 多重条件
  event.allowDeepening =
    prevState.stage === 'interest' &&
    event.studentAddedNewInfo === true &&
    safeBool(se.allow_deepening) &&
    event.engagement !== 'low' &&
    event.studentRefusedTopic === false;

  // allowOpenTask — 阶段门控 + 多重条件
  event.allowOpenTask =
    prevState.stage === 'deepening' &&
    safeBool(se.allow_open_task) &&
    event.engagement !== 'low' &&
    event.studentRefusedTopic === false;

  return event;
}

// ============================================================
//  finalizeConversationStateAfterReply
// ============================================================

/**
 * 在 validateReply 完成后更新 previous_assistant_asked 和
 * question_budget。不推进 turn_index、不改变 stage。
 *
 * @param {object} state - 本轮 advanceConversationState 后状态
 * @param {object} validationResult - validateReply 返回结果
 * @returns {object} 更新后的 state 副本
 */
function finalizeConversationStateAfterReply(
  state,
  validationResult
) {
  var safe = cs.normalizeConversationState(state);

  // fail closed：无法确认时假设包含问题
  var hasQuestion = true;

  if (isNonArrayObject(validationResult)) {
    var qc = validationResult.question_count;

    if (
      typeof qc === 'number' &&
      Number.isFinite(qc) &&
      qc >= 0 &&
      Number.isInteger(qc)
    ) {
      hasQuestion = qc > 0;
    }
  }

  safe.previous_assistant_asked = hasQuestion;

  safe.question_budget = cs.computeQuestionBudget(
    safe
  );

  return safe;
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  buildConversationEvent,
  finalizeConversationStateAfterReply,
};
