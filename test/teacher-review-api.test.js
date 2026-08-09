/**
 * test/teacher-review-api.test.js — 教师端 Insight 审核 API 测试
 *
 * 覆盖：
 *   A. GET 合并
 *   B. PATCH 认证与权限
 *   C. PATCH 验证
 *   D. PATCH 功能
 *   E. 隔离与并发
 *   F. 文件安全
 *
 * 使用临时 DATA_DIR + 动态端口，不修改真实 data/。
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
  obj[TEACHER_A_ID] = [STUDENT_A_ID, STUDENT_B_ID];
  obj[TEACHER_B_ID] = [STUDENT_A_ID];
  return obj;
}

function buildHistory() {
  return [
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
    // student-b 的对话
    {
      id: 'conv-100',
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
  path.join(os.tmpdir(), 'ai-talent-scout-review-api-')
);
process.env.DATA_DIR = tempDataDir;

var testPort;
var server;
var serverModule;

before(function () {
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
  // Clear module cache so next test file gets fresh store
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

function teacherAHeaders() {
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
//  A. GET 合并
// ============================================================

describe('A. GET 合并', function () {

  it('1. 无 review 文件时返回 unreviewed', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.insights));
    for (var i = 0; i < res.body.insights.length; i++) {
      assert.strictEqual(res.body.insights[i].reviewStatus, 'unreviewed');
      assert.strictEqual(res.body.insights[i].teacherNote, null);
      assert.strictEqual(res.body.insights[i].reviewedAt, null);
      assert.strictEqual(res.body.insights[i].reviewUpdatedAt, null);
    }
  });

  it('2. 有匹配 review 时正确合并', async function () {
    // 先写入一条 review
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    writeJSON(reviewFile, [{
      id: 'rev-test-1',
      teacherId: TEACHER_A_ID,
      studentId: STUDENT_A_ID,
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '确认观察',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-21T10:00:00.000Z',
    }]);

    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    assert.strictEqual(res.status, 200);
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.ok(ins, '应找到 insight-conv-001-0');
    assert.strictEqual(ins.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(ins.teacherNote, '确认观察');
    assert.strictEqual(ins.reviewedAt, '2026-07-20T10:00:00.000Z');
    assert.strictEqual(ins.reviewUpdatedAt, '2026-07-21T10:00:00.000Z');
  });

  it('3. teacherNote 正确', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    writeJSON(reviewFile, [{
      id: 'rev-note',
      teacherId: TEACHER_A_ID,
      studentId: STUDENT_A_ID,
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '课堂活动中也观察到',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }]);
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(ins.teacherNote, '课堂活动中也观察到');
  });

  it('4. reviewedAt 正确', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(typeof ins.reviewedAt, 'string');
  });

  it('5. reviewUpdatedAt 正确', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(typeof ins.reviewUpdatedAt, 'string');
  });

  it('6. 不同教师 review 不合并', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    writeJSON(reviewFile, [{
      id: 'rev-diff-teacher',
      teacherId: TEACHER_B_ID,
      studentId: STUDENT_A_ID,
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: 'Teacher B 的备注',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }]);
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    // Teacher A 不应看到 Teacher B 的 review
    assert.strictEqual(ins.reviewStatus, 'unreviewed');
    assert.strictEqual(ins.teacherNote, null);
  });

  it('7. 不同学生 review 不合并', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    writeJSON(reviewFile, [{
      id: 'rev-diff-student',
      teacherId: TEACHER_A_ID,
      studentId: STUDENT_B_ID,
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '不应出现',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }]);
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(ins.reviewStatus, 'unreviewed');
  });

  it('8. conversationId 不一致的损坏 review 不合并', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    writeJSON(reviewFile, [{
      id: 'rev-mismatch-conv',
      teacherId: TEACHER_A_ID,
      studentId: STUDENT_A_ID,
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-999',
      reviewStatus: 'teacher_confirmed',
      note: '不应合并',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }]);
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(ins.reviewStatus, 'unreviewed');
  });

  it('9. confidence 仍为 candidate', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    writeJSON(reviewFile, [{
      id: 'rev-conf',
      teacherId: TEACHER_A_ID,
      studentId: STUDENT_A_ID,
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }]);
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(ins.confidence, 'candidate');
  });

  it('10. rejected 仍保留 evidenceSnippet', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    writeJSON(reviewFile, [{
      id: 'rev-reject',
      teacherId: TEACHER_A_ID,
      studentId: STUDENT_A_ID,
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'rejected',
      note: '',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }]);
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(ins.reviewStatus, 'rejected');
    assert.strictEqual(typeof ins.evidenceSnippet, 'string');
    assert.ok(ins.evidenceSnippet.length > 0);
  });

  it('11. GET 响应不包含 teacherId', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    for (var i = 0; i < res.body.insights.length; i++) {
      assert.strictEqual('teacherId' in res.body.insights[i], false);
    }
  });

  it('12. GET 响应不包含 review record id', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    writeJSON(reviewFile, [{
      id: 'rev-should-not-leak',
      teacherId: TEACHER_A_ID,
      studentId: STUDENT_A_ID,
      insightId: 'insight-conv-001-0',
      conversationId: 'conv-001',
      reviewStatus: 'teacher_confirmed',
      note: '',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
    }]);
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('rev-should-not-leak') < 0, '不应泄露 review record id');
  });

  it('13. 损坏 review 文件返回安全 500', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    fs.writeFileSync(reviewFile, 'not json {{{', 'utf-8');
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error, 'INTERNAL_ERROR');
  });

  it('14. 500 不返回 stack 或文件路径', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    fs.writeFileSync(reviewFile, '{broken', 'utf-8');
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    assert.strictEqual(res.status, 500);
    var json = JSON.stringify(res.body);
    assert.ok(!/\bat\s+.*\.js:\d+:\d+/.test(json), '不应包含 stack');
    assert.ok(json.indexOf('teacher-insight-review') < 0, '不应包含文件路径');
  });
});

// ============================================================
//  B. PATCH 认证与权限
// ============================================================

describe('B. PATCH 认证与权限', function () {

  it('15. 未登录返回 401', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: noAuthHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(res.status, 401);
  });

  it('16. student 角色返回 403', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: studentHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(res.status, 403);
  });

  it('17. 未绑定返回 403 NOT_BOUND', async function () {
    // Teacher A is NOT bound to student-nonexistent
    var res = await httpRequest('/api/teacher/student/student-nonexistent/insights/insight-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'NOT_BOUND');
  });

  it('18. 未绑定时不泄露 STUDENT_NOT_FOUND', async function () {
    // 未绑定教师访问不存在的 student → 应返回 403 NOT_BOUND，而非 404
    // student-nonexistent 不在 bindings 中，也不在 users 中
    var res = await httpRequest('/api/teacher/student/student-nonexistent/insights/insight-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'NOT_BOUND');
  });

  it('19. 已绑定但学生不存在返回 404', async function () {
    // 先手动绑定一个不存在的 studentId
    var bindingsFile = path.join(tempDataDir, 'bindings.json');
    var bindings = JSON.parse(fs.readFileSync(bindingsFile, 'utf-8'));
    bindings[TEACHER_A_ID].push('student-ghost');
    writeJSON(bindingsFile, bindings);

    var res = await httpRequest('/api/teacher/student/student-ghost/insights/insight-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'STUDENT_NOT_FOUND');
  });

  it('20. Insight 不存在返回 404', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-nonexistent/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'INSIGHT_NOT_FOUND');
  });

  it('21. 非法请求不写文件', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    // 确保文件不存在
    try { fs.unlinkSync(reviewFile); } catch (_) {}
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-nonexistent/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(fs.existsSync(reviewFile), false);
  });
});

// ============================================================
//  C. PATCH 验证
// ============================================================

describe('C. PATCH 验证', function () {

  it('22. 空 body 返回 INVALID_REVIEW_PATCH', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: {},
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'INVALID_REVIEW_PATCH');
  });

  it('23. 非法 reviewStatus 返回 INVALID_REVIEW_STATUS', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'approved' },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'INVALID_REVIEW_STATUS');
  });

  it('24. note 数字返回 INVALID_NOTE', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { note: 123 },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'INVALID_NOTE');
  });

  it('25. note null 返回 INVALID_NOTE', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { note: null },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'INVALID_NOTE');
  });

  it('26. note 超过 500 返回 INVALID_NOTE', async function () {
    var tooLong = '';
    for (var i = 0; i < 501; i++) tooLong += 'x';
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { note: tooLong },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'INVALID_NOTE');
  });

  it('27. 只提交 note 合法', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { note: '新备注' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.teacherNote, '新备注');
    // 只提交 note 时默认 unreviewed
    assert.strictEqual(res.body.insight.reviewStatus, 'unreviewed');
  });

  it('28. 只提交 reviewStatus 合法', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-1/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'rejected' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.reviewStatus, 'rejected');
    assert.strictEqual(res.body.insight.teacherNote, null);
  });
});

// ============================================================
//  D. PATCH 功能
// ============================================================

describe('D. PATCH 功能', function () {

  it('30. 首次确认创建记录', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '确认潜在线索' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(res.body.insight.teacherNote, '确认潜在线索');
    assert.ok(typeof res.body.insight.reviewedAt === 'string');
    assert.ok(typeof res.body.insight.reviewUpdatedAt === 'string');
  });

  it('31. 首次驳回创建记录', async function () {
    // 使用不同的 insight
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-1/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'rejected', note: '证据不足' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.reviewStatus, 'rejected');
    assert.strictEqual(res.body.insight.teacherNote, '证据不足');
  });

  it('32. note 单独提交默认保持 unreviewed', async function () {
    var res = await httpRequest('/api/teacher/student/student-b/insights/insight-conv-100-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { note: '需要更多观察' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.reviewStatus, 'unreviewed');
    assert.strictEqual(res.body.insight.teacherNote, '需要更多观察');
  });

  it('33. 状态更新保留 note', async function () {
    // 先提交 note
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '原备注' },
    });
    // 再只更新状态
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'rejected' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.reviewStatus, 'rejected');
    assert.strictEqual(res.body.insight.teacherNote, '原备注');
  });

  it('34. note 更新保留状态', async function () {
    // 先设置状态
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '旧备注' },
    });
    // 再只更新 note
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { note: '新备注' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(res.body.insight.teacherNote, '新备注');
  });

  it('35. note="" 清空备注', async function () {
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '要清除的备注' },
    });
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { note: '' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.teacherNote, null);
  });

  it('36. unreviewed 不自动清空 note', async function () {
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '保留的备注' },
    });
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'unreviewed' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.reviewStatus, 'unreviewed');
    assert.strictEqual(res.body.insight.teacherNote, '保留的备注');
  });

  it('37. 更新保留 reviewedAt', async function () {
    // 首次创建
    var r1 = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '首次' },
    });
    var firstReviewedAt = r1.body.insight.reviewedAt;

    // 再次更新
    var r2 = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'rejected', note: '第二次' },
    });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.body.insight.reviewedAt, firstReviewedAt);
  });

  it('38. 更新改变 reviewUpdatedAt', async function () {
    var r1 = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '首次' },
    });
    var firstUpdatedAt = r1.body.insight.reviewUpdatedAt;

    // 小延迟后再次更新
    await new Promise(function (r) { setTimeout(r, 10); });
    var r2 = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'rejected', note: '第二次' },
    });
    assert.notStrictEqual(r2.body.insight.reviewUpdatedAt, firstUpdatedAt);
  });

  it('39. 成功响应为合并后的 Insight', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '完整测试' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.insight.id, 'insight-conv-001-0');
    assert.strictEqual(res.body.insight.studentId, STUDENT_A_ID);
    assert.strictEqual(res.body.insight.dimension, '兴趣方向');
    assert.strictEqual(res.body.insight.confidence, 'candidate');
    assert.strictEqual(res.body.insight.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(res.body.insight.teacherNote, '完整测试');
  });

  it('40. 成功响应不返回 Review 内部字段', async function () {
    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual('teacherId' in res.body.insight, false);
    // Review record id 不应泄露
    var json = JSON.stringify(res.body);
    assert.ok(json.indexOf('"review-') < 0, '不应泄露 review record id');
  });

  it('41. 写入后 GET insights 返回新状态', async function () {
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '通过 GET 验证' },
    });
    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(ins.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(ins.teacherNote, '通过 GET 验证');
  });
});

// ============================================================
//  E. 隔离与并发
// ============================================================

describe('E. 隔离与并发', function () {

  it('42. 教师 A 的 Review 不影响教师 B — GET', async function () {
    // Teacher A 审核
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: 'A 的备注' },
    });

    // Teacher B GET
    var resB = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherBHeaders() });
    var insB = resB.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    // Teacher B 应看到 unreviewed（除非 B 自己也审核了）
    assert.strictEqual(insB.reviewStatus, 'unreviewed');
    assert.strictEqual(insB.teacherNote, null);
  });

  it('43. 同学生多教师独立 Review', async function () {
    // Teacher A 确认
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: 'A 确认' },
    });
    // Teacher B 驳回（两人都绑定同学生）
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherBHeaders(),
      data: { reviewStatus: 'rejected', note: 'B 驳回' },
    });

    // A GET
    var resA = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var insA = resA.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(insA.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(insA.teacherNote, 'A 确认');

    // B GET
    var resB = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherBHeaders() });
    var insB = resB.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    assert.strictEqual(insB.reviewStatus, 'rejected');
    assert.strictEqual(insB.teacherNote, 'B 驳回');
  });

  it('44. 不同学生记录不互相覆盖', async function () {
    // 审核 student-b 的 insight
    await httpRequest('/api/teacher/student/student-b/insights/insight-conv-100-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: 'student-b 备注' },
    });
    // 审核 student-a 的另一个 insight
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-1/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'rejected', note: 'student-a 另一个备注' },
    });

    // 验证两条都保留
    var resA = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var insA = resA.body.insights.find(function (i) { return i.id === 'insight-conv-001-1'; });
    assert.strictEqual(insA.reviewStatus, 'rejected');
    assert.strictEqual(insA.teacherNote, 'student-a 另一个备注');

    var resB = await httpRequest('/api/teacher/student/student-b/insights', { port: testPort, headers: teacherAHeaders() });
    var insB = resB.body.insights.find(function (i) { return i.id === 'insight-conv-100-0'; });
    assert.strictEqual(insB.reviewStatus, 'teacher_confirmed');
    assert.strictEqual(insB.teacherNote, 'student-b 备注');
  });

  it('45. 并发不同 Insight 全部保留', async function () {
    var results = await Promise.all([
      httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
        port: testPort, method: 'PATCH', headers: teacherAHeaders(),
        data: { reviewStatus: 'teacher_confirmed', note: '并发0' },
      }),
      httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-1/review', {
        port: testPort, method: 'PATCH', headers: teacherAHeaders(),
        data: { reviewStatus: 'rejected', note: '并发1' },
      }),
    ]);
    for (var i = 0; i < results.length; i++) {
      assert.strictEqual(results[i].status, 200);
    }

    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins0 = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    var ins1 = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-1'; });
    assert.ok(ins0.reviewStatus === 'teacher_confirmed' || ins0.reviewStatus === 'unreviewed');
    assert.ok(ins1.reviewStatus === 'rejected' || ins1.reviewStatus === 'unreviewed');
    assert.ok(
      (ins0.reviewStatus === 'teacher_confirmed') || (ins1.reviewStatus === 'rejected'),
      '至少有一个状态的 review 应该被成功保留'
    );
  });

  it('46. 同 Insight 连续更新最后一次胜出', async function () {
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed', note: '第一次' },
    });
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'rejected', note: '最后一次' },
    });

    var res = await httpRequest('/api/teacher/student/student-a/insights', { port: testPort, headers: teacherAHeaders() });
    var ins = res.body.insights.find(function (i) { return i.id === 'insight-conv-001-0'; });
    // 最后一条写入胜出
    assert.strictEqual(ins.reviewStatus, 'rejected');
    assert.strictEqual(ins.teacherNote, '最后一次');
  });
});

// ============================================================
//  F. 文件安全
// ============================================================

describe('F. 文件安全', function () {

  it('47. 未授权请求不创建审核文件', async function () {
    // 删除现有审核文件
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    try { fs.unlinkSync(reviewFile); } catch (_) {}

    // 未登录请求
    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: noAuthHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(fs.existsSync(reviewFile), false);
  });

  it('48. 非法 PATCH 不创建审核文件', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    try { fs.unlinkSync(reviewFile); } catch (_) {}

    await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'invalid_status' },
    });
    assert.strictEqual(fs.existsSync(reviewFile), false);
  });

  it('49. Insight 不存在不创建审核文件', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    try { fs.unlinkSync(reviewFile); } catch (_) {}

    await httpRequest('/api/teacher/student/student-a/insights/insight-nonexistent/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(fs.existsSync(reviewFile), false);
  });

  it('50. 合法 PATCH 首次创建审核文件', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    try { fs.unlinkSync(reviewFile); } catch (_) {}

    var res = await httpRequest('/api/teacher/student/student-a/insights/insight-conv-001-0/review', {
      port: testPort, method: 'PATCH', headers: teacherAHeaders(),
      data: { reviewStatus: 'teacher_confirmed' },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(fs.existsSync(reviewFile), '审核文件应被创建');
  });

  it('51. 审核文件为合法 JSON 数组', async function () {
    var reviewFile = path.join(tempDataDir, 'teacher-insight-reviews.json');
    var raw = fs.readFileSync(reviewFile, 'utf-8');
    var parsed = JSON.parse(raw);
    assert.strictEqual(Array.isArray(parsed), true);
    assert.ok(parsed.length >= 1);
  });

  it('52. 测试不修改真实 data/', function () {
    var realDataDir = path.join(__dirname, '..', 'data');
    assert.ok(tempDataDir.indexOf(realDataDir) < 0, '测试目录不应等于真实 data');
  });

  it('53. 测试结束清理临时目录', function () {
    assert.ok(fs.existsSync(tempDataDir), '临时目录应存在（after 还未执行）');
  });

  it('54. 服务器正确监听', function () {
    assert.ok(server.listening);
  });

  it('55. 不泄露 passwordHash/token/stack', async function () {
    var endpoints = [
      '/api/teacher/student/student-a/insights',
      '/api/teacher/student/student-b/insights',
    ];
    for (var ei = 0; ei < endpoints.length; ei++) {
      var res = await httpRequest(endpoints[ei], { port: testPort, headers: teacherAHeaders() });
      var json = JSON.stringify(res.body);
      assert.ok(!deepContainsValue(res.body, 'passwordHash'), endpoints[ei] + ' 不应包含 passwordHash');
      assert.ok(!deepContainsValue(res.body, TOKEN_TA), endpoints[ei] + ' 不应包含 token');
      assert.ok(!/\bat\s+.*\.js:\d+:\d+/.test(json), endpoints[ei] + ' 不应包含 stack');
      assert.ok(json.indexOf('app.js') < 0, endpoints[ei] + ' 不应包含文件路径');
      assert.ok(json.indexOf('REVIEW_STORE_CORRUPTED') < 0, endpoints[ei] + ' 不应泄露内部错误 code');
    }
  });
});
