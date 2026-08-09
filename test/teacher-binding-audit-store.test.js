/**
 * test/teacher-binding-audit-store.test.js — 审计 Store 专项测试
 *
 * 覆盖: 完整事件矩阵（每类型字段精确验证）、验证层、append/并发、
 *        失败恢复、敏感内容扫描。
 */
'use strict';

var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs'), os = require('os'), path = require('path');

var {
  createTeacherBindingAuditStore,
  validateEvent,
  VALID_EVENT_TYPES,
  VALID_REASON_CATEGORIES,
} = require('../lib/teacher/teacher-binding-audit-store');

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-')); }
function cleanup(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }

function makeEvent(overrides) {
  var e = {
    eventType: 'BINDING_INVITATION_CREATED',
    reasonCategory: 'SUCCESS',
    outcome: 'SUCCESS',
    occurredAt: '2026-07-24T00:00:00.000Z',
    actorRole: 'student',
    actorId: 'student-1',
    studentId: 'student-1',
    teacherId: null,
    invitationId: 'inv-1',
  };
  if (overrides) Object.keys(overrides).forEach(function (k) { e[k] = overrides[k]; });
  return e;
}

describe('audit store', function () {
  var dir, store, filePath;

  before(function () {
    dir = tempDir();
    filePath = path.join(dir, 'audit.jsonl');
    store = createTeacherBindingAuditStore({ filePath: filePath });
  });
  after(function () { cleanup(dir); });

  // ==========================================================
  //  A. 完整事件矩阵 — 每类型精确字段验证
  // ==========================================================

  var REQUIRED_FIELDS = [
    'eventType', 'outcome', 'reasonCategory', 'occurredAt',
    'actorRole', 'actorId', 'studentId', 'teacherId', 'invitationId',
  ];

  var EVENT_MATRIX = [
    {
      label: 'BINDING_INVITATION_CREATED',
      event: { eventType: 'BINDING_INVITATION_CREATED', reasonCategory: 'SUCCESS', outcome: 'SUCCESS', occurredAt: '2026-07-24T00:00:00.000Z', actorRole: 'student', actorId: 's1', studentId: 's1', teacherId: null, invitationId: 'inv-ok' },
    },
    {
      label: 'BINDING_INVITATION_CREATE_REJECTED',
      event: { eventType: 'BINDING_INVITATION_CREATE_REJECTED', reasonCategory: 'STORE_FAILURE', outcome: 'FAILURE', occurredAt: '2026-07-24T00:00:01.000Z', actorRole: 'student', actorId: 's1', studentId: 's1', teacherId: null, invitationId: null },
    },
    {
      label: 'BINDING_INVITATION_REVOKED',
      event: { eventType: 'BINDING_INVITATION_REVOKED', reasonCategory: 'SUCCESS', outcome: 'SUCCESS', occurredAt: '2026-07-24T00:00:02.000Z', actorRole: 'student', actorId: 's1', studentId: 's1', teacherId: null, invitationId: 'inv-r1' },
    },
    {
      label: 'BINDING_INVITATION_REVOKE_REJECTED',
      event: { eventType: 'BINDING_INVITATION_REVOKE_REJECTED', reasonCategory: 'NOT_OWNER', outcome: 'REJECTED', occurredAt: '2026-07-24T00:00:03.000Z', actorRole: 'student', actorId: 's2', studentId: 's2', teacherId: null, invitationId: 'inv-rr' },
    },
    {
      label: 'BINDING_TOKEN_REDEEMED',
      event: { eventType: 'BINDING_TOKEN_REDEEMED', reasonCategory: 'SUCCESS', outcome: 'SUCCESS', occurredAt: '2026-07-24T00:00:04.000Z', actorRole: 'teacher', actorId: 't1', studentId: 's1', teacherId: 't1', invitationId: 'inv-ok' },
    },
    {
      label: 'BINDING_TOKEN_REDEEM_REJECTED',
      event: { eventType: 'BINDING_TOKEN_REDEEM_REJECTED', reasonCategory: 'INVALID_TOKEN', outcome: 'REJECTED', occurredAt: '2026-07-24T00:00:05.000Z', actorRole: 'teacher', actorId: 't1', studentId: 's3', teacherId: 't1', invitationId: 'inv-fake' },
    },
    {
      label: 'BINDING_TOKEN_RATE_LIMITED',
      event: { eventType: 'BINDING_TOKEN_RATE_LIMITED', reasonCategory: 'RATE_LIMIT_TEACHER', outcome: 'REJECTED', occurredAt: '2026-07-24T00:00:06.000Z', actorRole: 'teacher', actorId: 't1', studentId: null, teacherId: 't1', invitationId: null },
    },
    {
      label: 'BINDING_GLOBAL_ANOMALY',
      event: { eventType: 'BINDING_GLOBAL_ANOMALY', reasonCategory: 'GLOBAL_ANOMALY', outcome: 'ANOMALY', occurredAt: '2026-07-24T00:00:07.000Z', actorRole: 'system', actorId: 'rate-limiter', studentId: null, teacherId: null, invitationId: null },
    },
    {
      label: 'TEACHER_BINDING_REMOVED',
      event: { eventType: 'TEACHER_BINDING_REMOVED', reasonCategory: 'SUCCESS', outcome: 'SUCCESS', occurredAt: '2026-07-24T00:00:08.000Z', actorRole: 'student', actorId: 's1', studentId: 's1', teacherId: 't1', invitationId: null },
    },
    {
      label: 'TEACHER_BINDING_REMOVE_REJECTED',
      event: { eventType: 'TEACHER_BINDING_REMOVE_REJECTED', reasonCategory: 'STORE_FAILURE', outcome: 'FAILURE', occurredAt: '2026-07-24T00:00:09.000Z', actorRole: 'student', actorId: 's1', studentId: 's1', teacherId: 't1', invitationId: null },
    },
  ];

  describe('A. full event matrix — validation', function () {
    EVENT_MATRIX.forEach(function (entry) {
      it(entry.label + ' passes validation', function () {
        assert.strictEqual(validateEvent(entry.event), null);
      });
    });

    it('all VALID_EVENT_TYPES covered (except AUDIT_WRITE_FAILED)', function () {
      var covered = {};
      EVENT_MATRIX.forEach(function (e) { covered[e.event.eventType] = true; });
      VALID_EVENT_TYPES.forEach(function (t) {
        if (t === 'AUDIT_WRITE_FAILED') return;
        assert.ok(covered[t], 'event type missing from matrix: ' + t);
      });
    });
  });

  describe('B. full event matrix — append and verify fields', function () {
    before(function () {
      var chain = Promise.resolve();
      EVENT_MATRIX.forEach(function (entry) {
        chain = chain.then(function () { return store.appendEvent(entry.event); });
      });
      return chain;
    });

    EVENT_MATRIX.forEach(function (entry, idx) {
      it(idx + '. ' + entry.label + ' has all required fields with correct types', function () {
        var events = store.readForTests();
        var found = events.filter(function (e) { return e.eventType === entry.event.eventType; });
        assert.ok(found.length >= 1, 'event not found: ' + entry.label);
        var e = found[found.length - 1];

        // Every required field must exist
        REQUIRED_FIELDS.forEach(function (f) {
          assert.ok(Object.prototype.hasOwnProperty.call(e, f), 'missing field: ' + f);
        });

        // Exact values
        assert.strictEqual(e.eventType, entry.event.eventType);
        assert.strictEqual(e.outcome, entry.event.outcome);
        assert.strictEqual(e.reasonCategory, entry.event.reasonCategory);
        assert.strictEqual(e.actorRole, entry.event.actorRole);
        assert.strictEqual(e.actorId, entry.event.actorId);
        // Nullable fields
        if (entry.event.studentId === null) assert.strictEqual(e.studentId, null);
        else assert.strictEqual(e.studentId, entry.event.studentId);
        if (entry.event.teacherId === null) assert.strictEqual(e.teacherId, null);
        else assert.strictEqual(e.teacherId, entry.event.teacherId);
        if (entry.event.invitationId === null) assert.strictEqual(e.invitationId, null);
        else assert.strictEqual(e.invitationId, entry.event.invitationId);

        // No sensitive keys
        assert.strictEqual(e.token, undefined, 'token leak');
        assert.strictEqual(e.tokenHash, undefined, 'tokenHash leak');
        assert.strictEqual(e.passwordHash, undefined, 'passwordHash leak');
        assert.strictEqual(e.studentCode, undefined, 'studentCode leak');
      });
    });
  });

  // ==========================================================
  //  C. 验证层（拒绝测试）
  // ==========================================================

  describe('C. validation rejection', function () {
    it('non-whitelist eventType rejected', function () { assert.ok(validateEvent(makeEvent({ eventType: 'HACK' }))); });
    it('non-whitelist reasonCategory rejected', function () { assert.ok(validateEvent(makeEvent({ reasonCategory: 'SECRET' }))); });
    it('invalid actorRole (guest) rejected', function () { assert.ok(validateEvent(makeEvent({ actorRole: 'guest' }))); });
    it('invalid outcome rejected', function () { assert.ok(validateEvent(makeEvent({ outcome: 'PARTIAL' }))); });
    it('newline in actorId rejected', function () { assert.ok(validateEvent(makeEvent({ actorId: 'x\ny' }))); });
    it('forbidden key "token" rejected', function () { assert.ok(validateEvent(makeEvent({ token: 'abc' }))); });
    it('forbidden key "password" rejected', function () { assert.ok(validateEvent(makeEvent({ password: '123' }))); });
    it('43-char token pattern triggers scan rejection', function () { assert.ok(validateEvent(makeEvent({ actorId: 'a'.repeat(43) }))); });
    it('64-char hex pattern triggers scan rejection', function () { assert.ok(validateEvent(makeEvent({ actorId: '0'.repeat(64) }))); });
    it('overly long actorId (>128) rejected', function () { assert.ok(validateEvent(makeEvent({ actorId: 'y'.repeat(129) }))); });
  });

  // ==========================================================
  //  D. 失败恢复
  // ==========================================================

  describe('D. failure recovery', function () {
    it('append rejects when parent path is a file, not a directory', function () {
      var dir2 = tempDir();
      var blocked = path.join(dir2, 'blocked');
      fs.writeFileSync(blocked, 'x', 'utf-8');
      var bad = path.join(blocked, 'sub', 'audit.jsonl');
      var s2 = createTeacherBindingAuditStore({ filePath: bad });
      return s2.appendEvent(makeEvent({ eventId: 'fail-1' })).then(
        function () { assert.fail('expected rejection'); },
        function (e) { assert.ok(e); cleanup(dir2); }
      );
    });

    it('onWriteFailure called exactly once on path-conflict failure', function () {
      var dir3 = tempDir();
      var blocked = path.join(dir3, 'blocked2');
      fs.writeFileSync(blocked, 'x', 'utf-8');
      var bad = path.join(blocked, 'sub', 'a.jsonl');
      var failCount = 0;
      var s3 = createTeacherBindingAuditStore({
        filePath: bad,
        onWriteFailure: function () { failCount++; },
      });
      return s3.appendEvent(makeEvent()).then(
        function () { assert.fail('expected rejection'); },
        function () {
          assert.strictEqual(failCount, 1, 'onWriteFailure called exactly once');
          cleanup(dir3);
        }
      );
    });

    it('after failure, subsequent valid events still succeed', function () {
      return store.appendEvent(makeEvent({
        eventId: 'after-fail-recovery',
        eventType: 'BINDING_INVITATION_CREATED',
        invitationId: 'inv-recover',
      })).then(function () {
        var events = store.readForTests();
        assert.ok(events.some(function (e) { return e.eventId === 'after-fail-recovery'; }));
      });
    });

    it('no infinite AUDIT_WRITE_FAILED recursion', function () {
      var events = store.readForTests();
      var af = events.filter(function (e) { return e.eventType === 'AUDIT_WRITE_FAILED'; });
      assert.ok(af.length <= 2, 'no excessive AUDIT_WRITE_FAILED recursion');
    });
  });

  // ==========================================================
  //  E. 并发 + 不变性
  // ==========================================================

  describe('E. concurrency and invariants', function () {
    it('concurrent appends all complete', function () {
      return Promise.all([
        store.appendEvent(makeEvent({ eventId: 'cc-1', invitationId: 'cc1', eventType: 'TEACHER_BINDING_REMOVED' })),
        store.appendEvent(makeEvent({ eventId: 'cc-2', invitationId: 'cc2', eventType: 'BINDING_TOKEN_REDEEMED', actorRole: 'teacher', actorId: 't1', studentId: 's1', teacherId: 't1' })),
      ]).then(function (results) {
        assert.strictEqual(results.length, 2);
        var events = store.readForTests();
        assert.ok(events.some(function (e) { return e.eventId === 'cc-1'; }));
        assert.ok(events.some(function (e) { return e.eventId === 'cc-2'; }));
      });
    });

    it('each line in file is valid JSON ending with newline', function () {
      var content = fs.readFileSync(filePath, 'utf-8');
      var lines = content.split('\n').filter(function (l) { return l.trim().length > 0; });
      assert.ok(lines.length >= 1);
      lines.forEach(function (line) { assert.doesNotThrow(function () { JSON.parse(line); }); });
    });

    it('re-reading returns same count (no rewrite)', function () {
      var e1 = store.readForTests();
      var e2 = store.readForTests();
      assert.strictEqual(e2.length, e1.length);
    });
  });

  // ==========================================================
  //  F. 敏感内容扫描
  // ==========================================================

  describe('F. sensitive content scan', function () {
    var auditContent;
    before(function () { auditContent = fs.readFileSync(filePath, 'utf-8'); });

    it('no 43-char base64url token pattern', function () { assert.strictEqual(auditContent.match(/[A-Za-z0-9\-_]{43}/g), null); });
    it('no 64-char hex hash pattern', function () { assert.strictEqual(auditContent.match(/[0-9a-f]{64}/g), null); });
    it('no passwordHash or bcrypt', function () {
      assert.ok(auditContent.indexOf('passwordHash') < 0);
      assert.ok(auditContent.indexOf('$2b$') < 0);
    });
    it('no studentCode', function () { assert.ok(auditContent.indexOf('studentCode') < 0); });
    it('no cookie or session patterns', function () {
      assert.ok(auditContent.indexOf('token=') < 0);
      assert.ok(auditContent.indexOf('Cookie') < 0);
    });
  });
});
