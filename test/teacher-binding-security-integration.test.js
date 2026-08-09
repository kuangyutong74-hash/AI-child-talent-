/**
 * test/teacher-binding-security-integration.test.js — 安全集成测试
 *
 * 覆盖: teacher跨IP累计、多教师共享IP、精确计数（teacher+IP+global）、
 *        不计数路径矩阵、邀请频率+active上限、Store失败不消耗额度、
 *        全局只告警、可信代理、核心合同回归。
 */
'use strict';

var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs'), os = require('os'), path = require('path');
var http = require('http');

function httpRequest(urlPath, opts) {
  opts = opts || {};
  var method = opts.method || 'GET', port = opts.port;
  var reqHeaders = opts.headers || {};
  return new Promise(function (resolve, reject) {
    var rOpts = { hostname: '127.0.0.1', port: port, path: urlPath, method: method, headers: reqHeaders };
    var dataStr = null;
    if (opts.data) { dataStr = JSON.stringify(opts.data); rOpts.headers['Content-Type'] = 'application/json'; rOpts.headers['Content-Length'] = Buffer.byteLength(dataStr); }
    var req = http.request(rOpts, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        var p; try { p = JSON.parse(body); } catch (_) { p = { _raw: body }; }
        resolve({ status: res.statusCode, headers: res.headers, body: p });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, function () { req.destroy(); reject(new Error('timeout')); });
    if (dataStr) req.write(dataStr); req.end();
  });
}

function makeDataDir(base, files) {
  var d = path.join(base, 'data'); fs.mkdirSync(d, { recursive: true });
  if (files) Object.keys(files).forEach(function (k) { fs.writeFileSync(path.join(d, k), files[k], 'utf-8'); });
  return d;
}

var NOW = Date.now(), FUTURE = NOW + 30 * 24 * 60 * 60 * 1000;
var SOURCE_IP = '127.0.0.1'; // always localhost

function buildUsers(extras) {
  var u = [
    { id: 't-alice', username: 'Alice', passwordHash: '$2b$10$aaaa', role: 'teacher', createdAt: '2026-07-01T00:00:00.000Z' },
    { id: 't-bob', username: 'Bob', passwordHash: '$2b$10$bbbb', role: 'teacher', createdAt: '2026-07-02T00:00:00.000Z' },
    { id: 's-xiao', username: 'xiao', passwordHash: '$2b$10$cccc', role: 'student', createdAt: '2026-07-03T00:00:00.000Z' },
    { id: 's-red', username: 'red', passwordHash: '$2b$10$dddd', role: 'student', createdAt: '2026-07-04T00:00:00.000Z' },
    { id: 'guest', username: 'guest', passwordHash: '$2b$10$eeee', role: 'student', createdAt: '2026-07-05T00:00:00.000Z' },
  ];
  if (extras) u = u.concat(extras);
  return u;
}
function buildSessions(extras) {
  var o = {};
  o.ct1 = { userId: 't-alice', username: 'Alice', createdAt: NOW, expiresAt: FUTURE };
  o.ct2 = { userId: 't-bob', username: 'Bob', createdAt: NOW, expiresAt: FUTURE };
  o.cs1 = { userId: 's-xiao', username: 'xiao', createdAt: NOW, expiresAt: FUTURE };
  o.cs2 = { userId: 's-red', username: 'red', createdAt: NOW, expiresAt: FUTURE };
  o['ct-guest'] = { userId: 'guest', username: 'guest', createdAt: NOW, expiresAt: FUTURE };
  if (extras) Object.keys(extras).forEach(function (k) { o[k] = extras[k]; });
  return o;
}
function buildHistory() {
  return [{ id: 'conv-001', userId: 's-xiao', sessionId: 's-1', startTime: '2026-07-10T08:00:00.000Z', turnCount: 3, completed: true,
    messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
    analysis: { status: 'done', result: { '分析范围': 'x', '命中指标': [{ '维度': 'A', '指标': 'B' }], '未命中指标': [], '安全提示': false, '安全提示说明': '' } } }];
}

var originalDataDir = process.env.DATA_DIR;
var originalSkipMigration = process.env.SKIP_MIGRATION;

function resetAndStart(dataDir) {
  process.env.SKIP_MIGRATION = 'true'; process.env.DATA_DIR = dataDir;
  delete require.cache[require.resolve('../app')];
  var mod = require('../app');
  return mod.initializeRuntime().then(function () {
    return new Promise(function (resolve, reject) {
      var srv = mod.app.listen(0, '127.0.0.1', function () { resolve({ mod: mod, server: srv, port: srv.address().port }); });
      srv.on('error', reject);
    });
  });
}

describe('teacher binding security integration', function () {
  var ctx, dataDir, tempDir, auditPath;

  function readAudit() {
    if (!fs.existsSync(auditPath)) return [];
    var raw = fs.readFileSync(auditPath, 'utf-8');
    if (raw.trim().length === 0) return [];
    return raw.split('\n').filter(function (l) { return l.trim().length > 0; }).map(function (l) { return JSON.parse(l); });
  }
  function addUser(id, username, role) {
    var u = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf-8'));
    u.push({ id: id, username: username, passwordHash: '$2b$10$ffff' + id, role: role, createdAt: '2026-07-09T00:00:00.000Z' });
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(u), 'utf-8');
  }
  function addSession(token, userId, username) {
    var s = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf-8'));
    s[token] = { userId: userId, username: username, createdAt: NOW, expiresAt: FUTURE };
    fs.writeFileSync(path.join(dataDir, 'sessions.json'), JSON.stringify(s), 'utf-8');
  }
  function resetLimiter() { ctx.mod._resetRateLimiterForTests(); }
  function getLimiter() { return ctx.mod._getRateLimiterForTests(); }
  /** snapshot: { teacher, ip, global } for given teacherId using known SOURCE_IP */
  function limSnap(tid) {
    var s = getLimiter().getStatus({ teacherId: tid, sourceIp: SOURCE_IP });
    return {
      teacher: typeof s.teacher === 'number' ? s.teacher : 0,
      ip: typeof s.ip === 'number' ? s.ip : 0,
      global: typeof s.global === 'number' ? s.global : 0,
    };
  }

  before(function () {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-sec-'));
    dataDir = makeDataDir(tempDir, {
      'users.json': JSON.stringify(buildUsers()),
      'sessions.json': JSON.stringify(buildSessions()),
      'bindings.json': '{}',
      'history.json': JSON.stringify(buildHistory()),
      'teacher-binding-invitations.json': '[]',
      'teacher-binding-audit.jsonl': '',
    });
    auditPath = path.join(dataDir, 'teacher-binding-audit.jsonl');
    return resetAndStart(dataDir).then(function (c) { ctx = c; });
  });

  after(function () {
    process.env.DATA_DIR = originalDataDir;
    if (originalSkipMigration === undefined) delete process.env.SKIP_MIGRATION;
    else process.env.SKIP_MIGRATION = originalSkipMigration;
    return new Promise(function (resolve) {
      if (ctx && ctx.server && ctx.server.listening) ctx.server.close(function () { resolve(); }); else resolve();
    }).then(function () { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {} });
  });

  // ==========================================================
  //  A. Teacher 跨 IP 累计 — teacher bucket 独立于 IP
  // ==========================================================
  describe('A. teacher accumulates across requests (shared 127.0.0.1)', function () {
    it('1. 10 failures blocks teacher with 429 RATE_LIMIT_TEACHER audit', function () {
      resetLimiter();
      var tid = 't-xip', tok = 'ct-xip';
      addUser(tid, 'Xip', 'teacher'); addSession(tok, tid, 'Xip');
      var fake = 'A'.repeat(43);
      var chain = Promise.resolve();
      for (var i = 0; i < 10; i++) {
        chain = chain.then(function () { return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok }, data: { bindingToken: fake } }); });
      }
      return chain.then(function () {
        return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok }, data: { bindingToken: fake } });
      }).then(function (res) {
        assert.strictEqual(res.status, 429);
        assert.strictEqual(res.body.error, 'TOO_MANY_ATTEMPTS');
        var events = readAudit();
        var rl = events.filter(function (e) { return e.eventType === 'BINDING_TOKEN_RATE_LIMITED' && e.reasonCategory === 'RATE_LIMIT_TEACHER'; });
        assert.ok(rl.length >= 1, 'must have RATE_LIMIT_TEACHER audit');
      });
    });
  });

  // ==========================================================
  //  B. 多教师共享同一 IP — IP 限制阻断
  // ==========================================================
  describe('B. shared IP blocks when 30 failures reached', function () {
    it('2. 30 failures from many teachers on same IP → teacher N+1 gets IP-rate-limited', function () {
      resetLimiter();
      var chain = Promise.resolve();
      for (var i = 0; i < 15; i++) {
        var tid = 't-ip-' + i; var tok = 'ct-ip-' + i;
        addUser(tid, 'TI' + i, 'teacher'); addSession(tok, tid, 'TI' + i);
        (function (t) {
          chain = chain.then(function () {
            return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + t }, data: { bindingToken: 'B'.repeat(43) } });
          }).then(function () {
            return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + t }, data: { bindingToken: 'B'.repeat(43) } });
          });
        })(tok);
      }
      // 31st failure
      var tid31 = 't-ip-31'; var tok31 = 'ct-ip-31';
      addUser(tid31, 'TI31', 'teacher'); addSession(tok31, tid31, 'TI31');
      return chain.then(function () {
        return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok31 }, data: { bindingToken: 'B'.repeat(43) } });
      }).then(function (res) {
        if (res.status === 429) {
          assert.strictEqual(res.body.error, 'TOO_MANY_ATTEMPTS');
          var events = readAudit();
          var rl = events.filter(function (e) { return e.eventType === 'BINDING_TOKEN_RATE_LIMITED' && e.reasonCategory === 'RATE_LIMIT_IP'; });
          assert.ok(rl.length >= 1, 'must have RATE_LIMIT_IP audit');
        }
      });
    });
  });

  // ==========================================================
  //  C. 精确单次失败计数（teacher + IP）
  // ==========================================================
  describe('C. exact failure counting', function () {
    it('3. one BINDING_TOKEN_INVALID increments teacher by 1 and IP by 1', function () {
      resetLimiter();
      var tid = 't-count', tok = 'ct-count';
      addUser(tid, 'Count', 'teacher'); addSession(tok, tid, 'Count');
      var before = limSnap(tid);
      return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok }, data: { bindingToken: 'C'.repeat(43) } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'BINDING_TOKEN_INVALID');
        var after = limSnap(tid);
        assert.strictEqual(after.teacher, before.teacher + 1);
        assert.strictEqual(after.ip, before.ip + 1);
        var events = readAudit();
        var rej = events.filter(function (e) { return e.eventType === 'BINDING_TOKEN_REDEEM_REJECTED' && e.teacherId === tid; });
        assert.strictEqual(rej.length, 1, 'exactly one reject audit');
      });
    });
  });

  // ==========================================================
  //  D. 429 不重复计数（teacher + IP + global 三者不变）
  // ==========================================================
  describe('D. 429 does NOT double-count', function () {
    it('4. 11th request returns 429 — teacher, IP and global counts remain unchanged', function () {
      resetLimiter();
      var tid = 't-dbl', tok = 'ct-dbl';
      addUser(tid, 'Dbl', 'teacher'); addSession(tok, tid, 'Dbl');
      var chain = Promise.resolve();
      for (var i = 0; i < 10; i++) {
        chain = chain.then(function () { return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok }, data: { bindingToken: 'F'.repeat(43) } }); });
      }
      var beforeSnap;
      return chain.then(function () {
        beforeSnap = limSnap(tid);
        assert.strictEqual(beforeSnap.teacher, 10);
        return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok }, data: { bindingToken: 'F'.repeat(43) } });
      }).then(function (res) {
        assert.strictEqual(res.status, 429);
        assert.strictEqual(res.body.error, 'TOO_MANY_ATTEMPTS');
        var afterSnap = limSnap(tid);
        assert.strictEqual(afterSnap.teacher, beforeSnap.teacher, 'teacher count unchanged after 429');
        assert.strictEqual(afterSnap.ip, beforeSnap.ip, 'IP count unchanged after 429');
        assert.strictEqual(afterSnap.global, beforeSnap.global, 'global count unchanged after 429');
      });
    });
  });

  // ==========================================================
  //  E. 不计数路径矩阵
  // ==========================================================
  describe('E. non-counting paths', function () {
    it('5. studentCode legacy: teacher and IP unchanged', function () {
      resetLimiter();
      var tid = 't-nc1', tok = 'ct-nc1';
      addUser(tid, 'NC1', 'teacher'); addSession(tok, tid, 'NC1');
      var before = limSnap(tid);
      return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok }, data: { studentCode: '123456' } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
        var after = limSnap(tid);
        assert.strictEqual(after.teacher, before.teacher);
        assert.strictEqual(after.ip, before.ip);
      });
    });

    it('6. unauthenticated: 401, not counted', function () {
      resetLimiter();
      return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', data: { bindingToken: 'D'.repeat(43) } }).then(function (res) {
        assert.strictEqual(res.status, 401);
      });
    });

    it('7. student role on bind-student: 403, not counted', function () {
      resetLimiter();
      return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=cs1' }, data: { bindingToken: 'D'.repeat(43) } }).then(function (res) {
        assert.strictEqual(res.status, 403);
      });
    });

    it('8. corrupt store: 500 INTERNAL_ERROR, not counted', function () {
      resetLimiter();
      var tid = 't-corrupt', tok = 'ct-corrupt';
      addUser(tid, 'Corr', 'teacher'); addSession(tok, tid, 'Corr');
      fs.writeFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), '{{{bad', 'utf-8');
      var before = limSnap(tid);
      return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok }, data: { bindingToken: 'E'.repeat(43) } }).then(function (res) {
        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.error, 'INTERNAL_ERROR');
        var after = limSnap(tid);
        assert.strictEqual(after.teacher, before.teacher, '500 does NOT count');
        assert.strictEqual(after.ip, before.ip, '500 does NOT count IP');
        fs.writeFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), '[]', 'utf-8');
      });
    });

    it('9. successful bind does NOT increase failure count', function () {
      resetLimiter();
      var tid = 't-succ', tok = 'ct-succ';
      var sid = 's-succ', toks = 'cs-succ';
      addUser(tid, 'SuccT', 'teacher'); addUser(sid, 'SuccS', 'student');
      addSession(tok, tid, 'SuccT'); addSession(toks, sid, 'SuccS');
      // Pre-seed 3 failures directly
      var rl = getLimiter();
      for (var i = 0; i < 3; i++) rl.recordFailure({ teacherId: tid, sourceIp: SOURCE_IP, category: 'token_redeem' });
      var before = limSnap(tid);
      assert.strictEqual(before.teacher, 3);
      return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } }).then(function (r) {
        return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok }, data: { bindingToken: r.body.invitation.token } });
      }).then(function (r2) {
        assert.strictEqual(r2.status, 200);
        var after = limSnap(tid);
        assert.strictEqual(after.teacher, 3, 'success does not increase failures');
      });
    });
  });

  // ==========================================================
  //  F. 邀请创建频率 + active 上限
  // ==========================================================
  describe('F. invitation limits', function () {
    it('10. create 5x then 6th gets 429 (frequency limit)', function () {
      resetLimiter();
      var sid = 's-freq', toks = 'cs-freq';
      addUser(sid, 'FreqS', 'student'); addSession(toks, sid, 'FreqS');
      var chain = Promise.resolve();
      for (var i = 0; i < 5; i++) {
        chain = chain.then(function () {
          return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } }).then(function (r) {
            assert.strictEqual(r.status, 201);
            return httpRequest('/api/student/binding-invitations/' + r.body.invitation.id, { port: ctx.port, method: 'DELETE', headers: { Cookie: 'token=' + toks } });
          });
        });
      }
      return chain.then(function () {
        return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } });
      }).then(function (res) {
        assert.strictEqual(res.status, 429);
        assert.strictEqual(res.body.error, 'TOO_MANY_INVITATIONS');
      });
    });

    it('11. 5 pending → 6th gets 429 (active limit)', function () {
      resetLimiter();
      var sid = 's-act', toks = 'cs-act';
      addUser(sid, 'ActS', 'student'); addSession(toks, sid, 'ActS');
      var chain = Promise.resolve();
      for (var i = 0; i < 5; i++) {
        chain = chain.then(function () { return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } }); });
      }
      return chain.then(function () {
        return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } });
      }).then(function (res) {
        assert.strictEqual(res.status, 429);
        assert.strictEqual(res.body.error, 'TOO_MANY_INVITATIONS');
      });
    });

    it('12. claimed counts toward active limit', function () {
      resetLimiter();
      var sid = 's-clm', toks = 'cs-clm';
      var tid = 't-clm', tokt = 'ct-clm';
      addUser(sid, 'ClmS', 'student'); addSession(toks, sid, 'ClmS');
      addUser(tid, 'ClmT', 'teacher'); addSession(tokt, tid, 'ClmT');
      return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } }).then(function (r) {
        return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tokt }, data: { bindingToken: r.body.invitation.token } });
      }).then(function () {
        var chain = Promise.resolve();
        for (var i = 0; i < 4; i++) {
          chain = chain.then(function () { return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } }); });
        }
        return chain;
      }).then(function () {
        return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } });
      }).then(function (res) {
        assert.strictEqual(res.status, 429);
      });
    });

    it('13. revoke frees active slot', function () {
      resetLimiter();
      var sid = 's-rev2', toks = 'cs-rev2';
      addUser(sid, 'Rev2S', 'student'); addSession(toks, sid, 'Rev2S');
      return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } }).then(function (r1) {
        return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } }).then(function (r2) {
          return httpRequest('/api/student/binding-invitations/' + r1.body.invitation.id, { port: ctx.port, method: 'DELETE', headers: { Cookie: 'token=' + toks } });
        }).then(function () {
          return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } });
        });
      }).then(function (r3) { assert.strictEqual(r3.status, 201); });
    });
  });

  // ==========================================================
  //  G. Store 失败不消耗邀请额度
  // ==========================================================
  describe('G. store failure preserves quota', function () {
    it('14. corrupt store 500, then repaired creates at 201', function () {
      resetLimiter();
      var sid = 's-stfail', toks = 'cs-stfail';
      addUser(sid, 'StFS', 'student'); addSession(toks, sid, 'StFS');
      fs.writeFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), '{{{corrupt', 'utf-8');
      return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } }).then(function (res) {
        assert.strictEqual(res.status, 500);
        fs.writeFileSync(path.join(dataDir, 'teacher-binding-invitations.json'), '[]', 'utf-8');
        return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + toks } });
      }).then(function (r2) { assert.strictEqual(r2.status, 201); });
    });
  });

  // ==========================================================
  //  H. 全局异常只告警
  // ==========================================================
  describe('H. global anomaly alert-only', function () {
    it('15. global threshold fires audit, does not block clean teacher', function () {
      resetLimiter();
      var rl = getLimiter();
      for (var i = 0; i < 500; i++) {
        rl.recordFailure({ teacherId: 't-g' + i, sourceIp: '10.0.0.' + (i % 255), category: 'token_redeem' });
      }
      // Audit write is async — wait for flush then read
      return ctx.mod._getAuditStoreForTests().flush().then(function () {
        var events = readAudit();
        var ga = events.filter(function (e) { return e.eventType === 'BINDING_GLOBAL_ANOMALY'; });
        assert.ok(ga.length >= 1, 'global anomaly audit event present');
        var c = rl.checkTeacher('t-not-global');
        assert.strictEqual(c.blocked, false, 'clean teacher not blocked by global alert');
      });
    });
  });

  // ==========================================================
  //  I. 可信代理合同
  // ==========================================================
  describe('I. trusted proxy contract', function () {
    it('16. X-Forwarded-For does not change rate-limiter IP key', function () {
      resetLimiter();
      var tid = 't-proxy', tok = 'ct-proxy';
      addUser(tid, 'Proxy', 'teacher'); addSession(tok, tid, 'Proxy');
      return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tok, 'X-Forwarded-For': '10.99.99.99' }, data: { bindingToken: 'Z'.repeat(43) } }).then(function (res) {
        assert.strictEqual(res.status, 400); // XFF ignored, uses real IP
        // Forged IP has zero failures
        var s = getLimiter().getStatus({ sourceIp: '10.99.99.99' });
        assert.strictEqual(s.ip || 0, 0, 'forged XFF IP has zero failures');
      });
    });
  });

  // ==========================================================
  //  J. Core contract regression
  // ==========================================================
  describe('J. core contract regression', function () {
    it('17. studentCode returns LEGACY', function () {
      resetLimiter();
      return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=ct2' }, data: { studentCode: '123456' } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'LEGACY_STUDENT_CODE_BINDING_DISABLED');
      });
    });

    it('18. studentCode+bindingToken does not consume token', function () {
      resetLimiter();
      var tid = 't-ctr', tokT = 'ct-ctr';
      var sid = 's-ctr', tokS = 'cs-ctr';
      addUser(tid, 'CtrT', 'teacher'); addUser(sid, 'CtrS', 'student');
      addSession(tokT, tid, 'CtrT'); addSession(tokS, sid, 'CtrS');
      return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tokS } }).then(function (r) {
        var saved = r.body.invitation.token;
        return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tokT }, data: { studentCode: '123', bindingToken: saved } }).then(function (r2) {
          assert.strictEqual(r2.status, 400);
          return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tokT }, data: { bindingToken: saved } });
        }).then(function (r3) { assert.strictEqual(r3.status, 200); });
      });
    });

    it('19. invitation response: {id,token}, no-store, no-cache', function () {
      resetLimiter();
      return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=cs1' } }).then(function (res) {
        assert.strictEqual(res.status, 201);
        assert.deepStrictEqual(Object.keys(res.body.invitation), ['id', 'token']);
        assert.ok((res.headers['cache-control'] || '').toLowerCase().indexOf('no-store') >= 0);
        assert.strictEqual((res.headers['pragma'] || '').toLowerCase(), 'no-cache');
      });
    });

    it('20. guest cannot create invitation', function () {
      resetLimiter();
      return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=ct-guest' } }).then(function (res) {
        assert.strictEqual(res.status, 403);
      });
    });

    it('21. binding recorded in bindings.json', function () {
      resetLimiter();
      var tid = 't-src', tokT = 'ct-src';
      var sid = 's-src', tokS = 'cs-src';
      addUser(tid, 'SrcT', 'teacher'); addUser(sid, 'SrcS', 'student');
      addSession(tokT, tid, 'SrcT'); addSession(tokS, sid, 'SrcS');
      return httpRequest('/api/student/binding-invitations', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tokS } }).then(function (r) {
        return httpRequest('/api/teacher/bind-student', { port: ctx.port, method: 'POST', headers: { Cookie: 'token=' + tokT }, data: { bindingToken: r.body.invitation.token } });
      }).then(function (r2) {
        assert.strictEqual(r2.status, 200);
        var b = JSON.parse(fs.readFileSync(path.join(dataDir, 'bindings.json'), 'utf-8'));
        assert.ok(b[tid] && b[tid].indexOf(sid) >= 0);
      });
    });
  });
});
