/**
 * test/chat-message-boundaries.test.js — Phase 8A1 HTTP 集成测试
 *
 * 覆盖: 消息类型/空值/长度校验、body limit、malformed JSON、
 *        超限不写入、不调用 AI provider、安全错误响应。
 * 使用临时 DATA_DIR，不调用真实 AI。
 */
'use strict';

var { describe, it, before, after } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs'), os = require('os'), path = require('path');
var http = require('http');

function httpRequest(urlPath, opts) {
  opts = opts || {};
  var method = opts.method || 'POST', port = opts.port;
  var reqHeaders = opts.headers || {};
  return new Promise(function (resolve, reject) {
    var rOpts = { hostname: '127.0.0.1', port: port, path: urlPath, method: method, headers: reqHeaders };
    var dataStr = null;
    if (opts.data !== undefined) {
      dataStr = typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data);
      rOpts.headers['Content-Type'] = opts.rawBody ? 'application/json' : 'application/json';
      rOpts.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }
    var req = http.request(rOpts, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        var p; try { p = JSON.parse(body); } catch (_) { p = { _raw: body }; }
        resolve({ status: res.statusCode, headers: res.headers, body: p });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, function () { req.destroy(); reject(new Error('timeout')); });
    if (dataStr) req.write(dataStr); req.end();
  });
}

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'chat-msg-test-')); }
function makeDataDir(base) {
  var d = path.join(base, 'data'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'history.json'), '[]', 'utf-8');
  fs.writeFileSync(path.join(d, 'journal.json'), '[]', 'utf-8');
  fs.writeFileSync(path.join(d, 'tips.json'), '[]', 'utf-8');
  fs.writeFileSync(path.join(d, 'tip-favorites.json'), '{}', 'utf-8');
  return d;
}

var originalDataDir = process.env.DATA_DIR;
var originalSkipMigration = process.env.SKIP_MIGRATION;
var originalApiKey = process.env.DEEPSEEK_API_KEY;

function setupServer(dataDir) {
  process.env.SKIP_MIGRATION = 'true';
  process.env.DATA_DIR = dataDir;
  // No API key — tests verify AI is NOT called
  process.env.DEEPSEEK_API_KEY = '';
  delete require.cache[require.resolve('../app')];
  var mod = require('../app');
  return mod.initializeRuntime().then(function () {
    return new Promise(function (resolve, reject) {
      var srv = mod.app.listen(0, '127.0.0.1', function () {
        resolve({ mod: mod, server: srv, port: srv.address().port });
      });
      srv.on('error', reject);
    });
  });
}

describe('chat message boundaries (HTTP)', function () {
  var ctx, dataDir, tempBase;
  var logFilePath;

  before(function () {
    tempBase = tempDir();
    dataDir = makeDataDir(tempBase);
    logFilePath = path.join(dataDir, 'chat-log.jsonl');
    return setupServer(dataDir).then(function (c) { ctx = c; });
  });

  after(function () {
    process.env.DATA_DIR = originalDataDir;
    process.env.DEEPSEEK_API_KEY = originalApiKey;
    if (originalSkipMigration === undefined) delete process.env.SKIP_MIGRATION;
    else process.env.SKIP_MIGRATION = originalSkipMigration;
    return new Promise(function (resolve) {
      if (ctx && ctx.server && ctx.server.listening) ctx.server.close(function () { resolve(); });
      else resolve();
    }).then(function () { try { fs.rmSync(tempBase, { recursive: true, force: true }); } catch (_) {} });
  });

  function readHistory() {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'history.json'), 'utf-8')); } catch (_) { return []; }
  }
  function readChatLog() {
    if (!fs.existsSync(logFilePath)) return [];
    var raw = fs.readFileSync(logFilePath, 'utf-8');
    if (raw.trim().length === 0) return [];
    return raw.split('\n').filter(function (l) { return l.trim().length > 0; }).map(function (l) { return JSON.parse(l); });
  }

  // ==========================================================
  //  A. 类型 + 空值 /chat/session
  // ==========================================================

  describe('A. /chat/session type and empty rejection', function () {
    it('1. message=null → 400 INVALID_REQUEST', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 's1', message: null } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'INVALID_REQUEST');
      });
    });

    it('2. message=123 number → 400 INVALID_REQUEST', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 's1', message: 123 } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'INVALID_REQUEST');
      });
    });

    it('3. message=[] array → 400 INVALID_REQUEST', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 's1', message: ['hi'] } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'INVALID_REQUEST');
      });
    });

    it('4. message="" → 400 MESSAGE_EMPTY', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 's1', message: '' } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'MESSAGE_EMPTY');
      });
    });

    it('5. message="  " → 400 MESSAGE_EMPTY', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 's1', message: '   ' } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'MESSAGE_EMPTY');
      });
    });
  });

  // ==========================================================
  //  B. 长度边界 /chat/session
  // ==========================================================

  describe('B. /chat/session length boundaries', function () {
    it('6. message=2000 chars → 200 (or 500 no-api-key — validates format not AI result)', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sB6', message: 'x'.repeat(2000) } }).then(function (res) {
        // Will fail at API key check — but NOT at message validation. So 4xx not 400 MESSAGE_TOO_LONG.
        // With no API key it returns 500.
        assert.notStrictEqual(res.body.error, 'MESSAGE_TOO_LONG', '2000 chars must not be rejected');
      });
    });

    it('7. message=2001 chars → 400 MESSAGE_TOO_LONG', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sB7', message: 'x'.repeat(2001) } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'MESSAGE_TOO_LONG');
      });
    });

    it('8. 2001 Chinese chars → 400 MESSAGE_TOO_LONG', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sB8', message: '中'.repeat(2001) } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'MESSAGE_TOO_LONG');
      });
    });

    it('9. 1001 emoji → 400 MESSAGE_TOO_LONG (2002 code units)', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sB9', message: '😀'.repeat(1001) } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'MESSAGE_TOO_LONG');
      });
    });
  });

  // ==========================================================
  //  C. /chat/simple 同样合同
  // ==========================================================

  describe('C. /chat/simple same contract', function () {
    it('10. /chat/simple message="" → 400 MESSAGE_EMPTY', function () {
      return httpRequest('/chat/simple', { port: ctx.port, data: { message: '' } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'MESSAGE_EMPTY');
      });
    });

    it('11. /chat/simple message=2001 chars → 400 MESSAGE_TOO_LONG', function () {
      return httpRequest('/chat/simple', { port: ctx.port, data: { message: 'x'.repeat(2001) } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'MESSAGE_TOO_LONG');
      });
    });

    it('12. /chat/simple message=null → 400 INVALID_REQUEST', function () {
      return httpRequest('/chat/simple', { port: ctx.port, data: { message: null } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'INVALID_REQUEST');
      });
    });
  });

  // ==========================================================
  //  D. 超限时无副作用 — history/chat-log 未写入
  // ==========================================================

  describe('D. no side effects on rejection', function () {
    it('13. 2001 chars — history.json unchanged', function () {
      var before = readHistory().length;
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sD13', message: 'x'.repeat(2001) } }).then(function () {
        var after = readHistory().length;
        assert.strictEqual(after, before, 'history must not grow on rejection');
      });
    });

    it('14. 2001 chars — chat-log.jsonl unchanged', function () {
      var before = readChatLog().length;
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sD14', message: 'x'.repeat(2001) } }).then(function () {
        var after = readChatLog().length;
        assert.strictEqual(after, before, 'chat-log must not grow on rejection');
      });
    });

    it('15. AI provider not called when message rejected before API call', function () {
      // With no DEEPSEEK_API_KEY, a valid message would hit 500 "INTERNAL_ERROR" (from fetch failing)
      // or the missing-key check. But a rejected message should return 400 before ever reaching those.
      // This test verifies: 2001 chars → 400, not a 500 or API-key-related error.
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sD15', message: 'x'.repeat(2001) } }).then(function (res) {
        // 400 means validation caught it — not 500 INTERNAL_ERROR (which would mean it tried to call AI)
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'MESSAGE_TOO_LONG');
      });
    });
  });

  // ==========================================================
  //  E. Body 大小限制
  // ==========================================================

  describe('E. body size limits', function () {
    it('16. body > 100KB → 413 PAYLOAD_TOO_LARGE', function () {
      // Build a body over 100KB
      var bigMsg = 'x'.repeat(100 * 1024);
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sE16', message: bigMsg } }).then(function (res) {
        assert.strictEqual(res.status, 413);
        assert.strictEqual(res.body.error, 'PAYLOAD_TOO_LARGE');
      });
    });

    it('17. 413 response has no detail/stack', function () {
      var bigMsg = 'x'.repeat(100 * 1024);
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sE17', message: bigMsg } }).then(function (res) {
        assert.strictEqual(res.body.detail, undefined, '413 must not leak detail');
        assert.strictEqual(res.body.stack, undefined, '413 must not leak stack');
      });
    });
  });

  // ==========================================================
  //  F. Malformed JSON
  // ==========================================================

  describe('F. malformed JSON', function () {
    it('18. raw non-JSON body → 400 INVALID_JSON', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: '{broken', rawBody: true }).then(function (res) {
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'INVALID_JSON');
      });
    });

    it('19. 400 INVALID_JSON has no detail', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: '{broken', rawBody: true }).then(function (res) {
        assert.strictEqual(res.body.detail, undefined);
        assert.strictEqual(res.body._raw, undefined);
      });
    });
  });

  // ==========================================================
  //  G. 安全错误响应
  // ==========================================================

  describe('G. safe error responses', function () {
    it('20. error body has no detail field', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sG20', message: '' } }).then(function (res) {
        assert.strictEqual(res.body.detail, undefined);
      });
    });

    it('21. error body has no stack or err.message', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sG21', message: '' } }).then(function (res) {
        assert.strictEqual(res.body.stack, undefined);
        // The response should not contain raw error text
        var bodyStr = JSON.stringify(res.body);
        assert.strictEqual(bodyStr.indexOf('Error:') < 0, true, 'error body must not leak Error text');
      });
    });

    it('22. error body has no API key', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sG22', message: '' } }).then(function (res) {
        var bodyStr = JSON.stringify(res.body);
        assert.strictEqual(bodyStr.indexOf('sk-') < 0, true, 'error body must not leak API key');
      });
    });

    it('23. error body has no absolute file path', function () {
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sG23', message: '' } }).then(function (res) {
        var bodyStr = JSON.stringify(res.body);
        assert.strictEqual(bodyStr.indexOf('D:\\') < 0, true, 'must not leak Windows path');
        assert.strictEqual(bodyStr.indexOf('/home/') < 0, true, 'must not leak Linux path');
      });
    });
  });

  // ==========================================================
  //  H. 拒绝后下次合法请求仍可正常处理
  // ==========================================================

  describe('H. recovery after rejection', function () {
    it('24. valid request after rejection still works (no state corruption)', function () {
      // First: reject a message
      return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sH24', message: 'x'.repeat(2001) } }).then(function (res) {
        assert.strictEqual(res.status, 400);
        // Then: valid message (will fail at API key, but must pass validation)
        return httpRequest('/chat/session', { port: ctx.port, data: { sessionId: 'sH24', message: 'hello' } });
      }).then(function (res) {
        // Must not be MESSAGE_TOO_LONG — the rejection was for a different message
        assert.notStrictEqual(res.body.error, 'MESSAGE_TOO_LONG');
        assert.notStrictEqual(res.body.error, 'MESSAGE_EMPTY');
        assert.notStrictEqual(res.body.error, 'INVALID_REQUEST');
      });
    });
  });
});
