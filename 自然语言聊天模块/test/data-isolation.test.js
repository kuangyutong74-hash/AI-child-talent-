/**
 * test/data-isolation.test.js — 数据隔离验证测试
 *
 * 确认测试环境不会污染正式 data 目录：
 *   1. 正式数据文件不受测试影响
 *   2. 测试使用独立临时目录
 *   3. 测试结束后清理临时数据
 *   4. DATA_DIR 和 SKIP_MIGRATION 在测试后恢复原值
 *   5. 验证所有真实 data 文件在测试前后一致
 *
 * 禁止写入、删除或修改真实 data 目录中的任何文件。
 */

'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ============================================================
//  保存原环境变量
// ============================================================
const originalSkipMigration = process.env.SKIP_MIGRATION;
const originalDataDir = process.env.DATA_DIR;

// ============================================================
//  创建唯一临时 data 目录
// ============================================================
const tempDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'ai-talent-scout-data-iso-')
);

process.env.SKIP_MIGRATION = 'true';
process.env.DATA_DIR = tempDataDir;

// ============================================================
//  记录正式 data 目录中所有文件的初始状态
// ============================================================
const realDataDir = path.join(__dirname, '..', 'data');

const DATA_FILES = [
  'history.json',
  'chat-log.jsonl',
  'journal.json',
  'tip-favorites.json',
];

/**
 * 获取文件的快照信息（如果文件不存在则为 null）
 */
function fileSnapshot(filePath) {
  try {
    var stat = fs.statSync(filePath);
    return { exists: true, size: stat.size, mtimeMs: stat.mtimeMs };
  } catch (e) {
    if (e.code === 'ENOENT') return { exists: false, size: null, mtimeMs: null };
    throw e;
  }
}

const beforeSnapshots = {};
DATA_FILES.forEach(function (f) {
  beforeSnapshots[f] = fileSnapshot(path.join(realDataDir, f));
});

// ============================================================
//  加载 server 模块（使用临时 DATA_DIR，不能吞掉错误）
// ============================================================
const serverModule = require('../app');

// ============================================================
//  清理
// ============================================================
after(function () {
  try { fs.rmSync(tempDataDir, { recursive: true, force: true }); } catch (_) {}

  if (originalSkipMigration === undefined) {
    delete process.env.SKIP_MIGRATION;
  } else {
    process.env.SKIP_MIGRATION = originalSkipMigration;
  }

  if (originalDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = originalDataDir;
  }
});

// ============================================================
//  测试
// ============================================================

describe('数据隔离', function () {

  // ----------------------------------------------------------
  //  环境变量隔离
  // ----------------------------------------------------------

  it('测试环境的 DATA_DIR 应指向临时目录而非正式 data 目录', function () {
    var realDataPath = path.resolve(realDataDir);
    var testDataPath = path.resolve(tempDataDir);
    assert.notStrictEqual(testDataPath, realDataPath,
      '测试环境的 DATA_DIR 不应等于正式 data 目录');
    assert.ok(testDataPath.startsWith(os.tmpdir()),
      '测试环境的 DATA_DIR 应在系统临时目录下');
  });

  it('SKIP_MIGRATION 应设为 true', function () {
    assert.strictEqual(process.env.SKIP_MIGRATION, 'true',
      'SKIP_MIGRATION 应设为 true');
  });

  it('server 模块导出的 DATA_DIR 应与测试环境一致', function () {
    assert.ok(typeof serverModule.DATA_DIR === 'string',
      'server 模块应导出 DATA_DIR');
    assert.strictEqual(
      path.resolve(serverModule.DATA_DIR),
      path.resolve(tempDataDir),
      'server 模块的 DATA_DIR 应与测试临时目录一致'
    );
  });

  it('server 模块应导出 app', function () {
    assert.strictEqual(typeof serverModule.app, 'function', 'server 模块应导出 Express app 函数');  });

  // ----------------------------------------------------------
  //  正式数据文件完整性（测试前 vs 测试后）
  // ----------------------------------------------------------

  it('正式 data 目录的 history.json 未被修改', function () {
    var after = fileSnapshot(path.join(realDataDir, 'history.json'));
    var before = beforeSnapshots['history.json'];
    assert.deepStrictEqual(after, before,
      'history.json 的元数据应与测试前完全一致（未读写正式目录）');
  });

  it('正式 data 目录的 chat-log.jsonl 未被修改', function () {
    var after = fileSnapshot(path.join(realDataDir, 'chat-log.jsonl'));
    var before = beforeSnapshots['chat-log.jsonl'];
    assert.deepStrictEqual(after, before,
      'chat-log.jsonl 的元数据应与测试前完全一致');
  });

  it('正式 data 目录的 journal.json 未被修改', function () {
    var after = fileSnapshot(path.join(realDataDir, 'journal.json'));
    var before = beforeSnapshots['journal.json'];
    assert.deepStrictEqual(after, before,
      'journal.json 的元数据应与测试前完全一致');
  });

  it('正式 data 目录的 tip-favorites.json 未被修改', function () {
    var after = fileSnapshot(path.join(realDataDir, 'tip-favorites.json'));
    var before = beforeSnapshots['tip-favorites.json'];
    assert.deepStrictEqual(after, before,
      'tip-favorites.json 的元数据应与测试前完全一致');
  });

  it('所有正式数据文件仍存在（未被意外删除）', function () {
    DATA_FILES.forEach(function (f) {
      var filePath = path.join(realDataDir, f);
      // 有些文件可能原本就不存在（如 bindings.json），以测试前状态为准
      if (beforeSnapshots[f].exists) {
        assert.ok(fs.existsSync(filePath),
          f + ' 应仍然存在');
      }
    });
  });

});
