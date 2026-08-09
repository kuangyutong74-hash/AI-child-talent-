/**
 * teacher-report-narrative-store.js — 教师端阶段性报告 AI 叙述持久化 Store
 *
 * 提供原子读写、串行队列、损坏数据保护的叙述记录存储。
 * 每条记录以 (studentId, range) 为唯一键。
 * range 只支持 'all'（7d/30d 继续使用模板，不通过 AI 生成）。
 *
 * v2 变更：
 *   - moduleEdits 数组替代 teacherEditedText/teacherEditedAt，支持分模块编辑历史
 *   - addModuleEdit / clearModuleEdits / getModuleEditHistory 替代旧编辑方法
 *   - moduleEdits 每条记录包含 module、content、action('edit'|'confirm'|'reject')、editedBy、editedAt
 *
 * 测试通过临时目录隔离，不依赖 Express、不访问网络。
 *
 * 导出：createTeacherReportNarrativeStore(options)
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
//  记录与子对象验证
// ============================================================

var ALLOWED_RANGES = ['all', '7d', '30d'];
var ALLOWED_MODULE_EDIT_ACTIONS = ['edit', 'confirm', 'reject'];

function isValidISOString(val) {
  return isString(val) && val.trim().length > 0 && !isNaN(Date.parse(val));
}

function validateAiVersion(av) {
  if (!isNonArrayObject(av)) return false;
  if (!isString(av.text) || av.text.trim().length === 0) return false;
  if (!isValidISOString(av.generatedAt)) return false;
  // inputDigest 是可选的辅助字段，不强制
  return true;
}

function validateModuleEdit(me) {
  if (!isNonArrayObject(me)) return false;
  // module — 必填，非空字符串
  if (!isString(me.module) || me.module.trim().length === 0) return false;
  // content — 必填，非空字符串
  if (!isString(me.content) || me.content.trim().length === 0) return false;
  // action — 必填，edit / confirm / reject
  if (!isString(me.action) || ALLOWED_MODULE_EDIT_ACTIONS.indexOf(me.action) < 0) return false;
  // editedBy — 必填，非空字符串
  if (!isString(me.editedBy) || me.editedBy.trim().length === 0) return false;
  // editedAt — 必填，合法 ISO
  if (!isValidISOString(me.editedAt)) return false;
  // inputDigest — 可选，不强制
  // aiVersionGeneratedAt — 可选：教师操作时看到的最新AI版本时间戳
  //   如果存在则必须是合法ISO；不存在时兼容旧记录（不做强制）
  if (hop.call(me, 'aiVersionGeneratedAt') && me.aiVersionGeneratedAt !== null &&
      me.aiVersionGeneratedAt !== undefined && !isValidISOString(me.aiVersionGeneratedAt)) {
    return false;
  }
  return true;
}

function validateRecord(record) {
  if (!isNonArrayObject(record)) return false;

  // studentId — 必填，非空字符串
  if (!isString(record.studentId) || record.studentId.trim().length === 0) return false;

  // range — 必填，目前只允许 'all'
  if (!isString(record.range) || ALLOWED_RANGES.indexOf(record.range) < 0) return false;

  // aiGeneratedVersions — 必填，数组
  if (!isArray(record.aiGeneratedVersions)) return false;

  // 每个 aiVersion 都必须是合法对象
  for (var i = 0; i < record.aiGeneratedVersions.length; i++) {
    if (!validateAiVersion(record.aiGeneratedVersions[i])) return false;
  }

  // moduleEdits — 必填，数组（v2 字段；v1 记录可能缺失此字段，在 safeCopy 中补全）
  if (!isArray(record.moduleEdits)) return false;

  // 每个 moduleEdit 都必须是合法对象
  for (var j = 0; j < record.moduleEdits.length; j++) {
    if (!validateModuleEdit(record.moduleEdits[j])) return false;
  }

  // v1 兼容：teacherEditedText 可选（旧字段）
  // v2 中不再写入此字段，但读取时容忍存在

  return true;
}

function safeCopy(record) {
  var aiGeneratedVersions = [];
  var rawVersions = record.aiGeneratedVersions;
  if (isArray(rawVersions)) {
    for (var i = 0; i < rawVersions.length; i++) {
      var av = rawVersions[i];
      if (!isNonArrayObject(av)) continue;
      var inputDigest = null;
      if (isNonArrayObject(av.inputDigest)) {
        inputDigest = {};
        var avDigKeys = Object.keys(av.inputDigest);
        for (var avdk = 0; avdk < avDigKeys.length; avdk++) {
          inputDigest[avDigKeys[avdk]] = av.inputDigest[avDigKeys[avdk]];
        }
        if (typeof inputDigest.conversationCount !== 'number') inputDigest.conversationCount = 0;
        if (typeof inputDigest.totalTurns !== 'number') inputDigest.totalTurns = 0;
        if (typeof inputDigest.insightCount !== 'number') inputDigest.insightCount = 0;
        if (!isArray(inputDigest.conversationIds)) inputDigest.conversationIds = [];
      }
      aiGeneratedVersions.push({
        text: safeGetOwnString(av, 'text', ''),
        generatedAt: safeGetOwnString(av, 'generatedAt', ''),
        inputDigest: inputDigest,
      });
    }
  }

  // moduleEdits — v2 字段
  var moduleEdits = [];
  var rawEdits = record.moduleEdits;
  if (isArray(rawEdits)) {
    for (var ei = 0; ei < rawEdits.length; ei++) {
      var me = rawEdits[ei];
      if (!isNonArrayObject(me)) continue;
      var editInputDigest = null;
      if (isNonArrayObject(me.inputDigest)) {
        // 保留原始 inputDigest 的全部字段，仅对标准字段兜底默认值
        editInputDigest = {};
        var digKeys = Object.keys(me.inputDigest);
        for (var dk = 0; dk < digKeys.length; dk++) {
          editInputDigest[digKeys[dk]] = me.inputDigest[digKeys[dk]];
        }
        if (typeof editInputDigest.conversationCount !== 'number') editInputDigest.conversationCount = 0;
        if (typeof editInputDigest.totalTurns !== 'number') editInputDigest.totalTurns = 0;
        if (typeof editInputDigest.insightCount !== 'number') editInputDigest.insightCount = 0;
        if (!isArray(editInputDigest.conversationIds)) editInputDigest.conversationIds = [];
      }
      moduleEdits.push({
        module: safeGetOwnString(me, 'module', ''),
        content: safeGetOwnString(me, 'content', ''),
        action: safeGetOwnString(me, 'action', 'edit'),
        editedBy: safeGetOwnString(me, 'editedBy', ''),
        editedAt: safeGetOwnString(me, 'editedAt', ''),
        inputDigest: editInputDigest,
        aiVersionGeneratedAt: hop.call(me, 'aiVersionGeneratedAt') && isString(me.aiVersionGeneratedAt)
          ? me.aiVersionGeneratedAt : null,
      });
    }
  }

  // v1 兼容：如果有旧的 teacherEditedText 但没有 moduleEdits，
  // 将其迁移为一条 coreFindings 的 edit 记录
  if (moduleEdits.length === 0 && record.teacherEditedText !== null && isString(record.teacherEditedText) && record.teacherEditedText.trim().length > 0) {
    moduleEdits.push({
      module: 'coreFindings',
      content: record.teacherEditedText,
      action: 'edit',
      editedBy: 'unknown',
      editedAt: record.teacherEditedAt && isString(record.teacherEditedAt) ? record.teacherEditedAt : new Date(0).toISOString(),
    });
  }

  return {
    studentId: safeGetOwnString(record, 'studentId', ''),
    range: safeGetOwnString(record, 'range', 'all'),
    aiGeneratedVersions: aiGeneratedVersions,
    moduleEdits: moduleEdits,
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
    throw Object.assign(new Error('Failed to stat narrative report file'), { code: 'NARRATIVE_STORE_CORRUPTED' });
  }

  if (stat.size === 0) {
    throw Object.assign(new Error('Narrative report file is empty (0 bytes). Manual intervention required.'), { code: 'NARRATIVE_STORE_CORRUPTED' });
  }

  var raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    throw Object.assign(new Error('Failed to read narrative report file'), { code: 'NARRATIVE_STORE_CORRUPTED' });
  }

  if (raw.trim().length === 0) {
    throw Object.assign(new Error('Narrative report file contains only whitespace. Manual intervention required.'), { code: 'NARRATIVE_STORE_CORRUPTED' });
  }

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw Object.assign(new Error('Narrative report file contains invalid JSON. Manual intervention required.'), { code: 'NARRATIVE_STORE_CORRUPTED' });
  }

  if (!isArray(parsed)) {
    throw Object.assign(new Error('Narrative report file top-level is not an array. Manual intervention required.'), { code: 'NARRATIVE_STORE_CORRUPTED' });
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
    throw new Error('Refusing to write non-array to narrative report file');
  }

  var dir = path.dirname(filePath);
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

/**
 * @param {object} options
 * @param {string} options.filePath — 叙述记录文件完整路径
 * @returns {{ readAll, findByStudentIdAndRange, addAiVersion, addModuleEdit, clearModuleEdits, getModuleEditHistory }}
 */
function createTeacherReportNarrativeStore(options) {
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
      writeQueue = writeQueue.catch(function () {});
    });
  }

  // ============================================================
  //  readAll
  // ============================================================

  function readAll() {
    var raw = readAllFromFile(filePath);
    var result = [];
    for (var i = 0; i < raw.length; i++) {
      result.push(safeCopy(raw[i]));
    }
    return result;
  }

  // ============================================================
  //  findByStudentIdAndRange
  // ============================================================

  function findByStudentIdAndRange(studentId, range) {
    if (!isString(studentId) || studentId.trim().length === 0) return null;
    if (!isString(range) || ALLOWED_RANGES.indexOf(range) < 0) return null;

    var all = readAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].studentId === studentId && all[i].range === range) {
        return all[i];
      }
    }
    return null;
  }

  // ============================================================
  //  addAiVersion — 追加一条 AI 生成版本
  // ============================================================

  /**
   * 追加新的 AI 生成版本到 aiGeneratedVersions 数组末尾。
   * 如果 (studentId, range) 记录不存在，自动创建。
   * 不会影响 moduleEdits。
   *
   * @param {object} input
   * @param {string} input.studentId
   * @param {string} input.range — 目前仅 'all'
   * @param {string} input.text — AI 生成的叙述文本（结构化 JSON 字符串）
   * @param {string} input.generatedAt — ISO 时间戳
   * @param {object|null} input.inputDigest — 生成时基于的数据快照
   * @returns {Promise<object>} 更新后的完整记录
   */
  function addAiVersion(input) {
    if (!isNonArrayObject(input)) {
      return Promise.reject(Object.assign(new Error('Invalid input'), { code: 'INVALID_INPUT' }));
    }
    var studentId = input.studentId;
    var range = input.range;
    var text = input.text;
    var generatedAt = input.generatedAt;
    var inputDigest = input.inputDigest;

    if (!isString(studentId) || studentId.trim().length === 0) {
      return Promise.reject(Object.assign(new Error('Invalid studentId'), { code: 'INVALID_INPUT' }));
    }
    if (!isString(range) || ALLOWED_RANGES.indexOf(range) < 0) {
      return Promise.reject(Object.assign(new Error('Invalid range'), { code: 'INVALID_INPUT' }));
    }
    if (!isString(text) || text.trim().length === 0) {
      return Promise.reject(Object.assign(new Error('Invalid text'), { code: 'INVALID_INPUT' }));
    }
    if (!isValidISOString(generatedAt)) {
      return Promise.reject(Object.assign(new Error('Invalid generatedAt'), { code: 'INVALID_INPUT' }));
    }

    var newVersion = {
      text: text,
      generatedAt: generatedAt,
      inputDigest: isNonArrayObject(inputDigest) ? inputDigest : null,
    };

    return enqueue(function () {
      try {
        var current;
        try {
          current = readAllFromFile(filePath);
        } catch (e) {
          if (hop.call(e, 'code') && e.code === 'NARRATIVE_STORE_CORRUPTED') throw e;
          current = [];
        }

        var foundIdx = -1;
        for (var i = 0; i < current.length; i++) {
          var r = current[i];
          if (
            isNonArrayObject(r) &&
            hop.call(r, 'studentId') && r.studentId === studentId &&
            hop.call(r, 'range') && r.range === range
          ) {
            foundIdx = i;
            break;
          }
        }

        var record;
        if (foundIdx >= 0) {
          record = current[foundIdx];
          // 确保 aiGeneratedVersions 是数组
          if (!isArray(record.aiGeneratedVersions)) {
            record.aiGeneratedVersions = [];
          }
          // 追加新版本
          record.aiGeneratedVersions.push(newVersion);
          // 确保 moduleEdits 存在（v1 → v2 迁移）
          if (!isArray(record.moduleEdits)) {
            record.moduleEdits = [];
          }
        } else {
          // 新建记录（v2 格式）
          record = {
            studentId: studentId,
            range: range,
            aiGeneratedVersions: [newVersion],
            moduleEdits: [],
          };
          current.push(record);
        }

        atomicWrite(filePath, current);
        return safeCopy(record);
      } catch (e) {
        throw e;
      }
    });
  }

  // ============================================================
  //  addModuleEdit — 追加一条模块编辑记录
  // ============================================================

  /**
   * 追加一条模块编辑记录到 moduleEdits 数组末尾。
   * 只追加，不覆盖。同一模块的多次编辑形成历史链。
   * 如果 (studentId, range) 记录不存在，自动创建。
   *
   * @param {object} input
   * @param {string} input.studentId
   * @param {string} input.range
   * @param {string} input.module — 模块标识（任意字符串，如 coreFindings / dimensionProfile / overallJudgment）
   * @param {string} input.content — 编辑后的内容
   * @param {string} input.action — 'edit' / 'confirm' / 'reject'
   * @param {string} input.editedBy — 编辑者（teacher user id）
   * @param {string} input.editedAt — ISO 时间戳
   * @param {string} [input.aiVersionGeneratedAt] — 教师操作时看到的最新 AI 版本的 generatedAt 时间戳
   * @returns {Promise<object>} 更新后的完整记录
   */
  function addModuleEdit(input) {
    if (!isNonArrayObject(input)) {
      return Promise.reject(Object.assign(new Error('Invalid input'), { code: 'INVALID_INPUT' }));
    }
    var studentId = input.studentId;
    var range = input.range;
    var moduleName = input.module;
    var content = input.content;
    var action = input.action;
    var editedBy = input.editedBy;
    var editedAt = input.editedAt;
    var aiVersionGeneratedAt = input.aiVersionGeneratedAt;

    if (!isString(studentId) || studentId.trim().length === 0) {
      return Promise.reject(Object.assign(new Error('Invalid studentId'), { code: 'INVALID_INPUT' }));
    }
    if (!isString(range) || ALLOWED_RANGES.indexOf(range) < 0) {
      return Promise.reject(Object.assign(new Error('Invalid range'), { code: 'INVALID_INPUT' }));
    }
    if (!isString(moduleName) || moduleName.trim().length === 0) {
      return Promise.reject(Object.assign(new Error('Invalid module'), { code: 'INVALID_INPUT' }));
    }
    if (!isString(content) || content.trim().length === 0) {
      return Promise.reject(Object.assign(new Error('Invalid content'), { code: 'INVALID_INPUT' }));
    }
    if (!isString(action) || ALLOWED_MODULE_EDIT_ACTIONS.indexOf(action) < 0) {
      return Promise.reject(Object.assign(new Error('Invalid action'), { code: 'INVALID_INPUT' }));
    }
    if (!isString(editedBy) || editedBy.trim().length === 0) {
      return Promise.reject(Object.assign(new Error('Invalid editedBy'), { code: 'INVALID_INPUT' }));
    }
    if (!isValidISOString(editedAt)) {
      return Promise.reject(Object.assign(new Error('Invalid editedAt'), { code: 'INVALID_INPUT' }));
    }

    // 内容长度限制
    if (content.length > 4000) {
      return Promise.reject(Object.assign(new Error('Content too long'), { code: 'CONTENT_TOO_LONG' }));
    }

    var newEdit = {
      module: moduleName.trim(),
      content: content.trim(),
      action: action,
      editedBy: editedBy,
      editedAt: editedAt,
      inputDigest: isNonArrayObject(input.inputDigest) ? input.inputDigest : null,
      aiVersionGeneratedAt: isString(aiVersionGeneratedAt) && aiVersionGeneratedAt.trim().length > 0
        ? aiVersionGeneratedAt : null,
    };

    return enqueue(function () {
      try {
        var current;
        try {
          current = readAllFromFile(filePath);
        } catch (e) {
          if (hop.call(e, 'code') && e.code === 'NARRATIVE_STORE_CORRUPTED') throw e;
          current = [];
        }

        var foundIdx = -1;
        for (var i = 0; i < current.length; i++) {
          var r = current[i];
          if (
            isNonArrayObject(r) &&
            hop.call(r, 'studentId') && r.studentId === studentId &&
            hop.call(r, 'range') && r.range === range
          ) {
            foundIdx = i;
            break;
          }
        }

        var record;
        if (foundIdx >= 0) {
          record = current[foundIdx];
          // 确保 moduleEdits 是数组（v1 → v2 迁移）
          if (!isArray(record.moduleEdits)) {
            record.moduleEdits = [];
          }
          // 追加新编辑记录
          record.moduleEdits.push(newEdit);
        } else {
          // 新建记录
          record = {
            studentId: studentId,
            range: range,
            aiGeneratedVersions: [],
            moduleEdits: [newEdit],
          };
          current.push(record);
        }

        atomicWrite(filePath, current);
        return safeCopy(record);
      } catch (e) {
        throw e;
      }
    });
  }

  // ============================================================
  //  clearModuleEdits — 清空模块编辑，回退到 AI 版本
  // ============================================================

  /**
   * 清空指定模块的编辑记录。不传 module 则清空所有模块。
   * 清空后前端将回退到最新 AI 版本对应模块的内容。
   *
   * @param {object} input
   * @param {string} input.studentId
   * @param {string} input.range
   * @param {string} [input.module] — 可选：不传则清空所有模块
   * @param {string} input.clearedAt — 操作时间戳
   * @returns {Promise<object>} 更新后的完整记录
   */
  function clearModuleEdits(input) {
    if (!isNonArrayObject(input)) {
      return Promise.reject(Object.assign(new Error('Invalid input'), { code: 'INVALID_INPUT' }));
    }
    var studentId = input.studentId;
    var range = input.range;
    var moduleName = input.module;

    if (!isString(studentId) || studentId.trim().length === 0) {
      return Promise.reject(Object.assign(new Error('Invalid studentId'), { code: 'INVALID_INPUT' }));
    }
    if (!isString(range) || ALLOWED_RANGES.indexOf(range) < 0) {
      return Promise.reject(Object.assign(new Error('Invalid range'), { code: 'INVALID_INPUT' }));
    }
    // module 可选 — 不传表示清空所有

    return enqueue(function () {
      try {
        var current;
        try {
          current = readAllFromFile(filePath);
        } catch (e) {
          if (hop.call(e, 'code') && e.code === 'NARRATIVE_STORE_CORRUPTED') throw e;
          current = [];
        }

        var foundIdx = -1;
        for (var i = 0; i < current.length; i++) {
          var r = current[i];
          if (
            isNonArrayObject(r) &&
            hop.call(r, 'studentId') && r.studentId === studentId &&
            hop.call(r, 'range') && r.range === range
          ) {
            foundIdx = i;
            break;
          }
        }

        if (foundIdx < 0) {
          // 没有记录 — 返回空记录
          var emptyRecord = {
            studentId: studentId,
            range: range,
            aiGeneratedVersions: [],
            moduleEdits: [],
          };
          return safeCopy(emptyRecord);
        }

        if (moduleName === undefined || moduleName === null) {
          // 清空所有模块编辑
          current[foundIdx].moduleEdits = [];
        } else {
          // 只清空指定模块
          var existingEdits = current[foundIdx].moduleEdits;
          if (isArray(existingEdits)) {
            current[foundIdx].moduleEdits = existingEdits.filter(function (me) {
              return me.module !== moduleName;
            });
          } else {
            current[foundIdx].moduleEdits = [];
          }
        }

        atomicWrite(filePath, current);
        return safeCopy(current[foundIdx]);
      } catch (e) {
        throw e;
      }
    });
  }

  // ============================================================
  //  getModuleEditHistory — 获取编辑历史
  // ============================================================

  /**
   * 返回全部或指定模块的编辑记录，按时间倒序排列。
   * 纯读操作，不同步（同步返回，不走串行队列）。
   *
   * @param {object} input
   * @param {string} input.studentId
   * @param {string} input.range
   * @param {string} [input.module] — 可选：不传则返回全部模块
   * @returns {Array} 按 editedAt 倒序的编辑记录
   */
  function getModuleEditHistory(input) {
    if (!isNonArrayObject(input)) return [];
    var studentId = input.studentId;
    var range = input.range;
    var moduleName = input.module;

    if (!isString(studentId) || studentId.trim().length === 0) return [];
    if (!isString(range) || ALLOWED_RANGES.indexOf(range) < 0) return [];

    var record = findByStudentIdAndRange(studentId, range);
    if (!record) return [];

    var edits = record.moduleEdits;
    if (!isArray(edits)) return [];

    // 按 module 过滤
    var result;
    if (moduleName !== undefined && moduleName !== null) {
      result = edits.filter(function (me) {
        return me.module === moduleName;
      });
    } else {
      result = edits.slice();
    }

    // 按 editedAt 倒序排列
    result.sort(function (a, b) {
      var da = Date.parse(a.editedAt);
      var db = Date.parse(b.editedAt);
      if (isNaN(da) && isNaN(db)) return 0;
      if (isNaN(da)) return 1;
      if (isNaN(db)) return -1;
      return db - da;
    });

    return result;
  }

  // ============================================================
  //  导出
  // ============================================================

  return {
    readAll: readAll,
    findByStudentIdAndRange: findByStudentIdAndRange,
    addAiVersion: addAiVersion,
    addModuleEdit: addModuleEdit,
    clearModuleEdits: clearModuleEdits,
    getModuleEditHistory: getModuleEditHistory,
  };
}

module.exports = {
  createTeacherReportNarrativeStore: createTeacherReportNarrativeStore,
};
