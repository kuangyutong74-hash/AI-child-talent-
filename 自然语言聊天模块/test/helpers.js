/**
 * test/helpers.js — 测试公共工具
 *
 * 提供：
 *   - networkGuard       — 未 mock 的 fetch 调用立即抛错
 *   - blockNetworkFetch   — 将 global.fetch 设为 networkGuard
 *   - mockFetch(opts)     — 临时替换 global.fetch 为模拟版本，记录调用
 *   - restoreFetch()     — 恢复 global.fetch 为 networkGuard（普通 after/afterEach 使用）
 *   - restoreOriginalFetch() — 恢复测试启动前的 global.fetch（仅进程最终清理使用）
 *   - httpRequest(url, opts)  — 轻量 HTTP 请求（Node 内置 http，不走 fetch）
 *   - tempDir(prefix)    — 使用 fs.mkdtempSync 创建唯一临时目录
 *   - cleanup(dir)       — 递归删除临时目录
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
//  保存测试启动前的原始 fetch
// ============================================================

const originalFetch = global.fetch;

// ============================================================
//  默认拒绝网络的 fetch 守卫
// ============================================================

/**
 * 任何未显式 mock 的 fetch 调用立即抛出错误，
 * 确保测试中不会意外发出真实网络请求。
 */
function networkGuard(url) {
  throw new Error(
    'Unexpected real network request in test: ' + String(url) +
    ' — 请使用 mockFetch() mock 所有外部网络请求。'
  );
}

/**
 * 将 global.fetch 设置为 networkGuard。
 * 已在本模块加载时自动执行一次。
 */
function blockNetworkFetch() {
  global.fetch = networkGuard;
}

// 模块加载后立即注册网络守卫
blockNetworkFetch();

// ============================================================
//  模拟 DeepSeek API 响应
// ============================================================

/**
 * 替换 global.fetch 为 mock 版本（覆盖 networkGuard）
 *
 * @param {object} [opts]
 * @param {string} [opts.reply] - 模拟的 AI 回复文本，默认 "这是一条模拟回复。"
 * @param {number} [opts.status] - HTTP 状态码，默认 200
 * @param {object} [opts.error] - 如果设置，返回错误响应体
 * @returns {Array} captured — 每次 fetch 调用的 { url, body } 记录数组
 */
function mockFetch(opts) {
  opts = opts || {};
  const captured = [];

  global.fetch = function (url, init) {
    const body = init && init.body ? JSON.parse(init.body) : null;
    captured.push({ url: url, body: body });

    const status = opts.status || 200;
    if (opts.error) {
      var errJson = JSON.stringify(opts.error);
      return Promise.resolve({
        ok: false,
        status: status,
        json: function () { return Promise.resolve(opts.error); },
        text: function () { return Promise.resolve(errJson); },
      });
    }

    const reply = opts.reply || '这是一条模拟回复。';
    var okJson = JSON.stringify({ choices: [{ message: { content: reply } }] });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () {
        return Promise.resolve({
          choices: [{ message: { content: reply } }],
        });
      },
      text: function () { return Promise.resolve(okJson); },
    });
  };

  return captured;
}

/**
 * 恢复 global.fetch 为 networkGuard。
 * 每个测试文件的 after/afterEach 中应调用此函数（无参数）。
 */
function restoreFetch() {
  global.fetch = networkGuard;
}

/**
 * 恢复 global.fetch 到测试启动前的原始值。
 * 仅在整个测试进程最终清理时使用；普通 afterEach 不得调用此函数。
 */
function restoreOriginalFetch() {
  if (originalFetch === undefined) {
    delete global.fetch;
  } else {
    global.fetch = originalFetch;
  }
}

// ============================================================
//  轻量 HTTP 请求（不依赖 supertest，仅访问 localhost）
// ============================================================

/**
 * 发送 HTTP 请求并返回 { status, headers, body }
 *
 * @param {string} urlPath - 如 '/chat/session'
 * @param {object} [opts]
 * @param {string} [opts.method='GET']
 * @param {number} [opts.port]
 * @param {object} [opts.headers]
 * @param {object} [opts.data] - JSON body（POST/PUT 时）
 * @returns {Promise<{status: number, headers: object, body: object}>}
 */
function httpRequest(urlPath, opts) {
  opts = opts || {};
  const method = opts.method || 'GET';
  const port = opts.port || 3000;
  const reqHeaders = opts.headers || {};

  return new Promise(function (resolve, reject) {
    const reqOpts = {
      hostname: '127.0.0.1',
      port: port,
      path: urlPath,
      method: method,
      headers: reqHeaders,
    };

    let dataStr = null;
    if (opts.data) {
      dataStr = JSON.stringify(opts.data);
      reqOpts.headers['Content-Type'] = 'application/json';
      reqOpts.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    const req = http.request(reqOpts, function (res) {
      let body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (_) {
          parsed = { _raw: body };
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, function () {
      req.destroy();
      reject(new Error('HTTP request timeout'));
    });

    if (dataStr) {
      req.write(dataStr);
    }
    req.end();
  });
}

// ============================================================
//  临时目录
// ============================================================

/**
 * 使用 fs.mkdtempSync 在系统临时目录下创建唯一子目录
 *
 * @param {string} [prefix] - 目录名前缀，默认 'ai-talent-scout-test-'
 * @returns {string} 临时目录的绝对路径
 */
function tempDir(prefix) {
  return fs.mkdtempSync(
    path.join(os.tmpdir(), prefix || 'ai-talent-scout-test-')
  );
}

/**
 * 递归删除目录及其内容
 *
 * @param {string} dir
 */
function cleanup(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {
    // best-effort cleanup
  }
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  networkGuard,
  blockNetworkFetch,
  mockFetch,
  restoreFetch,
  restoreOriginalFetch,
  httpRequest,
  tempDir,
  cleanup,
};
