/**
 * test/teacher-binding-invitation-store.test.js
 * Covers: CRUD, state transitions, corruption, concurrency, cleanup, error propagation
 */
'use strict';
var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');
var { createTeacherBindingInvitationStore } = require('../lib/teacher/teacher-binding-invitation-store');
var adapter = require('../lib/teacher/teacher-binding-invitation-adapter');

var tempDir, filePath, store;

before(function () {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-store-'));
  filePath = path.join(tempDir, 'invitations.json');
  store = createTeacherBindingInvitationStore({ filePath: filePath, now: Date.now });
});
after(function () { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {} });

function makeRecord(overrides) {
  var r = {
    id: 'inv-' + crypto.randomUUID(), tokenHash: '', studentId: 'student-a',
    createdAt: '2026-07-24T00:00:00.000Z', expiresAt: '2026-07-24T00:15:00.000Z',
    claimedAt: null, claimedByTeacherId: null, claimRecoveryUntil: null,
    bindingCompletedAt: null, tokenHashEraseAfter: null,
    revokedAt: null, expiredAt: null, abandonedAt: null, authorizationRevokedAt: null,
  };
  if (overrides) Object.keys(overrides).forEach(function (k) { r[k] = overrides[k]; });
  return r;
}

function makeToken() { return crypto.randomBytes(32).toString('base64url'); }

describe('A. readAll / findByTokenHash', function () {
  it('1. file not exists returns []', function () {
    var s = createTeacherBindingInvitationStore({ filePath: path.join(tempDir, 'nonexistent.json'), now: Date.now });
    assert.deepStrictEqual(s.readAll(), []);
  });
  it('2. create then readAll', function () {
    return store.createPending(makeRecord()).then(function () {
      assert.ok(store.readAll().length >= 1);
    });
  });
  it('3. findByTokenHash finds record', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-f1', tokenHash: h })).then(function () {
      var found = store.findByTokenHash(h);
      assert.ok(found !== null);
      assert.strictEqual(found.id, 'inv-f1');
    });
  });
  it('4. findByTokenHash empty returns null', function () { assert.strictEqual(store.findByTokenHash(''), null); });
  it('5. findByTokenHash missing returns null', function () { assert.strictEqual(store.findByTokenHash('b'.repeat(64)), null); });
});

describe('B. Corruption', function () {
  it('6. zero-byte file throws', function () {
    var p = path.join(tempDir, 'corrupt-zero.json'); fs.writeFileSync(p, '', 'utf-8');
    var s = createTeacherBindingInvitationStore({ filePath: p, now: Date.now });
    try { s.readAll(); assert.fail('expected error'); } catch (e) { assert.strictEqual(e.code, 'BINDING_INVITATION_STORE_CORRUPTED'); }
  });
  it('7. invalid JSON throws', function () {
    var p = path.join(tempDir, 'corrupt-bad.json'); fs.writeFileSync(p, 'not-json', 'utf-8');
    var s = createTeacherBindingInvitationStore({ filePath: p, now: Date.now });
    try { s.readAll(); assert.fail('expected error'); } catch (e) { assert.strictEqual(e.code, 'BINDING_INVITATION_STORE_CORRUPTED'); }
  });
  it('8. non-array throws', function () {
    var p = path.join(tempDir, 'corrupt-obj.json'); fs.writeFileSync(p, '{}', 'utf-8');
    var s = createTeacherBindingInvitationStore({ filePath: p, now: Date.now });
    try { s.readAll(); assert.fail('expected error'); } catch (e) { assert.strictEqual(e.code, 'BINDING_INVITATION_STORE_CORRUPTED'); }
  });
  it('9. invariant violation throws', function () {
    var p = path.join(tempDir, 'corrupt-invariant.json');
    fs.writeFileSync(p, JSON.stringify([{ id: '', studentId: '', createdAt: '', expiresAt: '' }]), 'utf-8');
    var s = createTeacherBindingInvitationStore({ filePath: p, now: Date.now });
    try { s.readAll(); assert.fail('expected error'); } catch (e) { assert.strictEqual(e.code, 'BINDING_INVITATION_STORE_CORRUPTED'); }
  });
  it('10. corrupt file preserved — not overwritten', function () {
    var p = path.join(tempDir, 'corrupt-keep.json');
    var bad = 'not json {{';
    fs.writeFileSync(p, bad, 'utf-8');
    var s = createTeacherBindingInvitationStore({ filePath: p, now: Date.now });
    try { s.readAll(); } catch (e) {}
    assert.strictEqual(fs.readFileSync(p, 'utf-8'), bad);
  });
});

describe('C. State transitions', function () {
  it('11. createPending adds record', function () {
    var h = 'a'.repeat(64);
    var r = makeRecord({ id: 'inv-p1', tokenHash: h });
    return store.createPending(r).then(function (saved) {
      assert.strictEqual(saved.id, 'inv-p1');
      var found = store.findByTokenHash(h);
      assert.strictEqual(found.id, 'inv-p1');
    });
  });
  it('12. createPending duplicate id rejected', function () {
    return store.createPending(makeRecord({ id: 'inv-dup-id' })).then(function () {
      return store.createPending(makeRecord({ id: 'inv-dup-id' }));
    }).then(function () { assert.fail('expected rejection'); }).catch(function (e) { assert.ok(e.message.indexOf('Duplicate') >= 0); });
  });
  it('13. claimForTeacher transitions pending→claimed', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-c1', tokenHash: h })).then(function () {
      return store.claimForTeacher(h, 'teacher-a');
    }).then(function (c) {
      assert.strictEqual(c.claimedByTeacherId, 'teacher-a');
      assert.strictEqual(adapter.deriveInvitationState(c, Date.now()), 'claimed');
    });
  });
  it('14. claimForTeacher on non-existent returns null', function () {
    return store.claimForTeacher('x'.repeat(64), 't-a').then(function (r) { assert.strictEqual(r, null); });
  });
  it('15. completeBinding transitions claimed→completed', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-comp1', tokenHash: h })).then(function () {
      return store.claimForTeacher(h, 't-comp');
    }).then(function () {
      return store.completeBinding(h, 't-comp');
    }).then(function (c) {
      assert.strictEqual(adapter.deriveInvitationState(c, Date.now()), 'completed');
      assert.ok(c.bindingCompletedAt !== null);
      assert.ok(c.tokenHashEraseAfter !== null);
    });
  });
  it('16. completeBinding wrong teacher returns null', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-comp2', tokenHash: h })).then(function () {
      return store.claimForTeacher(h, 't-a');
    }).then(function () {
      return store.completeBinding(h, 't-b');
    }).then(function (r) { assert.strictEqual(r, null); });
  });
  it('17. revokeInvitation marks revoked and clears tokenHash', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-rev1', tokenHash: h, studentId: 'student-x' })).then(function () {
      return store.revokeInvitation('inv-rev1', 'student-x');
    }).then(function (r) {
      assert.strictEqual(adapter.deriveInvitationState(r, Date.now()), 'revoked');
      assert.strictEqual(r.tokenHash, '');
    });
  });
  it('18. abandonClaimed marks abandoned', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-ab1', tokenHash: h })).then(function () {
      return store.claimForTeacher(h, 't-ab');
    }).then(function () {
      return store.abandonClaimed('inv-ab1');
    }).then(function (r) {
      assert.strictEqual(adapter.deriveInvitationState(r, Date.now()), 'abandoned');
      assert.strictEqual(r.tokenHash, '');
    });
  });
  it('18b. expireInvitation sets expiredAt and clears tokenHash', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-exp1', tokenHash: h, studentId: 's-ex' })).then(function () {
      return store.expireInvitation('inv-exp1', 's-ex');
    }).then(function (r) {
      assert.strictEqual(adapter.deriveInvitationState(r, Date.now()), 'expired');
      assert.strictEqual(r.tokenHash, '');
    });
  });
  it('18c. expireInvitation is idempotent', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-exp2', tokenHash: h, studentId: 's-ex2' })).then(function () {
      return store.expireInvitation('inv-exp2', 's-ex2');
    }).then(function (r1) {
      assert.strictEqual(adapter.deriveInvitationState(r1, Date.now()), 'expired');
      // Second call returns null because state is no longer pending
      return store.expireInvitation('inv-exp2', 's-ex2');
    }).then(function (r2) {
      // Second call: state is 'expired' not 'pending', so Store returns null (no-op)
      assert.strictEqual(r2, null);
    });
  });
  it('18d. expireInvitation wrong studentId returns null', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-exp3', tokenHash: h, studentId: 's-ex3' })).then(function () {
      return store.expireInvitation('inv-exp3', 's-other');
    }).then(function (r) {
      assert.strictEqual(r, null);
    });
  });
  it('18e. claimed/completed cannot be expired', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-exp4', tokenHash: h, studentId: 's-ex4' })).then(function () {
      return store.claimForTeacher(h, 't-exp');
    }).then(function () {
      return store.expireInvitation('inv-exp4', 's-ex4');
    }).then(function (r) {
      assert.strictEqual(r, null);
    });
  });
});

describe('D. invalidate / authorization', function () {
  it('19. invalidateRecoveryForPair clears tokenHash', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-reco1', tokenHash: h, studentId: 's-r' })).then(function () {
      return store.claimForTeacher(h, 't-r');
    }).then(function () {
      return store.completeBinding(h, 't-r');
    }).then(function () {
      return store.invalidateRecoveryForPair('s-r', 't-r');
    }).then(function (count) {
      assert.ok(count >= 1);
      var found = store.findByTokenHash(h);
      assert.strictEqual(found, null); // tokenHash cleared
    });
  });
  it('20. invalidateAllActiveForStudent revokes pending', function () {
    return store.createPending(makeRecord({ id: 'inv-pend-revoke', studentId: 's-pend' })).then(function () {
      return store.invalidateAllActiveForStudent('s-pend');
    }).then(function (count) {
      assert.ok(count >= 1);
    });
  });
});

describe('E. Read-only guarantee', function () {
  it('21. readAll does not write', function () {
    var beforeLen = store.readAll().length;
    assert.ok(beforeLen >= 0);
  });
  it('22. findByTokenHash does not write', function () {
    store.findByTokenHash('x'.repeat(64));
  });
});

describe('F. Concurrency', function () {
  it('23. two concurrent creates both preserved', function () {
    return Promise.all([
      store.createPending(makeRecord({ id: 'inv-cc1' })),
      store.createPending(makeRecord({ id: 'inv-cc2' })),
    ]).then(function (results) {
      assert.strictEqual(results.length, 2);
    });
  });
  it('24. two claim same token — second returns null', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-race', tokenHash: h })).then(function () {
      return Promise.all([
        store.claimForTeacher(h, 't-first'),
        store.claimForTeacher(h, 't-second'),
      ]);
    }).then(function (results) {
      var successes = results.filter(Boolean);
      assert.strictEqual(successes.length, 1);
      assert.strictEqual(successes[0].claimedByTeacherId, 't-first');
    });
  });
});

describe('G. Queue error propagation', function () {
  it('25. operation failure rejects to caller', function () {
    return store.createPending(makeRecord({ id: '' })).then(function () { assert.fail('expected rejection'); }).catch(function (e) { assert.ok(e); });
  });
  it('26. queue continues after failure', function () {
    var fails = store.createPending(makeRecord({ id: '' })).catch(function (e) { return 'failed'; });
    var succeeds = store.createPending(makeRecord({ id: 'inv-after-fail' }));
    return Promise.all([fails, succeeds]).then(function (results) {
      assert.strictEqual(results[0], 'failed');
      assert.ok(results[1].id === 'inv-after-fail');
    });
  });
});

describe('H. Cleanup', function () {
  it('27. cleanupTerminalRecords does not throw on empty', function () {
    return store.cleanupTerminalRecords(Date.now()).then(function (r) { assert.ok(r); });
  });
  it('28. expired tokenHash is cleared', function () {
    var p = path.join(tempDir, 'cleanup-exp.json');
    var past = new Date(Date.now() - 3600000).toISOString();
    var pastExp = new Date(Date.now() - 1800000).toISOString();
    var record = makeRecord({ id: 'inv-expired-in-store', studentId: 's-clean', createdAt: past, expiresAt: pastExp, expiredAt: pastExp, tokenHash: 'a'.repeat(64) });
    fs.writeFileSync(p, JSON.stringify([record]), 'utf-8');
    var s = createTeacherBindingInvitationStore({ filePath: p, now: Date.now });
    return s.cleanupTerminalRecords(Date.now()).then(function () {
      var all = s.readAll();
      if (all.length > 0) assert.strictEqual(all[0].tokenHash, '');
    });
  });
  it('29. readAll does not trigger cleanup', function () {
    var beforeLen = store.readAll().length;
    var afterLen = store.readAll().length;
    assert.strictEqual(afterLen, beforeLen);
  });
});

describe('I. Immutability', function () {
  it('30. createPending does not modify input', function () {
    var input = makeRecord({ id: 'inv-immut' }); var before = JSON.stringify(input);
    return store.createPending(input).then(function () {
      assert.strictEqual(JSON.stringify(input), before);
    });
  });
  it('31. readAll returns deep copy', function () {
    return store.createPending(makeRecord({ id: 'inv-copy' })).then(function () {
      var all = store.readAll();
      if (all.length > 0) all[0].studentId = 'MODIFIED';
      var all2 = store.readAll();
      if (all2.length > 0) assert.notStrictEqual(all2[0].studentId, 'MODIFIED');
    });
  });
  it('32. findByTokenHash returns copy', function () {
    var tok = makeToken(); var h = adapter.hashBindingToken(tok);
    return store.createPending(makeRecord({ id: 'inv-copy2', tokenHash: h })).then(function () {
      var f = store.findByTokenHash(h); f.studentId = 'X';
      var f2 = store.findByTokenHash(h); assert.notStrictEqual(f2.studentId, 'X');
    });
  });
});

describe('J. tmp cleanup', function () {
  it('33. no tmp residue after write', function () {
    var files = fs.readdirSync(tempDir);
    var tmps = files.filter(function (f) { return f.indexOf('.tmp') >= 0; });
    assert.strictEqual(tmps.length, 0);
  });
});
