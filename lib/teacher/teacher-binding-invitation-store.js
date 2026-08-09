/**
 * teacher-binding-invitation-store.js — 教师绑定邀请 Store
 *
 * 提供原子读写、串行队列、损坏数据保护、状态机操作。
 * 测试通过临时目录隔离。不依赖 Express、不访问网络。
 *
 * 导出: createTeacherBindingInvitationStore(options)
 */

'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var adapter = require('./teacher-binding-invitation-adapter');

// ============================================================
//  辅助函数
// ============================================================

var hop = Object.prototype.hasOwnProperty;

function isNonArrayObject(val) {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function isArray(val) {
  return Array.isArray(val);
}

function isString(val) {
  return typeof val === 'string';
}

function safeCopy(record) {
  return {
    id: safeGetOwnString(record, 'id', ''),
    tokenHash: safeGetOwnString(record, 'tokenHash', ''),
    studentId: safeGetOwnString(record, 'studentId', ''),
    createdAt: safeGetOwnString(record, 'createdAt', ''),
    expiresAt: safeGetOwnString(record, 'expiresAt', ''),
    claimedAt: safeGetOwnString(record, 'claimedAt', null),
    claimedByTeacherId: safeGetOwnString(record, 'claimedByTeacherId', null),
    claimRecoveryUntil: safeGetOwnString(record, 'claimRecoveryUntil', null),
    bindingCompletedAt: safeGetOwnString(record, 'bindingCompletedAt', null),
    tokenHashEraseAfter: safeGetOwnString(record, 'tokenHashEraseAfter', null),
    revokedAt: safeGetOwnString(record, 'revokedAt', null),
    expiredAt: safeGetOwnString(record, 'expiredAt', null),
    abandonedAt: safeGetOwnString(record, 'abandonedAt', null),
    authorizationRevokedAt: safeGetOwnString(record, 'authorizationRevokedAt', null),
  };
}

function safeGetOwnString(obj, key, fallback) {
  if (!isNonArrayObject(obj)) return fallback;
  if (!hop.call(obj, key)) return fallback || '';
  var v = obj[key];
  if (v === null || v === undefined) return fallback || '';
  return isString(v) ? v : fallback || '';
}

function toIso(ms) {
  if (typeof ms !== 'number' || !isFinite(ms)) return '';
  return new Date(ms).toISOString();
}

// ============================================================
//  文件读取
// ============================================================

function readAllFromFile(filePath) {
  if (!fs.existsSync(filePath)) return [];

  var stat = fs.statSync(filePath);
  if (stat.size === 0) {
    throw Object.assign(new Error('Invitation file is empty (0 bytes)'), { code: 'BINDING_INVITATION_STORE_CORRUPTED' });
  }

  var raw = fs.readFileSync(filePath, 'utf-8');
  if (raw.trim().length === 0) {
    throw Object.assign(new Error('Invitation file contains only whitespace'), { code: 'BINDING_INVITATION_STORE_CORRUPTED' });
  }

  var parsed;
  try { parsed = JSON.parse(raw); } catch (_) {
    throw Object.assign(new Error('Invitation file contains invalid JSON'), { code: 'BINDING_INVITATION_STORE_CORRUPTED' });
  }

  if (!isArray(parsed)) {
    throw Object.assign(new Error('Invitation file is not an array'), { code: 'BINDING_INVITATION_STORE_CORRUPTED' });
  }

  return parsed;
}

// ============================================================
//  原子写入
// ============================================================

var _counter = 0;

function makeTempPath(filePath) {
  _counter++;
  var dir = path.dirname(filePath);
  var base = path.basename(filePath);
  return path.join(dir, base + '.' + process.pid + '.' + _counter + '.tmp');
}

function atomicWrite(filePath, data) {
  if (!isArray(data)) throw new Error('Refusing to write non-array to invitation file');

  var dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  var json = JSON.stringify(data, null, 2);
  var tmpPath = makeTempPath(filePath);

  try {
    fs.writeFileSync(tmpPath, json, 'utf-8');
    var verifyRaw = fs.readFileSync(tmpPath, 'utf-8');
    var verifyParsed = JSON.parse(verifyRaw);
    if (!isArray(verifyParsed)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw new Error('Temp file is not an array after write');
    }
    try { fs.renameSync(tmpPath, filePath); } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw e;
    }
  } catch (e) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    throw e;
  }
}

// ============================================================
//  Factory
// ============================================================

function createTeacherBindingInvitationStore(options) {
  if (!isNonArrayObject(options)) throw new Error('options must be a non-array object');

  var filePath = options.filePath;
  var nowFn = options.now || Date.now;

  if (!isString(filePath) || filePath.trim().length === 0) {
    throw new Error('options.filePath must be a non-empty string');
  }

  // ---- 串行队列 ----
  var writeQueue = Promise.resolve();

  function enqueue(worker) {
    var operation = writeQueue.then(worker, worker);
    writeQueue = operation.catch(function () {});
    return operation;
  }

  // ============================================================
  //  readAll — 只读
  // ============================================================

  function readAll() {
    var raw = readAllFromFile(filePath);
    // 验证集合不变量
    var validation = adapter.validateInvitationCollection(raw);
    if (!validation.valid) {
      throw Object.assign(
        new Error('Invitation store corrupted: ' + validation.errors.slice(0, 3).join('; ')),
        { code: 'BINDING_INVITATION_STORE_CORRUPTED' }
      );
    }
    var result = [];
    for (var i = 0; i < raw.length; i++) { result.push(safeCopy(raw[i])); }
    return result;
  }

  // ============================================================
  //  findByTokenHash — 只读
  // ============================================================

  function findByTokenHash(tokenHash) {
    if (!isString(tokenHash) || tokenHash.length === 0) return null;

    var all;
    try { all = readAll(); } catch (e) { throw e; }

    for (var i = 0; i < all.length; i++) {
      if (all[i].tokenHash === tokenHash) return all[i];
    }
    return null;
  }

  // ============================================================
  //  _internalReadRaw — 内部使用
  // ============================================================

  function _internalReadRaw() {
    return readAllFromFile(filePath);
  }

  // ============================================================
  //  _internalWrite — 内部使用，不经过自身队列
  // ============================================================

  function _internalWrite(data) {
    atomicWrite(filePath, data);
  }

  // ============================================================
  //  createPending
  // ============================================================

  function createPending(record) {
    return enqueue(function () {
      var now = nowFn();
      var current = _internalReadRaw();

      // 验证记录
      var err = adapter.validateInvitationRecord(record);
      if (err) {
        throw Object.assign(new Error('Invalid invitation record: ' + err), { code: 'INVALID_REQUEST' });
      }

      // 只能创建 pending
      if (record.claimedAt || record.bindingCompletedAt || record.revokedAt || record.expiredAt || record.abandonedAt) {
        throw Object.assign(new Error('createPending must receive a pending record'), { code: 'INVALID_REQUEST' });
      }

      // id 和 tokenHash 唯一性
      for (var i = 0; i < current.length; i++) {
        var r = current[i];
        if (r.id === record.id) {
          throw Object.assign(new Error('Duplicate invitation id: ' + record.id), { code: 'INVALID_REQUEST' });
        }
        if (record.tokenHash && r.tokenHash === record.tokenHash) {
          throw Object.assign(new Error('Duplicate tokenHash'), { code: 'INVALID_REQUEST' });
        }
      }

      current.push(safeCopy(record));
      _internalWrite(current);
      return safeCopy(record);
    });
  }

  // ============================================================
  //  claimForTeacher
  // ============================================================

  function claimForTeacher(tokenHash, teacherId, claimedAt) {
    if (!claimedAt) claimedAt = toIso(nowFn());

    return enqueue(function () {
      var current = _internalReadRaw();

      var foundIdx = -1;
      for (var i = 0; i < current.length; i++) {
        if (current[i].tokenHash === tokenHash) { foundIdx = i; break; }
      }
      if (foundIdx < 0) return null;

      var record = safeCopy(current[foundIdx]);
      var state = adapter.deriveInvitationState(record, nowFn());

      if (state !== 'pending') return null;

      record.claimedAt = claimedAt;
      record.claimedByTeacherId = teacherId;
      // claimRecoveryUntil = claimedAt + 24 hours
      var claimMs = Date.parse(claimedAt);
      record.claimRecoveryUntil = toIso(claimMs + 24 * 60 * 60 * 1000);

      current[foundIdx] = record;
      _internalWrite(current);
      return safeCopy(record);
    });
  }

  // ============================================================
  //  completeBinding
  // ============================================================

  function completeBinding(tokenHash, teacherId, completedAt) {
    if (!completedAt) completedAt = toIso(nowFn());

    return enqueue(function () {
      var current = _internalReadRaw();

      var foundIdx = -1;
      for (var i = 0; i < current.length; i++) {
        if (current[i].tokenHash === tokenHash) { foundIdx = i; break; }
      }
      if (foundIdx < 0) return null;

      var record = safeCopy(current[foundIdx]);

      // 只能由 claimedByTeacherId 完成
      if (record.claimedByTeacherId !== teacherId) return null;

      var state = adapter.deriveInvitationState(record, nowFn());
      if (state !== 'claimed' && state !== 'completed') return null;

      // 如果已经是 completed，幂等返回
      if (state === 'completed') return safeCopy(record);

      record.bindingCompletedAt = completedAt;
      // tokenHashEraseAfter = max(expiresAt, bindingCompletedAt + 24h)
      var completedMs = Date.parse(completedAt);
      var expiresMs = Date.parse(record.expiresAt);
      var eraseMs = Math.max(expiresMs, completedMs + 24 * 60 * 60 * 1000);
      record.tokenHashEraseAfter = toIso(eraseMs);

      current[foundIdx] = record;
      _internalWrite(current);
      return safeCopy(record);
    });
  }

  // ============================================================
  //  revokeInvitation
  // ============================================================

  function revokeInvitation(invitationId, studentId, revokedAt) {
    if (!revokedAt) revokedAt = toIso(nowFn());

    return enqueue(function () {
      var current = _internalReadRaw();

      var foundIdx = -1;
      for (var i = 0; i < current.length; i++) {
        if (current[i].id === invitationId && current[i].studentId === studentId) { foundIdx = i; break; }
      }
      if (foundIdx < 0) return null;

      var record = safeCopy(current[foundIdx]);
      var state = adapter.deriveInvitationState(record, nowFn());

      // 只能撤销 pending/claimed（binding 检查由 Service 完成）
      if (state !== 'pending' && state !== 'claimed') return null;

      record.revokedAt = revokedAt;
      record.tokenHash = '';  // 清除 tokenHash

      current[foundIdx] = record;
      _internalWrite(current);
      return safeCopy(record);
    });
  }

  // ============================================================
  //  expireInvitation
  // ============================================================

  function expireInvitation(invitationId, studentId, expiredAt) {
    if (!expiredAt) expiredAt = toIso(nowFn());

    return enqueue(function () {
      var current = _internalReadRaw();

      var foundIdx = -1;
      for (var i = 0; i < current.length; i++) {
        if (current[i].id === invitationId && current[i].studentId === studentId) { foundIdx = i; break; }
      }
      if (foundIdx < 0) return null;

      var record = safeCopy(current[foundIdx]);
      var state = adapter.deriveInvitationState(record, nowFn());

      // 只能将 pending 转为 expired
      if (state !== 'pending') return null;

      record.expiredAt = expiredAt;
      record.tokenHash = '';  // 清除 tokenHash

      current[foundIdx] = record;
      _internalWrite(current);
      return safeCopy(record);
    });
  }

  // ============================================================
  //  abandonClaimed
  // ============================================================

  function abandonClaimed(invitationId, abandonedAt) {
    if (!abandonedAt) abandonedAt = toIso(nowFn());

    return enqueue(function () {
      var current = _internalReadRaw();

      var foundIdx = -1;
      for (var i = 0; i < current.length; i++) {
        if (current[i].id === invitationId) { foundIdx = i; break; }
      }
      if (foundIdx < 0) return null;

      var record = safeCopy(current[foundIdx]);
      var state = adapter.deriveInvitationState(record, nowFn());
      if (state !== 'claimed') return null;

      record.abandonedAt = abandonedAt;
      record.tokenHash = '';  // 清除 tokenHash

      current[foundIdx] = record;
      _internalWrite(current);
      return safeCopy(record);
    });
  }

  // ============================================================
  //  invalidateRecoveryForPair
  // ============================================================

  function invalidateRecoveryForPair(studentId, teacherId, revokedAt) {
    if (!revokedAt) revokedAt = toIso(nowFn());

    return enqueue(function () {
      var current = _internalReadRaw();
      var count = 0;

      for (var i = 0; i < current.length; i++) {
        var record = current[i];
        if (record.studentId !== studentId) continue;
        if (record.claimedByTeacherId !== teacherId) continue;

        var state = adapter.deriveInvitationState(record, nowFn());
        // 只处理 claimed/completed（有 tokenHash 且存在恢复可能的）
        if (state !== 'claimed' && state !== 'completed') continue;

        var rec = safeCopy(record);
        rec.authorizationRevokedAt = revokedAt;
        rec.tokenHash = '';  // 清除 tokenHash
        current[i] = rec;
        count++;
      }

      if (count > 0) {
        _internalWrite(current);
      }
      return count;
    });
  }

  // ============================================================
  //  invalidateAllActiveForStudent
  // ============================================================

  function invalidateAllActiveForStudent(studentId, revokedAt) {
    if (!revokedAt) revokedAt = toIso(nowFn());

    return enqueue(function () {
      var current = _internalReadRaw();
      var count = 0;

      for (var i = 0; i < current.length; i++) {
        var record = current[i];
        if (record.studentId !== studentId) continue;

        var state = adapter.deriveInvitationState(record, nowFn());
        if (state !== 'pending') continue;

        var rec = safeCopy(record);
        rec.revokedAt = revokedAt;
        rec.tokenHash = '';
        current[i] = rec;
        count++;
      }

      if (count > 0) {
        _internalWrite(current);
      }
      return count;
    });
  }

  // ============================================================
  //  cleanupTerminalRecords
  // ============================================================

  var MAX_RECORDS = 10000;
  var TRIM_TO = 5000;

  function cleanupTerminalRecords(cleanupNow) {
    if (!cleanupNow) cleanupNow = nowFn();

    return enqueue(function () {
      var current = _internalReadRaw();
      var modified = false;

      // 1. 清除到期的 tokenHash
      for (var i = 0; i < current.length; i++) {
        var record = current[i];
        if (!record.tokenHash || record.tokenHash.length === 0) continue;

        // revoked/expired/abandoned/authorization_revoked → 立即清除 tokenHash
        var state = adapter.deriveInvitationState(record, cleanupNow);
        if (state === 'revoked' || state === 'expired' || state === 'abandoned' || state === 'authorization_revoked') {
          var rec1 = safeCopy(record);
          rec1.tokenHash = '';
          current[i] = rec1;
          modified = true;
          continue;
        }

        // completed：如果 tokenHashEraseAfter 已过 → 清除
        if (state === 'completed' && record.tokenHashEraseAfter) {
          var eraseMs = Date.parse(record.tokenHashEraseAfter);
          if (!isNaN(eraseMs) && cleanupNow >= eraseMs) {
            var rec2 = safeCopy(record);
            rec2.tokenHash = '';
            current[i] = rec2;
            modified = true;
          }
        }
      }

      // 2. 如果记录超过上限，裁剪 terminal 记录
      if (current.length >= MAX_RECORDS) {
        // 分类
        var pendingClaimed = [];
        var terminals = [];
        for (var j = 0; j < current.length; j++) {
          var st = adapter.deriveInvitationState(current[j], cleanupNow);
          if (st === 'pending' || st === 'claimed') {
            pendingClaimed.push(current[j]);
          } else {
            terminals.push(current[j]);
          }
        }

        if (current.length > TRIM_TO) {
          // 裁剪 terminal：expired → revoked → abandoned → completed（最老优先）
          terminals.sort(function (a, b) {
            var sa = adapter.deriveInvitationState(a, cleanupNow);
            var sb = adapter.deriveInvitationState(b, cleanupNow);
            var order = { expired: 0, revoked: 1, abandoned: 2, completed: 3, authorization_revoked: 4 };
            var oa = order[sa] || 5;
            var ob = order[sb] || 5;
            if (oa !== ob) return oa - ob;
            // 同类别：最老优先
            var dateA = Date.parse(a.createdAt || '');
            var dateB = Date.parse(b.createdAt || '');
            if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
            return 0;
          });

          var targetCount = TRIM_TO - pendingClaimed.length;
          if (targetCount < 0) targetCount = 0;
          terminals = terminals.slice(-targetCount); // keep newest
          current = pendingClaimed.concat(terminals);
          modified = true;
        }
      }

      if (modified) {
        _internalWrite(current);
      }
      return { recordsNow: current.length, modified: modified };
    });
  }

  // ============================================================
  //  导出
  // ============================================================

  return {
    readAll: readAll,
    findByTokenHash: findByTokenHash,
    createPending: createPending,
    claimForTeacher: claimForTeacher,
    completeBinding: completeBinding,
    revokeInvitation: revokeInvitation,
    expireInvitation: expireInvitation,
    abandonClaimed: abandonClaimed,
    invalidateRecoveryForPair: invalidateRecoveryForPair,
    invalidateAllActiveForStudent: invalidateAllActiveForStudent,
    cleanupTerminalRecords: cleanupTerminalRecords,
    _internalReadRaw: _internalReadRaw,
    _internalWrite: _internalWrite,
  };
}

module.exports = { createTeacherBindingInvitationStore: createTeacherBindingInvitationStore };
