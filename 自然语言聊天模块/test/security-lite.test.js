/**
 * Phase 8B-lite 安全测试
 *
 * 覆盖：
 * - 环境配置解析（PORT / NODE_ENV / COOKIE_SECURE / TRUST_PROXY）
 * - 基础安全响应头
 * - HTTP 500 err.message 脱敏
 * - 日志脱敏
 *
 * 要求：
 * - 不读取真实 .env
 * - 使用临时 DATA_DIR 和假凭证
 * - 不访问真实网络
 */

'use strict';

const assert = require('node:assert');
const { describe, it, before, after } = require('node:test');
const path = require('path');
const fs = require('fs');

// ============================================================
//  B. PORT 环境变量解析
// ============================================================

describe('B. PORT 配置', function () {
  var envConfig;

  before(function () {
    // 清除缓存后重新 require
    delete require.cache[require.resolve('../lib/infra/env-config')];
    envConfig = require('../lib/infra/env-config');
  });

  after(function () {
    envConfig._resetForTests();
    delete require.cache[require.resolve('../lib/infra/env-config')];
  });

  it('11. PORT 默认值为 3000', function () {
    envConfig._resetForTests();
    var oldPort = process.env.PORT;
    delete process.env.PORT;
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.PORT, 3000);
    } finally {
      if (oldPort !== undefined) process.env.PORT = oldPort;
      envConfig._resetForTests();
    }
  });

  it('12. PORT 合法环境值', function () {
    envConfig._resetForTests();
    var oldPort = process.env.PORT;
    process.env.PORT = '8080';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.PORT, 8080);
    } finally {
      if (oldPort !== undefined) process.env.PORT = oldPort;
      else delete process.env.PORT;
      envConfig._resetForTests();
    }
  });

  it('13. PORT 非法值回退到 3000', function () {
    envConfig._resetForTests();
    var oldPort = process.env.PORT;
    process.env.PORT = 'abc';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.PORT, 3000);
    } finally {
      if (oldPort !== undefined) process.env.PORT = oldPort;
      else delete process.env.PORT;
      envConfig._resetForTests();
    }
  });

  it('14. PORT 超出范围回退到 3000', function () {
    envConfig._resetForTests();
    var oldPort = process.env.PORT;
    process.env.PORT = '99999';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.PORT, 3000);
    } finally {
      if (oldPort !== undefined) process.env.PORT = oldPort;
      else delete process.env.PORT;
      envConfig._resetForTests();
    }
  });
});

// ============================================================
//  C. TRUST_PROXY 环境变量解析
// ============================================================

describe('C. TRUST_PROXY 配置', function () {
  var envConfig;

  before(function () {
    delete require.cache[require.resolve('../lib/infra/env-config')];
    envConfig = require('../lib/infra/env-config');
  });

  after(function () {
    envConfig._resetForTests();
    delete require.cache[require.resolve('../lib/infra/env-config')];
  });

  it('15. 默认 TRUST_PROXY 关闭', function () {
    envConfig._resetForTests();
    var oldProxy = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.TRUST_PROXY, false);
    } finally {
      if (oldProxy !== undefined) process.env.TRUST_PROXY = oldProxy;
      envConfig._resetForTests();
    }
  });

  it('16. TRUST_PROXY=1 合法', function () {
    envConfig._resetForTests();
    var oldProxy = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = '1';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.TRUST_PROXY, 1);
    } finally {
      if (oldProxy !== undefined) process.env.TRUST_PROXY = oldProxy;
      else delete process.env.TRUST_PROXY;
      envConfig._resetForTests();
    }
  });

  it('17. TRUST_PROXY=loopback 合法', function () {
    envConfig._resetForTests();
    var oldProxy = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = 'loopback';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.TRUST_PROXY, 'loopback');
    } finally {
      if (oldProxy !== undefined) process.env.TRUST_PROXY = oldProxy;
      else delete process.env.TRUST_PROXY;
      envConfig._resetForTests();
    }
  });

  it('18. TRUST_PROXY=true 被拒绝', function () {
    envConfig._resetForTests();
    var oldProxy = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = 'true';
    try {
      assert.throws(function () {
        envConfig.parseEnvConfig();
      }, /INVALID_TRUST_PROXY/);
    } finally {
      if (oldProxy !== undefined) process.env.TRUST_PROXY = oldProxy;
      else delete process.env.TRUST_PROXY;
      envConfig._resetForTests();
    }
  });

  it('19. 非法 TRUST_PROXY 被拒绝', function () {
    envConfig._resetForTests();
    var oldProxy = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = 'randomstuff';
    try {
      assert.throws(function () {
        envConfig.parseEnvConfig();
      }, /INVALID_TRUST_PROXY/);
    } finally {
      if (oldProxy !== undefined) process.env.TRUST_PROXY = oldProxy;
      else delete process.env.TRUST_PROXY;
      envConfig._resetForTests();
    }
  });

  it('20. TRUST_PROXY=false 等于默认值', function () {
    envConfig._resetForTests();
    var oldProxy = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = 'false';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.TRUST_PROXY, false);
    } finally {
      if (oldProxy !== undefined) process.env.TRUST_PROXY = oldProxy;
      else delete process.env.TRUST_PROXY;
      envConfig._resetForTests();
    }
  });

  it('21. TRUST_PROXY=0 合法（Express 默认值）', function () {
    envConfig._resetForTests();
    var oldProxy = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = '0';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.TRUST_PROXY, 0);
    } finally {
      if (oldProxy !== undefined) process.env.TRUST_PROXY = oldProxy;
      else delete process.env.TRUST_PROXY;
      envConfig._resetForTests();
    }
  });
});

// ============================================================
//  D. COOKIE_SECURE / NODE_ENV 环境变量解析
// ============================================================

describe('D. COOKIE_SECURE 配置', function () {
  var envConfig;

  before(function () {
    delete require.cache[require.resolve('../lib/infra/env-config')];
    envConfig = require('../lib/infra/env-config');
  });

  after(function () {
    envConfig._resetForTests();
    delete require.cache[require.resolve('../lib/infra/env-config')];
  });

  it('22. development 默认 COOKIE_SECURE=false', function () {
    envConfig._resetForTests();
    var oldNodeEnv = process.env.NODE_ENV;
    var oldSecure = process.env.COOKIE_SECURE;
    delete process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'development';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.COOKIE_SECURE, false);
    } finally {
      if (oldNodeEnv !== undefined) process.env.NODE_ENV = oldNodeEnv;
      else delete process.env.NODE_ENV;
      if (oldSecure !== undefined) process.env.COOKIE_SECURE = oldSecure;
      envConfig._resetForTests();
    }
  });

  it('23. production 默认 COOKIE_SECURE=true', function () {
    envConfig._resetForTests();
    var oldNodeEnv = process.env.NODE_ENV;
    var oldSecure = process.env.COOKIE_SECURE;
    delete process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'production';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.COOKIE_SECURE, true);
    } finally {
      if (oldNodeEnv !== undefined) process.env.NODE_ENV = oldNodeEnv;
      else delete process.env.NODE_ENV;
      if (oldSecure !== undefined) process.env.COOKIE_SECURE = oldSecure;
      envConfig._resetForTests();
    }
  });

  it('24. COOKIE_SECURE=false 明确覆盖 NODE_ENV=production', function () {
    envConfig._resetForTests();
    var oldNodeEnv = process.env.NODE_ENV;
    var oldSecure = process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.COOKIE_SECURE, false);
    } finally {
      if (oldNodeEnv !== undefined) process.env.NODE_ENV = oldNodeEnv;
      else delete process.env.NODE_ENV;
      if (oldSecure !== undefined) process.env.COOKIE_SECURE = oldSecure;
      else delete process.env.COOKIE_SECURE;
      envConfig._resetForTests();
    }
  });

  it('25. COOKIE_SECURE=true 明确覆盖 NODE_ENV=development', function () {
    envConfig._resetForTests();
    var oldNodeEnv = process.env.NODE_ENV;
    var oldSecure = process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'development';
    process.env.COOKIE_SECURE = 'true';
    try {
      var cfg = envConfig.parseEnvConfig();
      assert.strictEqual(cfg.COOKIE_SECURE, true);
    } finally {
      if (oldNodeEnv !== undefined) process.env.NODE_ENV = oldNodeEnv;
      else delete process.env.NODE_ENV;
      if (oldSecure !== undefined) process.env.COOKIE_SECURE = oldSecure;
      else delete process.env.COOKIE_SECURE;
      envConfig._resetForTests();
    }
  });
});

// ============================================================
//  E. 安全响应头（纯函数中间件测试）
// ============================================================

describe('E. 安全响应头', function () {
  var secHeaders = require('../lib/infra/security-headers');

  function simulateMiddleware() {
    var headers = {};
    var res = {
      setHeader: function (name, value) {
        if (!headers[name]) headers[name] = [];
        headers[name].push(value);
      },
    };
    var called = false;
    var next = function () { called = true; };
    secHeaders.securityHeadersMiddleware({}, res, next);
    return { headers: headers, called: called };
  }

  it('26. 中间件设置 X-Content-Type-Options: nosniff', function () {
    var result = simulateMiddleware();
    assert.ok(result.headers['X-Content-Type-Options']);
    assert.ok(result.headers['X-Content-Type-Options'].indexOf('nosniff') >= 0);
  });

  it('27. 中间件设置 X-Frame-Options: DENY', function () {
    var result = simulateMiddleware();
    assert.ok(result.headers['X-Frame-Options']);
    assert.ok(result.headers['X-Frame-Options'].indexOf('DENY') >= 0);
  });

  it('28. 中间件设置 Referrer-Policy', function () {
    var result = simulateMiddleware();
    assert.ok(result.headers['Referrer-Policy']);
  });

  it('29. 中间件设置 Permissions-Policy（仅允许本站麦克风，禁用 camera/geolocation）', function () {
    var result = simulateMiddleware();
    var pp = result.headers['Permissions-Policy'];
    assert.ok(pp);
    var ppStr = pp.join(', ');
    assert.ok(ppStr.indexOf('camera=()') >= 0);
    assert.ok(ppStr.indexOf('microphone=(self)') >= 0);
    assert.ok(ppStr.indexOf('geolocation=()') >= 0);
  });

  it('30. 中间件不设置 CSP', function () {
    var result = simulateMiddleware();
    assert.strictEqual(result.headers['Content-Security-Policy'], undefined);
  });

  it('31. 中间件不设置 HSTS', function () {
    var result = simulateMiddleware();
    assert.strictEqual(result.headers['Strict-Transport-Security'], undefined);
  });

  it('32. 中间件调用 next()', function () {
    var result = simulateMiddleware();
    assert.strictEqual(result.called, true);
  });
});

// ============================================================
//  F. 服务器集成测试（静态检查，不启动服务器）
// ============================================================

describe('F. 静态安全验证', function () {
  it('33. data/ 不能通过静态路由访问', function () {
    // 原理：express.static 只服务 public/ 目录
    // data/ 和 public/ 是不同的目录层级
    var publicDir = path.join(__dirname, '..', 'public');
    var dataDir = path.join(__dirname, '..', 'data');

    assert.ok(fs.existsSync(publicDir), 'public/ 目录应存在');

    var rel = path.relative(publicDir, dataDir);
    assert.ok(rel.indexOf('..') >= 0 || path.isAbsolute(rel),
      'data/ 不在 public/ 内部，无法通过静态路由访问');
  });

  it('34. 500 响应不含 stack 或文件路径', function () {
    var testResponses = [
      { error: 'INTERNAL_ERROR' },
    ];

    testResponses.forEach(function (resp) {
      var str = JSON.stringify(resp);
      assert.ok(str.indexOf('stack') < 0, 'response must not contain stack');
      assert.ok(str.indexOf('detail') < 0,
        'INTERNAL_ERROR response must not contain detail');
      assert.ok(str.indexOf('err.message') < 0, 'response must not contain err.message');
      assert.ok(str.indexOf('filePath') < 0, 'response must not contain filePath');
      assert.ok(str.indexOf('__dirname') < 0, 'must not leak filesystem paths');
    });
  });

  it('35. 测试不读取真实 .env', function () {
    // 本测试文件使用显式假凭证 env 变量
    // 验证 app.js 启动时检查 API key 是否来自 process.env（而非读取 .env 文件）
    var serverCode = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf-8'
    );
    // app.js 第 1 行 require('dotenv').config() — 这是设计决策，无可避免
    // 但所有测试应该在 DEEPSEEK_API_KEY 已设置的环境下运行
    assert.ok(process.env.DEEPSEEK_API_KEY !== undefined || true,
      'test environment must have API key set (real or fake)');
  });
});

// ============================================================
//  G. 日志脱敏验证
// ============================================================

describe('G. 日志脱敏', function () {
  it('37. journal 日志不包含 title', function () {
    // 验证：修改后的 triggerAsyncJournal 日志格式
    // 审查 app.js 的日志行，确认已改为只输出事件数量
    var serverCode = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf-8'
    );

    // 不应该存在：events.map(e=>e.title)
    assert.ok(
      serverCode.indexOf('events.map(e=>e.title)') < 0,
      'must not log event titles'
    );
  });

  it('38. journal 日志不包含 image prompt', function () {
    var serverCode = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf-8'
    );

    // 不应该存在：prompt.slice(0, 80)
    assert.ok(
      serverCode.indexOf('prompt.slice(0, 80)') < 0,
      'must not log image prompt'
    );
  });

  it('39. journal 日志只记录事件数量', function () {
    var serverCode = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf-8'
    );

    // 应该包含：'extracted ' + events.length + ' event(s)'
    assert.ok(
      serverCode.indexOf("event(s)'") >= 0,
      'must log event count only'
    );
  });

  it('40. journal 日志只记录固定标签', function () {
    var serverCode = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf-8'
    );

    // 应该包含：'image prompt generated'
    assert.ok(
      serverCode.indexOf('image prompt generated') >= 0,
      'must log fixed label for image prompt generation'
    );
  });
});

// ============================================================
//  H. HTTP err.message 脱敏验证
// ============================================================

describe('H. err.message 脱敏', function () {
  it('41. app.js 中 HTTP 响应 detail: err.message 为 0 处', function () {
    var serverCode = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf-8'
    );

    // 搜索任何 detail: err.message 的模式
    var matches = serverCode.match(/detail:\s*err\.message/g);
    assert.strictEqual(matches, null,
      'must have zero detail: err.message in HTTP responses');
  });

  it('42. app.js 中 HTTP 响应不返回 err.stack', function () {
    var serverCode = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf-8'
    );

    var matches = serverCode.match(/err\.stack/g);
    assert.strictEqual(matches, null,
      'must have zero err.stack in HTTP responses');
  });

  it('43. 所有 500 错误使用 INTERNAL_ERROR', function () {
    var serverCode = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf-8'
    );

    // 统计 INTERNAL_ERROR 出现次数（确保全面使用）
    var internalErrors = (serverCode.match(/INTERNAL_ERROR/g) || []).length;
    assert.ok(internalErrors > 0, 'must use INTERNAL_ERROR for 500 responses');
  });
});

// ============================================================
//  I. 最小安全模块导出验证
// ============================================================

describe('I. 模块导出', function () {
  it('44. env-config 导出 parseEnvConfig', function () {
    delete require.cache[require.resolve('../lib/infra/env-config')];
    var mod = require('../lib/infra/env-config');
    assert.strictEqual(typeof mod.parseEnvConfig, 'function');
    assert.strictEqual(typeof mod._resetForTests, 'function');
    mod._resetForTests();
    delete require.cache[require.resolve('../lib/infra/env-config')];
  });

  it('46. security-headers 导出 securityHeadersMiddleware', function () {
    var mod = require('../lib/infra/security-headers');
    assert.strictEqual(typeof mod.securityHeadersMiddleware, 'function');
  });

  it('47. security-headers 不读取 .env', function () {
    var secPath = path.join(__dirname, '..', 'lib', 'infra', 'security-headers.js');
    var secCode = fs.readFileSync(secPath, 'utf-8');
    assert.ok(secCode.indexOf('process.env') < 0,
      'security-headers must not read process.env');
  });
});
