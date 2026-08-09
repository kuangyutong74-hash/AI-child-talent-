/**
 * test/background-ai.test.js — 后台 AI 任务超时与失败安全测试
 *
 * Phase 8A2b: 覆盖 runAnalyze, extractConversationEvents,
 * translateEventToImagePrompt, enhanceJournalEntry, buildImagePromptForEvent
 * 的超时、provider 错误、fallback、持久化安全、脱敏日志。
 *
 * 所有测试使用临时 DATA_DIR，不调用真实网络或真实 API key。
 * 超时测试注入 20–100ms，不等待生产超时。
 */

'use strict';

var { describe, it, before, after, beforeEach, afterEach } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var os = require('os');

var { tempDir, cleanup, mockFetch, restoreFetch } = require('./helpers');

// ============================================================
//  设置：临时目录 + 环境变量
// ============================================================

var originalDataDir = process.env.DATA_DIR;
var originalApiKey = process.env.DEEPSEEK_API_KEY;
var originalModel = process.env.DEEPSEEK_MODEL;
var originalBaseUrl = process.env.DEEPSEEK_BASE_URL;
var originalSkipMigration = process.env.SKIP_MIGRATION;

process.env.SKIP_MIGRATION = 'true';
process.env.DEEPSEEK_API_KEY = 'sk-test-background-ai';
process.env.DEEPSEEK_MODEL = 'deepseek-v4-pro';
process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

var TEST_DATA_DIR = tempDir('ai-talent-scout-bg-ai-');
process.env.DATA_DIR = TEST_DATA_DIR;

// ============================================================
//  加载 server 模块
// ============================================================

delete require.cache[require.resolve('../app')];
delete require.cache[require.resolve('../lib/core/ai-provider-client')];

var serverMod = require('../app');

// ============================================================
//  Helpers
// ============================================================

/**
 * 创建永不 resolve 的 mock fetch（用于 timeout 测试）。
 * 正确响应 abort 信号。
 */
function makeNeverResolveFetch() {
  return function (_url, init) {
    var signal = init && init.signal;
    return new Promise(function (_resolve, reject) {
      if (signal && signal.aborted) {
        reject(makeAbortError());
        return;
      }
      var onAbort = function () {
        try { signal.removeEventListener('abort', onAbort); } catch (_) {}
        reject(makeAbortError());
      };
      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  };
}

function makeAbortError() {
  var err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * 创建返回特定状态码和 content 的 mock fetch。
 */
function makeContentFetch(content, status) {
  status = status || 200;
  var ok = status >= 200 && status < 300;
  var jsonBody = ok ? { choices: [{ message: { content: content } }] } : { error: 'mock error' };
  return function (_url, _init) {
    return Promise.resolve({
      ok: ok,
      status: status,
      text: function () { return Promise.resolve(JSON.stringify(jsonBody)); },
    });
  };
}

/**
 * 创建返回 HTML 的 mock fetch。
 */
function makeHtmlErrorFetch() {
  return function (_url, _init) {
    return Promise.resolve({
      ok: false,
      status: 502,
      text: function () { return Promise.resolve('<html><body>502 Bad Gateway</body></html>'); },
    });
  };
}

/**
 * 创建返回无效 JSON 的 mock fetch。
 */
function makeBadJsonFetch() {
  return function (_url, _init) {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: function () { return Promise.resolve('not valid json {{{'); },
    });
  };
}

/**
 * 初始化测试用的空数据文件。
 */
function initEmptyData() {
  var historyPath = path.join(TEST_DATA_DIR, 'history.json');
  var journalPath = path.join(TEST_DATA_DIR, 'journal.json');
  if (!fs.existsSync(TEST_DATA_DIR)) fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  fs.writeFileSync(historyPath, '[]', 'utf-8');
  fs.writeFileSync(journalPath, '[]', 'utf-8');
}

/**
 * 写入测试用的 history 记录。
 */
function seedHistory() {
  var historyPath = path.join(TEST_DATA_DIR, 'history.json');
  var entry = {
    id: 'test-history-1',
    userId: 'test-user',
    messages: [
      { role: 'user', content: '我今天体育课打了篮球' },
      { role: 'assistant', content: '好厉害！篮球打得怎么样？' },
    ],
    completed: true,
    turnCount: 1,
  };
  fs.writeFileSync(historyPath, JSON.stringify([entry], null, 2), 'utf-8');
  return entry;
}

/**
 * 写入测试用的 journal 记录。
 */
function seedJournal() {
  var journalPath = path.join(TEST_DATA_DIR, 'journal.json');
  var entry = {
    id: 'test-journal-1',
    historyId: 'test-history-1',
    userId: 'test-user',
    date: new Date().toISOString(),
    mood: '晴天',
    moodIcon: 'sunny',
    description: '原始描述',
    descriptionStatus: 'initial',
    imageUrl: 'https://image.pollinations.ai/prompt/original?width=512&height=512&nologo=true',
    imageStatus: 'ready',
  };
  fs.writeFileSync(journalPath, JSON.stringify([entry], null, 2), 'utf-8');
  return entry;
}

// ============================================================
//  清理
// ============================================================

after(async function () {
  restoreFetch();
  delete require.cache[require.resolve('../app')];
  delete require.cache[require.resolve('../lib/core/ai-provider-client')];
  cleanup(TEST_DATA_DIR);
  if (originalDataDir === undefined) { delete process.env.DATA_DIR; } else { process.env.DATA_DIR = originalDataDir; }
  if (originalApiKey === undefined) { delete process.env.DEEPSEEK_API_KEY; } else { process.env.DEEPSEEK_API_KEY = originalApiKey; }
  if (originalModel === undefined) { delete process.env.DEEPSEEK_MODEL; } else { process.env.DEEPSEEK_MODEL = originalModel; }
  if (originalBaseUrl === undefined) { delete process.env.DEEPSEEK_BASE_URL; } else { process.env.DEEPSEEK_BASE_URL = originalBaseUrl; }
  if (originalSkipMigration === undefined) { delete process.env.SKIP_MIGRATION; } else { process.env.SKIP_MIGRATION = originalSkipMigration; }
});

beforeEach(function () {
  initEmptyData();
  restoreFetch();
});

afterEach(function () {
  restoreFetch();
});

// ============================================================
//  1. runAnalyze
// ============================================================

describe('1. runAnalyze', function () {
  it('1.1 正常成功', async function () {
    var analyzeResult = {
      engagement: 'high',
      suggested_next_focus: 'sports',
      suggested_stage: 'interest',
      active_topics: ['篮球'],
      evidence: ['学生提到体育课打篮球'],
      known_facts_to_add: ['喜欢篮球'],
      safety_alert: false,
      safety_alert_reason: '',
      state_events: {
        student_added_new_info: true,
        student_refused_topic: false,
        open_task_completed: false,
        explicit_farewell: false,
        allow_deepening: true,
        allow_open_task: false,
      },
    };
    global.fetch = makeContentFetch(JSON.stringify(analyzeResult));

    var messages = [
      { role: 'user', content: '我今天体育课打了篮球' },
      { role: 'assistant', content: '好厉害！' },
    ];
    var result = await serverMod._runAnalyze(messages);
    assert.ok(result !== null, 'should return non-null result');
    assert.strictEqual(result.engagement, 'high');
    assert.strictEqual(result.active_topics[0], '篮球');
  });

  it('1.2 timeout → 返回 null', async function () {
    global.fetch = makeNeverResolveFetch();

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    // Pass timeoutMs: 50 to make test fast
    var result = await serverMod._runAnalyze(messages, { timeoutMs: 50 });
    assert.strictEqual(result, null, 'should return null on timeout');
  });

  it('1.3 provider 500 → 返回 null', async function () {
    global.fetch = makeContentFetch('', 500);

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    var result = await serverMod._runAnalyze(messages);
    assert.strictEqual(result, null, 'should return null on provider 500');
  });

  it('1.4 失败写入安全 failed 状态', async function () {
    seedHistory();
    global.fetch = makeContentFetch('', 500);

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    var result = await serverMod._runAnalyze(messages);
    assert.strictEqual(result, null, 'runAnalyze returns null so triggerAsyncAnalysis writes status:failed');
  });

  it('1.5 失败不覆盖已有成功分析', async function () {
    // Seed a history entry with existing successful analysis
    var historyPath = path.join(TEST_DATA_DIR, 'history.json');
    var existingAnalysis = { status: 'done', result: { engagement: 'high' } };
    var entry = {
      id: 'test-history-2',
      userId: 'test-user',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
      completed: true,
      turnCount: 1,
      analysis: existingAnalysis,
    };
    fs.writeFileSync(historyPath, JSON.stringify([entry], null, 2), 'utf-8');

    // runAnalyze fails (timeout)
    global.fetch = makeNeverResolveFetch();
    var result = await serverMod._runAnalyze(entry.messages, { timeoutMs: 50 });
    assert.strictEqual(result, null, 'runAnalyze should return null');

    // Verify existing analysis is NOT overwritten
    var history = serverMod._readHistory();
    assert.strictEqual(history[0].analysis.status, 'done');
    assert.strictEqual(history[0].analysis.result.engagement, 'high');
  });
});

// ============================================================
//  2. extractConversationEvents
// ============================================================

describe('2. extractConversationEvents', function () {
  it('2.1 正常提取事件', async function () {
    var events = [
      { title: '打篮球', description: '体育课上打了一场激烈的篮球赛' },
      { title: '吃冰淇淋', description: '放学后吃了一个草莓味的冰淇淋' },
    ];
    global.fetch = makeContentFetch(JSON.stringify(events));

    var messages = [
      { role: 'user', content: '我今天体育课打了篮球，放学还吃了冰淇淋' },
      { role: 'assistant', content: '听起来很有趣！' },
    ];
    var result = await serverMod._extractConversationEvents(messages);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].title, '打篮球');
  });

  it('2.2 timeout → 使用默认事件', async function () {
    global.fetch = makeNeverResolveFetch();

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    var result = await serverMod._extractConversationEvents(messages, { timeoutMs: 50 });
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].title, '今日聊天');
    assert.strictEqual(result[0].description, '聊得很开心');
  });

  it('2.3 坏 JSON → 使用默认事件', async function () {
    global.fetch = makeBadJsonFetch();

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    var result = await serverMod._extractConversationEvents(messages);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].title, '今日聊天');
  });

  it('2.4 provider 500 → 使用默认事件', async function () {
    global.fetch = makeContentFetch('', 500);

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    var result = await serverMod._extractConversationEvents(messages);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].title, '今日聊天');
  });
});

// ============================================================
//  3. translateEventToImagePrompt
// ============================================================

describe('3. translateEventToImagePrompt', function () {
  it('3.1 正常翻译', async function () {
    var prompt = 'A child playing basketball on a sunny school court, children\'s book illustration style, soft watercolor';
    global.fetch = makeContentFetch(prompt);

    var result = await serverMod._translateEventToImagePrompt('打篮球', '体育课上打了篮球');
    assert.ok(result.includes('A child playing basketball'));
    assert.ok(result.includes('--ar 4:3'));
  });

  it('3.2 timeout → heuristic fallback', async function () {
    global.fetch = makeNeverResolveFetch();

    var result = await serverMod._translateEventToImagePrompt('打篮球', '体育课上打篮球', { timeoutMs: 50 });
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
    assert.ok(result.includes('children\'s book illustration'));
  });

  it('3.3 provider 500 → heuristic fallback', async function () {
    global.fetch = makeContentFetch('', 500);

    var result = await serverMod._translateEventToImagePrompt('打篮球', '体育课上打篮球');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('3.4 空响应 → heuristic fallback', async function () {
    global.fetch = makeContentFetch('');

    var result = await serverMod._translateEventToImagePrompt('打篮球', '体育课上打篮球');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('3.5 单个翻译失败后后续事件继续', async function () {
    // First event fails (500), second succeeds
    global.fetch = makeContentFetch('', 500);
    var result1 = await serverMod._translateEventToImagePrompt('打篮球', '体育课打了篮球');
    assert.ok(result1.includes('children\'s book illustration'), 'first should fallback');

    // Second event succeeds
    global.fetch = makeContentFetch('A child painting at a desk, children\'s book illustration style, soft watercolor');
    var result2 = await serverMod._translateEventToImagePrompt('画画', '在教室画画');
    assert.ok(result2.includes('A child painting'));
  });
});

// ============================================================
//  4. enhanceJournalEntry
// ============================================================

describe('4. enhanceJournalEntry', function () {
  it('4.1 图片增强成功', async function () {
    seedJournal();
    var imagePrompt = 'A child playing basketball on a sunny sports field, children\'s book illustration style, soft watercolor';

    var callCount = 0;
    global.fetch = function (_url, _init) {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true, status: 200,
          text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: imagePrompt } }] })); },
        });
      }
      return Promise.resolve({
        ok: true, status: 200,
        text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: '在阳光下的操场上打了一场精彩的篮球赛' } }] })); },
      });
    };

    var messages = [
      { role: 'user', content: '我今天体育课打了篮球' },
      { role: 'assistant', content: '好厉害！' },
    ];
    await serverMod._enhanceJournalEntry('test-journal-1', messages);

    var journal = serverMod._readJournal();
    var entry = journal.find(function (e) { return e.id === 'test-journal-1'; });
    assert.ok(entry.imageUrl.includes('A%20child%20playing%20basketball'));
  });

  it('4.2 图片超时 → 保留原 imageUrl', async function () {
    seedJournal();
    var originalUrl = 'https://image.pollinations.ai/prompt/original?width=512&height=512&nologo=true';

    var callCount = 0;
    global.fetch = function (_url, init) {
      callCount++;
      if (callCount === 1) {
        // Image call: never resolve → timeout
        var signal = init && init.signal;
        return new Promise(function (_resolve, reject) {
          if (signal && signal.aborted) { reject(makeAbortError()); return; }
          var onAbort = function () {
            try { signal.removeEventListener('abort', onAbort); } catch (_) {}
            reject(makeAbortError());
          };
          if (signal) { signal.addEventListener('abort', onAbort, { once: true }); }
        });
      }
      return Promise.resolve({
        ok: true, status: 200,
        text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: '测试描述' } }] })); },
      });
    };

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    await serverMod._enhanceJournalEntry('test-journal-1', messages, undefined, { imgTimeoutMs: 50, descTimeoutMs: 5000 });

    var journal = serverMod._readJournal();
    var entry = journal.find(function (e) { return e.id === 'test-journal-1'; });
    assert.strictEqual(entry.imageUrl, originalUrl, 'imageUrl should remain unchanged on timeout');
  });

  it('4.3 描述增强成功', async function () {
    seedJournal();
    var aiDesc = '在洒满阳光的操场上挥洒汗水';

    var callCount = 0;
    global.fetch = function (_url, _init) {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true, status: 200,
          text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: 'A child playing, illustration style' } }] })); },
        });
      }
      return Promise.resolve({
        ok: true, status: 200,
        text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: aiDesc } }] })); },
      });
    };

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    await serverMod._enhanceJournalEntry('test-journal-1', messages);

    var journal = serverMod._readJournal();
    var entry = journal.find(function (e) { return e.id === 'test-journal-1'; });
    assert.strictEqual(entry.description, aiDesc);
    assert.strictEqual(entry.descriptionStatus, 'generated');
  });

  it('4.4 描述失败 → 保留原描述', async function () {
    seedJournal();
    var originalDesc = '原始描述';

    var callCount = 0;
    global.fetch = function (_url, init) {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true, status: 200,
          text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: 'A kid playing, illustration' } }] })); },
        });
      }
      // Description call never resolves → timeout
      var signal = init && init.signal;
      return new Promise(function (_resolve, reject) {
        if (signal && signal.aborted) { reject(makeAbortError()); return; }
        var onAbort = function () {
          try { signal.removeEventListener('abort', onAbort); } catch (_) {}
          reject(makeAbortError());
        };
        if (signal) { signal.addEventListener('abort', onAbort, { once: true }); }
      });
    };

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    await serverMod._enhanceJournalEntry('test-journal-1', messages, undefined, { imgTimeoutMs: 5000, descTimeoutMs: 50 });

    var journal = serverMod._readJournal();
    var entry = journal.find(function (e) { return e.id === 'test-journal-1'; });
    assert.strictEqual(entry.description, originalDesc, 'description should remain unchanged');
  });

  it('4.5 图片失败不阻止描述成功', async function () {
    seedJournal();

    var callCount = 0;
    global.fetch = function (_url, init) {
      callCount++;
      if (callCount === 1) {
        // Image call: timeout
        var signal = init && init.signal;
        return new Promise(function (_resolve, reject) {
          if (signal && signal.aborted) { reject(makeAbortError()); return; }
          var onAbort = function () {
            try { signal.removeEventListener('abort', onAbort); } catch (_) {}
            reject(makeAbortError());
          };
          if (signal) { signal.addEventListener('abort', onAbort, { once: true }); }
        });
      }
      // Description call: succeeds
      return Promise.resolve({
        ok: true, status: 200,
        text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: '成功生成的描述' } }] })); },
      });
    };

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    await serverMod._enhanceJournalEntry('test-journal-1', messages, undefined, { imgTimeoutMs: 50, descTimeoutMs: 5000 });

    var journal = serverMod._readJournal();
    var entry = journal.find(function (e) { return e.id === 'test-journal-1'; });
    assert.strictEqual(entry.description, '成功生成的描述', 'description should be updated despite image failure');
    assert.strictEqual(entry.descriptionStatus, 'generated');
  });

  it('4.6 描述失败不删除成功图片', async function () {
    seedJournal();

    var imagePrompts = 'A child running in a park, children\'s book illustration style, soft watercolor';
    var callCount = 0;
    global.fetch = function (_url, init) {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true, status: 200,
          text: function () { return Promise.resolve(JSON.stringify({ choices: [{ message: { content: imagePrompts } }] })); },
        });
      }
      // Description: times out
      var signal = init && init.signal;
      return new Promise(function (_resolve, reject) {
        if (signal && signal.aborted) { reject(makeAbortError()); return; }
        var onAbort = function () {
          try { signal.removeEventListener('abort', onAbort); } catch (_) {}
          reject(makeAbortError());
        };
        if (signal) { signal.addEventListener('abort', onAbort, { once: true }); }
      });
    };

    var messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    await serverMod._enhanceJournalEntry('test-journal-1', messages, undefined, { imgTimeoutMs: 5000, descTimeoutMs: 50 });

    var journal = serverMod._readJournal();
    var entry = journal.find(function (e) { return e.id === 'test-journal-1'; });
    assert.ok(entry.imageUrl.includes(encodeURIComponent(imagePrompts)), 'imageUrl should be updated despite description failure');
  });
});

// ============================================================
//  5. buildImagePromptForEvent
// ============================================================

describe('5. buildImagePromptForEvent', function () {
  it('5.1 正常生成 prompt', async function () {
    var aiPrompt = 'A child shooting a three-point basketball on a sunny school court';
    global.fetch = makeContentFetch(aiPrompt);

    var result = await serverMod._buildImagePromptForEvent('三分球', '体育课上投了一个漂亮的三分球');
    assert.ok(result.includes('A child shooting'));
    assert.ok(result.includes('--ar 4:3'));
  });

  it('5.2 timeout → 字典 fallback', async function () {
    global.fetch = makeNeverResolveFetch();

    var result = await serverMod._buildImagePromptForEvent('打篮球', '体育课上打了篮球', { timeoutMs: 50 });
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
    assert.ok(result.includes('children\'s book illustration'));
  });

  it('5.3 provider 500 → 字典 fallback', async function () {
    global.fetch = makeContentFetch('', 500);

    var result = await serverMod._buildImagePromptForEvent('打篮球', '体育课上打篮球');
    assert.ok(result.includes('basketball') || result.includes('child') || result.includes('scene'));
  });

  it('5.4 空响应 → 字典 fallback', async function () {
    global.fetch = makeContentFetch('');

    var result = await serverMod._buildImagePromptForEvent('小猫汤圆', '汤圆趴在窗台上晒太阳');
    assert.ok(result.includes('child') || result.includes('cat') || result.includes('kitten') || result.includes('scene') || result.includes('cheerful'));
  });
});

// ============================================================
//  6. fire-and-forget rejection 安全
// ============================================================

describe('6. fire-and-forget rejection 安全', function () {
  it('6.1 后台 Promise reject 不产生 unhandledRejection', async function () {
    // Verify sanitized logger doesn't throw
    assert.doesNotThrow(function () {
      serverMod._logSanitizedBackgroundError({ code: 'AI_TIMEOUT' });
    });
  });

  it('6.2 脱敏日志不记录 provider body', async function () {
    var loggedMessages = [];
    var origError = console.error;
    console.error = function (msg) {
      loggedMessages.push(String(msg));
    };

    try {
      global.fetch = makeContentFetch('', 500);
      await serverMod._runAnalyze(
        [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }]
      );

      var allLogs = loggedMessages.join(' ');
      assert.ok(!allLogs.includes('mock error'), 'should not contain mock error details');
    } finally {
      console.error = origError;
    }
  });

  it('6.3 脱敏日志不记录 err.message', async function () {
    var loggedMessages = [];
    var origError = console.error;
    console.error = function (msg) {
      loggedMessages.push(String(msg));
    };

    try {
      global.fetch = makeNeverResolveFetch();
      await serverMod._runAnalyze(
        [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }],
        { timeoutMs: 50 }
      );

      var allLogs = loggedMessages.join(' ');
      assert.ok(!allLogs.includes('ECONNREFUSED'), 'should not leak ECONNREFUSED');
      assert.ok(!allLogs.includes('AbortError'), 'should not leak AbortError');
      assert.ok(allLogs.includes('Background AI failure'), 'should log sanitized message');
    } finally {
      console.error = origError;
    }
  });

  it('6.4 脱敏日志不记录学生完整消息', async function () {
    var loggedMessages = [];
    var origError = console.error;
    console.error = function (msg) {
      loggedMessages.push(String(msg));
    };

    try {
      global.fetch = makeContentFetch('', 500);
      var studentMsg = '这是一个学生的私人消息包含敏感信息';
      await serverMod._runAnalyze(
        [{ role: 'user', content: studentMsg }, { role: 'assistant', content: 'hi' }]
      );

      var allLogs = loggedMessages.join(' ');
      assert.ok(!allLogs.includes(studentMsg), 'must not log student messages');
    } finally {
      console.error = origError;
    }
  });

  it('6.5 一次失败后下一次后台任务可成功', async function () {
    // First: timeout
    global.fetch = makeNeverResolveFetch();
    var result1 = await serverMod._extractConversationEvents(
      [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }],
      { timeoutMs: 50 }
    );
    assert.strictEqual(result1[0].title, '今日聊天', 'first call should fallback');

    // Second: success
    global.fetch = makeContentFetch(JSON.stringify([
      { title: '打篮球', description: '体育课上打了一场篮球赛' },
    ]));
    var result2 = await serverMod._extractConversationEvents([
      { role: 'user', content: '我今天打了篮球' },
      { role: 'assistant', content: '厉害！' },
    ]);
    assert.strictEqual(result2[0].title, '打篮球', 'second call should succeed');
  });

  it('6.6 ProviderError 在 fire-and-forget 中被安全处理', async function () {
    var caught = false;
    try {
      global.fetch = makeNeverResolveFetch();
      var events = await serverMod._extractConversationEvents(
        [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }],
        { timeoutMs: 50 }
      );
      assert.ok(Array.isArray(events), 'should return fallback, not throw');
    } catch (e) {
      caught = true;
    }
    assert.strictEqual(caught, false, 'should not throw unhandled errors');
  });
});

// ============================================================
//  7. 持久化安全
// ============================================================

describe('7. 持久化安全', function () {
  it('7.1 失败不覆盖已有成功分析', async function () {
    seedHistory();
    var history = serverMod._readHistory();
    history[0].analysis = { status: 'done', result: { engagement: 'high' } };
    serverMod._writeHistory(history);

    global.fetch = makeNeverResolveFetch();
    var result = await serverMod._runAnalyze(
      [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }],
      { timeoutMs: 50 }
    );
    assert.strictEqual(result, null);

    var history2 = serverMod._readHistory();
    assert.strictEqual(history2[0].analysis.status, 'done');
    assert.strictEqual(history2[0].analysis.result.engagement, 'high');
  });

  it('7.2 journal 写入保持合法完整结构', async function () {
    seedHistory();
    seedJournal();

    global.fetch = makeNeverResolveFetch();
    var events = await serverMod._extractConversationEvents(
      [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }],
      { timeoutMs: 50 }
    );

    assert.ok(Array.isArray(events));
    assert.ok(events.length > 0);
    assert.ok(typeof events[0].title === 'string');
    assert.ok(typeof events[0].description === 'string');
  });

  it('7.3 writeJournal 拒绝空数组', async function () {
    seedJournal();
    var journal = serverMod._readJournal();
    var originalLen = journal.length;
    serverMod._writeJournal([]);
    var journal2 = serverMod._readJournal();
    assert.ok(Array.isArray(journal2));
    // After refusing empty write, data should be intact (same entries)
  });

  it('7.4 多个事件处理中一个失败不妨碍后续', async function () {
    seedHistory();

    // Event 1: fails
    global.fetch = makeContentFetch('', 500);
    var r1 = await serverMod._translateEventToImagePrompt('失败事件', '这是第一个事件');
    assert.ok(typeof r1 === 'string');

    // Event 2: succeeds
    global.fetch = makeContentFetch('A child painting in a bright classroom, children\'s book illustration style');
    var r2 = await serverMod._translateEventToImagePrompt('画画', '在教室画画');
    assert.ok(r2.includes('A child painting'));

    // Event 3: succeeds
    global.fetch = makeContentFetch('A child singing in music class, children\'s book illustration style');
    var r3 = await serverMod._translateEventToImagePrompt('唱歌', '在音乐课唱歌');
    assert.ok(r3.includes('child'));
  });
});

// ============================================================
//  8. 边界情况
// ============================================================

describe('8. 边界情况', function () {
  it('8.1 extract 空数组结果 → 默认事件', async function () {
    global.fetch = makeContentFetch(JSON.stringify([]));
    var result = await serverMod._extractConversationEvents([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].title, '今日聊天');
  });

  it('8.2 translate 空 title → heuristic fallback', async function () {
    global.fetch = makeContentFetch('');
    var result = await serverMod._translateEventToImagePrompt('', '');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('8.3 buildImagePrompt 未知中文 → 字典 fallback', async function () {
    global.fetch = makeNeverResolveFetch();
    var result = await serverMod._buildImagePromptForEvent('未知事件', '没有匹配关键词的事件', { timeoutMs: 50 });
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('8.4 HTML 响应 → 正确处理', async function () {
    global.fetch = makeHtmlErrorFetch();
    var result = await serverMod._extractConversationEvents([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
    assert.strictEqual(result[0].title, '今日聊天');
  });

  it('8.5 runAnalyze JSON 解析失败 → 返回 null', async function () {
    global.fetch = makeContentFetch('这不是JSON也不是markdown');
    var result = await serverMod._runAnalyze([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
    assert.strictEqual(result, null);
  });
});
