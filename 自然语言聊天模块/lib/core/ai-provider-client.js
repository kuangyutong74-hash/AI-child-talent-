/**
 * lib/ai-provider-client.js — 统一 AI Provider 请求封装
 *
 * 每个主请求内创建一个实例。不接收 Express req/res，不读写 data/，
 * 不记录完整消息，不把 provider 原始 body 返回给调用方。
 *
 * 导出：
 *   requestChatCompletion(options) → { content }
 *   ProviderError              — 安全错误类型
 *   PROVIDER_ERROR_CODES        — 固定错误码常量
 *
 * 错误分类：
 *   AI_TIMEOUT       → 504
 *   AI_UNAVAILABLE   → 503
 *   AI_BAD_RESPONSE  → 502
 *   AI_CANCELLED     → 内部使用（客户端断开）
 *   INTERNAL_ERROR   → 500
 */

'use strict';

// ============================================================
//  错误码常量
// ============================================================

var PROVIDER_ERROR_CODES = Object.freeze({
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_BAD_RESPONSE: 'AI_BAD_RESPONSE',
  AI_CANCELLED: 'AI_CANCELLED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

var CODE_TO_HTTP = Object.freeze({
  AI_TIMEOUT: 504,
  AI_UNAVAILABLE: 503,
  AI_BAD_RESPONSE: 502,
  AI_CANCELLED: 499,
  INTERNAL_ERROR: 500,
});

// ============================================================
//  ProviderError — 不泄露 err.message / provider body / stack
// ============================================================

function ProviderError(code, logHint) {
  this.code = code;
  this.httpStatus = CODE_TO_HTTP[code] || 500;
  this.logHint = logHint || code;
  // Do NOT attach: message, stack, providerBody, endpoint, apiKey
}
ProviderError.prototype = Object.create(Error.prototype);
ProviderError.prototype.constructor = ProviderError;

// ============================================================
//  安全脱敏日志字符串
// ============================================================

function safeLog(msg) {
  return '[provider] ' + String(msg || '');
}

// ============================================================
//  AbortError 检测（跨 Node 版本兼容）
// ============================================================

function isAbortError(err) {
  if (!err) return false;
  return err.name === 'AbortError' || err.code === 'ABORT_ERR' || err.code === 'ECONNABORTED';
}

// ============================================================
//  requestChatCompletion
// ============================================================

/**
 * 发送一次 chat completion 请求。
 *
 * @param {Object}  options
 * @param {string}  options.endpoint      — 完整 URL
 * @param {string}  options.apiKey        — Bearer token
 * @param {string}  options.model         — 模型名
 * @param {Array}   options.messages      — [{role,content},…]
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {number} [options.timeoutMs=25000]
 * @param {Function} [options.fetchImpl]  — 可注入的 fetch（测试用）
 * @param {AbortSignal} [options.externalSignal] — 外部取消信号
 * @returns {Promise<{content: string}>}
 * @throws {ProviderError}
 */
async function requestChatCompletion(options) {
  if (!options || typeof options !== 'object') {
    throw new ProviderError('INTERNAL_ERROR', 'invalid options argument');
  }

  var endpoint = options.endpoint;
  var apiKey = options.apiKey;
  var model = options.model;
  var messages = options.messages;
  var temperature = options.temperature;
  var maxTokens = options.maxTokens;
  var timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : 25000;
  var _fetch = typeof options.fetchImpl === 'function'
    ? options.fetchImpl
    : fetch;
  var externalSignal = options.externalSignal || null;

  // ---- 基础校验 ----

  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    throw new ProviderError('INTERNAL_ERROR', 'missing endpoint');
  }
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new ProviderError('INTERNAL_ERROR', 'missing apiKey');
  }
  if (typeof model !== 'string' || model.length === 0) {
    throw new ProviderError('INTERNAL_ERROR', 'missing model');
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ProviderError('INTERNAL_ERROR', 'missing or empty messages');
  }

  // ---- 创建独立超时 AbortController ----

  var controller;
  var timeoutId;

  try {
    controller = new AbortController();
  } catch (_) {
    // AbortController not available — unlikely in Node 18+
    throw new ProviderError('INTERNAL_ERROR', 'AbortController unavailable');
  }

  // ---- 超时定时器 ----
  // 注意：DeepSeek 非流式响应中，响应头很快返回，但 body（全部 token）
  // 可能持续数十秒才传输完毕。因此定时器必须覆盖「fetch + body 读取」全程，
  // 不能只覆盖 fetch 阶段；并用 Promise.race 强制兜底——部分环境下
  // abort 信号无法中断已开始的 body 读取。
  var timeoutError = null;
  var timeoutPromise = new Promise(function (_resolve, reject) {
    try {
      timeoutId = setTimeout(function () {
        timeoutError = new ProviderError('AI_TIMEOUT', 'request timed out after ' + timeoutMs + 'ms');
        try { controller.abort(); } catch (_) {}
        reject(timeoutError);
      }, timeoutMs);
    } catch (_) {
      // setTimeout 不可用：timeoutId 保持 null，永不超时
    }
  });
  // 竞速落败时静默，避免 unhandled rejection
  timeoutPromise.catch(function () {});

  // ---- 外部信号监听 ----
  // externalSignal 被取消时，传播到 controller
  function onExternalAbort() {
    try { controller.abort(); } catch (_) {}
  }

  var externalSignalCleanup = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw new ProviderError('AI_CANCELLED', 'external signal already aborted');
    }
    try {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      externalSignalCleanup = function () {
        try { externalSignal.removeEventListener('abort', onExternalAbort); } catch (_) {}
      };
    } catch (_) {
      externalSignalCleanup = null;
    }
  }

  // ---- 结果守卫标志 ----
  // abort 后迟到返回时禁止继续
  var finished = false;

  var resp;
  try {
    resp = await Promise.race([
      _fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify(buildRequestBody(model, messages, temperature, maxTokens)),
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (finished) {
      throw new ProviderError('AI_CANCELLED', 'result arrived after abort');
    }
    finished = true;

    if (isAbortError(err)) {
      // 区分：内部超时还是外部取消
      if (externalSignal && externalSignal.aborted) {
        throw new ProviderError('AI_CANCELLED', 'cancelled by external signal');
      }
      throw new ProviderError('AI_TIMEOUT', 'request timed out after ' + timeoutMs + 'ms');
    }

    // 网络错误
    console.error(safeLog('fetch network error'));
    throw new ProviderError('AI_UNAVAILABLE', 'fetch network error');
  } finally {
    // 只清理外部信号 listener；超时定时器必须保留到 body 读取结束
    if (externalSignalCleanup) externalSignalCleanup();
  }

  // ---- 响应到达 ----
  if (finished) {
    throw new ProviderError('AI_CANCELLED', 'result arrived after abort');
  }

  // 检查 HTTP 状态
  if (!resp.ok) {
    finished = true;
    var status = resp.status;

    // 尝试获取响应体用于日志（不返回给调用方）
    var errBody;
    try {
      errBody = await Promise.race([resp.text(), timeoutPromise]);
    } catch (_) {
      errBody = '[unreadable body]';
    }

    // 分类映射
    if (status === 429 || status >= 500) {
      console.error(safeLog('AI_UNAVAILABLE status=' + status + ' bodyLen=' + String(errBody ? errBody.length : 0)));
      throw new ProviderError('AI_UNAVAILABLE', 'provider returned ' + status);
    }
    if (status === 401 || status === 403) {
      console.error(safeLog('INTERNAL_ERROR status=' + status + ' — possible config issue'));
      throw new ProviderError('INTERNAL_ERROR', 'provider auth/config error ' + status);
    }
    // 400 及其他
    console.error(safeLog('AI_BAD_RESPONSE status=' + status + ' bodyLen=' + String(errBody ? errBody.length : 0)));
    throw new ProviderError('AI_BAD_RESPONSE', 'provider returned ' + status);
  }

  // ---- 解析 JSON ----
  finished = true;

  var data;
  try {
    var text = await Promise.race([resp.text(), timeoutPromise]);
    try {
      data = JSON.parse(text);
    } catch (_) {
      console.error(safeLog('AI_BAD_RESPONSE — invalid JSON, textLen=' + String(text ? text.length : 0)));
      // Check if it looks like HTML
      var isHtml = typeof text === 'string' && /^\s*</.test(text);
      throw new ProviderError('AI_BAD_RESPONSE',
        isHtml ? 'provider returned HTML' : 'invalid JSON from provider');
    }
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    console.error(safeLog('AI_BAD_RESPONSE — failed to read response body'));
    throw new ProviderError('AI_BAD_RESPONSE', 'failed to read response body');
  }

  // ---- 提取 content ----

  var content;
  try {
    content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  } catch (_) {
    content = undefined;
  }

  if (content === undefined || content === null) {
    console.error(safeLog('AI_BAD_RESPONSE — missing choices/message/content'));
    throw new ProviderError('AI_BAD_RESPONSE', 'missing choices/message/content in provider response');
  }

  if (typeof content !== 'string') {
    console.error(safeLog('AI_BAD_RESPONSE — content type is ' + typeof content));
    throw new ProviderError('AI_BAD_RESPONSE', 'content is not a string');
  }

  // 空字符串是合法的（provider 可以返回空回复）
  if (timeoutId != null) clearTimeout(timeoutId);
  return { content: content };
}

// ============================================================
//  构建请求体（不包含 endpoint/apiKey）
// ============================================================

function buildRequestBody(model, messages, temperature, maxTokens) {
  var body = { model: model, messages: messages };
  if (typeof temperature === 'number' && isFinite(temperature)) {
    body.temperature = temperature;
  }
  if (typeof maxTokens === 'number' && maxTokens > 0 && Math.floor(maxTokens) === maxTokens) {
    body.max_tokens = maxTokens;
  }
  return body;
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  requestChatCompletion: requestChatCompletion,
  ProviderError: ProviderError,
  PROVIDER_ERROR_CODES: PROVIDER_ERROR_CODES,
};
