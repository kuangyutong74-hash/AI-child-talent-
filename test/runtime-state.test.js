/**
 * test/runtime-state.test.js — 运行时状态序列化单元测试
 *
 * 覆盖：
 *   1. 只输出允许字段
 *   2. 不输出 focus_history 和 used_focuses
 *   3. 非法 question_budget 变为 0
 *   4. 非法 stage 采用保守值
 *   5. 标签注入被清理
 *   6. known_facts 仅接受 confidence='explicit'
 *   7. known_facts trim 及去重
 *   8. 特殊 key 安全
 *   9. 输出包含完整 runtime_state 标签
 *   10. 输出稳定
 *   11. 不修改输入
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

var { sanitizeRuntimeState, serializeRuntimeState, ALLOWED_FIELDS } = require('../lib/infra/runtime-state');

// ============================================================
//  只输出允许字段
// ============================================================

describe('sanitizeRuntimeState — 字段白名单', function () {

  it('应只包含 ALLOWED_FIELDS 中声明的字段', function () {
    var input = {
      turn_index: 3,
      stage: 'deepening',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'high',
      observation_focus: 'narrative_organization',
      known_facts: [],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
      // 以下为内部字段，不应输出
      focus_history: ['narrative_organization'],
      used_focuses: ['narrative_organization'],
      _internal_field: 'secret',
      some_extra: 123,
    };

    var result = sanitizeRuntimeState(input);
    var keys = Object.keys(result);

    // 所有输出字段必须在白名单中
    keys.forEach(function (k) {
      assert.ok(ALLOWED_FIELDS.indexOf(k) >= 0,
        '字段 "' + k + '" 不在 ALLOWED_FIELDS 中，不应输出');
    });

    // 白名单字段必须都出现
    ALLOWED_FIELDS.forEach(function (f) {
      assert.ok(Object.prototype.hasOwnProperty.call(result, f),
        '白名单字段 "' + f + '" 应在输出中存在');
    });
  });

  it('不应输出 focus_history', function () {
    var input = {
      focus_history: ['narrative_organization', 'vocabulary_choice'],
      used_focuses: ['narrative_organization'],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.focus_history, undefined,
      'focus_history 不应出现在输出中');
  });

  it('不应输出 used_focuses', function () {
    var input = {
      focus_history: ['narrative_organization'],
      used_focuses: ['narrative_organization', 'self_reflection'],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.used_focuses, undefined,
      'used_focuses 不应出现在输出中');
  });

});

// ============================================================
//  question_budget 序列化
// ============================================================

describe('sanitizeRuntimeState — question_budget', function () {

  it('question_budget=0 时应保留', function () {
    var result = sanitizeRuntimeState({ question_budget: 0 });
    assert.strictEqual(result.question_budget, 0);
  });

  it('question_budget=1 时应保留', function () {
    var result = sanitizeRuntimeState({ question_budget: 1 });
    assert.strictEqual(result.question_budget, 1);
  });

  it('question_budget=2 时应保留', function () {
    var result = sanitizeRuntimeState({ question_budget: 2 });
    assert.strictEqual(result.question_budget, 2);
  });

  it('question_budget=3 应变 0', function () {
    var result = sanitizeRuntimeState({ question_budget: 3 });
    assert.strictEqual(result.question_budget, 0);
  });

  it('question_budget 缺失时应为 0', function () {
    var result = sanitizeRuntimeState({});
    assert.strictEqual(result.question_budget, 0);
  });

  it('question_budget 为负数时应变为 0', function () {
    var result = sanitizeRuntimeState({ question_budget: -1 });
    assert.strictEqual(result.question_budget, 0);
  });

  it('question_budget 为字符串时应变为 0', function () {
    var result = sanitizeRuntimeState({ question_budget: '1' });
    assert.strictEqual(result.question_budget, 0);
  });

});

// ============================================================
//  stage 序列化
// ============================================================

describe('sanitizeRuntimeState — stage', function () {

  it('合法 stage 应保留', function () {
    ['opening', 'interest', 'deepening', 'open_task', 'closing'].forEach(function (s) {
      var result = sanitizeRuntimeState({ stage: s });
      assert.strictEqual(result.stage, s, 'stage "' + s + '" 应保留');
    });
  });

  it('非法 stage 应变为 closing', function () {
    var result = sanitizeRuntimeState({ stage: 'garbage' });
    assert.strictEqual(result.stage, 'closing',
      '非法 stage 应使用最保守策略 closing');
  });

  it('缺失 stage 应为 closing', function () {
    var result = sanitizeRuntimeState({});
    assert.strictEqual(result.stage, 'closing');
  });

});

// ============================================================
//  known_facts — confidence 和基本过滤
// ============================================================

describe('sanitizeRuntimeState — known_facts 过滤', function () {

  it('接受 confidence=explicit', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: '我打篮球', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1);
    assert.strictEqual(result.known_facts[0].key, 'sport');
    assert.strictEqual(result.known_facts[0].value, '篮球');
  });

  it('拒绝 confidence=inferred', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 'maybe', confidence: 'inferred' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 0,
      'inferred 事实应被拒绝');
  });

  it('拒绝 confidence=implicit', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 'maybe', confidence: 'implicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 0,
      'implicit 事实应被拒绝');
  });

  it('拒绝缺失 confidence', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 'maybe' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 0,
      '缺失 confidence 应被拒绝');
  });

  it('拒绝空 key', function () {
    var input = {
      known_facts: [
        { key: '', value: '篮球', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 0);
  });

  it('拒绝空 value', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 0);
  });

  it('拒绝纯空格 key', function () {
    var input = {
      known_facts: [
        { key: '   ', value: '篮球', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 0,
      '纯空格 key 应被拒绝');
  });

  it('拒绝纯空格 value', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '   ', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 0,
      '纯空格 value 应被拒绝');
  });

  it('key/value 输出会 trim', function () {
    var input = {
      known_facts: [
        { key: '  sport  ', value: '  篮球  ', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1);
    assert.strictEqual(result.known_facts[0].key, 'sport',
      'key 应被 trim');
    assert.strictEqual(result.known_facts[0].value, '篮球',
      'value 应被 trim');
  });

  it('source_quote 非字符串时变为空字符串', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 123, confidence: 'explicit' },
        { key: 'food', value: '冰淇淋', source_quote: null, confidence: 'explicit' },
        { key: 'game', value: '下棋', source_quote: undefined, confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 3);
    assert.strictEqual(result.known_facts[0].source_quote, '',
      '非字符串 source_quote 应变空字符串');
    assert.strictEqual(result.known_facts[1].source_quote, '');
    assert.strictEqual(result.known_facts[2].source_quote, '');
  });

  it('confidence 输出固定为 explicit', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts[0].confidence, 'explicit',
      '输出 confidence 应固定为 explicit');
  });

  it('非数组 known_facts 应变空数组', function () {
    assert.deepStrictEqual(sanitizeRuntimeState({ known_facts: 'not array' }).known_facts, []);
    assert.deepStrictEqual(sanitizeRuntimeState({ known_facts: null }).known_facts, []);
    assert.deepStrictEqual(sanitizeRuntimeState({ known_facts: 123 }).known_facts, []);
  });

});

// ============================================================
//  known_facts — 特殊 key 安全
// ============================================================

describe('sanitizeRuntimeState — known_facts 特殊 key', function () {

  it('特殊 key __proto__ 安全', function () {
    var input = {
      known_facts: [
        { key: '__proto__', value: 'test', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1,
      '__proto__ key 不应导致异常');
    assert.strictEqual(result.known_facts[0].key, '__proto__');
  });

  it('特殊 key constructor 安全', function () {
    var input = {
      known_facts: [
        { key: 'constructor', value: 'test', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1,
      'constructor key 不应导致异常');
  });

  it('特殊 key hasOwnProperty 安全', function () {
    var input = {
      known_facts: [
        { key: 'hasOwnProperty', value: 'test', source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1,
      'hasOwnProperty key 不应导致异常');
  });

  it('Object.create(null) 作为事实条目不抛异常', function () {
    var fact = Object.create(null);
    fact.key = 'sport';
    fact.value = '篮球';
    fact.source_quote = 's';
    fact.confidence = 'explicit';
    var input = { known_facts: [fact] };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1);
  });

  it('Object.create(null) 的 explicit 事实可以正常通过', function () {
    var fact = Object.create(null);
    fact.key = 'sport';
    fact.value = '篮球';
    fact.source_quote = '我喜欢打篮球';
    fact.confidence = 'explicit';
    var input = { known_facts: [fact] };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1);
    assert.strictEqual(result.known_facts[0].key, 'sport');
    assert.strictEqual(result.known_facts[0].value, '篮球');
    assert.strictEqual(result.known_facts[0].value, '篮球');
  });

});

// ============================================================
//  known_facts — 去重
// ============================================================

describe('sanitizeRuntimeState — known_facts 去重', function () {

  it('相同 key、相同 value 不重复', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'explicit' },
        { key: 'sport', value: '篮球', source_quote: 'b', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1,
      '同 key 同 value 应去重');
  });

  it('相同 key、不同 value 后者覆盖前者', function () {
    var input = {
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'explicit' },
        { key: 'sport', value: '足球', source_quote: 'b', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1,
      '同 key 不同 value 应只保留后者');
    assert.strictEqual(result.known_facts[0].value, '足球',
      '后者 value 应覆盖前者');
  });

  it('key 大小写和空格归一化后去重', function () {
    var input = {
      known_facts: [
        { key: ' Sport ', value: '篮球', source_quote: 'a', confidence: 'explicit' },
        { key: 'sport', value: '足球', source_quote: 'b', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1,
      "归一化后 ' Sport ' 和 'sport' 应视为同 key");
    assert.strictEqual(result.known_facts[0].value, '足球',
      '后者应覆盖前者');
  });

  it('不修改 known_facts 输入数组', function () {
    var facts = [
      { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'explicit' },
    ];
    var input = { known_facts: facts };
    sanitizeRuntimeState(input);
    assert.strictEqual(facts.length, 1);
    assert.strictEqual(facts[0].key, 'sport');
    assert.strictEqual(facts[0].value, '篮球');
  });

  it('不修改 known_fact 输入对象', function () {
    var fact = { key: '  sport  ', value: '  篮球  ', source_quote: 'a', confidence: 'explicit' };
    var input = { known_facts: [fact] };
    sanitizeRuntimeState(input);
    assert.strictEqual(fact.key, '  sport  ',
      '输入 fact key 不应被 trim 修改');
    assert.strictEqual(fact.value, '  篮球  ',
      '输入 fact value 不应被 trim 修改');
  });

  it('sanitize 返回的 known_facts 不是输入数组引用', function () {
    var input = {
      known_facts: [{ key: 'a', value: 'b', source_quote: 'c', confidence: 'explicit' }],
    };
    var result = sanitizeRuntimeState(input);
    result.known_facts.push({ key: 'x', value: 'y', source_quote: 'z', confidence: 'explicit' });
    assert.strictEqual(input.known_facts.length, 1,
      '返回对象的 known_facts 和输入对象的 known_facts 不应是同一引用');
  });

});

// ============================================================
//  serializeRuntimeState — known_facts
// ============================================================

describe('serializeRuntimeState — known_facts 序列化', function () {

  it('known_facts 非空时应格式化为紧凑 JSON', function () {
    var state = {
      turn_index: 5,
      stage: 'interest',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'medium',
      observation_focus: 'none',
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: '我喜欢打篮球', confidence: 'explicit' },
        { key: 'food', value: '冰淇淋', source_quote: '最爱吃冰淇淋', confidence: 'explicit' },
      ],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var output = serializeRuntimeState(state);

    assert.ok(output.includes('"key"'), '应包含 key 字段');
    assert.ok(output.includes('"value"'), '应包含 value 字段');
    assert.ok(output.includes('篮球'), '应包含事实内容');
    // source_quote 不应暴露给模型
    assert.ok(output.indexOf('source_quote') < 0,
      '不应暴露 source_quote 给模型');
  });

  it('serializeRuntimeState 不输出 inferred 或 implicit 事实', function () {
    var state = {
      turn_index: 3,
      stage: 'interest',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'medium',
      observation_focus: 'none',
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'explicit' },
        { key: 'game', value: '下棋', source_quote: 'b', confidence: 'inferred' },
        { key: 'food', value: '面条', source_quote: 'c', confidence: 'implicit' },
      ],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var output = serializeRuntimeState(state);

    // 只应出现 explicit 事实
    assert.ok(output.includes('篮球'), 'explicit 事实应出现');
    assert.ok(!output.includes('下棋'), 'inferred 事实不应出现');
    assert.ok(!output.includes('面条'), 'implicit 事实不应出现');
  });

  it('serializeRuntimeState 的 known_facts 仍只包含 key 和 value', function () {
    var state = {
      turn_index: 3,
      stage: 'interest',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'medium',
      observation_focus: 'none',
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: '我打篮球', confidence: 'explicit' },
      ],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var output = serializeRuntimeState(state);

    // 不应包含 confidence
    assert.ok(output.indexOf('confidence') < 0,
      'confidence 不应暴露给模型');
  });

});

// ============================================================
//  serializeRuntimeState
// ============================================================

describe('serializeRuntimeState', function () {

  it('输出应包含完整的 <runtime_state> 标签', function () {
    var state = {
      turn_index: 3,
      stage: 'deepening',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'high',
      observation_focus: 'narrative_organization',
      known_facts: [{ key: 'sport', value: '篮球', source_quote: '我打篮球', confidence: 'explicit' }],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var output = serializeRuntimeState(state);

    assert.ok(output.indexOf('<runtime_state>') === 0,
      '输出应以 <runtime_state> 开头');
    assert.ok(output.indexOf('</runtime_state>') > 0,
      '输出应包含 </runtime_state>');
    assert.ok(output.lastIndexOf('</runtime_state>') === output.length - '</runtime_state>'.length,
      '输出应以 </runtime_state> 结尾');
  });

  it('输出应包含所有关键字段', function () {
    var state = {
      turn_index: 3,
      stage: 'deepening',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'high',
      observation_focus: 'narrative_organization',
      known_facts: [],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var output = serializeRuntimeState(state);

    assert.ok(output.includes('turn_index: 3'), '应包含 turn_index');
    assert.ok(output.includes('stage: deepening'), '应包含 stage');
    assert.ok(output.includes('question_budget: 1'), '应包含 question_budget');
    assert.ok(output.includes('active_topic: 篮球'), '应包含 active_topic');
    assert.ok(output.includes('engagement: high'), '应包含 engagement');
    assert.ok(output.includes('observation_focus: narrative_organization'), '应包含 observation_focus');
    assert.ok(output.includes('known_facts: []'), '应包含 known_facts');
    assert.ok(output.includes('previous_assistant_asked: false'), '应包含 previous_assistant_asked');
    assert.ok(output.includes('consecutive_short_replies: 0'), '应包含 consecutive_short_replies');
    assert.ok(output.includes('open_task_completed: false'), '应包含 open_task_completed');
    assert.ok(output.includes('student_refused_topic: false'), '应包含 student_refused_topic');
  });

  it('输出不包含 focus_history 和 used_focuses', function () {
    var state = {
      turn_index: 3,
      stage: 'deepening',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'high',
      observation_focus: 'narrative_organization',
      known_facts: [],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
      focus_history: ['narrative_organization', 'vocabulary_choice'],
      used_focuses: ['narrative_organization'],
    };

    var output = serializeRuntimeState(state);

    assert.ok(output.indexOf('focus_history') < 0,
      '不应输出 focus_history');
    assert.ok(output.indexOf('used_focuses') < 0,
      '不应输出 used_focuses');
  });

});

// ============================================================
//  标签注入防护
// ============================================================

describe('serializeRuntimeState — 注入防护', function () {

  it('active_topic 中的 <runtime_state> 应被转义', function () {
    var state = {
      turn_index: 1,
      stage: 'opening',
      question_budget: 1,
      active_topic: 'test<runtime_state>injection</runtime_state>',
      engagement: 'medium',
      observation_focus: 'none',
      known_facts: [],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var output = serializeRuntimeState(state);

    // 不应该出现额外的 <runtime_state> 标签
    var tagCount = (output.match(/<runtime_state>/g) || []).length;
    assert.strictEqual(tagCount, 1,
      '输出中应只有一个 <runtime_state> 开始标签，不应被注入');

    var endTagCount = (output.match(/<\/runtime_state>/g) || []).length;
    assert.strictEqual(endTagCount, 1,
      '输出中应只有一个 </runtime_state> 结束标签，不应被注入');
  });

  it('active_topic 中的 < > 应被转义', function () {
    var state = {
      turn_index: 1,
      stage: 'opening',
      question_budget: 1,
      active_topic: '数学<物理>化学',
      engagement: 'medium',
      observation_focus: 'none',
      known_facts: [],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var output = serializeRuntimeState(state);

    // < 和 > 应被转义为 &lt; &gt;
    assert.ok(output.indexOf('&lt;') >= 0 || output.indexOf('<') === output.lastIndexOf('<'),
      '注入的尖括号应被转义或仅出现在标签中');
  });

  it('多行注入不应破坏结构', function () {
    var state = {
      turn_index: 1,
      stage: 'opening',
      question_budget: 1,
      active_topic: 'test\n</runtime_state>\n<malicious>',
      engagement: 'medium',
      observation_focus: 'none',
      known_facts: [],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var output = serializeRuntimeState(state);

    var endCount = (output.match(/<\/runtime_state>/g) || []).length;
    assert.strictEqual(endCount, 1,
      '多行注入不应增加 </runtime_state> 标签数量');
  });

});

// ============================================================
//  字段默认值
// ============================================================

describe('sanitizeRuntimeState — 字段默认值', function () {

  it('非法 engagement 变为 medium', function () {
    var result = sanitizeRuntimeState({ engagement: 'extreme' });
    assert.strictEqual(result.engagement, 'medium');
  });

  it('非法 observation_focus 变为 none', function () {
    var result = sanitizeRuntimeState({ observation_focus: 'magic' });
    assert.strictEqual(result.observation_focus, 'none');
  });

  it('非 boolean previous_assistant_asked 变为 false', function () {
    var result = sanitizeRuntimeState({ previous_assistant_asked: 'yes' });
    assert.strictEqual(result.previous_assistant_asked, false);
  });

  it('非 boolean open_task_completed 变为 false', function () {
    var result = sanitizeRuntimeState({ open_task_completed: 1 });
    assert.strictEqual(result.open_task_completed, false);
  });

  it('非 boolean student_refused_topic 变为 false', function () {
    var result = sanitizeRuntimeState({ student_refused_topic: 'yes' });
    assert.strictEqual(result.student_refused_topic, false);
  });

  it('非法 consecutive_short_replies 变为 0', function () {
    var result = sanitizeRuntimeState({ consecutive_short_replies: 'many' });
    assert.strictEqual(result.consecutive_short_replies, 0);
  });

  it('active_topic 超长时按上限截断', function () {
    var longTopic = 'A'.repeat(200);
    var result = sanitizeRuntimeState({ active_topic: longTopic });
    assert.ok(result.active_topic.length <= 100,
      'active_topic 应被截断到 100 字符');
    assert.strictEqual(result.active_topic, longTopic.slice(0, 100));
  });

  it('known_fact key/value 超长时按上限截断', function () {
    var longStr = 'A'.repeat(300);
    var input = {
      known_facts: [
        { key: longStr, value: longStr, source_quote: 's', confidence: 'explicit' },
      ],
    };
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.known_facts.length, 1);
    assert.ok(result.known_facts[0].key.length <= 200,
      'key 应被截断到 200 字符');
    assert.ok(result.known_facts[0].value.length <= 200,
      'value 应被截断到 200 字符');
  });

});

// ============================================================
//  空/无效输入
// ============================================================

describe('sanitizeRuntimeState — 空/无效输入', function () {

  it('null 输入不抛异常', function () {
    var result = sanitizeRuntimeState(null);
    assert.strictEqual(result.stage, 'closing');
  });

  it('undefined 输入不抛异常', function () {
    var result = sanitizeRuntimeState(undefined);
    assert.strictEqual(result.stage, 'closing');
  });

  it('数组输入不抛异常', function () {
    var result = sanitizeRuntimeState([]);
    assert.strictEqual(result.stage, 'closing');
  });

  it('函数输入不抛异常', function () {
    var result = sanitizeRuntimeState(function () {});
    assert.strictEqual(result.stage, 'closing');
  });

  it('Object.create(null) 状态不抛异常', function () {
    var input = Object.create(null);
    input.stage = 'interest';
    input.question_budget = 1;
    var result = sanitizeRuntimeState(input);
    assert.strictEqual(result.stage, 'interest');
    assert.strictEqual(result.question_budget, 1);
  });

  it('serializeRuntimeState null 输入不抛异常', function () {
    var output = serializeRuntimeState(null);
    assert.ok(output.indexOf('<runtime_state>') === 0, '应包含开始标签');
    assert.ok(output.indexOf('</runtime_state>') > 0, '应包含结束标签');
    assert.ok(output.includes('stage: closing'), '非法输入应使用 closing');
    assert.ok(output.includes('question_budget: 0'), '非法输入应使用 budget=0');
  });

  it('serializeRuntimeState undefined 输入不抛异常', function () {
    var output = serializeRuntimeState(undefined);
    assert.ok(output.includes('stage: closing'));
    assert.ok(output.includes('question_budget: 0'));
  });

  it('空对象应返回最小安全状态', function () {
    var output = serializeRuntimeState({});
    assert.ok(output.includes('stage: closing'));
    assert.ok(output.includes('question_budget: 0'));
    assert.ok(output.includes('active_topic: null'));
    assert.ok(output.includes('known_facts: []'));
  });

});

// ============================================================
//  输出稳定
// ============================================================

describe('serializeRuntimeState — 输出稳定性', function () {

  it('相同输入多次调用应返回相同输出', function () {
    var state = {
      turn_index: 3,
      stage: 'deepening',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'high',
      observation_focus: 'narrative_organization',
      known_facts: [{ key: 'sport', value: '篮球', source_quote: '我打篮球', confidence: 'explicit' }],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var r1 = serializeRuntimeState(state);
    var r2 = serializeRuntimeState(state);
    var r3 = serializeRuntimeState(state);

    assert.strictEqual(r1, r2, '第1次和第2次调用输出应一致');
    assert.strictEqual(r2, r3, '第2次和第3次调用输出应一致');
  });

  it('sanitizeRuntimeState 多次调用相同输入应返回相同结果', function () {
    var state = {
      turn_index: 3,
      stage: 'deepening',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'high',
      observation_focus: 'narrative_organization',
      known_facts: [],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var r1 = sanitizeRuntimeState(state);
    var r2 = sanitizeRuntimeState(state);
    assert.deepStrictEqual(r1, r2);
  });

  it('字段输出顺序应稳定', function () {
    var state = {
      turn_index: 5,
      stage: 'closing',
      question_budget: 0,
      active_topic: null,
      engagement: 'low',
      observation_focus: 'none',
      known_facts: [],
      previous_assistant_asked: false,
      consecutive_short_replies: 3,
      open_task_completed: true,
      student_refused_topic: false,
    };

    var output1 = serializeRuntimeState(state);
    var lines1 = output1.split('\n');

    var output2 = serializeRuntimeState(state);
    var lines2 = output2.split('\n');

    assert.strictEqual(lines1.length, lines2.length,
      '两次输出的行数应一致');

    for (var i = 0; i < lines1.length; i++) {
      assert.strictEqual(lines1[i], lines2[i],
        '第 ' + (i + 1) + ' 行输出应一致');
    }
  });

});

// ============================================================
//  不修改输入
// ============================================================

describe('不可变性', function () {

  it('sanitizeRuntimeState 不修改输入', function () {
    var input = {
      turn_index: 3,
      stage: 'deepening',
      question_budget: 1,
      active_topic: '篮球<test>',
      engagement: 'high',
      observation_focus: 'narrative_organization',
      known_facts: [{ key: 'sport', value: '篮球', extra: 'should be kept in input', source_quote: 'test', confidence: 'explicit' }],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var inputJson = JSON.stringify(input);
    sanitizeRuntimeState(input);
    assert.strictEqual(JSON.stringify(input), inputJson,
      'sanitizeRuntimeState 不应修改输入对象');
  });

  it('serializeRuntimeState 不修改输入', function () {
    var input = {
      turn_index: 3,
      stage: 'deepening',
      question_budget: 1,
      active_topic: '篮球',
      engagement: 'high',
      observation_focus: 'narrative_organization',
      known_facts: [{ key: 'sport', value: '篮球', source_quote: 'test', confidence: 'explicit' }],
      previous_assistant_asked: false,
      consecutive_short_replies: 0,
      open_task_completed: false,
      student_refused_topic: false,
    };

    var inputJson = JSON.stringify(input);
    serializeRuntimeState(input);
    assert.strictEqual(JSON.stringify(input), inputJson,
      'serializeRuntimeState 不应修改输入对象');
  });

});

// ============================================================
//  ALLOWED_FIELDS 完整性
// ============================================================

describe('ALLOWED_FIELDS', function () {

  it('应包含 xiaoxin-v2.md 中声明的全部 runtime_state 字段', function () {
    var expected = [
      'turn_index',
      'stage',
      'question_budget',
      'active_topic',
      'engagement',
      'observation_focus',
      'known_facts',
      'previous_assistant_asked',
      'consecutive_short_replies',
      'open_task_completed',
      'student_refused_topic',
    ];
    assert.strictEqual(ALLOWED_FIELDS.length, expected.length,
      'ALLOWED_FIELDS 应包含正好 ' + expected.length + ' 个字段');
    expected.forEach(function (f) {
      assert.ok(ALLOWED_FIELDS.indexOf(f) >= 0,
        'ALLOWED_FIELDS 应包含: ' + f);
    });
  });

});
