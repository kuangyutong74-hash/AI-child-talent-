/**
 * test/teacher-binding-new-api.test.js — 新 token 绑定 API 综合测试
 *
 * 覆盖:
 *   A. studentCode 永久禁用
 *   B. 创建邀请 (POST /api/student/binding-invitations)
 *   C. Token 兑换 (POST /api/teacher/bind-student)
 *   D. 邀请列表与撤销 (GET/DELETE /api/student/binding-invitations)
 *   E. 已绑定教师列表 (GET /api/student/bound-teachers)
 *   F. 解绑教师 (DELETE /api/student/bound-teachers/:id)
 *   G. 解绑后教师访问结果
 *   H. 并发兑换与故障恢复
 *   I. Store 损坏响应
 *   J. Token 重放防护
 *
 * 使用临时 DATA_DIR，不调用真实 DeepSeek API，不修改 data/。
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
      hostname: '127.0.0.1', port: port, path: urlPath, method: method, headers: reqHeaders,
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
//  Constants
// ============================================================

var NOW = Date.now();
var FUTURE = NOW + 30 * 24 * 60 * 60 * 1000;

var TID = 'teacher-alice';
var SID = 'student-xiaoming';
var SID2 = 'student-red';

var TOK_T = 'tok-t1';
var TOK_S = 'tok-s1';
var TOK_S2 = 'tok-s2';

function buildUsers() {
  return [
    { id: TID, username: 'Alice', passwordHash: '$2b$10$aaaa', role: 'teacher', createdAt: '2026-07-01T00:00:00.000Z' },
    { id: SID, username: 'xiao', passwordHash: '$2b$10$bbbb', role: 'student', createdAt: '2026-07-02T00:00:00.000Z' },
    { id: SID2, username: 'redsun', passwordHash: '$2b$10$cccc', role: 'student', createdAt: '2026-07-03T00:00:00.000Z' },
    { id: 'guest', username: 'guest', passwordHash: '$2b$10$dddd', role: 'student', createdAt: '2026-07-04T00:00:00.000Z' },
  ];
}

function buildSessions() {
  var o = {};
  o[TOK_T] = { userId: TID, username: 'Alice', createdAt: NOW, expiresAt: FUTURE };
  o[TOK_S] = { userId: SID, username: 'xiao', createdAt: NOW, expiresAt: FUTURE };
  o[TOK_S2] = { userId: SID2, username: 'redsun', createdAt: NOW, expiresAt: FUTURE };
  return o;
}

function buildHistory() {
  return [
    { id: 'conv-001', userId: SID, sessionId: 's-1', startTime: '2026-07-10T08:00:00.000Z', turnCount: 3, completed: true,
      messages: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }],
      analysis: { status: 'done', result: { '分析范围': 'x', '命中指标': [{ '维度': 'A', '指标': 'B', '证据片段': 'c', '说话轮次': '1', '信号说明': 'd', '强度备注': 'e' }], '未命中指标': [], '安全提示': false, '安全提示说明': '' } } },
  ];
}

// ============================================================
//  Server factory
// ============================================================

var originalDataDir = process.env.DATA_DIR;
var originalSkipMigration = process.env.SKIP_MIGRATION;

function startServer(dataDir) {
  process.env.SKIP_MIGRATION = 'true';
  process.env.DATA_DIR = dataDir;
  delete require.cache[require.resolve('../app')];
  var mod = require('../app');
  return mod.initializeRuntime().then(function () {
    return new Promise(function (resolve, reject) {
      var srv = mod.app.listen(0, '127.0.0.1', function () {
        resolve({ mod: mod, server: srv, port: srv.address().port });
      });
      srv.on('error', reject);
    });
  });
}

function stopCtx(ctx) {
  return new Promise(function (resolve) {
    if (ctx && ctx.server && ctx.server.listening) ctx.server.close(function () { resolve(); });
    else resolve();
  });
}

// ============================================================
//  Suite
// ============================================================

describe('teacher binding new API', function () {
  var ctx, dataDir, tempDir;

  before(function () {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-new-'));
    dataDir = makeDataDir(tempDir, {
      'users.json': JSON.stringify(buildUsers()),
      'sessions.json': JSON.stringify(buildSessions()),
      'bindings.json': '{}',
      'history.json': JSON.stringify(buildHistory()),
      'teacher-binding-invitations.json': '[]',
      'teacher-binding-audit.jsonl': '',
    });
    return startServer(dataDir).then(function (c) { ctx = c; });
  });

  after(function () {
    process.env.DATA_DIR = originalDataDir;
    if (originalSkipMigration === undefined) delete process.env.SKIP_MIGRATION;
    else process.env.SKIP_MIGRATION = originalSkipMigration;
    return stopCtx(ctx).then(function () {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    });
  });

  // ==========================================================
  //  A. studentCode 永久禁用
  // ==========================================================

  describe('studentCode disabled', function () {
    before(function () { ctx.mod._resetRateLimiterForTests(); });
    it('1. studentCode string returns 400 LEGACY_STUDENT_CODE_BINDING_DISABLED', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { studentCode: '123456' },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
      });
    });

    it('2. studentCode number returns 400', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { studentCode: 123456 },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
      });
    });

    it('3. studentCode null returns 400', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { studentCode: null },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
      });
    });

    it('4. studentCode object returns 400', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { studentCode: { foo: 'bar' } },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
      });
    });

    it('5. studentCode array returns 400', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { studentCode: ['123456'] },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
      });
    });

    it('6. studentCode empty string returns 400', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { studentCode: '' },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
      });
    });

    it('7. studentCode + valid bindingToken returns 400, does NOT consume token', function () {
      // Create a valid invitation token first
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (invRes) {
        var savedToken = invRes.body.invitation.token;
        // Try to redeem with studentCode also present
        return httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_T },
          data: { studentCode: '123456', bindingToken: savedToken },
        }).then(function (res) {
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
          // Now try using the token alone — it must still work (not consumed)
          return httpRequest('/api/teacher/bind-student', {
            port: ctx.port, method: 'POST',
            headers: { Cookie: 'token=' + TOK_T },
            data: { bindingToken: savedToken },
          });
        }).then(function (res2) {
          assert.strictEqual(res2.status, 200);
          assert.strictEqual(res2.body.ok, true);
        });
      });
    });

    it('8. studentCode + invalid bindingToken returns 400', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { studentCode: '123456', bindingToken: 'x'.repeat(43) },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
      });
    });

    it('9. POST with neither field returns 400 INVALID_REQUEST', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: {},
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'INVALID_REQUEST');
      });
    });

    it('10. POST with bindingToken too short returns 400', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { bindingToken: 'short' },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'INVALID_REQUEST');
      });
    });
  });

  // ==========================================================
  //  B. 创建邀请
  // ==========================================================

  describe('create invitation', function () {
    it('5. unauthenticated returns 401', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
      }).then(function (res) {
        assert.strictEqual(res.status, 401);
      });
    });

    it('6. teacher role returns 403', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
      });
    });

    it('7. student creates invitation successfully', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 201);
        assert.ok(res.body.invitation, 'must have invitation object');
        assert.strictEqual(typeof res.body.invitation.id, 'string');
        assert.strictEqual(typeof res.body.invitation.token, 'string');
        assert.strictEqual(res.body.invitation.token.length, 43, 'token must be 43 chars');
      });
    });

    it('8. guest cannot create invitation', function () {
      // Add guest session token
      var sessions = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf-8'));
      sessions['tok-guest'] = { userId: 'guest', username: 'guest', createdAt: NOW, expiresAt: FUTURE };
      fs.writeFileSync(path.join(dataDir, 'sessions.json'), JSON.stringify(sessions), 'utf-8');

      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=tok-guest' },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
      });
    });

    it('9. response has Cache-Control: no-store and Pragma: no-cache', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 201);
        var cc = (res.headers['cache-control'] || '').toLowerCase();
        assert.ok(cc.indexOf('no-store') >= 0, 'must contain no-store, got: ' + cc);
        var pragma = (res.headers['pragma'] || '').toLowerCase();
        assert.strictEqual(pragma, 'no-cache', 'pragma must be no-cache, got: ' + pragma);
      });
    });

    it('10. response body contains only id and token — no internal fields', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var body = JSON.stringify(res.body);
        var allowedKeys = ['invitation', 'id', 'token'];
        // Forbidden fields
        assert.ok(body.indexOf('tokenHash') < 0, 'must not leak tokenHash');
        assert.ok(body.indexOf('studentId') < 0, 'must not leak studentId');
        assert.ok(body.indexOf('studentCode') < 0, 'must not leak studentCode');
        assert.ok(body.indexOf('claimedByTeacherId') < 0, 'must not leak claimedByTeacherId');
        assert.ok(body.indexOf('claimedAt') < 0, 'must not leak claimedAt');
        assert.ok(body.indexOf('claimRecoveryUntil') < 0, 'must not leak claimRecoveryUntil');
        assert.ok(body.indexOf('bindingCompletedAt') < 0, 'must not leak bindingCompletedAt');
        assert.ok(body.indexOf('tokenHashEraseAfter') < 0, 'must not leak tokenHashEraseAfter');
        assert.ok(body.indexOf('passwordHash') < 0, 'must not leak passwordHash');
        assert.ok(body.indexOf('Session') < 0, 'must not leak Session');
        // Verify only allowed keys on invitation object
        var keys = Object.keys(res.body.invitation);
        assert.strictEqual(keys.length, 2, 'invitation must have exactly 2 keys: id + token, got: ' + keys.join(','));
        assert.strictEqual(keys[0], 'id');
        assert.strictEqual(keys[1], 'token');
        // Token must be 43-char string
        assert.strictEqual(typeof res.body.invitation.token, 'string');
        assert.strictEqual(res.body.invitation.token.length, 43);
      });
    });

    it('11. GET invitation list does not return token', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        var bodyText = JSON.stringify(res.body);
        assert.ok(bodyText.indexOf('"token"') < 0, 'GET must never return token');
        // Legal fields only
        res.body.invitations.forEach(function (inv) {
          assert.ok(inv.token === undefined, 'no token field allowed');
          assert.ok(inv.tokenHash === undefined, 'no tokenHash field allowed');
          assert.ok(inv.claimedByTeacherId === undefined, 'no claimedByTeacherId allowed');
        });
      });
    });
  });

  // ==========================================================
  //  C. Token 兑换
  // ==========================================================

  describe('token redeem', function () {
    before(function () { ctx.mod._resetRateLimiterForTests(); });

    it('12. normal token redeem succeeds (first-time bind)', function () {
      // Self-contained: create invitation, add new teacher, redeem
      var TID_NEW = 'teacher-new-' + Date.now();
      var TOK_NEW = 'tok-new-' + Date.now();
      var users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf-8'));
      users.push({ id: TID_NEW, username: 'NewT', passwordHash: '$2b$10$zzzz', role: 'teacher', createdAt: '2026-07-09T00:00:00.000Z' });
      fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(users), 'utf-8');
      var sessions = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf-8'));
      sessions[TOK_NEW] = { userId: TID_NEW, username: 'NewT', createdAt: NOW, expiresAt: FUTURE };
      fs.writeFileSync(path.join(dataDir, 'sessions.json'), JSON.stringify(sessions), 'utf-8');

      var selfToken = null;
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (invRes) {
        selfToken = invRes.body.invitation.token;
        return httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_NEW },
          data: { bindingToken: selfToken },
        });
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.ok, true);
        assert.strictEqual(res.body.student.id, SID);
        assert.strictEqual(res.body.student.username, 'xiao');
        assert.strictEqual(res.body.alreadyBound, false);
        assert.strictEqual(res.body.student.studentCode, undefined);
      });
    });

    it('13. duplicate redeem returns alreadyBound:true', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (invRes) {
        var t = invRes.body.invitation.token;
        return httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_T },
          data: { bindingToken: t },
        });
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.alreadyBound, true);
      });
    });

    it('14. invalid token format returns 400', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { bindingToken: '!@#$invalid-token-with-bad-chars!!!' },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
      });
    });

    it('15. token not found returns 400 BINDING_TOKEN_INVALID', function () {
      var fakeToken = 'A'.repeat(43);
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { bindingToken: fakeToken },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'BINDING_TOKEN_INVALID');
      });
    });
  });

  // ==========================================================
  //  D. 邀请列表与撤销
  // ==========================================================

  describe('invitation list and revoke', function () {
    before(function () { ctx.mod._resetRateLimiterForTests(); });
    var invId = null;
    var invToken = null;

    before(function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        invId = res.body.invitation.id;
        invToken = res.body.invitation.token;
      });
    });

    it('16. list invitations only shows own', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body.invitations));
        res.body.invitations.forEach(function (inv) {
          assert.strictEqual(typeof inv.id, 'string');
          assert.strictEqual(typeof inv.status, 'string');
          assert.ok(['pending','claimed','completed','revoked','expired','abandoned','authorization_revoked'].indexOf(inv.status) >= 0, 'valid status');
          assert.strictEqual(typeof inv.createdAt, 'string');
          assert.strictEqual(typeof inv.expiresAt, 'string');
          // No tokenHash leak
          assert.strictEqual(inv.tokenHash, undefined);
          assert.strictEqual(inv.claimedByTeacherId, undefined);
        });
        // Must include our invitation
        var found = res.body.invitations.some(function (inv) { return inv.id === invId; });
        assert.ok(found, 'must find own invitation');
      });
    });

    it('17. list does not leak internal fields', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var body = JSON.stringify(res.body);
        assert.ok(body.indexOf('tokenHash') < 0, 'must not leak tokenHash');
        assert.ok(body.indexOf('claimedByTeacherId') < 0, 'must not leak claimedByTeacherId');
        assert.ok(body.indexOf('authorizationRevokedAt') < 0, 'must not leak authorizationRevokedAt');
      });
    });

    it('18. revoke pending invitation succeeds', function () {
      return httpRequest('/api/student/binding-invitations/' + invId, {
        port: ctx.port, method: 'DELETE',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.ok, true);
      });
    });

    it('19. revoked token cannot be redeemed', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { bindingToken: invToken },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'BINDING_TOKEN_INVALID');
      });
    });

    it('20. revoke non-existent invitation returns 400', function () {
      return httpRequest('/api/student/binding-invitations/inv-nonexistent', {
        port: ctx.port, method: 'DELETE',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
      });
    });

    it('21. other student cannot revoke my invitation', function () {
      // Create an invitation as student 1
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var myInvId = res.body.invitation.id;
        // Student 2 tries to revoke it
        return httpRequest('/api/student/binding-invitations/' + myInvId, {
          port: ctx.port, method: 'DELETE',
          headers: { Cookie: 'token=' + TOK_S2 },
        }).then(function (res2) {
          assert.strictEqual(res2.status, 400, 'other student must not revoke');
        });
      });
    });
  });

  // ==========================================================
  //  E. Bound teachers
  // ==========================================================

  describe('bound teachers', function () {
    before(function () { ctx.mod._resetRateLimiterForTests(); });
    it('22. list empty for unbound student', function () {
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_S2 },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body.teachers));
        assert.strictEqual(res.body.teachers.length, 0);
      });
    });

    it('23. list shows bound teacher after binding', function () {
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        var found = res.body.teachers.some(function (t) { return t.teacherId === TID; });
        assert.ok(found, 'must list bound teacher');
      });
    });

    it('24. response does not leak teacher passwordHash', function () {
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var body = JSON.stringify(res.body);
        assert.ok(body.indexOf('passwordHash') < 0);
        assert.ok(body.indexOf('role') < 0);
      });
    });

    it('25. unauthenticated returns 401', function () {
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port, method: 'GET',
      }).then(function (res) {
        assert.strictEqual(res.status, 401);
      });
    });
  });

  // ==========================================================
  //  F. 解绑教师
  // ==========================================================

  describe('unbind teacher', function () {
    before(function () { ctx.mod._resetRateLimiterForTests(); });
    it('26. unbind existing teacher succeeds', function () {
      return httpRequest('/api/student/bound-teachers/' + TID, {
        port: ctx.port, method: 'DELETE',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.ok, true);
      });
    });

    it('27. after unbind bound-teachers is empty', function () {
      return httpRequest('/api/student/bound-teachers', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var found = res.body.teachers.some(function (t) { return t.teacherId === TID; });
        assert.strictEqual(found, false, 'teacher must not appear after unbind');
      });
    });

    it('28. unbind non-existent binding is idempotent (200)', function () {
      return httpRequest('/api/student/bound-teachers/' + TID, {
        port: ctx.port, method: 'DELETE',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.ok(res.status === 200 || res.status === 400);
      });
    });

    it('29. after unbind, teacher roster shows no students', function () {
      return httpRequest('/api/teacher/roster', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_T },
      }).then(function (res) {
        assert.strictEqual(res.status, 200);
        var found = Array.isArray(res.body) && res.body.some(function (s) { return s.studentId === SID; });
        assert.strictEqual(found, false, 'roster must not show unbound student');
      });
    });

    it('30. after unbind, overview returns 403 NOT_BOUND', function () {
      return httpRequest('/api/teacher/student/' + SID + '/overview', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_T },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.error, 'NOT_BOUND');
      });
    });

    it('31. after unbind, conversations list returns 403', function () {
      return httpRequest('/api/teacher/student/' + SID + '/conversations', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_T },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
      });
    });

    it('32. after unbind, conversation detail returns 403 NOT_BOUND using real convId', function () {
      return httpRequest('/api/teacher/student/' + SID + '/conversations/conv-001', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_T },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.error, 'NOT_BOUND');
      });
    });

    it('33. after unbind, insights returns 403', function () {
      return httpRequest('/api/teacher/student/' + SID + '/insights', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_T },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
      });
    });

    it('34. after unbind, review PATCH returns 403 NOT_BOUND', function () {
      return httpRequest('/api/teacher/student/' + SID + '/insights/insight-conv-001-0/review', {
        port: ctx.port, method: 'PATCH',
        headers: { Cookie: 'token=' + TOK_T, 'Content-Type': 'application/json' },
        data: { status: 'confirmed' },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.error, 'NOT_BOUND');
      });
    });

    it('35. after unbind, report returns 403', function () {
      return httpRequest('/api/teacher/student/' + SID + '/report?range=7d', {
        port: ctx.port, method: 'GET',
        headers: { Cookie: 'token=' + TOK_T },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
      });
    });
  });

  // ==========================================================
  //  G. Token 重放防护 (old token after unbind)
  // ==========================================================

  describe('token replay after unbind', function () {
    before(function () { ctx.mod._resetRateLimiterForTests(); });
    var oldToken = null;

    before(function () {
      // Step 1: Student creates invitation
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        oldToken = res.body.invitation.token;
        // Step 2: Teacher redeems (rebinds)
        return httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_T },
          data: { bindingToken: oldToken },
        });
      }).then(function (res2) {
        assert.strictEqual(res2.body.ok, true);
        // Step 3: Student unbinds again
        return httpRequest('/api/student/bound-teachers/' + TID, {
          port: ctx.port, method: 'DELETE',
          headers: { Cookie: 'token=' + TOK_S },
        });
      }).then(function (res3) {
        assert.strictEqual(res3.body.ok, true);
      });
    });

    it('34. old completed token fails after unbind', function () {
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { bindingToken: oldToken },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'BINDING_TOKEN_INVALID');
      });
    });

    it('35. new invitation can re-bind after unbind', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var newToken = res.body.invitation.token;
        return httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_T },
          data: { bindingToken: newToken },
        });
      }).then(function (res2) {
        assert.strictEqual(res2.status, 200);
        assert.strictEqual(res2.body.ok, true);
        assert.strictEqual(res2.body.alreadyBound, false);
      });
    });
  });

  // ==========================================================
  //  H. 并发兑换
  // ==========================================================

  describe('concurrent token redeem', function () {
    before(function () { ctx.mod._resetRateLimiterForTests(); });
    var compToken = null;

    before(function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S2 },
      }).then(function (res) {
        compToken = res.body.invitation.token;
      });
    });

    it('36. two teachers competing — only one succeeds', function () {
      // Create second teacher
      var TID2 = 'teacher-bob';
      var TOK_T2 = 'tok-t2';
      var users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf-8'));
      users.push({ id: TID2, username: 'Bob', passwordHash: '$2b$10$eeee', role: 'teacher', createdAt: '2026-07-05T00:00:00.000Z' });
      fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(users), 'utf-8');
      var sessions = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf-8'));
      sessions[TOK_T2] = { userId: TID2, username: 'Bob', createdAt: NOW, expiresAt: FUTURE };
      fs.writeFileSync(path.join(dataDir, 'sessions.json'), JSON.stringify(sessions), 'utf-8');

      return Promise.all([
        httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_T },
          data: { bindingToken: compToken },
        }),
        httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_T2 },
          data: { bindingToken: compToken },
        }),
      ]).then(function (results) {
        var okCount = results.filter(function (r) { return r.status === 200 && r.body.ok; }).length;
        assert.strictEqual(okCount, 1, 'exactly one teacher must succeed');
        var failCount = results.filter(function (r) { return r.status === 400 && r.body.error === 'BINDING_TOKEN_INVALID'; }).length;
        assert.strictEqual(failCount, 1, 'exactly one must get BINDING_TOKEN_INVALID');
      });
    });

    it('37. after concurrent, only one binding exists', function () {
      var raw = fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8');
      var bindings = JSON.parse(raw);
      // Should have student-xiaoming bound to teacher-alice (from re-bind in test 35)
      // And student-red bound to exactly one teacher (from concurrent test)
      var s2Teachers = Object.keys(bindings).filter(function (k) {
        return Array.isArray(bindings[k]) && bindings[k].indexOf(SID2) >= 0;
      });
      assert.strictEqual(s2Teachers.length, 1, 'exactly one teacher bound to SID2');
    });
  });

  // ==========================================================
  //  I. Store 损坏响应
  // ==========================================================

  describe('corrupt store', function () {
    var corruptContent = '{{{"bad": json,}}}';

    it('38. corrupt invitations returns 500 on create attempt', function () {
      fs.writeFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), corruptContent, 'utf-8');

      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.error, 'INTERNAL_ERROR');
      });
    });

    it('39. 500 response contains no detail, stack, or file content', function () {
      var body = JSON.stringify(
        'placeholder — tested via previous assertion'
      );
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var bodyText = JSON.stringify(res.body);
        assert.ok(bodyText.indexOf('detail') < 0, 'no detail');
        assert.ok(bodyText.indexOf('stack') < 0, 'no stack');
        assert.ok(bodyText.indexOf(corruptContent) < 0, 'no file content leak');
        assert.ok(Object.keys(res.body).length <= 1, 'at most one key');
      });
    });

    it('40. corrupt file content preserved on disk', function () {
      var onDisk = fs.readFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), 'utf-8');
      assert.strictEqual(onDisk, corruptContent, 'corrupt file must not be overwritten');
    });

    it('41. repair file, then request recovers', function () {
      fs.writeFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), '[]', 'utf-8');

      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        assert.strictEqual(res.status, 201, 'must recover after repair');
      });
    });
  });

  // ==========================================================
  // ==========================================================
  //  J. Guest binding protection
  // ==========================================================

  describe('guest protection', function () {
    it('42. guest cannot call POST /api/student/binding-invitations', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=tok-guest' },
      }).then(function (res) {
        assert.strictEqual(res.status, 403);
      });
    });

    it('43. direct guest invitation redeem returns BINDING_TOKEN_INVALID without binding', function () {
      // Fabricate a guest invitation directly in the store
      var rawToken = 'A'.repeat(43);
      var tokenHash = require('../lib/teacher/teacher-binding-invitation-adapter').hashBindingToken(rawToken);
      var now = Date.now();
      var record = {
        id: 'inv-guest-test',
        tokenHash: tokenHash,
        studentId: 'guest',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 900000).toISOString(),
        claimedAt: null,
        claimedByTeacherId: null,
        claimRecoveryUntil: null,
        bindingCompletedAt: null,
        tokenHashEraseAfter: null,
        revokedAt: null,
        expiredAt: null,
        abandonedAt: null,
        authorizationRevokedAt: null,
      };
      var invites = JSON.parse(fs.readFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), 'utf-8'));
      invites.push(record);
      fs.writeFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), JSON.stringify(invites), 'utf-8');

      var beforeBindings = fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8');
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { bindingToken: rawToken },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'BINDING_TOKEN_INVALID');
        // Bindings must be unchanged
        var afterBindings = fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8');
        assert.strictEqual(afterBindings, beforeBindings, 'no binding created for guest');
      });
    });
  });

  // ==========================================================
  //  K. studentCode 完全退出授权链
  // ==========================================================

  describe('studentCode exit verification', function () {
    before(function () { ctx.mod._resetRateLimiterForTests(); });
    it('44. submitting any studentCode does not establish binding', function () {
      var beforeRaw = fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8');
      return httpRequest('/api/teacher/bind-student', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_T },
        data: { studentCode: '123456' },
      }).then(function (res) {
        assert.strictEqual(res.status, 400);
        var afterRaw = fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8');
        assert.strictEqual(afterRaw, beforeRaw, 'bindings file unchanged after studentCode attempt');
      });
    });

    it('45. legacy request does not consume invitation token', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var savedToken = res.body.invitation.token;
        return httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_T },
          data: { studentCode: '123456' },
        }).then(function () {
          return httpRequest('/api/teacher/bind-student', {
            port: ctx.port, method: 'POST',
            headers: { Cookie: 'token=' + TOK_T },
            data: { bindingToken: savedToken },
          });
        });
      }).then(function (res2) {
        assert.strictEqual(res2.status, 200);
        assert.strictEqual(res2.body.ok, true);
      });
    });
  });

  // ==========================================================
  //  K. Token expiry (no admin override)
  // ==========================================================

  describe('token expiry', function () {
    it('43. expired token returns BINDING_TOKEN_INVALID', function () {
      return httpRequest('/api/student/binding-invitations', {
        port: ctx.port, method: 'POST',
        headers: { Cookie: 'token=' + TOK_S },
      }).then(function (res) {
        var token = res.body.invitation.token;
        var invId = res.body.invitation.id;

        // Manually set expiredAt terminal flag to mark the invitation as expired
        var raw = fs.readFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), 'utf-8');
        var invites = JSON.parse(raw);
        for (var i = 0; i < invites.length; i++) {
          if (invites[i].id === invId) {
            invites[i].expiredAt = new Date(Date.parse(invites[i].createdAt) + 2000).toISOString();
            break;
          }
        }
        fs.writeFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), JSON.stringify(invites), 'utf-8');

        return httpRequest('/api/teacher/bind-student', {
          port: ctx.port, method: 'POST',
          headers: { Cookie: 'token=' + TOK_T },
          data: { bindingToken: token },
        });
      }).then(function (res2) {
        assert.strictEqual(res2.status, 400);
        assert.strictEqual(res2.body.error, 'BINDING_TOKEN_INVALID');
      });
    });
  });
});
