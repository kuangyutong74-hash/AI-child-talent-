/**
 * teacher-insight-review-store.js — 教师端潜能线索审核记录持久化 Store
 *
 * 提供原子读写、串行队列、损坏数据保护的审核记录存储。
 * 测试通过临时目录隔离，不依赖 Express、不访问网络。
 *
 * 导出：createTeacherInsightReviewStore(options)
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
//  记录验证
// ============================================================

var VALID_REVIEW_STATUSES = ['unreviewed', 'teacher_confirmed', 'rejected'];

function validateRecord(record) {
  if (!isNonArrayObject(record)) return false;
  if (!isString(record.id) || record.id.trim().length === 0) return false;
  if (!isString(record.teacherId) || record.teacherId.trim().length === 0) return false;
  if (!isString(record.studentId) || record.studentId.trim().length === 0) return false;
  if (!isString(record.insightId) || record.insightId.trim().length === 0) return false;
  if (!isString(record.conversationId)) return false;
  if (!hop.call(record, 'reviewStatus') || !isString(record.reviewStatus)) return false;
  if (VALID_REVIEW_STATUSES.indexOf(record.reviewStatus) < 0) return false;
  if (!hop.call(record, 'note') || !isString(record.note)) return false;
  if (!isString(record.createdAt)) return false;
  if (!isString(record.updatedAt)) return false;
  return true;
}

function safeCopy(record) {
  return {
    id: safeGetOwnString(record, 'id', ''),
    teacherId: safeGetOwnString(record, 'teacherId', ''),
    studentId: safeGetOwnString(record, 'studentId', ''),
    insightId: safeGetOwnString(record, 'insightId', ''),
    conversationId: safeGetOwnString(record, 'conversationId', ''),
    reviewStatus: safeGetOwnString(record, 'reviewStatus', 'unreviewed'),
    note: safeGetOwnString(record, 'note', ''),
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

  var stat;
  try {
    stat = fs.statSync(filePath);
  } catch (e) {
    throw Object.assign(new Error('Failed to stat review file'), { code: 'REVIEW_STORE_CORRUPTED' });
  }

  if (stat.size === 0) {
    throw Object.assign(new Error('Review file is empty (0 bytes). Manual intervention required.'), { code: 'REVIEW_STORE_CORRUPTED' });
  }

  var raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    throw Object.assign(new Error('Failed to read review file'), { code: 'REVIEW_STORE_CORRUPTED' });
  }

  if (raw.trim().length === 0) {
    throw Object.assign(new Error('Review file contains only whitespace. Manual intervention required.'), { code: 'REVIEW_STORE_CORRUPTED' });
  }

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw Object.assign(new Error('Review file contains invalid JSON. Manual intervention required.'), { code: 'REVIEW_STORE_CORRUPTED' });
  }

  if (!isArray(parsed)) {
    throw Object.assign(new Error('Review file top-level is not an array. Manual intervention required.'), { code: 'REVIEW_STORE_CORRUPTED' });
  }

  return parsed;
}

// ============================================================
//  原子写入
// ============================================================

var _counter = 0;

function makeTempPath(filePath) {
  _counter++;
  // 使用 pid + 递增计数器保证唯一性
  var dir = path.dirname(filePath);
  var base = path.basename(filePath);
  return path.join(dir, base + '.' + process.pid + '.' + _counter + '.tmp');
}

function atomicWrite(filePath, data) {
  if (!isArray(data)) {
    throw new Error('Refusing to write non-array to review file');
  }

  var dir = path.dirname(filePath);
  // 确保目录存在
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  var json = JSON.stringify(data, null, 2);
  var tmpPath = makeTempPath(filePath);

  try {
    // 1. 写入临时文件
    fs.writeFileSync(tmpPath, json, 'utf-8');

    // 2. 回读验证
    var verifyRaw;
    try {
      verifyRaw = fs.readFileSync(tmpPath, 'utf-8');
    } catch (e) {
      // 无法回读 — 清理并抛错
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw new Error('Failed to read back temp file for verification');
    }

    var verifyParsed;
    try {
      verifyParsed = JSON.parse(verifyRaw);
    } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw new Error('Temp file contains invalid JSON after write');
    }

    if (!isArray(verifyParsed)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw new Error('Temp file is not an array after write');
    }

    // 3. rename 替换正式文件
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (e) {
      // rename 失败 — 旧正式文件不变，清理 tmp
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw e;
    }
  } catch (e) {
    // 确保不留 tmp 残留
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    throw e;
  }
}

// ============================================================
//  Factory
// ============================================================

/**
 * @param {object} options
 * @param {string} options.filePath — 审核记录文件完整路径
 * @returns {{ readAll, upsert, findOne }}
 */
function createTeacherInsightReviewStore(options) {
  if (!isNonArrayObject(options)) {
    throw new Error('options must be a non-array object');
  }
  if (!isString(options.filePath) || options.filePath.trim().length === 0) {
    throw new Error('options.filePath must be a non-empty string');
  }

  var filePath = options.filePath;

  // ---- 串行队列 ----
  var writeQueue = Promise.resolve();

  /**
   * 将操作放入串行队列。
   * 队列内部完成完整的 read-modify-write。
   */
  function enqueue(worker) {
    return new Promise(function (resolve, reject) {
      writeQueue = writeQueue.then(function () {
        return new Promise(function (innerResolve) {
          try {
            var result = worker();
            // 如果 worker 返回 Promise，等待它
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
      // 确保即使当前操作失败，后续操作仍能继续
      writeQueue = writeQueue.catch(function () {
        // 吞掉错误，队列继续
      });
    });
  }

  // ============================================================
  //  readAll
  // ============================================================

  function readAll() {
    var raw = readAllFromFile(filePath);
    // 返回新数组，每个元素安全复制
    var result = [];
    for (var i = 0; i < raw.length; i++) {
      result.push(safeCopy(raw[i]));
    }
    return result;
  }

  // ============================================================
  //  upsert
  // ============================================================

  function upsert(record) {
    if (!validateRecord(record)) {
      return Promise.reject(
        Object.assign(new Error('Invalid review record'), { code: 'INVALID_REVIEW_RECORD' })
      );
    }

    // 不修改输入 — 立即复制
    var inputCopy = safeCopy(record);

    return enqueue(function () {
      try {
        // 在队列内部重新读取最新数据
        var current;
        try {
          current = readAllFromFile(filePath);
        } catch (e) {
          if (hop.call(e, 'code') && e.code === 'REVIEW_STORE_CORRUPTED') {
            throw e;
          }
          current = [];
        }

        // 查找同键记录
        var foundIdx = -1;
        for (var i = 0; i < current.length; i++) {
          var r = current[i];
          if (
            isNonArrayObject(r) &&
            hop.call(r, 'teacherId') && r.teacherId === inputCopy.teacherId &&
            hop.call(r, 'studentId') && r.studentId === inputCopy.studentId &&
            hop.call(r, 'insightId') && r.insightId === inputCopy.insightId
          ) {
            foundIdx = i;
            break;
          }
        }

        if (foundIdx >= 0) {
          // 替换原位置
          current[foundIdx] = inputCopy;
        } else {
          // 追加到末尾
          current.push(inputCopy);
        }

        // 原子写入
        atomicWrite(filePath, current);

        // 返回写入记录副本
        return safeCopy(inputCopy);
      } catch (e) {
        throw e;
      }
    });
  }

  // ============================================================
  //  findOne
  // ============================================================

  function findOne(input) {
    if (!isNonArrayObject(input)) return null;

    var teacherId = input.teacherId;
    var studentId = input.studentId;
    var insightId = input.insightId;

    if (!isString(teacherId) || teacherId.trim().length === 0) return null;
    if (!isString(studentId) || studentId.trim().length === 0) return null;
    if (!isString(insightId) || insightId.trim().length === 0) return null;

    var all;
    try {
      all = readAllFromFile(filePath);
    } catch (e) {
      if (hop.call(e, 'code') && e.code === 'REVIEW_STORE_CORRUPTED') {
        throw e;
      }
      return null;
    }

    if (!isArray(all)) return null;

    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (!isNonArrayObject(r)) continue;
      if (
        hop.call(r, 'teacherId') && r.teacherId === teacherId &&
        hop.call(r, 'studentId') && r.studentId === studentId &&
        hop.call(r, 'insightId') && r.insightId === insightId
      ) {
        return safeCopy(r);
      }
    }

    return null;
  }

  return {
    readAll: readAll,
    upsert: upsert,
    findOne: findOne,
  };
}

module.exports = {
  createTeacherInsightReviewStore: createTeacherInsightReviewStore,
};
