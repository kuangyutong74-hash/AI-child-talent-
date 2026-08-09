/**
 * test/rubric-computer.test.js — Rubric v2.0 测试用例
 *
 * 运行方式：node test/rubric-computer.test.js
 */

var { computeRubric, DIM_CONFIG, DIM_INDICATORS, PATTERN_DIRECTION } = require('../lib/core/rubric-computer');

var passed = 0;
var failed = 0;
var total = 0;

function assert(condition, label) {
  total++;
  if (condition) {
    passed++;
    console.log('  PASS: ' + label);
  } else {
    failed++;
    console.log('  FAIL: ' + label);
  }
}

function assertEq(actual, expected, label) {
  total++;
  if (actual === expected) {
    passed++;
    console.log('  PASS: ' + label + '  (' + JSON.stringify(actual) + ')');
  } else {
    failed++;
    console.log('  FAIL: ' + label + '  expected=' + JSON.stringify(expected) + '  actual=' + JSON.stringify(actual));
  }
}

// 固定"现在"为北京时间 2026-07-30 12:00
var NOW = Date.parse('2026-07-30T12:00:00+08:00');
// 确保 now 参数有效
if (isNaN(NOW)) {
  console.error('NOW parse failed');
  process.exit(1);
}

// 辅助：构造指定天偏移的 ISO 时间
// dayOffset=0 → "2026-07-30T10:00:00Z" (UTC) → 北京时间当天18:00 → toBeijingDate = 2026-07-30
// dayOffset=1 → "2026-07-29T10:00:00Z" → 北京时间2026-07-29
function isoDay(dayOffset) {
  return '2026-07-' + (30 - dayOffset) + 'T10:00:00Z';
}

console.log('=== Test Suite: rubric-computer v2.0 ===\n');

// ================================================================
//  用例1: consistentlyNegative
//  连续3天全部负向pattern → cappedLevel=0, tier="需要引导"
// ================================================================
console.log('--- 用例1: consistentlyNegative ---');
(function () {
  var insights = [
    { id:'u1-1', dimension:'思维方式', indicator:'追问下的应变', pattern:'简单重复或回避', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c1', topic:'数学' },
    { id:'u1-2', dimension:'思维方式', indicator:'追问下的应变', pattern:'简单重复或回避', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(1), conversationId:'c2', topic:'篮球' },
    { id:'u1-3', dimension:'思维方式', indicator:'追问下的应变', pattern:'简单重复或回避', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(2), conversationId:'c3', topic:'动画' },
  ];

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var ind = r.indicators['追问下的应变'];
  var dim = r.dimensions['思维方式'];

  assertEq(ind.positiveDayCount, 0, 'positiveDayCount = 0');
  assertEq(ind.negativeDayCount, 3, 'negativeDayCount = 3');
  assertEq(ind.consistentlyNegative, true, 'consistentlyNegative = true');
  assertEq(ind.cappedLevel, 0, 'cappedLevel = 0');
  assertEq(dim.hasData, true, 'dim.hasData = true');
  assertEq(dim.tier, '需要引导', 'tier = 需要引导');
})();

// ================================================================
//  用例2: sameDayMerge
//  同一天5场对话命中3次正向 → positiveDayCount=1, baseLevel=1
// ================================================================
console.log('\n--- 用例2: sameDayMerge ---');
(function () {
  var insights = [
    { id:'u2-1', dimension:'兴趣方向', indicator:'主动话题倾向', pattern:'主动引出', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c4', topic:'恐龙' },
    { id:'u2-2', dimension:'兴趣方向', indicator:'主动话题倾向', pattern:'主动引出', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c5', topic:'恐龙' },
    { id:'u2-3', dimension:'兴趣方向', indicator:'主动话题倾向', pattern:'主动引出', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c6', topic:'恐龙' },
    // 再加2条同一天的
    { id:'u2-4', dimension:'兴趣方向', indicator:'主动话题倾向', pattern:'跨会话重访', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c7', topic:'动画' },
    { id:'u2-5', dimension:'兴趣方向', indicator:'主动话题倾向', pattern:'话题转向', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c8', topic:'学习' },
  ];

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var ind = r.indicators['主动话题倾向'];

  assertEq(ind.positiveDayCount, 1, 'positiveDayCount = 1（非5）');
  assertEq(ind.level, 1, 'baseLevel = 1（非3）');
  assertEq(ind.distinctConversationCount, 5, 'distinctConversationCount 保持 5（向后兼容）');
})();

// ================================================================
//  用例3: staleDowngrade
//  90天窗口内第1-3天达到level3，最新命中距今60天 > freshnessDays=30
//  → isStale=true, effectiveLevel = baseLevel - 1
// ================================================================
console.log('\n--- 用例3: staleDowngrade ---');
(function () {
  // positiveDaySet = {2026-05-31, 2026-06-01, 2026-06-02}
  // 距今: 60, 59, 58 天 → 最新=58天 < 30? 不，58 > 30 → isStale
  // 需要距今 > 30，构造62, 61, 60天前的数据
  var insights = [];
  for (var i = 0; i < 3; i++) {
    insights.push({
      id: 'u3-' + i,
      dimension: '语言表达',
      indicator: '叙事组织能力',
      pattern: '时间顺序',
      strength: 'moderate',
      reviewStatus: 'unreviewed',
      observedAt: '2026-05-' + (29 + i) + 'T10:00:00Z', // 2026-05-29,30,31 → 距今62,61,60天
      conversationId: 'c3-' + i,
      topic: i === 0 ? '日常' : '运动'
    });
  }

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var ind = r.indicators['叙事组织能力'];

  // 90天窗口从 NOW(7月30日) 往前90天 = 5月1日，5月29-31日的证据在窗口内
  assertEq(ind.positiveDayCount, 3, 'positiveDayCount = 3');
  assertEq(ind.level, 3, 'baseLevel = 3（3天+2话题）');
  assertEq(ind.isStale, true, 'isStale = true（最新正向日距今约60天 > 30）');
  assertEq(ind.cappedLevel, 2, 'cappedLevel = 2（effectiveLevel = 3-1）');
  assertEq(ind.mostRecentPositiveDaysAgo > 30, true, 'mostRecentPositiveDaysAgo > 30');
})();

// ================================================================
//  用例4: windowExpiry
//  120天前有3天命中，最近90天窗口内无 → positiveDayCount=0, baseLevel=0
// ================================================================
console.log('\n--- 用例4: windowExpiry ---');
(function () {
  var insights = [
    { id:'u4-1', dimension:'语言表达', indicator:'叙事组织能力', pattern:'时间顺序', strength:'moderate', reviewStatus:'unreviewed', observedAt:'2026-03-20T10:00:00Z', conversationId:'c10', topic:'日常' },
    { id:'u4-2', dimension:'语言表达', indicator:'叙事组织能力', pattern:'时间顺序', strength:'moderate', reviewStatus:'unreviewed', observedAt:'2026-03-21T10:00:00Z', conversationId:'c11', topic:'运动' },
    { id:'u4-3', dimension:'语言表达', indicator:'叙事组织能力', pattern:'因果衔接', strength:'moderate', reviewStatus:'unreviewed', observedAt:'2026-03-22T10:00:00Z', conversationId:'c12', topic:'动画' },
  ];

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var ind = r.indicators['叙事组织能力'];
  var dim = r.dimensions['语言表达'];

  // 默认 windowDays=90，NOW=7月30日 → 窗口起点 = 5月1日。3月的证据全部过期
  assertEq(ind.positiveDayCount, 0, 'positiveDayCount = 0（全部过期）');
  assertEq(ind.cappedLevel, 0, 'cappedLevel = 0');
  assertEq(dim.determinedCount, 0, 'determinedCount = 0');
})();

// ================================================================
//  用例5: coverageCap
//  维度下2指标仅1个有数据 → 即使dimensionIndex达标rawTier="稳定趋势",
//  tier封顶"重复出现"
// ================================================================
console.log('\n--- 用例5: coverageCap ---');
(function () {
  var insights = [
    // 叙事组织能力: 3天正向+2话题 → level 3
    { id:'u5-1', dimension:'语言表达', indicator:'叙事组织能力', pattern:'时间顺序', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c13', topic:'日常' },
    { id:'u5-2', dimension:'语言表达', indicator:'叙事组织能力', pattern:'因果衔接', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(1), conversationId:'c14', topic:'学习' },
    { id:'u5-3', dimension:'语言表达', indicator:'叙事组织能力', pattern:'背景补充', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(2), conversationId:'c15', topic:'运动' },
    // 词汇丰富度与用词选择: 无数据
  ];

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var dim = r.dimensions['语言表达'];

  assertEq(dim.determinedCount, 1, 'determinedCount = 1');
  assertEq(dim.totalIndicators, 2, 'totalIndicators = 2');
  assertEq(dim.dimensionIndex >= 2.5, true, 'dimensionIndex >= 2.5（rawTier应为稳定趋势）');
  assertEq(dim.tier, '重复出现', 'tier = 重复出现（被coverageCap封顶）');
})();

// ================================================================
//  用例6: coverageCapLowIndex
//  维度下2指标仅1个有数据，且dimensionIndex本身很低(rawTier="初步线索")
//  → tier仍为"初步线索"，不会被错误拉高为"重复出现"
// ================================================================
console.log('\n--- 用例6: coverageCapLowIndex ---');
(function () {
  var insights = [
    { id:'u6-1', dimension:'兴趣方向', indicator:'主动话题倾向', pattern:'主动引出', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c16', topic:'恐龙' },
    // 兴趣深度vs广度: 无数据
  ];

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var dim = r.dimensions['兴趣方向'];

  assertEq(dim.determinedCount, 1, 'determinedCount = 1');
  assertEq(dim.totalIndicators, 2, 'totalIndicators = 2');
  // 只有1天正向 = level 1, dimensionIndex = 1/1 = 1
  assertEq(dim.dimensionIndex < 1.5, true, 'dimensionIndex < 1.5');
  assertEq(dim.tier, '初步线索', 'tier = 初步线索（不被coverageCap错误拉高）');
})();

// ================================================================
//  用例7: weakExcluded
//  weak证据（不论wasPrompted）不参与 positiveDayCount/negativeDayCount
// ================================================================
console.log('\n--- 用例7: weakExcluded ---');
(function () {
  var insights = [
    // weak 但不 wasPrompted — 按旧逻辑会被保留，按新逻辑应排除
    { id:'u7-1', dimension:'语言表达', indicator:'叙事组织能力', pattern:'时间顺序', strength:'weak', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c17', topic:'日常', wasPrompted:false },
    // weak 且 wasPrompted — 旧逻辑排除，新逻辑也排除
    { id:'u7-2', dimension:'语言表达', indicator:'叙事组织能力', pattern:'因果衔接', strength:'weak', reviewStatus:'unreviewed', observedAt:isoDay(1), conversationId:'c18', topic:'学习', wasPrompted:true },
    // 再加一条 moderate 作为对照 — 应正常参与
    { id:'u7-3', dimension:'语言表达', indicator:'叙事组织能力', pattern:'时间顺序', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c19', topic:'日常' },
  ];

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var ind = r.indicators['叙事组织能力'];

  // 只有 u7-3 (moderate) 这一条被保留，同一天 = 1 正向天
  assertEq(ind.positiveDayCount, 1, 'positiveDayCount = 1（只计moderate，两条weak全部排除）');
  assertEq(ind.evidenceCount, 1, 'evidenceCount = 1');
})();

// ================================================================
//  用例8: allConsistentlyNegative
//  某维度下所有指标都 consistentlyNegative（hasData=true 但有负向证据）
//  → tier="需要引导" 而非被误判为"暂无法判断"
// ================================================================
console.log('\n--- 用例8: allConsistentlyNegative ---');
(function () {
  var insights = [
    { id:'u8-1', dimension:'语言表达', indicator:'叙事组织能力', pattern:'片段化表达', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c20', topic:'日常' },
    { id:'u8-2', dimension:'语言表达', indicator:'叙事组织能力', pattern:'片段化表达', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(1), conversationId:'c21', topic:'学习' },
    { id:'u8-3', dimension:'语言表达', indicator:'词汇丰富度与用词选择', pattern:'笼统表达', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c20', topic:'日常' },
    { id:'u8-4', dimension:'语言表达', indicator:'词汇丰富度与用词选择', pattern:'笼统表达', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(1), conversationId:'c21', topic:'学习' },
  ];

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var indA = r.indicators['叙事组织能力'];
  var indB = r.indicators['词汇丰富度与用词选择'];
  var dim = r.dimensions['语言表达'];

  assertEq(indA.consistentlyNegative, true, '叙事组织能力.consistentlyNegative = true');
  assertEq(indB.consistentlyNegative, true, '词汇丰富度.consistentlyNegative = true');
  assertEq(dim.hasData, true, 'dim.hasData = true（有负向证据存在）');
  assertEq(dim.tier, '需要引导', 'tier = 需要引导（非暂无法判断）');
})();

// ================================================================
//  用例9: boundarySingleNegative (补充边界)
//  某指标只有1个负向日（不满足 consistentlyNegative 的≥2天门槛），
//  positiveDayCount=0。此时代码路径：dimHasData=true, determinedCount=0,
//  dimensionIndex=null → 阶段2.5 → tier='微弱信号'。
//
//  这是隐式边界行为：有微弱负向信号但不足以判 consistentlyNegative，
//  也没有正向信号来定级，"微弱信号"比"暂无法判断"多了一点信息（告诉教师"有数据但不够"）。
// ================================================================
console.log('\n--- 用例9: boundarySingleNegative（补充边界）---');
(function () {
  var insights = [
    { id:'u9-1', dimension:'思维方式', indicator:'追问下的应变', pattern:'简单重复或回避', strength:'moderate', reviewStatus:'unreviewed', observedAt:isoDay(0), conversationId:'c22', topic:'数学' },
  ];

  var r = computeRubric(insights, { now: NOW, windowDays: 90, freshnessDays: 30 });
  var ind = r.indicators['追问下的应变'];
  var dim = r.dimensions['思维方式'];

  assertEq(ind.positiveDayCount, 0, 'positiveDayCount = 0');
  assertEq(ind.negativeDayCount, 1, 'negativeDayCount = 1');
  assertEq(ind.consistentlyNegative, false, 'consistentlyNegative = false（不足2天门槛）');
  assertEq(ind.cappedLevel, 0, 'cappedLevel = 0');
  assertEq(dim.hasData, true, 'dim.hasData = true（有1条负向证据）');
  assertEq(dim.determinedCount, 0, 'determinedCount = 0');
  assertEq(dim.dimensionIndex, null, 'dimensionIndex = null');
  assertEq(dim.tier, '微弱信号', 'tier = 微弱信号（dimHasData=true但determinedCount=0，有证据但无法定级）');
})();

// ================================================================
//  结果汇总
// ================================================================
console.log('\n=== 结果汇总 ===');
console.log('Passed: ' + passed + '/' + total);
console.log('Failed: ' + failed + '/' + total);

if (failed > 0) {
  console.log('\n[FAIL] ' + failed + ' 个用例未通过');
  process.exit(1);
} else {
  console.log('\n[PASS] 全部 ' + total + ' 个断言通过');
}
