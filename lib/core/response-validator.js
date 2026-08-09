/**
 * response-validator.js — 回复规则确定性检测器
 *
 * 纯函数模块。只做确定性文本检测，不调用模型、不修改输入。
 *
 * 导出：
 *   validateReply(reply, context)
 *
 * context 至少包含：
 *   { stage, question_budget, turn_index, known_facts, student_message }
 *
 * 返回：
 *   { valid, errors, question_count, sentence_count }
 */

'use strict';

// 复用旧规则模块已导出的函数。
var legacyRules;
try {
  legacyRules = require('./legacy-response-rules');
} catch (_) {
  legacyRules = null;
}

// ============================================================
// 常量
// ============================================================

var VALID_STAGES = Object.freeze([
  'opening',
  'interest',
  'deepening',
  'open_task',
  'closing',
]);

var VALID_ERROR_CODES = Object.freeze([
  'question_budget_exceeded',
  'binary_question',
  'emotion_confirmation_question',
  'repeated_greeting',
  'forbidden_opening',
  'closing_contains_question',
  'reply_too_long',
  'leaked_internal_state',
  'repeated_known_fact',
  'missing_required_question',
]);

var EMOTION_CONFIRMATION_PATTERNS = Object.freeze([
  '是不是',
  '会不会',
  '开不开心',
  '高不高兴',
  '感不感动',
  '难不难受',
  '紧不紧张',
  '爽不爽',
  '生不生气',
]);

var FORBIDDEN_OPENINGS = Object.freeze([
  '哈哈哈',
  '哈哈',
  '你好呀',
  '哇哦',
  '其实',
  '嘿',
  '嗨',
]);

var LEAKED_STATE_PATTERNS = Object.freeze([
  '<runtime_state',
  '</runtime_state',
  'question_budget',
  'observation_focus',
  'known_facts',
  'validation_errors',
  '当前阶段：',
  '当前阶段:',
  '"active_topics"',
  '"evidence"',
  '"indicator"',
  '"evidence_text"',
  '"strength"',
  '"engagement"',
  '"suggested_next_focus"',
  '"suggested_stage"',
  '"known_facts_to_add"',
  '"novel"',
  '"was_prompted"',
  '"prompt_intensity"',
  '"safety_alert"',
]);

var DEFAULT_MAX_SENTENCES = 3;

// 未来兼容常量。当前 V2 校验器不按字符数拒绝回复；
// 长度规则仍由 DEFAULT_MAX_SENTENCES / checkReplyTooLong 控制。
var DEFAULT_MAX_CHARS = 600;

// ============================================================
// 基础辅助函数
// ============================================================

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}

function blankMatchedRegion(value) {
  return value.replace(/[^\n]/g, ' ');
}

/**
 * 剥离完整闭合的引用、代码、blockquote 与 URL。
 *
 * - 被剥离内容使用空格或换行占位，避免拼接前后文本。
 * - 未闭合的引用不会吞掉后续全部内容。
 * - 英文单词内部撇号（don't、student's）不会被当作引用符。
 */
function stripQuotedRegions(text) {
  if (typeof text !== 'string') {
    return '';
  }

  var result = text;

  function stripPaired(opening, closing) {
    var searchFrom = 0;

    while (searchFrom < result.length) {
      var openingIndex = result.indexOf(
        opening,
        searchFrom
      );

      if (openingIndex < 0) {
        break;
      }

      var closingIndex = result.indexOf(
        closing,
        openingIndex + opening.length
      );

      if (closingIndex < 0) {
        searchFrom =
          openingIndex + opening.length;

        continue;
      }

      var endIndex =
        closingIndex + closing.length;

      var matched =
        result.slice(
          openingIndex,
          endIndex
        );

      result =
        result.slice(0, openingIndex) +
        blankMatchedRegion(matched) +
        result.slice(endIndex);

      searchFrom = endIndex;
    }
  }

  // 完整 fenced code block。
  result = result.replace(
    /```[\s\S]*?```/g,
    blankMatchedRegion
  );

  // 完整 inline code，不跨行。
  result = result.replace(
    /`[^`\n]*`/g,
    blankMatchedRegion
  );

  // Markdown blockquote 整行。
  result = result.replace(
    /^[ \t]*>[^\n]*(?=\n|$)/gm,
    blankMatchedRegion
  );

  // URL 中查询参数的 ? 不应被当成助手提问。
  result = result.replace(
    /(?:https?|ftp):\/\/[^\s一-鿿　-〿＀-￯"'<>]*/gi,
    blankMatchedRegion
  );

  stripPaired('“', '”');
  stripPaired('‘', '’');
  stripPaired('「', '」');
  stripPaired('『', '』');
  stripPaired('《', '》');
  stripPaired('"', '"');

  // ASCII 单引号使用扫描方式，
  // 避免吞掉前置标点或英文撇号。
  var chars = result.split('');

  function isWordChar(ch) {
    return (
      typeof ch === 'string' &&
      /[A-Za-z0-9_]/.test(ch)
    );
  }

  function isWordApostrophe(index) {
    return (
      index > 0 &&
      index + 1 < chars.length &&
      isWordChar(chars[index - 1]) &&
      isWordChar(chars[index + 1])
    );
  }

  var index = 0;

  while (index < chars.length) {
    if (
      chars[index] !== "'" ||
      isWordApostrophe(index)
    ) {
      index++;
      continue;
    }

    var closingIndex = -1;

    for (
      var j = index + 1;
      j < chars.length;
      j++
    ) {
      if (chars[j] === '\n') {
        break;
      }

      if (
        chars[j] === "'" &&
        !isWordApostrophe(j)
      ) {
        closingIndex = j;
        break;
      }
    }

    // 未闭合单引号保留原文。
    if (closingIndex < 0) {
      index++;
      continue;
    }

    for (
      var k = index;
      k <= closingIndex;
      k++
    ) {
      if (chars[k] !== '\n') {
        chars[k] = ' ';
      }
    }

    index = closingIndex + 1;
  }

  return chars.join('');
}

// ============================================================
// 主入口
// ============================================================

function validateReply(reply, context) {
  var text =
    typeof reply === 'string'
      ? reply
      : '';

  var ctx =
    normalizeContext(context);

  if (text.length === 0) {
    return {
      valid: true,
      errors: [],
      question_count: 0,
      sentence_count: 0,
    };
  }

  // 句数使用原文；
  // 问题相关检测统一使用剥离后的文本。
  var sentenceCount =
    countSentences(text);

  var questionAnalysisText =
    stripQuotedRegions(text);

  var questionCount =
    countQuestions(
      questionAnalysisText
    );

  var errors = [];
  var error;

  error = checkQuestionBudgetExceeded(
    questionAnalysisText,
    questionCount,
    ctx.question_budget
  );

  if (error) {
    errors.push(error);
  }

  error = checkMissingRequiredQuestion(
    questionCount,
    ctx.stage,
    ctx.question_budget
  );

  if (error) {
    errors.push(error);
  }

  error = checkBinaryQuestion(
    questionAnalysisText
  );

  if (error) {
    errors.push(error);
  }

  error = checkEmotionConfirmation(
    questionAnalysisText
  );

  if (error) {
    errors.push(error);
  }

  error = checkRepeatedGreeting(
    text,
    ctx.turn_index
  );

  if (error) {
    errors.push(error);
  }

  error = checkForbiddenOpening(text);

  if (error) {
    errors.push(error);
  }

  error = checkClosingQuestion(
    questionAnalysisText,
    ctx.stage,
    questionCount
  );

  if (error) {
    errors.push(error);
  }

  error = checkReplyTooLong(
    text,
    sentenceCount
  );

  if (error) {
    errors.push(error);
  }

  error = checkLeakedInternalState(
    text
  );

  if (error) {
    errors.push(error);
  }

  error = checkRepeatedKnownFact(
    questionAnalysisText,
    ctx.known_facts
  );

  if (error) {
    errors.push(error);
  }

  errors =
    deduplicateErrors(errors);

  return {
    valid: errors.length === 0,
    errors: errors,
    question_count: questionCount,
    sentence_count: sentenceCount,
  };
}

// ============================================================
// 上下文规范化
// ============================================================

function normalizeContext(ctx) {
  if (
    ctx === null ||
    ctx === undefined ||
    Array.isArray(ctx) ||
    typeof ctx !== 'object'
  ) {
    return {
      stage: 'closing',
      question_budget: 0,
      turn_index: 0,
      known_facts: [],
      student_message: '',
    };
  }

  var budget =
    ctx.question_budget;

  if (
    budget < 0 ||
    budget > 2
  ) {
    budget = 0;
  }

  var stage = ctx.stage;

  if (
    typeof stage !== 'string' ||
    VALID_STAGES.indexOf(stage) < 0
  ) {
    stage = 'closing';
  }

  return {
    stage: stage,

    question_budget: budget,

    turn_index:
      typeof ctx.turn_index === 'number' &&
      Number.isFinite(
        ctx.turn_index
      ) &&
      ctx.turn_index >= 0
        ? ctx.turn_index
        : 0,

    known_facts:
      Array.isArray(ctx.known_facts)
        ? ctx.known_facts
        : [],

    student_message:
      typeof ctx.student_message === 'string'
        ? ctx.student_message
        : '',
  };
}

// ============================================================
// 句子和问题计数
// ============================================================

function countSentences(text) {
  if (
    typeof text !== 'string' ||
    text.length === 0
  ) {
    return 0;
  }

  return text
    .split(/[。！？!?\n]+/)
    .filter(function (part) {
      return (
        part
          .replace(/\s+/g, '')
          .length > 0
      );
    })
    .length;
}

/**
 * 按句末标点切成问题分析块。
 * 连续的 ??、？？、?!、？！ 归入同一个标点簇。
 */
function splitQuestionChunks(text) {
  if (
    typeof text !== 'string' ||
    text.length === 0
  ) {
    return [];
  }

  var chunks = [];
  var current = '';
  var delimiters = '。！？!?\n';

  for (
    var i = 0;
    i < text.length;
    i++
  ) {
    var ch =
      text.charAt(i);

    current += ch;

    if (
      delimiters.indexOf(ch) < 0
    ) {
      continue;
    }

    while (
      i + 1 < text.length &&
      delimiters.indexOf(
        text.charAt(i + 1)
      ) >= 0
    ) {
      i++;
      current += text.charAt(i);
    }

    chunks.push(current);
    current = '';
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function countQuestions(text) {
  if (
    typeof text !== 'string' ||
    text.length === 0
  ) {
    return 0;
  }

  var analysisText =
    stripQuotedRegions(text);

  var chunks =
    splitQuestionChunks(
      analysisText
    );

  var count = 0;

  for (
    var i = 0;
    i < chunks.length;
    i++
  ) {
    var chunk = chunks[i];

    var explicitClusters =
      chunk.match(
        /[！!？?]*[？?][！!？?]*/g
      );

    if (
      explicitClusters &&
      explicitClusters.length > 0
    ) {
      count +=
        explicitClusters.length;

      continue;
    }

    var cleaned = chunk
      .replace(/[。！!\n]+$/g, '')
      .replace(/\s+/g, '');

    if (
      cleaned.endsWith('吗') ||
      cleaned.endsWith('呢')
    ) {
      count++;
    }
  }

  return count;
}

function countImplicitQuestions(text) {
  if (
    typeof text !== 'string' ||
    text.length === 0
  ) {
    return 0;
  }

  var analysisText =
    stripQuotedRegions(text);

  var chunks =
    splitQuestionChunks(
      analysisText
    );

  var count = 0;

  for (
    var i = 0;
    i < chunks.length;
    i++
  ) {
    var chunk = chunks[i];

    if (/[？?]/.test(chunk)) {
      continue;
    }

    var cleaned = chunk
      .replace(/[。！!\n]+$/g, '')
      .replace(/\s+/g, '');

    if (
      cleaned.endsWith('吗') ||
      cleaned.endsWith('呢')
    ) {
      count++;
    }
  }

  return count;
}

// ============================================================
// 各项检测
// ============================================================

function checkQuestionBudgetExceeded(
  text,
  questionCount,
  budget
) {
  if (questionCount > budget) {
    return {
      code:
        'question_budget_exceeded',

      detail:
        'question_budget 为 ' +
        budget +
        ' 但检测到 ' +
        questionCount +
        ' 个问句（超过上限）',
    };
  }

  return null;
}

function checkMissingRequiredQuestion(
  questionCount,
  stage,
  budget
) {
  // closing 阶段不要求提问（closing 绝对不该提问，由 checkClosingQuestion 单独处理）
  if (stage === 'closing') {
    return null;
  }

  // budget < 1 时不要求提问（question_budget=0 或 normalizeContext 归零的无效值）
  if (budget < 1) {
    return null;
  }

  if (questionCount === 0) {
    return {
      code: 'missing_required_question',
      detail:
        'stage 为 ' +
        stage +
        ' 且 question_budget 为 ' +
        budget +
        '，但回复中没有检测到任何问句',
    };
  }

  return null;
}

function checkBinaryQuestion(text) {
  if (
    typeof text !== 'string' ||
    text.length === 0
  ) {
    return null;
  }

  if (
    legacyRules &&
    typeof legacyRules.hasChoicePattern ===
      'function' &&
    legacyRules.hasChoicePattern(text)
  ) {
    return {
      code: 'binary_question',

      detail:
        '检测到二选一式追问（“是A还是B”或“A还是B?”结构）',
    };
  }

  if (
    /是.{1,60}还是(?!算了|不要|别说|那句|那样|那个|下次|再)/.test(
      text
    ) &&
    /[？?]/.test(text)
  ) {
    return {
      code: 'binary_question',

      detail:
        '检测到“是…还是…”二选一结构',
    };
  }

  var choiceIndex =
    text.indexOf('还是');

  while (choiceIndex >= 0) {
    var after =
      text.slice(choiceIndex);

    var isCancellation =
      /^还是\s*(?:算了|不要|别说|那句|那样|那个|下次|再)/.test(
        after
      );

    if (
      !isCancellation &&
      /^还是[^？！。\n]{1,40}[？?]/.test(
        after
      )
    ) {
      return {
        code: 'binary_question',

        detail:
          '检测到“…还是…？”二选一结构',
      };
    }

    choiceIndex =
      text.indexOf(
        '还是',
        choiceIndex + 2
      );
  }

  return null;
}

function checkEmotionConfirmation(text) {
  if (
    typeof text !== 'string' ||
    text.length === 0
  ) {
    return null;
  }

  for (
    var i = 0;
    i <
    EMOTION_CONFIRMATION_PATTERNS.length;
    i++
  ) {
    var pattern =
      EMOTION_CONFIRMATION_PATTERNS[i];

    if (
      text.indexOf(pattern) >= 0 &&
      isInQuestionContext(
        text,
        pattern
      )
    ) {
      return {
        code:
          'emotion_confirmation_question',

        detail:
          '检测到确认式情绪问题："' +
          pattern +
          '"',
      };
    }
  }

  return null;
}

function isInQuestionContext(
  text,
  pattern
) {
  if (
    typeof text !== 'string' ||
    typeof pattern !== 'string' ||
    pattern.length === 0
  ) {
    return false;
  }

  var analysisText =
    stripQuotedRegions(text);

  var chunks =
    splitQuestionChunks(
      analysisText
    );

  for (
    var i = 0;
    i < chunks.length;
    i++
  ) {
    var chunk = chunks[i];

    if (
      chunk.indexOf(pattern) >= 0 &&
      /[？?]/.test(chunk)
    ) {
      return true;
    }
  }

  return false;
}

function checkRepeatedGreeting(
  text,
  turnIndex
) {
  if (turnIndex <= 1) {
    return null;
  }

  var trimmed =
    typeof text === 'string'
      ? text.replace(/^\s+/, '')
      : '';

  if (
    legacyRules &&
    typeof legacyRules.startsWithGreeting ===
      'function' &&
    legacyRules.startsWithGreeting(
      trimmed
    )
  ) {
    return {
      code: 'repeated_greeting',
      detail:
        '非首轮回复以问候语开头',
    };
  }

  if (
    /^(嘿[，,]?\s*|你好呀[～~]?\s*|嗨[，,]?\s*|好久不见[～~]?\s*)/.test(
      trimmed
    )
  ) {
    return {
      code: 'repeated_greeting',
      detail:
        '非首轮回复以问候语开头',
    };
  }

  return null;
}

function checkForbiddenOpening(text) {
  if (typeof text !== 'string') {
    return null;
  }

  var cleaned = text
    .replace(/^\s+/, '')
    .replace(/^[～~。，,！!]+/, '');

  for (
    var i = 0;
    i < FORBIDDEN_OPENINGS.length;
    i++
  ) {
    var opener =
      FORBIDDEN_OPENINGS[i];

    if (
      cleaned.indexOf(opener) === 0
    ) {
      return {
        code: 'forbidden_opening',

        detail:
          '回复以禁止的开头词"' +
          opener +
          '"开始',
      };
    }
  }

  return null;
}

function checkClosingQuestion(
  text,
  stage,
  questionCount
) {
  if (stage !== 'closing') {
    return null;
  }

  if (questionCount > 0) {
    return {
      code:
        'closing_contains_question',

      detail:
        'closing 阶段不应包含问句，但检测到 ' +
        questionCount +
        ' 个问题',
    };
  }

  return null;
}

function checkReplyTooLong(
  text,
  sentenceCount
) {
  if (
    sentenceCount >
    DEFAULT_MAX_SENTENCES
  ) {
    return {
      code: 'reply_too_long',

      detail:
        '回复包含 ' +
        sentenceCount +
        ' 句话（超过上限 ' +
        DEFAULT_MAX_SENTENCES +
        ' 句）',
    };
  }

  return null;
}

function checkLeakedInternalState(text) {
  if (
    typeof text !== 'string' ||
    text.length === 0
  ) {
    return null;
  }

  for (
    var i = 0;
    i <
    LEAKED_STATE_PATTERNS.length;
    i++
  ) {
    var pattern =
      LEAKED_STATE_PATTERNS[i];

    if (
      text.indexOf(pattern) < 0
    ) {
      continue;
    }

    if (
      pattern === '当前阶段：' ||
      pattern === '当前阶段:'
    ) {
      return {
        code:
          'leaked_internal_state',

        detail:
          '检测到内部状态泄漏：“当前阶段：”',
      };
    }

    if (
      pattern.indexOf(
        '<runtime_state'
      ) === 0 ||
      pattern.indexOf(
        '</runtime_state'
      ) === 0
    ) {
      return {
        code:
          'leaked_internal_state',

        detail:
          '检测到内部状态泄漏：runtime_state XML 标签',
      };
    }

    if (
      pattern.indexOf('"') === 0
    ) {
      return {
        code:
          'leaked_internal_state',

        detail:
          '检测到内部状态泄漏：JSON 字段 ' +
          pattern,
      };
    }

    return {
      code:
        'leaked_internal_state',

      detail:
        '检测到内部状态泄漏："' +
        pattern +
        '"',
    };
  }

  return null;
}

function checkRepeatedKnownFact(
  text,
  knownFacts
) {
  if (
    !Array.isArray(knownFacts) ||
    knownFacts.length === 0
  ) {
    return null;
  }

  if (
    typeof text !== 'string' ||
    text.length === 0
  ) {
    return null;
  }

  var analysisText =
    stripQuotedRegions(text);

  var hasQuestion =
    /[？?]/.test(analysisText) ||
    /[吗呢]$/.test(
      analysisText.replace(
        /\s+/g,
        ''
      )
    );

  if (!hasQuestion) {
    return null;
  }

  for (
    var i = 0;
    i < knownFacts.length;
    i++
  ) {
    var fact = knownFacts[i];

    if (
      !fact ||
      typeof fact !== 'object'
    ) {
      continue;
    }

    var factValue =
      typeof fact.value === 'string'
        ? fact.value
        : '';

    if (factValue.length < 2) {
      continue;
    }

    var keywords =
      extractKeywords(factValue);

    for (
      var k = 0;
      k < keywords.length;
      k++
    ) {
      var keyword = keywords[k];

      if (
        analysisText.indexOf(
          keyword
        ) >= 0 &&
        isKeywordInQuestion(
          analysisText,
          keyword
        )
      ) {
        return {
          code:
            'repeated_known_fact',

          detail:
            '回复以问题形式再次询问已知事实："' +
            keyword +
            '"（来自 known_fact: ' +
            factValue.slice(0, 30) +
            '）',
        };
      }
    }
  }

  return null;
}

function extractKeywords(value) {
  if (typeof value !== 'string') {
    return [];
  }

  var stopWords = [
    '是',
    '的',
    '了',
    '在',
    '和',
    '与',
    '或',
    '很',
    '都',
    '也',
    '就',
    '才',
    '把',
    '被',
    '让',
    '对',
    '从',
    '到',
    '向',
  ];

  return value
    .split(
      /[，,。！!？?\s、：:；;]+/
    )
    .filter(function (part) {
      return (
        part.length >= 2 &&
        stopWords.indexOf(part) < 0
      );
    });
}

function isKeywordInQuestion(
  text,
  keyword
) {
  if (
    typeof text !== 'string' ||
    typeof keyword !== 'string' ||
    keyword.length === 0
  ) {
    return false;
  }

  var analysisText =
    stripQuotedRegions(text);

  var chunks =
    splitQuestionChunks(
      analysisText
    );

  for (
    var i = 0;
    i < chunks.length;
    i++
  ) {
    var chunk = chunks[i];

    if (
      chunk.indexOf(keyword) < 0
    ) {
      continue;
    }

    if (/[？?]/.test(chunk)) {
      return true;
    }

    var cleaned = chunk
      .replace(/[。！!\n]+$/g, '')
      .replace(/\s+/g, '');

    if (
      cleaned.endsWith('吗') ||
      cleaned.endsWith('呢')
    ) {
      return true;
    }
  }

  return false;
}

// ============================================================
// 工具函数
// ============================================================

function deduplicateErrors(errors) {
  if (!Array.isArray(errors)) {
    return [];
  }

  var seen =
    Object.create(null);

  var result = [];

  for (
    var i = 0;
    i < errors.length;
    i++
  ) {
    var error = errors[i];

    if (
      !error ||
      typeof error !== 'object' ||
      typeof error.code !== 'string' ||
      error.code.length === 0
    ) {
      continue;
    }

    if (
      hasOwn(
        seen,
        error.code
      )
    ) {
      continue;
    }

    seen[error.code] = true;
    result.push(error);
  }

  return result;
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  validateReply: validateReply,

  VALID_ERROR_CODES:
    VALID_ERROR_CODES,

  DEFAULT_MAX_SENTENCES:
    DEFAULT_MAX_SENTENCES,

  DEFAULT_MAX_CHARS:
    DEFAULT_MAX_CHARS,

  _internals: {
    stripQuotedRegions:
      stripQuotedRegions,

    countSentences:
      countSentences,

    splitQuestionChunks:
      splitQuestionChunks,

    countQuestions:
      countQuestions,

    countImplicitQuestions:
      countImplicitQuestions,

    checkQuestionBudgetExceeded:
      checkQuestionBudgetExceeded,

    checkMissingRequiredQuestion:
      checkMissingRequiredQuestion,

    checkBinaryQuestion:
      checkBinaryQuestion,

    checkEmotionConfirmation:
      checkEmotionConfirmation,

    checkRepeatedGreeting:
      checkRepeatedGreeting,

    checkForbiddenOpening:
      checkForbiddenOpening,

    checkClosingQuestion:
      checkClosingQuestion,

    checkReplyTooLong:
      checkReplyTooLong,

    checkLeakedInternalState:
      checkLeakedInternalState,

    checkRepeatedKnownFact:
      checkRepeatedKnownFact,

    normalizeContext:
      normalizeContext,

    deduplicateErrors:
      deduplicateErrors,

    isInQuestionContext:
      isInQuestionContext,

    extractKeywords:
      extractKeywords,

    isKeywordInQuestion:
      isKeywordInQuestion,
  },
};