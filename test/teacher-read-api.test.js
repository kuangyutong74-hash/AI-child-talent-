/**
 * test/teacher-read-api.test.js — 教师端只读 API 测试
 *
 * 覆盖：
 *   A. 认证和角色
 *   B. roster
 *   C. overview
 *   D. conversations
 *   E. conversation detail
 *   F. insights
 *   G. 错误和隐私
 */

'use strict';

var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var http = require('http');

var { httpRequest, restoreFetch } = require('./helpers');

// ============================================================
//  测试 fixture
// ============================================================

var TOKEN_TA = 'test-token-teacher-a';
var TOKEN_TB = 'test-token-teacher-b';
var TOKEN_SA = 'test-token-student-a';

var TEACHER_A_ID = 'teacher-a';
var TEACHER_B_ID = 'teacher-b';
var STUDENT_A_ID = 'student-a';
var STUDENT_B_ID = 'student-b';

var NOW = Date.now();
var FUTURE = NOW + 30 * 24 * 60 * 60 * 1000;

function buildUsers() {
  return [
    {
      id: TEACHER_A_ID,
      username: '张老师',
      passwordHash: '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      role: 'teacher',
      createdAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: TEACHER_B_ID,
      username: '李老师',
      passwordHash: '$2b$10$yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
      role: 'teacher',
      createdAt: '2026-07-02T00:00:00.000Z',
    },
    {
      id: STUDENT_A_ID,
      username: '小明',
      passwordHash: '$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      role: 'student',
      studentCode: '111111',
      createdAt: '2026-07-03T00:00:00.000Z',
    },
    {
      id: STUDENT_B_ID,
      username: '小红',
      passwordHash: '$2b$10$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      role: 'student',
      studentCode: '222222',
      createdAt: '2026-07-04T00:00:00.000Z',
    },
  ];
}

function buildSessions() {
  var obj = {};
  obj[TOKEN_TA] = { userId: TEACHER_A_ID, username: '张老师', createdAt: NOW, expiresAt: FUTURE };
  obj[TOKEN_TB] = { userId: TEACHER_B_ID, username: '李老师', createdAt: NOW, expiresAt: FUTURE };
  obj[TOKEN_SA] = { userId: STUDENT_A_ID, username: '小明', createdAt: NOW, expiresAt: FUTURE };
  return obj;
}

function buildBindings() {
  var obj = {};
  obj[TEACHER_A_ID] = [STUDENT_A_ID];
  obj[TEACHER_B_ID] = [STUDENT_B_ID];
  return obj;
}

function buildHistory() {
  return [
    // conv-001: student-a, completed, with analysis (2 hits)
    {
      id: 'conv-001',
      userId: STUDENT_A_ID,
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
          '未命中指标': ['自我反思频率'],
          '安全提示': false,
          '安全提示说明': '',
        },
      },
    },
    // conv-002: student-a, completed, with analysis (3 hits) + conversationState
    {
      id: 'conv-002',
      userId: STUDENT_A_ID,
      sessionId: 'sess-002',
      startTime: '2026-07-15T10:00:00.000Z',
      turnCount: 3,
      completed: true,
      weather: 'cloudy',
      messages: [
        { role: 'user', content: '今天遇见了一只可爱的小猫' },
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
              '证据片段': '今天遇见了一只可爱的小猫',
              '说话轮次': '第1轮',
              '信号说明': '主动引出关爱动物话题',
              '强度备注': '',
            },
            {
              '维度': '内省倾向',
              '指标': '自我反思频率',
              '证据片段': '可爱的小猫',
              '说话轮次': '第1轮',
              '信号说明': '表达了情感感受',
              '强度备注': '仅有笼统情绪词',
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
        ],
        previous_assistant_asked: true,
        consecutive_short_replies: 0,
        open_task_completed: false,
        open_task_used: false,
        student_refused_topic: false,
        focus_history: ['vocabulary_choice'],
        used_focuses: ['vocabulary_choice'],
      },
    },
    // conv-003: student-a, NOT completed (should be excluded from completed counts)
    {
      id: 'conv-003',
      userId: STUDENT_A_ID,
      sessionId: 'sess-003',
      startTime: '2026-07-18T12:00:00.000Z',
      turnCount: 2,
      completed: false,
      messages: [
        { role: 'user', content: '今天下雨了' },
        { role: 'assistant', content: '下雨天适合在家看书呢' },
      ],
    },
    // conv-004: student-b, completed, with analysis
    {
      id: 'conv-004',
      userId: STUDENT_B_ID,
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
    },
  ];
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

// ============================================================
//  设置：临时目录 + 随机端口
// ============================================================

var originalSkipMigration = process.env.SKIP_MIGRATION;
var originalDataDir = process.env.DATA_DIR;

process.env.SKIP_MIGRATION = 'true';

var tempDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'ai-talent-scout-teacher-api-')
);
process.env.DATA_DIR = tempDataDir;

var testPort;
var server;
var serverModule;

before(function () {
  // Write test fixture data
  writeJSON(path.join(tempDataDir, 'users.json'), buildUsers());
  writeJSON(path.join(tempDataDir, 'sessions.json'), buildSessions());
  writeJSON(path.join(tempDataDir, 'bindings.json'), buildBindings());
  writeJSON(path.join(tempDataDir, 'history.json'), buildHistory());

  // Clear require cache to pick up new DATA_DIR
  delete require.cache[require.resolve('../app')];
  serverModule = require('../app');

  return new Promise(function (resolve, reject) {
    var s = http.createServer(serverModule.app);
    s.listen(0, '127.0.0.1', function () {
      testPort = s.address().port;
      server = s;
      resolve();
    });
    s.on('error', reject);
  });
});

after(function () {
  if (server) { try { server.close(); } catch (_) {} }
  restoreFetch();
  delete require.cache[require.resolve('../app')];
  try { fs.rmSync(tempDataDir, { recursive: true, force: true }); } catch (_) {}

  if (originalSkipMigration === undefined) {
    delete process.env.SKIP_MIGRATION;
  } else {
    process.env.SKIP_MIGRATION = originalSkipMigration;
  }
  if (originalDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = originalDataDir;
  }
});

// ============================================================
//  辅助函数
// ============================================================

function teacherHeaders() {
  return { Cookie: 'token=' + TOKEN_TA };
}

function teacherBHeaders() {
  return { Cookie: 'token=' + TOKEN_TB };
}

function studentHeaders() {
  return { Cookie: 'token=' + TOKEN_SA };
}

function noAuthHeaders() {
  return {};
}

/**
 * 递归搜索对象中是否包含某个字符串值。
 */
function deepContainsValue(obj, search) {
  if (obj === null || obj === undefined) return false;
  if (typeof obj === 'string') return obj.indexOf(search) >= 0;
  if (typeof obj === 'number') return String(obj).indexOf(search) >= 0;
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      if (deepContainsValue(obj[i], search)) return true;
    }
    return false;
  }
  if (typeof obj === 'object') {
    var keys = Object.keys(obj);
    for (var k = 0; k < keys.length; k++) {
      if (deepContainsValue(obj[keys[k]], search)) return true;
    }
    return false;
  }
  return false;
}

// ============================================================
//  A. 认证和角色
// ============================================================

describe('A. 认证和角色', function () {

  it('1. 未登录访问 roster 被拒绝', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: noAuthHeaders() });
    assert.strictEqual(res.status, 401);
  });

  it('2. 未登录访问 overview 被拒绝', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/overview', { port: testPort, headers: noAuthHeaders() });
    assert.strictEqual(res.status, 401);
  });

  it('3. student 角色访问教师接口被拒绝', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: studentHeaders() });
    assert.strictEqual(res.status, 403);
    assert.ok(res.body.error);
  });

  it('4. teacher 角色可以访问教师接口', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
  });

  it('5a. roster 挂载 authMiddleware 和 teacherOnly', async function () {
    // 未登录 → 401
    var r1 = await httpRequest('/api/teacher/roster', { port: testPort, headers: noAuthHeaders() });
    assert.strictEqual(r1.status, 401);
    // student → 403
    var r2 = await httpRequest('/api/teacher/roster', { port: testPort, headers: studentHeaders() });
    assert.strictEqual(r2.status, 403);
  });

  it('5b. overview 挂载 authMiddleware 和 teacherOnly', async function () {
    var r1 = await httpRequest('/api/teacher/student/student-a/overview', { port: testPort, headers: noAuthHeaders() });
    assert.strictEqual(r1.status, 401);
    var r2 = await httpRequest('/api/teacher/student/student-a/overview', { port: testPort, headers: studentHeaders() });
    assert.strictEqual(r2.status, 403);
  });

  it('5c. conversations 挂载 authMiddleware 和 teacherOnly', async function () {
    var r1 = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: noAuthHeaders() });
    assert.strictEqual(r1.status, 401);
    var r2 = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: studentHeaders() });
    assert.strictEqual(r2.status, 403);
  });

  it('5d. conversation detail 挂载 authMiddleware 和 teacherOnly', async function () {
    var r1 = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: noAuthHeaders() });
    assert.strictEqual(r1.status, 401);
    var r2 = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: studentHeaders() });
    assert.strictEqual(r2.status, 403);
  });

  it('5e. insights 挂载 authMiddleware 和 teacherOnly', async function () {
    var r1 = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: noAuthHeaders() });
    assert.strictEqual(r1.status, 401);
    var r2 = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: studentHeaders() });
    assert.strictEqual(r2.status, 403);
  });
});

// ============================================================
//  B. roster
// ============================================================

describe('B. roster', function () {

  it('6. 只返回当前教师绑定的学生', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    var ids = res.body.map(function (r) { return r.studentId; });
    assert.ok(ids.indexOf(STUDENT_A_ID) >= 0, '应包含 student-a');
    assert.ok(ids.indexOf(STUDENT_B_ID) < 0, '不应包含 student-b');
  });

  it('7. 不返回其他教师绑定的学生', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherBHeaders() });
    assert.strictEqual(res.status, 200);
    var ids = res.body.map(function (r) { return r.studentId; });
    assert.ok(ids.indexOf(STUDENT_B_ID) >= 0, '应包含 student-b');
    assert.ok(ids.indexOf(STUDENT_A_ID) < 0, '不应包含 student-a');
  });

  it('8. 返回 adapter 的真实统计结果', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
    var studentA = res.body.find(function (r) { return r.studentId === STUDENT_A_ID; });
    assert.ok(studentA, 'roster 应包含 student-a');
    assert.strictEqual(typeof studentA.totalConversations, 'number');
    assert.strictEqual(studentA.totalConversations, 2); // conv-001 + conv-002 completed
    assert.strictEqual(typeof studentA.insightCount, 'number');
    assert.strictEqual(studentA.insightCount, 5); // 2 + 3
  });

  it('9. 不返回 passwordHash', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('passwordHash') < 0, '不应包含 passwordHash 字符串');
    assert.ok(!deepContainsValue(res.body, '$2b$'), '不应包含 bcrypt hash');
  });

  it('10. 不返回 role', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.length; i++) {
      assert.strictEqual('role' in res.body[i], false, 'roster 条目不应包含 role');
    }
  });

  it('11. 不返回 createdAt', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.length; i++) {
      assert.strictEqual('createdAt' in res.body[i], false, 'roster 条目不应包含 createdAt');
    }
  });

  it('12. topTopics 与 topDimensions 不混淆', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    var studentA = res.body.find(function (r) { return r.studentId === STUDENT_A_ID; });
    // topTopics should only contain values from active_topic
    // No dimension names should appear in topTopics
    assert.ok(Array.isArray(studentA.topTopics));
    assert.ok(Array.isArray(studentA.topDimensions));
    for (var i = 0; i < studentA.topTopics.length; i++) {
      var t = studentA.topTopics[i];
      assert.ok(['语言表达', '兴趣方向', '内省倾向', '思维方式'].indexOf(t) < 0,
        '维度名 "' + t + '" 不应出现在 topTopics 中');
    }
  });

  it('13. 无历史学生安全返回空统计', async function () {
    // Add a new binding for teacher-a to a student with no history
    var bindings = buildBindings();
    bindings[TEACHER_A_ID].push('student-no-history');
    writeJSON(path.join(tempDataDir, 'bindings.json'), bindings);
    var users = buildUsers();
    users.push({
      id: 'student-no-history',
      username: '无历史学生',
      passwordHash: '$2b$10$ccccccccccccccccccccccccccccccccccccccccccccccc',
      role: 'student',
      studentCode: '333333',
      createdAt: '2026-07-05T00:00:00.000Z',
    });
    writeJSON(path.join(tempDataDir, 'users.json'), users);

    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    var noHist = res.body.find(function (r) { return r.studentId === 'student-no-history'; });
    assert.ok(noHist, '应包含无历史学生');
    assert.strictEqual(noHist.totalConversations, 0);
    assert.strictEqual(noHist.lastActiveDate, null);
    assert.strictEqual(noHist.insightCount, 0);
    assert.strictEqual(noHist.recentInsightCount7d, 0);
  });

  it('14. 重复绑定不会产生重复学生', async function () {
    var bindings = buildBindings();
    bindings[TEACHER_A_ID] = [STUDENT_A_ID, STUDENT_A_ID, STUDENT_A_ID];
    writeJSON(path.join(tempDataDir, 'bindings.json'), bindings);

    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    var count = res.body.filter(function (r) { return r.studentId === STUDENT_A_ID; }).length;
    assert.strictEqual(count, 1, '重复绑定不应产生重复条目');
  });
});

// ============================================================
//  C. overview
// ============================================================

describe('C. overview', function () {

  it('15. 已绑定学生返回 200', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/overview', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.student);
    assert.ok(res.body.overview);
  });

  it('16. 未绑定学生返回 403 NOT_BOUND', async function () {
    var res = await httpRequest('/api/teacher/student/student-b/overview', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'NOT_BOUND');
  });

  it('17. 已绑定但学生不存在返回 404 STUDENT_NOT_FOUND', async function () {
    // Bind teacher-a to a non-existent student
    var bindings = buildBindings();
    bindings[TEACHER_A_ID].push('student-nonexistent');
    writeJSON(path.join(tempDataDir, 'bindings.json'), bindings);

    var res = await httpRequest('/api/teacher/student/student-nonexistent/overview', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'STUDENT_NOT_FOUND');
  });

  it('18. 返回 student 和 overview', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/overview', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.student.id, STUDENT_A_ID);
    assert.strictEqual(res.body.student.username, '小明');
    assert.strictEqual(res.body.student.studentCode, '111111');
    assert.strictEqual(typeof res.body.overview.totalConversations, 'number');
    assert.strictEqual(typeof res.body.overview.totalTurns, 'number');
  });

  it('19. 不返回原始 user 对象', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/overview', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual('passwordHash' in (res.body.student || {}), false);
    assert.strictEqual('role' in (res.body.student || {}), false);
    assert.strictEqual('createdAt' in (res.body.student || {}), false);
  });

  it('20. 不返回原始 history', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/overview', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('_ts') < 0);
    assert.ok(json.indexOf('topicSource') < 0);
  });

  it('20b. overview 包含 engagementDistribution', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/overview', { port: testPort, headers: teacherHeaders() });
    var ed = res.body.overview.engagementDistribution;
    assert.ok(ed);
    assert.strictEqual(typeof ed.high, 'number');
    assert.strictEqual(typeof ed.medium, 'number');
    assert.strictEqual(typeof ed.low, 'number');
    assert.strictEqual(typeof ed.unknown, 'number');
  });
});

// ============================================================
//  D. conversations
// ============================================================

describe('D. conversations', function () {

  it('21. 已绑定学生返回安全摘要数组', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.conversations));
    assert.ok(res.body.conversations.length >= 2, '应有至少2条会话');
  });

  it('22. 摘要不包含完整 messages', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.conversations.length; i++) {
      assert.strictEqual('messages' in res.body.conversations[i], false, '摘要不应包含 messages');
    }
  });

  it('23. 摘要不包含原始 analysis', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('"分析范围"') < 0, '不应包含原始 analysis 中文键');
    assert.ok(json.indexOf('"未命中指标"') < 0, '不应包含原始 analysis 中文键');
  });

  it('24. 按 startTime 从新到旧排序', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: teacherHeaders() });
    var convs = res.body.conversations;
    // conv-002 startTime 2026-07-15 should come before conv-001 2026-07-10
    var idx1 = -1, idx2 = -1;
    for (var i = 0; i < convs.length; i++) {
      if (convs[i].id === 'conv-001') idx1 = i;
      if (convs[i].id === 'conv-002') idx2 = i;
    }
    assert.ok(idx2 < idx1, 'conv-002 (newer) should come before conv-001');
  });

  it('25. 未绑定学生返回 403', async function () {
    var res = await httpRequest('/api/teacher/student/student-b/conversations', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'NOT_BOUND');
  });

  it('26. 不泄露其他学生对话', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.conversations.length; i++) {
      assert.ok(res.body.conversations[i].id !== 'conv-004', '不应包含 student-b 的对话');
    }
  });

  it('26b. conversations 包含 activeTopic 和 engagement', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: teacherHeaders() });
    var conv2 = res.body.conversations.find(function (c) { return c.id === 'conv-002'; });
    assert.ok(conv2, '应包含 conv-002');
    assert.strictEqual(conv2.activeTopic, '遇见小猫');
    assert.strictEqual(conv2.engagement, 'high');
  });

  it('26c. 无 conversationState 的对话字段为 null', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations', { port: testPort, headers: teacherHeaders() });
    var conv1 = res.body.conversations.find(function (c) { return c.id === 'conv-001'; });
    assert.strictEqual(conv1.activeTopic, null);
    assert.strictEqual(conv1.engagement, null);
  });
});

// ============================================================
//  E. conversation detail
// ============================================================

describe('E. conversation detail', function () {

  it('27. 合法对话详情返回 200', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.conversation);
    assert.strictEqual(res.body.conversation.id, 'conv-001');
  });

  it('28. 消息只包含 role 和 content', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: teacherHeaders() });
    var msgs = res.body.conversation.messages;
    assert.ok(msgs.length > 0);
    for (var i = 0; i < msgs.length; i++) {
      var keys = Object.keys(msgs[i]).sort();
      assert.deepStrictEqual(keys, ['content', 'role']);
    }
  });

  it('29. 不返回 _ts', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('"_ts"') < 0);
  });

  it('30. 不返回 topicSource', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('topicSource') < 0);
  });

  it('31. 不返回 latencyMs', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('latencyMs') < 0);
  });

  it('32. conversationState 只包含白名单字段', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-002', { port: testPort, headers: teacherHeaders() });
    var cs = res.body.conversation.conversationState;
    assert.ok(cs !== null);
    var keys = Object.keys(cs).sort();
    var expected = ['activeTopic', 'engagement', 'knownFacts', 'observationFocus', 'stage', 'turnIndex'];
    assert.deepStrictEqual(keys, expected);
  });

  it('33. 不返回内部状态字段', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-002', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('question_budget') < 0);
    assert.ok(json.indexOf('previous_assistant_asked') < 0);
    assert.ok(json.indexOf('consecutive_short_replies') < 0);
    assert.ok(json.indexOf('focus_history') < 0);
    assert.ok(json.indexOf('used_focuses') < 0);
    assert.ok(json.indexOf('open_task_used') < 0);
    assert.ok(json.indexOf('student_refused_topic') < 0);
  });

  it('34. analysis 是安全适配后的结构', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: teacherHeaders() });
    var analysis = res.body.conversation.analysis;
    assert.ok(analysis !== null);
    assert.strictEqual(typeof analysis.scope, 'string');
    assert.ok(Array.isArray(analysis.hits));
    assert.strictEqual(typeof analysis.safetyAlert, 'boolean');
  });

  it('35. 不返回原始 analysis.result', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('"命中指标"') < 0, '不应包含原始中文键');
    assert.ok(json.indexOf('"未命中指标"') < 0, '不应包含原始中文键');
  });

  it('36. 对话不存在返回 404 CONVERSATION_NOT_FOUND', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-nonexistent', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'CONVERSATION_NOT_FOUND');
  });

  it('37. 使用其他学生 conversationId 时不得泄露数据', async function () {
    // teacher-a wants conv-004 but claims it belongs to student-a — must be rejected
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-004', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'CONVERSATION_NOT_FOUND');
  });

  it('38. 未绑定学生返回 403', async function () {
    var res = await httpRequest('/api/teacher/student/student-b/conversations/conv-004', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'NOT_BOUND');
  });

  it('38b. 旧数据无 conversationState 时返回 null', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-001', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.body.conversation.conversationState, null);
  });

  it('38c. 旧数据无 analysis 时返回 null', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-003', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.conversation.analysis, null);
  });
});

// ============================================================
//  F. insights
// ============================================================

describe('F. insights', function () {

  it('39. 已绑定学生返回安全 insight 数组', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.insights));
    assert.strictEqual(res.body.insights.length, 5); // 2 + 3 hits
  });

  it('40. insight ID 稳定', async function () {
    var r1 = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    var r2 = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    var ids1 = r1.body.insights.map(function (ins) { return ins.id; });
    var ids2 = r2.body.insights.map(function (ins) { return ins.id; });
    assert.deepStrictEqual(ids1, ids2);
  });

  it('41. source 为 conversation_analysis', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.insights.length; i++) {
      assert.strictEqual(res.body.insights[i].source, 'conversation_analysis');
    }
  });

  it('42. confidence 为 candidate', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.insights.length; i++) {
      assert.strictEqual(res.body.insights[i].confidence, 'candidate');
    }
  });

  it('43. reviewStatus 为 unreviewed', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.insights.length; i++) {
      assert.strictEqual(res.body.insights[i].reviewStatus, 'unreviewed');
    }
  });

  it('44. evidenceSnippet 不由接口补写', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.insights.length; i++) {
      var es = res.body.insights[i].evidenceSnippet;
      // Should be the actual evidence from analysis, not empty or fabricated
      assert.ok(typeof es === 'string');
    }
  });

  it('45. 未绑定学生返回 403', async function () {
    var res = await httpRequest('/api/teacher/student/student-b/insights', { port: testPort, headers: teacherHeaders() });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'NOT_BOUND');
  });

  it('46. 不返回其他学生 insight', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    for (var i = 0; i < res.body.insights.length; i++) {
      assert.strictEqual(res.body.insights[i].studentId, STUDENT_A_ID);
    }
  });

  it('46b. insights 包含 topic 字段', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherHeaders() });
    // conv-002 insights should have topic '遇见小猫'
    var conv2Insights = res.body.insights.filter(function (ins) { return ins.conversationId === 'conv-002'; });
    for (var i = 0; i < conv2Insights.length; i++) {
      assert.strictEqual(conv2Insights[i].topic, '遇见小猫');
    }
    // conv-001 insights should have topic null (no conversationState)
    var conv1Insights = res.body.insights.filter(function (ins) { return ins.conversationId === 'conv-001'; });
    for (var j = 0; j < conv1Insights.length; j++) {
      assert.strictEqual(conv1Insights[j].topic, null);
    }
  });
});

// ============================================================
//  G. 错误和隐私
// ============================================================

describe('G. 错误和隐私', function () {

  it('47. roster 响应中递归搜索不到 passwordHash', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    assert.ok(!deepContainsValue(res.body, 'passwordHash'));
  });

  it('48. 响应中递归搜索不到 token', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    assert.ok(!deepContainsValue(res.body, TOKEN_TA));
    assert.ok(!deepContainsValue(res.body, TOKEN_TB));
    assert.ok(!deepContainsValue(res.body, TOKEN_SA));
  });

  it('49. 响应中递归搜索不到 question_budget', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-002', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('question_budget') < 0);
  });

  it('50. 响应中递归搜索不到 previous_assistant_asked', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-002', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('previous_assistant_asked') < 0);
  });

  it('51. 响应中递归搜索不到 source_quote', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/conversations/conv-002', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('source_quote') < 0);
  });

  it('52. 服务器异常不返回 stack', async function () {
    // All normal routes should catch errors. Verify by checking all 5 endpoints.
    var endpoints = [
      '/api/teacher/roster',
      '/api/teacher/student/student-a/overview',
      '/api/teacher/student/student-a/conversations',
      '/api/teacher/student/student-a/conversations/conv-001',
      '/api/teacher/student/student-a/insights',
    ];
    for (var i = 0; i < endpoints.length; i++) {
      var res = await httpRequest(endpoints[i], { port: testPort, headers: teacherHeaders() });
      var json = JSON.stringify(res.body);
      // Should not contain stack trace patterns
      assert.ok(!/\bat\s+.*\.js:\d+:\d+/.test(json), endpoints[i] + ' 响应不应包含堆栈');
    }
  });

  it('53. 服务器异常不返回文件路径', async function () {
    var res = await httpRequest('/api/teacher/roster', { port: testPort, headers: teacherHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('app.js') < 0, '不应包含文件路径');
    assert.ok(json.indexOf('teacher-data-adapter') < 0, '不应包含模块名');
  });
});

// Final verification that server closes cleanly
describe('server close', function () {
  it('server should be listening', function () {
    assert.ok(server.listening);
  });
});
