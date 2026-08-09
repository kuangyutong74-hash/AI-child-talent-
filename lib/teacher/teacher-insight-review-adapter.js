/**
 * teacher-insight-review-adapter.js — 教师端潜能线索审核适配器
 *
 * 纯函数模块。不读写文件、不访问网络、不调用模型、不依赖 Express。
 * 不修改任何输入参数。
 * 不使用 Date.now()、Math.random()。
 *
 * 导出：
 *   validateReviewPatch(input)
 *   buildReviewRecord(input)
 *   mergeReviewsIntoInsights(input)
 */

'use strict';

// ============================================================
//  辅助函数
// ============================================================

var hop = Object.prototype.hasOwnProperty;

function isNonArrayObject(val) {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function isArray(val) {
  return Array.isArray(val);
}

function isString(val) {
  return typeof val === 'string';
}

function safeGetString(obj, key, fallback) {
  if (!isNonArrayObject(obj)) return fallback;
  if (!hop.call(obj, key)) return fallback;
  var v = obj[key];
  return isString(v) ? v : fallback;
}

function safeGetOwnString(obj, key, fallback) {
  if (!isNonArrayObject(obj)) return fallback;
  if (!hop.call(obj, key)) return fallback;
  var v = obj[key];
  return isString(v) ? v : fallback;
}

function isValidISODate(str) {
  if (!isString(str)) return false;
  if (str.trim().length === 0) return false;
  var ts = Date.parse(str);
  return !isNaN(ts);
}

// ============================================================
//  常量
// ============================================================

var VALID_REVIEW_STATUSES = ['unreviewed', 'teacher_confirmed', 'rejected'];

var MAX_NOTE_LENGTH = 500;

// ============================================================
//  导出 1: validateReviewPatch
// ============================================================

/**
 * 验证客户端提交的 PATCH 请求体。
 *
 * 只接受 reviewStatus 和 note 两个字段。
 * 不接受 conversationId、teacherId、studentId、insightId。
 * 不修改输入。
 *
 * @param {*} input - 客户端请求体
 * @returns {{ ok: boolean, error: string|null, value: object|null }}
 */
function validateReviewPatch(input) {
  // 输入必须是对象，不能是数组
  if (!isNonArrayObject(input)) {
    return { ok: false, error: 'INVALID_REVIEW_PATCH', value: null };
  }

  var hasReviewStatus = hop.call(input, 'reviewStatus');
  var hasNote = hop.call(input, 'note');

  // 至少有一个字段
  if (!hasReviewStatus && !hasNote) {
    return { ok: false, error: 'INVALID_REVIEW_PATCH', value: null };
  }

  var value = {};

  // 验证 reviewStatus
  if (hasReviewStatus) {
    var rs = input.reviewStatus;
    if (!isString(rs)) {
      return { ok: false, error: 'INVALID_REVIEW_STATUS', value: null };
    }
    rs = rs.trim();
    if (VALID_REVIEW_STATUSES.indexOf(rs) < 0) {
      return { ok: false, error: 'INVALID_REVIEW_STATUS', value: null };
    }
    value.reviewStatus = rs;
  }

  // 验证 note
  if (hasNote) {
    var n = input.note;
    if (!isString(n)) {
      return { ok: false, error: 'INVALID_NOTE', value: null };
    }
    n = n.trim();
    if (n.length > MAX_NOTE_LENGTH) {
      return { ok: false, error: 'INVALID_NOTE', value: null };
    }
    value.note = n;
  }

  return { ok: true, error: null, value: value };
}

// ============================================================
//  导出 2: buildReviewRecord
// ============================================================

/**
 * 构建或更新审核记录。纯函数。
 *
 * 新增记录时使用调用方传入的 reviewId 和 now。
 * 更新时保留 existingReview.id 和 existingReview.createdAt。
 * conversationId 只能来自 insight.conversationId。
 * 不修改输入。
 *
 * @param {object} input
 * @param {object|null|undefined} input.existingReview
 * @param {string} input.teacherId
 * @param {string} input.studentId
 * @param {object} input.insight
 * @param {object} input.patch - validateReviewPatch 的 .value
 * @param {string} input.now - ISO 时间字符串
 * @param {string} input.reviewId - 新增记录时使用
 * @returns {{ ok: boolean, error: string|null, record: object|null }}
 */
function buildReviewRecord(input) {
  if (!isNonArrayObject(input)) {
    return { ok: false, error: 'INVALID_INPUT', record: null };
  }

  var existingReview = input.existingReview;
  var teacherId = input.teacherId;
  var studentId = input.studentId;
  var insight = input.insight;
  var patch = input.patch;
  var now = input.now;
  var reviewId = input.reviewId;

  // ---- 验证必填字段 ----

  if (!isString(teacherId) || teacherId.trim().length === 0) {
    return { ok: false, error: 'INVALID_TEACHER_ID', record: null };
  }
  if (!isString(studentId) || studentId.trim().length === 0) {
    return { ok: false, error: 'INVALID_STUDENT_ID', record: null };
  }
  if (!isNonArrayObject(insight)) {
    return { ok: false, error: 'INVALID_INSIGHT', record: null };
  }
  if (!isString(insight.id) || insight.id.trim().length === 0) {
    return { ok: false, error: 'INVALID_INSIGHT', record: null };
  }
  if (!hop.call(insight, 'studentId') || insight.studentId !== studentId) {
    return { ok: false, error: 'MISMATCH_STUDENT_ID', record: null };
  }
  if (!hop.call(insight, 'conversationId') || !isString(insight.conversationId)) {
    return { ok: false, error: 'INVALID_INSIGHT', record: null };
  }
  if (!isNonArrayObject(patch)) {
    return { ok: false, error: 'INVALID_PATCH', record: null };
  }
  if (!isString(now) || now.trim().length === 0) {
    return { ok: false, error: 'INVALID_NOW', record: null };
  }

  var isNew = (existingReview === null || existingReview === undefined);

  if (!isNew) {
    // 验证 existingReview 与目标匹配
    if (!isNonArrayObject(existingReview)) {
      return { ok: false, error: 'INVALID_EXISTING_REVIEW', record: null };
    }
    if (!hop.call(existingReview, 'teacherId') || existingReview.teacherId !== teacherId) {
      return { ok: false, error: 'MISMATCH_TEACHER_ID', record: null };
    }
    if (!hop.call(existingReview, 'studentId') || existingReview.studentId !== studentId) {
      return { ok: false, error: 'MISMATCH_STUDENT_ID', record: null };
    }
    if (!hop.call(existingReview, 'insightId') || existingReview.insightId !== insight.id) {
      return { ok: false, error: 'MISMATCH_INSIGHT_ID', record: null };
    }
  } else {
    // 新增记录必须有 reviewId
    if (!isString(reviewId) || reviewId.trim().length === 0) {
      return { ok: false, error: 'INVALID_REVIEW_ID', record: null };
    }
  }

  // ---- 确定基准值 ----

  var id, createdAt, prevReviewStatus, prevNote;

  if (isNew) {
    id = reviewId;
    createdAt = now;
    prevReviewStatus = 'unreviewed';
    prevNote = '';
  } else {
    id = safeGetOwnString(existingReview, 'id', '');
    createdAt = safeGetOwnString(existingReview, 'createdAt', now);
    prevReviewStatus = safeGetOwnString(existingReview, 'reviewStatus', 'unreviewed');
    prevNote = safeGetOwnString(existingReview, 'note', '');
  }

  // ---- 应用 patch（部分更新） ----

  // reviewStatus: patch 中有则用新值，否则保留原值
  var newReviewStatus = hop.call(patch, 'reviewStatus') ? patch.reviewStatus : prevReviewStatus;

  // note: patch 中有则用新值（包括空字符串），否则保留原值
  var newNote = hop.call(patch, 'note') ? patch.note : prevNote;

  // ---- 构建输出记录 ----

  return {
    ok: true,
    error: null,
    record: {
      id: id,
      teacherId: teacherId,
      studentId: studentId,
      insightId: insight.id,
      conversationId: insight.conversationId,
      reviewStatus: newReviewStatus,
      note: newNote,
      createdAt: createdAt,
      updatedAt: now,
    },
  };
}

// ============================================================
//  导出 3: mergeReviewsIntoInsights
// ============================================================

/**
 * 将审核记录合并到潜能线索数组中。
 *
 * 匹配键：teacherId + studentId + insightId，
 * 并且 review.conversationId === insight.conversationId。
 * 不修改输入。输出顺序保持 insights 原顺序。
 *
 * 重复记录：选择 updatedAt 最新的；非法日期排后；
 * 相同 updatedAt 时选输入中最后出现的一条。
 *
 * @param {object} input
 * @param {Array} input.insights
 * @param {Array} input.reviews
 * @param {string} input.teacherId
 * @returns {Array} 合并后的安全 TalentInsight 数组
 */
function mergeReviewsIntoInsights(input) {
  if (!isNonArrayObject(input)) return [];

  var insights = input.insights;
  var reviews = input.reviews;
  var teacherId = input.teacherId;

  if (!isArray(insights)) return [];
  if (!isArray(reviews)) reviews = [];
  if (!isString(teacherId)) teacherId = '';

  // ---- 过滤有效 review ----

  var validReviews = [];
  for (var i = 0; i < reviews.length; i++) {
    var r = reviews[i];
    if (!isNonArrayObject(r)) continue;
    if (!hop.call(r, 'teacherId') || r.teacherId !== teacherId) continue;
    if (!hop.call(r, 'studentId') || !isString(r.studentId)) continue;
    if (!hop.call(r, 'insightId') || !isString(r.insightId)) continue;
    if (!hop.call(r, 'conversationId') || !isString(r.conversationId)) continue;
    if (!hop.call(r, 'reviewStatus') || !isString(r.reviewStatus)) continue;
    validReviews.push(r);
  }

  // ---- 构建查找表，处理重复 ----
  // 键：studentId:insightId
  // 重复时选择 updatedAt 最新的合法记录

  var reviewMap = Object.create(null);

  for (var j = 0; j < validReviews.length; j++) {
    var rev = validReviews[j];
    var key = rev.studentId + ':' + rev.insightId;

    var existing = reviewMap[key];
    if (existing === undefined) {
      reviewMap[key] = rev;
    } else {
      // 比较 updatedAt
      var revUpdatedAt = safeGetOwnString(rev, 'updatedAt', '');
      var existUpdatedAt = safeGetOwnString(existing, 'updatedAt', '');

      var revDate = isValidISODate(revUpdatedAt) ? Date.parse(revUpdatedAt) : null;
      var existDate = isValidISODate(existUpdatedAt) ? Date.parse(existUpdatedAt) : null;

      var revWins = false;
      if (revDate !== null && existDate === null) {
        // rev 有合法日期，exist 没有 → rev 获胜
        revWins = true;
      } else if (revDate !== null && existDate !== null) {
        // 两者都有合法日期
        if (revDate > existDate) {
          revWins = true;
        } else if (revDate === existDate) {
          // 同日期，后者获胜
          revWins = true;
        }
        // revDate < existDate → existing 获胜
      } else if (revDate === null && existDate === null) {
        // 两者都无合法日期，后者获胜
        revWins = true;
      }
      // revDate === null && existDate !== null → existing 获胜

      if (revWins) {
        reviewMap[key] = rev;
      }
    }
  }

  // ---- 合并 ----

  var result = [];
  for (var k = 0; k < insights.length; k++) {
    var ins = insights[k];
    if (!isNonArrayObject(ins)) continue;

    var rKey = (hop.call(ins, 'studentId') ? ins.studentId : '') + ':' + (hop.call(ins, 'id') ? ins.id : '');
    var review = reviewMap[rKey];

    // 安全获取 insight 各字段
    var insId = safeGetOwnString(ins, 'id', '');
    var insStudentId = safeGetOwnString(ins, 'studentId', '');
    var insConvId = safeGetOwnString(ins, 'conversationId', '');
    var insSessionId = safeGetOwnString(ins, 'sessionId', '');
    var insSource = safeGetOwnString(ins, 'source', 'conversation_analysis');
    var insDimension = safeGetOwnString(ins, 'dimension', '');
    var insIndicator = safeGetOwnString(ins, 'indicator', '');
    var insSignal = safeGetOwnString(ins, 'signal', '');
    var insEvidenceSnippet = safeGetOwnString(ins, 'evidenceSnippet', '');
    var insTurnLabel = safeGetOwnString(ins, 'turnLabel', '');
    var insStrengthNote = safeGetOwnString(ins, 'strengthNote', '');
    var insTopic = hop.call(ins, 'topic') ? ins.topic : null;
    if (insTopic !== null && !isString(insTopic)) insTopic = null;
    var insConfidence = safeGetOwnString(ins, 'confidence', 'candidate');
    var insObservedAt = hop.call(ins, 'observedAt') ? ins.observedAt : null;
    if (insObservedAt !== null && !isString(insObservedAt)) insObservedAt = null;
    var insReviewStatus = safeGetOwnString(ins, 'reviewStatus', 'unreviewed');

    // 检查是否有匹配的 review 且 conversationId 一致
    var hasMatch = false;
    if (review !== undefined) {
      if (hop.call(review, 'conversationId') && review.conversationId === insConvId) {
        hasMatch = true;
      }
    }

    if (hasMatch) {
      var revNote = safeGetOwnString(review, 'note', '');
      result.push({
        id: insId,
        studentId: insStudentId,
        conversationId: insConvId,
        sessionId: insSessionId,
        source: insSource,
        dimension: insDimension,
        indicator: insIndicator,
        signal: insSignal,
        evidenceSnippet: insEvidenceSnippet,
        turnLabel: insTurnLabel,
        strengthNote: insStrengthNote,
        pattern: hop.call(ins, 'pattern') ? ins.pattern : '',
        strength: hop.call(ins, 'strength') ? ins.strength : undefined,
        isWeakSignal: hop.call(ins, 'isWeakSignal') ? ins.isWeakSignal : false,
        signalQuality: hop.call(ins, 'signalQuality') ? ins.signalQuality : 'normal',
        signalQualityReason: hop.call(ins, 'signalQualityReason') ? ins.signalQualityReason : '',
        topic: insTopic,
        confidence: insConfidence,
        observedAt: insObservedAt,
        reviewStatus: review.reviewStatus,
        teacherNote: revNote.length > 0 ? revNote : null,
        reviewedAt: safeGetOwnString(review, 'createdAt', null),
        reviewUpdatedAt: safeGetOwnString(review, 'updatedAt', null),
      });
    } else {
      result.push({
        id: insId,
        studentId: insStudentId,
        conversationId: insConvId,
        sessionId: insSessionId,
        source: insSource,
        dimension: insDimension,
        indicator: insIndicator,
        signal: insSignal,
        evidenceSnippet: insEvidenceSnippet,
        turnLabel: insTurnLabel,
        strengthNote: insStrengthNote,
        pattern: hop.call(ins, 'pattern') ? ins.pattern : '',
        strength: hop.call(ins, 'strength') ? ins.strength : undefined,
        isWeakSignal: hop.call(ins, 'isWeakSignal') ? ins.isWeakSignal : false,
        signalQuality: hop.call(ins, 'signalQuality') ? ins.signalQuality : 'normal',
        signalQualityReason: hop.call(ins, 'signalQualityReason') ? ins.signalQualityReason : '',
        topic: insTopic,
        confidence: insConfidence,
        observedAt: insObservedAt,
        reviewStatus: insReviewStatus,
        teacherNote: null,
        reviewedAt: null,
        reviewUpdatedAt: null,
      });
    }
  }

  return result;
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  validateReviewPatch: validateReviewPatch,
  buildReviewRecord: buildReviewRecord,
  mergeReviewsIntoInsights: mergeReviewsIntoInsights,
};
