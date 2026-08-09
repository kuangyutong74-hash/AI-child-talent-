/**
 * 安全环境配置解析器。
 *
 * 设计目标：
 * - 所有环境变量解析在一个入口完成；
 * - 默认值显式声明；
 * - 非法值拒绝启动（或回退到安全默认值）；
 * - 禁止 `trust proxy = true`（允许任意 X-Forwarded-* 伪造）。
 *
 * 解析顺序：
 * 1. PORT — 默认 3000，必须是 1–65535 的整数。
 * 2. NODE_ENV — 默认 development。
 * 3. COOKIE_SECURE — 未配置时由 NODE_ENV 决定；支持明确的 "true"/"false"。
 * 4. TRUST_PROXY — 默认 false；允许 false、正整数、"loopback"、"linklocal"、"uniquelocal"；
 *    禁止 true 和任意字符串；非法值启动失败。
 */

'use strict';

/**
 * @typedef {Object} EnvConfig
 * @property {number}  PORT          — 1–65535 的整数
 * @property {string}  NODE_ENV      — "development" | "production"
 * @property {boolean} COOKIE_SECURE — Cookie 是否必须 Secure
 * @property {*}       TRUST_PROXY   — Express trust proxy 参数值
 */

/**
 * 可信任的 trust proxy 命名字符串（Express 安全名称）。
 */
var TRUSTED_PROXY_NAMES = [
  'loopback',
  'linklocal',
  'uniquelocal',
];

/**
 * 核心解析函数。
 * 仅在第一次调用时执行环境变量检查；
 * 后续调用返回缓存结果（单例模式）。
 * 不读取或输出 .env 文件。
 *
 * @returns {EnvConfig}
 * @throws {Error} 如果 TRUST_PROXY 配置非法
 */
var _parsed = null;

function parseEnvConfig() {
  if (_parsed !== null) return _parsed;

  // ---- PORT ----
  var rawPort = process.env.PORT;
  var port = 3000;
  if (rawPort !== undefined && rawPort !== null && rawPort !== '') {
    var n = Number(rawPort);
    if (Number.isFinite(n) && n === Math.floor(n) && n >= 1 && n <= 65535) {
      port = n;
    }
    // 非法值：保持默认 3000（静默回退）
  }

  // ---- NODE_ENV ----
  var nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'production' && nodeEnv !== 'development') {
    // 未知值回退到 development
    nodeEnv = 'development';
  }

  // ---- COOKIE_SECURE ----
  var cookieSecure;
  var rawSecure = process.env.COOKIE_SECURE;
  if (rawSecure === 'true') {
    cookieSecure = true;
  } else if (rawSecure === 'false') {
    cookieSecure = false;
  } else {
    // 未配置：production 默认开启，其他默认关闭
    cookieSecure = (nodeEnv === 'production');
  }

  // ---- TRUST_PROXY ----
  var rawProxy = process.env.TRUST_PROXY;
  var trustProxy = false;

  if (rawProxy !== undefined && rawProxy !== null && rawProxy !== '') {
    // 尝试解析为整数
    if (/^\d+$/.test(rawProxy)) {
      var intVal = parseInt(rawProxy, 10);
      if (intVal >= 0) {
        trustProxy = intVal;
      } else {
        throw new Error('INVALID_TRUST_PROXY');
      }
    } else if (rawProxy === 'false') {
      trustProxy = false;
    } else if (rawProxy === 'true') {
      // 显式拒绝 true
      throw new Error('INVALID_TRUST_PROXY');
    } else {
      // 命名字符串
      if (TRUSTED_PROXY_NAMES.indexOf(rawProxy) >= 0) {
        trustProxy = rawProxy;
      } else {
        throw new Error('INVALID_TRUST_PROXY');
      }
    }
  }

  _parsed = {
    PORT: port,
    NODE_ENV: nodeEnv,
    COOKIE_SECURE: cookieSecure,
    TRUST_PROXY: trustProxy,
  };

  return _parsed;
}

/**
 * 仅用于测试：重置缓存。
 * @private 不通过任何 HTTP 路由暴露。
 */
function _resetForTests() {
  _parsed = null;
}

module.exports = {
  parseEnvConfig: parseEnvConfig,
  _resetForTests: _resetForTests,
  _TRUSTED_PROXY_NAMES: TRUSTED_PROXY_NAMES,
};
