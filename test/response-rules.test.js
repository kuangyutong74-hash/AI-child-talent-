/**
 * test/response-rules.test.js — 回复规则特征测试
 *
 * 为当前已有的规则检测行为建立测试：
 *   1. 能识别"是A还是B"二选一问句
 *   2. 普通开放式问题不会被误判
 *   3. 非首轮回复开头的问候语会被移除
 *   4. 第一轮问候语不会被错误移除
 *   5. farewell 检测的典型正例
 *   6. farewell 检测的典型反例
 *
 * 所有测试调用 lib/legacy-response-rules.js 中的真实函数，
 * 本阶段不修改任何规则含义。
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  hasChoicePattern,
  startsWithGreeting,
  filterGreeting,
  isFarewellReply,
} = require('../lib/core/legacy-response-rules');

// ============================================================
//  二选一检测
// ============================================================

describe('二选一追问检测 — hasChoicePattern', function () {

  it('应识别典型的"是A还是B"句式', function () {
    assert.ok(hasChoicePattern('你是打算去图书馆，还是留在教室里写作业呢？'),
      '"你是…还是…"应被识别为二选一');
  });

  it('应识别"是A还是B?"（问号在B之后）', function () {
    assert.ok(hasChoicePattern('你觉得这个题是选A还是选B？'),
      '带问号的"是…还是…"应被识别');
  });

  it('应识别"A还是B?"（无"是"）', function () {
    assert.ok(hasChoicePattern('我们去看电影还是去打球？'),
      '"…还是…?"应被识别');
  });

  it('应识别"A或者B?"', function () {
    assert.ok(hasChoicePattern('周末去爬山或者去游泳？'),
      '"…或者…?"应被识别');
  });

  it('"还是算了"不应被识别为二选一', function () {
    assert.ok(!hasChoicePattern('外面下雨了，还是算了'),
      '"还是算了"不应被识别');
  });

  it('"还是不要了"不应被识别为二选一', function () {
    assert.ok(!hasChoicePattern('太远了，还是不要去了'),
      '"还是不要"不应被识别');
  });

  it('普通开放式问题不应被误判', function () {
    assert.ok(!hasChoicePattern('你打算怎么学习新招式呀？'),
      '单问句不应被识别为二选一');
  });

  it('陈述句不应被误判', function () {
    assert.ok(!hasChoicePattern('今天天气真的很不错'),
      '陈述句不应被识别');
  });

  it('不含问号的开放问题不应被误判', function () {
    assert.ok(!hasChoicePattern('说说看今天体育课发生了什么'),
      '开放性问题不应被识别');
  });

  it('连续问句中只有一个是二选一结构的应被检测', function () {
    assert.ok(hasChoicePattern('你觉得这个题是选A还是选B？'),
      '含"还是"的问句应被检测');
  });

  it('空字符串不应被误判', function () {
    assert.ok(!hasChoicePattern(''),
      '空字符串不应被识别');
  });

});

// ============================================================
//  问候语检测
// ============================================================

describe('问候语检测 — startsWithGreeting', function () {

  it('"嘿，" 应被识别为问候语开头', function () {
    assert.ok(startsWithGreeting('嘿，今天过得怎样呀？'));
  });

  it('"你好呀～" 应被识别为问候语开头', function () {
    assert.ok(startsWithGreeting('你好呀～今天心情不错呢'));
  });

  it('"嗨" 应被识别为问候语开头', function () {
    assert.ok(startsWithGreeting('嗨，我们又见面啦'));
  });

  it('"好久不见～" 应被识别为问候语开头', function () {
    assert.ok(startsWithGreeting('好久不见～最近还好吗'));
  });

  it('不以问候语开头的文本不应被识别', function () {
    assert.ok(!startsWithGreeting('被妈妈拒绝玩手机了呀，你现在是不是有点小委屈？'));
  });

  it('空字符串不应被识别', function () {
    assert.ok(!startsWithGreeting(''));
  });

  it('正文以"嘿"开头但无逗号也不应有误判风险', function () {
    // "嘿"单独出现，没有逗号分隔，仍应匹配
    assert.ok(startsWithGreeting('嘿 今天的作业写完了吗'));
  });

});

// ============================================================
//  问候语过滤
// ============================================================

describe('问候语过滤 — filterGreeting', function () {

  it('非首轮（第2条用户消息）以"嘿"开头时，应去掉问候部分', function () {
    var reply = '嘿，被妈妈拒绝玩手机了呀，你现在是不是有点小委屈？';
    var filtered = filterGreeting(reply, 2);
    assert.ok(!filtered.startsWith('嘿'),
      '过滤后的回复不应以"嘿"开头');
    assert.ok(filtered.startsWith('被妈妈'),
      '过滤后应直接以正文开头');
  });

  it('非首轮以"你好呀～"开头时应去掉问候部分', function () {
    var reply = '你好呀～今天过得怎么样？';
    var filtered = filterGreeting(reply, 3);
    assert.ok(!filtered.startsWith('你好'),
      '过滤后的回复不应以"你好呀"开头');
    assert.ok(filtered.startsWith('今天'),
      '过滤后应直接以正文开头');
  });

  it('第一轮（首次对话）的问候语不应被移除', function () {
    var reply = '嗨，你好呀～我是小新！你今天心情怎么样呀？';
    var filtered = filterGreeting(reply, 1);
    assert.strictEqual(filtered, reply,
      '首轮回复中的问候语不应被移除');
  });

  it('不以问候语开头的文本应原样返回', function () {
    var reply = '被妈妈拒绝玩手机了呀，你现在是不是有点小委屈？';
    var filtered = filterGreeting(reply, 3);
    assert.strictEqual(filtered, reply,
      '不包含问候语的回复应原样返回');
  });

  it('过滤后如果只剩2个字以下，不应修改原文', function () {
    var reply = '嗨。';  // 去掉"嗨"后只剩1字
    var filtered = filterGreeting(reply, 2);
    assert.strictEqual(filtered, reply,
      '过滤后内容过短时应保留原文');
  });

  it('userMsgCount 为 0 时不应过滤', function () {
    var reply = '嘿，你好呀～今天怎么样？';
    var filtered = filterGreeting(reply, 0);
    assert.strictEqual(filtered, reply,
      'userMsgCount 为 0 时不应过滤');
  });

  it('全文为"好久不见～最近在忙什么呢？"时，非首轮应去掉问候', function () {
    var reply = '好久不见～最近在忙什么呢？';
    var filtered = filterGreeting(reply, 4);
    assert.ok(!filtered.startsWith('好久不见'),
      '非首轮的"好久不见"应被过滤');
    assert.ok(filtered.startsWith('最近'),
      '过滤后应直接以正文开头');
  });

});

// ============================================================
//  Farewell 检测
// ============================================================

describe('收尾检测 — isFarewellReply', function () {

  function makeHistory(userRounds) {
    var h = [];
    for (var i = 0; i < userRounds; i++) {
      h.push({ role: 'user', content: '消息' + (i + 1) });
      h.push({ role: 'assistant', content: '回复' + (i + 1) });
    }
    return h;
  }

  // 正例

  it('轮数 >= 5 且回复含"下次再聊"的应识别为 farewell', function () {
    var history = makeHistory(5);
    assert.ok(isFarewellReply('今天聊得很开心，下次再聊哦！', history),
      '含"下次再聊"且轮数足够应识别为 farewell');
  });

  it('轮数 >= 5 且回复含"拜拜"的应识别为 farewell', function () {
    var history = makeHistory(6);
    assert.ok(isFarewellReply('那今天就到这里吧，拜拜～', history),
      '含"拜拜"且轮数足够应识别为 farewell');
  });

  it('轮数 >= 5 且回复含"期待下次"的应识别为 farewell', function () {
    var history = makeHistory(7);
    assert.ok(isFarewellReply('期待下次继续聊天！', history),
      '含"期待下次"应识别为 farewell');
  });

  it('轮数 >= 5 且回复含"今天先到这儿"的应识别为 farewell', function () {
    var history = makeHistory(8);
    assert.ok(isFarewellReply('那今天先到这儿吧', history),
      '含"今天先到这儿"应识别为 farewell');
  });

  it('轮数 >= 5 且回复含"随时来找小新"的应识别为 farewell', function () {
    var history = makeHistory(5);
    assert.ok(isFarewellReply('不管开心还是不开心，随时来找小新哈', history),
      '含"随时来找小新"应识别为 farewell');
  });

  // 反例

  it('轮数 < 5（仅4轮）时不应识别为 farewell', function () {
    var history = makeHistory(4);
    assert.ok(!isFarewellReply('那下次再聊吧！', history),
      '轮数不够时不应识别为 farewell');
  });

  it('轮数 >= 5 但不含 farewell 关键词的普通回复不应识别', function () {
    var history = makeHistory(6);
    assert.ok(!isFarewellReply('你们班的篮球队真的太厉害了！', history),
      '普通回复不应识别为 farewell');
  });

  it('回复较长且含问句时，即使含 farewell 关键词也不应识别', function () {
    var history = makeHistory(6);
    // 长度 > 30 且含问号
    var reply = '下次再聊之前，我们来说说你最喜欢的运动到底是什么呢？我真的很好奇你打篮球的时候是什么感觉！';
    assert.ok(reply.length > 30 && (reply.includes('？') || reply.includes('?')));
    assert.ok(!isFarewellReply(reply, history),
      '长回复含问句时即使有 farewell 关键词也不应识别');
  });

  it('空回复不应识别为 farewell', function () {
    var history = makeHistory(6);
    assert.ok(!isFarewellReply('', history),
      '空回复不应识别');
  });

  it('仅含"拜拜"但回复很短（不含问号或长度 <= 30）且轮数够的应识别', function () {
    var history = makeHistory(5);
    assert.ok(isFarewellReply('拜拜', history),
      '短 farewell 回复且轮数够应识别');
  });

});
