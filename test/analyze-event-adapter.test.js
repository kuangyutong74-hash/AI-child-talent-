/**
 * test/analyze-event-adapter.test.js — analyze-v2 事件适配器单元测试
 *
 * 覆盖：
 *   A. 输入安全 (10)
 *   B. engagement 和短回复 (6)
 *   C. active topic 与 focus (7)
 *   D. known facts (9)
 *   E. state_events (16)
 *   F. 禁止生成的字段 (3)
 *   G. finalizeConversationStateAfterReply (14)
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

var adapter = require('../lib/core/analyze-event-adapter');
var cs = require('../lib/core/conversation-state');

function basicAnalysis(overrides) {
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

function interestState() {
  return cs.normalizeConversationState({
    turn_index: 2,
    stage: 'interest',
    question_budget: 1,
    engagement: 'medium',
    observation_focus: 'none',
  });
}

function deepeningState() {
  return cs.normalizeConversationState({
    turn_index: 6,
    stage: 'deepening',
    question_budget: 1,
    engagement: 'high',
    active_topic: '篮球',
    observation_focus: 'narrative_organization',
  });
}

// ============================================================
//  A. 输入安全
// ============================================================

describe('buildConversationEvent — 输入安全', function () {

  it('null 不抛异常', function () {
    var event = adapter.buildConversationEvent(null);
    assert.deepStrictEqual(event, {});
  });

  it('analysis=null 安全', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: null,
      studentMessage: '你好',
    });
    assert.ok(typeof event === 'object');
    assert.ok(!Array.isArray(event));
  });

  it('analysis=[] 安全', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: [],
      studentMessage: '你好',
    });
    assert.ok(typeof event === 'object');
  });

  it('state_events=null 安全', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: { state_events: null },
      studentMessage: '你好',
    });
    assert.strictEqual(event.studentAddedNewInfo, false);
  });

  it('state_events=[] 安全', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: { state_events: [] },
      studentMessage: '你好',
    });
    assert.strictEqual(event.studentAddedNewInfo, false);
  });

  it('Object.create(null) input 安全', function () {
    var input = Object.create(null);
    input.previousState = interestState();
    input.analysis = basicAnalysis();
    input.studentMessage = '你好';
    var event = adapter.buildConversationEvent(input);
    assert.ok(typeof event === 'object');
  });

  it('Object.create(null) analysis 安全', function () {
    var analysis = Object.create(null);
    analysis.engagement = 'high';
    analysis.state_events = Object.create(null);
    analysis.state_events.student_added_new_info = true;
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '我今天学了新东西',
    });
    assert.strictEqual(event.studentAddedNewInfo, true);
  });

  it('Object.create(null) state_events 安全', function () {
    var se = Object.create(null);
    se.student_added_new_info = true;
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: { state_events: se },
      studentMessage: 'ok',
    });
    assert.strictEqual(event.studentAddedNewInfo, true);
  });

  it('studentMessage 非字符串 安全', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis(),
      studentMessage: 123,
    });
    assert.ok(typeof event === 'object');
    // 非字符串 message → 变为 '' → isShortStudentReply('') = true（0 < 5）
    assert.strictEqual(event.isShortReply, true,
      '非字符串 message 变为空串，isShortStudentReply 判定为短回复');
  });

  it('不修改任何输入', function () {
    var prev = interestState();
    var analysis = basicAnalysis();
    var msg = '测试消息';
    var prevJson = JSON.stringify(prev);
    var analysisJson = JSON.stringify(analysis);

    adapter.buildConversationEvent({
      previousState: prev,
      analysis: analysis,
      studentMessage: msg,
    });

    assert.strictEqual(JSON.stringify(prev), prevJson);
    assert.strictEqual(JSON.stringify(analysis), analysisJson);
  });

});

// ============================================================
//  B. engagement 和短回复
// ============================================================

describe('buildConversationEvent — engagement 和短回复', function () {

  it('isShortReply 只由 isShortStudentReply 计算', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis(),
      studentMessage: '嗯',
    });
    assert.strictEqual(event.isShortReply, true,
      '短消息应被判定为短回复');
  });

  it('合法 analysis.engagement 被采用', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({ engagement: 'high' }),
      studentMessage: '今天很有意思',
    });
    assert.strictEqual(event.engagement, 'high');
  });

  it('非法 engagement 使用 deriveEngagement', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({ engagement: 'extreme' }),
      studentMessage: '今天的篮球课特别有趣，我们练习了三分球投篮技术，还打了比赛，非常开心',
    });
    // 30+ 字符 → deriveEngagement 返回 high
    assert.strictEqual(event.engagement, 'high',
      '长消息 fallback 应为 high');
  });

  it('空消息 fallback 为 low', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({ engagement: 'invalid' }),
      studentMessage: '',
    });
    assert.strictEqual(event.engagement, 'low',
      '空消息应 fallback 为 low');
  });

  it('连续短回复达到阈值时 fallback 为 low', function () {
    var prev = cs.normalizeConversationState({
      turn_index: 5,
      stage: 'interest',
      consecutive_short_replies: 2,
    });

    var event = adapter.buildConversationEvent({
      previousState: prev,
      analysis: basicAnalysis({ engagement: 'invalid' }),
      studentMessage: '嗯',
    });

    assert.strictEqual(event.engagement, 'low',
      '连续3次短回复应 fallback 为 low');
  });

  it('student_refused_topic=true 时 fallback 为 low', function () {
    var analysis = basicAnalysis({ engagement: 'invalid' });
    analysis.state_events.student_refused_topic = true;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '不想聊了',
    });

    assert.strictEqual(event.engagement, 'low');
  });

});

// ============================================================
//  C. active topic 与 focus
// ============================================================

describe('buildConversationEvent — active topic 与 focus', function () {

  it('选择第一个合法 active topic', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        active_topics: [
          { topic: '篮球', initiated_by_student: true },
          { topic: '游戏', initiated_by_student: false },
        ],
      }),
      studentMessage: '今天打球了',
    });
    assert.strictEqual(event.activeTopic, '篮球');
  });

  it('跳过无效 active topic 条目', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        active_topics: [
          null,
          { not_topic: 'wrong' },
          { topic: '' },
          { topic: '   ' },
          { topic: '足球' },
        ],
      }),
      studentMessage: '踢球了',
    });
    assert.strictEqual(event.activeTopic, '足球');
  });

  it('active topic 会 trim', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        active_topics: [{ topic: '  篮球  ' }],
      }),
      studentMessage: '打球',
    });
    assert.strictEqual(event.activeTopic, '篮球');
  });

  it('没有合法 topic 时不输出 activeTopic', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({ active_topics: [] }),
      studentMessage: '嗯',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'activeTopic'),
      false,
      '无合法 topic 不应有 activeTopic 字段'
    );
  });

  it('合法 suggested_next_focus 被输出', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({ suggested_next_focus: 'self_reflection' }),
      studentMessage: '我想了一下',
    });
    assert.strictEqual(event.observationFocus, 'self_reflection');
  });

  it('非法 focus 不输出 observationFocus', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({ suggested_next_focus: 'magic_power' }),
      studentMessage: 'ok',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'observationFocus'),
      false,
      '非法 focus 不应输出'
    );
  });

  it('缺失 focus 不覆盖旧状态', function () {
    // 删除 suggested_next_focus 字段，basicAnalysis 默认有 'none' 是合法的
    var analysis = basicAnalysis();
    delete analysis.suggested_next_focus;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '好',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'observationFocus'),
      false,
      '缺失 focus 不应输出该字段'
    );
  });

});

// ============================================================
//  D. known facts
// ============================================================

describe('buildConversationEvent — known facts', function () {

  it('只输出 explicit 事实', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        known_facts_to_add: [
          { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'explicit' },
          { key: 'food', value: '面条', source_quote: 'b', confidence: 'inferred' },
        ],
      }),
      studentMessage: 'test',
    });
    assert.strictEqual(event.knownFactsToAdd.length, 1);
    assert.strictEqual(event.knownFactsToAdd[0].key, 'sport');
    assert.strictEqual(event.knownFactsToAdd[0].value, '篮球');
  });

  it('inferred 被拒绝', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        known_facts_to_add: [
          { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'inferred' },
        ],
      }),
      studentMessage: 'test',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'knownFactsToAdd'),
      false,
      'inferred 全部拒绝后不应输出 knownFactsToAdd'
    );
  });

  it('implicit 被拒绝', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        known_facts_to_add: [
          { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'implicit' },
        ],
      }),
      studentMessage: 'test',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'knownFactsToAdd'),
      false
    );
  });

  it('缺失 confidence 被拒绝', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        known_facts_to_add: [
          { key: 'sport', value: '篮球' },
        ],
      }),
      studentMessage: 'test',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'knownFactsToAdd'),
      false
    );
  });

  it('空 key/value 被拒绝', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        known_facts_to_add: [
          { key: '', value: '篮球', source_quote: 'a', confidence: 'explicit' },
          { key: 'sport', value: '', source_quote: 'b', confidence: 'explicit' },
        ],
      }),
      studentMessage: 'test',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'knownFactsToAdd'),
      false
    );
  });

  it('同 key 去重', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        known_facts_to_add: [
          { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'explicit' },
          { key: 'sport', value: '篮球', source_quote: 'b', confidence: 'explicit' },
        ],
      }),
      studentMessage: 'test',
    });
    assert.strictEqual(event.knownFactsToAdd.length, 1);
  });

  it('同 key 不同 value 保留后者', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        known_facts_to_add: [
          { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'explicit' },
          { key: 'sport', value: '足球', source_quote: 'b', confidence: 'explicit' },
        ],
      }),
      studentMessage: 'test',
    });
    assert.strictEqual(event.knownFactsToAdd.length, 1);
    assert.strictEqual(event.knownFactsToAdd[0].value, '足球');
  });

  it('特殊 key 安全', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis({
        known_facts_to_add: [
          { key: '__proto__', value: 'test', source_quote: 'a', confidence: 'explicit' },
        ],
      }),
      studentMessage: 'test',
    });
    assert.strictEqual(event.knownFactsToAdd.length, 1);
  });

  it('不修改 analyze.known_facts_to_add', function () {
    var facts = [
      { key: 'sport', value: ' 篮球 ', source_quote: 'a', confidence: 'explicit' },
    ];
    var analysis = basicAnalysis({ known_facts_to_add: facts });
    var jsonBefore = JSON.stringify(facts);

    adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: 'test',
    });

    assert.strictEqual(JSON.stringify(facts), jsonBefore,
      'known_facts_to_add 不应被修改');
  });

});

// ============================================================
//  E. state_events
// ============================================================

describe('buildConversationEvent — state_events', function () {

  it('六个字段正确映射', function () {
    var analysis = basicAnalysis();
    analysis.state_events.student_added_new_info = true;
    analysis.state_events.student_refused_topic = true;
    analysis.state_events.open_task_completed = true;
    analysis.state_events.explicit_farewell = true;
    analysis.state_events.allow_deepening = true;
    analysis.state_events.allow_open_task = true;

    // 使用 open_task 阶段来测 openTaskCompleted
    var prev = cs.normalizeConversationState({
      turn_index: 8,
      stage: 'open_task',
      engagement: 'high',
      active_topic: '篮球',
    });

    var event = adapter.buildConversationEvent({
      previousState: prev,
      analysis: analysis,
      studentMessage: '我做完了',
    });

    assert.strictEqual(event.studentAddedNewInfo, true);
    assert.strictEqual(event.studentRefusedTopic, true);
    assert.strictEqual(event.openTaskCompleted, true);
    assert.strictEqual(event.explicitFarewell, true);
    // allowDeepening=false 因为 stage 不是 interest
    assert.strictEqual(event.allowDeepening, false);
    // allowOpenTask=false 因为 stage 不是 deepening
    assert.strictEqual(event.allowOpenTask, false);
  });

  it('字符串 "true" 不得当作 true', function () {
    var se = Object.create(null);
    se.student_added_new_info = 'true';
    se.student_refused_topic = false;
    se.open_task_completed = false;
    se.explicit_farewell = false;
    se.allow_deepening = false;
    se.allow_open_task = false;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: { state_events: se },
      studentMessage: 'ok',
    });

    assert.strictEqual(event.studentAddedNewInfo, false,
      '字符串 "true" 不应被当作 true');
  });

  it('数字 1 不得当作 true', function () {
    var se = Object.create(null);
    se.student_added_new_info = 1;
    se.student_refused_topic = false;
    se.open_task_completed = false;
    se.explicit_farewell = false;
    se.allow_deepening = false;
    se.allow_open_task = false;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: { state_events: se },
      studentMessage: 'ok',
    });

    assert.strictEqual(event.studentAddedNewInfo, false,
      '数字 1 不应被当作 true');
  });

  it('studentRefusedTopic=false 能显式输出', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis(),
      studentMessage: '好',
    });
    assert.strictEqual(event.studentRefusedTopic, false,
      'studentRefusedTopic=false 应显式输出');
  });

  it('studentMessage 含"再见"但 explicit_farewell=false 时不得告别', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis(),
      studentMessage: '我和他昨天说了再见',
    });
    assert.strictEqual(event.explicitFarewell, false,
      '文本含"再见"但 analyze 判定 false 时不应告别');
  });

  it('explicit_farewell=true 时输出 true', function () {
    var analysis = basicAnalysis();
    analysis.state_events.explicit_farewell = true;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '拜拜',
    });
    assert.strictEqual(event.explicitFarewell, true);
  });

  it('openTaskCompleted 只在 open_task 阶段为 true', function () {
    // interest 阶段即使分析说 completed 也不应输出 true
    var analysis = basicAnalysis();
    analysis.state_events.open_task_completed = true;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '做完了',
    });
    assert.strictEqual(event.openTaskCompleted, false,
      'interest 阶段不应输出 openTaskCompleted=true');
  });

  it('opening 阶段 allowDeepening=false', function () {
    var openingState = cs.createInitialConversationState();
    var analysis = basicAnalysis();
    analysis.state_events.student_added_new_info = true;
    analysis.state_events.allow_deepening = true;

    var event = adapter.buildConversationEvent({
      previousState: openingState,
      analysis: analysis,
      studentMessage: '今天我去看了恐龙展，超多化石！',
    });

    assert.strictEqual(event.allowDeepening, false,
      'opening 阶段 allowDeepening 必须为 false');
  });

  it('interest 阶段缺少新增信息时 allowDeepening=false', function () {
    var analysis = basicAnalysis();
    analysis.state_events.allow_deepening = true;
    // student_added_new_info 保持 false

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '嗯',
    });

    assert.strictEqual(event.studentAddedNewInfo, false);
    assert.strictEqual(event.allowDeepening, false,
      '缺少 studentAddedNewInfo 时不应 allowDeepening');
  });

  it('interest 阶段全部条件满足时 allowDeepening=true', function () {
    var analysis = basicAnalysis({ engagement: 'high' });
    analysis.state_events.student_added_new_info = true;
    analysis.state_events.allow_deepening = true;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '我以前看过一部恐龙纪录片，里面说有些恐龙是长羽毛的',
    });

    assert.strictEqual(event.allowDeepening, true);
  });

  it('engagement=low 时 allowDeepening=false', function () {
    var prev = cs.normalizeConversationState({
      turn_index: 5,
      stage: 'interest',
      engagement: 'low',
    });

    var analysis = basicAnalysis({ engagement: 'invalid' });
    analysis.state_events.student_added_new_info = true;
    analysis.state_events.allow_deepening = true;

    var event = adapter.buildConversationEvent({
      previousState: prev,
      analysis: analysis,
      studentMessage: '嗯嗯',
    });

    // derived from deriveEngagement with short message → 'low'
    assert.strictEqual(event.allowDeepening, false,
      'engagement=low 时不应 allowDeepening');
  });

  it('拒绝话题时 allowDeepening=false', function () {
    var analysis = basicAnalysis();
    analysis.state_events.student_added_new_info = true;
    analysis.state_events.student_refused_topic = true;
    analysis.state_events.allow_deepening = true;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '不想聊这个',
    });

    assert.strictEqual(event.allowDeepening, false,
      '拒绝话题时不应 allowDeepening');
  });

  it('deepening 阶段全部条件满足时 allowOpenTask=true', function () {
    var analysis = basicAnalysis({ engagement: 'high' });
    analysis.state_events.allow_open_task = true;

    var event = adapter.buildConversationEvent({
      previousState: deepeningState(),
      analysis: analysis,
      studentMessage: '我想设计一个特别的训练计划',
    });

    assert.strictEqual(event.allowOpenTask, true);
  });

  it('非 deepening 阶段 allowOpenTask=false', function () {
    var analysis = basicAnalysis({ engagement: 'high' });
    analysis.state_events.allow_open_task = true;

    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: analysis,
      studentMessage: '我想做个任务',
    });

    assert.strictEqual(event.allowOpenTask, false,
      'interest 阶段不应 allowOpenTask');
  });

  it('engagement=low 时 allowOpenTask=false', function () {
    var prev = cs.normalizeConversationState({
      turn_index: 8,
      stage: 'deepening',
      engagement: 'low',
      active_topic: '篮球',
    });

    var analysis = basicAnalysis({ engagement: 'invalid' });
    analysis.state_events.allow_open_task = true;

    var event = adapter.buildConversationEvent({
      previousState: prev,
      analysis: analysis,
      studentMessage: '哦',
    });

    // derived from deriveEngagement with short message → 'low'
    assert.strictEqual(event.allowOpenTask, false);
  });

  it('拒绝话题时 allowOpenTask=false', function () {
    var analysis = basicAnalysis({ engagement: 'high' });
    analysis.state_events.student_refused_topic = true;
    analysis.state_events.allow_open_task = true;

    var event = adapter.buildConversationEvent({
      previousState: deepeningState(),
      analysis: analysis,
      studentMessage: '不想做了',
    });

    assert.strictEqual(event.allowOpenTask, false);
  });

});

// ============================================================
//  F. 禁止生成的字段
// ============================================================

describe('buildConversationEvent — 禁止生成的字段', function () {

  it('event 不包含 previousAssistantAsked', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis(),
      studentMessage: '你好',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'previousAssistantAsked'),
      false
    );
  });

  it('event 不包含 assistantAsked', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis(),
      studentMessage: '你好',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'assistantAsked'),
      false
    );
  });

  it('event 不包含 forceClosing', function () {
    var event = adapter.buildConversationEvent({
      previousState: interestState(),
      analysis: basicAnalysis(),
      studentMessage: '你好',
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(event, 'forceClosing'),
      false
    );
  });

});

// ============================================================
//  G. finalizeConversationStateAfterReply
// ============================================================

describe('finalizeConversationStateAfterReply', function () {

  it('question_count=0 → previous_assistant_asked=false', function () {
    var state = interestState();
    var result = adapter.finalizeConversationStateAfterReply(
      state,
      { valid: true, errors: [], question_count: 0, sentence_count: 1 }
    );
    assert.strictEqual(result.previous_assistant_asked, false);
  });

  it('question_count=1 → previous_assistant_asked=true', function () {
    var state = interestState();
    var result = adapter.finalizeConversationStateAfterReply(
      state,
      { valid: true, errors: [], question_count: 1, sentence_count: 1 }
    );
    assert.strictEqual(result.previous_assistant_asked, true);
  });

  it('question_count>1 → previous_assistant_asked=true', function () {
    var result = adapter.finalizeConversationStateAfterReply(
      interestState(),
      { question_count: 3 }
    );
    assert.strictEqual(result.previous_assistant_asked, true);
  });

  it('非法 validationResult → true (fail closed)', function () {
    var result = adapter.finalizeConversationStateAfterReply(
      interestState(),
      null
    );
    assert.strictEqual(result.previous_assistant_asked, true,
      'null validationResult 应变 true');
  });

  it('非法 question_count → true', function () {
    var result = adapter.finalizeConversationStateAfterReply(
      interestState(),
      { question_count: 'many' }
    );
    assert.strictEqual(result.previous_assistant_asked, true);
  });

  it('更新后重新计算 question_budget', function () {
    var state = cs.normalizeConversationState({
      turn_index: 2,
      stage: 'interest',
      question_budget: 1,
      engagement: 'high',
    });

    var result = adapter.finalizeConversationStateAfterReply(
      state,
      { question_count: 1 }
    );

    assert.strictEqual(result.previous_assistant_asked, true);
    assert.strictEqual(result.question_budget, 0,
      'previous_assistant_asked=true 时 budget 应为 0');
  });

  it('previous_assistant_asked=true 时 budget=0', function () {
    var result = adapter.finalizeConversationStateAfterReply(
      interestState(),
      { question_count: 2 }
    );
    assert.strictEqual(result.previous_assistant_asked, true);
    assert.strictEqual(result.question_budget, 0);
  });

  it('不增加 turn_index', function () {
    var state = cs.normalizeConversationState({
      turn_index: 5,
      stage: 'interest',
    });
    var result = adapter.finalizeConversationStateAfterReply(
      state,
      { question_count: 0 }
    );
    assert.strictEqual(result.turn_index, 5);
  });

  it('不改变 stage', function () {
    var state = cs.normalizeConversationState({
      turn_index: 5,
      stage: 'deepening',
    });
    var result = adapter.finalizeConversationStateAfterReply(
      state,
      { question_count: 0 }
    );
    assert.strictEqual(result.stage, 'deepening');
  });

  it('不改变 known_facts', function () {
    var state = cs.normalizeConversationState({
      turn_index: 3,
      stage: 'interest',
      known_facts: [
        { key: 'sport', value: '篮球', source_quote: 'a', confidence: 'explicit' },
      ],
    });
    var result = adapter.finalizeConversationStateAfterReply(
      state,
      { question_count: 0 }
    );
    assert.strictEqual(result.known_facts.length, 1);
  });

  it('不修改 state 输入', function () {
    var state = cs.normalizeConversationState({
      turn_index: 3,
      stage: 'deetening',
      previous_assistant_asked: false,
    });
    var jsonBefore = JSON.stringify(state);

    adapter.finalizeConversationStateAfterReply(
      state,
      { question_count: 1 }
    );

    assert.strictEqual(JSON.stringify(state), jsonBefore);
  });

  it('不修改 validationResult 输入', function () {
    var vr = { valid: true, errors: [], question_count: 2, sentence_count: 2 };
    var jsonBefore = JSON.stringify(vr);

    adapter.finalizeConversationStateAfterReply(
      interestState(),
      vr
    );

    assert.strictEqual(JSON.stringify(vr), jsonBefore);
  });

  it('Object.create(null) 输入安全', function () {
    var state = Object.create(null);
    state.turn_index = 3;
    state.stage = 'interest';

    var vr = Object.create(null);
    vr.question_count = 0;

    var result = adapter.finalizeConversationStateAfterReply(state, vr);
    assert.strictEqual(result.previous_assistant_asked, false);
  });

  it('相同输入产生相同输出', function () {
    var state = interestState();
    var vr = { question_count: 0 };

    var r1 = adapter.finalizeConversationStateAfterReply(state, vr);
    var r2 = adapter.finalizeConversationStateAfterReply(state, vr);

    assert.deepStrictEqual(r1, r2);
  });

});

// ============================================================
//  综合场景
// ============================================================

describe('综合场景', function () {

  it('完整事件构建 → advance → finalize 链路', function () {
    // 模拟 interest 阶段，学生带来新信息
    var prev = interestState();

    var analysis = basicAnalysis({ engagement: 'high' });
    analysis.active_topics.push({ topic: ' 恐龙 ', initiated_by_student: true });
    analysis.suggested_next_focus = 'interest_depth_breadth';
    analysis.state_events.student_added_new_info = true;
    analysis.state_events.allow_deepening = true;
    analysis.known_facts_to_add.push(
      { key: 'interest', value: '恐龙', source_quote: '喜欢恐龙', confidence: 'explicit' }
    );

    var event = adapter.buildConversationEvent({
      previousState: prev,
      analysis: analysis,
      studentMessage: '我最近看了好多恐龙的书，霸王龙最厉害！',
    });

    // 验证 event 内容
    assert.strictEqual(event.activeTopic, '恐龙');
    assert.strictEqual(event.observationFocus, 'interest_depth_breadth');
    assert.strictEqual(event.engagement, 'high');
    assert.strictEqual(event.studentAddedNewInfo, true);
    assert.strictEqual(event.studentRefusedTopic, false);
    assert.strictEqual(event.allowDeepening, true);
    assert.strictEqual(event.allowOpenTask, false);
    assert.strictEqual(event.knownFactsToAdd.length, 1);

    // 推进状态机
    var next = cs.advanceConversationState(prev, event);
    assert.strictEqual(next.stage, 'deepening',
      '满足条件时应进入 deepening');

    // finalize
    var finalized = adapter.finalizeConversationStateAfterReply(
      next,
      { question_count: 1 }
    );

    assert.strictEqual(finalized.previous_assistant_asked, true);
    assert.strictEqual(finalized.question_budget, 0);
    // stage/turn_index 保持不变
    assert.strictEqual(finalized.stage, 'deepening');
  });

});
