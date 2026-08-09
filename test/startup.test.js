/**
 * test/startup.test.js — 启动与基础加载测试
 *
 * 测试：
 *   1. app.js 可以在测试环境中被加载
 *   2. 加载时不会自动监听正式端口
 *   3. prompts/xiaoxin.md 可以正常读取
 *   4. prompts/analyze-v2.md 可以正常读取
 *   5. 缺少 Prompt 文件时能产生明确错误
 */

'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ============================================================
//  设置：隔离测试环境，阻止自动监听端口和数据迁移
// ============================================================
const originalSkipMigration = process.env.SKIP_MIGRATION;
const originalDataDir = process.env.DATA_DIR;

const tempDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'ai-talent-scout-startup-')
);

process.env.SKIP_MIGRATION = 'true';
process.env.DATA_DIR = tempDataDir;

// ============================================================
//  清理（测试结束后恢复环境变量、删除临时目录）
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

describe('启动与基础加载', function () {

  let serverModule;

  it('app.js 可以在测试环境中被加载（不自动监听端口）', function () {
    serverModule = require('../app');
    assert.ok(serverModule, 'app.js 应返回模块导出');
    assert.strictEqual(typeof serverModule.app, 'function', '应导出 Express app');
  });

  it('加载 app.js 后不应自动监听端口（子进程验证）', function () {
    // 在独立子进程中 require app.js，验证子进程能自然退出（不阻塞在端口监听上）。
    // 如果 app.js 意外调用了 app.listen，子进程会阻塞直到超时被 kill（退出码 null）。
    var childTempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ai-talent-scout-startup-child-')
    );
    var serverPath = path.join(__dirname, '..', 'app.js');

    var childScript =
      'var fs=require("fs");' +
      'process.env.SKIP_MIGRATION="true";' +
      'process.env.DATA_DIR=' + JSON.stringify(childTempDir) + ';' +
      'var m=require(' + JSON.stringify(serverPath) + ');' +
      'if(typeof m.app!=="function")process.exit(1);' +
      'if(m.DATA_DIR!==' + JSON.stringify(childTempDir) + ')process.exit(2);' +
      'process.exit(0);';

    var result = child_process.spawnSync(process.execPath, ['-e', childScript], {
      cwd: path.join(__dirname, '..'),
      timeout: 8000,
    });

    try { fs.rmSync(childTempDir, { recursive: true, force: true }); } catch (_) {}

    // stderr 中可能包含 console.log 输出（如 [migrate]...），取前 200 字供调试
    var errMsg = result.stderr ? result.stderr.toString().slice(0, 200) : '';

    assert.notStrictEqual(result.status, null,
      '子进程应正常退出（非超时 kill），实际 status=' + result.status
      + ' signal=' + result.signal + ' stderr=' + errMsg);
    assert.strictEqual(result.status, 0,
      'require app.js 应退出码 0，不应启动端口监听导致进程阻塞'
      + ' stderr=' + errMsg);
  });

  it('prompts/xiaoxin.md 可以正常读取', function () {
    var promptPath = path.join(__dirname, '..', 'prompts', 'xiaoxin.md');
    assert.ok(fs.existsSync(promptPath), 'prompts/xiaoxin.md 文件应存在');

    var content = fs.readFileSync(promptPath, 'utf-8');
    assert.ok(content.length > 100, 'xiaoxin.md 内容应超过 100 个字符');
    assert.ok(content.includes('小新'), 'xiaoxin.md 应包含角色名称"小新"');
    assert.ok(content.includes('开场破冰'), 'xiaoxin.md 应包含五阶段内容');
  });

  it('prompts/analyze-v2.md 可以正常读取', function () {
    var promptPath = path.join(__dirname, '..', 'prompts', 'analyze-v2.md');
    assert.ok(fs.existsSync(promptPath), 'prompts/analyze-v2.md 文件应存在');

    var content = fs.readFileSync(promptPath, 'utf-8');
    assert.ok(content.length > 500, 'analyze-v2.md 内容应超过 500 个字符');
    assert.ok(content.includes('七项指标'), 'analyze-v2.md 应包含七项指标');
  });

  it('缺少 Prompt 文件时 fs.readFileSync 应抛出异常', function () {
    var missingPath = path.join(__dirname, '..', 'prompts', 'nonexistent-prompt.md');
    assert.throws(
      function () { fs.readFileSync(missingPath, 'utf-8'); },
      /ENOENT/,
      '读取不存在的 Prompt 文件应抛出 ENOENT'
    );
  });

});
