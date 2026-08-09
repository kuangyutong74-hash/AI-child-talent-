/**
 * test/teacher-data-adapter.test.js — 教师端安全数据适配器测试
 *
 * 覆盖：
 *   A. 输入安全
 *   B. 权限
 *   C. 学生安全信息
 *   D. roster
 *   E. 消息过滤
 *   F. analysis
 *   G. conversationState
 *   H. insights
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

var adapter = require('../lib/teacher/teacher-data-adapter');

// ============================================================
//  共享测试 fixture
// ============================================================

var STUDENT_A = {
  id: 'student-a',
  username: '小明',
  passwordHash: '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  role: 'student',
  studentCode: '123456',
  createdAt: '2026-07-01T00:00:00.000Z',
};

var STUDENT_B = {
  id: 'student-b',
  username: '小红',
  passwordHash: '$2b$10$yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
  role: 'student',
  studentCode: 789012,
  createdAt: '2026-07-02T00:00:00.000Z',
};

var STUDENT_NO_CODE = {
  id: 'student-c',
  username: '小刚',
  passwordHash: '$2b$10$zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  role: 'student',
  createdAt: '2026-07-03T00:00:00.000Z',
};

var TEACHER_A = {
  id: 'teacher-a',
  username: '张老师',
  passwordHash: '$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  role: 'teacher',
  createdAt: '2026-07-01T00:00:00.000Z',
};

var BINDINGS_AB = {
  'teacher-a': ['student-a', 'student-b'],
};

var BINDINGS_PROTO_SAFE = Object.create(null);
BINDINGS_PROTO_SAFE['teacher-a'] = ['student-a'];

var HISTORY_ENTRY_1 = {
  id: 'conv-001',
  userId: 'student-a',
  sessionId: 'sess-001',
  startTime: '2026-07-10T08:00:00.000Z',
  turnCount: 4,
  completed: true,
  weather: 'sunny',
  messages: [
    { role: 'user', content: '今天体育课打篮球了', _ts: 1000000, topicSource: 'normal' },
    { role: 'assistant', content: '哇，打篮球好呀！' },
    { role: 'user', content: '我投了三分球', latencyMs: 1200 },
    { role: 'assistant', content: '三分球太厉害了！' },
  ],
  analysis: {
    status: 'done',
    result: {
      '分析范围': '第1-2轮',
      '命中指标': [
        {
          '维度': '兴趣方向',
          '指标': '主动话题倾向',
          '证据片段': '今天体育课打篮球了',
          '说话轮次': '第1轮',
          '信号说明': '学生主动引出运动话题',
          '强度备注': '',
        },
        {
          '维度': '语言表达',
          '指标': '叙事组织能力',
          '证据片段': '我投了三分球',
          '说话轮次': '第2轮',
          '信号说明': '描述了事件结果',
          '强度备注': '仅有结果，缺少经过环节',
        },
      ],
      '未命中指标': ['自我反思频率', '价值判断表达'],
      '安全提示': false,
      '安全提示说明': '',
    },
  },
};

var HISTORY_ENTRY_2 = {
  id: 'conv-002',
  userId: 'student-a',
  sessionId: 'sess-002',
  startTime: '2026-07-15T10:00:00.000Z',
  turnCount: 3,
  completed: true,
  weather: 'cloudy',
  messages: [
    { role: 'user', content: '今天和小明在回家路上遇见了一只可爱的小猫，特别可爱' },
    { role: 'assistant', content: '小猫长什么样呀？' },
    { role: 'user', content: '是一只狸花猫，圆溜溜的眼睛' },
  ],
  analysis: {
    status: 'done',
    result: {
      '分析范围': '第1-2轮',
      '命中指标': [
        {
          '维度': '语言表达',
          '指标': '词汇丰富度与用词选择',
          '证据片段': '圆溜溜的眼睛',
          '说话轮次': '第2轮',
          '信号说明': '使用了形象修饰词',
          '强度备注': '',
        },
        {
          '维度': '兴趣方向',
          '指标': '主动话题倾向',
          '证据片段': '今天和小明在回家路上遇见了一只可爱的小猫',
          '说话轮次': '第1轮',
          '信号说明': '学生主动引出关爱动物话题',
          '强度备注': '',
        },
        {
          '维度': '内省倾向',
          '指标': '自我反思频率',
          '证据片段': '特别可爱',
          '说话轮次': '第1轮',
          '信号说明': '表达了情感感受',
          '强度备注': '仅有笼统情绪词，命中但较浅',
        },
      ],
      '未命中指标': [],
      '安全提示': false,
      '安全提示说明': '',
    },
  },
  conversationState: {
    turn_index: 2,
    stage: 'interest',
    question_budget: 1,
    active_topic: '遇见小猫',
    engagement: 'high',
    observation_focus: 'vocabulary_choice',
    known_facts: [
      { key: 'pet', value: '小猫', confidence: 'explicit', source_quote: '遇见了一只可爱的小猫' },
      { key: 'location', value: '回家路上', confidence: 'explicit', source_quote: '在回家路上' },
    ],
    previous_assistant_asked: true,
    consecutive_short_replies: 0,
    open_task_completed: false,
    open_task_used: false,
    student_refused_topic: false,
    focus_history: ['vocabulary_choice'],
    used_focuses: ['vocabulary_choice'],
  },
};

var HISTORY_ENTRY_INCOMPLETE = {
  id: 'conv-003',
  userId: 'student-a',
  sessionId: 'sess-003',
  startTime: '2026-07-18T12:00:00.000Z',
  turnCount: 2,
  completed: false,
  messages: [
    { role: 'user', content: '今天下雨了' },
    { role: 'assistant', content: '下雨天适合在家看书呢' },
  ],
};

var HISTORY_ENTRY_FAILED_ANALYSIS = {
  id: 'conv-004',
  userId: 'student-a',
  sessionId: 'sess-004',
  startTime: '2026-07-12T09:00:00.000Z',
  turnCount: 3,
  completed: true,
  messages: [
    { role: 'user', content: '我今天心情不好' },
    { role: 'assistant', content: '怎么了，愿意聊聊吗？' },
  ],
  analysis: {
    status: 'failed',
  },
};

var HISTORY_ENTRY_NO_ANALYSIS = {
  id: 'conv-005',
  userId: 'student-a',
  sessionId: 'sess-005',
  startTime: '2026-07-20T14:00:00.000Z',
  turnCount: 2,
  completed: true,
  messages: [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: '你好呀！' },
  ],
};

// 另一学生的条目
var HISTORY_ENTRY_STUDENT_B = {
  id: 'conv-100',
  userId: 'student-b',
  sessionId: 'sess-100',
  startTime: '2026-07-16T08:00:00.000Z',
  turnCount: 5,
  completed: true,
  messages: [
    { role: 'user', content: '我喜欢画画' },
    { role: 'assistant', content: '画什么类型的画呀？' },
  ],
  analysis: {
    status: 'done',
    result: {
      '分析范围': '第1轮',
      '命中指标': [
        {
          '维度': '兴趣方向',
          '指标': '主动话题倾向',
          '证据片段': '我喜欢画画',
          '说话轮次': '第1轮',
          '信号说明': '主动引出艺术兴趣',
          '强度备注': '',
        },
      ],
      '未命中指标': [],
      '安全提示': false,
      '安全提示说明': '',
    },
  },
  conversationState: {
    turn_index: 1,
    stage: 'interest',
    question_budget: 1,
    active_topic: '画画',
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
  },
};

function makeFixture() {
  return {
    users: [STUDENT_A, STUDENT_B, STUDENT_NO_CODE, TEACHER_A],
    bindings: JSON.parse(JSON.stringify(BINDINGS_AB)),
    history: [
      HISTORY_ENTRY_1,
      HISTORY_ENTRY_2,
      HISTORY_ENTRY_INCOMPLETE,
      HISTORY_ENTRY_FAILED_ANALYSIS,
      HISTORY_ENTRY_NO_ANALYSIS,
      HISTORY_ENTRY_STUDENT_B,
    ],
  };
}

// ============================================================
//  A. 输入安全
// ============================================================

describe('A. 输入安全', function () {

  it('1. teacherCanAccessStudent 对 null 不抛异常', function () {
    var result = adapter.teacherCanAccessStudent(null);
    assert.strictEqual(result, false);
  });

  it('1b. teacherCanAccessStudent 对 undefined 不抛异常', function () {
    var result = adapter.teacherCanAccessStudent(undefined);
    assert.strictEqual(result, false);
  });

  it('1c. teacherCanAccessStudent 对数字不抛异常', function () {
    var result = adapter.teacherCanAccessStudent(42);
    assert.strictEqual(result, false);
  });

  it('1d. teacherCanAccessStudent 对字符串不抛异常', function () {
    var result = adapter.teacherCanAccessStudent('hello');
    assert.strictEqual(result, false);
  });

  it('1e. teacherCanAccessStudent 对数组不抛异常', function () {
    var result = adapter.teacherCanAccessStudent([]);
    assert.strictEqual(result, false);
  });

  it('1f. teacherCanAccessStudent 对空对象不抛异常', function () {
    var result = adapter.teacherCanAccessStudent({});
    assert.strictEqual(result, false);
  });

  it('2. Object.create(null) 安全', function () {
    var input = Object.create(null);
    input.teacherId = 'teacher-a';
    input.studentId = 'student-a';
    var bindings = Object.create(null);
    bindings['teacher-a'] = ['student-a'];
    input.bindings = bindings;
    var result = adapter.teacherCanAccessStudent(input);
    assert.strictEqual(result, true);
  });

  it('3. arrays 作为 object 输入安全', function () {
    // bindings 为数组应被拒绝
    var input = {
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: ['teacher-a'],
    };
    var result = adapter.teacherCanAccessStudent(input);
    assert.strictEqual(result, false);
  });

  it('4. buildTeacherRoster 不修改 users', function () {
    var f = makeFixture();
    var usersBefore = JSON.stringify(f.users);
    adapter.buildTeacherRoster({ teacherId: 'teacher-a', users: f.users, bindings: f.bindings, history: f.history });
    var usersAfter = JSON.stringify(f.users);
    assert.strictEqual(usersAfter, usersBefore);
  });

  it('5. buildTeacherRoster 不修改 bindings', function () {
    var f = makeFixture();
    var bindingsBefore = JSON.stringify(f.bindings);
    adapter.buildTeacherRoster({ teacherId: 'teacher-a', users: f.users, bindings: f.bindings, history: f.history });
    var bindingsAfter = JSON.stringify(f.bindings);
    assert.strictEqual(bindingsAfter, bindingsBefore);
  });

  it('6. buildTeacherRoster 不修改 history', function () {
    var f = makeFixture();
    var historyBefore = JSON.stringify(f.history);
    adapter.buildTeacherRoster({ teacherId: 'teacher-a', users: f.users, bindings: f.bindings, history: f.history });
    var historyAfter = JSON.stringify(f.history);
    assert.strictEqual(historyAfter, historyBefore);
  });

  it('所有导出函数对 null 不抛异常', function () {
    assert.doesNotThrow(function () { adapter.buildTeacherRoster(null); });
    assert.doesNotThrow(function () { adapter.buildStudentOverview(null); });
    assert.doesNotThrow(function () { adapter.buildStudentConversationSummaries(null); });
    assert.doesNotThrow(function () { adapter.buildStudentConversationDetail(null); });
    assert.doesNotThrow(function () { adapter.buildStudentInsights(null); });
  });

  it('history 非数组时 buildTeacherRoster 不抛异常', function () {
    var f = makeFixture();
    var result = adapter.buildTeacherRoster({ teacherId: 'teacher-a', users: f.users, bindings: f.bindings, history: 'not an array' });
    assert.strictEqual(Array.isArray(result), true);
  });

  it('users 非数组时 buildTeacherRoster 不抛异常', function () {
    var f = makeFixture();
    var result = adapter.buildTeacherRoster({ teacherId: 'teacher-a', users: 'not array', bindings: f.bindings, history: f.history });
    assert.strictEqual(Array.isArray(result), true);
  });
});

// ============================================================
//  B. 权限
// ============================================================

describe('B. 权限', function () {

  it('7. 正确绑定返回 true', function () {
    var result = adapter.teacherCanAccessStudent({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: BINDINGS_AB,
    });
    assert.strictEqual(result, true);
  });

  it('8. 未绑定返回 false', function () {
    var result = adapter.teacherCanAccessStudent({
      teacherId: 'teacher-a',
      studentId: 'student-nonexistent',
      bindings: BINDINGS_AB,
    });
    assert.strictEqual(result, false);
  });

  it('9. 特殊 key 安全 — __proto__', function () {
    var input = {
      teacherId: '__proto__',
      studentId: 'student-a',
      bindings: BINDINGS_AB,
    };
    var result = adapter.teacherCanAccessStudent(input);
    // __proto__ 不在 bindings 中，应返回 false
    assert.strictEqual(result, false);
  });

  it('9b. 特殊 key 安全 — constructor', function () {
    var result = adapter.teacherCanAccessStudent({
      teacherId: 'constructor',
      studentId: 'student-a',
      bindings: BINDINGS_AB,
    });
    assert.strictEqual(result, false);
  });

  it('10. overview 未绑定返回 NOT_BOUND', function () {
    var f = makeFixture();
    var result = adapter.buildStudentOverview({
      teacherId: 'teacher-a',
      studentId: 'student-nonexistent',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'NOT_BOUND');
    assert.strictEqual(result.student, null);
    assert.strictEqual(result.overview, null);
  });

  it('11. conversation detail 不属于学生时拒绝', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-100', // 属于 student-b，不属于 student-a
      bindings: f.bindings,
      history: f.history,
    });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'CONVERSATION_NOT_FOUND');
    assert.strictEqual(result.conversation, null);
  });

  it('12. 不泄露其他学生历史 — roster 只返回绑定的学生', function () {
    // 只有 teacher-a 绑定了 student-a 和 student-b。
    // 验证返回的 roster 中没有其他学生。
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var ids = roster.map(function (r) { return r.studentId; }).sort();
    assert.deepStrictEqual(ids, ['student-a', 'student-b']);
  });

  it('12b. conversation summaries 不返回其他学生', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationSummaries({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    assert.strictEqual(result.allowed, true);
    for (var i = 0; i < result.conversations.length; i++) {
      // 所有 conversation 应属于 student-a
      var convIds = result.conversations.map(function (c) { return c.id; });
      assert.ok(convIds.indexOf('conv-100') < 0, '不应包含 student-b 的对话');
    }
  });

  it('12c. insights 不返回其他学生', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    assert.strictEqual(result.allowed, true);
    for (var i = 0; i < result.insights.length; i++) {
      assert.strictEqual(result.insights[i].studentId, 'student-a');
    }
  });
});

// ============================================================
//  C. 学生安全信息
// ============================================================

describe('C. 学生安全信息', function () {

  it('13. 不返回 passwordHash', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    for (var i = 0; i < roster.length; i++) {
      assert.strictEqual('passwordHash' in roster[i], false);
      assert.strictEqual('passwordHash' in (roster[i].studentId === 'student-a' ? {} : {}), false);
    }

    // Also check overview
    var ov = adapter.buildStudentOverview({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    if (ov.student) {
      assert.strictEqual('passwordHash' in ov.student, false);
    }
  });

  it('14. teacher 角色不能作为学生', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var ids = roster.map(function (r) { return r.studentId; });
    assert.ok(ids.indexOf('teacher-a') < 0, 'teacher 不应出现在 roster 中');
  });

  it('15. studentCode 数字转字符串', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentB = roster.find(function (r) { return r.studentId === 'student-b'; });
    assert.strictEqual(studentB.studentCode, '789012');
  });

  it('16. 非法 studentCode 返回 null', function () {
    // STUDENT_NO_CODE has no studentCode field, and is not in default bindings.
    // Build a separate binding that includes student-c.
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: [STUDENT_NO_CODE],
      bindings: { 'teacher-a': ['student-c'] },
      history: [],
    });
    var studentC = roster.find(function (r) { return r.studentId === 'student-c'; });
    assert.strictEqual(studentC.studentCode, null);
  });

  it('17. 重复绑定去重', function () {
    var bindingsWithDup = { 'teacher-a': ['student-a', 'student-a', 'student-b'] };
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: [STUDENT_A, STUDENT_B],
      bindings: bindingsWithDup,
      history: [],
    });
    assert.strictEqual(roster.length, 2);
  });

  it('student 对象只包含 id, username, studentCode', function () {
    var f = makeFixture();
    var ov = adapter.buildStudentOverview({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var keys = Object.keys(ov.student).sort();
    assert.deepStrictEqual(keys, ['id', 'studentCode', 'username']);
  });
});

// ============================================================
//  D. roster
// ============================================================

describe('D. roster', function () {

  it('18. totalConversations 正确', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    // completed: conv-001, conv-002, conv-004, conv-005 = 4
    // incomplete: conv-003 = not counted
    assert.strictEqual(studentA.totalConversations, 4);
  });

  it('19. completed=false 不计入 totalConversations', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    // conv-003 is completed=false
    assert.strictEqual(studentA.totalConversations, 4); // 4 completed, not 5
  });

  it('20. lastActiveDate 取最新合法 startTime', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    // 最新的完成条目：conv-005 (2026-07-20), 还有 conv-003 (2026-07-18, incomplete)
    // lastActiveDate 应取最新合法 startTime
    assert.strictEqual(studentA.lastActiveDate, '2026-07-20T14:00:00.000Z');
  });

  it('21. 无历史返回 null', function () {
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: [STUDENT_A],
      bindings: { 'teacher-a': ['student-a'] },
      history: [],
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    assert.strictEqual(studentA.lastActiveDate, null);
    assert.strictEqual(studentA.totalConversations, 0);
    assert.strictEqual(studentA.insightCount, 0);
  });

  it('22. insightCount 正确', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    // conv-001: 2 hits, conv-002: 3 hits = 5 total (conv-004 analysis failed, conv-005 no analysis)
    assert.strictEqual(studentA.insightCount, 5);
  });

  it('23. recentInsightCount7d 正确', function () {
    var f = makeFixture();
    var now = Date.parse('2026-07-22T00:00:00.000Z');
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
      now: now,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    // 7 days before 2026-07-22 = 2026-07-15
    // conv-001: 2026-07-10 (< cutoff, excluded)
    // conv-002: 2026-07-15 (>= cutoff, 3 hits)
    // conv-003: 2026-07-18 (>= cutoff, incomplete, no analysis hits)
    // conv-004: 2026-07-12 (< cutoff, excluded)
    // conv-005: 2026-07-20 (>= cutoff, no analysis hits)
    assert.strictEqual(studentA.recentInsightCount7d, 3);
  });

  it('24. 非法日期安全 — 不抛异常', function () {
    var badHistory = [{
      id: 'bad-1',
      userId: 'student-a',
      startTime: 'not-a-date-at-all',
      completed: true,
      messages: [],
    }];
    assert.doesNotThrow(function () {
      adapter.buildTeacherRoster({
        teacherId: 'teacher-a',
        users: [STUDENT_A],
        bindings: { 'teacher-a': ['student-a'] },
        history: badHistory,
      });
    });
  });

  it('25. topTopics 来自 conversationState.active_topic', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    // conv-002 有 active_topic: '遇见小猫'
    assert.ok(studentA.topTopics.indexOf('遇见小猫') >= 0, 'topTopics 应包含 active_topic');
  });

  it('26. topDimensions 来自分析维度', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    // conv-001: 兴趣方向, 语言表达; conv-002: 语言表达, 兴趣方向, 内省倾向
    // 总计: 语言表达(2), 兴趣方向(2), 内省倾向(1)
    assert.ok(studentA.topDimensions.length > 0, 'topDimensions 不应为空');
  });

  it('27. 不把维度放入 topTopics', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    for (var i = 0; i < studentA.topTopics.length; i++) {
      // 维度名不应出现在 topics 中
      var t = studentA.topTopics[i];
      assert.ok(['语言表达', '兴趣方向', '内省倾向', '思维方式'].indexOf(t) < 0,
        '维度名 "' + t + '" 不应出现在 topTopics 中');
    }
  });

  it('28. roster 顺序保持绑定顺序', function () {
    var bindings = { 'teacher-a': ['student-b', 'student-a'] };
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: [STUDENT_A, STUDENT_B],
      bindings: bindings,
      history: [],
    });
    assert.strictEqual(roster.length, 2);
    assert.strictEqual(roster[0].studentId, 'student-b');
    assert.strictEqual(roster[1].studentId, 'student-a');
  });
});

// ============================================================
//  E. 消息过滤
// ============================================================

describe('E. 消息过滤', function () {

  it('29. 只返回 role 和 content', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-001',
      bindings: f.bindings,
      history: f.history,
    });
    var msgs = result.conversation.messages;
    assert.ok(msgs.length > 0);
    for (var i = 0; i < msgs.length; i++) {
      var keys = Object.keys(msgs[i]).sort();
      assert.deepStrictEqual(keys, ['content', 'role']);
    }
  });

  it('30. 移除 _ts', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-001',
      bindings: f.bindings,
      history: f.history,
    });
    var msgs = result.conversation.messages;
    for (var i = 0; i < msgs.length; i++) {
      assert.strictEqual('_ts' in msgs[i], false);
    }
  });

  it('31. 移除 topicSource', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-001',
      bindings: f.bindings,
      history: f.history,
    });
    var msgs = result.conversation.messages;
    for (var i = 0; i < msgs.length; i++) {
      assert.strictEqual('topicSource' in msgs[i], false);
    }
  });

  it('32. 移除 latencyMs', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-001',
      bindings: f.bindings,
      history: f.history,
    });
    var msgs = result.conversation.messages;
    for (var i = 0; i < msgs.length; i++) {
      assert.strictEqual('latencyMs' in msgs[i], false);
    }
  });

  it('33. 未知 role 跳过', function () {
    var f = makeFixture();
    var badHistory = [{
      id: 'conv-bad-role',
      userId: 'student-a',
      startTime: '2026-07-10T08:00:00.000Z',
      turnCount: 2,
      completed: true,
      messages: [
        { role: 'system', content: '不应该出现' },
        { role: 'user', content: '正常消息' },
      ],
    }];
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-bad-role',
      bindings: f.bindings,
      history: badHistory,
    });
    var msgs = result.conversation.messages;
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].role, 'user');
  });

  it('34. 非字符串 content 跳过', function () {
    var f = makeFixture();
    var badHistory = [{
      id: 'conv-bad-content',
      userId: 'student-a',
      startTime: '2026-07-10T08:00:00.000Z',
      turnCount: 2,
      completed: true,
      messages: [
        { role: 'user', content: 123 },
        { role: 'user', content: '正常消息' },
      ],
    }];
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-bad-content',
      bindings: f.bindings,
      history: badHistory,
    });
    var msgs = result.conversation.messages;
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].content, '正常消息');
  });

  it('35. preview 取首条合法 user 消息', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationSummaries({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    // 找到 conv-001 的摘要
    var conv1 = result.conversations.find(function (c) { return c.id === 'conv-001'; });
    assert.ok(conv1.preview.indexOf('今天体育课打篮球了') === 0);
    // preview 最多 40 字符
    assert.ok(conv1.preview.length <= 40);
  });

  it('preview 不使用 assistant 消息', function () {
    // 构造历史，第一条消息是 assistant
    var badHistory = [{
      id: 'conv-asm-first',
      userId: 'student-a',
      startTime: '2026-07-10T08:00:00.000Z',
      turnCount: 2,
      completed: true,
      messages: [
        { role: 'assistant', content: '你好，今天心情怎么样？' },
        { role: 'user', content: '今天还不错！' },
      ],
    }];
    var result = adapter.buildStudentConversationSummaries({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: BINDINGS_AB,
      history: badHistory,
    });
    var conv = result.conversations[0];
    assert.strictEqual(conv.preview, '今天还不错！');
  });
});

// ============================================================
//  F. analysis
// ============================================================

describe('F. analysis', function () {

  it('36. status=done 才解析', function () {
    var f = makeFixture();
    var roster = adapter.buildTeacherRoster({
      teacherId: 'teacher-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    var studentA = roster.find(function (r) { return r.studentId === 'student-a'; });
    // conv-004 analysis.status === 'failed'，hit 不应计入
    // conv-001: 2 hits, conv-002: 3 hits = 5
    assert.strictEqual(studentA.insightCount, 5);
  });

  it('37. analysis.status=failed 跳过', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    // conv-004 有 analysis.status=failed，insights 不应包含
    var convIds = result.insights.map(function (ins) { return ins.conversationId; });
    assert.ok(convIds.indexOf('conv-004') < 0, 'failed analysis 不应产出 insight');
  });

  it('38. analysis.result 为数组时拒绝', function () {
    var badHistory = [{
      id: 'conv-result-array',
      userId: 'student-a',
      startTime: '2026-07-10T08:00:00.000Z',
      turnCount: 2,
      completed: true,
      messages: [{ role: 'user', content: 'hi' }],
      analysis: { status: 'done', result: [1, 2, 3] },
    }];
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: BINDINGS_AB,
      history: badHistory,
    });
    assert.strictEqual(result.insights.length, 0);
  });

  it('39. 命中指标非数组安全', function () {
    var badHistory = [{
      id: 'conv-hits-string',
      userId: 'student-a',
      startTime: '2026-07-10T08:00:00.000Z',
      turnCount: 2,
      completed: true,
      messages: [{ role: 'user', content: 'hi' }],
      analysis: { status: 'done', result: { '分析范围': '第1轮', '命中指标': 'not an array', '未命中指标': [], '安全提示': false, '安全提示说明': '' } },
    }];
    assert.doesNotThrow(function () {
      adapter.buildStudentInsights({
        teacherId: 'teacher-a',
        studentId: 'student-a',
        bindings: BINDINGS_AB,
        history: badHistory,
      });
    });
  });

  it('40. 字段正确映射', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-001',
      bindings: f.bindings,
      history: f.history,
    });
    var analysis = result.conversation.analysis;
    assert.ok(analysis !== null);
    assert.strictEqual(typeof analysis.scope, 'string');
    assert.strictEqual(Array.isArray(analysis.hits), true);
    assert.strictEqual(typeof analysis.safetyAlert, 'boolean');
    assert.strictEqual(typeof analysis.safetyNote, 'string');

    var hit = analysis.hits[0];
    assert.strictEqual('dimension' in hit, true);
    assert.strictEqual('indicator' in hit, true);
    assert.strictEqual('evidenceSnippet' in hit, true);
    assert.strictEqual('turnLabel' in hit, true);
    assert.strictEqual('signal' in hit, true);
    assert.strictEqual('strengthNote' in hit, true);
    assert.strictEqual('strength' in hit, true);
    assert.strictEqual('wasPrompted' in hit, true);
    assert.strictEqual('promptIntensity' in hit, true);
  });

  it('41. 不返回原 analysis 对象', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-001',
      bindings: f.bindings,
      history: f.history,
    });
    var analysis = result.conversation.analysis;
    assert.strictEqual('result' in analysis, false);
    assert.strictEqual('status' in analysis, false);
  });

  it('43. safetyAlert 只接受 exact true', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-001',
      bindings: f.bindings,
      history: f.history,
    });
    assert.strictEqual(result.conversation.analysis.safetyAlert, false);
  });

  it('43b. safetyAlert 为 truthy 非 true 时仍返回 false', function () {
    var badHistory = [{
      id: 'conv-safety-truthy',
      userId: 'student-a',
      startTime: '2026-07-10T08:00:00.000Z',
      turnCount: 2,
      completed: true,
      messages: [{ role: 'user', content: 'hi' }],
      analysis: { status: 'done', result: { '分析范围': '第1轮', '命中指标': [], '未命中指标': [], '安全提示': 'truthy string', '安全提示说明': '' } },
    }];
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-safety-truthy',
      bindings: BINDINGS_AB,
      history: badHistory,
    });
    assert.strictEqual(result.conversation.analysis.safetyAlert, false);
  });
});

// ============================================================
//  G. conversationState
// ============================================================

describe('G. conversationState', function () {

  it('44. 只输出白名单字段', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-002',
      bindings: f.bindings,
      history: f.history,
    });
    var cs = result.conversation.conversationState;
    assert.ok(cs !== null);
    var keys = Object.keys(cs).sort();
    var expected = ['activeTopic', 'engagement', 'knownFacts', 'observationFocus', 'stage', 'turnIndex'];
    assert.deepStrictEqual(keys, expected);
  });

  it('45. 内部控制字段全部不输出', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-002',
      bindings: f.bindings,
      history: f.history,
    });
    var cs = result.conversation.conversationState;
    assert.strictEqual('question_budget' in cs, false);
    assert.strictEqual('previous_assistant_asked' in cs, false);
    assert.strictEqual('consecutive_short_replies' in cs, false);
    assert.strictEqual('focus_history' in cs, false);
    assert.strictEqual('used_focuses' in cs, false);
    assert.strictEqual('open_task_used' in cs, false);
    assert.strictEqual('student_refused_topic' in cs, false);
    assert.strictEqual('open_task_completed' in cs, false);
  });

  it('46. knownFacts 只保留 explicit', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-002',
      bindings: f.bindings,
      history: f.history,
    });
    var cs = result.conversation.conversationState;
    for (var i = 0; i < cs.knownFacts.length; i++) {
      assert.strictEqual('confidence' in cs.knownFacts[i], false);
    }
  });

  it('47. knownFacts 移除 confidence 和 source_quote', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-002',
      bindings: f.bindings,
      history: f.history,
    });
    var cs = result.conversation.conversationState;
    for (var i = 0; i < cs.knownFacts.length; i++) {
      var keys = Object.keys(cs.knownFacts[i]).sort();
      assert.deepStrictEqual(keys, ['key', 'value']);
      assert.strictEqual('confidence' in cs.knownFacts[i], false);
      assert.strictEqual('source_quote' in cs.knownFacts[i], false);
    }
  });

  it('48. 非法 engagement 进入 unknown 统计', function () {
    var badHistory = [{
      id: 'conv-bad-eng',
      userId: 'student-a',
      startTime: '2026-07-10T08:00:00.000Z',
      turnCount: 2,
      completed: true,
      messages: [{ role: 'user', content: 'hi' }],
      conversationState: {
        turn_index: 1,
        stage: 'interest',
        engagement: 'invalid_value',
        active_topic: null,
        known_facts: [],
      },
    }];
    var result = adapter.buildStudentOverview({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      users: [STUDENT_A],
      bindings: BINDINGS_AB,
      history: badHistory,
    });
    assert.strictEqual(result.overview.engagementDistribution.unknown, 1);
    assert.strictEqual(result.overview.engagementDistribution.high, 0);
    assert.strictEqual(result.overview.engagementDistribution.medium, 0);
    assert.strictEqual(result.overview.engagementDistribution.low, 0);
  });

  it('49. 旧数据无 state 时返回 null', function () {
    var f = makeFixture();
    var result = adapter.buildStudentConversationDetail({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      conversationId: 'conv-001', // No conversationState
      bindings: f.bindings,
      history: f.history,
    });
    assert.strictEqual(result.conversation.conversationState, null);
  });

  it('49b. 旧数据无 state 时 overview 默认记入 medium', function () {
    var f = makeFixture();
    var result = adapter.buildStudentOverview({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    // conv-001, conv-003, conv-004, conv-005 无 conversationState → 默认 medium
    // conv-002 有 conversationState → high
    assert.ok(result.overview.engagementDistribution.medium >= 4);
    assert.strictEqual(result.overview.engagementDistribution.high, 1);
  });
});

// ============================================================
//  H. insights
// ============================================================

describe('H. insights', function () {

  it('50. 一条 hit 生成一条 insight', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    // conv-001: 2 hits, conv-002: 3 hits = 5 insights
    assert.strictEqual(result.insights.length, 5);
  });

  it('51. insight ID 稳定', function () {
    var f = makeFixture();
    var r1 = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    var r2 = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    var ids1 = r1.insights.map(function (ins) { return ins.id; });
    var ids2 = r2.insights.map(function (ins) { return ins.id; });
    assert.deepStrictEqual(ids1, ids2);
  });

  it('52. source 固定 conversation_analysis', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    for (var i = 0; i < result.insights.length; i++) {
      assert.strictEqual(result.insights[i].source, 'conversation_analysis');
    }
  });

  it('53. confidence 固定 candidate', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    for (var i = 0; i < result.insights.length; i++) {
      assert.strictEqual(result.insights[i].confidence, 'candidate');
    }
  });

  it('54. reviewStatus 固定 unreviewed', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    for (var i = 0; i < result.insights.length; i++) {
      assert.strictEqual(result.insights[i].reviewStatus, 'unreviewed');
    }
  });

  it('55. evidenceSnippet 不伪造 — 使用分析结果的原文摘录', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    // conv-001 的第一个 hit 应有 evidenceSnippet '今天体育课打篮球了'
    var firstHitInsight = result.insights.find(function (ins) { return ins.evidenceSnippet === '今天体育课打篮球了'; });
    assert.ok(firstHitInsight !== undefined);
  });

  it('56. topic 缺失为 null', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    // conv-001 没有 conversationState，insights 的 topic 应为 null
    var conv001Insights = result.insights.filter(function (ins) { return ins.conversationId === 'conv-001'; });
    for (var i = 0; i < conv001Insights.length; i++) {
      assert.strictEqual(conv001Insights[i].topic, null);
    }
  });

  it('56b. topic 存在时正确设置', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    var conv002Insights = result.insights.filter(function (ins) { return ins.conversationId === 'conv-002'; });
    for (var i = 0; i < conv002Insights.length; i++) {
      assert.strictEqual(conv002Insights[i].topic, '遇见小猫');
    }
  });

  it('57. 非法分析不产出 insight', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    // conv-004, conv-005 不应产出 insights
    var convIds = result.insights.map(function (ins) { return ins.conversationId; });
    assert.ok(convIds.indexOf('conv-004') < 0, 'conv-004 failed analysis');
    assert.ok(convIds.indexOf('conv-005') < 0, 'conv-005 no analysis');
  });

  it('58. 按 observedAt 从新到旧排序', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    // conv-002 (2026-07-15) 应在 conv-001 (2026-07-10) 之前
    var firstConvId = result.insights[0].conversationId;
    assert.strictEqual(firstConvId, 'conv-002');
  });

  it('59. 同一 conversation 内保持 hit 原顺序', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    // conv-001 的 hits: [主动话题倾向, 叙事组织能力]
    var conv001Insights = result.insights.filter(function (ins) { return ins.conversationId === 'conv-001'; });
    assert.strictEqual(conv001Insights[0].indicator, '主动话题倾向');
    assert.strictEqual(conv001Insights[1].indicator, '叙事组织能力');
  });

  it('60. 相同输入产生相同输出（idempotent）', function () {
    var f = makeFixture();
    var r1 = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    var r2 = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    assert.deepStrictEqual(r1, r2);
  });

  it('insight 包含所有必填字段', function () {
    var f = makeFixture();
    var result = adapter.buildStudentInsights({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      bindings: f.bindings,
      history: f.history,
    });
    var expectedKeys = [
      'id', 'studentId', 'conversationId', 'sessionId', 'source',
      'dimension', 'indicator', 'signal', 'evidenceSnippet', 'turnLabel',
      'strengthNote', 'topic', 'confidence', 'observedAt', 'reviewStatus',
      'isWeakSignal',
    ].sort();

    for (var i = 0; i < result.insights.length; i++) {
      var keys = Object.keys(result.insights[i]).sort();
      assert.deepStrictEqual(keys, expectedKeys);
    }
  });

  it('overview 包含所有必填字段', function () {
    var f = makeFixture();
    var result = adapter.buildStudentOverview({
      teacherId: 'teacher-a',
      studentId: 'student-a',
      users: f.users,
      bindings: f.bindings,
      history: f.history,
    });
    assert.strictEqual(result.allowed, true);
    var ovKeys = Object.keys(result.overview).sort();
    var expected = [
      'engagementDistribution', 'firstSeen', 'insightCount',
      'lastActive', 'topDimensions', 'topTopics',
      'totalConversations', 'totalTurns',
    ].sort();
    assert.deepStrictEqual(ovKeys, expected);
  });
});
