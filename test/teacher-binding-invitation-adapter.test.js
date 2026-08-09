/**
 * test/teacher-binding-invitation-adapter.test.js
 * Covers: token validation, hash, state derivation, record/collection validation, redeemable check
 */
'use strict';
var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var crypto = require('crypto');
var adapter = require('../lib/teacher/teacher-binding-invitation-adapter');

function makeRecord(overrides) {
  var r = {
    id: 'inv-test', tokenHash: '', studentId: 'student-a',
    createdAt: '2026-07-24T00:00:00.000Z', expiresAt: '2026-07-24T00:15:00.000Z',
    claimedAt: null, claimedByTeacherId: null, claimRecoveryUntil: null,
    bindingCompletedAt: null, tokenHashEraseAfter: null,
    revokedAt: null, expiredAt: null, abandonedAt: null, authorizationRevokedAt: null,
  };
  if (overrides) Object.keys(overrides).forEach(function (k) { r[k] = overrides[k]; });
  return r;
}

function makeToken() { return crypto.randomBytes(32).toString('base64url'); }

describe('A. Token', function () {
  it('1. valid base64url token passes', function () { var t = makeToken(); assert.strictEqual(adapter.isValidRawBindingToken(t), true); });
  it('2. wrong length fails', function () { assert.strictEqual(adapter.isValidRawBindingToken('abc'), false); });
  it('3. non-string fails', function () { assert.strictEqual(adapter.isValidRawBindingToken(42), false); });
  it('4. null fails', function () { assert.strictEqual(adapter.isValidRawBindingToken(null), false); });
  it('5. hash is deterministic', function () { var t = makeToken(); assert.strictEqual(adapter.hashBindingToken(t), adapter.hashBindingToken(t)); });
  it('6. hash is 64-char hex', function () { var h = adapter.hashBindingToken(makeToken()); assert.strictEqual(h.length, 64); assert.ok(/^[0-9a-f]{64}$/.test(h)); });
  it('7. different tokens produce different hashes', function () { assert.notStrictEqual(adapter.hashBindingToken(makeToken()), adapter.hashBindingToken(makeToken())); });
  it('8. non-string token hash returns empty', function () { assert.strictEqual(adapter.hashBindingToken(123), ''); });
});

describe('B. State derivation', function () {
  it('9. pending', function () { assert.strictEqual(adapter.deriveInvitationState(makeRecord(), Date.now()), 'pending'); });
  it('10. claimed', function () { assert.strictEqual(adapter.deriveInvitationState(makeRecord({claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2026-07-25T00:00:01.000Z'}), Date.now()), 'claimed'); });
  it('11. completed', function () {
    var r = makeRecord({claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2026-07-25T00:00:01.000Z',bindingCompletedAt:'2026-07-24T00:00:02.000Z',tokenHashEraseAfter:'2026-07-26T00:00:02.000Z',tokenHash:'a'.repeat(64)});
    assert.strictEqual(adapter.deriveInvitationState(r, Date.now()), 'completed');
  });
  it('12. revoked', function () { assert.strictEqual(adapter.deriveInvitationState(makeRecord({revokedAt:'2026-07-24T00:01:00.000Z'}), Date.now()), 'revoked'); });
  it('13. expired', function () { assert.strictEqual(adapter.deriveInvitationState(makeRecord({expiredAt:'2026-07-24T00:01:00.000Z'}), Date.now()), 'expired'); });
  it('14. abandoned', function () { assert.strictEqual(adapter.deriveInvitationState(makeRecord({abandonedAt:'2026-07-24T00:01:00.000Z',claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2026-07-25T00:00:01.000Z'}), Date.now()), 'abandoned'); });
  it('15. authorization_revoked', function () {
    var r = makeRecord({claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2026-07-25T00:00:01.000Z',authorizationRevokedAt:'2026-07-24T01:00:00.000Z'});
    assert.strictEqual(adapter.deriveInvitationState(r, Date.now()), 'authorization_revoked');
  });
  it('16. conflicting terminals → corrupted', function () { assert.strictEqual(adapter.deriveInvitationState(makeRecord({revokedAt:'2026-07-24T00:01:00.000Z',bindingCompletedAt:'2026-07-24T00:00:02.000Z'}), Date.now()), 'corrupted'); });
  it('17. null input → corrupted', function () { assert.strictEqual(adapter.deriveInvitationState(null, Date.now()), 'corrupted'); });
});

describe('C. Record validation', function () {
  it('18. valid pending passes', function () { assert.strictEqual(adapter.validateInvitationRecord(makeRecord()), null); });
  it('19. empty id fails', function () { assert.ok(adapter.validateInvitationRecord(makeRecord({id:''})) !== null); });
  it('20. missing studentId fails', function () { var r = makeRecord(); delete r.studentId; assert.ok(adapter.validateInvitationRecord(r) !== null); });
  it('21. invalid createdAt fails', function () { assert.ok(adapter.validateInvitationRecord(makeRecord({createdAt:'bad'})) !== null); });
  it('22. expiresAt <= createdAt fails', function () { assert.ok(adapter.validateInvitationRecord(makeRecord({createdAt:'2026-07-25T00:00:00.000Z',expiresAt:'2026-07-24T00:00:00.000Z'})) !== null); });
  it('23. claimedAt without claimedByTeacherId fails', function () { assert.ok(adapter.validateInvitationRecord(makeRecord({claimedAt:'2026-07-24T00:00:01.000Z',claimRecoveryUntil:'2026-07-25T00:00:01.000Z'})) !== null); });
  it('24. claimedByTeacherId without claimedAt fails', function () { assert.ok(adapter.validateInvitationRecord(makeRecord({claimedByTeacherId:'t-a'})) !== null); });
  it('25. bindingCompletedAt without claim fails', function () { assert.ok(adapter.validateInvitationRecord(makeRecord({bindingCompletedAt:'2026-07-24T00:00:02.000Z'})) !== null); });
  it('26. tokenHashEraseAfter < bindingCompletedAt fails', function () {
    var r = makeRecord({claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2026-07-25T00:00:01.000Z',bindingCompletedAt:'2026-07-24T02:00:00.000Z',tokenHashEraseAfter:'2026-07-24T01:00:00.000Z'});
    assert.ok(adapter.validateInvitationRecord(r) !== null);
  });
  it('27. authRevokedAt with tokenHash fails', function () {
    var r = makeRecord({claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2026-07-25T00:00:01.000Z',authorizationRevokedAt:'2026-07-24T01:00:00.000Z',tokenHash:'a'.repeat(64)});
    assert.ok(adapter.validateInvitationRecord(r) !== null);
  });
  it('28. pending with claimedByTeacherId fails', function () { assert.ok(adapter.validateInvitationRecord(makeRecord({claimedByTeacherId:'t-a'})) !== null); });
});

describe('D. Collection validation', function () {
  it('29. empty array passes', function () { var r = adapter.validateInvitationCollection([]); assert.strictEqual(r.valid, true); });
  it('30. duplicate id fails', function () { var r = adapter.validateInvitationCollection([makeRecord({id:'inv-dup'}), makeRecord({id:'inv-dup'})]); assert.strictEqual(r.valid, false); });
  it('31. non-array fails', function () { assert.strictEqual(adapter.validateInvitationCollection({}).valid, false); });
  it('32. non-object record fails', function () { assert.strictEqual(adapter.validateInvitationCollection(['not-obj']).valid, false); });
  it('33. duplicate tokenHash fails', function () {
    var h = 'a'.repeat(64);
    assert.strictEqual(adapter.validateInvitationCollection([makeRecord({id:'a',tokenHash:h}), makeRecord({id:'b',tokenHash:h})]).valid, false);
  });
});

describe('E. Redeem validation', function () {
  it('34. pending token redeemable', function () {
    var r = makeRecord(); var check = adapter.validateRedeemableInvitation(r, 't-a', Date.now()); assert.strictEqual(check.ok, true);
  });
  it('35. claimed by same teacher redeemable', function () {
    var future = new Date(Date.now() + 3600000).toISOString();
    var r = makeRecord({expiresAt: future, claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2099-01-01T00:00:00.000Z'});
    assert.strictEqual(adapter.validateRedeemableInvitation(r, 't-a', Date.now()).ok, true);
  });
  it('36. claimed by different teacher rejected', function () {
    var r = makeRecord({claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2099-01-01T00:00:00.000Z'});
    assert.strictEqual(adapter.validateRedeemableInvitation(r, 't-b', Date.now()).ok, false);
  });
  it('37. revoked rejected', function () {
    assert.strictEqual(adapter.validateRedeemableInvitation(makeRecord({revokedAt:'2026-07-24T00:01:00.000Z'}), 't-a', Date.now()).ok, false);
  });
  it('38. authorization_revoked rejected', function () {
    var r = makeRecord({claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2099-01-01T00:00:00.000Z',authorizationRevokedAt:'2026-07-24T01:00:00.000Z'});
    assert.strictEqual(adapter.validateRedeemableInvitation(r, 't-a', Date.now()).ok, false);
  });
  it('39. completed with tokenHash and same teacher redeemable', function () {
    var future = new Date(Date.now() + 7200000).toISOString();
    var r = makeRecord({expiresAt: future, claimedAt:'2026-07-24T00:00:01.000Z',claimedByTeacherId:'t-a',claimRecoveryUntil:'2099-01-01T00:00:00.000Z',bindingCompletedAt:'2026-07-24T00:00:02.000Z',tokenHashEraseAfter:'2099-01-01T00:00:00.000Z',tokenHash:'a'.repeat(64)});
    assert.strictEqual(adapter.validateRedeemableInvitation(r, 't-a', Date.now()).ok, true);
  });
  it('40. createSafeInvitationError returns correct code', function () { var e = adapter.createSafeInvitationError('BINDING_TOKEN_INVALID'); assert.strictEqual(e.code, 'BINDING_TOKEN_INVALID'); });
  it('41. unknown code defaults to BINDING_TOKEN_INVALID', function () { var e = adapter.createSafeInvitationError('UNKNOWN_CODE'); assert.strictEqual(e.code, 'BINDING_TOKEN_INVALID'); });
});
