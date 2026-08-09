/**
 * test/ai-provider-client.test.js — AI Provider Client 单元测试
 *
 * 覆盖: 正常响应、超时、错误分类、timer 清理、externalSignal、安全脱敏。
 * 仅使用 node:test + node:assert + fake fetch，不访问真实网络。
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var {
  requestChatCompletion,
  ProviderError,
  PROVIDER_ERROR_CODES
} = require('../lib/core/ai-provider-client');

// ============================================================
//  Helpers
// ============================================================

var BASE_OPTS = {
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: 'sk-test',
  model: 'deepseek-v4-pro',
  messages: [{ role: 'user', content: 'hello' }]
};

function opts(overrides) {
  var o = Object.assign({}, BASE_OPTS, overrides);
  return o;
}

function makeFakeFetch(scenarios) {
  var s = scenarios || {};
  var delay = s.delayMs || 0;
  var status = s.status !== undefined ? s.status : 200;
  var jsonBody = s.jsonBody !== undefined ? s.jsonBody : { choices: [{ message: { content: 'test reply' } }] };
  var rawBody = s.rawBody || null;

  return function (url, init) {
    var signal = init && init.signal;

    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) {
        reject(makeAbortError());
        return;
      }

      var onAbort = function () {
        clearTimeout(timer);
        reject(makeAbortError());
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      // When timeout=true, NEVER resolve — only abort signal can reject
      if (s.timeout) return;

      var timer = setTimeout(function () {
        if (signal) {
          try { signal.removeEventListener('abort', onAbort); } catch (_) {}
        }
        if (s.networkError) {
          reject(new Error('ECONNREFUSED'));
          return;
        }
        resolve({
          ok: status >= 200 && status < 300,
          status: status,
          text: function () {
            return Promise.resolve(rawBody !== null ? rawBody : JSON.stringify(jsonBody));
          }
        });
      }, delay);
    });
  };
}

function makeAbortError() {
  var err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

// ============================================================
//  1. 正常响应
// ============================================================

describe('1. normal response', function () {
  it('1. returns {content} on 200 with valid body', async function () {
    var result = await requestChatCompletion(opts({
      fetchImpl: makeFakeFetch({ jsonBody: { choices: [{ message: { content: 'hello world' } }] } })
    }));
    assert.deepStrictEqual(result, { content: 'hello world' });
  });

  it('2. empty string content is valid', async function () {
    var result = await requestChatCompletion(opts({
      fetchImpl: makeFakeFetch({ jsonBody: { choices: [{ message: { content: '' } }] } })
    }));
    assert.deepStrictEqual(result, { content: '' });
  });
});

// ============================================================
//  2. 注入 fetchImpl
// ============================================================

describe('2. injectable fetchImpl', function () {
  it('3. uses injected fetchImpl not global fetch', async function () {
    var called = false;
    var fakeFetch = function () { called = true; return makeFakeFetch({})(); };
    await requestChatCompletion(opts({ fetchImpl: fakeFetch }));
    assert.strictEqual(called, true);
  });
});

// ============================================================
//  3. 超时
// ============================================================

describe('3. timeout', function () {
  it('4. timeoutMs=50 with never-resolving fetch → AI_TIMEOUT', async function () {
    try {
      await requestChatCompletion(opts({
        timeoutMs: 50,
        fetchImpl: makeFakeFetch({ timeout: true })
      }));
      assert.fail('should have timed out');
    } catch (e) {
      assert.ok(e instanceof ProviderError);
      assert.strictEqual(e.code, 'AI_TIMEOUT');
      assert.strictEqual(e.httpStatus, 504);
    }
  });

  it('5. timeout aborts the underlying request', async function () {
    var aborted = false;
    function fetchWithAbortCheck(url, init) {
      var signal = init && init.signal;
      return new Promise(function (resolve, reject) {
        var t = setTimeout(function () {}, 99999);
        var onAbort = function () { aborted = true; clearTimeout(t); reject(makeAbortError()); };
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
      });
    }
    try {
      await requestChatCompletion(opts({ timeoutMs: 20, fetchImpl: fetchWithAbortCheck }));
      assert.fail('should have thrown');
    } catch (e) {
      assert.strictEqual(e.code, 'AI_TIMEOUT');
      assert.strictEqual(aborted, true);
    }
  });

  it('6. timer cleaned up after success', async function () {
    var result = await requestChatCompletion(opts({
      timeoutMs: 5000,
      fetchImpl: makeFakeFetch({ delayMs: 5 })
    }));
    assert.deepStrictEqual(result, { content: 'test reply' });
  });

  it('7. timer cleaned up after failure', async function () {
    try {
      await requestChatCompletion(opts({
        timeoutMs: 5000,
        fetchImpl: makeFakeFetch({ networkError: true })
      }));
      assert.fail('should have thrown');
    } catch (e) {
      assert.strictEqual(e.code, 'AI_UNAVAILABLE');
    }
  });
});

// ============================================================
//  4. externalSignal
// ============================================================

describe('4. externalSignal', function () {
  it('8. externalSignal abort cancels request → AI_CANCELLED', async function () {
    var controller = new AbortController();
    var promise = requestChatCompletion(opts({
      timeoutMs: 5000,
      fetchImpl: makeFakeFetch({ timeout: true }),
      externalSignal: controller.signal
    }));
    setTimeout(function () { controller.abort(); }, 10);
    try {
      await promise;
      assert.fail('should have thrown AI_CANCELLED');
    } catch (e) {
      assert.ok(e instanceof ProviderError);
      assert.strictEqual(e.code, 'AI_CANCELLED');
    }
  });

  it('9. externalSignal listener cleaned up after success', async function () {
    var controller = new AbortController();
    var result = await requestChatCompletion(opts({
      timeoutMs: 5000,
      fetchImpl: makeFakeFetch({ delayMs: 5 }),
      externalSignal: controller.signal
    }));
    assert.deepStrictEqual(result, { content: 'test reply' });
    controller.abort();
  });

  it('10. already-aborted externalSignal throws immediately', async function () {
    var controller = new AbortController();
    controller.abort();
    try {
      await requestChatCompletion(opts({
        timeoutMs: 5000,
        fetchImpl: makeFakeFetch({}),
        externalSignal: controller.signal
      }));
      assert.fail('should have thrown');
    } catch (e) {
      assert.strictEqual(e.code, 'AI_CANCELLED');
    }
  });
});

// ============================================================
//  5. fetch 网络错误
// ============================================================

describe('5. fetch network error', function () {
  it('11. fetch rejection → AI_UNAVAILABLE', async function () {
    try {
      await requestChatCompletion(opts({
        timeoutMs: 5000,
        fetchImpl: makeFakeFetch({ networkError: true })
      }));
      assert.fail('should have thrown');
    } catch (e) {
      assert.ok(e instanceof ProviderError);
      assert.strictEqual(e.code, 'AI_UNAVAILABLE');
      assert.strictEqual(e.httpStatus, 503);
    }
  });
});

// ============================================================
//  6. provider HTTP 错误
// ============================================================

describe('6. provider HTTP errors', function () {
  it('12. provider 400 → AI_BAD_RESPONSE', async function () {
    try {
      await requestChatCompletion(opts({
        fetchImpl: makeFakeFetch({ status: 400, jsonBody: { error: 'bad request' } })
      }));
    } catch (e) {
      assert.strictEqual(e.code, 'AI_BAD_RESPONSE');
      assert.strictEqual(e.httpStatus, 502);
    }
  });

  it('13. provider 401 → INTERNAL_ERROR', async function () {
    try {
      await requestChatCompletion(opts({ fetchImpl: makeFakeFetch({ status: 401 }) }));
    } catch (e) {
      assert.strictEqual(e.code, 'INTERNAL_ERROR');
      assert.strictEqual(e.httpStatus, 500);
    }
  });

  it('14. provider 403 → INTERNAL_ERROR', async function () {
    try {
      await requestChatCompletion(opts({ fetchImpl: makeFakeFetch({ status: 403 }) }));
    } catch (e) {
      assert.strictEqual(e.code, 'INTERNAL_ERROR');
      assert.strictEqual(e.httpStatus, 500);
    }
  });

  it('15. provider 429 → AI_UNAVAILABLE', async function () {
    try {
      await requestChatCompletion(opts({ fetchImpl: makeFakeFetch({ status: 429 }) }));
    } catch (e) {
      assert.strictEqual(e.code, 'AI_UNAVAILABLE');
      assert.strictEqual(e.httpStatus, 503);
    }
  });

  it('16. provider 500 → AI_UNAVAILABLE', async function () {
    try {
      await requestChatCompletion(opts({ fetchImpl: makeFakeFetch({ status: 500 }) }));
    } catch (e) {
      assert.strictEqual(e.code, 'AI_UNAVAILABLE');
      assert.strictEqual(e.httpStatus, 503);
    }
  });
});

// ============================================================
//  7. 响应体错误
// ============================================================

describe('7. bad response bodies', function () {
  it('17. HTML response → AI_BAD_RESPONSE', async function () {
    try {
      await requestChatCompletion(opts({
        fetchImpl: makeFakeFetch({ rawBody: '<html><body>502 Bad Gateway</body></html>' })
      }));
    } catch (e) {
      assert.strictEqual(e.code, 'AI_BAD_RESPONSE');
    }
  });

  it('18. invalid JSON → AI_BAD_RESPONSE', async function () {
    try {
      await requestChatCompletion(opts({
        fetchImpl: makeFakeFetch({ rawBody: 'not json at all!!!' })
      }));
    } catch (e) {
      assert.strictEqual(e.code, 'AI_BAD_RESPONSE');
    }
  });

  it('19. missing choices → AI_BAD_RESPONSE', async function () {
    try {
      await requestChatCompletion(opts({
        fetchImpl: makeFakeFetch({ jsonBody: { data: 'no choices here' } })
      }));
    } catch (e) {
      assert.strictEqual(e.code, 'AI_BAD_RESPONSE');
    }
  });

  it('20. missing message → AI_BAD_RESPONSE', async function () {
    try {
      await requestChatCompletion(opts({
        fetchImpl: makeFakeFetch({ jsonBody: { choices: [{ not_message: true }] } })
      }));
    } catch (e) {
      assert.strictEqual(e.code, 'AI_BAD_RESPONSE');
    }
  });

  it('21. content is number not string → AI_BAD_RESPONSE', async function () {
    try {
      await requestChatCompletion(opts({
        fetchImpl: makeFakeFetch({ jsonBody: { choices: [{ message: { content: 12345 } }] } })
      }));
    } catch (e) {
      assert.strictEqual(e.code, 'AI_BAD_RESPONSE');
    }
  });
});

// ============================================================
//  8. 安全脱敏
// ============================================================

describe('8. safe error — no leak', function () {
  it('22. ProviderError has no provider body', async function () {
    try {
      await requestChatCompletion(opts({
        fetchImpl: makeFakeFetch({ status: 500, jsonBody: { error: { message: 'secret internal detail' } } })
      }));
    } catch (e) {
      assert.ok(e instanceof ProviderError);
      assert.strictEqual(e.providerBody, undefined);
      assert.strictEqual('providerBody' in e, false);
    }
  });

  it('23. ProviderError does not leak raw err.message (ECONNREFUSED)', async function () {
    try {
      await requestChatCompletion(opts({
        fetchImpl: makeFakeFetch({ networkError: true })
      }));
    } catch (e) {
      assert.ok(e instanceof ProviderError);
      // ProviderError inherits from Error so message exists, but it must NOT
      // be the raw underlying error message
      assert.strictEqual(e.message.indexOf('ECONNREFUSED') < 0, true,
        'must not leak raw ECONNREFUSED in message');
      assert.strictEqual(e.stack, undefined);
    }
  });

  it('24. ProviderError ownKeys are code, httpStatus, logHint only', async function () {
    try {
      await requestChatCompletion(opts({
        timeoutMs: 20,
        fetchImpl: makeFakeFetch({ timeout: true })
      }));
    } catch (e) {
      var ownKeys = Object.keys(e).sort();
      assert.ok(ownKeys.indexOf('code') >= 0);
      assert.ok(ownKeys.indexOf('httpStatus') >= 0);
      assert.ok(ownKeys.indexOf('message') < 0, 'must not have message');
      assert.ok(ownKeys.indexOf('stack') < 0, 'must not have stack');
      assert.ok(ownKeys.indexOf('providerBody') < 0, 'must not have providerBody');
    }
  });
});

// ============================================================
//  9. 边界
// ============================================================

describe('9. edge cases', function () {
  it('25. timeout late-arriving result not accepted', async function () {
    function slowFetch(url, init) {
      return new Promise(function (resolve, reject) {
        var signal = init && init.signal;
        var onAbort = function () { reject(makeAbortError()); };
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
        setTimeout(function () {
          if (signal) { try { signal.removeEventListener('abort', onAbort); } catch (_) {} }
          resolve({
            ok: true, status: 200,
            text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: 'late data' } }] })); }
          });
        }, 40);
      });
    }

    try {
      await requestChatCompletion(opts({ timeoutMs: 20, fetchImpl: slowFetch }));
      assert.fail('should have thrown');
    } catch (e) {
      assert.strictEqual(e.code, 'AI_TIMEOUT');
    }
  });

  it('26. success after previous failure works', async function () {
    try {
      await requestChatCompletion(opts({
        timeoutMs: 20,
        fetchImpl: makeFakeFetch({ timeout: true })
      }));
      assert.fail('first call should have timed out');
    } catch (e) {
      assert.strictEqual(e.code, 'AI_TIMEOUT');
    }

    var result = await requestChatCompletion(opts({
      fetchImpl: makeFakeFetch({ jsonBody: { choices: [{ message: { content: 'recovered' } }] } })
    }));
    assert.deepStrictEqual(result, { content: 'recovered' });
  });
});
