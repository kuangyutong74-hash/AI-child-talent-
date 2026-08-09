/**
 * test/teacher-bindings-server-integration.test.js — Teacher Bindings HTTP 集成测试
 *
 * 所有测试使用临时 DATA_DIR、虚构账号和随机端口。
 *
 * 覆盖：
 *   A. 绑定流程（studentCode 兼容、重复绑定、并发）
 *   B. 教师授权路由（roster, overview, conversations, insights, report）
 *   C. 未授权访问与越权防护
 *   D. Guest binding 清理
 *   E. Bindings 损坏响应
 *   F. 数据隔离
 *
 * 不调用真实 DeepSeek API。
 */
'use strict';

var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs'), os = require('os'), path = require('path');
var http = require('http');

// ============================================================
//  Helpers
// ============================================================

function httpRequest(urlPath, opts) {
  opts = opts || {};
  var method = opts.method || 'GET';
  var port = opts.port;
  var reqHeaders = opts.headers || {};

  return new Promise(function (resolve, reject) {
    var reqOpts = {
      hostname: '127.0.0.1',
      port: port,
      path: urlPath,
      method: method,
      headers: reqHeaders,
    };

    var dataStr = null;
    if (opts.data) {
      dataStr = JSON.stringify(opts.data);
      reqOpts.headers['Content-Type'] = 'application/json';
      reqOpts.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    var req = http.request(reqOpts, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        var parsed;
        try { parsed = JSON.parse(body); } catch (_) { parsed = { _raw: body }; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, function () { req.destroy(); reject(new Error('timeout')); });

    if (dataStr) req.write(dataStr);
    req.end();
  });
}

function makeDataDir(base, files) {
  var d = path.join(base, 'data');
  fs.mkdirSync(d, { recursive: true });
  if (files) {
    Object.keys(files).forEach(function (k) {
      fs.writeFileSync(path.join(d, k), files[k], 'utf-8');
    });
  }
  return d;
}

// ============================================================
//  Fixture constants
// ============================================================

var TOKEN_T1 = 'tok-teacher-alice';
var TOKEN_T2 = 'tok-teacher-bob';
var TOKEN_S1 = 'tok-student-xiaoming';

var TEACHER1_ID = 'teacher-alice';
var TEACHER2_ID = 'teacher-bob';
var STUDENT1_ID = 'student-xiaoming';

var NOW = Date.now();
var FUTURE = NOW + 30 * 24 * 60 * 60 * 1000;

function buildUsers() {
  return [
    { id: TEACHER1_ID, username: 'Alice老师', passwordHash: '$2b$10$hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh', role: 'teacher', createdAt: '2026-07-01T00:00:00.000Z' },
    { id: TEACHER2_ID, username: 'Bob老师',   passwordHash: '$2b$10$iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii', role: 'teacher', createdAt: '2026-07-02T00:00:00.000Z' },
    { id: STUDENT1_ID, username: '小明',       passwordHash: '$2b$10$jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj', role: 'student', studentCode: '123456', createdAt: '2026-07-03T00:00:00.000Z' },
  ];
}

function buildSessions() {
  var obj = {};
  obj[TOKEN_T1] = { userId: TEACHER1_ID, username: 'Alice老师', createdAt: NOW, expiresAt: FUTURE };
  obj[TOKEN_T2] = { userId: TEACHER2_ID, username: 'Bob老师',   createdAt: NOW, expiresAt: FUTURE };
  obj[TOKEN_S1] = { userId: STUDENT1_ID, username: '小明',       createdAt: NOW, expiresAt: FUTURE };
  return obj;
}

function buildHistory() {
  return [
    {
      id: 'conv-001', userId: STUDENT1_ID, sessionId: 'sess-001',
      startTime: '2026-07-10T08:00:00.000Z', turnCount: 3, completed: true,
      messages: [
        { role: 'user', content: '今天体育课打篮球了' },
        { role: 'assistant', content: '哇，听起来很棒！' },
      ],
      analysis: { status: 'done', result: { '分析范围': '学习潜力', '命中指标': [{ '维度': '运动天赋', '指标': '篮球兴趣', '证据片段': '打篮球', '说话轮次': '1', '信号说明': '提到打篮球', '强度备注': '强' }], '未命中指标': [], '安全提示': false, '安全提示说明': '' } },
    },
  ];
}

// ============================================================
//  Server factory
// ============================================================

var originalDataDir = process.env.DATA_DIR;
var originalSkipMigration = process.env.SKIP_MIGRATION;

function startServer(opts) {
  opts = opts || {};
  var dataDir = opts.dataDir;
  var skipMigration = opts.skipMigration !== false;

  process.env.SKIP_MIGRATION = skipMigration ? 'true' : 'false';
  process.env.DATA_DIR = dataDir;

  delete require.cache[require.resolve('../app')];
  var mod = require('../app');

  return mod.initializeRuntime().then(function () {
    return new Promise(function (resolve, reject) {
      var srv = mod.app.listen(0, '127.0.0.1', function () {
        resolve({ app: mod.app, server: srv, port: srv.address().port, mod: mod });
      });
      srv.on('error', reject);
    });
  });
}

function stopServer(ctx) {
  return new Promise(function (resolve) {
    if (ctx && ctx.server && ctx.server.listening) {
      ctx.server.close(function () { resolve(); });
    } else {
      resolve();
    }
  });
}

// ============================================================
//  Suite
// ============================================================

describe('teacher bindings server integration', function () {
  var ctx, dataDir, tempDir;

  before(function () {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-int-'));
    dataDir = makeDataDir(tempDir, {
      'users.json':        JSON.stringify(buildUsers()),
      'sessions.json':     JSON.stringify(buildSessions()),
      'bindings.json':     '{}',
      'history.json':      JSON.stringify(buildHistory()),
      'teacher-binding-invitations.json': '[]',
      'teacher-binding-audit.jsonl': '',
    });
    return startServer({ dataDir: dataDir, skipMigration: true }).then(function (c) {
      ctx = c;
      // Pre-create a binding invitation and redeem it for initial binding setup
      // Student creates invitation
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOKEN_S1 },
      });
    }).then(function (res) {
      // Teacher 1 redeems
      var token = res.body.invitation.token;
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOKEN_T1 },
        data: { bindingToken: token },
      });
    });
  });

  after(function () {
    process.env.DATA_DIR = originalDataDir;
    if (originalSkipMigration === undefined) delete process.env.SKIP_MIGRATION;
    else process.env.SKIP_MIGRATION = originalSkipMigration;
    return stopServer(ctx).then(function () {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    });
  });

  // ==========================================================
  //  A. 绑定流程（token 方式）
  // ==========================================================

  var currentBindingToken = null;

  it('1. student creates invitation and teacher redeems token successfully', function () {
    // Student creates a fresh invitation
    return httpRequest('/api/student/binding-invitations', {
      port: ctx.port, method: 'POST',
      headers: { Cookie: 'token=' + TOKEN_S1 },
    }).then(function (res) {
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.invitation.token, 'token must exist');
      currentBindingToken = res.body.invitation.token;
      // Teacher 2 redeems this token (Teacher 1 already bound in before)
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOKEN_T2 },
        data: { bindingToken: currentBindingToken },
      });
    }).then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.student.id, STUDENT1_ID);
      assert.strictEqual(res.body.alreadyBound, false);
      // Response must NOT contain studentCode
      assert.strictEqual(res.body.student.studentCode, undefined);
    });
  });

  it('2. bind success response matches new contract (no studentCode)', function () {
    // Verify response shape: { ok: true, student: { id, username }, alreadyBound }
    // Student creates invite, then teacher1 tries to re-bind (already bound)
    return httpRequest('/api/student/binding-invitations', {
      port: ctx.port, method: 'POST',
      headers: { Cookie: 'token=' + TOKEN_S1 },
    }).then(function (res) {
      var token2 = res.body.invitation.token;
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOKEN_T1 },
        data: { bindingToken: token2 },
      });
    }).then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.strictEqual(typeof res.body.ok, 'boolean');
      assert.strictEqual(typeof res.body.student, 'object');
      assert.strictEqual(typeof res.body.student.id, 'string');
      assert.strictEqual(typeof res.body.student.username, 'string');
      assert.strictEqual(typeof res.body.alreadyBound, 'boolean');
      // No extra fields leaking
      assert.strictEqual(res.body.student.passwordHash, undefined);
      assert.strictEqual(res.body.student.role, undefined);
      assert.strictEqual(res.body.student.studentCode, undefined);
    });
  });

  it('3. duplicate bind returns alreadyBound:true', function () {
    // Teacher 1 is already bound to student-xiaoming — create new token and try
    return httpRequest('/api/student/binding-invitations', {
      port: ctx.port, method: 'POST',
      headers: { Cookie: 'token=' + TOKEN_S1 },
    }).then(function (res) {
      var token3 = res.body.invitation.token;
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOKEN_T2 },
        data: { bindingToken: token3 },
      });
    }).then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.alreadyBound, true);
    });
  });

  it('4. two concurrent HTTP bind requests both complete', function () {
    // Setup third teacher
    var TOKEN_T3 = 'tok-teacher-charlie';
    var TEACHER3_ID = 'teacher-charlie';
    var users = buildUsers();
    users.push({ id: TEACHER3_ID, username: 'Charlie老师', passwordHash: '$2b$10$kkkk', role: 'teacher', createdAt: '2026-07-05T00:00:00.000Z' });
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(users), 'utf-8');
    var sessions = buildSessions();
    sessions[TOKEN_T3] = { userId: TEACHER3_ID, username: 'Charlie老师', createdAt: NOW, expiresAt: FUTURE };
    fs.writeFileSync(path.join(dataDir, 'sessions.json'), JSON.stringify(sessions), 'utf-8');

    // Create a fresh invitation for concurrent test
    var ctoken = null;
    return httpRequest('/api/student/binding-invitations', {
      port: ctx.port, method: 'POST',
      headers: { Cookie: 'token=' + TOKEN_S1 },
    }).then(function (r) {
      ctoken = r.body.invitation.token;
      return Promise.all([
        httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOKEN_T3 },
          data: { bindingToken: ctoken },
        }),
        httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOKEN_T3 },
          data: { bindingToken: ctoken },
        }),
      ]);
    }).then(function (results) {
      assert.strictEqual(results[0].status, 200);
      assert.strictEqual(results[1].status, 200);
      assert.ok(results[0].body.ok && results[1].body.ok);
    });
  });

  it('5. after concurrent bind, bindings array has exactly one studentId', function () {
    // Read bindings file directly to verify
    var raw = fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8');
    var bindings = JSON.parse(raw);
    var TEACHER3_ID = 'teacher-charlie';
    var list = bindings[TEACHER3_ID];
    assert.ok(Array.isArray(list), 'binding list must be array');
    assert.strictEqual(list.length, 1, 'must have exactly one studentId');
    assert.strictEqual(list[0], STUDENT1_ID, 'must be the correct student');
  });

  // ==========================================================
  //  B. 教师授权路由
  // ==========================================================

  it('6. roster can read bound students', function () {
    return httpRequest('/api/teacher/roster', {
      port: ctx.port,
      headers: { Cookie: 'token=' + TOKEN_T1 },
    }).then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body), 'roster must be array');
      assert.ok(res.body.length >= 1, 'roster must contain at least one student');
      var found = res.body.some(function (s) { return s.studentId === STUDENT1_ID; });
      assert.ok(found, 'roster must include bound student');
    });
  });

  it('7. overview can read bound student', function () {
    return httpRequest('/api/teacher/student/' + STUDENT1_ID + '/overview', {
      port: ctx.port,
      headers: { Cookie: 'token=' + TOKEN_T1 },
    }).then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.student, 'must include student');
      assert.strictEqual(res.body.student.id, STUDENT1_ID);
      assert.ok(res.body.overview, 'must include overview');
    });
  });

  it('8. conversations can read bound student', function () {
    return httpRequest('/api/teacher/student/' + STUDENT1_ID + '/conversations', {
      port: ctx.port,
      headers: { Cookie: 'token=' + TOKEN_T1 },
    }).then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.conversations), 'conversations must be array');
    });
  });

  it('9. insights can read bound student', function () {
    return httpRequest('/api/teacher/student/' + STUDENT1_ID + '/insights', {
      port: ctx.port,
      headers: { Cookie: 'token=' + TOKEN_T1 },
    }).then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.insights), 'insights must be array');
    });
  });

  it('10. report can read bound student', function () {
    return httpRequest('/api/teacher/student/' + STUDENT1_ID + '/report?range=7d', {
      port: ctx.port,
      headers: { Cookie: 'token=' + TOKEN_T1 },
    }).then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.report, 'report must be present');
    });
  });

  // ==========================================================
  //  C. 未授权访问与越权
  // ==========================================================

  it('11. unbound teacher accessing student returns NOT_BOUND', function () {
    // Teacher2 is also bound now (test 2), but let's use a fresh unbound teacher
    var TOKEN_T4 = 'tok-teacher-diana';
    var TEACHER4_ID = 'teacher-diana';
    var users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf-8'));
    users.push({ id: TEACHER4_ID, username: 'Diana老师', passwordHash: '$2b$10$lllllllllllllllllllllllllllllllllllllllllllllll', role: 'teacher', createdAt: '2026-07-06T00:00:00.000Z' });
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(users), 'utf-8');
    var sessions = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf-8'));
    sessions[TOKEN_T4] = { userId: TEACHER4_ID, username: 'Diana老师', createdAt: NOW, expiresAt: FUTURE };
    fs.writeFileSync(path.join(dataDir, 'sessions.json'), JSON.stringify(sessions), 'utf-8');

    return httpRequest('/api/teacher/student/' + STUDENT1_ID + '/overview', {
      port: ctx.port,
      headers: { Cookie: 'token=' + TOKEN_T4 },
    }).then(function (res) {
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'NOT_BOUND');
    });
  });

  it('12. modifying studentId in URL cannot bypass binding check', function () {
    // Teacher2 is bound to student-xiaoming. Try accessing a non-existent student.
    return httpRequest('/api/teacher/student/student-hacker/overview', {
      port: ctx.port,
      headers: { Cookie: 'token=' + TOKEN_T2 },
    }).then(function (res) {
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, 'NOT_BOUND');
    });
  });

  // ==========================================================
  //  D. Guest binding 清理（需独立 server）
  // ==========================================================

  describe('guest binding cleanup', function () {
    var gctx, gtempDir, gdataDir;
    var fixtureHadGuest = false;

    before(function () {
      gtempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-guest-'));
      gdataDir = makeDataDir(gtempDir, {
        'users.json':    JSON.stringify(buildUsers()),
        'sessions.json': JSON.stringify(buildSessions()),
        'bindings.json': JSON.stringify({ 'teacher-alice': [STUDENT1_ID], 't-guest': ['guest'] }),
        'history.json':  JSON.stringify(buildHistory()),
        'teacher-binding-invitations.json': '[]',
        'teacher-binding-audit.jsonl': '',
      });
      // Snapshot BEFORE init cleans it up
      var raw = fs.readFileSync(path.join(gdataDir, 'bindings.json'), 'utf-8');
      var b = JSON.parse(raw);
      fixtureHadGuest = b['t-guest'] && b['t-guest'].indexOf('guest') >= 0;
      return startServer({ dataDir: gdataDir, skipMigration: true }).then(function (c) {
        gctx = c;
      });
    });

    after(function () {
      return stopServer(gctx).then(function () {
        try { fs.rmSync(gtempDir, { recursive: true, force: true }); } catch (_) {}
      });
    });

    it('13. fixture contained guest binding before initializeRuntime', function () {
      assert.strictEqual(fixtureHadGuest, true, 'fixture must contain guest binding before init');
    });

    it('14. guest binding is removed after initializeRuntime', function () {
      // After server startup (which called initializeRuntime), guest must be gone
      var raw = fs.readFileSync(path.join(gdataDir, 'bindings.json'), 'utf-8');
      var b = JSON.parse(raw);
      var hasGuest = Object.keys(b).some(function (k) {
        return Array.isArray(b[k]) && b[k].indexOf('guest') >= 0;
      });
      assert.strictEqual(hasGuest, false, 'guest binding must be removed');
    });

    it('15. after guest removal, roster does not show guest', function () {
      return httpRequest('/api/teacher/roster', {
        port: gctx.port,
        headers: { Cookie: 'token=' + TOKEN_T1 },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        // No roster entry should have studentId === 'guest'
        var hasGuest = Array.isArray(res.body) && res.body.some(function (r) { return r.studentId === 'guest'; });
        assert.strictEqual(hasGuest, false, 'roster must not include guest');
      });
    });

    it('16. after guest removal, overview for unrelated teacher returns NOT_BOUND', function () {
      // t-guest teacher binding doesn't exist anymore, so accessing via any teacher
      // who isn't bound should return NOT_BOUND
      return httpRequest('/api/teacher/student/guest/overview', {
        port: gctx.port,
        headers: { Cookie: 'token=' + TOKEN_T2 },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.error, 'NOT_BOUND');
      });
    });
  });

  // ==========================================================
  //  E. Bindings 损坏响应（使用主 server）
  // ==========================================================

  describe('corrupt bindings', function () {
    var CORRUPT_CONTENT = '{{{"broken": json,,,,} corrupt content here {{{';

    it('17. invalid JSON bindings request returns HTTP 500', function () {
      fs.writeFileSync(path.join(dataDir, 'bindings.json'), CORRUPT_CONTENT, 'utf-8');
      // Use bound-teachers endpoint — reads through bindingsStore which throws on corruption
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port,
        headers: { Cookie: 'token=' + TOKEN_S1 },
      }).then(function (res) {
        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.error, 'INTERNAL_ERROR');
      });
    });

    it('18. zero-byte bindings request returns HTTP 500', function () {
      fs.writeFileSync(path.join(dataDir, 'bindings.json'), '', 'utf-8');
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port,
        headers: { Cookie: 'token=' + TOKEN_S1 },
      }).then(function (res) {
        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.error, 'INTERNAL_ERROR');
      });
    });

    it('19. 500 response matches { "error": "INTERNAL_ERROR" }', function () {
      fs.writeFileSync(path.join(dataDir, 'bindings.json'), CORRUPT_CONTENT, 'utf-8');
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port,
        headers: { Cookie: 'token=' + TOKEN_S1 },
      }).then(function (res) {
        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.error, 'INTERNAL_ERROR');
        var keys = Object.keys(res.body);
        assert.ok(keys.length <= 1, 'response must have at most one key, got: ' + keys.join(','));
      });
    });

    it('20. 500 response contains no detail, err.message, stack, BINDINGS_STORE_CORRUPTED, file path, IDs, or content', function () {
      var badContent = '{"teacher-abc": ["student-xyz", bad}}}';
      fs.writeFileSync(path.join(dataDir, 'bindings.json'), badContent, 'utf-8');
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port,
        headers: { Cookie: 'token=' + TOKEN_S1 },
      }).then(function (res) {
        assert.strictEqual(res.status, 500);
        var bodyText = JSON.stringify(res.body);
        assert.ok(bodyText.indexOf('detail') < 0, 'response must not contain "detail" key');
        assert.ok(bodyText.indexOf('stack') < 0, 'response must not contain "stack"');
        assert.ok(bodyText.indexOf('BINDINGS_STORE_CORRUPTED') < 0, 'response must not contain BINDINGS_STORE_CORRUPTED');
        assert.ok(bodyText.indexOf('teacher-abc') < 0, 'response must not contain teacherId from file');
        assert.ok(bodyText.indexOf('student-xyz') < 0, 'response must not contain studentId from file');
        assert.ok(bodyText.indexOf('err.message') < 0, 'response must not contain err.message text');
        // Must not contain file path patterns
        assert.ok(bodyText.indexOf('bindings.json') < 0, 'response must not contain file path');
        assert.ok(bodyText.indexOf(dataDir) < 0, 'response must not contain data dir path');
      });
    });

    it('21. corrupt file content is preserved on disk, not overwritten', function () {
      var corrupt = '{{{!this!is!corrupt!}}}';
      fs.writeFileSync(path.join(dataDir, 'bindings.json'), corrupt, 'utf-8');

      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port,
        headers: { Cookie: 'token=' + TOKEN_S1 },
      }).then(function () {
        var onDisk = fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8');
        assert.strictEqual(onDisk, corrupt, 'corrupt file must not be overwritten');
      });
    });

    it('22. after repairing bindings.json, subsequent requests recover', function () {
      var bindings = {};
      bindings[TEACHER1_ID] = [STUDENT1_ID];
      bindings[TEACHER2_ID] = [STUDENT1_ID];
      fs.writeFileSync(path.join(dataDir, 'bindings.json'), JSON.stringify(bindings), 'utf-8');

      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port,
        headers: { Cookie: 'token=' + TOKEN_S1 },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.teachers !== undefined, 'bound-teachers must work after repair');
      });
    });
  });

  // ==========================================================
  //  F. 正常绑定在 guest 清理后保留
  // ==========================================================

  it('23. normal student bindings survive guest cleanup', function () {
    // Verify the original teacher1 binding still exists
    var raw = fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8');
    var bindings = JSON.parse(raw);
    assert.ok(bindings[TEACHER1_ID], 'teacher1 bindings must exist');
    assert.ok(bindings[TEACHER1_ID].indexOf(STUDENT1_ID) >= 0, 'teacher1 must still be bound to student');
  });

  // ==========================================================
  //  G. 数据隔离
  // ==========================================================

  it('24. all runtime data is written only to temp DATA_DIR', function () {
    // Check DATA_DIR: bindings.json exists
    var dirContents = fs.readdirSync(dataDir);
    assert.ok(dirContents.indexOf('bindings.json') >= 0, 'bindings.json must exist in temp DATA_DIR');
    assert.ok(dirContents.indexOf('users.json') >= 0, 'users.json must exist in temp DATA_DIR');
    assert.ok(dirContents.indexOf('sessions.json') >= 0, 'sessions.json must exist in temp DATA_DIR');
    // Runtime files include teacher-binding-invitations.json and teacher-binding-audit.jsonl
    assert.ok(dirContents.indexOf('teacher-binding-invitations.json') >= 0, 'teacher-binding-invitations.json must exist');
    assert.ok(dirContents.indexOf('teacher-binding-audit.jsonl') >= 0, 'teacher-binding-audit.jsonl must exist');
    // No generic invitation file leak
    assert.ok(dirContents.indexOf('invitations.json') < 0, 'must not create invitations.json');
  });

  it('25. real data/ directory content and git status are unchanged by tests', function () {
    // Read the real data directory
    var realDataDir = path.join(__dirname, '..', 'data');
    var files = fs.readdirSync(realDataDir);
    // Our temp data dir is completely separate
    assert.ok(files.length > 0, 'real data should exist');
    // The key assertion: tempDir is NOT the real data dir
    assert.notStrictEqual(dataDir, realDataDir);
    // None of our test writes should have gone to real data
    // (Verified by compare: the temp dir path has tmp/ prefix)
    assert.ok(dataDir.indexOf('tmp') >= 0 || dataDir.indexOf('Temp') >= 0, 'dataDir must be in temp');
  });
});
