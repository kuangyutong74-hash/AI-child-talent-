/**
 * teacher-binding-audit-store.js — 安全审计 JSONL Store
 *
 * 每行一个合法 JSON 审计事件。串行 append，先验证后写入。
 * 不存储 token、tokenHash、password、Session 或聊天内容。
 * 审计文件不是授权事实来源。
 *
 * 导出: createTeacherBindingAuditStore(options)
 */
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

function isString(v) { return typeof v === 'string'; }
function isNonArrayObject(v) { return Boolean(v && typeof v === 'object' && !Array.isArray(v)); }
function isArray(v) { return Array.isArray(v); }

// ============================================================
//  White-listed event types
// ============================================================

var VALID_EVENT_TYPES = [
  'BINDING_INVITATION_CREATED',
  'BINDING_INVITATION_CREATE_REJECTED',
  'BINDING_INVITATION_REVOKED',
  'BINDING_INVITATION_REVOKE_REJECTED',
  'BINDING_TOKEN_REDEEMED',
  'BINDING_TOKEN_REDEEM_REJECTED',
  'BINDING_TOKEN_RATE_LIMITED',
  'BINDING_GLOBAL_ANOMALY',
  'TEACHER_BINDING_REMOVED',
  'TEACHER_BINDING_REMOVE_REJECTED',
  'AUDIT_WRITE_FAILED',
];

var VALID_REASON_CATEGORIES = [
  'SUCCESS',
  'INVALID_TOKEN',
  'RATE_LIMIT_TEACHER',
  'RATE_LIMIT_IP',
  'GLOBAL_ANOMALY',
  'INVALID_ROLE',
  'GUEST_FORBIDDEN',
  'NOT_OWNER',
  'BINDING_EXISTS',
  'BINDING_NOT_FOUND',
  'STORE_FAILURE',
  'AUDIT_FAILURE',
  'INVALID_REQUEST',
];

var VALID_ACTOR_ROLES = ['student', 'teacher', 'system'];

// ============================================================
//  Forbidden value patterns (sensitive content scan)
// ============================================================

var FORBIDDEN_KEYS = [
  'rawToken', 'raw_token', 'token', 'bindingToken', 'binding_token',
  'tokenHash', 'token_hash', 'tokenHashEraseAfter',
  'passwordHash', 'password_hash', 'password',
  'cookie', 'Cookie', 'session', 'Session',
  'studentCode', 'student_code',
  'message', 'messages', 'chat', 'content',
  'insight', 'review', 'report',
  'ip', 'sourceIp', 'source_ip', 'remoteAddress',
  'header', 'headers', 'req', 'request',
  'err', 'error', 'stack', 'detail',
  'filePath', 'file_path', 'dir', 'dataDir',
];

function hasSensitiveContent(obj) {
  var str = JSON.stringify(obj).toLowerCase();
  // 43-char base64url token pattern
  if (/[A-Za-z0-9\-_]{43}/.test(str)) return 'possible token in payload';
  // 64-char hex hash
  if (/[0-9a-f]{64}/.test(str)) return 'possible tokenHash in payload';
  // credential patterns
  if (/token=/.test(str)) return 'token= in payload';
  if (/authorization/i.test(str)) return 'Authorization in payload';
  if (/deeps[e]ek/i.test(str)) return 'DeepSeek in payload';
  return null;
}

// ============================================================
//  Single event validation
// ============================================================

function validateEvent(event) {
  if (!isNonArrayObject(event)) return 'Event must be a non-array object';
  if (isArray(event)) return 'Event must not be an array';

  // eventType — whitelist
  var eventType = event.eventType;
  if (!isString(eventType) || VALID_EVENT_TYPES.indexOf(eventType) < 0) {
    return 'Invalid eventType: ' + String(eventType);
  }

  // reasonCategory — whitelist
  var reasonCategory = event.reasonCategory;
  if (reasonCategory !== null && reasonCategory !== undefined) {
    if (!isString(reasonCategory) || VALID_REASON_CATEGORIES.indexOf(reasonCategory) < 0) {
      return 'Invalid reasonCategory: ' + String(reasonCategory);
    }
  }

  // occurredAt — required ISO string
  var occurredAt = event.occurredAt;
  if (!isString(occurredAt) || occurredAt.trim().length === 0) return 'occurredAt required';
  if (isNaN(Date.parse(occurredAt))) return 'occurredAt not a valid date';

  // outcome — required, whitelist
  var outcome = event.outcome;
  if (outcome !== 'SUCCESS' && outcome !== 'FAILURE' && outcome !== 'REJECTED' && outcome !== 'ANOMALY') {
    return 'Invalid outcome: ' + String(outcome);
  }

  // actorRole — required, whitelist
  var actorRole = event.actorRole;
  if (!isString(actorRole) || VALID_ACTOR_ROLES.indexOf(actorRole) < 0) {
    return 'Invalid actorRole: ' + String(actorRole);
  }

  // actorId — max 128 chars
  if (!isString(event.actorId) || event.actorId.length > 128) return 'actorId required, max 128';
  if (event.actorId.indexOf('\n') >= 0 || event.actorId.indexOf('\r') >= 0) return 'actorId contains newline';

  // studentId, teacherId, invitationId — max 128 chars each
  ['studentId', 'teacherId', 'invitationId'].forEach(function (f) {
    if (event[f] !== null && event[f] !== undefined && event[f] !== '') {
      if (!isString(event[f]) || event[f].length > 128) return 'field ' + f + ' invalid';
      if (event[f].indexOf('\n') >= 0 || event[f].indexOf('\r') >= 0) return 'field ' + f + ' contains newline';
    }
  });

  // Forbidden keys scan
  var keys = Object.keys(event);
  for (var i = 0; i < keys.length; i++) {
    if (FORBIDDEN_KEYS.indexOf(keys[i]) >= 0) {
      return 'Forbidden key in event: ' + keys[i];
    }
  }

  // JSON line must not contain embedded newline
  var line = JSON.stringify(event);
  if (line.indexOf('\n') >= 0 || line.indexOf('\r') >= 0) return 'Event line contains newline';

  // Sensitive content scan
  var sensitive = hasSensitiveContent(event);
  if (sensitive) return sensitive;

  return null;
}

// ============================================================
//  Factory
// ============================================================

function createTeacherBindingAuditStore(options) {
  if (!isNonArrayObject(options)) throw new Error('options must be a non-array object');

  var filePath = options.filePath;
  if (!isString(filePath) || filePath.trim().length === 0) throw new Error('filePath required');

  var nowFn = options.now || Date.now;
  var onWriteFailure = options.onWriteFailure || function () {};

  var writeQueue = Promise.resolve();

  // ============================================================
  //  appendEvent
  // ============================================================

  function appendEvent(event) {
    return new Promise(function (resolve, reject) {
      writeQueue = writeQueue.then(function () {
        return doAppend(event).then(resolve, reject);
      }, function () {
        return doAppend(event).then(resolve, reject);
      });
    });
  }

  function doAppend(event) {
    // Validate
    var vErr = validateEvent(event);
    if (vErr) {
      return Promise.reject(new Error('Audit event validation failed: ' + vErr));
    }

    // Add eventId if missing
    if (!event.eventId) {
      event.eventId = 'audit-' + crypto.randomUUID();
    }

    var line = JSON.stringify(event) + '\n';

    // Ensure directory exists
    var dir = path.dirname(filePath);
    if (fs.existsSync(dir)) {
      var dStat = fs.statSync(dir);
      if (!dStat.isDirectory()) {
        var err = new Error('Audit file parent path is not a directory');
        try { onWriteFailure(err); } catch (_) {}
        return Promise.reject(err);
      }
    } else {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {
        try { onWriteFailure(e); } catch (_) {}
        return Promise.reject(new Error('Cannot create audit directory'));
      }
    }

    try {
      fs.appendFileSync(filePath, line, 'utf-8');
      return Promise.resolve(event);
    } catch (e) {
      try { onWriteFailure(e); } catch (_) {}
      return Promise.reject(e);
    }
  }

  // ============================================================
  //  flush — no-op (sync append)
  // ============================================================

  function flush() {
    return writeQueue;
  }

  // ============================================================
  //  readForTests — only for test verification
  // ============================================================

  function readForTests() {
    if (!fs.existsSync(filePath)) return [];
    var raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.trim().length === 0) return [];
    var lines = raw.split('\n');
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.length === 0) continue;
      try { result.push(JSON.parse(line)); } catch (_) {}
    }
    return result;
  }

  return {
    appendEvent: appendEvent,
    validateEvent: validateEvent,
    flush: flush,
    readForTests: readForTests,
  };
}

module.exports = {
  createTeacherBindingAuditStore: createTeacherBindingAuditStore,
  validateEvent: validateEvent,
  VALID_EVENT_TYPES: VALID_EVENT_TYPES,
  VALID_REASON_CATEGORIES: VALID_REASON_CATEGORIES,
};
