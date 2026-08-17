/**
 * test/v2-turn-runner.test.js — V2 单轮对话执行器单元测试
 *
 * 覆盖：正常流程、analyze 失败、generate 失败、repair 流程、
 * fallback、时序正确性、输入安全、不可变性。
 *
 * 不调用真实网络。所有模型回调均为 mock。
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

var runner = require('../lib/core/v2-turn-runner');
var cs = require('../lib/core/conversation-state');

// ============================================================
//  mock 辅助函数
// ============================================================

function okAnalysis(overrides) {
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
    Object.keys(overrides).forEach(function (k) {
      a[k] = overrides[k];
    });
  }
  return a;
}

function interestState(turn) {
  return cs.normalizeConversationState({
    turn_index: turn || 2,
    stage: 'interest',
    question_budget: 1,
    engagement: 'medium',
    observation_focus: 'none',
  });
}

/**
 * 返回一个 question_budget 天然为 0 的状态（previous_assistant_asked=true）。
 * normalizeConversationState 会重新计算 budget，所以不能通过传参直接设为 0。
 */
function noBudgetState(turn) {
  return cs.normalizeConversationState({
    turn_index: turn || 3,
    stage: 'interest',
    previous_assistant_asked: true,
    engagement: 'medium',
  });
}

function makeAnalyze(analysis) {
  return async function () {
    return analysis;
  };
}

function makeGenerate(reply) {
  return async function () {
    return reply;
  };
}

function makeRepair(reply) {
  return async function () {
    return reply;
  };
}

function throwingAnalyze(err) {
  return async function () {
    throw err || new Error('analyze failed');
  };
}

function throwingGenerate(err) {
  return async function () {
    throw err || new Error('generate failed');
  };
}

function throwingRepair(err) {
  return async function () {
    throw err || new Error('repair failed');
  };
}

function baseInput(overrides) {
  var inp = {
    previousState: interestState(),
    history: [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好呀！' },
      { role: 'user', content: '今天打球了' },
    ],
    studentMessage: '今天打球了',
    analyze: makeAnalyze(okAnalysis()),
    generateReply: makeGenerate('打球很开心吧？'),
    repairReply: makeRepair('打球一定很开心吧。'),
  };
  if (overrides) {
    Object.keys(overrides).forEach(function (k) {
      inp[k] = overrides[k];
    });
  }
  return inp;
}

// ============================================================
//  正常流程
// ============================================================

describe('runV2Turn — 正常流程', function () {

  it('正常 analyze + generate 成功', async function () {
    var result = await runner.runV2Turn(baseInput());

    assert.ok(typeof result.finalReply === 'string');
    assert.ok(result.finalReply.length > 0);
    assert.ok(isNonArrayObject(result.nextState));
    assert.ok(result.nextState.turn_index > 0);
    assert.ok(isNonArrayObject(result.validation));
    assert.strictEqual(result.repairAttempted, false);
    assert.strictEqual(result.repairSucceeded, false);
    assert.strictEqual(result.usedFallback, false);
  });

  it('analyze 抛错仍能保守生成', async function () {
    var result = await runner.runV2Turn(baseInput({
      analyze: throwingAnalyze(),
    }));

    assert.ok(typeof result.finalReply === 'string');
    assert.strictEqual(result.analysis, null);
    assert.ok(isNonArrayObject(result.nextState));
  });

  it('首次回复有效时不 repair', async function () {
    var repairCalled = false;

    var result = await runner.runV2Turn(baseInput({
      // question_budget≥1 的阶段，回复必须带问句才算有效（见 checkMissingRequiredQuestion）
      generateReply: makeGenerate('今天天气很不错，你喜欢吗？'),
      repairReply: async function () { repairCalled = true; return 'fixed'; },
    }));

    assert.strictEqual(result.repairAttempted, false);
    assert.strictEqual(repairCalled, false);
    assert.strictEqual(result.usedFallback, false);
  });

  it('第二条学生消息进入 interest', async function () {
    // turn_index=1 after advance → opening (need 2 for interest)
    // turn_index=2 after advance → interest
    var prev = cs.normalizeConversationState({
      turn_index: 1,
      stage: 'opening',
      question_budget: 1,
    });
    var analysis = okAnalysis();
    analysis.state_events.student_added_new_info = true;

    var result = await runner.runV2Turn({
      previousState: prev,
      history: [{ role: 'user', content: '你好' }],
      studentMessage: '今天打球了',
      analyze: makeAnalyze(analysis),
      generateReply: makeGenerate('打球很开心吧？'),
      repairReply: null,
    });

    assert.strictEqual(result.nextState.stage, 'interest',
      'turn_index>=2 应进入 interest');
  });

});

// ============================================================
//  generate 失败
// ============================================================

describe('runV2Turn — generate 失败', function () {

  it('generate 抛错时 runV2Turn reject', async function () {
    var repairCalled = false;

    await assert.rejects(
      runner.runV2Turn(baseInput({
        generateReply: throwingGenerate(),
        repairReply: async function () { repairCalled = true; return 'ok'; },
      })),
      /generate/,
      'generate 抛错应导致 runV2Turn reject'
    );

    assert.strictEqual(repairCalled, false,
      'generate 抛错不应调用 repair');
  });

  it('generate 返回 null 时可进入 repair/fallback', async function () {
    var repairCalled = false;

    var result = await runner.runV2Turn(baseInput({
      generateReply: makeGenerate(null),
      repairReply: async function () { repairCalled = true; return '一切都会好起来的。'; },
    }));

    assert.strictEqual(result.repairAttempted, true);
    assert.strictEqual(repairCalled, true);
  });

  it('generate 返回空字符串时可进入 repair/fallback', async function () {
    var result = await runner.runV2Turn(baseInput({
      generateReply: makeGenerate(''),
      repairReply: makeRepair('一切都会好起来的。'),
    }));

    assert.strictEqual(result.repairAttempted, true);
  });

  it('generate 抛错时不调用 repair', async function () {
    var repairCalled = false;

    try {
      await runner.runV2Turn(baseInput({
        generateReply: throwingGenerate(),
        repairReply: async function () { repairCalled = true; return 'ok'; },
      }));
      assert.fail('should have thrown');
    } catch (_) {
      assert.strictEqual(repairCalled, false);
    }
  });

});

// ============================================================
//  repair 流程
// ============================================================

describe('runV2Turn — repair 流程', function () {

  it('首次回复问题超预算时调用一次 repair', async function () {
    var repairCallCount = 0;

    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
      repairReply: async function () {
        repairCallCount++;
        return '打球是一件很好的事。';
      },
    });

    assert.strictEqual(result.repairAttempted, true);
    assert.strictEqual(repairCallCount, 1,
      'repair 应只调用一次');
    assert.strictEqual(result.repairSucceeded, true);
    assert.strictEqual(result.usedFallback, false);
    assert.ok(result.finalReply.indexOf('？') < 0,
      'repair 后回复不应含问号');
  });

  it('repair 成功后采用 repair 回复', async function () {
    var repairCalled = false;

    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
      repairReply: async function () {
        repairCalled = true;
        return '打球听起来很有意思。';
      },
    });

    assert.strictEqual(repairCalled, true);
    assert.strictEqual(result.repairSucceeded, true);
    assert.strictEqual(result.finalReply, '打球听起来很有意思。');
    assert.strictEqual(result.usedFallback, false);
  });

  it('repair 回复再次失败时使用 fallback', async function () {
    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
      repairReply: makeRepair('你觉得打球开心吗？'),
    });

    assert.strictEqual(result.repairAttempted, true);
    assert.strictEqual(result.repairSucceeded, false);
    assert.strictEqual(result.usedFallback, true);
    assert.ok(result.finalReply.indexOf('？') < 0,
      'fallback 不应含问号');
  });

  it('repair 抛错时使用 fallback', async function () {
    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
      repairReply: throwingRepair(),
    });

    assert.strictEqual(result.repairAttempted, true);
    assert.strictEqual(result.repairSucceeded, false);
    assert.strictEqual(result.usedFallback, true);
  });

  it('repair 缺失时使用 fallback', async function () {
    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
    });

    assert.strictEqual(result.repairAttempted, false);
    assert.strictEqual(result.usedFallback, true);
  });

  it('repair 返回 null 时使用 fallback', async function () {
    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
      repairReply: makeRepair(null),
    });

    assert.strictEqual(result.usedFallback, true);
  });

  it('repair 返回空字符串时使用 fallback', async function () {
    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
      repairReply: makeRepair(''),
    });

    assert.strictEqual(result.usedFallback, true);
  });

  it('repair 返回纯空格时使用 fallback', async function () {
    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
      repairReply: makeRepair('   '),
    });

    assert.strictEqual(result.usedFallback, true);
  });

  it('repair 最多调用一次', async function () {
    var repairCount = 0;

    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？还有什么有趣的事？'),
      repairReply: async function () {
        repairCount++;
        return '有趣吗？';
      },
    });

    assert.strictEqual(repairCount, 1,
      'repair 应最多调用一次');
    assert.strictEqual(result.usedFallback, true);
  });

  it('analyze 最多调用一次', async function () {
    var analyzeCount = 0;

    await runner.runV2Turn(baseInput({
      analyze: async function () { analyzeCount++; return okAnalysis(); },
    }));

    assert.strictEqual(analyzeCount, 1);
  });

  it('generateReply 最多调用一次', async function () {
    var generateCount = 0;

    await runner.runV2Turn(baseInput({
      generateReply: async function () { generateCount++; return '今天天气很好。'; },
    }));

    assert.strictEqual(generateCount, 1);
  });

});

// ============================================================
//  fallback
// ============================================================

describe('runV2Turn — fallback', function () {

  it('closing fallback 不含问题', async function () {
    var prev = cs.normalizeConversationState({
      turn_index: 10,
      stage: 'closing',
      previous_assistant_asked: true,
    });

    var result = await runner.runV2Turn({
      previousState: prev,
      history: [{ role: 'user', content: '好的' }],
      studentMessage: '好的',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('下次聊什么呢？'),
      repairReply: null,
    });

    var validation = result.validation;
    assert.ok(
      validation.valid || result.usedFallback,
      'closing fallback 应通过 validator 或已使用 fallback'
    );
    assert.ok(result.finalReply.indexOf('？') < 0);
    assert.ok(result.finalReply.indexOf('?') < 0);
  });

  it('question_budget=0 fallback 不含问题', async function () {
    var prev = noBudgetState(5);

    var result = await runner.runV2Turn({
      previousState: prev,
      history: [{ role: 'user', content: '嗯' }],
      studentMessage: '嗯',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你觉得呢？'),
      repairReply: null,
    });

    assert.ok(result.finalReply.indexOf('？') < 0);
    assert.ok(result.finalReply.indexOf('?') < 0);
  });

  it('普通 fallback 非空字符串', async function () {
    var result = await runner.runV2Turn({
      previousState: interestState(),
      history: [{ role: 'user', content: '不知道' }],
      studentMessage: '不知道',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate(''),
      repairReply: null,
    });

    assert.ok(typeof result.finalReply === 'string');
    assert.ok(result.finalReply.trim().length > 0);
  });

});

// ============================================================
//  回调参数
// ============================================================

describe('runV2Turn — 回调参数', function () {

  it('runtimeState 在 generateReply 参数中存在', async function () {
    var captured;

    await runner.runV2Turn(baseInput({
      generateReply: async function (ctx) {
        captured = ctx;
        return '好的。';
      },
    }));

    assert.ok(typeof captured.runtimeState === 'string');
    assert.ok(captured.runtimeState.indexOf('<runtime_state>') >= 0);
    assert.ok(captured.runtimeState.indexOf('</runtime_state>') >= 0);
    assert.ok(captured.state, 'state 应存在');
    assert.ok(captured.history, 'history 应存在');
    assert.ok(captured.studentMessage, 'studentMessage 应存在');
  });

  it('validationErrors 只包含 code', async function () {
    var capturedErrors;

    var result = await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？'),
      repairReply: async function (ctx) {
        capturedErrors = ctx.validationErrors;
        return '打球很好。';
      },
    });

    assert.ok(Array.isArray(capturedErrors));
    capturedErrors.forEach(function (code) {
      assert.strictEqual(typeof code, 'string',
        '每个 error 应只是 code 字符串');
      assert.ok(code.indexOf(' ') < 0 || code.length < 20,
        'code 不应是完整的 detail 文本');
    });
  });

  it('不向 repair 传 detail', async function () {
    var capturedErrors;

    await runner.runV2Turn({
      previousState: noBudgetState(3),
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？还有什么要说的？'),
      repairReply: async function (ctx) {
        capturedErrors = ctx.validationErrors;
        return 'ok。';
      },
    });

    capturedErrors.forEach(function (code) {
      assert.strictEqual(typeof code, 'string');
      // detail 通常是长句子，code 是短标识符
      assert.ok(
        !code.includes('question_budget 为 0'),
        '不应包含 detail 文本'
      );
    });
  });

});

// ============================================================
//  时序正确性
// ============================================================

describe('runV2Turn — 时序正确性', function () {

  it('advanced state 的 turn_index 只增加一次', async function () {
    var prev = interestState(5);

    var result = await runner.runV2Turn(baseInput({
      previousState: prev,
    }));

    assert.strictEqual(result.nextState.turn_index, 6,
      'turn_index 应从 5 增加到 6');
  });

  it('finalize 不再次增加 turn_index', async function () {
    var result = await runner.runV2Turn(baseInput());

    // advanceConversationState 增加 1，finalize 不应再增加
    assert.strictEqual(result.nextState.turn_index, 3,
      'turn_index 应为初始 2 + 1 = 3');
  });

  it('studentMessage 含"再见"但 analysis 事件 false 时不自动 closing', async function () {
    var analysis = okAnalysis();
    // explicit_farewell 保持 false

    var result = await runner.runV2Turn({
      previousState: interestState(5),
      history: [{ role: 'user', content: '再见' }],
      studentMessage: '再见',
      analyze: makeAnalyze(analysis),
      generateReply: makeGenerate('你说的再见是指什么？'),
      repairReply: null,
    });

    assert.notStrictEqual(result.nextState.stage, 'closing',
      'analysis 未标记告别时不应进入 closing');
  });

  it('explicit_farewell=true 时进入 closing', async function () {
    var analysis = okAnalysis();
    analysis.state_events.explicit_farewell = true;

    var result = await runner.runV2Turn({
      previousState: interestState(5),
      history: [
        { role: 'user', content: '打球' },
        { role: 'assistant', content: '好的' },
        { role: 'user', content: '拜拜' },
      ],
      studentMessage: '拜拜',
      analyze: makeAnalyze(analysis),
      generateReply: makeGenerate('下次再聊～'),
      repairReply: null,
    });

    assert.strictEqual(result.nextState.stage, 'closing',
      'explicit_farewell=true 应进入 closing');
  });

});

// ============================================================
//  previous_assistant_asked 一致性
// ============================================================

describe('runV2Turn — previous_assistant_asked', function () {

  it('final reply 有问题时 previous_assistant_asked=true', async function () {
    var result = await runner.runV2Turn(baseInput({
      generateReply: makeGenerate('你今天过得怎么样？'),
    }));

    assert.strictEqual(
      result.nextState.previous_assistant_asked,
      true,
      '含问题的回复应设置 previous_assistant_asked=true'
    );
  });

  it('final reply 无问题时 previous_assistant_asked=false', async function () {
    var result = await runner.runV2Turn(baseInput({
      generateReply: makeGenerate('今天天气很不错。'),
    }));

    assert.strictEqual(
      result.nextState.previous_assistant_asked,
      false,
      '无问题的回复应设置 previous_assistant_asked=false'
    );
  });

  it('nextState.question_budget 与最终回复一致', async function () {
    // 问了问题 → previous_assistant_asked=true → budget=0
    var result = await runner.runV2Turn(baseInput({
      generateReply: makeGenerate('你今天过得怎么样？'),
    }));

    assert.strictEqual(result.nextState.previous_assistant_asked, true);
    assert.strictEqual(result.nextState.question_budget, 0);
  });

  it('repair 后 budget 与最终 repair 回复一致', async function () {
    var prev = cs.normalizeConversationState({
      turn_index: 3,
      stage: 'interest',
      question_budget: 1,
      engagement: 'medium',
    });

    var result = await runner.runV2Turn({
      previousState: prev,
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('你今天打球开心吗？还有什么趣事？还有谁一起打的？'),
      repairReply: makeRepair('打球听起来很有意思。'),
    });

    // repair 回复无问题 → previous_assistant_asked=false → budget 保持正常值（现为 2）
    assert.strictEqual(result.nextState.previous_assistant_asked, false);
    assert.strictEqual(result.nextState.question_budget, 2);
  });

});

// ============================================================
//  输入安全
// ============================================================

describe('runV2Turn — 输入安全', function () {

  it('Object.create(null) 输入安全', async function () {
    var inp = Object.create(null);
    inp.previousState = interestState();
    inp.history = [];
    inp.studentMessage = 'hello';
    inp.analyze = makeAnalyze(okAnalysis());
    inp.generateReply = makeGenerate('hello back.');

    var result = await runner.runV2Turn(inp);
    assert.ok(isNonArrayObject(result));
    assert.ok(typeof result.finalReply === 'string');
  });

  it('非法 previousState 安全', async function () {
    var result = await runner.runV2Turn({
      previousState: null,
      history: [],
      studentMessage: 'hello',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('hello.'),
      repairReply: null,
    });

    assert.ok(isNonArrayObject(result.nextState));
    // null → createInitialConversationState → opening
    assert.strictEqual(result.nextState.stage, 'opening');
  });

  it('非字符串 studentMessage 安全', async function () {
    var result = await runner.runV2Turn({
      previousState: interestState(),
      history: [],
      studentMessage: 123,
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('好的。'),
      repairReply: null,
    });

    assert.ok(typeof result.finalReply === 'string');
  });

  it('空 input 抛异常', async function () {
    await assert.rejects(
      runner.runV2Turn(null),
      /must be a non-array object/,
      'null input 应抛异常'
    );
  });

  it('缺少 analyze 抛异常', async function () {
    await assert.rejects(
      runner.runV2Turn({
        previousState: interestState(),
        history: [],
        studentMessage: 'hi',
        generateReply: makeGenerate('hi'),
      }),
      /analyze must be a function/
    );
  });

  it('缺少 generateReply 抛异常', async function () {
    await assert.rejects(
      runner.runV2Turn({
        previousState: interestState(),
        history: [],
        studentMessage: 'hi',
        analyze: makeAnalyze(okAnalysis()),
      }),
      /generateReply must be a function/
    );
  });

});

// ============================================================
//  不可变性
// ============================================================

describe('runV2Turn — 不可变性', function () {

  it('history 不被修改', async function () {
    var originalHistory = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];

    var historyCopy = JSON.parse(JSON.stringify(originalHistory));

    await runner.runV2Turn(baseInput({
      history: originalHistory,
    }));

    assert.deepStrictEqual(originalHistory, historyCopy,
      'history 数组不应被修改');
  });

  it('history 消息对象不被修改', async function () {
    var msg = { role: 'user', content: 'hello' };
    var originalHistory = [msg];

    var msgJson = JSON.stringify(msg);

    await runner.runV2Turn(baseInput({
      history: originalHistory,
    }));

    assert.strictEqual(JSON.stringify(msg), msgJson,
      'history 消息对象不应被修改');
  });

  it('previousState 不被修改', async function () {
    var prev = interestState(5);
    var prevJson = JSON.stringify(prev);

    await runner.runV2Turn(baseInput({
      previousState: prev,
    }));

    assert.strictEqual(JSON.stringify(prev), prevJson,
      'previousState 不应被修改');
  });

  it('analysis 不被修改', async function () {
    var analysis = okAnalysis();
    var analysisJson = JSON.stringify(analysis);

    await runner.runV2Turn(baseInput({
      analyze: makeAnalyze(analysis),
    }));

    assert.strictEqual(JSON.stringify(analysis), analysisJson,
      'analysis 对象不应被修改');
  });

  it('相同输入和相同回调结果产生相同输出', async function () {
    var input = baseInput();

    var r1 = await runner.runV2Turn(input);
    var r2 = await runner.runV2Turn(input);

    // 注意：turn_index 每次都从原始 previousState 推进
    // 所以两次调用的 nextState 应该相同
    assert.deepStrictEqual(r1, r2,
      '相同输入应产生相同输出');
  });

});

// ============================================================
//  回调调用时机
// ============================================================

describe('runV2Turn — 回调调用时机', function () {

  it('analyze 在被调用时收到 previousState', async function () {
    var captured;

    await runner.runV2Turn(baseInput({
      analyze: async function (ctx) {
        captured = ctx;
        return okAnalysis();
      },
    }));

    assert.ok(isNonArrayObject(captured.previousState));
    assert.ok(Array.isArray(captured.history));
    assert.strictEqual(captured.studentMessage, '今天打球了');
    assert.ok(typeof captured.runtimeState === 'string');
  });

  it('analyze 失败时代码路径仍在 analyze 回调中', async function () {
    var prev = interestState(5);
    var generateArgs = null;

    var result = await runner.runV2Turn({
      previousState: prev,
      history: [{ role: 'user', content: 'hello' }],
      studentMessage: 'hello',
      analyze: throwingAnalyze(),
      generateReply: async function (ctx) {
        generateArgs = ctx;
        return 'hi there.';
      },
      repairReply: null,
    });

    assert.strictEqual(result.analysis, null);
    assert.ok(generateArgs, 'generateReply 仍应被调用');
    assert.ok(isNonArrayObject(result.nextState));
  });

});

// ============================================================
//  综合场景
// ============================================================

describe('runV2Turn — 综合场景', function () {

  it('完整 interest→deepening 流程', async function () {
    var prev = interestState(2);

    var analysis = okAnalysis({ engagement: 'high' });
    analysis.active_topics.push({ topic: '恐龙', initiated_by_student: true });
    analysis.suggested_next_focus = 'interest_depth_breadth';
    analysis.state_events.student_added_new_info = true;
    analysis.state_events.allow_deepening = true;
    analysis.known_facts_to_add.push(
      { key: 'interest', value: '恐龙', source_quote: '喜欢恐龙', confidence: 'explicit' }
    );

    var result = await runner.runV2Turn({
      previousState: prev,
      history: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好呀！' },
        { role: 'user', content: '我最近看了好多恐龙的书，霸王龙最厉害！' },
      ],
      studentMessage: '我最近看了好多恐龙的书，霸王龙最厉害！',
      analyze: makeAnalyze(analysis),
      // 注意：不能再次追问已知事实"恐龙"（repeated_known_fact 校验会拒绝），
      // 且 question_budget≥1 的阶段必须带问句
      generateReply: makeGenerate('霸王龙确实很酷！你还喜欢什么别的东西呀？'),
      repairReply: makeRepair('霸王龙确实很酷。'),
    });

    assert.strictEqual(result.nextState.stage, 'deepening',
      '满足全部条件应进入 deepening');
    assert.ok(result.finalReply.indexOf('霸王龙') >= 0);
  });

  it('完整 repair → fallback 流程', async function () {
    var prev = noBudgetState(3);

    var result = await runner.runV2Turn({
      previousState: prev,
      history: [{ role: 'user', content: '打球' }],
      studentMessage: '打球',
      analyze: makeAnalyze(okAnalysis()),
      generateReply: makeGenerate('打球开心吗？'),
      repairReply: makeRepair('打球的时候开心吗？'),
    });

    assert.strictEqual(result.repairAttempted, true);
    assert.strictEqual(result.repairSucceeded, false);
    assert.strictEqual(result.usedFallback, true);
    assert.ok(typeof result.finalReply === 'string');
    assert.ok(result.finalReply.length > 0);
  });

});

// ============================================================
//  辅助
// ============================================================

function isNonArrayObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}
