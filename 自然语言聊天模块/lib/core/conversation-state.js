/**
 * conversation-state.js — 五阶段对话状态机
 *
 * 纯函数模块。不发起网络请求、不读写文件、不修改输入参数。
 *
 * 阶段：
 *   opening | interest | deepening | open_task | closing
 *
 * question_budget：
 *   只能为 0、1 或 2
 *
 * observation_focus：
 *   narrative_organization
 *   vocabulary_choice
 *   active_topic_tendency
 *   interest_depth_breadth
 *   self_reflection
 *   value_judgment
 *   adaptive_elaboration
 *   none
 */

'use strict';

// ============================================================
// 常量
// ============================================================

const VALID_STAGES = Object.freeze([
  'opening',
  'interest',
  'deepening',
  'open_task',
  'closing',
]);

const REAL_INDICATORS = Object.freeze([
  'narrative_organization',
  'vocabulary_choice',
  'active_topic_tendency',
  'interest_depth_breadth',
  'self_reflection',
  'value_judgment',
  'adaptive_elaboration',
]);

const VALID_OBSERVATION_FOCUSES = Object.freeze([
  ...REAL_INDICATORS,
  'none',
]);

const VALID_ENGAGEMENTS = Object.freeze([
  'high',
  'medium',
  'low',
]);

// ============================================================
// 基础辅助函数
// ============================================================

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function safeInt(value, fallback, minimum) {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= minimum
  ) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    if (
      Number.isFinite(parsed) &&
      Number.isInteger(parsed) &&
      parsed >= minimum
    ) {
      return parsed;
    }
  }

  return fallback;
}

function safeBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function safeEnum(value, allowed, fallback) {
  return (
    typeof value === 'string' &&
    allowed.includes(value)
  )
    ? value
    : fallback;
}

function safeQuestionBudget(value) {
  return value === 0 || value === 1 || value === 2 ? value : 0;
}

function cloneKnownFact(fact) {
  return {
    key: fact.key,
    value: fact.value,
    source_quote: fact.source_quote,
    confidence: 'explicit',
  };
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

function isValidExplicitFact(fact) {
  return Boolean(
    fact &&
    typeof fact === 'object' &&
    !Array.isArray(fact) &&
    typeof fact.key === 'string' &&
    fact.key.trim().length > 0 &&
    typeof fact.value === 'string' &&
    fact.value.trim().length > 0 &&
    fact.confidence === 'explicit'
  );
}

function copyExplicitFact(fact) {
  return {
    key: fact.key.trim(),
    value: fact.value.trim(),
    source_quote:
      typeof fact.source_quote === 'string'
        ? fact.source_quote
        : '',
    confidence: 'explicit',
  };
}

/**
 * focus_history 只保存真正使用过的七种指标。
 * 不保存 "none"。
 */
function safeFocusHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const result = [];

  for (const focus of value) {
    if (
      typeof focus === 'string' &&
      REAL_INDICATORS.includes(focus)
    ) {
      result.push(focus);
    }
  }

  return result;
}

/**
 * used_focuses：
 * - 只保存真正指标
 * - 去重
 * - 最多三种
 */
function safeUsedFocuses(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = Object.create(null);
  const result = [];

  for (const focus of value) {
    if (
      typeof focus !== 'string' ||
      !REAL_INDICATORS.includes(focus) ||
      hasOwn(seen, focus)
    ) {
      continue;
    }

    seen[focus] = true;
    result.push(focus);

    if (result.length === 3) {
      break;
    }
  }

  return result;
}

// ============================================================
// 初始状态与规范化
// ============================================================

function createInitialConversationState() {
  return {
    turn_index: 0,
    stage: 'opening',
    question_budget: 1,
    active_topic: null,
    engagement: 'medium',
    observation_focus: 'none',
    known_facts: [],
    previous_assistant_asked: false,
    consecutive_short_replies: 0,
    open_task_completed: false,
    open_task_used: false,
    student_refused_topic: false,
    focus_history: [],
    used_focuses: [],
  };
}

/**
 * 规范化不可信状态。
 *
 * candidate 不是对象时：
 *   视为尚未建立状态，返回初始状态。
 *
 * candidate 是对象但 stage 缺失或非法时：
 *   视为状态损坏，恢复为 closing。
 *   这是最保守策略，避免错误恢复提问资格。
 */
function normalizeConversationState(candidate) {
  const defaults = createInitialConversationState();

  if (
    candidate === null ||
    candidate === undefined ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    return defaults;
  }

  const normalized = {
    turn_index: safeInt(
      candidate.turn_index,
      0,
      0
    ),

    stage: safeEnum(
      candidate.stage,
      VALID_STAGES,
      'closing'
    ),

    question_budget: safeQuestionBudget(
      candidate.question_budget
    ),

    active_topic:
      typeof candidate.active_topic === 'string' &&
      candidate.active_topic.trim().length > 0
        ? candidate.active_topic.trim()
        : null,

    engagement: safeEnum(
      candidate.engagement,
      VALID_ENGAGEMENTS,
      'medium'
    ),

    observation_focus: safeEnum(
      candidate.observation_focus,
      VALID_OBSERVATION_FOCUSES,
      'none'
    ),

    known_facts: mergeKnownFacts(
      [],
      candidate.known_facts
    ),

    previous_assistant_asked: safeBool(
      candidate.previous_assistant_asked,
      false
    ),

    consecutive_short_replies: safeInt(
      candidate.consecutive_short_replies,
      0,
      0
    ),

    open_task_completed: safeBool(
      candidate.open_task_completed,
      false
    ),

    open_task_used: safeBool(
      candidate.open_task_used,
      false
    ),

    student_refused_topic: safeBool(
      candidate.student_refused_topic,
      false
    ),

    focus_history: safeFocusHistory(
      candidate.focus_history
    ),

    used_focuses: safeUsedFocuses(
      candidate.used_focuses
    ),
  };

  // opening 和 closing 不允许观察焦点。
  if (
    normalized.stage === 'opening' ||
    normalized.stage === 'closing'
  ) {
    normalized.observation_focus = 'none';
  }

  // 不信任输入中的 question_budget。
  // 根据规范化后的完整状态重新计算。
  normalized.question_budget =
    computeQuestionBudget(normalized);

  return normalized;
}

// ============================================================
// 状态推进
// ============================================================

/**
 * 根据上一轮状态和本轮明确事件计算下一状态。
 *
 * event 可包含：
 *
 * activeTopic
 * engagement
 * observationFocus
 * knownFactsToAdd
 * studentRefusedTopic
 * openTaskCompleted
 * allowOpenTask
 * allowDeepening
 * studentAddedNewInfo
 * forceClosing
 * explicitFarewell
 * previousAssistantAsked
 * isShortReply
 */
function advanceConversationState(previousState, event) {
  const previous =
    normalizeConversationState(previousState);

  const currentEvent =
    event &&
    typeof event === 'object' &&
    !Array.isArray(event)
      ? event
      : {};

  const next = {
    ...previous,

    known_facts:
      previous.known_facts.map(cloneKnownFact),

    focus_history:
      previous.focus_history.slice(),

    used_focuses:
      previous.used_focuses.slice(),
  };

  // 已经进入 closing 后保持 closing。
  if (previous.stage === 'closing') {
    next.turn_index =
      previous.turn_index + 1;

    next.question_budget = 0;
    next.observation_focus = 'none';

    next.consecutive_short_replies =
      computeConsecutiveShort(
        previous,
        currentEvent
      );

    if (
      hasOwn(
        currentEvent,
        'previousAssistantAsked'
      )
    ) {
      next.previous_assistant_asked =
        safeBool(
          currentEvent.previousAssistantAsked,
          previous.previous_assistant_asked
        );
    }

    return next;
  }

  next.turn_index =
    previous.turn_index + 1;

  next.consecutive_short_replies =
    computeConsecutiveShort(
      previous,
      currentEvent
    );

  // 上一条已经发送的小新回复是否包含问题。
  if (
    hasOwn(
      currentEvent,
      'previousAssistantAsked'
    )
  ) {
    next.previous_assistant_asked =
      safeBool(
        currentEvent.previousAssistantAsked,
        previous.previous_assistant_asked
      );
  }

  // 更新活跃话题。
  if (
    typeof currentEvent.activeTopic === 'string' &&
    currentEvent.activeTopic.trim().length > 0
  ) {
    next.active_topic =
      currentEvent.activeTopic.trim();
  }

  // 更新参与度。
  if (
    typeof currentEvent.engagement === 'string' &&
    VALID_ENGAGEMENTS.includes(
      currentEvent.engagement
    )
  ) {
    next.engagement =
      currentEvent.engagement;
  }

  // 显式合法布尔值才覆盖。
  // false 可以清除旧的 true。
  if (
    hasOwn(
      currentEvent,
      'studentRefusedTopic'
    )
  ) {
    next.student_refused_topic =
      safeBool(
        currentEvent.studentRefusedTopic,
        previous.student_refused_topic
      );
  }

  if (
    currentEvent.openTaskCompleted === true
  ) {
    next.open_task_completed = true;
  }

  // 计算阶段转换。
  next.stage = computeNextStage(
    previous,
    next,
    currentEvent
  );

  if (
    next.stage === 'open_task' &&
    previous.stage !== 'open_task'
  ) {
    next.open_task_used = true;
  }

  // 确定本轮请求的观察焦点。
  const requestedFocus =
    hasOwn(currentEvent, 'observationFocus')
      ? currentEvent.observationFocus
      : previous.observation_focus;

  // 必须通过选择器，不能直接写入。
  next.observation_focus =
    selectObservationFocus(
      next,
      requestedFocus
    );

  // opening / closing 最终强制为 none。
  if (
    next.stage === 'opening' ||
    next.stage === 'closing'
  ) {
    next.observation_focus = 'none';
  }

  // 只有最终实际使用的 focus 才写入历史。
  if (next.observation_focus !== 'none') {
    next.focus_history =
      previous.focus_history.concat([
        next.observation_focus,
      ]);

    if (
      !previous.used_focuses.includes(
        next.observation_focus
      ) &&
      previous.used_focuses.length < 3
    ) {
      next.used_focuses =
        previous.used_focuses.concat([
          next.observation_focus,
        ]);
    } else {
      next.used_focuses =
        previous.used_focuses.slice();
    }
  } else {
    next.focus_history =
      previous.focus_history.slice();

    next.used_focuses =
      previous.used_focuses.slice();
  }

  // 合并本轮明确事实。
  if (
    Array.isArray(
      currentEvent.knownFactsToAdd
    ) &&
    currentEvent.knownFactsToAdd.length > 0
  ) {
    next.known_facts = mergeKnownFacts(
      previous.known_facts,
      currentEvent.knownFactsToAdd
    );
  } else {
    next.known_facts =
      previous.known_facts.map(
        cloneKnownFact
      );
  }

  next.question_budget =
    computeQuestionBudget(next);

  return next;
}

function computeNextStage(
  previous,
  next,
  event
) {
  // 上层强制收尾。
  if (event.forceClosing === true) {
    return 'closing';
  }

  // 达到最大轮数后收尾。
  if (next.turn_index >= 18) {
    return 'closing';
  }

  // 只接受明确事件，不分析 studentMessage。
  if (event.explicitFarewell === true) {
    return 'closing';
  }

  // 后期连续短回复时收尾。
  if (
    next.consecutive_short_replies >= 3 &&
    next.turn_index >= 15
  ) {
    return 'closing';
  }

  // open_task 完成后收尾。
  if (
    previous.stage === 'open_task' &&
    next.open_task_completed
  ) {
    return 'closing';
  }

  if (previous.stage === 'opening') {
    return next.turn_index >= 2
      ? 'interest'
      : 'opening';
  }

  if (previous.stage === 'interest') {
    // 只有明确事件同时满足时才能进入 deepening。
    if (
      event.allowDeepening === true &&
      event.studentAddedNewInfo === true &&
      next.engagement !== 'low' &&
      next.student_refused_topic !== true
    ) {
      return 'deepening';
    }

    return 'interest';
  }

  if (previous.stage === 'deepening') {
    if (
      event.allowOpenTask === true &&
      previous.open_task_used !== true &&
      next.engagement !== 'low' &&
      next.student_refused_topic !== true &&
      next.active_topic !== null
    ) {
      return 'open_task';
    }

    if (
      next.turn_index >= 15 &&
      (
        next.engagement === 'low' ||
        next.consecutive_short_replies >= 3
      )
    ) {
      return 'closing';
    }

    return 'deepening';
  }

  if (previous.stage === 'open_task') {
    if (
      next.open_task_completed ||
      next.student_refused_topic ||
      next.engagement === 'low'
    ) {
      return 'closing';
    }

    return 'open_task';
  }

  // 理论上不会到这里。
  // 异常阶段使用 closing 作为保守结果。
  return 'closing';
}

function computeConsecutiveShort(
  previous,
  event
) {
  return event.isShortReply === true
    ? previous.consecutive_short_replies + 1
    : 0;
}

// ============================================================
// question_budget
// ============================================================

function computeQuestionBudget(state) {
  if (
    !state ||
    typeof state !== 'object' ||
    Array.isArray(state)
  ) {
    return 0;
  }

  if (
    typeof state.stage !== 'string' ||
    !VALID_STAGES.includes(state.stage)
  ) {
    return 0;
  }

  if (
    typeof state.engagement !== 'string' ||
    !VALID_ENGAGEMENTS.includes(
      state.engagement
    )
  ) {
    return 0;
  }

  if (state.stage === 'closing') {
    return 0;
  }

  if (
    state.previous_assistant_asked === true
  ) {
    return 0;
  }

  if (state.engagement === 'low') {
    return 0;
  }

  if (
    typeof state.consecutive_short_replies ===
      'number' &&
    Number.isFinite(
      state.consecutive_short_replies
    ) &&
    state.consecutive_short_replies >= 2
  ) {
    return 0;
  }

  if (
    state.student_refused_topic === true
  ) {
    return 0;
  }

  return 2;
}

// ============================================================
// observation_focus
// ============================================================

function selectObservationFocus(
  state,
  suggestion
) {
  if (
    !state ||
    typeof state !== 'object' ||
    Array.isArray(state)
  ) {
    return 'none';
  }

  if (
    !VALID_STAGES.includes(state.stage) ||
    !VALID_ENGAGEMENTS.includes(
      state.engagement
    )
  ) {
    return 'none';
  }

  if (
    state.stage === 'opening' ||
    state.stage === 'closing' ||
    state.engagement === 'low' ||
    state.student_refused_topic === true
  ) {
    return 'none';
  }

  if (
    typeof suggestion !== 'string' ||
    !REAL_INDICATORS.includes(suggestion)
  ) {
    return 'none';
  }

  const history =
    safeFocusHistory(
      state.focus_history
    );

  const usedFocuses =
    safeUsedFocuses(
      state.used_focuses
    );

  // active_topic_tendency 更保守：
  // 整段对话最多主动使用一次。
  if (
    suggestion ===
    'active_topic_tendency'
  ) {
    const count = history.filter(
      (focus) =>
        focus ===
        'active_topic_tendency'
    ).length;

    if (count >= 1) {
      return 'none';
    }
  }

  // 同一 focus 最多连续两轮。
  const recentTwo =
    history.slice(-2);

  if (
    recentTwo.length === 2 &&
    recentTwo[0] === suggestion &&
    recentTwo[1] === suggestion
  ) {
    return 'none';
  }

  // 已使用过的 focus 可继续使用。
  if (
    usedFocuses.includes(suggestion)
  ) {
    return suggestion;
  }

  // 不同 focus 最多三种。
  if (usedFocuses.length >= 3) {
    return 'none';
  }

  return suggestion;
}

// ============================================================
// known_facts
// ============================================================

function mergeKnownFacts(
  existingFacts,
  additions
) {
  const existing =
    Array.isArray(existingFacts)
      ? existingFacts
      : [];

  const incoming =
    Array.isArray(additions)
      ? additions
      : [];

  // 防止 __proto__ 等特殊 key 污染映射。
  const indexByKey =
    Object.create(null);

  const result = [];

  function applyFact(fact) {
    if (!isValidExplicitFact(fact)) {
      return;
    }

    const copied =
      copyExplicitFact(fact);

    const normalizedKey =
      normalizeFactKey(copied.key);

    if (
      !hasOwn(
        indexByKey,
        normalizedKey
      )
    ) {
      indexByKey[normalizedKey] =
        result.length;

      result.push(copied);
      return;
    }

    const index =
      indexByKey[normalizedKey];

    const current =
      result[index];

    // 同 key 不同 value：
    // 保留较新的明确事实。
    if (
      normalizeFactValue(
        current.value
      ) !==
      normalizeFactValue(
        copied.value
      )
    ) {
      result[index] = copied;
    }
  }

  for (const fact of existing) {
    applyFact(fact);
  }

  for (const fact of incoming) {
    applyFact(fact);
  }

  return result;
}

// ============================================================
// engagement 与短回复
// ============================================================

function deriveEngagement(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    return 'low';
  }

  if (
    input.student_refused_topic === true
  ) {
    return 'low';
  }

  if (
    typeof input.consecutive_short_replies ===
      'number' &&
    Number.isFinite(
      input.consecutive_short_replies
    ) &&
    input.consecutive_short_replies >= 2
  ) {
    return 'low';
  }

  if (
    typeof input.message !== 'string'
  ) {
    return 'low';
  }

  const cleaned =
    input.message.replace(/\s+/g, '');

  if (cleaned.length === 0) {
    return 'low';
  }

  if (cleaned.length <= 3) {
    return 'low';
  }

  if (cleaned.length >= 30) {
    return 'high';
  }

  return 'medium';
}

function isShortStudentReply(message) {
  if (typeof message !== 'string') {
    return false;
  }

  return (
    message.replace(/\s+/g, '').length < 5
  );
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  VALID_STAGES,
  VALID_OBSERVATION_FOCUSES,
  VALID_ENGAGEMENTS,
  REAL_INDICATORS,

  createInitialConversationState,
  normalizeConversationState,
  advanceConversationState,

  computeQuestionBudget,
  selectObservationFocus,
  mergeKnownFacts,
  deriveEngagement,
  isShortStudentReply,
};