/**
 * teacher-binding-invitation-adapter.js — 教师绑定邀请纯函数适配器
 *
 * 纯函数模块。不读写文件、不访问网络、不调用模型、不依赖 Express。
 * 不修改任何输入参数。
 *
 * 导出:
 *   isValidRawBindingToken(value)
 *   hashBindingToken(rawToken)
 *   deriveInvitationState(record, now)
 *   validateInvitationRecord(record)
 *   validateInvitationCollection(records)
 *   validateRedeemableInvitation(record, teacherId, now)
 *   createSafeInvitationError(code)
 */

'use strict';

var crypto = require('crypto');

var hop = Object.prototype.hasOwnProperty;

// ============================================================
//  辅助函数
// ============================================================

function isNonArrayObject(val) {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function isArray(val) {
  return Array.isArray(val);
}

function isString(val) {
  return typeof val === 'string';
}

function safeGetOwnString(obj, key, fallback) {
  if (!isNonArrayObject(obj)) return fallback;
  if (!hop.call(obj, key)) return fallback;
  var v = obj[key];
  return isString(v) ? v : fallback;
}

function safeGetOwnNumber(obj, key, fallback) {
  if (!isNonArrayObject(obj)) return fallback;
  if (!hop.call(obj, key)) return fallback;
  var v = obj[key];
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

function isValidISODate(str) {
  if (!isString(str)) return false;
  if (str.trim().length === 0) return false;
  var ts = Date.parse(str);
  return !isNaN(ts) && isFinite(ts);
}

function is64CharLowerHex(str) {
  if (!isString(str)) return false;
  return /^[0-9a-f]{64}$/.test(str);
}

function isBase64Url(str) {
  if (!isString(str)) return false;
  return /^[A-Za-z0-9\-_]+$/.test(str);
}

// ============================================================
//  Token 处理
// ============================================================

/**
 * 验证原始绑定 token 的格式。
 * 要求：string, length 43, base64url 字符。
 */
function isValidRawBindingToken(value) {
  if (!isString(value)) return false;
  if (value.length !== 43) return false;
  return isBase64Url(value);
}

/**
 * 对原始 token 做 SHA-256 哈希，返回 64 位小写 hex。
 * 不修改输入。
 */
function hashBindingToken(rawToken) {
  if (!isString(rawToken)) return '';
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// ============================================================
//  状态推导
// ============================================================

var VALID_STATES = [
  'pending', 'claimed', 'completed', 'revoked', 'expired',
  'abandoned', 'authorization_revoked',
];

/**
 * 根据持久字段和当前时间推导邀请的状态。
 * 不修改输入。
 *
 * @param {object} record
 * @param {number} now — 毫秒时间戳
 * @returns {string} 状态字符串，或 'corrupted' 如果字段组合非法
 */
function deriveInvitationState(record, now) {
  if (!isNonArrayObject(record)) return 'corrupted';

  var bindingCompletedAt = record.bindingCompletedAt;
  var revokedAt = record.revokedAt;
  var expiredAt = record.expiredAt;
  var abandonedAt = record.abandonedAt;
  var authorizationRevokedAt = record.authorizationRevokedAt;
  var claimedAt = record.claimedAt;

  // 计数 terminal flag 字段
  var terminalCount = 0;
  if (hasNonNull(bindingCompletedAt)) terminalCount++;
  if (hasNonNull(revokedAt)) terminalCount++;
  if (hasNonNull(expiredAt)) terminalCount++;
  if (hasNonNull(abandonedAt)) terminalCount++;
  if (terminalCount > 1) return 'corrupted';

  if (hasNonNull(authorizationRevokedAt)) {
    // authorization_revoked 必须有 claim
    if (!hasNonNull(claimedAt)) return 'corrupted';
    return 'authorization_revoked';
  }

  if (hasNonNull(bindingCompletedAt)) return 'completed';
  if (hasNonNull(revokedAt)) return 'revoked';
  if (hasNonNull(expiredAt)) return 'expired';
  if (hasNonNull(abandonedAt)) return 'abandoned';

  if (hasNonNull(claimedAt)) return 'claimed';

  // 检查 pending — 不能有任何 terminal/claim 字段
  if (hasNonNull(record.tokenHashEraseAfter)) return 'corrupted';
  if (hasNonNull(record.claimRecoveryUntil)) return 'corrupted';
  if (hasNonNull(record.claimedByTeacherId)) return 'corrupted';

  return 'pending';
}

function hasNonNull(val) {
  return val !== null && val !== undefined && val !== '';
}

// ============================================================
//  单条记录验证
// ============================================================

/**
 * 验证单条邀请记录的结构不变量。
 * 返回 null 表示通过，否则返回错误描述字符串。
 */
function validateInvitationRecord(record) {
  if (!isNonArrayObject(record)) return 'Record must be a non-array object';

  // id
  if (!isString(record.id) || record.id.trim().length === 0) return 'id must be a non-empty string';

  // tokenHash
  var tokenHash = record.tokenHash;
  if (tokenHash !== null && tokenHash !== undefined && tokenHash !== '') {
    if (!isString(tokenHash)) return 'tokenHash must be a string';
    if (!is64CharLowerHex(tokenHash)) return 'tokenHash must be 64-char lowercase hex';
  }

  // studentId
  if (!isString(record.studentId) || record.studentId.trim().length === 0) return 'studentId must be a non-empty string';

  // createdAt
  if (!isValidISODate(record.createdAt)) return 'createdAt must be a valid ISO date';

  // expiresAt
  if (!isValidISODate(record.expiresAt)) return 'expiresAt must be a valid ISO date';
  if (Date.parse(record.expiresAt) <= Date.parse(record.createdAt)) return 'expiresAt must be after createdAt';

  // claimedAt / claimedByTeacherId / claimRecoveryUntil
  var claimedAt = record.claimedAt;
  var claimedByTeacherId = record.claimedByTeacherId;
  var claimRecoveryUntil = record.claimRecoveryUntil;

  if (hasNonNull(claimedAt) && !isValidISODate(claimedAt)) return 'claimedAt must be a valid ISO date';
  if (hasNonNull(claimedByTeacherId) && !isString(claimedByTeacherId)) return 'claimedByTeacherId must be a string';

  if (hasNonNull(claimedAt) && !hasNonNull(claimedByTeacherId)) return 'claimedAt set but claimedByTeacherId missing';
  if (hasNonNull(claimedByTeacherId) && !hasNonNull(claimedAt)) return 'claimedByTeacherId set but claimedAt missing';
  if (hasNonNull(claimedAt) && !hasNonNull(claimRecoveryUntil)) return 'claimed record must have claimRecoveryUntil';
  if (hasNonNull(claimRecoveryUntil) && !isValidISODate(claimRecoveryUntil)) return 'claimRecoveryUntil must be a valid ISO date';
  if (hasNonNull(claimRecoveryUntil) && hasNonNull(claimedAt)) {
    if (Date.parse(claimRecoveryUntil) < Date.parse(claimedAt)) return 'claimRecoveryUntil must be >= claimedAt';
  }

  // bindingCompletedAt
  var bindingCompletedAt = record.bindingCompletedAt;
  if (hasNonNull(bindingCompletedAt)) {
    if (!isValidISODate(bindingCompletedAt)) return 'bindingCompletedAt must be a valid ISO date';
    if (!hasNonNull(claimedAt)) return 'bindingCompletedAt set but no claim exists';
  }

  // tokenHashEraseAfter
  var tokenHashEraseAfter = record.tokenHashEraseAfter;
  if (hasNonNull(tokenHashEraseAfter)) {
    if (!isValidISODate(tokenHashEraseAfter)) return 'tokenHashEraseAfter must be a valid ISO date';
    if (!hasNonNull(bindingCompletedAt)) return 'tokenHashEraseAfter set but no bindingCompletedAt';
    if (Date.parse(tokenHashEraseAfter) < Date.parse(bindingCompletedAt)) return 'tokenHashEraseAfter must be >= bindingCompletedAt';
  }

  // terminal fields
  var revokedAt = record.revokedAt;
  var expiredAt = record.expiredAt;
  var abandonedAt = record.abandonedAt;

  if (hasNonNull(revokedAt) && !isValidISODate(revokedAt)) return 'revokedAt must be a valid ISO date';
  if (hasNonNull(expiredAt) && !isValidISODate(expiredAt)) return 'expiredAt must be a valid ISO date';
  if (hasNonNull(abandonedAt) && !isValidISODate(abandonedAt)) return 'abandonedAt must be a valid ISO date';

  // 互斥性检查
  var terminalFields = [
    { name: 'bindingCompletedAt', val: bindingCompletedAt },
    { name: 'revokedAt', val: revokedAt },
    { name: 'expiredAt', val: expiredAt },
    { name: 'abandonedAt', val: abandonedAt },
  ];
  var setTerminals = terminalFields.filter(function (t) { return hasNonNull(t.val); });
  if (setTerminals.length > 1) {
    return 'Conflicting terminal fields: ' + setTerminals.map(function (t) { return t.name; }).join(', ');
  }

  // authorizationRevokedAt
  var authorizationRevokedAt = record.authorizationRevokedAt;
  if (hasNonNull(authorizationRevokedAt)) {
    if (!isValidISODate(authorizationRevokedAt)) return 'authorizationRevokedAt must be a valid ISO date';
    if (!hasNonNull(claimedAt)) return 'authorizationRevokedAt set but no claim exists';
    if (hasNonNull(tokenHash) && tokenHash.length > 0) return 'authorizationRevokedAt set but tokenHash still present';
  }

  // pending 不能有 claim/terminal 字段
  if (setTerminals.length === 0 && !hasNonNull(claimedAt)) {
    if (hasNonNull(record.tokenHashEraseAfter)) return 'pending record must not have tokenHashEraseAfter';
    if (hasNonNull(record.claimRecoveryUntil)) return 'pending record must not have claimRecoveryUntil';
    if (hasNonNull(record.claimedByTeacherId)) return 'pending record must not have claimedByTeacherId';
    if (hasNonNull(record.authorizationRevokedAt)) return 'pending record must not have authorizationRevokedAt';
  }

  // completed 必须有 tokenHashEraseAfter（当 bindingCompletedAt 存在时）
  if (hasNonNull(bindingCompletedAt) && !hasNonNull(tokenHashEraseAfter)) {
    return 'completed record must have tokenHashEraseAfter';
  }

  return null;
}

// ============================================================
//  集合验证
// ============================================================

/**
 * 验证整个 invitation 集合。
 * 返回 { valid: boolean, errors: string[] }
 */
function validateInvitationCollection(records) {
  var errors = [];
  if (!isArray(records)) {
    errors.push('Top-level must be an array');
    return { valid: false, errors: errors };
  }

  var seenIds = Object.create(null);
  var seenHashes = Object.create(null);

  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    if (!isNonArrayObject(record)) {
      errors.push('Record at index ' + i + ' is not a non-array object');
      continue;
    }

    var id = record.id;
    if (isString(id) && id.trim().length > 0) {
      if (hop.call(seenIds, id)) {
        errors.push('Duplicate id: ' + id);
      } else {
        seenIds[id] = true;
      }
    }

    var tokenHash = record.tokenHash;
    if (isString(tokenHash) && tokenHash.length > 0) {
      if (hop.call(seenHashes, tokenHash)) {
        errors.push('Duplicate non-empty tokenHash at index ' + i);
      } else {
        seenHashes[tokenHash] = true;
      }
    }

    var recordErr = validateInvitationRecord(record);
    if (recordErr) {
      errors.push('Record ' + (record.id || 'index ' + i) + ': ' + recordErr);
    }

    // 验证状态可推导
    if (!recordErr) {
      var state = deriveInvitationState(record, Date.now());
      if (state === 'corrupted') {
        errors.push('Record ' + (record.id || 'index ' + i) + ': cannot derive unique state');
      }
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

// ============================================================
//  可赎回性验证
// ============================================================

/**
 * 验证邀请记录是否可以被某位教师兑换。
 * 返回 { ok: boolean, error: string|null, record: object|null }
 * 不修改输入。
 */
function validateRedeemableInvitation(record, teacherId, now) {
  if (!isNonArrayObject(record)) {
    return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };
  }
  if (!isString(teacherId) || teacherId.trim().length === 0) {
    return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };
  }
  if (typeof now !== 'number' || !isFinite(now) || now < 0) {
    return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };
  }

  var state = deriveInvitationState(record, now);

  // 检查 authorizationRevokedAt
  if (hasNonNull(record.authorizationRevokedAt)) {
    return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };
  }

  switch (state) {
    case 'pending':
      // 首次兑换：任何人都可以 claim
      return { ok: true, error: null, record: record };

    case 'claimed':
      // 只能是 claiming teacher 继续
      if (record.claimedByTeacherId !== teacherId) {
        return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };
      }
      // 检查 claim 有没有过期
      if (hasNonNull(record.expiresAt) && now > new Date(record.expiresAt).getTime()) {
        return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };
      }
      return { ok: true, error: null, record: record };

    case 'completed':
      // 在同一教师 + 恢复窗口内可以幂等重试
      if (record.claimedByTeacherId !== teacherId) {
        return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };
      }
      if (hasNonNull(record.tokenHash) && record.tokenHash.length > 0) {
        // tokenHash 仍保留（恢复窗口内）
        return { ok: true, error: null, record: record };
      }
      return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };

    case 'revoked':
    case 'expired':
    case 'abandoned':
    case 'authorization_revoked':
      return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };

    default:
      return { ok: false, error: 'BINDING_TOKEN_INVALID', record: null };
  }
}

// ============================================================
//  安全错误创建
// ============================================================

/**
 * 创建统一的安全错误对象。
 * code 只包含：'BINDING_TOKEN_INVALID' | 'INVALID_REQUEST' |
 *   'LEGACY_STUDENT_CODE_BINDING_DISABLED' | 'TOO_MANY_ATTEMPTS' |
 *   'BINDING_INVITATION_STORE_CORRUPTED' | 'BINDINGS_STORE_CORRUPTED'
 */
var CLIENT_VISIBLE_CODES = [
  'BINDING_TOKEN_INVALID',
  'INVALID_REQUEST',
  'LEGACY_STUDENT_CODE_BINDING_DISABLED',
  'TOO_MANY_ATTEMPTS',
  'BINDING_INVITATION_STORE_CORRUPTED',
  'BINDINGS_STORE_CORRUPTED',
];

function createSafeInvitationError(code, detail) {
  if (CLIENT_VISIBLE_CODES.indexOf(code) < 0) {
    code = 'BINDING_TOKEN_INVALID';
  }
  var err = new Error(detail || code);
  err.code = code;
  return err;
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  isValidRawBindingToken: isValidRawBindingToken,
  hashBindingToken: hashBindingToken,
  deriveInvitationState: deriveInvitationState,
  validateInvitationRecord: validateInvitationRecord,
  validateInvitationCollection: validateInvitationCollection,
  validateRedeemableInvitation: validateRedeemableInvitation,
  createSafeInvitationError: createSafeInvitationError,
};
