/**
 * teacher-safety-signal-store.js — 教师端安全信号处理状态持久化 Store
 *
 * 参照 teacher-insight-review-store.js 模式。
 * 不依赖 Express、不访问网络。
 *
 * 导出：createTeacherSafetySignalStore(options)
 */

'use strict';

var fs = require('fs');
var path = require('path');

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

function safeGetOwnString(obj, key, fallback) {
  if (!isNonArrayObject(obj)) return fallback;
  if (!hop.call(obj, key)) return fallback;
  var v = obj[key];
  return isString(v) ? v : fallback;
}

// ============================================================
//  状态常量
// ============================================================

var VALID_STATUSES = ['pending', 'contacted_parent', 'followed_up', 'confirmed_no_action'];

// ============================================================
//  记录验证
// ============================================================

function validateRecord(record) {
  if (!isNonArrayObject(record)) return false;
  if (!isString(record.id) || record.id.trim().length === 0) return false;
  if (!isString(record.studentId) || record.studentId.trim().length === 0) return false;
  if (!isString(record.conversationId) || record.conversationId.trim().length === 0) return false;
  if (!hop.call(record, 'status') || !isString(record.status)) return false;
  if (VALID_STATUSES.indexOf(record.status) < 0) return false;
  if (!isString(record.createdAt)) return false;
  if (!isString(record.updatedAt)) return false;
  return true;
}

function safeCopy(record) {
  return {
    id: safeGetOwnString(record, 'id', ''),
    teacherId: safeGetOwnString(record, 'teacherId', ''),
    studentId: safeGetOwnString(record, 'studentId', ''),
    conversationId: safeGetOwnString(record, 'conversationId', ''),
    safetyNote: safeGetOwnString(record, 'safetyNote', ''),
    conversationStartTime: safeGetOwnString(record, 'conversationStartTime', ''),
    activeTopic: (record.activeTopic !== null && record.activeTopic !== undefined && isString(record.activeTopic)) ? record.activeTopic : null,
    status: safeGetOwnString(record, 'status', 'pending'),
    processedBy: (record.processedBy !== null && record.processedBy !== undefined && isString(record.processedBy)) ? record.processedBy : null,
    processedAt: (record.processedAt !== null && record.processedAt !== undefined && isString(record.processedAt)) ? record.processedAt : null,
    note: (record.note !== null && record.note !== undefined && isString(record.note)) ? record.note : null,
    createdAt: safeGetOwnString(record, 'createdAt', ''),
    updatedAt: safeGetOwnString(record, 'updatedAt', ''),
  };
}

// ============================================================
//  文件读取
// ============================================================

function readAllFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  var raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    throw Object.assign(new Error('Failed to read safety signal file'), { code: 'SAFETY_SIGNAL_STORE_CORRUPTED' });
  }

  if (raw.trim().length === 0) {
    return [];
  }

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw Object.assign(new Error('Safety signal file contains invalid JSON'), { code: 'SAFETY_SIGNAL_STORE_CORRUPTED' });
  }

  if (!isArray(parsed)) {
    throw Object.assign(new Error('Safety signal file top-level is not an array'), { code: 'SAFETY_SIGNAL_STORE_CORRUPTED' });
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
  if (!isArray(data)) {
    throw new Error('Refusing to write non-array to safety signal file');
  }

  var dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  var json = JSON.stringify(data, null, 2);
  var tmpPath = makeTempPath(filePath);

  try {
    fs.writeFileSync(tmpPath, json, 'utf-8');
    var verifyRaw = fs.readFileSync(tmpPath, 'utf-8');
    JSON.parse(verifyRaw); // 验证可解析
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    throw e;
  }
}

// ============================================================
//  Factory
// ============================================================

function createTeacherSafetySignalStore(options) {
  if (!isNonArrayObject(options)) {
    throw new Error('options must be a non-array object');
  }
  if (!isString(options.filePath) || options.filePath.trim().length === 0) {
    throw new Error('options.filePath must be a non-empty string');
  }

  var filePath = options.filePath;

  // ---- 串行队列 ----
  var writeQueue = Promise.resolve();

  function enqueue(worker) {
    return new Promise(function (resolve, reject) {
      writeQueue = writeQueue.then(function () {
        return new Promise(function (innerResolve) {
          try {
            var result = worker();
            if (result && typeof result.then === 'function') {
              result.then(
                function (val) { resolve(val); innerResolve(); },
                function (err) { reject(err); innerResolve(); }
              );
            } else {
              resolve(result);
              innerResolve();
            }
          } catch (e) {
            reject(e);
            innerResolve();
          }
        });
      });
      writeQueue = writeQueue.catch(function () { /* 吞错误，队列继续 */ });
    });
  }

  // ---- readAll ----
  function readAll() {
    var raw = readAllFromFile(filePath);
    var result = [];
    for (var i = 0; i < raw.length; i++) {
      result.push(safeCopy(raw[i]));
    }
    return result;
  }

  // ---- findByStudentId ----
  function findByStudentId(studentId) {
    if (!isString(studentId) || studentId.trim().length === 0) return [];
    var all = readAll();
    var result = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].studentId === studentId) result.push(all[i]);
    }
    return result;
  }

  // ---- upsert ----
  function upsert(record) {
    if (!validateRecord(record)) {
      return Promise.reject(
        Object.assign(new Error('Invalid safety signal record'), { code: 'INVALID_SAFETY_SIGNAL_RECORD' })
      );
    }

    var inputCopy = safeCopy(record);

    return enqueue(function () {
      var current;
      try {
        current = readAllFromFile(filePath);
      } catch (e) {
        current = [];
      }

      // 匹配键：teacherId + studentId + conversationId
      var foundIdx = -1;
      for (var i = 0; i < current.length; i++) {
        var r = current[i];
        if (
          isNonArrayObject(r) &&
          hop.call(r, 'teacherId') && r.teacherId === inputCopy.teacherId &&
          hop.call(r, 'studentId') && r.studentId === inputCopy.studentId &&
          hop.call(r, 'conversationId') && r.conversationId === inputCopy.conversationId
        ) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx >= 0) {
        current[foundIdx] = inputCopy;
      } else {
        current.push(inputCopy);
      }

      atomicWrite(filePath, current);
      return safeCopy(inputCopy);
    });
  }

  // ---- findOne ----
  function findOne(input) {
    if (!isNonArrayObject(input)) return null;

    var teacherId = input.teacherId;
    var studentId = input.studentId;
    var conversationId = input.conversationId;

    if (!isString(teacherId) || teacherId.trim().length === 0) return null;
    if (!isString(studentId) || studentId.trim().length === 0) return null;
    if (!isString(conversationId) || conversationId.trim().length === 0) return null;

    var all;
    try {
      all = readAllFromFile(filePath);
    } catch (e) {
      return null;
    }

    if (!isArray(all)) return null;

    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (!isNonArrayObject(r)) continue;
      if (
        hop.call(r, 'teacherId') && r.teacherId === teacherId &&
        hop.call(r, 'studentId') && r.studentId === studentId &&
        hop.call(r, 'conversationId') && r.conversationId === conversationId
      ) {
        return safeCopy(r);
      }
    }

    return null;
  }

  // ---- findBySignalId ----
  function findBySignalId(signalId) {
    if (!isString(signalId) || signalId.trim().length === 0) return null;
    var all = readAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === signalId) return safeCopy(all[i]);
    }
    return null;
  }

  return {
    readAll: readAll,
    findByStudentId: findByStudentId,
    upsert: upsert,
    findOne: findOne,
    findBySignalId: findBySignalId,
  };
}

module.exports = {
  createTeacherSafetySignalStore: createTeacherSafetySignalStore,
};
