/**
 * test/teacher-insight-review-adapter.test.js — 教师端潜能线索审核适配器测试
 *
 * 覆盖：
 *   A. validateReviewPatch
 *   B. buildReviewRecord
 *   C. mergeReviewsIntoInsights
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

var adapter = require('../lib/teacher/teacher-insight-review-adapter');

// ============================================================
//  共享测试 fixture
// ============================================================

var INSIGHT_SAMPLE = {
  id: 'insight-conv-001-0',
  studentId: 'student-a',
  conversationId: 'conv-001',
  sessionId: 'sess-001',
  source: 'conversation_analysis',
  dimension: '兴趣方向',
  indicator: '主动话题倾向',
  signal: '学生主动引出运动话题',
  evidenceSnippet: '今天体育课打篮球了',
  turnLabel: '第1轮',
  strengthNote: '',
  topic: null,
  confidence: 'candidate',
  observedAt: '2026-07-10T08:00:00.000Z',
  reviewStatus: 'unreviewed',
};

var INSIGHT_INS_PROTO = Object.create(null);
INSIGHT_INS_PROTO.id = 'insight-proto-0';
INSIGHT_INS_PROTO.studentId = 'student-a';
INSIGHT_INS_PROTO.conversationId = 'conv-001';
INSIGHT_INS_PROTO.sessionId = 'sess-001';
INSIGHT_INS_PROTO.source = 'conversation_analysis';
INSIGHT_INS_PROTO.dimension = '兴趣方向';
INSIGHT_INS_PROTO.indicator = '主动话题倾向';
INSIGHT_INS_PROTO.signal = '信号';
INSIGHT_INS_PROTO.evidenceSnippet = '证据';
INSIGHT_INS_PROTO.turnLabel = '第1轮';
INSIGHT_INS_PROTO.strengthNote = '';
INSIGHT_INS_PROTO.topic = null;
INSIGHT_INS_PROTO.confidence = 'candidate';
INSIGHT_INS_PROTO.observedAt = '2026-07-10T08:00:00.000Z';
INSIGHT_INS_PROTO.reviewStatus = 'unreviewed';

var EXISTING_REVIEW = {
  id: 'rev-100',
  teacherId: 'teacher-a',
  studentId: 'student-a',
  insightId: 'insight-conv-001-0',
  conversationId: 'conv-001',
  reviewStatus: 'teacher_confirmed',
  note: '在课堂中也观察到',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z',
};

var EXISTING_REVIEW_UNREVIEWED = {
  id: 'rev-101',
  teacherId: 'teacher-a',
  studentId: 'student-a',
  insightId: 'insight-conv-001-0',
  conversationId: 'conv-001',
  reviewStatus: 'unreviewed',
  note: '备注保留',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z',
};

var NOW = '2026-07-24T10:00:00.000Z';
var REVIEW_ID = 'rev-200';

// ============================================================
//  A. validateReviewPatch
// ============================================================

describe('A. validateReviewPatch', function () {

  // A1: null 安全
  it('1. null 安全', function () {
    var r = adapter.validateReviewPatch(null);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_PATCH');
    assert.strictEqual(r.value, null);
  });

  it('1b. undefined 安全', function () {
    var r = adapter.validateReviewPatch(undefined);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_PATCH');
  });

  it('1c. 数字安全', function () {
    var r = adapter.validateReviewPatch(42);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_PATCH');
  });

  it('1d. 字符串安全', function () {
    var r = adapter.validateReviewPatch('hello');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_PATCH');
  });

  // A2: 数组拒绝
  it('2. 数组拒绝', function () {
    var r = adapter.validateReviewPatch(['reviewStatus']);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_PATCH');
  });

  // A3: 空对象 INVALID_REVIEW_PATCH
  it('3. 空对象 INVALID_REVIEW_PATCH', function () {
    var r = adapter.validateReviewPatch({});
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_PATCH');
  });

  // A4: 合法 teacher_confirmed
  it('4. 合法 teacher_confirmed', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 'teacher_confirmed' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.error, null);
    assert.deepStrictEqual(r.value, { reviewStatus: 'teacher_confirmed' });
  });

  // A5: 合法 rejected
  it('5. 合法 rejected', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 'rejected' });
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.value, { reviewStatus: 'rejected' });
  });

  // A6: 合法 unreviewed
  it('6. 合法 unreviewed', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 'unreviewed' });
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.value, { reviewStatus: 'unreviewed' });
  });

  // A7: note 单独提交合法
  it('7. note 单独提交合法', function () {
    var r = adapter.validateReviewPatch({ note: '在课堂中也观察到' });
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.value, { note: '在课堂中也观察到' });
  });

  // A8: reviewStatus 单独提交合法
  it('8. reviewStatus 单独提交合法', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 'teacher_confirmed' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(r.value, 'note'), false);
  });

  // A9: note 数字拒绝
  it('9. note 数字拒绝', function () {
    var r = adapter.validateReviewPatch({ note: 123 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_NOTE');
  });

  // A10: note 布尔拒绝
  it('10. note 布尔拒绝', function () {
    var r = adapter.validateReviewPatch({ note: true });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_NOTE');
  });

  // A11: note null 拒绝
  it('11. note null 拒绝', function () {
    var r = adapter.validateReviewPatch({ note: null });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_NOTE');
  });

  // A12: note 对象拒绝
  it('12. note 对象拒绝', function () {
    var r = adapter.validateReviewPatch({ note: { text: 'hello' } });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_NOTE');
  });

  // A13: note 数组拒绝
  it('13. note 数组拒绝', function () {
    var r = adapter.validateReviewPatch({ note: ['hello'] });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_NOTE');
  });

  // A14: note 正好 500 字通过
  it('14. note 正好 500 字通过', function () {
    var longNote = '';
    for (var i = 0; i < 500; i++) { longNote += 'x'; }
    var r = adapter.validateReviewPatch({ reviewStatus: 'teacher_confirmed', note: longNote });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value.note.length, 500);
  });

  // A15: note 501 字拒绝
  it('15. note 501 字拒绝', function () {
    var tooLong = '';
    for (var i = 0; i < 501; i++) { tooLong += 'x'; }
    var r = adapter.validateReviewPatch({ note: tooLong });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_NOTE');
  });

  // A16: note trim
  it('16. note trim', function () {
    var r = adapter.validateReviewPatch({ note: '  需要前后空格处理  ' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value.note, '需要前后空格处理');
  });

  it('16b. reviewStatus trim', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: '  teacher_confirmed  ' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value.reviewStatus, 'teacher_confirmed');
  });

  // A17: 空 note 表示清除
  it('17. 空 note 表示清除', function () {
    var r = adapter.validateReviewPatch({ note: '' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value.note, '');
  });

  it('17b. 仅空白 note trim 后为空', function () {
    var r = adapter.validateReviewPatch({ note: '   ' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value.note, '');
  });

  // A18: 未提交 note 时输出中不存在 note
  it('18. 未提交 note 时输出中不存在 note', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 'teacher_confirmed' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(r.value, 'note'), false);
  });

  it('18b. 未提交 reviewStatus 时输出中不存在 reviewStatus', function () {
    var r = adapter.validateReviewPatch({ note: 'hello' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(r.value, 'reviewStatus'), false);
  });

  // A19: 非法状态拒绝
  it('19. 非法状态拒绝', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 'confirmed' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_STATUS');
  });

  it('19b. reviewStatus 为数字拒绝', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 123 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_STATUS');
  });

  it('19c. reviewStatus 为布尔拒绝', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: true });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_STATUS');
  });

  // A20: conversationId 不被接受（不在 value 中）
  it('20. conversationId 不在 value 中', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 'teacher_confirmed', conversationId: 'conv-001' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(r.value, 'conversationId'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(r.value, 'reviewStatus'), true);
  });

  // A21: 不修改输入
  it('21. 不修改输入', function () {
    var input = { note: '  hello  ', reviewStatus: 'teacher_confirmed' };
    var copy = JSON.stringify(input);
    adapter.validateReviewPatch(input);
    assert.strictEqual(JSON.stringify(input), copy);
  });

  it('21b. 同时提交两个字段合法', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: 'rejected', note: '证据不足' });
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.value, { reviewStatus: 'rejected', note: '证据不足' });
  });

  it('reviewStatus 仅空白 trim 后为非法状态', function () {
    var r = adapter.validateReviewPatch({ reviewStatus: '   ' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REVIEW_STATUS');
  });

  it('Object.create(null) 输入安全', function () {
    var input = Object.create(null);
    input.reviewStatus = 'teacher_confirmed';
    var r = adapter.validateReviewPatch(input);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value.reviewStatus, 'teacher_confirmed');
  });
});

// ============================================================
//  B. buildReviewRecord
// ============================================================

describe('B. buildReviewRecord', function () {

  // B22: 新建记录正确
  it('22. 新建记录正确', function () {
    var result = adapter.buildReviewRecord({
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'teacher_confirmed', note: '确认' },
      now: NOW,
      reviewId: REVIEW_ID,
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.record.id, REVIEW_ID);
    assert.strictEqual(result.record.teacherId, 'teacher-a');
    assert.strictEqual(result.record.studentId, 'student-a');
    assert.strictEqual(result.record.insightId, 'insight-conv-001-0');
    assert.strictEqual(result.record.conversationId, 'conv-001');
    assert.strictEqual(result.record.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(result.record.note, '确认');
    assert.strictEqual(result.record.createdAt, NOW);
    assert.strictEqual(result.record.updatedAt, NOW);
  });

  // B23: conversationId 来自 insight
  it('23. conversationId 来自 insight', function () {
    var result = adapter.buildReviewRecord({
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'teacher_confirmed' },
      now: NOW,
      reviewId: REVIEW_ID,
    });
    assert.strictEqual(result.record.conversationId, INSIGHT_SAMPLE.conversationId);
    assert.strictEqual(result.record.conversationId, 'conv-001');
  });

  // B24: 更新保留 id
  it('24. 更新保留 id', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.record.id, EXISTING_REVIEW.id);
  });

  // B25: 更新保留 createdAt
  it('25. 更新保留 createdAt', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.record.createdAt, EXISTING_REVIEW.createdAt);
  });

  // B26: 更新 updatedAt
  it('26. 更新 updatedAt', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.record.updatedAt, NOW);
  });

  // B27: 状态单独更新保留 note
  it('27. 状态单独更新保留 note', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    // patch 只含 reviewStatus，note 应保留
    assert.strictEqual(result.record.reviewStatus, 'rejected');
    assert.strictEqual(result.record.note, '在课堂中也观察到');
  });

  // B28: note 单独更新保留状态
  it('28. note 单独更新保留状态', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { note: '新备注' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.record.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(result.record.note, '新备注');
  });

  // B29: note="" 清除备注
  it('29. note="" 清除备注', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { note: '' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.record.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(result.record.note, '');
  });

  // B30: unreviewed 不自动清备注
  it('30. unreviewed 不自动清备注', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'unreviewed' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.record.reviewStatus, 'unreviewed');
    // note 未被 patch 修改，应保留
    assert.strictEqual(result.record.note, '在课堂中也观察到');
  });

  it('30b. 新增时默认 unreviewed + 空 note', function () {
    var result = adapter.buildReviewRecord({
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { note: '仅备注' },
      now: NOW,
      reviewId: REVIEW_ID,
    });
    // patch 只有 note，reviewStatus 应默认 'unreviewed'
    assert.strictEqual(result.record.reviewStatus, 'unreviewed');
    assert.strictEqual(result.record.note, '仅备注');
  });

  // B31: insight.studentId 不匹配拒绝
  it('31. insight.studentId 不匹配拒绝', function () {
    var result = adapter.buildReviewRecord({
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-b',
      insight: INSIGHT_SAMPLE, // studentId 'student-a'
      patch: { reviewStatus: 'teacher_confirmed' },
      now: NOW,
      reviewId: REVIEW_ID,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'MISMATCH_STUDENT_ID');
    assert.strictEqual(result.record, null);
  });

  // B32: existingReview 唯一键不匹配拒绝
  it('32. existingReview 唯一键不匹配拒绝 — teacherId', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-b',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'MISMATCH_TEACHER_ID');
  });

  it('32b. existingReview 唯一键不匹配 — studentId', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-b',
      insight: { id: 'insight-conv-001-0', studentId: 'student-b', conversationId: 'conv-001' },
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'MISMATCH_STUDENT_ID');
  });

  it('32c. existingReview 唯一键不匹配 — insightId', function () {
    var result = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: { id: 'insight-conv-001-1', studentId: 'student-a', conversationId: 'conv-001' },
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'MISMATCH_INSIGHT_ID');
  });

  // B33: 不修改 existingReview
  it('33. 不修改 existingReview', function () {
    var before = JSON.stringify(EXISTING_REVIEW);
    adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(JSON.stringify(EXISTING_REVIEW), before);
  });

  // B34: 不修改 insight
  it('34. 不修改 insight', function () {
    var before = JSON.stringify(INSIGHT_SAMPLE);
    adapter.buildReviewRecord({
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'teacher_confirmed' },
      now: NOW,
      reviewId: REVIEW_ID,
    });
    assert.strictEqual(JSON.stringify(INSIGHT_SAMPLE), before);
  });

  // B35: 不修改 patch
  it('35. 不修改 patch', function () {
    var patch = { reviewStatus: 'teacher_confirmed', note: '确认' };
    var before = JSON.stringify(patch);
    adapter.buildReviewRecord({
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: patch,
      now: NOW,
      reviewId: REVIEW_ID,
    });
    assert.strictEqual(JSON.stringify(patch), before);
  });

  // B36: 相同输入产生相同输出
  it('36. 相同输入产生相同输出', function () {
    var args = {
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'teacher_confirmed', note: '确认' },
      now: NOW,
      reviewId: REVIEW_ID,
    };
    var r1 = adapter.buildReviewRecord(args);
    var r2 = adapter.buildReviewRecord(args);
    assert.deepStrictEqual(r1, r2);
  });

  it('新增时缺少 reviewId 返回错误', function () {
    var result = adapter.buildReviewRecord({
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'teacher_confirmed' },
      now: NOW,
      reviewId: '',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'INVALID_REVIEW_ID');
  });

  it('null 输入安全', function () {
    var r = adapter.buildReviewRecord(null);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_INPUT');
    assert.strictEqual(r.record, null);
  });

  it('existingReview 为非对象时拒绝', function () {
    var r = adapter.buildReviewRecord({
      existingReview: 'not-an-object',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'teacher_confirmed' },
      now: NOW,
      reviewId: REVIEW_ID,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_EXISTING_REVIEW');
  });

  it('Object.create(null) insight 安全', function () {
    var r = adapter.buildReviewRecord({
      existingReview: null,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_INS_PROTO,
      patch: { reviewStatus: 'teacher_confirmed' },
      now: NOW,
      reviewId: REVIEW_ID,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.record.studentId, 'student-a');
    assert.strictEqual(r.record.conversationId, 'conv-001');
  });

  it('Object.create(null) existingReview 安全', function () {
    var er = Object.create(null);
    er.id = 'rev-proto';
    er.teacherId = 'teacher-a';
    er.studentId = 'student-a';
    er.insightId = 'insight-conv-001-0';
    er.conversationId = 'conv-001';
    er.reviewStatus = 'teacher_confirmed';
    er.note = '备注';
    er.createdAt = '2026-07-20T10:00:00.000Z';
    er.updatedAt = '2026-07-20T10:00:00.000Z';

    var r = adapter.buildReviewRecord({
      existingReview: er,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'rejected' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.record.id, 'rev-proto');
    assert.strictEqual(r.record.reviewStatus, 'rejected');
  });

  it('patch 同时修改两个字段', function () {
    var r = adapter.buildReviewRecord({
      existingReview: EXISTING_REVIEW,
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insight: INSIGHT_SAMPLE,
      patch: { reviewStatus: 'rejected', note: '新备注内容' },
      now: NOW,
      reviewId: 'rev-ignored',
    });
    assert.strictEqual(r.record.reviewStatus, 'rejected');
    assert.strictEqual(r.record.note, '新备注内容');
  });
});

// ============================================================
//  C. mergeReviewsIntoInsights
// ============================================================

describe('C. mergeReviewsIntoInsights', function () {

  // C37: 无 review 返回 unreviewed
  it('37. 无 review 返回 unreviewed', function () {
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: [],
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].reviewStatus, 'unreviewed');
    assert.strictEqual(result[0].teacherNote, null);
    assert.strictEqual(result[0].reviewedAt, null);
    assert.strictEqual(result[0].reviewUpdatedAt, null);
  });

  // C38: 匹配 review 合并正确
  it('38. 匹配 review 合并正确', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认观察',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-21T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].reviewStatus, 'teacher_confirmed');
    assert.strictEqual(result[0].teacherNote, '确认观察');
    assert.strictEqual(result[0].reviewedAt, '2026-07-20T10:00:00.000Z');
    assert.strictEqual(result[0].reviewUpdatedAt, '2026-07-21T10:00:00.000Z');
  });

  // C39: 不同教师不合并
  it('39. 不同教师不合并', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-b',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认观察',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'unreviewed');
    assert.strictEqual(result[0].teacherNote, null);
  });

  // C40: 不同学生不合并
  it('40. 不同学生不合并', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-b',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'unreviewed');
  });

  // C41: conversationId 不匹配不合并
  it('41. conversationId 不匹配不合并', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-999',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    // conversationId 不匹配，不应合并
    assert.strictEqual(result[0].reviewStatus, 'unreviewed');
    assert.strictEqual(result[0].teacherNote, null);
  });

  // C42: teacher_confirmed 不改变 confidence
  it('42. teacher_confirmed 不改变 confidence', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].confidence, 'candidate');
  });

  // C43: rejected 保留 evidenceSnippet
  it('43. rejected 保留 evidenceSnippet', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'rejected',
      note: '',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'rejected');
    assert.strictEqual(result[0].evidenceSnippet, '今天体育课打篮球了');
    assert.strictEqual(result[0].dimension, '兴趣方向');
    assert.strictEqual(result[0].indicator, '主动话题倾向');
  });

  // C44: 空 note 返回 teacherNote null
  it('44. 空 note 返回 teacherNote null', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].teacherNote, null);
  });

  // C45: unreviewed 可保留备注
  it('45. unreviewed 可保留备注', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'unreviewed',
      note: '暂不确定，需要更多观察',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'unreviewed');
    assert.strictEqual(result[0].teacherNote, '暂不确定，需要更多观察');
  });

  // C46: 不返回 teacherId
  it('46. 不返回 teacherId', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    for (var i = 0; i < result.length; i++) {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result[i], 'teacherId'), false);
    }
  });

  // C47: 不返回 review record id
  it('47. 不返回 review record id', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    // Review 的 id 不应出现在输出中，但 insight 的 id 应该在
    assert.strictEqual(result[0].id, 'insight-conv-001-0');
    // 不应有 review 的 id 字段泄露
    assert.strictEqual(JSON.stringify(result).indexOf('"rev-1"'), -1);
  });

  // C48: 不修改 insights
  it('48. 不修改 insights', function () {
    var insights = [JSON.parse(JSON.stringify(INSIGHT_SAMPLE))];
    var before = JSON.stringify(insights);
    adapter.mergeReviewsIntoInsights({
      insights: insights,
      reviews: [],
      teacherId: 'teacher-a',
    });
    assert.strictEqual(JSON.stringify(insights), before);
  });

  // C49: 不修改 reviews
  it('49. 不修改 reviews', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var before = JSON.stringify(reviews);
    adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(JSON.stringify(reviews), before);
  });

  // C50: 输出顺序不变
  it('50. 输出顺序不变', function () {
    var insight1 = JSON.parse(JSON.stringify(INSIGHT_SAMPLE));
    insight1.id = 'insight-conv-001-0';
    var insight2 = JSON.parse(JSON.stringify(INSIGHT_SAMPLE));
    insight2.id = 'insight-conv-001-1';
    insight2.conversationId = 'conv-001';

    var result = adapter.mergeReviewsIntoInsights({
      insights: [insight1, insight2],
      reviews: [],
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 'insight-conv-001-0');
    assert.strictEqual(result[1].id, 'insight-conv-001-1');
  });

  // C51: malformed review 跳过
  it('51. malformed review 跳过 — 缺少 teacherId', function () {
    var reviews = [{
      id: 'rev-1',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    // malformed review 被跳过，insight 保持 unreviewed
    assert.strictEqual(result[0].reviewStatus, 'unreviewed');
  });

  it('51b. malformed review 跳过 — 缺少 reviewStatus', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      note: '确认',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'unreviewed');
  });

  // C52: 重复 review 选择最新 updatedAt
  it('52. 重复 review 选择最新 updatedAt', function () {
    var reviews = [
      {
        id: 'rev-old',
        teacherId: 'teacher-a',
        studentId: 'student-a',
        insightId: 'insight-conv-001-0',
        conversationId: 'conv-001',
        reviewStatus: 'teacher_confirmed',
        note: '旧备注',
        createdAt: '2026-07-19T10:00:00.000Z',
        updatedAt: '2026-07-19T10:00:00.000Z',
      },
      {
        id: 'rev-new',
        teacherId: 'teacher-a',
        studentId: 'student-a',
        insightId: 'insight-conv-001-0',
        conversationId: 'conv-001',
        reviewStatus: 'rejected',
        note: '新备注',
        createdAt: '2026-07-21T10:00:00.000Z',
        updatedAt: '2026-07-21T10:00:00.000Z',
      },
    ];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'rejected');
    assert.strictEqual(result[0].teacherNote, '新备注');
  });

  // C53: 同时间选择最后一条
  it('53. 同时间选择最后一条', function () {
    var reviews = [
      {
        id: 'rev-first',
        teacherId: 'teacher-a',
        studentId: 'student-a',
        insightId: 'insight-conv-001-0',
        conversationId: 'conv-001',
        reviewStatus: 'teacher_confirmed',
        note: '第一条',
        createdAt: '2026-07-20T10:00:00.000Z',
        updatedAt: '2026-07-20T10:00:00.000Z',
      },
      {
        id: 'rev-last',
        teacherId: 'teacher-a',
        studentId: 'student-a',
        insightId: 'insight-conv-001-0',
        conversationId: 'conv-001',
        reviewStatus: 'rejected',
        note: '第二条',
        createdAt: '2026-07-20T10:00:00.000Z',
        updatedAt: '2026-07-20T10:00:00.000Z',
      },
    ];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    // 同日期，后者获胜
    assert.strictEqual(result[0].reviewStatus, 'rejected');
    assert.strictEqual(result[0].teacherNote, '第二条');
  });

  it('53b. 非法日期排后 — 新 review 有合法日期、旧 review 无法日期 → 新 review 胜', function () {
    var reviews = [
      {
        id: 'rev-invalid',
        teacherId: 'teacher-a',
        studentId: 'student-a',
        insightId: 'insight-conv-001-0',
        conversationId: 'conv-001',
        reviewStatus: 'teacher_confirmed',
        note: '非法日期',
        createdAt: '2026-07-20T10:00:00.000Z',
        updatedAt: 'not-a-date',
      },
      {
        id: 'rev-valid',
        teacherId: 'teacher-a',
        studentId: 'student-a',
        insightId: 'insight-conv-001-0',
        conversationId: 'conv-001',
        reviewStatus: 'rejected',
        note: '合法日期',
        createdAt: '2026-07-21T10:00:00.000Z',
        updatedAt: '2026-07-21T10:00:00.000Z',
      },
    ];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'rejected');
    assert.strictEqual(result[0].teacherNote, '合法日期');
  });

  it('53c. 两者都非法日期 → 后者胜', function () {
    var reviews = [
      {
        id: 'rev-first-invalid',
        teacherId: 'teacher-a',
        studentId: 'student-a',
        insightId: 'insight-conv-001-0',
        conversationId: 'conv-001',
        reviewStatus: 'teacher_confirmed',
        note: '第一个非法',
        createdAt: '2026-07-20T10:00:00.000Z',
        updatedAt: 'bad-date-1',
      },
      {
        id: 'rev-second-invalid',
        teacherId: 'teacher-a',
        studentId: 'student-a',
        insightId: 'insight-conv-001-0',
        conversationId: 'conv-001',
        reviewStatus: 'rejected',
        note: '第二个非法',
        createdAt: '2026-07-20T10:00:00.000Z',
        updatedAt: 'bad-date-2',
      },
    ];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'rejected');
    assert.strictEqual(result[0].teacherNote, '第二个非法');
  });

  // C54: Object.create(null) 安全
  it('54. Object.create(null) insights 安全', function () {
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_INS_PROTO],
      reviews: [],
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].reviewStatus, 'unreviewed');
  });

  it('54b. Object.create(null) reviews 安全', function () {
    var review = Object.create(null);
    review.id = 'rev-proto';
    review.teacherId = 'teacher-a';
    review.studentId = 'student-a';
    review.insightId = 'insight-conv-001-0';
    review.conversationId = 'conv-001';
    review.reviewStatus = 'teacher_confirmed';
    review.note = '确认';
    review.createdAt = '2026-07-20T10:00:00.000Z';
    review.updatedAt = '2026-07-20T10:00:00.000Z';

    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: [review],
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].reviewStatus, 'teacher_confirmed');
  });

  // C55: 相同输入产生相同输出
  it('55. 相同输入产生相同输出', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var args = { insights: [INSIGHT_SAMPLE], reviews: reviews, teacherId: 'teacher-a' };
    var r1 = adapter.mergeReviewsIntoInsights(args);
    var r2 = adapter.mergeReviewsIntoInsights(args);
    assert.deepStrictEqual(r1, r2);
  });

  // Null/undefined 安全
  it('null 输入返回空数组', function () {
    var r = adapter.mergeReviewsIntoInsights(null);
    assert.deepStrictEqual(r, []);
  });

  it('undefined 输入返回空数组', function () {
    var r = adapter.mergeReviewsIntoInsights(undefined);
    assert.deepStrictEqual(r, []);
  });

  it('insights 非数组返回空数组', function () {
    var r = adapter.mergeReviewsIntoInsights({ insights: 'not-array', reviews: [], teacherId: 't' });
    assert.deepStrictEqual(r, []);
  });

  // Multiple insights mixed with reviews
  it('多个 insights 部分匹配', function () {
    var insight2 = JSON.parse(JSON.stringify(INSIGHT_SAMPLE));
    insight2.id = 'insight-conv-001-1';
    insight2.conversationId = 'conv-001';

    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '只有第一条有备注',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];

    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE, insight2],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].reviewStatus, 'teacher_confirmed');
    assert.strictEqual(result[0].teacherNote, '只有第一条有备注');
    assert.strictEqual(result[1].reviewStatus, 'unreviewed');
    assert.strictEqual(result[1].teacherNote, null);
  });

  // 输出包含正确的字段数
  it('合并后 insight 包含所有原始字段 + teacherNote, reviewedAt, reviewUpdatedAt', function () {
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: [],
      teacherId: 'teacher-a',
    });
    var keys = Object.keys(result[0]).sort();
    var expected = [
      'id', 'studentId', 'conversationId', 'sessionId', 'source',
      'dimension', 'indicator', 'signal', 'evidenceSnippet', 'turnLabel',
      'strengthNote', 'topic', 'confidence', 'observedAt', 'reviewStatus',
      'teacherNote', 'reviewedAt', 'reviewUpdatedAt',
    ].sort();
    assert.deepStrictEqual(keys, expected);
  });

  it('confirm 时 dimension 保持不变', function () {
    var reviews = [{
      id: 'rev-1',
      teacherId: 'teacher-a',
      studentId: 'student-a',
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }];
    var result = adapter.mergeReviewsIntoInsights({
      insights: [INSIGHT_SAMPLE],
      reviews: reviews,
      teacherId: 'teacher-a',
    });
    assert.strictEqual(result[0].dimension, '兴趣方向');
    assert.strictEqual(result[0].indicator, '主动话题倾向');
    assert.strictEqual(result[0].signal, '学生主动引出运动话题');
  });
});
