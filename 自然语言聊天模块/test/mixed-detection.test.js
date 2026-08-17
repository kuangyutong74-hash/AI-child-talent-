/**
 * test/mixed-detection.test.js (v2.0 适配版)
 *
 * 验证 rubric v2.0 的 mixed 检测 + consistentlyNegative + isStale 逻辑。
 * 直接引用 lib/rubric-computer.js 真实模块，不再内嵌副本。
 */

'use strict';

var rubricMod = require('../lib/core/rubric-computer');
var computeRubric = rubricMod.computeRubric;
var PATTERN_DIRECTION = rubricMod.PATTERN_DIRECTION;
var DIM_INDICATORS = rubricMod.DIM_INDICATORS;

var RUBRIC_OPTS = { now: Date.parse('2026-07-30T12:00:00+08:00'), windowDays: 90, freshnessDays: 30 };

function makeInsight(id, dim, ind, pattern, convId, topic, opts) {
  opts = opts || {};
  return {
    id: id,
    dimension: dim,
    indicator: ind,
    pattern: pattern,
    conversationId: convId,
    topic: topic || '默认话题',
    evidenceSnippet: '测试证据片段-' + id,
    signal: '测试信号说明',
    strengthNote: '【中等证据】',
    strength: opts.strength || 'moderate',
    isWeakSignal: opts.isWeakSignal || false,
    wasPrompted: opts.wasPrompted || false,
    reviewStatus: opts.reviewStatus || 'unreviewed',
    observedAt: opts.observedAt || ('2026-07-' + (10 + parseInt(id.replace(/\D/g, '').slice(-1) || 0)) + 'T10:00:00Z'),
  };
}

function runTestCase(name, insights) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  测试案例：' + name);
  console.log('═══════════════════════════════════════════════════════════');

  console.log('\n📋 输入证据：');
  for (var i = 0; i < insights.length; i++) {
    var ins = insights[i];
    var p = ins.pattern || '(无pattern)';
    console.log('  [' + ins.id + '] ' + ins.indicator +
      ' | observedAt=' + ins.observedAt +
      ' | pattern=' + p +
      ' | strength=' + (ins.strength || '?') +
      ' | topic=' + ins.topic +
      ' | conv=' + ins.conversationId);
  }

  var result = computeRubric(insights, RUBRIC_OPTS);

  console.log('\n📊 各指标结果：');
  for (var indKey in result.indicators) {
    if (!Object.prototype.hasOwnProperty.call(result.indicators, indKey)) continue;
    var ind = result.indicators[indKey];
    if (ind.evidenceCount === 0) continue;

    var statusIcon = ind.consistentlyNegative ? '🔴 NEG' : ind.mixed ? '⚠️ MIXED' : '✅';
    var levelInfo = ind.consistentlyNegative
      ? 'consistentlyNegative → cappedLevel=0'
      : ind.mixed
        ? 'base=' + ind.level + ' → capped=' + ind.cappedLevel
        : 'level=' + ind.level;

    console.log('  ' + statusIcon + ' ' + indKey + ': ' + levelInfo +
      ' | posDays=' + ind.positiveDayCount +
      ' | negDays=' + ind.negativeDayCount +
      ' | neutralDays=' + ind.neutralDayCount +
      ' | posSessions=' + ind.posConvCount +
      ' | negSessions=' + ind.negConvCount +
      ' | mixed=' + ind.mixed +
      ' | isStale=' + ind.isStale +
      ' | consistentlyNegative=' + ind.consistentlyNegative);

    if (ind.counterExamples.length > 0) {
      console.log('    🔍 反例：');
      for (var ci = 0; ci < ind.counterExamples.length; ci++) {
        var ce = ind.counterExamples[ci];
        console.log('       - [' + ce.id + '] pattern=' + ce.pattern + ' conv=' + ce.conversationId);
      }
    }
  }

  console.log('\n📈 维度聚合：');
  for (var dk in result.dimensions) {
    if (!Object.prototype.hasOwnProperty.call(result.dimensions, dk)) continue;
    var d = result.dimensions[dk];
    if (!d.hasData) continue;
    console.log('  ' + dk + ': ' + d.tier +
      ' | dimIndex=' + (d.dimensionIndex !== null ? d.dimensionIndex.toFixed(2) : 'null') +
      ' | radar=' + d.radarValue +
      ' | coverage=' + d.coverage +
      ' | determinedCount=' + d.determinedCount +
      (d.staleNote ? ' | staleNote=' + d.staleNote : ''));
  }
}

// ============================================================
//  案例1：mixed=true — 正反方向各≥2个不同自然日
//  注意：每个conv用不同日期（每天1个conv），测试day-based mixed
// ============================================================
(function testCase1_MixedTrue() {
  var insights = [
    makeInsight('ev-01', '兴趣方向', '主动话题倾向', '主动引出', 'conv-a', '恐龙', { observedAt: '2026-07-20T10:00:00Z' }),
    makeInsight('ev-02', '兴趣方向', '主动话题倾向', '跨会话重访', 'conv-b', '恐龙', { observedAt: '2026-07-21T10:00:00Z' }),
    makeInsight('ev-03', '兴趣方向', '主动话题倾向', '被动跟随', 'conv-c', '天气', { observedAt: '2026-07-22T10:00:00Z' }),
    makeInsight('ev-04', '兴趣方向', '主动话题倾向', '被动跟随', 'conv-d', '作业', { observedAt: '2026-07-23T10:00:00Z' }),
    makeInsight('ev-05', '兴趣方向', '主动话题倾向', '话题转向', 'conv-e', '游戏', { observedAt: '2026-07-24T10:00:00Z' }),
  ];

  runTestCase('主动话题倾向 — 3个正向日 + 2个负向日 → mixed=true，等级封顶2', insights);

  var result = computeRubric(insights, RUBRIC_OPTS);
  var ind = result.indicators['主动话题倾向'];
  var pass = ind.mixed === true
    && ind.cappedLevel === 2
    && ind.positiveDayCount === 3
    && ind.negativeDayCount === 2;

  console.log('\n🧪 断言验证: ' + (pass ? '✅ 全部通过' : '❌ 有失败'));
  if (!pass) {
    console.log('   mixed=' + ind.mixed + ' (expected true)');
    console.log('   cappedLevel=' + ind.cappedLevel + ' (expected 2)');
    console.log('   positiveDayCount=' + ind.positiveDayCount + ' (expected 3)');
    console.log('   negativeDayCount=' + ind.negativeDayCount + ' (expected 2)');
  }
})();

// ============================================================
//  案例2：单反例不触发mixed — 3个正向日 + 1个负向日
// ============================================================
(function testCase2_SingleCounterExample() {
  var insights = [
    makeInsight('ev-11', '语言表达', '叙事组织能力', '时间顺序', 'conv-f', '篮球比赛', { observedAt: '2026-07-20T10:00:00Z' }),
    makeInsight('ev-12', '语言表达', '叙事组织能力', '因果衔接', 'conv-g', '数学课', { observedAt: '2026-07-21T10:00:00Z' }),
    makeInsight('ev-13', '语言表达', '叙事组织能力', '背景补充', 'conv-h', '旅游', { observedAt: '2026-07-22T10:00:00Z' }),
    makeInsight('ev-14', '语言表达', '叙事组织能力', '片段化表达', 'conv-i', '午饭', { observedAt: '2026-07-23T10:00:00Z' }),
  ];

  runTestCase('叙事组织能力 — 3个正向日 + 1个负向日 → mixed=false，1条反例', insights);

  var result = computeRubric(insights, RUBRIC_OPTS);
  var ind = result.indicators['叙事组织能力'];
  var pass = ind.mixed === false
    && ind.positiveDayCount === 3
    && ind.level === 3
    && ind.cappedLevel === 3
    && ind.counterExamples.length === 1
    && ind.counterExamples[0].id === 'ev-14';

  console.log('\n🧪 断言验证: ' + (pass ? '✅ 全部通过' : '❌ 有失败'));
  if (!pass) {
    console.log('   mixed=' + ind.mixed + ' (expected false)');
    console.log('   cappedLevel=' + ind.cappedLevel + ' (expected 3)');
    console.log('   counterExamples.length=' + ind.counterExamples.length + ' (expected 1)');
  }
})();

// ============================================================
//  案例3：历史数据（无pattern）不参与方向判断
// ============================================================
(function testCase3_HistoricalData() {
  var insights = [
    makeInsight('ev-21', '内省倾向', '自我反思频率', '情绪觉察', 'conv-j', '考试', { observedAt: '2026-07-20T10:00:00Z' }),
    makeInsight('ev-22', '内省倾向', '自我反思频率', '动机说明', 'conv-k', '友谊', { observedAt: '2026-07-21T10:00:00Z' }),
    makeInsight('ev-23', '内省倾向', '自我反思频率', '', 'conv-l', '家庭', { observedAt: '2026-07-22T10:00:00Z' }),
    makeInsight('ev-24', '内省倾向', '自我反思频率', '', 'conv-m', '爱好', { observedAt: '2026-07-23T10:00:00Z' }),
  ];

  runTestCase('自我反思频率 — 2个正向日 + 2个无pattern(不同日) → mixed=false', insights);

  var result = computeRubric(insights, RUBRIC_OPTS);
  var ind = result.indicators['自我反思频率'];
  // 7/22和7/23没有pos也没有neg → 不计入posDaySet/negDaySet，但计入evidenceCount和distinctConversationCount
  // 但toplevel: 7/22和7/23 → 无pattern → patternUnknownCount
  var pass = ind.mixed === false
    && ind.positiveDayCount === 2
    && ind.negativeDayCount === 0
    && ind.patternUnknownCount === 2;

  console.log('\n🧪 断言验证: ' + (pass ? '✅ 全部通过' : '❌ 有失败'));
  if (!pass) {
    console.log('   mixed=' + ind.mixed + ' (expected false)');
    console.log('   positiveDayCount=' + ind.positiveDayCount + ' (expected 2)');
    console.log('   negativeDayCount=' + ind.negativeDayCount + ' (expected 0)');
    console.log('   patternUnknownCount=' + ind.patternUnknownCount + ' (expected 2)');
  }
})();

// ============================================================
//  案例4："混合" pattern 属于积极方向
// ============================================================
(function testCase4_InterestDepthMixed() {
  var insights = [
    makeInsight('ev-31', '兴趣方向', '兴趣深度vs广度', '深度展开', 'conv-n', '编程', { observedAt: '2026-07-20T10:00:00Z' }),
    makeInsight('ev-32', '兴趣方向', '兴趣深度vs广度', '混合', 'conv-o', '编程', { observedAt: '2026-07-21T10:00:00Z' }),
    makeInsight('ev-33', '兴趣方向', '兴趣深度vs广度', '参与度较低', 'conv-p', '数学', { observedAt: '2026-07-22T10:00:00Z' }),
  ];

  runTestCase('兴趣深度vs广度 — 混合属正向，2正向日+1负向日 → 单反例，mixed=false', insights);

  var result = computeRubric(insights, RUBRIC_OPTS);
  var ind = result.indicators['兴趣深度vs广度'];
  var pass = ind.mixed === false
    && ind.positiveDayCount === 2
    && ind.negativeDayCount === 1
    && ind.counterExamples.length === 1
    && ind.counterExamples[0].pattern === '参与度较低';

  console.log('\n🧪 断言验证: ' + (pass ? '✅ 全部通过' : '❌ 有失败'));
  if (!pass) {
    console.log('   mixed=' + ind.mixed + ' (expected false)');
    console.log('   positiveDayCount=' + ind.positiveDayCount + ' (expected 2)');
    console.log('   negativeDayCount=' + ind.negativeDayCount + ' (expected 1)');
    console.log('   counterExamples.length=' + ind.counterExamples.length + ' (expected 1)');
  }
})();

// ============================================================
//  案例5：追问下的应变 — 正反各2天 → mixed=true
//  注意：v2.0 中 strength='weak' 会被过滤，所以全部用 moderate
// ============================================================
(function testCase5_AdaptiveElaboration() {
  var insights = [
    makeInsight('ev-41', '思维方式', '追问下的应变', '新增事实', 'conv-q', '科学实验', { observedAt: '2026-07-20T10:00:00Z', strength: 'strong' }),
    makeInsight('ev-42', '思维方式', '追问下的应变', '调整角度', 'conv-r', '科学实验', { observedAt: '2026-07-21T10:00:00Z' }),
    makeInsight('ev-43', '思维方式', '追问下的应变', '换例说明', 'conv-s', '历史故事', { observedAt: '2026-07-22T10:00:00Z' }),
    makeInsight('ev-44', '思维方式', '追问下的应变', '简单重复或回避', 'conv-t', '数学作业', { observedAt: '2026-07-23T10:00:00Z' }),
    makeInsight('ev-45', '思维方式', '追问下的应变', '简单重复或回避', 'conv-u', '体育课', { observedAt: '2026-07-24T10:00:00Z' }),
  ];

  runTestCase('追问下的应变 — 3正向日+2负向日 → mixed=true, baseLevel=3封顶为2', insights);

  var result = computeRubric(insights, RUBRIC_OPTS);
  var ind = result.indicators['追问下的应变'];
  var pass = ind.mixed === true
    && ind.level === 3
    && ind.cappedLevel === 2
    && ind.positiveDayCount === 3
    && ind.negativeDayCount === 2;

  console.log('\n🧪 断言验证: ' + (pass ? '✅ 全部通过' : '❌ 有失败'));
  if (!pass) {
    console.log('   mixed=' + ind.mixed + ' (expected true)');
    console.log('   level=' + ind.level + ' (expected 3)');
    console.log('   cappedLevel=' + ind.cappedLevel + ' (expected 2)');
    console.log('   positiveDayCount=' + ind.positiveDayCount + ' (expected 3)');
    console.log('   negativeDayCount=' + ind.negativeDayCount + ' (expected 2)');
  }

  // 额外验证：v2.0 filter 确保 weak 被排除
  var weakFilterTest = [
    makeInsight('ev-w1', '思维方式', '追问下的应变', '新增事实', 'conv-w1', '测试', { observedAt: '2026-07-25T10:00:00Z', strength: 'weak' }),
  ];
  var wfResult = computeRubric(weakFilterTest, RUBRIC_OPTS);
  var wfInd = wfResult.indicators['追问下的应变'];
  var wfPass = wfInd.evidenceCount === 0 && wfInd.positiveDayCount === 0;
  console.log('\n🧪 weak过滤验证: ' + (wfPass ? '✅ weak被正确过滤' : '❌ weak未被过滤'));
})();

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  全部测试用例执行完毕');
console.log('═══════════════════════════════════════════════════════════\n');
