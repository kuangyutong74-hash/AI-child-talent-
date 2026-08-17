/**
 * scripts/init-data.js — 安全初始化运行时数据目录
 *
 * 将 data.example/ 中的安全空结构复制到目标 DATA_DIR。
 * 不覆盖已存在的文件（无账号体系：仅聊天相关数据文件）。
 *
 * 用法：
 *   node scripts/init-data.js
 *   DATA_DIR=/path/to/data node scripts/init-data.js
 *
 * 导出 require() 可在测试中使用。
 */

'use strict';

var fs = require('fs');
var path = require('path');
var { resolveDataDir } = require('../lib/infra/data-dir');

// ============================================================
//  配置
// ============================================================

var PROJECT_ROOT = path.resolve(__dirname, '..');
var EXAMPLE_DIR = path.join(PROJECT_ROOT, 'data.example');

function getDataDir() {
  return resolveDataDir({
    envValue: process.env.DATA_DIR,
    projectRoot: PROJECT_ROOT,
  });
}

// ============================================================
//  Example files to copy
//   { exampleName, targetName, validate }
// ============================================================

var COPY_FILES = [
  { exampleName: 'history.json',      targetName: 'history.json',      validate: validateArray },
  { exampleName: 'journal.json',      targetName: 'journal.json',      validate: validateArray },
  { exampleName: 'tip-favorites.json', targetName: 'tip-favorites.json', validate: validateObject },
  { exampleName: 'chat-log.jsonl',    targetName: 'chat-log.jsonl',    validate: validateJsonl },
  { exampleName: 'tips.json',         targetName: 'tips.json',         validate: validateArray },
];

// ============================================================
//  验证函数
// ============================================================

function validateArray(content, examplePath) {
  var parsed;
  try { parsed = JSON.parse(content); } catch (_) { return 'Invalid JSON'; }
  if (!Array.isArray(parsed)) return 'Top-level must be an array, got ' + typeof parsed;
  return null;
}

function validateObject(content, examplePath) {
  var parsed;
  try { parsed = JSON.parse(content); } catch (_) { return 'Invalid JSON'; }
  if (Array.isArray(parsed)) return 'Top-level must be a non-array object, got array';
  if (parsed === null || typeof parsed !== 'object') return 'Top-level must be a non-array object, got ' + typeof parsed;
  return null;
}

function validateJsonl(content, examplePath) {
  if (content.trim().length === 0) return null; // empty file is OK
  var lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.length === 0) continue;
    try { JSON.parse(line); } catch (_) { return 'Line ' + (i + 1) + ' is not valid JSON'; }
  }
  return null;
}

// ============================================================
//  读取 example 文件并验证
// ============================================================

function readAndValidate(exampleDir) {
  if (!exampleDir) exampleDir = EXAMPLE_DIR;
  var results = [];
  var allValid = true;

  for (var i = 0; i < COPY_FILES.length; i++) {
    var entry = COPY_FILES[i];
    var examplePath = path.join(exampleDir, entry.exampleName);

    // 检查文件存在
    if (!fs.existsSync(examplePath)) {
      results.push({
        exampleName: entry.exampleName,
        targetName: entry.targetName,
        status: 'error',
        error: 'Example file not found: ' + examplePath,
      });
      allValid = false;
      continue;
    }

    // 读取内容
    var content;
    try {
      content = fs.readFileSync(examplePath, 'utf-8');
    } catch (e) {
      results.push({
        exampleName: entry.exampleName,
        targetName: entry.targetName,
        status: 'error',
        error: 'Failed to read example file: ' + e.message,
      });
      allValid = false;
      continue;
    }

    // 验证
    var err = entry.validate(content, examplePath);
    if (err) {
      results.push({
        exampleName: entry.exampleName,
        targetName: entry.targetName,
        status: 'error',
        error: 'Validation failed for ' + examplePath + ': ' + err,
      });
      allValid = false;
      continue;
    }

    results.push({
      exampleName: entry.exampleName,
      targetName: entry.targetName,
      content: content,
      status: 'valid',
    });
  }

  return { valid: allValid, files: results };
}

// ============================================================
//  原子写入（tmp + rename）
// ============================================================

function atomicWrite(filePath, content, encoding) {
  if (encoding === undefined) encoding = 'utf-8';
  var dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 使用 pid + 时间戳保证唯一性
  var tmpPath = filePath + '.tmp.' + process.pid + '.' + Date.now();
  var cleanedUp = false;

  try {
    fs.writeFileSync(tmpPath, content, encoding);
    fs.renameSync(tmpPath, filePath);
    cleanedUp = true;
  } finally {
    // 确保清理残留临时文件
    if (!cleanedUp) {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }
}

// ============================================================
//  主函数
// ============================================================

function initData(options) {
  if (!options) options = {};

  var dataDir = options.dataDir || getDataDir();
  var exampleDir = options.exampleDir || EXAMPLE_DIR;
  var results = { created: [], skipped: [], errors: [], dataDir: dataDir };

  // ---- 第一步：验证所有 example 文件 ----
  var validation = readAndValidate(exampleDir);
  if (!validation.valid) {
    for (var ve = 0; ve < validation.files.length; ve++) {
      if (validation.files[ve].status === 'error') {
        results.errors.push(validation.files[ve].error);
      }
    }
    return results;
  }

  // ---- 第二步：复制文件 ----
  for (var i = 0; i < validation.files.length; i++) {
    var entry = validation.files[i];
    if (entry.status !== 'valid') continue;

    var targetPath = path.join(dataDir, entry.targetName);

    if (fs.existsSync(targetPath)) {
      results.skipped.push(entry.targetName);
      continue;
    }

    try {
      atomicWrite(targetPath, entry.content);
      results.created.push(entry.targetName);
    } catch (e) {
      results.errors.push('Failed to create ' + entry.targetName + ': ' + e.message);
    }
  }

  return results;
}

// ============================================================
//  程序入口
// ============================================================

function main() {
  var results = initData();

  // 输出统计
  console.log('DATA_DIR: ' + results.dataDir);

  if (results.errors.length > 0) {
    for (var e = 0; e < results.errors.length; e++) {
      console.error('ERROR: ' + results.errors[e]);
    }
    return 1;
  }

  for (var c = 0; c < results.created.length; c++) {
    console.log('  created: ' + results.created[c]);
  }
  for (var s = 0; s < results.skipped.length; s++) {
    console.log('  skipped: ' + results.skipped[s] + ' (already exists)');
  }

  console.log('Total created: ' + results.created.length + ', skipped: ' + results.skipped.length);
  console.log('Init complete.');

  if (results.created.length + results.skipped.length === 0) {
    return 1;
  }

  return 0;
}

if (require.main === module) {
  var exitCode = main();
  process.exit(exitCode);
}

module.exports = { initData: initData, resolveDataDir: getDataDir };
