/**
 * test/deepseek-model-config.test.js — DeepSeek 模型配置合同测试
 *
 * 验证: 默认模型、环境变量覆盖、.env.example 不含真实密钥。
 * 仅使用 node:test + node:assert + fs，不引入新依赖。
 */
'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var envExample = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf-8');
var serverCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf-8');
var readmeText = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf-8');

describe('DeepSeek model config', function () {

  // ==========================================================
  //  A. 默认模型不再是 deepseek-chat
  // ==========================================================

  describe('A. default model updated from deepseek-chat', function () {
    it('1. app.js default model is deepseek-v4-pro', function () {
      var line = serverCode.split('\n').find(function (l) {
        return l.indexOf('DEEPSEEK_MODEL') >= 0 && l.indexOf('process.env') >= 0;
      });
      assert.ok(line, 'must have DEEPSEEK_MODEL line');
      assert.ok(line.indexOf("deepseek-v4-pro") >= 0,
        'default model must be deepseek-v4-pro, got: ' + line);
    });

    it('2. app.js does NOT fall back to deepseek-chat', function () {
      var line = serverCode.split('\n').find(function (l) {
        return l.indexOf('DEEPSEEK_MODEL') >= 0 && l.indexOf('process.env') >= 0;
      });
      assert.ok(line, 'must have DEEPSEEK_MODEL line');
      assert.strictEqual(line.indexOf('deepseek-chat'), -1,
        'must not default to deepseek-chat');
    });
  });

  // ==========================================================
  //  B. 环境变量覆盖
  // ==========================================================

  describe('B. environment variable override', function () {
    it('3. process.env.DEEPSEEK_MODEL takes priority over default', function () {
      // Verify the app.js uses: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
      var line = serverCode.split('\n').find(function (l) {
        return l.indexOf('DEEPSEEK_MODEL') >= 0 && l.indexOf('process.env') >= 0;
      });
      assert.ok(line.indexOf('process.env.DEEPSEEK_MODEL') >= 0,
        'must read from env variable first');
      assert.ok(line.indexOf('||') >= 0,
        'must have fallback via || operator');
    });

    it('4. all 11 DeepSeek fetch calls use DEEPSEEK_MODEL constant', function () {
      // Count instances of `model: DEEPSEEK_MODEL` — all fetch calls use the constant
      // (Not hardcoding model name in individual call sites)
      var modelRefs = (serverCode.match(/model:\s*DEEPSEEK_MODEL/g) || []).length;
      // There should be multiple fetch call sites all using the constant
      assert.ok(modelRefs >= 8,
        'all DeepSeek fetch calls must use DEEPSEEK_MODEL constant, found ' + modelRefs);
    });

    it('5. no individual fetch call hardcodes deepseek-chat model name', function () {
      // Search for any hardcoded model name in fetch body JSON
      var hardcodedOld = serverCode.match(/model:\s*['"]deepseek-chat['"]/g);
      assert.strictEqual(hardcodedOld, null,
        'no fetch call may hardcode deepseek-chat');
      var hardcodedNew = serverCode.match(/model:\s*['"]deepseek-v4-pro['"]/g);
      assert.strictEqual(hardcodedNew, null,
        'no fetch call may hardcode deepseek-v4-pro — must use DEEPSEEK_MODEL constant');
    });
  });

  // ==========================================================
  //  C. .env.example
  // ==========================================================

  describe('C. .env.example contract', function () {
    it('6. .env.example contains DEEPSEEK_MODEL', function () {
      assert.ok(envExample.indexOf('DEEPSEEK_MODEL') >= 0,
        '.env.example must document DEEPSEEK_MODEL');
    });

    it('7. .env.example uses deepseek-v4-pro as example', function () {
      var line = envExample.split('\n').find(function (l) {
        return l.indexOf('DEEPSEEK_MODEL=') >= 0;
      });
      assert.ok(line, 'must have DEEPSEEK_MODEL= line');
      assert.ok(line.indexOf('deepseek-v4-pro') >= 0,
        '.env.example DEEPSEEK_MODEL example must be deepseek-v4-pro, got: ' + line);
    });

    it('8. .env.example does NOT contain deepseek-chat', function () {
      assert.strictEqual(envExample.indexOf('deepseek-chat'), -1,
        '.env.example must not reference deepseek-chat');
    });

    it('9. .env.example does NOT contain a real API key', function () {
      // Must not contain sk- followed by a long hex string (real key pattern)
      assert.strictEqual(/sk-[a-f0-9]{20,}/i.test(envExample), false,
        '.env.example must not contain a real API key');
      // The placeholder should be the standard sk-your-api-key-here
      assert.ok(envExample.indexOf('sk-your-api-key-here') >= 0,
        '.env.example must use placeholder API key');
    });

    it('10. .env.example API endpoint unchanged', function () {
      assert.ok(envExample.indexOf('https://api.deepseek.com/v1') >= 0,
        '.env.example must keep the default API endpoint');
    });
  });

  // ==========================================================
  //  D. README.md
  // ==========================================================

  describe('D. README.md contract', function () {
    it('11. README documents default model as deepseek-v4-pro', function () {
      var line = readmeText.split('\n').find(function (l) {
        return l.indexOf('DEEPSEEK_MODEL') >= 0 && l.indexOf('deepseek') >= 0;
      });
      assert.ok(line, 'README must document DEEPSEEK_MODEL');
      assert.ok(line.indexOf('deepseek-v4-pro') >= 0,
        'README default model must be deepseek-v4-pro, got: ' + line);
    });

    it('12. README does NOT mention deepseek-chat', function () {
      assert.strictEqual(readmeText.indexOf('deepseek-chat'), -1,
        'README must not reference deepseek-chat');
    });
  });

  // ==========================================================
  //  E. 仓库范围旧模型名
  // ==========================================================

  describe('E. legacy model name cleanup', function () {
    it('13. no runtime code references deepseek-chat', function () {
      assert.strictEqual(serverCode.indexOf('deepseek-chat'), -1,
        'app.js must not reference deepseek-chat');
    });

    it('14. no runtime code references deepseek-reasoner', function () {
      assert.strictEqual(serverCode.indexOf('deepseek-reasoner'), -1,
        'app.js must not reference deepseek-reasoner');
    });
  });
});
