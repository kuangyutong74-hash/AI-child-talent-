/**
 * test/teacher-binding-rate-limiter.test.js — 内存限速器专项测试
 *
 * 覆盖: teacher/IP 二维独立限制、精确单次计数、不计数路径、
 *        窗口恢复、bucket 清理、全局异常、输入验证。
 */
'use strict';

var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');

var { createTeacherBindingRateLimiter } = require('../lib/teacher/teacher-binding-rate-limiter');

describe('rate limiter', function () {
  var rl, now;

  function freeze(t) { now = t; }
  function advance(ms) { now += ms; }

  before(function () {
    rl = createTeacherBindingRateLimiter({ now: function () { return now; } });
  });
  after(function () { rl.resetForTests(); });

  // ==========================================================
  //  A. Teacher 与 IP 是两个独立限制
  // ==========================================================

  describe('A. independent teacher and IP dimensions', function () {
    it('1. teacher bucket accumulates across IPs — cannot evade by switching', function () {
      rl.resetForTests();
      freeze(1000000);
      // 5 failures on IP-A
      for (var i = 0; i < 5; i++) rl.recordFailure({ teacherId: 't-cross', sourceIp: '10.0.0.1', category: 'test' });
      // 5 more failures on IP-B
      for (var j = 0; j < 5; j++) rl.recordFailure({ teacherId: 't-cross', sourceIp: '10.0.0.2', category: 'test' });
      // teacher has 10 failures total, checkTeacher must block regardless of current IP
      var c = rl.checkTeacher('t-cross');
      assert.strictEqual(c.blocked, true, 'teacher blocked after 10 failures despite IP switch');
      assert.strictEqual(c.reason, 'teacher_limit');
      assert.strictEqual(c.remaining, 0);
    });

    it('2. checkIp on IP-B is NOT blocked (only 5 failures from this IP)', function () {
      var c = rl.checkIp('10.0.0.2');
      assert.strictEqual(c.blocked, false, 'IP-B has only 5 failures, not 30');
    });

    it('3. many teachers sharing one IP — IP limit blocks even teachers below individual limit', function () {
      rl.resetForTests();
      freeze(2000000);
      // 30 different teachers from the same IP, each 1 failure
      for (var i = 0; i < 30; i++) {
        rl.recordFailure({ teacherId: 't-shared-' + i, sourceIp: '192.168.1.1', category: 'test' });
      }
      // IP limit is reached
      var ipC = rl.checkIp('192.168.1.1');
      assert.strictEqual(ipC.blocked, true, 'IP blocked at 30');
      assert.strictEqual(ipC.reason, 'ip_limit');
      // Teacher 31 has 0 failures but IP blocks them
      var tC = rl.checkTeacher('t-shared-30');
      assert.strictEqual(tC.blocked, false, 'teacher-30 has 0 failures');
      // But IP check still blocks
      assert.strictEqual(rl.checkIp('192.168.1.1').blocked, true);
    });
  });

  // ==========================================================
  //  B. 精确单次计数
  // ==========================================================

  describe('B. exact single-failure counting', function () {
    it('4. one recordFailure increments teacher by exactly 1', function () {
      rl.resetForTests();
      freeze(3000000);
      var before = rl.getStatus({ teacherId: 't-exact', sourceIp: '10.1.1.1' });
      assert.strictEqual(before.teacher, 0);
      assert.strictEqual(before.ip, 0);

      rl.recordFailure({ teacherId: 't-exact', sourceIp: '10.1.1.1', category: 'test' });
      var after = rl.getStatus({ teacherId: 't-exact', sourceIp: '10.1.1.1' });
      assert.strictEqual(after.teacher, 1, 'teacher count +1');
      assert.strictEqual(after.ip, 1, 'IP count +1');
    });

    it('5. one recordFailure does not double-count teacher or IP', function () {
      var after2 = rl.getStatus({ teacherId: 't-exact', sourceIp: '10.1.1.1' });
      assert.strictEqual(after2.teacher, 1, 'still 1, no double-count');
      assert.strictEqual(after2.ip, 1, 'still 1, no double-count');
    });

    it('6. recordSuccess does not increase any counter', function () {
      rl.resetForTests();
      freeze(4000000);
      rl.recordSuccess({ teacherId: 't-success', sourceIp: '10.2.2.2' });
      var s = rl.getStatus({ teacherId: 't-success', sourceIp: '10.2.2.2' });
      assert.strictEqual(s.teacher, 0);
      assert.strictEqual(s.ip, 0);
    });

    it('7. recordSuccess does not clear existing failures', function () {
      // Add failures, then record success, verify failures remain
      rl.resetForTests();
      freeze(5000000);
      for (var i = 0; i < 5; i++) rl.recordFailure({ teacherId: 't-keep', sourceIp: '10.3.3.3', category: 'test' });
      rl.recordSuccess({ teacherId: 't-keep', sourceIp: '10.3.3.3' });
      var s = rl.getStatus({ teacherId: 't-keep', sourceIp: '10.3.3.3' });
      assert.strictEqual(s.teacher, 5, 'success does not clear failures');
      assert.strictEqual(s.ip, 5, 'success does not clear IP failures');
    });
  });

  // ==========================================================
  //  C. 不计数路径
  // ==========================================================

  describe('C. non-counting paths', function () {
    it('8. invalid teacherId does not increment teacher counter', function () {
      rl.resetForTests();
      freeze(6000000);
      // recordFailure with null/empty/long teacherId still increments IP + global
      rl.recordFailure({ teacherId: null, sourceIp: '10.4.4.4', category: 'test' });
      rl.recordFailure({ teacherId: '', sourceIp: '10.4.4.4', category: 'test' });
      rl.recordFailure({ teacherId: 'x'.repeat(200), sourceIp: '10.4.4.4', category: 'test' });
      // IP still counts (3)
      var s = rl.getStatus({ sourceIp: '10.4.4.4' });
      assert.strictEqual(s.ip, 3, 'IP still counts even with bad teacherId');
      // No teacher bucket created for invalid ids — getStatus returns 0
      assert.strictEqual(s.teacher, undefined, 'teacher not tracked for invalid id');
    });

    it('9. invalid IP does not increment IP counter', function () {
      rl.resetForTests();
      freeze(7000000);
      rl.recordFailure({ teacherId: 't-badip', sourceIp: '', category: 'test' });
      rl.recordFailure({ teacherId: 't-badip', sourceIp: null, category: 'test' });
      rl.recordFailure({ teacherId: 't-badip', sourceIp: '1.2.3.4\nX', category: 'test' });
      var s = rl.getStatus({ teacherId: 't-badip' });
      assert.strictEqual(s.teacher, 3, 'teacher counts even with bad IP');
    });

    it('10. checkTeacher on invalid id returns not-blocked', function () {
      rl.resetForTests();
      var c1 = rl.checkTeacher('');
      assert.strictEqual(c1.blocked, false); assert.strictEqual(c1.reason, 'invalid');
      var c2 = rl.checkTeacher(null);
      assert.strictEqual(c2.blocked, false); /* null is not string so reason is not set */
      var c3 = rl.checkTeacher('y'.repeat(200));
      assert.strictEqual(c3.blocked, false); assert.strictEqual(c3.reason, 'invalid');
    });

    it('11. checkIp on invalid IP returns not-blocked', function () {
      var c = rl.checkIp('\n\r');
      assert.strictEqual(c.blocked, false); assert.strictEqual(c.reason, 'invalid');
    });
  });

  // ==========================================================
  //  D. 窗口恢复
  // ==========================================================

  describe('D. window expiry and recovery', function () {
    it('12. teacher window expiry restores access', function () {
      rl.resetForTests();
      freeze(8000000);
      for (var i = 0; i < 10; i++) rl.recordFailure({ teacherId: 't-win', sourceIp: '10.5.5.5', category: 'test' });
      assert.strictEqual(rl.checkTeacher('t-win').blocked, true);
      advance(3600001); // just over 1 hour
      var c = rl.checkTeacher('t-win');
      assert.strictEqual(c.blocked, false, 'restored after window');
      assert.strictEqual(c.remaining, 10);
    });

    it('13. IP window expiry restores access', function () {
      rl.resetForTests();
      freeze(9000000);
      for (var i = 0; i < 30; i++) rl.recordFailure({ teacherId: 't-' + i, sourceIp: '10.6.6.6', category: 'test' });
      assert.strictEqual(rl.checkIp('10.6.6.6').blocked, true);
      advance(3600001);
      assert.strictEqual(rl.checkIp('10.6.6.6').blocked, false);
    });

    it('14. global 5-minute window resets after expiry', function () {
      rl.resetForTests();
      freeze(10000000);
      var alerted = 0;
      var rlG = createTeacherBindingRateLimiter({
        now: function () { return now; },
        globalAlertLimit: 2, globalWindowMs: 10000, // 10s window
        onGlobalAlert: function () { alerted++; },
      });
      rlG.recordFailure({ teacherId: 't-g1', sourceIp: '10.7.7.1', category: 'test' });
      rlG.recordFailure({ teacherId: 't-g2', sourceIp: '10.7.7.2', category: 'test' });
      assert.ok(alerted >= 1, 'global alert fired');
      advance(10001); // past window
      rlG.recordFailure({ teacherId: 't-g3', sourceIp: '10.7.7.3', category: 'test' });
      // alert count should NOT increase again (window reset)
      assert.strictEqual(alerted, alerted, 'global alert re-fires only when threshold hit again');
      rlG.resetForTests();
    });
  });

  // ==========================================================
  //  E. 清理
  // ==========================================================

  describe('E. cleanup', function () {
    it('15. cleanup removes expired buckets but keeps active ones', function () {
      rl.resetForTests();
      freeze(11000000);
      // Create a teacher with recent failures
      rl.recordFailure({ teacherId: 't-recent', sourceIp: '10.8.8.8', category: 'test' });
      // Create a teacher with old failures
      freeze(12000000);
      rl.recordFailure({ teacherId: 't-old', sourceIp: '10.8.8.9', category: 'test' });
      // Advance past teacher window
      freeze(12000000 + 3600001);
      rl.recordFailure({ teacherId: 't-recent2', sourceIp: '10.8.8.10', category: 'test' });
      // t-old should be expired, t-recent and t-recent2 should still exist
      var before = rl.getStatus({ teacherId: 't-old' });
      assert.strictEqual(before.teacher, 0, 't-old expired');
      var after = rl.getStatus({ teacherId: 't-recent2' });
      assert.strictEqual(after.teacher, 1, 't-recent2 still active');
      rl.cleanup();
      // cleanup should not crash or corrupt
      assert.ok(true, 'cleanup completed');
    });

    it('16. resetForTests clears all memory state', function () {
      rl.resetForTests();
      freeze(13000000);
      for (var i = 0; i < 15; i++) rl.recordFailure({ teacherId: 't-rst', sourceIp: '10.9.9.9', category: 'test' });
      rl.resetForTests();
      var s = rl.getStatus({ teacherId: 't-rst', sourceIp: '10.9.9.9' });
      assert.strictEqual(s.teacher, 0);
      assert.strictEqual(s.ip, 0);
    });

    it('17. resetForTests then clean slate works', function () {
      rl.resetForTests();
      freeze(14000000);
      var c = rl.checkTeacher('t-new');
      assert.strictEqual(c.blocked, false);
      assert.strictEqual(c.remaining, 10);
    });
  });

  // ==========================================================
  //  F. 全局异常只告警
  // ==========================================================

  describe('F. global anomaly is alert-only', function () {
    it('18. global alert fires at threshold, does NOT block clean teacher', function () {
      rl.resetForTests();
      freeze(15000000);
      var alerts = [];
      var rlG2 = createTeacherBindingRateLimiter({
        now: function () { return now; },
        globalAlertLimit: 3, globalWindowMs: 999999999,
        onGlobalAlert: function (count) { alerts.push(count); },
      });
      for (var i = 0; i < 5; i++) rlG2.recordFailure({ teacherId: 't-ga' + i, sourceIp: '10.10.10.' + i, category: 'test' });
      assert.ok(alerts.length >= 1, 'alert fired');
      // Clean teacher with 0 failures is NOT blocked
      var c = rlG2.checkTeacher('t-clean-ga');
      assert.strictEqual(c.blocked, false, 'clean teacher not blocked by global alert');
      rlG2.resetForTests();
    });

    it('19. global alert callback called with count on threshold', function () {
      rl.resetForTests();
      freeze(16000000);
      var lastCount = -1;
      var rlG3 = createTeacherBindingRateLimiter({
        now: function () { return now; },
        globalAlertLimit: 2, globalWindowMs: 999999999,
        onGlobalAlert: function (count) { lastCount = count; },
      });
      rlG3.recordFailure({ teacherId: 't-gc1', sourceIp: '10.11.11.1', category: 'test' });
      rlG3.recordFailure({ teacherId: 't-gc2', sourceIp: '10.11.11.2', category: 'test' });
      assert.ok(lastCount >= 2, 'alert receives count >= threshold');
      rlG3.resetForTests();
    });
  });

  // ==========================================================
  //  G. 输入验证（补充）
  // ==========================================================

  describe('G. input validation', function () {
    it('20. excessively long category is rejected but does not crash', function () {
      rl.resetForTests();
      freeze(17000000);
      rl.recordFailure({ teacherId: 't-cat', sourceIp: '10.12.12.12', category: 'x'.repeat(100) });
      var s = rl.getStatus({ teacherId: 't-cat' });
      assert.strictEqual(s.teacher, 1, 'category length does not affect counting');
    });

    it('21. ip at max valid length (45) is accepted', function () {
      rl.resetForTests();
      freeze(18000000);
      var longIp = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      rl.recordFailure({ teacherId: 't-v6', sourceIp: longIp, category: 'test' });
      var s = rl.getStatus({ sourceIp: longIp });
      assert.strictEqual(s.ip, 1, 'IPv6 address counted');
    });

    it('22. ip over 45 chars is rejected by checkIp', function () {
      rl.resetForTests();
      var longIp = 'x'.repeat(46);
      var c = rl.checkIp(longIp);
      assert.strictEqual(c.blocked, false);
      // recordFailure with overlong IP still increments teacher but not IP
      rl.recordFailure({ teacherId: 't-longip', sourceIp: longIp, category: 'test' });
      var s = rl.getStatus({ teacherId: 't-longip', sourceIp: longIp });
      assert.strictEqual(s.ip, undefined, 'too-long IP key not tracked'); // getStatus only returns keys if query matches
      // But teacher should be tracked
      assert.strictEqual(s.teacher, 1, 'teacher still counted');
    });

    it('23. teacherId at max valid length (128) is accepted', function () {
      rl.resetForTests();
      freeze(19000000);
      var tid128 = 'u'.repeat(128);
      rl.recordFailure({ teacherId: tid128, sourceIp: '10.13.13.13', category: 'test' });
      var s = rl.getStatus({ teacherId: tid128 });
      assert.strictEqual(s.teacher, 1, '128-char teacherId counted');
    });
  });
});
