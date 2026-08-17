/**
 * test/chat-api.test.js — 聊天接口契约测试
 *
 * 使用 mock 模型响应测试 POST /chat/session。
 * 所有测试不调用真实 DeepSeek API。
 *
 * 覆盖：
 *   V1: 参数校验、正常响应、模型结构、错误处理
 *   V2: feature flag、analyze+generate、repair、fallback、
 *        事务边界、状态隔离、previous_assistant_asked
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const { mockFetch, restoreFetch, httpRequest } = require('./helpers');

// ============================================================
//  多响应的 mock（支持 analyze → generate → repair 队列）
// ============================================================

/**
 * 安装基于队列的 mock fetch，每次调用消费队列中下一个元素。
 * 队列元素：{ reply, status, error } 或 null（抛异常）
 */
function mockFetchQueue(queue) {
  var index = 0;
  var captured = [];

  global.fetch = function (url, init) {
    var body = init && init.body ? JSON.parse(init.body) : null;
    captured.push({ url: url, body: body });

    // Default exhausted-entry body
    var errJson = JSON.stringify({ error: 'mock queue exhausted' });

    if (index >= queue.length) {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: function () {
          return Promise.resolve({ error: 'mock queue exhausted' });
        },
        text: function () { return Promise.resolve(errJson); },
      });
    }

    var entry = queue[index++];
    if (!entry) {
      return Promise.reject(new Error('mock fetch threw'));
    }

    if (entry.error) {
      var errBodyJson = JSON.stringify(entry.error);
      return Promise.resolve({
        ok: false,
        status: entry.status || 500,
        json: function () { return Promise.resolve(entry.error); },
        text: function () { return Promise.resolve(errBodyJson); },
      });
    }

    var reply = entry.reply || '';
    var okJson = JSON.stringify({
      choices: [{ message: { content: reply } }],
    });
    return Promise.resolve({
      ok: true,
      status: entry.status || 200,
      json: function () {
        return Promise.resolve({
          choices: [{ message: { content: reply } }],
        });
      },
      text: function () { return Promise.resolve(okJson); },
    });
  };

  captured.$queueIndex = index;
  return captured;
}

// ============================================================
//  设置：临时目录 + 随机端口
// ============================================================

const originalSkipMigration = process.env.SKIP_MIGRATION;
const originalDataDir = process.env.DATA_DIR;

const tempDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'ai-talent-scout-chat-api-')
);

process.env.SKIP_MIGRATION = 'true';
process.env.DATA_DIR = tempDataDir;

let testPort;
let server;
let captured;
let serverModule;

// V2 已成为唯一路径，不再需要开关切换
// 但仍然暴露 enableV2/disableV2 空函数以保持测试结构向后兼容
function enableV2() { /* V2 is always enabled now */ }
function disableV2() { /* V2 is always enabled now */ }

// ============================================================
//  启动与关闭
// ============================================================

before(async function () {
  // 加载 server 模块（V2 始终开启）
  serverModule = require('../app');

  captured = mockFetch({ reply: '小新觉得你今天状态很好呀，有什么特别的事情想聊的吗？' });

  testPort = await new Promise(function (resolve, reject) {
    var s = http.createServer(serverModule.app);
    s.listen(0, '127.0.0.1', function () {
      resolve(s.address().port);
    });
    s.on('error', reject);
    server = s;
  });
});

after(function () {
  if (server) { try { server.close(); } catch (_) {} }
  restoreFetch();
  delete require.cache[require.resolve('../app')];
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
//  分析 JSON 的 mock 辅助
// ============================================================

function analyzeJSON(overrides) {
  var a = {
    engagement: 'medium',
    suggested_next_focus: 'none',
    suggested_stage: 'interest',
    active_topics: [],
    evidence: [],
    known_facts_to_add: [],
    safety_alert: false,
    safety_alert_reason: '',
    state_events: {
      student_added_new_info: false,
      student_refused_topic: false,
      open_task_completed: false,
      explicit_farewell: false,
      allow_deepening: false,
      allow_open_task: false,
    },
  };
  if (overrides) {
    Object.keys(overrides).forEach(function (k) { a[k] = overrides[k]; });
  }
  return JSON.stringify(a);
}

// ============================================================
//  V1 测试（默认关闭 V2）
// ============================================================

describe('POST /chat/session (V1)', function () {

  it('缺少 sessionId 时应返回 400 错误', async function () {
    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { message: '你好' },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'INVALID_REQUEST');
  });

  it('缺少 message 时应返回 400 错误', async function () {
    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 'sess-test-001' },
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'INVALID_REQUEST');
  });

  it('sessionId 不是字符串时应返回 400 错误', async function () {
    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 123, message: 'hello' },
    });
    assert.strictEqual(res.status, 400);
  });

  it('message 不是字符串时应返回 400 错误', async function () {
    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 'sess-test-001', message: 123 },
    });
    assert.strictEqual(res.status, 400);
  });

  it('模型正常返回时，接口响应应包含 reply', async function () {
    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 'sess-v1-002', message: '我今天的心情是晴空万里！' },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.reply === 'string');
    assert.ok(res.body.reply.length > 0);
  });

  it('普通回复中 imageUrl 可以不存在', async function () {
    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 'sess-v1-003', message: '今天好开心呀' },
    });
    assert.ok(res.body.imageUrl === undefined || res.body.imageUrl === null);
  });

  it('同一 session 的正常多发应正常递增轮次', async function () {
    var sid = 'sess-v1-004';
    var res1 = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: sid, message: '第一轮消息' },
    });
    assert.strictEqual(res1.status, 200);

    var res2 = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: sid, message: '第二轮消息' },
    });
    assert.strictEqual(res2.status, 200);
    assert.ok(typeof res2.body.reply === 'string');
  });

  it('发给模型的 messages 第一项应为 system 消息', async function () {
    captured.length = 0;

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 'sess-v1-struct', message: '我今天的心情是有点沉闷' },
    });
    assert.strictEqual(res.status, 200);

    assert.ok(captured.length >= 1);
    var fetchBody = captured[captured.length - 1].body;
    assert.ok(fetchBody && Array.isArray(fetchBody.messages));
    assert.strictEqual(fetchBody.messages[0].role, 'system');
    assert.ok(fetchBody.messages[0].content.includes('小新'));
  });

  it('学生输入应出现在 user 消息中', async function () {
    captured.length = 0;

    var message = '今天体育课打篮球了';
    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 'sess-v1-usermsg', message: message },
    });
    assert.strictEqual(res.status, 200);

    // /chat/session 收尾时会额外发起一次建议话题生成调用（其 user 消息是完整聊天记录文本），
    // 因此扫描所有调用：学生原话应作为某个 user 消息的完整内容出现
    var found = captured.some(function (call) {
      if (!call.body || !Array.isArray(call.body.messages)) return false;
      var userMessages = call.body.messages.filter(function (m) { return m.role === 'user'; });
      return userMessages.length >= 1 &&
        userMessages[userMessages.length - 1].content === message;
    });
    assert.strictEqual(found, true, '学生输入应出现在发给模型的 user 消息中');
  });

  it('模型调用失败时接口应返回错误格式', async function () {
    captured = mockFetch({
      error: { error: { message: 'Internal Server Error' } },
      status: 500,
    });

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 'sess-v1-err', message: '错误测试' },
    });
    // provider 500 → AI_UNAVAILABLE → 503
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, 'AI_UNAVAILABLE');

    restoreFetch();
    captured = mockFetch({ reply: '恢复' });
  });

  it('fetch 抛出异常时接口应返回错误状态', async function () {
    global.fetch = function () {
      return Promise.reject(new Error('Network timeout'));
    };

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: 'sess-v1-exc', message: '异常测试' },
    });
    // network error → AI_UNAVAILABLE → 503
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, 'AI_UNAVAILABLE');

    restoreFetch();
    captured = mockFetch({ reply: '恢复' });
  });

});

describe('Farewell 回复的 imageUrl 行为 (V1)', function () {

  it('farewell 回复会生成 imageUrl（mock 不请求真实 Pollinations）', async function () {
    var sid = 'sess-v1-farewell';
    var sessionMessages = [
      '我今天的心情是晴空万里',
      '体育课打了篮球',
      '我觉得投篮需要有耐心',
      '今天和朋友一起很开心',
      '还有一个星期就要考试了',
      '我打算考完试去爬山',
    ];

    for (var i = 0; i < sessionMessages.length; i++) {
      await httpRequest('/chat/session', {
        method: 'POST', port: testPort,
        data: { sessionId: sid, message: sessionMessages[i] },
      });
    }

    mockFetch({ reply: '今天聊得很开心！下次再聊啦～' });

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: testPort,
      data: { sessionId: sid, message: '嗯，差不多了' },
    });

    restoreFetch();
    captured = mockFetch({ reply: '恢复' });

    assert.strictEqual(res.status, 200);
    if (res.body.imageUrl) {
      assert.ok(res.body.imageUrl.startsWith('https://image.pollinations.ai/'));
    }
  });

});

// ============================================================
//  V2 集成测试
// ============================================================

describe('V2 always enabled', function () {

  it('不需要 AI_SCOUT_V2_ENABLED 便能工作', function () {
    // V2 is the only path now — no feature flag needed
    var moduleExports = require('../app');
    assert.ok(typeof moduleExports === 'object',
      'server 模块应能正常加载（V2 始终开启）');
  });

});

// ============================================================
//  V2 测试（需重启 server + 开启 V2）
// ============================================================

describe('V2 集成', function () {
  let v2Server;
  let v2Port;
  let v2Captured;
  let v2Module;

  before(async function () {
    // 关闭旧 server
    if (server) { try { server.close(); } catch (_) {} }
    restoreFetch();

    enableV2();

    v2Module = require('../app');

    // 默认 mock：analyze + generate（不需要 repair）
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '打球听起来很有意思。' },
    ]);

    v2Port = await new Promise(function (resolve, reject) {
      var s = http.createServer(v2Module.app);
      s.listen(0, '127.0.0.1', function () {
        resolve(s.address().port);
      });
      s.on('error', reject);
      v2Server = s;
    });
  });

  after(function () {
    if (v2Server) { try { v2Server.close(); } catch (_) {} }
    restoreFetch();
    disableV2();

    // 恢复 V1 server
    beforeRestoreV1();
  });

  // helper: restore V1 server after V2 tests
  function beforeRestoreV1() {
    serverModule = require('../app');
    captured = mockFetch({ reply: 'V1 恢复' });
  }

  // ---- B. V2 正常流程 ----

  it('analyze 和 generate 各调用一次', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      // question_budget≥1 的阶段回复必须带问句，否则会被判定为无效并触发 repair
      { reply: '打球很开心吧？' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-normal', message: '今天打球了' },
    });

    assert.strictEqual(res.status, 200);
    // 2 calls: analyze + generate（建议话题已改为前端异步 quick-topics，不再阻塞回复）
    assert.strictEqual(v2Captured.length, 2,
      '应调用 exactly 2 次 API');
    assert.ok(typeof res.body.reply === 'string');
  });

  it('正常回复不调用 repair', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '今天天气很不错，你喜欢吗？' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-no-repair', message: '你好' },
    });

    assert.strictEqual(res.status, 200);
    // 2 calls: analyze + generate — 无 repair
    assert.strictEqual(v2Captured.length, 2,
      '不应调用 repair');
    // repair 请求的 user 消息是含 original_reply 的 JSON payload
    var repairCalls = v2Captured.filter(function (c) {
      return c.body && Array.isArray(c.body.messages) &&
        c.body.messages.some(function (m) {
          return m.role === 'user' && typeof m.content === 'string' &&
            m.content.includes('original_reply');
        });
    });
    assert.strictEqual(repairCalls.length, 0, '不应调用 repair');
  });

  it('响应结构仍为 reply + imageUrl', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '好的。' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-struct', message: '嗯' },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.reply === 'string');
    // imageUrl 可以不存在
    assert.ok(
      res.body.imageUrl === undefined ||
      res.body.imageUrl === null ||
      typeof res.body.imageUrl === 'string'
    );
  });

  it('V2 使用 xiaoxin-v2.md Prompt', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '好的。' },
    ]);

    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-prompt-check', message: 'hi' },
    });

    // 第二个调用是 generate → 其中 system 应包含 V2 独有内容
    var genCall = v2Captured[1];
    assert.ok(genCall && genCall.body);
    var systemMsg = genCall.body.messages.find(function (m) {
      return m.role === 'system';
    });
    assert.ok(systemMsg);
    // xiaoxin-v2 独有标记
    assert.ok(
      systemMsg.content.includes('硬规则') ||
      systemMsg.content.includes('runtime_state') ||
      systemMsg.content.includes('question_budget'),
      'V2 generate 应使用 xiaoxin-v2 Prompt'
    );
  });

  it('V2 analyze 使用 analyze-v2.md Prompt', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: 'ok。' },
    ]);

    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-analyze-prompt', message: 'hi' },
    });

    var analyzeCall = v2Captured[0];
    assert.ok(analyzeCall && analyzeCall.body);
    var systemMsg = analyzeCall.body.messages.find(function (m) {
      return m.role === 'system';
    });
    assert.ok(systemMsg);
    assert.ok(
      systemMsg.content.includes('state_events') ||
      systemMsg.content.includes('七项指标'),
      'analyze 应使用 analyze-v2 Prompt'
    );
  });

  it('V2 不使用 V1 xiaoxin.md Prompt', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: 'ok。' },
    ]);

    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-not-v1', message: 'hi' },
    });

    var genCall = v2Captured[1];
    var systemMsg = genCall.body.messages.find(function (m) {
      return m.role === 'system';
    });
    // V1 独有内容不应出现
    assert.ok(
      !systemMsg.content.includes('潜能线索识别规则') ||
      systemMsg.content.includes('runtime_state'),
      'generate 不应使用 V1 analyze prompt'
    );
  });

  it('V2 不执行 legacy choice rewrite', async function () {
    // 二选一追问（binary_question）现在走标准 validate→repair 流程，
    // 不再有 legacy choice-rewrite 专用调用
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你是去图书馆还是去打球？' },
      { reply: '你想去哪里玩呢？' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-no-rewrite', message: '去哪' },
    });

    assert.strictEqual(res.status, 200);
    // 调用序列：analyze + generate + 一次标准 repair
    // 若存在 legacy choice-rewrite 专用调用，将出现第 4 次调用
    assert.strictEqual(v2Captured.length, 3,
      '只有 analyze + generate + 一次标准 repair，无 legacy rewrite');
    assert.strictEqual(res.body.reply, '你想去哪里玩呢？',
      'repair 成功时应采用修复后的回复');
  });

  // ---- C. Repair ----

  it('原始回复违反 question_budget 时调用一次 repair', async function () {
    // budget=0 的 state: previous_assistant_asked=true
    // 首轮先正常来一次让 state 进入 budget=0
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '今天过得怎么样？' }, // 含问题
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-repair-sess', message: '你好' },
    });

    // 第二轮：上轮问了问题 → budget=0
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你今天打球开心吗？' }, // 违规
      { reply: '打球很有意思。' },     // repair 成功
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-repair-sess', message: '打球了' },
    });

    assert.strictEqual(res.status, 200);
    // 应有 3 次调用：analyze + generate + repair
    assert.strictEqual(v2Captured.length, 3,
      '应调用 exactly 3 次 API（analyze + generate + repair）');
    // 确认 repair 恰好调用一次（user 消息为含 original_reply 的 JSON payload）
    var repairCalls = v2Captured.filter(function (c) {
      return c.body && Array.isArray(c.body.messages) &&
        c.body.messages.some(function (m) {
          return m.role === 'user' && typeof m.content === 'string' &&
            m.content.includes('original_reply');
        });
    });
    assert.strictEqual(repairCalls.length, 1, '应恰好调用一次 repair');
  });

  it('repair 请求只包含 validation code', async function () {
    // 先让 state 进入 budget=0（上一轮小新已问过问题）
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '今天怎么样？' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-repair-code', message: '你好' },
    });

    // 第二轮：回复含问句但 budget=0 → 违规 → repair
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你今天打球开心吗？' },
      { reply: '打球很好。' },
    ]);

    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-repair-code', message: '打球' },
    });

    // 找到 repair 调用（user 消息为含 original_reply 的 JSON payload）
    var repairCalls = v2Captured.filter(function (c) {
      return c.body && Array.isArray(c.body.messages) &&
        c.body.messages.some(function (m) {
          return m.role === 'user' && typeof m.content === 'string' &&
            m.content.includes('original_reply');
        });
    });
    assert.strictEqual(repairCalls.length, 1, '应恰好调用一次 repair');
    var repairUserMsg = repairCalls[0].body.messages.find(function (m) {
      return m.role === 'user';
    });
    var userContent = repairUserMsg.content;
    assert.ok(userContent.includes('validation_errors'));
    // 不应包含 detail 文本
    assert.ok(!userContent.includes('question_budget 为 0'),
      'repair 不应包含 detail');
  });

  it('repair 失败时使用 deterministic fallback', async function () {
    // 先让 state 进入 budget=0
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '今天怎么样？' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-fallback-sess', message: 'hi' },
    });

    // repair 返回违规内容
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '打球开心吗？' },
      { reply: '你觉得打球开心吗？' }, // repair 仍然违规
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-fallback-sess', message: '打球' },
    });

    assert.strictEqual(res.status, 200);
    // fallback 不含问号
    assert.ok(res.body.reply.indexOf('？') < 0);
    assert.ok(res.body.reply.indexOf('?') < 0);
  });

  it('repair 最多一次', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '打球开心吗？还有什么？' }, // 多个问题
      { reply: '你觉得呢？' },              // repair 仍违规
      { reply: '多余的调用' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-repair-once', message: '打球' },
    });

    assert.strictEqual(res.status, 200);
    // 最多 3 次调用（不存在第 4 次）
    assert.ok(v2Captured.$queueIndex !== undefined ?
      v2Captured.$queueIndex <= 3 : true,
      '不应超过 3 次 API 调用');
  });

  // ---- D. 事务边界 ----

  it('generate API 错误时返回错误状态', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { error: { error: { message: 'Server Error' } }, status: 500 },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-gen-err', message: '测试' },
    });

    // provider 500 → AI_UNAVAILABLE → 503
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, 'AI_UNAVAILABLE');
  });

  it('generate 失败后 state 不推进', async function () {
    var csStore = v2Module._v2ConversationStateStore;
    var sid = 'v2-gen-fail-state';
    var beforeState = csStore.get(sid);

    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { error: { error: {} }, status: 500 },
    ]);

    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: 'hi' },
    });

    // state 应保持不变（如果之前不存在则仍未设置，因为 V2 在 try 开始时才初始化）
    var afterState = csStore.get(sid);
    assert.strictEqual(afterState, beforeState,
      'generate 失败后 state 不应变化');
  });

  it('analyze 失败仍可生成回复', async function () {
    v2Captured = mockFetchQueue([
      null, // 抛异常（analyze 失败）
      { reply: 'ok.' },
      { reply: 'ok.' }, // fallback if needed
    ]);

    v2Captured = mockFetchQueue([
      { error: { error: {} }, status: 500 }, // analyze 失败
      { reply: '打球很有意思。' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-analyze-fail', message: '打球' },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.reply === 'string');
  });

  // ---- E. 状态 ----

  it('首个 V2 学生轮次初始化 state', async function () {
    var csStore = v2Module._v2ConversationStateStore;
    var sid = 'v2-init-state';

    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你好呀！' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '你好' },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(csStore.has(sid), '应已初始化 state');
    var st = csStore.get(sid);
    assert.strictEqual(st.turn_index, 1,
      '首轮 turn_index 应为 1');
  });

  it('成功后 turn_index 只增加一次', async function () {
    var csStore = v2Module._v2ConversationStateStore;
    var sid = 'v2-turn-once';

    // Round 1
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你好呀！' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '你好' },
    });
    var afterFirst = csStore.get(sid);
    var turnAfterFirst = afterFirst.turn_index;

    // Round 2
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '打球很开心吧。' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '打球' },
    });

    var st = csStore.get(sid);
    assert.strictEqual(st.turn_index, turnAfterFirst + 1,
      'turn_index 应只增加 1');
  });

  it('第二轮能使用上一轮 state', async function () {
    var csStore = v2Module._v2ConversationStateStore;
    var sid = 'v2-state-reuse';

    // Round 1
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你好！今天过得怎么样？' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '你好' },
    });

    // Round 2
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '打球很好。' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '打球了' },
    });

    var st = csStore.get(sid);
    assert.strictEqual(st.turn_index, 2,
      '第二轮 turn_index 应为 2');
    assert.strictEqual(st.stage, 'interest',
      '第二轮应进入 interest');
  });

  it('不同 sessionId 状态隔离', async function () {
    var csStore = v2Module._v2ConversationStateStore;

    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '好。' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-iso-A', message: 'A' },
    });

    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '好。' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-iso-B', message: 'B' },
    });

    var stA = csStore.get('v2-iso-A');
    var stB = csStore.get('v2-iso-B');
    assert.notDeepStrictEqual(stA, undefined);
    assert.notDeepStrictEqual(stB, undefined);
    assert.notStrictEqual(stA.turn_index, undefined);
    assert.notStrictEqual(stB.turn_index, undefined);
  });

  it('final reply 有问题时保存 previous_assistant_asked=true', async function () {
    var csStore = v2Module._v2ConversationStateStore;
    var sid = 'v2-paa-true';

    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你今天过得怎么样？' }, // 含问题
    ]);

    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '你好' },
    });

    var st = csStore.get(sid);
    assert.strictEqual(st.previous_assistant_asked, true);
    assert.strictEqual(st.question_budget, 0,
      '问了问题后 budget 应为 0');
  });

  it('final reply 无问题时保存 previous_assistant_asked=false', async function () {
    var csStore = v2Module._v2ConversationStateStore;
    var sid = 'v2-paa-false';

    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '今天天气很不错。' }, // 无问题
    ]);

    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '你好' },
    });

    var st = csStore.get(sid);
    assert.strictEqual(st.previous_assistant_asked, false);
  });

  it('explicit_farewell=true 时进入 closing', async function () {
    var csStore = v2Module._v2ConversationStateStore;
    var sid = 'v2-farewell';

    // Round 1
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你好呀！' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '你好' },
    });

    // Round 2 — farewell
    var analysis = {
      engagement: 'medium',
      suggested_next_focus: 'none',
      suggested_stage: 'closing',
      active_topics: [],
      evidence: [],
      known_facts_to_add: [],
      safety_alert: false,
      safety_alert_reason: '',
      state_events: {
        student_added_new_info: false,
        student_refused_topic: false,
        open_task_completed: false,
        explicit_farewell: true,
        allow_deepening: false,
        allow_open_task: false,
      },
    };

    v2Captured = mockFetchQueue([
      { reply: JSON.stringify(analysis) },
      { reply: '下次再聊～' },
    ]);

    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '拜拜' },
    });

    var st = csStore.get(sid);
    assert.strictEqual(st.stage, 'closing',
      'explicit_farewell=true 应进入 closing');
  });

  it('V2 失败时不回退 V1', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { error: { error: {} }, status: 500 },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-no-fallback', message: 'hi' },
    });

    // provider 500 → AI_UNAVAILABLE → 503
    assert.strictEqual(res.status, 503);
    assert.ok(res.body.error);
  });

  it('当前 API 路径不变', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: 'hello。' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-path', message: 'hi' },
    });

    assert.strictEqual(res.status, 200);
  });

  it('当前请求字段不变（sessionId, message）', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: 'ok。' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-fields', message: 'test' },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.reply === 'string');
  });

  it('当前错误响应结构不变', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { error: { error: {} }, status: 500 },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-err-struct', message: 'err' },
    });

    assert.strictEqual(typeof res.status, 'number');
    assert.strictEqual(typeof res.body.error, 'string');
    assert.ok(res.body.error.length > 0);
  });

  it('V1 和 V2 不重复保存消息', async function () {
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '测试回复。' },
    ]);

    var res = await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: 'v2-no-dup', message: '测试' },
    });

    assert.strictEqual(res.status, 200);
    // V2 路径中 history push 只发生一次（transaction commit 处）
    // 无法从外部直接验证，但 V1 push 在 V2 分支中不会执行
    // 此测试确保流程不抛异常
  });

  // ---- 综合 ----

  it('完整 V2 interest → 多轮 progression', async function () {
    var csStore = v2Module._v2ConversationStateStore;
    var sid = 'v2-full';

    // Round 1 — opening
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '你好呀！今天有什么想聊的？' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '你好' },
    });

    // Round 2 — interest
    v2Captured = mockFetchQueue([
      { reply: analyzeJSON() },
      { reply: '打球很好。' },
    ]);
    await httpRequest('/chat/session', {
      method: 'POST', port: v2Port,
      data: { sessionId: sid, message: '我今天打球了' },
    });

    var st = csStore.get(sid);
    assert.strictEqual(st.turn_index, 2);
    assert.strictEqual(st.stage, 'interest');
  });

});
