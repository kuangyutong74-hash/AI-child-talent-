/**
 * test/conversation-state.test.js — 五阶段状态机单元测试
 *
 * 覆盖所有导出函数的契约，与当前 lib/conversation-state.js 实现对齐。
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

var cs = require('../lib/core/conversation-state');

var {
  createInitialConversationState,
  normalizeConversationState,
  advanceConversationState,
  computeQuestionBudget,
  selectObservationFocus,
  mergeKnownFacts,
  deriveEngagement,
  isShortStudentReply,
  REAL_INDICATORS,
} = cs;

// ============================================================
//  辅助：构造合法状态
// ============================================================

function makeState(overrides) {
  var base = createInitialConversationState();
  if (overrides) {
    Object.keys(overrides).forEach(function (k) {
      base[k] = overrides[k];
    });
  }
  return base;
}

// ============================================================
//  一、初始状态与规范化
// ============================================================

describe('createInitialConversationState', function () {

  it('应包含恰好 14 个字段', function () {
    var state = createInitialConversationState();
    var keys = Object.keys(state).sort();
    var expected = [
      'active_topic', 'consecutive_short_replies', 'engagement',
      'focus_history', 'known_facts', 'observation_focus',
      'open_task_completed', 'open_task_used', 'previous_assistant_asked',
      'question_budget', 'stage', 'student_refused_topic',
      'turn_index', 'used_focuses',
    ];
    assert.deepStrictEqual(keys, expected);
  });

  it('初始 turn_index 应为 0', function () {
    assert.strictEqual(createInitialConversationState().turn_index, 0);
  });

  it('初始 stage 应为 opening', function () {
    assert.strictEqual(createInitialConversationState().stage, 'opening');
  });

  it('初始 question_budget 应为 1', function () {
    assert.strictEqual(createInitialConversationState().question_budget, 1);
  });

  it('初始 known_facts 应为空数组', function () {
    var facts = createInitialConversationState().known_facts;
    assert.ok(Array.isArray(facts));
    assert.strictEqual(facts.length, 0);
  });

  it('初始 observation_focus 应为 none', function () {
    assert.strictEqual(createInitialConversationState().observation_focus, 'none');
  });

  it('初始 open_task_used/open_task_completed 应为 false', function () {
    var s = createInitialConversationState();
    assert.strictEqual(s.open_task_used, false);
    assert.strictEqual(s.open_task_completed, false);
  });

  it('每次调用返回不同对象', function () {
    var a = createInitialConversationState();
    var b = createInitialConversationState();
    a.turn_index = 99;
    assert.strictEqual(b.turn_index, 0);
  });

});

describe('normalizeConversationState', function () {

  it('null 返回初始状态', function () {
    var r = normalizeConversationState(null);
    assert.strictEqual(r.stage, 'opening');
    assert.strictEqual(r.turn_index, 0);
  });

  it('undefined 返回初始状态', function () {
    var r = normalizeConversationState(undefined);
    assert.strictEqual(r.stage, 'opening');
  });

  it('数字返回初始状态', function () {
    var r = normalizeConversationState(123);
    assert.strictEqual(r.stage, 'opening');
  });

  it('数组返回初始状态', function () {
    var r = normalizeConversationState([1, 2, 3]);
    assert.strictEqual(r.stage, 'opening');
  });

  it('非法 stage 规范化为 closing（保守恢复策略）', function () {
    var r = normalizeConversationState({ stage: 'garbage_stage' });
    assert.strictEqual(r.stage, 'closing');
  });

  it('合法 stage 保留', function () {
    var r = normalizeConversationState({ stage: 'deepening' });
    assert.strictEqual(r.stage, 'deepening');
  });

  it('非法 stage → closing 后 question_budget 为 0', function () {
    var r = normalizeConversationState({ stage: 'invalid' });
    assert.strictEqual(r.question_budget, 0);
  });

  it('closing 的 question_budget 强制为 0', function () {
    var r = normalizeConversationState({ stage: 'closing', question_budget: 1, engagement: 'high' });
    assert.strictEqual(r.question_budget, 0);
  });

  it('opening 的 observation_focus 强制为 none', function () {
    var r = normalizeConversationState({ stage: 'opening', observation_focus: 'vocabulary_choice' });
    assert.strictEqual(r.observation_focus, 'none');
  });

  it('closing 的 observation_focus 强制为 none', function () {
    var r = normalizeConversationState({ stage: 'closing', observation_focus: 'narrative_organization' });
    assert.strictEqual(r.observation_focus, 'none');
  });

  it('focus_history 删除 none 和非法指标', function () {
    var r = normalizeConversationState({
      focus_history: ['narrative_organization', 'none', 'garbage', 'vocabulary_choice'],
    });
    assert.deepStrictEqual(r.focus_history, ['narrative_organization', 'vocabulary_choice']);
  });

  it('used_focuses 删除 none、非指标，去重，最多三种', function () {
    var r = normalizeConversationState({
      used_focuses: [
        'narrative_organization', 'vocabulary_choice',
        'self_reflection', 'value_judgment',
      ],
    });
    assert.strictEqual(r.used_focuses.length, 3);
    assert.deepStrictEqual(r.used_focuses, [
      'narrative_organization', 'vocabulary_choice', 'self_reflection',
    ]);
  });

  it('known_facts 只保留 explicit', function () {
    var r = normalizeConversationState({
      known_facts: [
        { key: 'sport', value: '篮球', confidence: 'inferred' },
        { key: 'food', value: '冰淇淋', confidence: 'explicit' },
      ],
    });
    assert.strictEqual(r.known_facts.length, 1);
    assert.strictEqual(r.known_facts[0].key, 'food');
  });

  it('known_facts 缺失 confidence 被拒绝', function () {
    var r = normalizeConversationState({
      known_facts: [
        { key: 'valid', value: 'ok' },  // no confidence
      ],
    });
    assert.strictEqual(r.known_facts.length, 0);
  });

  it('known_facts 空 key 或空 value 被过滤', function () {
    var r = normalizeConversationState({
      known_facts: [
        { key: '', value: 'test', confidence: 'explicit' },
        { key: 'test', value: '', confidence: 'explicit' },
        { key: '  ', value: 'x', confidence: 'explicit' },
        { key: 'good', value: 'ok', confidence: 'explicit' },
      ],
    });
    assert.strictEqual(r.known_facts.length, 1);
    assert.strictEqual(r.known_facts[0].key, 'good');
  });

  it('known_facts 按 key 去重', function () {
    var r = normalizeConversationState({
      known_facts: [
        { key: 'sport', value: '篮球', confidence: 'explicit' },
        { key: 'SPORT', value: '篮球', confidence: 'explicit' },
      ],
    });
    assert.strictEqual(r.known_facts.length, 1);
  });

  it('known_facts 同 key 不同 value 保留后一个 explicit 事实', function () {
    var r = normalizeConversationState({
      known_facts: [
        { key: 'sport', value: '篮球', confidence: 'explicit' },
        { key: 'sport', value: '足球', confidence: 'explicit' },
      ],
    });
    assert.strictEqual(r.known_facts.length, 1);
    assert.strictEqual(r.known_facts[0].value, '足球');
  });

  it('question_budget 不信任输入值，根据规范化后状态重新计算', function () {
    // interest + high engagement + no issues → budget 2
    var r = normalizeConversationState({
      stage: 'interest', engagement: 'high', question_budget: 5,
    });
    assert.strictEqual(r.question_budget, 2);
  });

  it('规范化不修改输入', function () {
    var input = { stage: 'invalid', question_budget: 5 };
    var copy = JSON.parse(JSON.stringify(input));
    normalizeConversationState(input);
    assert.deepStrictEqual(input, copy);
  });

  it('active_topic 空白字符串规范化为 null', function () {
    var r = normalizeConversationState({ active_topic: '   ' });
    assert.strictEqual(r.active_topic, null);
  });

  it('active_topic 合法字符串 trim 保留', function () {
    var r = normalizeConversationState({ active_topic: '  篮球  ' });
    assert.strictEqual(r.active_topic, '篮球');
  });

});

// ============================================================
//  二、turn_index 与阶段转换
// ============================================================

describe('advanceConversationState — 阶段转换', function () {

  it('第一条消息后 turn_index=1，仍为 opening', function () {
    var s = advanceConversationState(createInitialConversationState(), { studentMessage: '你好' });
    assert.strictEqual(s.turn_index, 1);
    assert.strictEqual(s.stage, 'opening');
  });

  it('第二条消息后 turn_index=2，进入 interest', function () {
    var s1 = advanceConversationState(createInitialConversationState(), { studentMessage: '你好' });
    var s2 = advanceConversationState(s1, { studentMessage: '今天天气不错' });
    assert.strictEqual(s2.turn_index, 2);
    assert.strictEqual(s2.stage, 'interest');
  });

  it('interest 不会因为轮数、active_topic 或回复长度自动进入 deepening', function () {
    var s = makeState({
      turn_index: 5, stage: 'interest', active_topic: '篮球',
      engagement: 'high', consecutive_short_replies: 0,
    });
    var next = advanceConversationState(s, {
      studentMessage: '投篮需要反复练习才能准确',
      activeTopic: '篮球',
      engagement: 'high',
    });
    // 没有 allowDeepening 和 studentAddedNewInfo → 不能进入 deepening
    assert.strictEqual(next.stage, 'interest');
  });

  it('allowDeepening=true 且 studentAddedNewInfo=true 进入 deepening', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', active_topic: '篮球',
      engagement: 'high', consecutive_short_replies: 0,
    });
    var next = advanceConversationState(s, {
      studentMessage: '投篮要练很久才能准',
      activeTopic: '篮球',
      engagement: 'high',
      allowDeepening: true,
      studentAddedNewInfo: true,
    });
    assert.strictEqual(next.stage, 'deepening');
    assert.strictEqual(next.turn_index, 4);
  });

  it('只有 allowDeepening 但无 studentAddedNewInfo 不能进入 deepening', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', engagement: 'high',
    });
    var next = advanceConversationState(s, {
      studentMessage: '投篮要练很久才能准',
      engagement: 'high',
      allowDeepening: true,
      // studentAddedNewInfo missing
    });
    assert.strictEqual(next.stage, 'interest');
  });

  it('engagement=low 时即使有双重事件也不能进入 deepening', function () {
    var s = makeState({ turn_index: 3, stage: 'interest', engagement: 'medium' });
    var next = advanceConversationState(s, {
      studentMessage: '嗯',
      engagement: 'low',
      allowDeepening: true,
      studentAddedNewInfo: true,
    });
    assert.strictEqual(next.stage, 'interest');
  });

  it('student_refused_topic=true 时不能进入 deepening', function () {
    var s = makeState({ turn_index: 3, stage: 'interest', engagement: 'high' });
    var next = advanceConversationState(s, {
      studentMessage: '我不想聊这个',
      engagement: 'high',
      studentRefusedTopic: true,
      allowDeepening: true,
      studentAddedNewInfo: true,
    });
    assert.strictEqual(next.stage, 'interest');
  });

  it('explicitFarewell=true 进入 closing', function () {
    var s = makeState({ turn_index: 6, stage: 'deepening', engagement: 'high' });
    var next = advanceConversationState(s, {
      studentMessage: '拜拜',
      engagement: 'medium',
      explicitFarewell: true,
    });
    assert.strictEqual(next.stage, 'closing');
    assert.strictEqual(next.question_budget, 0);
  });

  it('studentMessage 包含"再见"但没有 explicitFarewell 时不进入 closing', function () {
    var s = makeState({ turn_index: 6, stage: 'deepening', engagement: 'high' });
    var next = advanceConversationState(s, {
      studentMessage: '再见啦老师',
      engagement: 'medium',
      // no explicitFarewell
    });
    assert.strictEqual(next.stage, 'deepening');
  });

  it('studentMessage 为"拜拜"但没有 explicitFarewell 时不进入 closing', function () {
    var s = makeState({ turn_index: 6, stage: 'deepening', engagement: 'high' });
    var next = advanceConversationState(s, {
      studentMessage: '拜拜',
      engagement: 'medium',
      // no explicitFarewell
    });
    assert.strictEqual(next.stage, 'deepening');
  });

  it('turn_index 达到 18 时强制进入 closing', function () {
    var s = makeState({ turn_index: 17, stage: 'interest', engagement: 'high' });
    var next = advanceConversationState(s, {
      studentMessage: '继续聊',
      engagement: 'high',
    });
    assert.strictEqual(next.turn_index, 18);
    assert.strictEqual(next.stage, 'closing');
  });

  it('forceClosing=true 直接进入 closing', function () {
    var s = makeState({ turn_index: 3, stage: 'interest', engagement: 'high' });
    var next = advanceConversationState(s, {
      studentMessage: '我有点累了',
      engagement: 'medium',
      forceClosing: true,
    });
    assert.strictEqual(next.stage, 'closing');
  });

  it('closing 不可逆——任何事件都不改变 closing', function () {
    var s = makeState({
      turn_index: 10, stage: 'closing', engagement: 'high',
      open_task_completed: true, open_task_used: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '我还有很多想聊的！',
      activeTopic: '音乐',
      engagement: 'high',
      observationFocus: 'vocabulary_choice',
    });
    assert.strictEqual(next.stage, 'closing');
    assert.strictEqual(next.question_budget, 0);
    assert.strictEqual(next.observation_focus, 'none');
  });

  it('未明确 allow_open_task 时不得进入 open_task', function () {
    var s = makeState({
      turn_index: 5, stage: 'deepening', engagement: 'high',
      active_topic: '篮球',
    });
    var next = advanceConversationState(s, {
      studentMessage: '我真的很喜欢打篮球',
      engagement: 'high',
    });
    assert.strictEqual(next.stage, 'deepening');
  });

  it('allowOpenTask=true 且条件满足时进入 open_task', function () {
    var s = makeState({
      turn_index: 6, stage: 'deepening', engagement: 'high',
      active_topic: '篮球',
    });
    var next = advanceConversationState(s, {
      studentMessage: '我真的很喜欢打篮球',
      engagement: 'high',
      allowOpenTask: true,
    });
    assert.strictEqual(next.stage, 'open_task');
    assert.strictEqual(next.open_task_used, true);
  });

  it('open_task_used=true 后不能再次进入 open_task', function () {
    var s = makeState({
      turn_index: 7, stage: 'deepening', engagement: 'high',
      active_topic: '篮球', open_task_used: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '我们来试试吧',
      engagement: 'high',
      allowOpenTask: true,
    });
    assert.notStrictEqual(next.stage, 'open_task');
  });

  it('open_task_completed=true 后进入 closing', function () {
    var s = makeState({
      turn_index: 8, stage: 'open_task', engagement: 'high',
      active_topic: '篮球', open_task_used: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '好，我觉得差不多完成了',
      engagement: 'high',
      openTaskCompleted: true,
    });
    assert.strictEqual(next.stage, 'closing');
    assert.strictEqual(next.open_task_completed, true);
  });

  it('engagement=low 或 student_refused_topic=true 时不得进入 open_task', function () {
    var s = makeState({
      turn_index: 6, stage: 'deepening', engagement: 'high',
      active_topic: '篮球',
    });
    var nextLow = advanceConversationState(s, {
      studentMessage: '...', engagement: 'low', allowOpenTask: true,
    });
    assert.notStrictEqual(nextLow.stage, 'open_task');

    var nextRefuse = advanceConversationState(s, {
      studentMessage: '不想聊', engagement: 'high',
      studentRefusedTopic: true, allowOpenTask: true,
    });
    assert.notStrictEqual(nextRefuse.stage, 'open_task');
  });

  it('open_task 阶段 engagement=low 或 student_refused_topic 进入 closing', function () {
    var s = makeState({
      turn_index: 9, stage: 'open_task', engagement: 'high',
      active_topic: '篮球', open_task_used: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '不想做了',
      engagement: 'low',
    });
    assert.strictEqual(next.stage, 'closing');
  });

});

// ============================================================
//  三、previousAssistantAsked
// ============================================================

describe('advanceConversationState — previousAssistantAsked', function () {

  it('字段缺失时保留原 true', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', engagement: 'high',
      previous_assistant_asked: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '你好',
      engagement: 'high',
      // previousAssistantAsked not provided
    });
    assert.strictEqual(next.previous_assistant_asked, true);
  });

  it('字段缺失时保留原 false', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', engagement: 'high',
    });
    var next = advanceConversationState(s, {
      studentMessage: '你好',
      engagement: 'high',
    });
    assert.strictEqual(next.previous_assistant_asked, false);
  });

  it('显式 false 清除 true', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', engagement: 'high',
      previous_assistant_asked: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '你好',
      engagement: 'high',
      previousAssistantAsked: false,
    });
    assert.strictEqual(next.previous_assistant_asked, false);
  });

  it('显式 true 设置 true', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', engagement: 'high',
      previous_assistant_asked: false,
    });
    var next = advanceConversationState(s, {
      studentMessage: '你好',
      engagement: 'high',
      previousAssistantAsked: true,
    });
    assert.strictEqual(next.previous_assistant_asked, true);
  });

  it('非 boolean 保留旧值', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', engagement: 'high',
      previous_assistant_asked: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '你好',
      engagement: 'high',
      previousAssistantAsked: 'yes',
    });
    assert.strictEqual(next.previous_assistant_asked, true);
  });

  it('Object.create(null) 事件对象不抛异常', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', engagement: 'high',
    });
    var event = Object.create(null);
    event.studentMessage = '你好';
    event.engagement = 'high';
    // event has no hasOwnProperty
    var next = advanceConversationState(s, event);
    assert.strictEqual(next.stage, 'interest');
    // previous_assistant_asked preserved
    assert.strictEqual(next.previous_assistant_asked, false);
  });

  it('closing 分支字段缺失保留旧值', function () {
    var s = makeState({
      turn_index: 10, stage: 'closing', engagement: 'medium',
      previous_assistant_asked: true, open_task_completed: true,
      open_task_used: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '好的',
      // previousAssistantAsked not provided
    });
    assert.strictEqual(next.stage, 'closing');
    assert.strictEqual(next.previous_assistant_asked, true);
  });

  it('closing 分支显式 false 清除 true', function () {
    var s = makeState({
      turn_index: 10, stage: 'closing', engagement: 'medium',
      previous_assistant_asked: true, open_task_completed: true,
      open_task_used: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '好的',
      previousAssistantAsked: false,
    });
    assert.strictEqual(next.previous_assistant_asked, false);
  });

  it('previous_assistant_asked=true 时 question_budget=0', function () {
    var s = makeState({
      turn_index: 3, stage: 'interest', engagement: 'high',
      previous_assistant_asked: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '是的',
      engagement: 'high',
    });
    assert.strictEqual(next.question_budget, 0);
  });

});

// ============================================================
//  四、studentRefusedTopic
// ============================================================

describe('advanceConversationState — studentRefusedTopic', function () {

  it('显式 true 设置拒绝', function () {
    var s = makeState({ turn_index: 3, stage: 'interest', engagement: 'high' });
    var next = advanceConversationState(s, {
      studentMessage: '不想聊',
      engagement: 'high',
      studentRefusedTopic: true,
    });
    assert.strictEqual(next.student_refused_topic, true);
  });

  it('显式 false 清除旧 true', function () {
    var s = makeState({
      turn_index: 5, stage: 'deepening', engagement: 'high',
      student_refused_topic: true, active_topic: '篮球',
    });
    var next = advanceConversationState(s, {
      studentMessage: '好吧我们继续',
      engagement: 'high',
      studentRefusedTopic: false,
    });
    assert.strictEqual(next.student_refused_topic, false);
  });

  it('缺失字段保留旧值', function () {
    var s = makeState({
      turn_index: 5, stage: 'deepening', engagement: 'high',
      student_refused_topic: true, active_topic: '篮球',
    });
    var next = advanceConversationState(s, {
      studentMessage: '好吧',
      engagement: 'high',
      // studentRefusedTopic not provided
    });
    assert.strictEqual(next.student_refused_topic, true);
  });

  it('非 boolean 保留旧值', function () {
    var s = makeState({
      turn_index: 5, stage: 'deepening', engagement: 'high',
      student_refused_topic: false, active_topic: '篮球',
    });
    var next = advanceConversationState(s, {
      studentMessage: '好吧',
      engagement: 'high',
      studentRefusedTopic: 'yes',
    });
    assert.strictEqual(next.student_refused_topic, false);
  });

  it('Object.create(null) 事件对象包含 studentRefusedTopic 安全', function () {
    var s = makeState({ turn_index: 3, stage: 'interest', engagement: 'high' });
    var event = Object.create(null);
    event.studentMessage = '不想聊';
    event.engagement = 'high';
    event.studentRefusedTopic = true;
    var next = advanceConversationState(s, event);
    assert.strictEqual(next.student_refused_topic, true);
  });

});

// ============================================================
//  五、question_budget
// ============================================================

describe('computeQuestionBudget', function () {

  it('closing 返回 0', function () {
    assert.strictEqual(computeQuestionBudget({ stage: 'closing', engagement: 'high' }), 0);
  });

  it('previous_assistant_asked=true 返回 0', function () {
    assert.strictEqual(computeQuestionBudget({
      stage: 'deepening', engagement: 'high', previous_assistant_asked: true,
    }), 0);
  });

  it('engagement=low 返回 0', function () {
    assert.strictEqual(computeQuestionBudget({
      stage: 'interest', engagement: 'low',
    }), 0);
  });

  it('consecutive_short_replies>=2 返回 0', function () {
    assert.strictEqual(computeQuestionBudget({
      stage: 'interest', engagement: 'medium', consecutive_short_replies: 2,
    }), 0);
  });

  it('student_refused_topic=true 返回 0', function () {
    assert.strictEqual(computeQuestionBudget({
      stage: 'interest', engagement: 'high', student_refused_topic: true,
    }), 0);
  });

  it('非法 stage 返回 0', function () {
    assert.strictEqual(computeQuestionBudget({
      stage: 'garbage', engagement: 'high',
    }), 0);
  });

  it('非法 engagement 返回 0', function () {
    assert.strictEqual(computeQuestionBudget({
      stage: 'interest', engagement: 'extreme',
    }), 0);
  });

  it('空输入返回 0', function () {
    assert.strictEqual(computeQuestionBudget(null), 0);
    assert.strictEqual(computeQuestionBudget(undefined), 0);
    assert.strictEqual(computeQuestionBudget(123), 0);
    assert.strictEqual(computeQuestionBudget([]), 0);
  });

  it('正常状态返回 2', function () {
    assert.strictEqual(computeQuestionBudget({
      stage: 'deepening', engagement: 'high',
    }), 2);
  });

  it('结果始终只有 0 或 2（全面验证）', function () {
    var stages = ['opening', 'interest', 'deepening', 'open_task', 'closing'];
    var engagements = ['high', 'medium', 'low'];
    for (var si = 0; si < stages.length; si++) {
      for (var ei = 0; ei < engagements.length; ei++) {
        var budget = computeQuestionBudget({
          stage: stages[si],
          engagement: engagements[ei],
        });
        assert.ok(budget === 0 || budget === 2,
          '应为 0 或 2，实际 ' + budget + '（' + stages[si] + ',' + engagements[ei] + '）');
      }
    }
  });

});

// ============================================================
//  六、observation_focus
// ============================================================

describe('selectObservationFocus', function () {

  function s(overrides) {
    var base = {
      stage: 'deepening', engagement: 'high',
      student_refused_topic: false, focus_history: [], used_focuses: [],
    };
    if (overrides) {
      Object.keys(overrides).forEach(function (k) { base[k] = overrides[k]; });
    }
    return base;
  }

  it('opening 返回 none', function () {
    assert.strictEqual(selectObservationFocus(s({ stage: 'opening' }), 'narrative_organization'), 'none');
  });

  it('closing 返回 none', function () {
    assert.strictEqual(selectObservationFocus(s({ stage: 'closing' }), 'narrative_organization'), 'none');
  });

  it('engagement=low 返回 none', function () {
    assert.strictEqual(selectObservationFocus(s({ engagement: 'low' }), 'vocabulary_choice'), 'none');
  });

  it('student_refused_topic=true 返回 none', function () {
    assert.strictEqual(selectObservationFocus(s({ student_refused_topic: true }), 'self_reflection'), 'none');
  });

  it('非法 suggestion 返回 none', function () {
    assert.strictEqual(selectObservationFocus(s(), 'invalid_focus'), 'none');
    assert.strictEqual(selectObservationFocus(s(), ''), 'none');
  });

  it('none suggestion 返回 none', function () {
    assert.strictEqual(selectObservationFocus(s(), 'none'), 'none');
  });

  it('同一 focus 连续两轮后第三次返回 none', function () {
    var state = s({ focus_history: ['narrative_organization', 'narrative_organization'] });
    assert.strictEqual(selectObservationFocus(state, 'narrative_organization'), 'none');
  });

  it('同一 focus 使用一轮后可继续使用第二轮', function () {
    var state = s({ focus_history: ['vocabulary_choice'] });
    assert.strictEqual(selectObservationFocus(state, 'vocabulary_choice'), 'vocabulary_choice');
  });

  it('不同 focus 最多三个——第四个新 focus 返回 none', function () {
    var state = s({
      used_focuses: ['narrative_organization', 'vocabulary_choice', 'self_reflection'],
    });
    assert.strictEqual(selectObservationFocus(state, 'value_judgment'), 'none');
  });

  it('已使用的 focus 可再次使用（不占新名额）', function () {
    var state = s({
      used_focuses: ['narrative_organization', 'vocabulary_choice', 'self_reflection'],
      focus_history: ['narrative_organization'],
    });
    assert.strictEqual(selectObservationFocus(state, 'narrative_organization'), 'narrative_organization');
  });

  it('active_topic_tendency 整段对话最多主动使用一次', function () {
    var state = s({ focus_history: ['active_topic_tendency'], used_focuses: ['active_topic_tendency'] });
    assert.strictEqual(selectObservationFocus(state, 'active_topic_tendency'), 'none');
  });

  it('active_topic_tendency 首次使用允许', function () {
    var state = s({ focus_history: [], used_focuses: [] });
    assert.strictEqual(selectObservationFocus(state, 'active_topic_tendency'), 'active_topic_tendency');
  });

  it('空输入返回 none', function () {
    assert.strictEqual(selectObservationFocus(null, 'any'), 'none');
    assert.strictEqual(selectObservationFocus(undefined, 'any'), 'none');
    assert.strictEqual(selectObservationFocus([], 'any'), 'none');
  });

  it('非法 stage 返回 none', function () {
    assert.strictEqual(selectObservationFocus(s({ stage: 'garbage' }), 'narrative_organization'), 'none');
  });

  it('非法 engagement 返回 none', function () {
    assert.strictEqual(selectObservationFocus(s({ engagement: 'extreme' }), 'narrative_organization'), 'none');
  });

});

describe('advanceConversationState — observation_focus', function () {

  it('通过 selectObservationFocus 约束，不能直接绕过', function () {
    // active_topic_tendency 已使用过一次 → selectObservationFocus 应返回 none
    var s = makeState({
      turn_index: 4, stage: 'deepening', engagement: 'high',
      focus_history: ['active_topic_tendency'],
      used_focuses: ['active_topic_tendency'],
    });
    var next = advanceConversationState(s, {
      studentMessage: '继续聊',
      engagement: 'high',
      observationFocus: 'active_topic_tendency',
    });
    assert.strictEqual(next.observation_focus, 'none');
  });

  it('opening 传入非 none focus，最终仍为 none', function () {
    var s = createInitialConversationState(); // stage=opening
    var next = advanceConversationState(s, {
      studentMessage: '你好',
      engagement: 'medium',
      observationFocus: 'vocabulary_choice',
    });
    assert.strictEqual(next.stage, 'opening');
    assert.strictEqual(next.observation_focus, 'none');
  });

  it('closing 传入非 none focus，最终仍为 none', function () {
    var s = makeState({
      turn_index: 10, stage: 'closing', engagement: 'medium',
      open_task_completed: true, open_task_used: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '好的',
      observationFocus: 'narrative_organization',
    });
    assert.strictEqual(next.observation_focus, 'none');
  });

  it('opening 不写入 focus_history', function () {
    var s = createInitialConversationState();
    var next = advanceConversationState(s, {
      studentMessage: '你好',
      engagement: 'medium',
      observationFocus: 'vocabulary_choice',
    });
    assert.strictEqual(next.focus_history.length, 0);
  });

  it('closing 不写入 focus_history', function () {
    var s = makeState({
      turn_index: 10, stage: 'closing', engagement: 'medium',
      open_task_completed: true, open_task_used: true,
    });
    var next = advanceConversationState(s, {
      studentMessage: '好的',
      observationFocus: 'narrative_organization',
    });
    assert.strictEqual(next.focus_history.length, 0);
  });

  it('每轮实际使用非 none focus 都记录（即使与上一轮相同）', function () {
    var s = makeState({
      turn_index: 4, stage: 'deepening', engagement: 'high',
      focus_history: ['vocabulary_choice'],
      used_focuses: ['vocabulary_choice'],
    });
    var next = advanceConversationState(s, {
      studentMessage: '继续说',
      engagement: 'high',
      observationFocus: 'vocabulary_choice',
    });
    assert.strictEqual(next.observation_focus, 'vocabulary_choice');
    assert.strictEqual(next.focus_history.length, 2);
    assert.deepStrictEqual(next.focus_history, ['vocabulary_choice', 'vocabulary_choice']);
  });

  it('连续使用同一 focus 两轮后第三次返回 none，history 不增长', function () {
    var s = makeState({
      turn_index: 5, stage: 'deepening', engagement: 'high',
      focus_history: ['narrative_organization', 'narrative_organization'],
      used_focuses: ['narrative_organization'],
    });
    var next = advanceConversationState(s, {
      studentMessage: '继续说',
      engagement: 'high',
      observationFocus: 'narrative_organization',
    });
    assert.strictEqual(next.observation_focus, 'none');
    // focus_history 不增长（none 不写入）
    assert.strictEqual(next.focus_history.length, 2);
  });

  it('used_focuses 最多三种', function () {
    var s = makeState({
      turn_index: 5, stage: 'deepening', engagement: 'high',
      focus_history: ['narrative_organization', 'vocabulary_choice', 'self_reflection'],
      used_focuses: ['narrative_organization', 'vocabulary_choice', 'self_reflection'],
    });
    var next = advanceConversationState(s, {
      studentMessage: '继续说',
      engagement: 'high',
      observationFocus: 'self_reflection', // already in used_focuses
    });
    assert.strictEqual(next.observation_focus, 'self_reflection');
    assert.strictEqual(next.used_focuses.length, 3);
  });

  it('第四种 focus 不会进入 used_focuses', function () {
    var s = makeState({
      turn_index: 5, stage: 'deepening', engagement: 'high',
      focus_history: ['narrative_organization', 'vocabulary_choice', 'self_reflection'],
      used_focuses: ['narrative_organization', 'vocabulary_choice', 'self_reflection'],
    });
    var next = advanceConversationState(s, {
      studentMessage: '继续说',
      engagement: 'high',
      observationFocus: 'value_judgment',
    });
    // selectObservationFocus returns none (already 3 used_focuses)
    assert.strictEqual(next.observation_focus, 'none');
  });

  it('engagement=low 或拒绝话题时 focus=none 且不写 history', function () {
    var s = makeState({
      turn_index: 4, stage: 'deepening', engagement: 'medium',
      focus_history: ['vocabulary_choice'],
      used_focuses: ['vocabulary_choice'],
    });
    var next = advanceConversationState(s, {
      studentMessage: '嗯',
      engagement: 'low',
      observationFocus: 'narrative_organization',
    });
    assert.strictEqual(next.observation_focus, 'none');
    assert.strictEqual(next.focus_history.length, 1); // not increased
  });

});

// ============================================================
//  七、known_facts
// ============================================================

describe('mergeKnownFacts', function () {

  it('空输入返回空数组', function () {
    assert.deepStrictEqual(mergeKnownFacts([], []), []);
    assert.deepStrictEqual(mergeKnownFacts(null, null), []);
    assert.deepStrictEqual(mergeKnownFacts(undefined, undefined), []);
  });

  it('缺少 confidence 被拒绝', function () {
    var result = mergeKnownFacts([], [
      { key: 'sport', value: '篮球' },
    ]);
    assert.strictEqual(result.length, 0);
  });

  it('inferred 被拒绝', function () {
    var result = mergeKnownFacts([], [
      { key: 'sport', value: '篮球', confidence: 'inferred' },
    ]);
    assert.strictEqual(result.length, 0);
  });

  it('implicit 被拒绝', function () {
    var result = mergeKnownFacts([], [
      { key: 'sport', value: '篮球', confidence: 'implicit' },
    ]);
    assert.strictEqual(result.length, 0);
  });

  it('空 key 被拒绝', function () {
    var result = mergeKnownFacts([], [
      { key: '', value: '篮球', confidence: 'explicit' },
    ]);
    assert.strictEqual(result.length, 0);
  });

  it('空 value 被拒绝', function () {
    var result = mergeKnownFacts([], [
      { key: 'sport', value: '', confidence: 'explicit' },
    ]);
    assert.strictEqual(result.length, 0);
  });

  it('纯空格 key 被拒绝', function () {
    var result = mergeKnownFacts([], [
      { key: '   ', value: '篮球', confidence: 'explicit' },
    ]);
    assert.strictEqual(result.length, 0);
  });

  it('纯空格 value 被拒绝', function () {
    var result = mergeKnownFacts([], [
      { key: 'sport', value: '   ', confidence: 'explicit' },
    ]);
    assert.strictEqual(result.length, 0);
  });

  it('explicit 事实被接受', function () {
    var result = mergeKnownFacts([], [
      { key: 'sport', value: '篮球', confidence: 'explicit' },
    ]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, 'sport');
    assert.strictEqual(result[0].confidence, 'explicit');
  });

  it('key/value 输出会 trim', function () {
    var result = mergeKnownFacts([], [
      { key: '  sport  ', value: '  篮球  ', confidence: 'explicit' },
    ]);
    assert.strictEqual(result[0].key, 'sport');
    assert.strictEqual(result[0].value, '篮球');
  });

  it('同 key 同 value 不重复', function () {
    var existing = [{ key: 'sport', value: '篮球', confidence: 'explicit' }];
    var additions = [{ key: 'sport', value: '篮球', confidence: 'explicit' }];
    var result = mergeKnownFacts(existing, additions);
    assert.strictEqual(result.length, 1);
  });

  it('同 key 不同 value 后者覆盖前者', function () {
    var existing = [{ key: 'sport', value: '篮球', confidence: 'explicit' }];
    var additions = [{ key: 'sport', value: '足球', confidence: 'explicit' }];
    var result = mergeKnownFacts(existing, additions);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].value, '足球');
  });

  it('不同 key 正常追加', function () {
    var existing = [{ key: 'sport', value: '篮球', confidence: 'explicit' }];
    var additions = [{ key: 'food', value: '冰淇淋', confidence: 'explicit' }];
    var result = mergeKnownFacts(existing, additions);
    assert.strictEqual(result.length, 2);
  });

  it('key 归一化忽略空格和大小写', function () {
    var existing = [{ key: 'Favorite Sport', value: '篮球', confidence: 'explicit' }];
    var additions = [{ key: 'favoritesport', value: '足球', confidence: 'explicit' }];
    var result = mergeKnownFacts(existing, additions);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].value, '足球');
  });

  it('__proto__ 特殊 key 安全', function () {
    var result = mergeKnownFacts([], [
      { key: '__proto__', value: 'test', confidence: 'explicit' },
    ]);
    // 应正常处理，不抛异常
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, '__proto__');
  });

  it('constructor 特殊 key 安全', function () {
    var result = mergeKnownFacts([], [
      { key: 'constructor', value: 'test', confidence: 'explicit' },
    ]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, 'constructor');
  });

  it('hasOwnProperty 特殊 key 安全', function () {
    var result = mergeKnownFacts([], [
      { key: 'hasOwnProperty', value: 'test', confidence: 'explicit' },
    ]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, 'hasOwnProperty');
  });

  it('不修改 existingFacts 和 additions', function () {
    var existing = [{ key: 'sport', value: '篮球', confidence: 'explicit' }];
    var additions = [{ key: 'food', value: '冰淇淋', confidence: 'explicit' }];
    var eJson = JSON.stringify(existing);
    var aJson = JSON.stringify(additions);
    mergeKnownFacts(existing, additions);
    assert.strictEqual(JSON.stringify(existing), eJson);
    assert.strictEqual(JSON.stringify(additions), aJson);
  });

  it('非法条目安全跳过', function () {
    var result = mergeKnownFacts([], [
      null,
      { not_a_fact: true },
      { key: '', value: '', confidence: 'explicit' },
      { key: 'valid', value: 'ok', confidence: 'explicit' },
    ]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, 'valid');
  });

});

// ============================================================
//  八、deriveEngagement
// ============================================================

describe('deriveEngagement', function () {

  it('非对象输入返回 low', function () {
    assert.strictEqual(deriveEngagement(null), 'low');
    assert.strictEqual(deriveEngagement(undefined), 'low');
    assert.strictEqual(deriveEngagement(123), 'low');
    assert.strictEqual(deriveEngagement('hello'), 'low');
    assert.strictEqual(deriveEngagement([]), 'low');
  });

  it('非字符串 message 返回 low', function () {
    assert.strictEqual(deriveEngagement({ message: null }), 'low');
    assert.strictEqual(deriveEngagement({ message: 123 }), 'low');
  });

  it('空字符串返回 low', function () {
    assert.strictEqual(deriveEngagement({ message: '' }), 'low');
  });

  it('纯空格返回 low', function () {
    assert.strictEqual(deriveEngagement({ message: '   ' }), 'low');
  });

  it('student_refused_topic=true 返回 low', function () {
    assert.strictEqual(deriveEngagement({
      message: '今天天气真好啊我想了很多事情',
      student_refused_topic: true,
    }), 'low');
  });

  it('consecutive_short_replies>=2 返回 low', function () {
    assert.strictEqual(deriveEngagement({
      message: '今天天气真好啊我想了很多事情',
      consecutive_short_replies: 2,
    }), 'low');
    assert.strictEqual(deriveEngagement({
      message: '今天天气真好啊我想了很多事情',
      consecutive_short_replies: 3,
    }), 'low');
  });

  it('1到3个非空字符返回 low', function () {
    assert.strictEqual(deriveEngagement({ message: '嗯' }), 'low');
    assert.strictEqual(deriveEngagement({ message: '好' }), 'low');
    assert.strictEqual(deriveEngagement({ message: '对的' }), 'low');
    assert.strictEqual(deriveEngagement({ message: '是的呢' }), 'low');
  });

  it('4到29个字符返回 medium', function () {
    assert.strictEqual(deriveEngagement({ message: '今天天气不错' }), 'medium');
    assert.strictEqual(deriveEngagement({ message: '我觉得还可以吧' }), 'medium');
  });

  it('30个及以上字符返回 high', function () {
    var msg = '今天体育课我们班和隔壁班打了一场篮球比赛，我投进了一个关键的三分球，全班同学都在为我欢呼';
    assert.strictEqual(deriveEngagement({ message: msg }), 'high');
  });

  it('不检测语义词表（"不知道"等只按长度判断）', function () {
    // "不知道" has 3 chars → low (short message rule)
    assert.strictEqual(deriveEngagement({ message: '不知道' }), 'low');
    // "随便" has 2 chars → low
    assert.strictEqual(deriveEngagement({ message: '随便' }), 'low');
    // "我不知道啊" has 5 chars → medium (not in word list, just length-based)
    assert.strictEqual(deriveEngagement({ message: '我不知道啊' }), 'medium');
  });

});

// ============================================================
//  九、isShortStudentReply
// ============================================================

describe('isShortStudentReply', function () {

  it('< 5 字返回 true', function () {
    assert.strictEqual(isShortStudentReply('嗯'), true);
    assert.strictEqual(isShortStudentReply('好的'), true);
  });

  it('空白不算长度', function () {
    assert.strictEqual(isShortStudentReply(' 嗯 '), true);
  });

  it('>= 5 字返回 false', function () {
    assert.strictEqual(isShortStudentReply('今天天气不错'), false);
  });

  it('非字符串返回 false', function () {
    assert.strictEqual(isShortStudentReply(null), false);
    assert.strictEqual(isShortStudentReply(123), false);
  });

});

// ============================================================
//  十、纯函数（不可变性）
// ============================================================

describe('不可变性', function () {

  it('advanceConversationState 不修改 previousState', function () {
    var prev = createInitialConversationState();
    var prevJson = JSON.stringify(prev);
    advanceConversationState(prev, { studentMessage: 'hello' });
    assert.strictEqual(JSON.stringify(prev), prevJson);
  });

  it('advanceConversationState 不修改 event', function () {
    var event = { studentMessage: 'hello', engagement: 'high', explicitFarewell: true };
    var eventJson = JSON.stringify(event);
    advanceConversationState(createInitialConversationState(), event);
    assert.strictEqual(JSON.stringify(event), eventJson);
  });

  it('mergeKnownFacts 不修改两个输入数组', function () {
    var existing = [{ key: 'a', value: 'v1', confidence: 'explicit' }];
    var additions = [{ key: 'b', value: 'v2', confidence: 'explicit' }];
    var eJson = JSON.stringify(existing);
    var aJson = JSON.stringify(additions);
    mergeKnownFacts(existing, additions);
    assert.strictEqual(JSON.stringify(existing), eJson);
    assert.strictEqual(JSON.stringify(additions), aJson);
  });

  it('normalizeConversationState 不修改 candidate', function () {
    var input = { stage: 'invalid', question_budget: 5, known_facts: [] };
    var copy = JSON.parse(JSON.stringify(input));
    normalizeConversationState(input);
    assert.deepStrictEqual(input, copy);
  });

  it('createInitialConversationState 每次返回新对象', function () {
    var a = createInitialConversationState();
    var b = createInitialConversationState();
    assert.notStrictEqual(a, b);
    assert.notStrictEqual(a.known_facts, b.known_facts);
    assert.notStrictEqual(a.focus_history, b.focus_history);
    assert.notStrictEqual(a.used_focuses, b.used_focuses);
  });

});

// ============================================================
//  十一、综合场景
// ============================================================

describe('综合场景', function () {

  it('完整 opening→interest→deepening→closing（需明确事件）', function () {
    var state = createInitialConversationState();

    // 第1轮
    state = advanceConversationState(state, { studentMessage: '你好小新' });
    assert.strictEqual(state.turn_index, 1);
    assert.strictEqual(state.stage, 'opening');

    // 第2轮 → interest
    state = advanceConversationState(state, {
      studentMessage: '我喜欢打篮球',
      activeTopic: '篮球',
      engagement: 'high',
    });
    assert.strictEqual(state.turn_index, 2);
    assert.strictEqual(state.stage, 'interest');

    // 第3轮 → deepening（需要 allowDeepening + studentAddedNewInfo）
    state = advanceConversationState(state, {
      studentMessage: '投篮需要反复练习才能准确',
      activeTopic: '篮球',
      engagement: 'high',
      allowDeepening: true,
      studentAddedNewInfo: true,
    });
    assert.strictEqual(state.stage, 'deepening');
    assert.strictEqual(state.turn_index, 3);

    // 第4轮 → 保持 deepening（没有 allowDeepening）
    state = advanceConversationState(state, {
      studentMessage: '我们体育老师教了我一个新姿势',
      activeTopic: '篮球',
      engagement: 'high',
      observationFocus: 'narrative_organization',
    });
    assert.strictEqual(state.stage, 'deepening');
    assert.strictEqual(state.observation_focus, 'narrative_organization');

    // 模拟到 turn_index=17
    for (var i = state.turn_index; i < 17; i++) {
      state = advanceConversationState(state, {
        studentMessage: '继续聊篮球' + i,
        activeTopic: '篮球',
        engagement: 'high',
      });
    }
    // 第18轮 → closing
    state = advanceConversationState(state, {
      studentMessage: '今天的练习就到这里',
      activeTopic: '篮球',
      engagement: 'medium',
    });
    assert.strictEqual(state.turn_index, 18);
    assert.strictEqual(state.stage, 'closing');
    assert.strictEqual(state.question_budget, 0);
  });

  it('连续短回复后 question_budget 为 0', function () {
    var s = makeState({
      turn_index: 4, stage: 'interest', engagement: 'medium',
      consecutive_short_replies: 1,
    });
    var next = advanceConversationState(s, {
      studentMessage: '嗯',
      engagement: 'low',
      isShortReply: true,
    });
    assert.strictEqual(next.consecutive_short_replies, 2);
    assert.strictEqual(next.question_budget, 0);
  });

});
