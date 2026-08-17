/**
 * test/prompt-builder.test.js — Prompt 组装测试
 *
 * 对当前尚未重构的 buildSystemContent / buildMessagesForAI 建立特征测试：
 *   1. 空历史时 systemContent 等于原始 SYSTEM_PROMPT
 *   2. 非首轮时 systemContent 包含 continuationRule
 *   3. 连续短回复满足条件时 systemContent 包含 notebookHint
 *   4. buildMessagesForAI 去掉 topicSource、_ts 等内部字段
 *
 * 本阶段不修改任何 Prompt 内容和规则，只验证当前组装行为。
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// 直接读取真实 Prompt 文件进行特征测试
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '..', 'prompts', 'xiaoxin.md'),
  'utf-8'
);

// 导入被测函数
const {
  computeNotebookHint,
  buildContinuationRule,
  buildSystemContent,
  buildMessagesForAI,
} = require('../lib/core/prompt-builder');

// ============================================================
//  Prompt 组装测试
// ============================================================

describe('Prompt 组装', function () {

  // ----------------------------------------------------------
  //  buildSystemContent — 基础行为
  // ----------------------------------------------------------

  it('空历史（0条消息）时 systemContent 应等于原始 SYSTEM_PROMPT', function () {
    var history = [];
    var result = buildSystemContent(SYSTEM_PROMPT, history);
    assert.strictEqual(result, SYSTEM_PROMPT,
      '空历史时不应附加任何额外文本');
  });

  it('首轮（只有1条用户消息）时 systemContent 应等于原始 SYSTEM_PROMPT', function () {
    var history = [
      { role: 'user', content: '我今天的心情是晴空万里' },
    ];
    var result = buildSystemContent(SYSTEM_PROMPT, history);
    assert.strictEqual(result, SYSTEM_PROMPT,
      '首轮时不应附加 continuationRule');
  });

  it('非首轮（2条及以上用户消息）时 systemContent 应包含 continuationRule', function () {
    var history = [
      { role: 'user', content: '我今天的心情是晴空万里' },
      { role: 'assistant', content: '哇，心情很好呀！有什么开心的事吗？' },
      { role: 'user', content: '嗯，今天发生了一些好玩的事' },
    ];
    var result = buildSystemContent(SYSTEM_PROMPT, history);

    assert.ok(result.length > SYSTEM_PROMPT.length,
      '非首轮时 systemContent 应比原始 SYSTEM_PROMPT 长');
    assert.ok(result.includes('历史续接模式'),
      '非首轮时 systemContent 应包含历史续接模式提示');
    assert.ok(result.includes('绝对禁止重新自我介绍'),
      '非首轮时 systemContent 应包含禁止重新自我介绍的规则');
  });

  it('连续两轮短回复（均<5字）时 systemContent 应包含 notebookHint', function () {
    var history = [
      { role: 'user', content: '我喜欢打篮球，今天放学后去操场练习新学的投篮姿势了' },
      { role: 'assistant', content: '好厉害呀！新姿势是什么样子的？' },
      { role: 'user', content: '嗯' },          // 短回复
      { role: 'assistant', content: '嗯？怎么啦，不想多说两句吗？' },
      { role: 'user', content: '好的' },        // 连续第二轮短回复
    ];
    var result = buildSystemContent(SYSTEM_PROMPT, history);

    assert.ok(result.includes('小新的笔记本提醒'),
      '连续两轮短回复时 systemContent 应包含 notebookHint');
    assert.ok(result.includes('学生已经连续两轮回复很短'),
      'notebookHint 应提及连续短回复');
  });

  it('只有一轮短回复（未连续两轮）时系统 systemContent 不应包含 notebookHint', function () {
    var history = [
      { role: 'user', content: '今天体育课打篮球超开心的，投了好几个三分球' },
      { role: 'assistant', content: '投三分球太厉害了！都投进了吗？' },
      { role: 'user', content: '嗯' },          // 仅一轮短回复
    ];
    var result = buildSystemContent(SYSTEM_PROMPT, history);

    // 非首轮，应有 continuationRule 但不应有 notebookHint
    assert.ok(result.includes('历史续接模式'),
      '非首轮应有 continuationRule');
    assert.ok(!result.includes('小新的笔记本提醒'),
      '仅一轮短回复时不应包含 notebookHint');
  });

  // ----------------------------------------------------------
  //  computeNotebookHint — 独立单元测试
  // ----------------------------------------------------------

  it('computeNotebookHint 在两轮短回复时应返回 hint', function () {
    var history = [
      { role: 'user', content: '今天体育课和朋友练了好久投篮' },
      { role: 'assistant', content: '练习投篮很认真呀！进步快吗？' },
      { role: 'user', content: '还行' },
      { role: 'assistant', content: '还行的话就是进步啦～' },
      { role: 'user', content: '嗯' },
    ];
    var result = computeNotebookHint(history);
    assert.strictEqual(result.isShortReplies, true,
      '应检测到连续短回复');
    assert.ok(result.notebookHint.length > 0,
      '应返回 notebookHint 文本');
    assert.ok(result.notebookHint.includes('体育课和朋友练了好久投篮'),
      'notebookHint 应引用之前聊到的具体内容');
  });

  it('computeNotebookHint 在仅一轮短回复时应返回空 hint', function () {
    var history = [
      { role: 'user', content: '今天篮球比赛赢了' },
      { role: 'assistant', content: '恭喜呀！比分是多少？' },
      { role: 'user', content: '嗯' },
    ];
    var result = computeNotebookHint(history);
    assert.strictEqual(result.isShortReplies, false,
      '不应检测到连续短回复');
    assert.strictEqual(result.notebookHint, '',
      'notebookHint 应为空字符串');
  });

  // ----------------------------------------------------------
  //  buildContinuationRule — 独立单元测试
  // ----------------------------------------------------------

  it('buildContinuationRule 在无历史用户消息时应返回空字符串', function () {
    var history = [];
    var result = buildContinuationRule(history);
    assert.strictEqual(result, '',
      '空历史不应生成续接规则');
  });

  it('buildContinuationRule 在首轮时应返回空字符串', function () {
    var history = [
      { role: 'user', content: '我今天的心情是有点沉闷' },
    ];
    var result = buildContinuationRule(history);
    assert.strictEqual(result, '',
      '首轮不应生成续接规则');
  });

  it('buildContinuationRule 在非首轮时应返回续接规则', function () {
    var history = [
      { role: 'user', content: '我今天的心情是有点沉闷' },
      { role: 'assistant', content: '怎么啦，是遇到什么烦心事了吗？' },
      { role: 'user', content: '嗯，今天作业好多' },
    ];
    var result = buildContinuationRule(history);
    assert.ok(result.includes('历史续接模式'),
      '非首轮应生成续接规则');
    assert.ok(result.includes('绝对禁止重新自我介绍'),
      '续接规则应包含禁止重新自我介绍的指令');
  });

  // ----------------------------------------------------------
  //  buildMessagesForAI — 字段过滤
  // ----------------------------------------------------------

  it('buildMessagesForAI 应去掉 topicSource 和 _ts 字段', function () {
    var history = [
      { role: 'user', content: 'hello', topicSource: 'normal', _ts: Date.now() },
      { role: 'assistant', content: 'hi' },
    ];
    var result = buildMessagesForAI(history);

    assert.strictEqual(result.length, 2, '应保留所有消息');
    assert.strictEqual(result[0].role, 'user');
    assert.strictEqual(result[0].content, 'hello');
    assert.strictEqual(result[0].topicSource, undefined,
      'topicSource 应被过滤');
    assert.strictEqual(result[0]._ts, undefined,
      '_ts 应被过滤');
    assert.strictEqual(result[1].role, 'assistant');
    assert.strictEqual(result[1].content, 'hi');
  });

  it('buildMessagesForAI 返回的消息只包含 role 和 content', function () {
    var history = [
      { role: 'user', content: 'test', extra: 'should-be-removed', meta: 123 },
    ];
    var result = buildMessagesForAI(history);
    var keys = Object.keys(result[0]);
    assert.deepStrictEqual(keys, ['role', 'content'],
      '每条消息应只包含 role 和 content 两个字段');
  });

});
