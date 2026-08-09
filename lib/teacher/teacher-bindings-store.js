/**
 * teacher-bindings-store.js — 教师绑定关系权威 Store
 *
 * 提供原子读写、串行队列、损坏数据保护。
 * 绑定关系是教师授权的唯一事实来源。
 *
 * 导出: createTeacherBindingsStore(options)
 */

'use strict';

var fs = require('fs');
var path = require('path');

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

var DANGEROUS_KEYS = ['__proto__', 'prototype', 'constructor'];

function isDangerousKey(key) {
  for (var i = 0; i < DANGEROUS_KEYS.length; i++) {
    if (key === DANGEROUS_KEYS[i]) return true;
  }
  return false;
}

// ============================================================
//  文件读取
// ============================================================

function readFromFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  var stat = fs.statSync(filePath);
  if (stat.size === 0) {
    throw Object.assign(new Error('Bindings file is empty (0 bytes)'), { code: 'BINDINGS_STORE_CORRUPTED' });
  }

  var raw = fs.readFileSync(filePath, 'utf-8');
  if (raw.trim().length === 0) {
    throw Object.assign(new Error('Bindings file contains only whitespace'), { code: 'BINDINGS_STORE_CORRUPTED' });
  }

  var parsed;
  try { parsed = JSON.parse(raw); } catch (_) {
    throw Object.assign(new Error('Bindings file contains invalid JSON'), { code: 'BINDINGS_STORE_CORRUPTED' });
  }

  if (isArray(parsed) || parsed === null || typeof parsed !== 'object') {
    throw Object.assign(new Error('Bindings file must be a non-array object'), { code: 'BINDINGS_STORE_CORRUPTED' });
  }

  // 验证每个 teacherId 的 value 结构
  var keys = Object.keys(parsed);
  for (var k = 0; k < keys.length; k++) {
    var tid = keys[k];
    if (!hop.call(parsed, tid)) continue;
    var list = parsed[tid];
    if (!isArray(list)) {
      throw Object.assign(new Error('Bindings entry for ' + tid + ' is not an array'), { code: 'BINDINGS_STORE_CORRUPTED' });
    }
    for (var j = 0; j < list.length; j++) {
      if (!isString(list[j])) {
        throw Object.assign(new Error('Bindings entry contains non-string studentId'), { code: 'BINDINGS_STORE_CORRUPTED' });
      }
    }
  }

  return parsed;
}

// ============================================================
//  文件写入
// ============================================================

var _counter = 0;

function atomicWrite(filePath, data) {
  if (isArray(data) || data === null || typeof data !== 'object') {
    throw new Error('Refusing to write non-object to bindings file');
  }

  var dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _counter++;
  var tmpPath = filePath + '.' + process.pid + '.' + _counter + '.tmp';
  var json = JSON.stringify(data, null, 2);

  try {
    fs.writeFileSync(tmpPath, json, 'utf-8');
    var verifyRaw = fs.readFileSync(tmpPath, 'utf-8');
    var verifyParsed = JSON.parse(verifyRaw);
    if (isArray(verifyParsed) || verifyParsed === null || typeof verifyParsed !== 'object') {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      throw new Error('Temp file is not an object after write');
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
//  安全副本
// ============================================================

function safeCopyBindings(obj) {
  var result = Object.create(null);
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (isDangerousKey(key)) continue;
    if (!hop.call(obj, key)) continue;
    var list = obj[key];
    if (!isArray(list)) continue;
    var copyList = [];
    for (var j = 0; j < list.length; j++) {
      if (isString(list[j])) copyList.push(list[j]);
    }
    if (copyList.length > 0) result[key] = copyList;
  }
  return result;
}

// ============================================================
//  Factory
// ============================================================

function createTeacherBindingsStore(options) {
  if (!isNonArrayObject(options)) throw new Error('options must be a non-array object');

  var filePath = options.filePath;
  if (!isString(filePath) || filePath.trim().length === 0) {
    throw new Error('options.filePath must be a non-empty string');
  }

  var writeQueue = Promise.resolve();

  function enqueue(worker) {
    var operation = writeQueue.then(worker, worker);
    writeQueue = operation.catch(function () {});
    return operation;
  }

  // ---- 只读 ----

  function readAll() {
    var raw = readFromFile(filePath);
    return safeCopyBindings(raw);
  }

  function hasBinding(teacherId, studentId) {
    var all = readAll();
    if (!hop.call(all, teacherId)) return false;
    var list = all[teacherId];
    if (!isArray(list)) return false;
    return list.indexOf(studentId) >= 0;
  }

  function listStudentsForTeacher(teacherId) {
    var all = readAll();
    if (!hop.call(all, teacherId)) return [];
    var list = all[teacherId];
    if (!isArray(list)) return [];
    return list.slice();
  }

  function listTeachersForStudent(studentId) {
    var all = readAll();
    var result = [];
    var keys = Object.keys(all);
    for (var i = 0; i < keys.length; i++) {
      var tid = keys[i];
      if (isDangerousKey(tid)) continue;
      if (!hop.call(all, tid)) continue;
      var list = all[tid];
      if (!isArray(list)) continue;
      if (list.indexOf(studentId) >= 0) result.push(tid);
    }
    return result;
  }

  // ---- 写入 ----

  function addBinding(teacherId, studentId) {
    if (!isString(teacherId) || teacherId.trim().length === 0 || isDangerousKey(teacherId)) {
      return Promise.reject(new Error('Invalid teacherId'));
    }
    if (!isString(studentId) || studentId.trim().length === 0) {
      return Promise.reject(new Error('Invalid studentId'));
    }

    return enqueue(function () {
      var raw = readFromFile(filePath);
      var current = safeCopyBindings(raw);

      if (!hop.call(current, teacherId)) {
        current[teacherId] = [studentId];
      } else {
        var list = current[teacherId];
        if (list.indexOf(studentId) < 0) {
          list.push(studentId);
        }
      }

      atomicWrite(filePath, current);
      return safeCopyBindings(current);
    });
  }

  function removeBinding(teacherId, studentId) {
    if (!isString(teacherId) || isDangerousKey(teacherId)) {
      return Promise.reject(new Error('Invalid teacherId'));
    }
    if (!isString(studentId)) {
      return Promise.reject(new Error('Invalid studentId'));
    }

    return enqueue(function () {
      var raw = readFromFile(filePath);
      var current = safeCopyBindings(raw);

      if (!hop.call(current, teacherId)) {
        return safeCopyBindings(current); // 幂等
      }

      var list = current[teacherId];
      var idx = list.indexOf(studentId);
      if (idx < 0) {
        return safeCopyBindings(current); // 幂等
      }

      list.splice(idx, 1);
      if (list.length === 0) {
        delete current[teacherId];
      }

      atomicWrite(filePath, current);
      return safeCopyBindings(current);
    });
  }

  function removeGuestBindings() {
    return enqueue(function () {
      var raw = readFromFile(filePath);
      var current = safeCopyBindings(raw);
      var removed = 0;

      var keys = Object.keys(current);
      for (var i = 0; i < keys.length; i++) {
        var tid = keys[i];
        if (!hop.call(current, tid)) continue;
        var list = current[tid];
        if (!isArray(list)) continue;
        var filtered = [];
        for (var j = 0; j < list.length; j++) {
          if (list[j] === 'guest') { removed++; } else { filtered.push(list[j]); }
        }
        if (filtered.length === 0) {
          delete current[tid];
        } else if (filtered.length < list.length) {
          current[tid] = filtered;
        }
      }

      if (removed > 0) {
        atomicWrite(filePath, current);
      }
      return removed;
    });
  }

  // ---- 内部方法 ----

  function _internalReadRaw() {
    return readFromFile(filePath);
  }

  function _internalWrite(data) {
    atomicWrite(filePath, data);
  }

  return {
    readAll: readAll,
    hasBinding: hasBinding,
    addBinding: addBinding,
    removeBinding: removeBinding,
    listStudentsForTeacher: listStudentsForTeacher,
    listTeachersForStudent: listTeachersForStudent,
    removeGuestBindings: removeGuestBindings,
    _internalReadRaw: _internalReadRaw,
    _internalWrite: _internalWrite,
  };
}

module.exports = { createTeacherBindingsStore: createTeacherBindingsStore };
