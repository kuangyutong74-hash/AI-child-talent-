/**
 * test/teacher-stage-report-adapter.test.js — 阶段性报告适配器测试
 *
 * 覆盖：
 *   A. range, B. conversation + insight filtering, C. coverage + summary,
 *   D. topics, E. dimensions, F. recurringSignals,
 *   G. classification, H. engagement, I. narrative + limitations,
 *   J. safety + immutability
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

var adapter = require('../lib/teacher/teacher-stage-report-adapter');

// ============================================================
//  Fixtures
// ============================================================

var SAFE_STUDENT = { id: 'student-a', username: '小明', studentCode: '111111' };

var NOW_MS = Date.parse('2026-07-24T12:00:00.000Z');

var CONV_1 = {
  id: 'conv-001', sessionId: 'sess-001', startTime: '2026-07-10T08:00:00.000Z',
  turnCount: 4, completed: true, weather: 'sunny',
  activeTopic: '篮球', engagement: 'high', dimensionsFound: ['兴趣方向', '语言表达'],
  insightCount: 2, hasAnalysis: true,
};

var CONV_2 = {
  id: 'conv-002', sessionId: 'sess-002', startTime: '2026-07-15T10:00:00.000Z',
  turnCount: 3, completed: true, weather: 'cloudy',
  activeTopic: '遇见小猫', engagement: 'high', dimensionsFound: ['语言表达', '内省倾向'],
  insightCount: 3, hasAnalysis: true,
};

var CONV_3 = {
  id: 'conv-003', sessionId: 'sess-003', startTime: '2026-07-18T12:00:00.000Z',
  turnCount: 2, completed: false, weather: null,
  activeTopic: null, engagement: 'low', dimensionsFound: [],
  insightCount: 0, hasAnalysis: false,
};

var CONV_NO_START = {
  id: 'conv-bad', sessionId: 'sess-bad', startTime: null,
  turnCount: 1, completed: true, weather: null,
  activeTopic: null, engagement: null, dimensionsFound: [],
  insightCount: 0, hasAnalysis: false,
};

var CONV_FUTURE = {
  id: 'conv-future', sessionId: 'sess-future', startTime: '2027-01-01T00:00:00.000Z',
  turnCount: 2, completed: true, weather: null,
  activeTopic: null, engagement: 'medium', dimensionsFound: [],
  insightCount: 0, hasAnalysis: false,
};

// insight-conv-001-0: interest direction, indicator: 主动话题倾向
var INS_1 = {
  id: 'insight-conv-001-0', studentId: 'student-a', conversationId: 'conv-001',
  sessionId: 'sess-001', source: 'conversation_analysis',
  dimension: '兴趣方向', indicator: '主动话题倾向',
  signal: '学生主动引出运动话题', evidenceSnippet: '今天体育课打篮球了',
  turnLabel: '第1轮', strengthNote: '', topic: '篮球',
  confidence: 'candidate', observedAt: '2026-07-10T08:00:00.000Z',
  reviewStatus: 'unreviewed', teacherNote: null,
  reviewedAt: null, reviewUpdatedAt: null,
};

// A weak-signal insight (strength=weak + wasPrompted=true)
var INS_WEAK = {
  id: 'insight-conv-002-5', studentId: 'student-a', conversationId: 'conv-002',
  sessionId: 'sess-002', source: 'conversation_analysis',
  dimension: '思维方式', indicator: '追问下的应变',
  signal: '弱信号线索', evidenceSnippet: '弱信号证据',
  turnLabel: '第4轮', strengthNote: '', topic: '遇见小猫',
  confidence: 'candidate', observedAt: '2026-07-15T10:00:00.000Z',
  reviewStatus: 'unreviewed', teacherNote: null,
  reviewedAt: null, reviewUpdatedAt: null,
  isWeakSignal: true,
};

// insight-conv-001-1: language expression, indicator: 叙事组织能力
var INS_2 = {
  id: 'insight-conv-001-1', studentId: 'student-a', conversationId: 'conv-001',
  sessionId: 'sess-001', source: 'conversation_analysis',
  dimension: '语言表达', indicator: '叙事组织能力',
  signal: '描述了事件结果', evidenceSnippet: '我投了三分球',
  turnLabel: '第2轮', strengthNote: '仅有结果', topic: '篮球',
  confidence: 'candidate', observedAt: '2026-07-10T08:00:00.000Z',
  reviewStatus: 'unreviewed', teacherNote: null,
  reviewedAt: null, reviewUpdatedAt: null,
};

// insight-conv-002-0: language expression, indicator: 词汇丰富度
var INS_3 = {
  id: 'insight-conv-002-0', studentId: 'student-a', conversationId: 'conv-002',
  sessionId: 'sess-002', source: 'conversation_analysis',
  dimension: '语言表达', indicator: '词汇丰富度与用词选择',
  signal: '使用了形象修饰词', evidenceSnippet: '圆溜溜的眼睛',
  turnLabel: '第2轮', strengthNote: '', topic: '遇见小猫',
  confidence: 'candidate', observedAt: '2026-07-15T10:00:00.000Z',
  reviewStatus: 'unreviewed', teacherNote: null,
  reviewedAt: null, reviewUpdatedAt: null,
};

// insight-conv-002-1: interest direction, indicator: 主动话题倾向 (same dim+ind as INS_1!)
var INS_4 = {
  id: 'insight-conv-002-1', studentId: 'student-a', conversationId: 'conv-002',
  sessionId: 'sess-002', source: 'conversation_analysis',
  dimension: '兴趣方向', indicator: '主动话题倾向',
  signal: '主动引出关爱动物话题', evidenceSnippet: '今天遇见了一只可爱的小猫',
  turnLabel: '第1轮', strengthNote: '', topic: '遇见小猫',
  confidence: 'candidate', observedAt: '2026-07-15T10:00:00.000Z',
  reviewStatus: 'unreviewed', teacherNote: null,
  reviewedAt: null, reviewUpdatedAt: null,
};

// insight-conv-002-2: introspection, indicator: 自我反思频率
var INS_5 = {
  id: 'insight-conv-002-2', studentId: 'student-a', conversationId: 'conv-002',
  sessionId: 'sess-002', source: 'conversation_analysis',
  dimension: '内省倾向', indicator: '自我反思频率',
  signal: '表达了情感感受', evidenceSnippet: '特别可爱',
  turnLabel: '第1轮', strengthNote: '仅有笼统情绪词', topic: '遇见小猫',
  confidence: 'candidate', observedAt: '2026-07-15T10:00:00.000Z',
  reviewStatus: 'unreviewed', teacherNote: null,
  reviewedAt: null, reviewUpdatedAt: null,
};

// A confirmed insight
var INS_CONFIRMED = {
  id: 'insight-conv-002-3', studentId: 'student-a', conversationId: 'conv-002',
  sessionId: 'sess-002', source: 'conversation_analysis',
  dimension: '语言表达', indicator: '叙事组织能力',
  signal: '确认的线索', evidenceSnippet: '圆溜溜的眼睛',
  turnLabel: '第2轮', strengthNote: '', topic: '遇见小猫',
  confidence: 'candidate', observedAt: '2026-07-15T10:00:00.000Z',
  reviewStatus: 'teacher_confirmed', teacherNote: '课堂也看到',
  reviewedAt: '2026-07-20T10:00:00.000Z', reviewUpdatedAt: '2026-07-20T10:00:00.000Z',
};

// A rejected insight
var INS_REJECTED = {
  id: 'insight-conv-002-4', studentId: 'student-a', conversationId: 'conv-002',
  sessionId: 'sess-002', source: 'conversation_analysis',
  dimension: '思维方式', indicator: '追问下的应变',
  signal: '被驳回', evidenceSnippet: '被驳回证据',
  turnLabel: '第3轮', strengthNote: '', topic: '遇见小猫',
  confidence: 'candidate', observedAt: '2026-07-15T10:00:00.000Z',
  reviewStatus: 'rejected', teacherNote: '观察不够充分',
  reviewedAt: '2026-07-21T10:00:00.000Z', reviewUpdatedAt: '2026-07-21T10:00:00.000Z',
};

// insight without evidenceSnippet
var INS_NO_EVIDENCE = {
  id: 'insight-conv-001-2', studentId: 'student-a', conversationId: 'conv-001',
  sessionId: 'sess-001', source: 'conversation_analysis',
  dimension: '思维方式', indicator: '价值判断表达',
  signal: '无证据信号', evidenceSnippet: '',
  turnLabel: '第3轮', strengthNote: '', topic: null,
  confidence: 'candidate', observedAt: '2026-07-10T08:00:00.000Z',
  reviewStatus: 'unreviewed', teacherNote: null,
  reviewedAt: null, reviewUpdatedAt: null,
};

// ============================================================
//  A. range
// ============================================================

describe('A. range', function () {

  it('1. 7d 合法', function () {
    var r = adapter.validateReportRange('7d');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value, '7d');
  });

  it('2. 30d 合法', function () {
    var r = adapter.validateReportRange('30d');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value, '30d');
  });

  it('3. all 合法', function () {
    var r = adapter.validateReportRange('all');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value, 'all');
  });

  it('4. 非法 range 返回 INVALID_REPORT_RANGE', function () {
    var r = adapter.validateReportRange('60d');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REPORT_RANGE');
    assert.strictEqual(r.value, null);
  });

  it('5. null 不静默降级', function () {
    var r = adapter.validateReportRange(null);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REPORT_RANGE');
  });

  it('6. now 非法返回 INVALID_REPORT_NOW', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [], insights: [],
      range: 'all', now: 'not a number',
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REPORT_NOW');
  });

  it('7. 7d 边界包含', function () {
    var now = Date.parse('2026-07-24T12:00:00.000Z');
    var cutoff = now - 7 * 24 * 60 * 60 * 1000;
    // conv-003 startTime=2026-07-18, 7d cutoff=2026-07-17
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_3], insights: [],
      range: '7d', now: now,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.report.coverage.includedConversationCount, 1);
  });

  it('8. 30d 边界包含', function () {
    var now = Date.parse('2026-07-24T12:00:00.000Z');
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2, CONV_3], insights: [],
      range: '30d', now: now,
    });
    assert.strictEqual(r.ok, true);
    // conv-001 2026-07-10 >= 2026-06-24 → included
    assert.strictEqual(r.report.coverage.includedConversationCount, 3);
  });

  it('9. 未来日期排除', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_FUTURE], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.report.coverage.includedConversationCount, 0);
    assert.strictEqual(r.report.coverage.excludedInvalidDateCount, 1);
  });

  it('10. 非法日期处理 — 无 startTime 排除', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_NO_START], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.report.coverage.includedConversationCount, 0);
    assert.strictEqual(r.report.coverage.excludedInvalidDateCount, 1);
  });

  it('11. all 包含非法日期对话，excludedInvalidDateCount 统计日期无效条目', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_NO_START], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.ok, true);
    // all mode includes both, even the one with invalid date
    assert.strictEqual(r.report.coverage.includedConversationCount, 2);
    // excludedInvalidDateCount reflects the one with invalid date
    assert.strictEqual(r.report.coverage.excludedInvalidDateCount, 1);
    // firstSeen only from the one with valid date
    assert.strictEqual(r.report.summary.firstSeen, '2026-07-10T08:00:00.000Z');
    assert.strictEqual(r.report.summary.lastActive, '2026-07-10T08:00:00.000Z');
    // totalConversationCount = 2
    assert.strictEqual(r.report.coverage.totalConversationCount, 2);
  });

  it('11b. all conversationCount 包含非法日期对话', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_NO_START], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.report.summary.conversationCount, 1);
  });

  it('11c. all totalTurns 包含非法日期对话的合法 turnCount', function () {
    var convWithTurn = JSON.parse(JSON.stringify(CONV_NO_START));
    convWithTurn.turnCount = 5;
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [convWithTurn], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.summary.totalTurns, 5);
  });

  it('11d. all firstSeen 忽略非法日期', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_NO_START], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.summary.firstSeen, null);
  });

  it('11e. all lastActive 忽略非法日期', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_NO_START], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.summary.lastActive, '2026-07-10T08:00:00.000Z');
  });

  it('11f. all includedConversationCount 包含非法日期对话', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_NO_START], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedConversationCount, 1);
  });

  it('11g. all 纳入非法日期 conversation 对应 insight', function () {
    var orphanIns = JSON.parse(JSON.stringify(INS_1));
    orphanIns.conversationId = 'conv-bad'; // matches CONV_NO_START.id
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_NO_START], insights: [orphanIns],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedInsightCount, 1);
  });
});

// ============================================================
//  B. conversation 和 insight 过滤
// ============================================================

describe('B. conversation 和 insight 过滤', function () {

  it('12. 范围外对话排除', function () {
    var now = Date.parse('2026-07-24T12:00:00.000Z');
    // 7d: only conv-003 (2026-07-18) qualifies
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2, CONV_3], insights: [],
      range: '7d', now: now,
    });
    assert.strictEqual(r.report.coverage.includedConversationCount, 1);
    assert.strictEqual(r.report.coverage.excludedByRangeCount, 2);
  });

  it('13. Insight 通过 conversationId 集合过滤', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1],
      insights: [INS_1, INS_2, INS_3, INS_4, INS_5],
      range: '30d', now: NOW_MS,
    });
    // only conv-001 included → only INS_1, INS_2 (conv-001) included
    assert.strictEqual(r.report.coverage.includedInsightCount, 2);
  });

  it('14. observedAt 合法但 conversation 不在范围时排除', function () {
    var now = Date.parse('2026-07-24T12:00:00.000Z');
    // 7d: conv-001 (July 10) excluded → INS_1 excluded even though observedAt looks fine
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1], insights: [INS_1],
      range: '7d', now: now,
    });
    assert.strictEqual(r.report.coverage.includedConversationCount, 0);
    assert.strictEqual(r.report.coverage.includedInsightCount, 0);
  });

  it('15. observedAt 非法但 conversation 在范围时仍可纳入', function () {
    var badInsight = JSON.parse(JSON.stringify(INS_1));
    badInsight.observedAt = null;
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [badInsight], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedInsightCount, 1);
  });

  it('16. orphan insight — conversationId 不在 includedConvs 中排除', function () {
    var orphan = JSON.parse(JSON.stringify(INS_1));
    orphan.conversationId = 'conv-orphan';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [orphan], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedInsightCount, 0);
  });

  it('17. 空 conversationId 安全排除', function () {
    var empty = JSON.parse(JSON.stringify(INS_1));
    empty.conversationId = '';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [empty], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedInsightCount, 0);
  });

  it('17b. 7d 排除非法日期 conversation', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_NO_START], insights: [],
      range: '7d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedConversationCount, 0);
    assert.strictEqual(r.report.coverage.excludedInvalidDateCount, 1);
  });

  it('17c. 7d 排除非法日期 conversation 对应 insight', function () {
    var badIns = JSON.parse(JSON.stringify(INS_1));
    badIns.conversationId = 'conv-bad'; // CONV_NO_START
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_NO_START], insights: [badIns],
      range: '7d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedInsightCount, 0);
  });

  it('17d. 30d 排除非法日期 conversation', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_NO_START], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedConversationCount, 0);
    assert.strictEqual(r.report.coverage.excludedInvalidDateCount, 1);
  });

  it('17e. 未来日期在 7d 中排除', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_FUTURE], insights: [],
      range: '7d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedConversationCount, 0);
    assert.strictEqual(r.report.coverage.excludedInvalidDateCount, 1);
  });

  it('17f. 未来日期在 30d 中排除', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_FUTURE], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.includedConversationCount, 0);
    assert.strictEqual(r.report.coverage.excludedInvalidDateCount, 1);
  });
});

// ============================================================
//  C. coverage 和 summary
// ============================================================

describe('C. coverage 和 summary', function () {

  it('18. coverage 正确', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2, CONV_3],
      insights: [INS_1, INS_2, INS_3, INS_4, INS_5],
      range: '30d', now: NOW_MS,
    });
    var c = r.report.coverage;
    assert.strictEqual(c.totalConversationCount, 3);
    assert.strictEqual(c.includedConversationCount, 3);
    assert.strictEqual(c.conversationsWithAnalysis, 2);
    assert.strictEqual(c.conversationsWithoutAnalysis, 1); // CONV_3
  });

  it('19. analysis 缺失计数', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_3], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.conversationsWithAnalysis, 0);
    assert.strictEqual(r.report.coverage.conversationsWithoutAnalysis, 1);
  });

  it('20. topic 缺失计数', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_3], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.conversationsWithoutTopic, 1);
  });

  it('21. evidence 缺失计数', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [INS_NO_EVIDENCE], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.insightsWithoutEvidence, 1);
    assert.strictEqual(r.report.coverage.insightsWithEvidence, 0);
  });

  it('22. conversationCount', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2], insights: [INS_1, INS_2, INS_3],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.summary.conversationCount, 2);
  });

  it('23. totalTurns — 只累加合法数字', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.summary.totalTurns, 7); // 4+3
  });

  it('24. firstSeen/lastActive', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.summary.firstSeen, '2026-07-10T08:00:00.000Z');
    assert.strictEqual(r.report.summary.lastActive, '2026-07-15T10:00:00.000Z');
  });

  it('25. review 三状态计数', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_CONFIRMED, INS_REJECTED],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.summary.confirmedCount, 1);
    assert.strictEqual(r.report.summary.rejectedCount, 1);
    assert.strictEqual(r.report.summary.unreviewedCount, 1);
  });

  it('26. 未知 reviewStatus 进入 unreviewed', function () {
    var unknown = JSON.parse(JSON.stringify(INS_1));
    unknown.reviewStatus = 'weird_status';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [unknown], range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.summary.unreviewedCount, 1);
    assert.strictEqual(r.report.summary.confirmedCount, 0);
  });

  it('27. dimensionCount 排除 rejected', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_2, INS_REJECTED],
      range: '30d', now: NOW_MS,
    });
    // INS_1: 兴趣方向, INS_2: 语言表达, INS_REJECTED: 思维方式 (rejected, excluded)
    assert.strictEqual(r.report.summary.dimensionCount, 2);
  });

  it('28. indicatorCount 排除 rejected', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_2, INS_REJECTED],
      range: '30d', now: NOW_MS,
    });
    // non-rejected indicators: 主动话题倾向, 叙事组织能力
    assert.strictEqual(r.report.summary.indicatorCount, 2);
  });
});

// ============================================================
//  D. topics
// ============================================================

describe('D. topics', function () {

  it('29. 只来自 activeTopic', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2], insights: [],
      range: '30d', now: NOW_MS,
    });
    var topicNames = r.report.topics.map(function (t) { return t.topic; });
    assert.deepStrictEqual(topicNames, ['篮球', '遇见小猫']);
  });

  it('30. 不从 preview 猜测', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1], insights: [],
      range: '30d', now: NOW_MS,
    });
    // Only '篮球' from activeTopic, not from preview/messages
    assert.strictEqual(r.report.topics.length, 1);
    assert.strictEqual(r.report.topics[0].topic, '篮球');
  });

  it('31. 次数统计 — 同话题多次出现', function () {
    // Two conversations both about 篮球
    var convA = JSON.parse(JSON.stringify(CONV_1));
    var convB = JSON.parse(JSON.stringify(CONV_1));
    convB.id = 'conv-004'; convB.startTime = '2026-07-20T08:00:00.000Z';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [convA, convB], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.topics[0].count, 2);
  });

  it('32. 同次数首次出现排序', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2], insights: [],
      range: '30d', now: NOW_MS,
    });
    // conv-001 (篮球) before conv-002 (遇见小猫)
    assert.strictEqual(r.report.topics[0].topic, '篮球');
    assert.strictEqual(r.report.topics[1].topic, '遇见小猫');
  });

  it('33. 空话题过滤', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_3], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.topics.length, 0);
  });

  it('34. 同 conversation 只计一次', function () {
    // CONV_1 has activeTopic '篮球' — should only count once
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_1], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.topics.length, 1);
    assert.strictEqual(r.report.topics[0].count, 1);
  });
});

// ============================================================
//  E. dimensions
// ============================================================

describe('E. dimensions', function () {

  it('35. rejected 不参与 dimensions', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_REJECTED],
      range: '30d', now: NOW_MS,
    });
    var dimNames = r.report.dimensions.map(function (d) { return d.dimension; });
    assert.ok(dimNames.indexOf('思维方式') < 0);
  });

  it('36. dimension 统计正确', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_2, INS_3, INS_4, INS_5],
      range: '30d', now: NOW_MS,
    });
    // 兴趣方向: INS_1 + INS_4 = 2, 语言表达: INS_2 + INS_3 = 2, 内省倾向: INS_5 = 1
    assert.strictEqual(r.report.dimensions.length, 3);
  });

  it('37. indicator 统计', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_2, INS_3],
      range: '30d', now: NOW_MS,
    });
    var langDim = r.report.dimensions.find(function (d) { return d.dimension === '语言表达'; });
    assert.ok(langDim);
    assert.strictEqual(langDim.indicators.length, 2); // 叙事组织能力 + 词汇丰富度
  });

  it('38. indicator 缺失安全 — 计入 dim.count 但不进入 indicators', function () {
    var noInd = JSON.parse(JSON.stringify(INS_1));
    noInd.indicator = '';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [noInd], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.dimensions.length, 1);
    assert.strictEqual(r.report.dimensions[0].count, 1);
    assert.strictEqual(r.report.dimensions[0].indicators.length, 0);
  });

  it('39. distinctConversationCount', function () {
    // 兴趣方向: INS_1(conv-001) + INS_4(conv-002) = 2 distinct convs
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4],
      range: '30d', now: NOW_MS,
    });
    var dim = r.report.dimensions.find(function (d) { return d.dimension === '兴趣方向'; });
    assert.strictEqual(dim.distinctConversationCount, 2);
  });

  it('40. indicator distinctConversationCount', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4], // same indicator across 2 convs
      range: '30d', now: NOW_MS,
    });
    var dim = r.report.dimensions.find(function (d) { return d.dimension === '兴趣方向'; });
    var ind = dim.indicators.find(function (i) { return i.indicator === '主动话题倾向'; });
    assert.strictEqual(ind.distinctConversationCount, 2);
  });
});

// ============================================================
//  F. recurringSignals
// ============================================================

describe('F. recurringSignals', function () {

  it('41. dimension+indicator 归并', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4], // same dim+ind, different convs
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.recurringSignals.length, 1);
    assert.strictEqual(r.report.recurringSignals[0].dimension, '兴趣方向');
    assert.strictEqual(r.report.recurringSignals[0].indicator, '主动话题倾向');
  });

  it('42. dimension 相同 indicator 不同不合并', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_2, INS_3], // both 语言表达 but different indicators
      range: '30d', now: NOW_MS,
    });
    // 叙事组织能力 in conv-001, 词汇丰富度 in conv-002 — each appears separately
    assert.strictEqual(r.report.recurringSignals.length, 2);
  });

  it('43. indicator 相同 dimension 不同不合并', function () {
    // e.g. 兴趣方向/主动话题倾向 vs 思维方式/主动话题倾向
    var fake = JSON.parse(JSON.stringify(INS_1));
    fake.dimension = '思维方式'; fake.conversationId = 'conv-002';
    var base = JSON.parse(JSON.stringify(INS_1)); // 兴趣方向/conv-001
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2],
      insights: [base, fake], range: '30d', now: NOW_MS,
    });
    // Different dimensions → each appears separately
    assert.strictEqual(r.report.recurringSignals.length, 2);
  });

  it('44. dimension 或 indicator 为空不归并', function () {
    var noDim = JSON.parse(JSON.stringify(INS_1));
    noDim.dimension = '';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2],
      insights: [INS_1, noDim], range: '30d', now: NOW_MS,
    });
    // noDim excluded, INS_1 (兴趣方向/conv-001) still appears
    assert.strictEqual(r.report.recurringSignals.length, 1);
    assert.strictEqual(r.report.recurringSignals[0].dimension, '兴趣方向');
  });

  it('45. 同 conversation 多 hit 合并为一个 signal', function () {
    // INS_1 and another insight with same dim+ind both in conv-001
    var clone = JSON.parse(JSON.stringify(INS_1));
    clone.id = 'insight-conv-001-x';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [INS_1, clone], range: '30d', now: NOW_MS,
    });
    // merged into 1 signal (same dim+ind, same conv) with occurrenceCount = 2
    assert.strictEqual(r.report.recurringSignals.length, 1);
    assert.strictEqual(r.report.recurringSignals[0].occurrenceCount, 2);
  });

  it('46. 两个不同 conversation → multiple_conversations', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.recurringSignals[0].status, 'multiple_conversations');
  });

  it('47. rejected 不参与 recurringSignals', function () {
    // INS_1 in conv-001 (unreviewed) + INS_REJECTED in conv-002 also '思维方式', but rejected
    // Actually INS_REJECTED is 思维方式, not matching INS_1's 兴趣方向. Let's use a better case:
    // Create a rejected insight with same dim+ind as INS_4
    var rejSame = JSON.parse(JSON.stringify(INS_REJECTED));
    rejSame.dimension = '兴趣方向'; rejSame.indicator = '主动话题倾向';
    rejSame.conversationId = 'conv-002'; rejSame.reviewStatus = 'rejected';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2],
      insights: [INS_1, rejSame], range: '30d', now: NOW_MS,
    });
    // only INS_1 (unreviewed, conv-001) counts; rejected excluded
    assert.strictEqual(r.report.recurringSignals.length, 1);
    assert.strictEqual(r.report.recurringSignals[0].occurrenceCount, 1);
    assert.strictEqual(r.report.recurringSignals[0].distinctConversationCount, 1);
  });

  it('48. confirmed + unreviewed 可参与', function () {
    // INS_1 (unreviewed) in conv-001 + confirmed in conv-002 with same dim+ind
    var conf = JSON.parse(JSON.stringify(INS_4));
    conf.reviewStatus = 'teacher_confirmed';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2],
      insights: [INS_1, conf], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.recurringSignals.length, 1);
    assert.strictEqual(r.report.recurringSignals[0].confirmedOccurrenceCount, 1);
    assert.strictEqual(r.report.recurringSignals[0].unreviewedOccurrenceCount, 1);
    assert.strictEqual(r.report.recurringSignals[0].occurrenceCount, 2);
  });

  it('49. occurrenceCount 正确', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4], // 2 occurrences of same dim+ind
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.recurringSignals[0].occurrenceCount, 2);
  });

  it('50. distinctConversationCount 正确', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.recurringSignals[0].distinctConversationCount, 2);
  });

  it('51. evidence 保留顺序', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4],
      range: '30d', now: NOW_MS,
    });
    var ev = r.report.recurringSignals[0].evidence;
    assert.strictEqual(ev.length, 2);
    assert.strictEqual(ev[0].insightId, 'insight-conv-001-0');
    assert.strictEqual(ev[1].insightId, 'insight-conv-002-1');
  });

  it('52. evidenceSnippet 不伪造', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1], insights: [INS_NO_EVIDENCE],
      range: '30d', now: NOW_MS,
    });
    // INS_NO_EVIDENCE has empty evidenceSnippet, dimension+indicator still valid → appears
    assert.strictEqual(r.report.recurringSignals.length, 1);
    assert.strictEqual(r.report.recurringSignals[0].evidence.length, 1);
    assert.strictEqual(r.report.recurringSignals[0].evidence[0].evidenceSnippet, '');
  });

  it('53. signal 不重写 — 保留原始文本', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4],
      range: '30d', now: NOW_MS,
    });
    var signals = r.report.recurringSignals[0].evidence.map(function (e) { return e.signal; });
    assert.deepStrictEqual(signals, ['学生主动引出运动话题', '主动引出关爱动物话题']);
  });

  it('54. topics 去重', function () {
    // INS_1 topic=篮球, INS_4 topic=遇见小猫
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_4],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.recurringSignals[0].topics.length, 2);
  });

  it('55. 不生成 supported', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_2, INS_3, INS_4, INS_5],
      range: '30d', now: NOW_MS,
    });
    var json = JSON.stringify(r.report);
    assert.strictEqual(json.indexOf('supported'), -1);
  });

  it('55b. 单次 conversation 也进入 recurringSignals', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_2, INS_3, INS_4, INS_5],
      range: '30d', now: NOW_MS,
    });
    // INS_5 (内省倾向) only in conv-002 — now included
    var neiSheng = r.report.recurringSignals.find(function (s) { return s.dimension === '内省倾向'; });
    assert.ok(neiSheng);
    assert.strictEqual(neiSheng.distinctConversationCount, 1);
    assert.strictEqual(neiSheng.status, 'single_conversation');
  });
});

// ============================================================
//  G. 分类和含义
// ============================================================

describe('G. 分类和含义', function () {

  it('56. confirmedInsights 正确', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_2],
      insights: [INS_CONFIRMED, INS_REJECTED], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.confirmedInsights.length, 1);
    assert.strictEqual(r.report.confirmedInsights[0].reviewStatus, 'teacher_confirmed');
  });

  it('57. candidateInsights 正确', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [INS_1], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.candidateInsights.length, 1);
    assert.strictEqual(r.report.candidateInsights[0].reviewStatus, 'unreviewed');
  });

  it('58. rejectedInsights 正确', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_2],
      insights: [INS_REJECTED], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.rejectedInsights.length, 1);
    assert.strictEqual(r.report.rejectedInsights[0].reviewStatus, 'rejected');
  });

  it('59. teacher_confirmed 不改变 confidence', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_2],
      insights: [INS_CONFIRMED], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.confirmedInsights[0].confidence, 'candidate');
  });

  it('60. rejected 保留原始证据', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_2],
      insights: [INS_REJECTED], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.rejectedInsights[0].evidenceSnippet, '被驳回证据');
  });

  it('61. 未知状态进入 candidate', function () {
    var unknown = JSON.parse(JSON.stringify(INS_1));
    unknown.reviewStatus = 'unknown-state';
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [unknown], range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.candidateInsights.length, 1);
  });
});

// ============================================================
//  H. engagement
// ============================================================

describe('H. engagement', function () {

  it('62. high/medium/low 正确统计', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2, CONV_3],
      insights: [], range: '30d', now: NOW_MS,
    });
    // CONV_1: high, CONV_2: high, CONV_3: low
    assert.strictEqual(r.report.engagement.high, 2);
    assert.strictEqual(r.report.engagement.low, 1);
  });

  it('63. 未知进入 unknown', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_NO_START], // no engagement value, included in 'all'
      insights: [], range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.engagement.unknown, 1);
  });

  it('64. 只统计范围内 conversations', function () {
    var now = Date.parse('2026-07-24T12:00:00.000Z');
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT,
      conversations: [CONV_1, CONV_2, CONV_3],
      insights: [], range: '7d', now: now,
    });
    // Only CONV_3 (low) is within 7d
    assert.strictEqual(r.report.engagement.low, 1);
    assert.strictEqual(r.report.engagement.high, 0);
  });
});

// ============================================================
//  I. narrative 和 limitations
// ============================================================

describe('I. narrative 和 limitations', function () {

  it('65. 空报告不产生幻觉', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.narrativeSummary, '该时间范围内没有可纳入报告的对话记录。');
  });

  it('66. 有话题时才输出话题句', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [INS_1], range: '30d', now: NOW_MS,
    });
    assert.ok(r.report.narrativeSummary.indexOf('篮球') >= 0);
  });

  it('67. 无话题时不输出话题句', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_3],
      insights: [], range: '30d', now: NOW_MS,
    });
    assert.ok(r.report.narrativeSummary.indexOf('话题') < 0 || r.report.narrativeSummary.indexOf('话题') === -1);
  });

  it('68. confirmed=0 不声称确认', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [INS_1], range: '30d', now: NOW_MS,
    });
    assert.ok(r.report.narrativeSummary.indexOf('已被你确认') < 0);
  });

  // ============================================================
  //  K. weakSignal (new)
  // ============================================================

  describe('K. weakSignal', function () {

    it('70. weakSignal 不参与 dimensions', function () {
      var r = adapter.buildTeacherStageReport({
        student: SAFE_STUDENT,
        conversations: [CONV_1, CONV_2],
        insights: [INS_1, INS_WEAK],
        range: '30d', now: NOW_MS,
      });
      // INS_WEAK dimension is 思维方式, should not appear in dimensions
      var dimNames = r.report.dimensions.map(function (d) { return d.dimension; });
      assert.ok(dimNames.indexOf('思维方式') < 0);
    });

    it('71. weakSignal 不参与 recurringSignals', function () {
      // INS_1 + INS_WEAK share same dim+ind: 兴趣方向/主动话题倾向? No, they don't.
      // Let's create a weak signal that shares INS_1's dim+ind
      var weakSame = JSON.parse(JSON.stringify(INS_WEAK));
      weakSame.dimension = '兴趣方向'; weakSame.indicator = '主动话题倾向';
      weakSame.conversationId = 'conv-002';
      var r = adapter.buildTeacherStageReport({
        student: SAFE_STUDENT, conversations: [CONV_1, CONV_2],
        insights: [INS_1, weakSame], range: '30d', now: NOW_MS,
      });
      // Only INS_1 counts in recurringSignals; weakSame excluded
      assert.strictEqual(r.report.recurringSignals.length, 1);
      assert.strictEqual(r.report.recurringSignals[0].occurrenceCount, 1);
    });

    it('72. weakSignals 列表正确', function () {
      var r = adapter.buildTeacherStageReport({
        student: SAFE_STUDENT, conversations: [CONV_2],
        insights: [INS_WEAK], range: '30d', now: NOW_MS,
      });
      assert.strictEqual(r.report.weakSignals.length, 1);
      assert.strictEqual(r.report.weakSignals[0].isWeakSignal, true);
      assert.strictEqual(r.report.weakSignals[0].signal, '弱信号线索');
    });

    it('73. weakSignal 仍然计入 coverage', function () {
      var r = adapter.buildTeacherStageReport({
        student: SAFE_STUDENT, conversations: [CONV_2],
        insights: [INS_WEAK], range: '30d', now: NOW_MS,
      });
      // weakSignal still counts in insight count (includedInsightCount)
      assert.strictEqual(r.report.coverage.includedInsightCount, 1);
      assert.strictEqual(r.report.summary.insightCount, 1);
      assert.strictEqual(r.report.summary.weakSignalCount, 1);
    });

    it('74. weakSignal 不参与 indicator 统计', function () {
      var r = adapter.buildTeacherStageReport({
        student: SAFE_STUDENT, conversations: [CONV_2],
        insights: [INS_WEAK], range: '30d', now: NOW_MS,
      });
      // weakSignal excluded from dimension/indicator counts
      assert.strictEqual(r.report.summary.dimensionCount, 0);
      assert.strictEqual(r.report.summary.indicatorCount, 0);
    });

  });

    it('69. rejected=0 不声称驳回', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [INS_1], range: '30d', now: NOW_MS,
    });
    assert.ok(r.report.narrativeSummary.indexOf('不准确') < 0);
  });

  it('69b. 不包含禁止词汇 — 擅长', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_2, INS_3, INS_4, INS_5], range: '30d', now: NOW_MS,
    });
    assert.ok(r.report.narrativeSummary.indexOf('擅长') < 0);
  });

  it('70. analysis 缺失时生成 limitation', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_3], insights: [],
      range: '30d', now: NOW_MS,
    });
    var hasAnalysisLimitation = r.report.limitations.some(function (l) { return l.indexOf('分析结果') >= 0; });
    assert.ok(hasAnalysisLimitation);
  });

  it('71. topic 缺失时生成 limitation', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_3], insights: [],
      range: '30d', now: NOW_MS,
    });
    var hasTopicLim = r.report.limitations.some(function (l) { return l.indexOf('话题') >= 0; });
    assert.ok(hasTopicLim);
  });

  it('72. evidence 缺失时生成 limitation', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [INS_NO_EVIDENCE], range: '30d', now: NOW_MS,
    });
    var hasEvLim = r.report.limitations.some(function (l) { return l.indexOf('证据') >= 0; });
    assert.ok(hasEvLim);
  });

  it('73. 固定免责声明存在', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1],
      insights: [INS_1], range: '30d', now: NOW_MS,
    });
    var hasDisclaimer = r.report.limitations.some(function (l) { return l.indexOf('不构成正式诊断') >= 0; });
    assert.ok(hasDisclaimer);
    var hasTopicDisclaimer = r.report.limitations.some(function (l) { return l.indexOf('兴趣话题不等同于能力') >= 0; });
    assert.ok(hasTopicDisclaimer);
  });
});

// ============================================================
//  J. 安全和不可变性
// ============================================================

describe('J. 安全和不可变性', function () {

  it('74. null 输入安全', function () {
    var r = adapter.buildTeacherStageReport(null);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_INPUT');
    assert.strictEqual(r.report, null);
  });

  it('75. Object.create(null) 输入安全', function () {
    var input = Object.create(null);
    input.student = SAFE_STUDENT;
    input.conversations = [CONV_1];
    input.insights = [INS_1];
    input.range = 'all';
    input.now = NOW_MS;
    var r = adapter.buildTeacherStageReport(input);
    assert.strictEqual(r.ok, true);
  });

  it('76. 不修改 student', function () {
    var student = JSON.parse(JSON.stringify(SAFE_STUDENT));
    var before = JSON.stringify(student);
    adapter.buildTeacherStageReport({
      student: student, conversations: [CONV_1], insights: [INS_1],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(JSON.stringify(student), before);
  });

  it('77. 不修改 conversations', function () {
    var convs = [JSON.parse(JSON.stringify(CONV_1))];
    var before = JSON.stringify(convs);
    adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: convs, insights: [INS_1],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(JSON.stringify(convs), before);
  });

  it('78. 不修改 insights', function () {
    var inss = [JSON.parse(JSON.stringify(INS_1))];
    var before = JSON.stringify(inss);
    adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1], insights: inss,
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(JSON.stringify(inss), before);
  });

  it('79. 相同输入相同输出', function () {
    var args = {
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2],
      insights: [INS_1, INS_2, INS_3, INS_4, INS_5],
      range: '30d', now: NOW_MS,
    };
    var r1 = adapter.buildTeacherStageReport(args);
    var r2 = adapter.buildTeacherStageReport(args);
    assert.deepStrictEqual(r1, r2);
  });

  it('80. 不返回原始 conversations', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual('conversations' in r.report, false);
  });

  it('81. 不返回 teacherId', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1], insights: [INS_1],
      range: '30d', now: NOW_MS,
    });
    var json = JSON.stringify(r.report);
    assert.ok(json.indexOf('teacherId') < 0);
  });

  it('82. 不返回 review record id', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1, CONV_2],
      insights: [INS_CONFIRMED], range: '30d', now: NOW_MS,
    });
    var json = JSON.stringify(r.report);
    assert.ok(json.indexOf('"review-') < 0);
  });

  it('range 非法时返回错误不抛异常', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1], insights: [],
      range: '60d', now: NOW_MS,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REPORT_RANGE');
  });

  it('conversations 非数组安全', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: 'not-array', insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.report.coverage.includedConversationCount, 0);
  });

  it('insights 非数组安全', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_1], insights: null,
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.ok, true);
  });

  it('period all 无合法日期时 fromDate/toDate 为 null', function () {
    var conv = JSON.parse(JSON.stringify(CONV_NO_START));
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [conv], insights: [],
      range: 'all', now: NOW_MS,
    });
    assert.strictEqual(r.report.period.fromDate, null);
    assert.strictEqual(r.report.period.toDate, null);
  });

  it('conversationsWithoutTopic 正确', function () {
    var r = adapter.buildTeacherStageReport({
      student: SAFE_STUDENT, conversations: [CONV_3], insights: [],
      range: '30d', now: NOW_MS,
    });
    assert.strictEqual(r.report.coverage.conversationsWithoutTopic, 1);
    assert.strictEqual(r.report.coverage.conversationsWithTopic, 0);
  });
});
