/**
 * test/strength-pipeline.test.js
 *
 * 端到端验证：buildStudentInsights → computeRubric 完整数据链路中
 * strength 字段是否被正确写入 insight 对象并被 Step 1 过滤逻辑拦截。
 *
 * 修复背景：buildStudentInsights 构造 insight 时遗漏了 strength: hit.strength，
 * 导致 rubric-computer v2.0 Step 1 的 ins.strength === 'weak' 过滤永不生效。
 *
 * 运行方式：node test/strength-pipeline.test.js
 */

'use strict';

var computeRubric = require('../lib/core/rubric-computer').computeRubric;
var { buildStudentInsights } = require('../lib/teacher/teacher-data-adapter');

var RUBRIC_OPTS = { now: Date.parse('2026-07-30T12:00:00+08:00'), windowDays: 90, freshnessDays: 30 };

var passed = 0;
var failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log('  PASS: ' + label); }
  else { failed++; console.log('  FAIL: ' + label); }
}

// ============================================================
// 手工构造最小数据集：一个学生、一次对话、一条 strength==='weak' 的 hit
// 直接模拟 buildStudentInsights 需要的输入结构，不依赖真实历史文件。
// ============================================================

var testStudent = {
  id: 'test-strength-student',
  username: 'strength-test',
  role: 'student',
  createdAt: '2026-07-30T00:00:00Z',
  studentCode: '999999',
};
var testTeacher = {
  id: 'test-strength-teacher',
  username: 'test-teacher',
  role: 'teacher',
  createdAt: '2026-07-30T00:00:00Z',
};

// entries 必须按 teacher-data-adapter 读取路径可解析。
// getValidAnalysis → analysis.result → result['命中指标']
var historyEntries = [{
  id: 'conv-strength-test',
  userId: testStudent.id,
  sessionId: 'sess-strength-test',
  startTime: '2026-07-28T10:00:00Z',
  completed: true,
  messages: [
    { role: 'student', content: '我好累' },
    { role: 'assistant', content: '怎么了？' },
  ],
  analysis: {
    status: 'done',
    result: {
      '分析范围': '第1-2轮',
      '命中指标': [
        {
          '维度': '内省倾向',
          '指标': '自我反思频率',
          '证据片段': '我好累',
          '说话轮次': '1',
          '信号说明': '笼统情绪词，未展开情境',
          '强度备注': '【弱证据】',
          'strength': 'weak',
          '观察模式': '仅陈述事件',  // 负向 pattern
          'was_prompted': false,
          'prompt_intensity': 'none',
        },
        {
          '维度': '内省倾向',
          '指标': '自我反思频率',
          '证据片段': '今天和同学打篮球赢了比赛，特别开心！',
          '说话轮次': '3',
          '信号说明': '描述了情绪和具体情境',
          '强度备注': '【较强证据】',
          'strength': 'strong',
          '观察模式': '情绪觉察',  // 正向 pattern
          'was_prompted': false,
          'prompt_intensity': 'none',
        },
      ],
      '未命中指标': [],
      '安全提示': false,
      '安全提示原因': '',
    },
  },
}];

var historyEntriesWithBindings = historyEntries;

// ============================================================
// 直接调用 buildStudentInsights（绕过手工构造 insight 的测试 helper）
// ============================================================
console.log('=== 端到端测试：buildStudentInsights → computeRubric 链路 ===\n');

// getValidHits 从 analysis.result['命中指标'] 提取 hit 时，
// 会读取 h['strength'] → hit.strength。
// 然后 buildStudentInsights 应该把 hit.strength 写入 insight.strength。
// 验证方式：直接用手工构造的 history + users + bindings 调用 buildStudentInsights。

// 注意：teacher-data-adapter 的 getStudentAllHistory 需要 bindings
// 格式为 [{teacherId, studentId}]，以及 users 是数组。

var bindings = {};
bindings[testTeacher.id] = [testStudent.id];

var result = buildStudentInsights({
  teacherId: testTeacher.id,
  studentId: testStudent.id,
  users: [testStudent, testTeacher],
  bindings: bindings,
  history: historyEntries,
});

console.log('--- 1. buildStudentInsights 输出验证 ---');

if (!result.allowed) {
  console.log('  FAIL: buildStudentInsights returned not-allowed: ' + result.reason);
  console.log('\n=== 结果汇总 ===');
  console.log('Passed: ' + passed + ' / Failed: ' + failed);
  process.exit(1);
}

var insights = result.insights;
console.log('  总 insight 数: ' + insights.length);

// 找到 weak 和 strong 的 insight
var weakInsights = [];
var strongInsights = [];
for (var i = 0; i < insights.length; i++) {
  var ins = insights[i];
  if (ins.strength === 'weak') weakInsights.push(ins);
  if (ins.strength === 'strong') strongInsights.push(ins);
}

assert(insights.length >= 2, '至少生成2条 insight');
assert(weakInsights.length === 1, '有1条 strength="weak" 的 insight');
assert(strongInsights.length === 1, '有1条 strength="strong" 的 insight');

// 验证 insight 对象上确实有 strength 字段（不是从 hit 间接读）
for (var j = 0; j < weakInsights.length; j++) {
  var wIns = weakInsights[j];
  assert(wIns.strength === 'weak', 'weak insight 携带 strength="weak" 字段');
  assert(wIns.isWeakSignal === true, 'weak insight 的 isWeakSignal === true');
}
for (var k = 0; k < strongInsights.length; k++) {
  var sIns = strongInsights[k];
  assert(sIns.strength === 'strong', 'strong insight 携带 strength="strong" 字段');
  assert(sIns.isWeakSignal === false, 'strong insight 的 isWeakSignal === false');
}

console.log('\n--- 2. computeRubric 过滤验证 ---');

var rubric = computeRubric(insights, RUBRIC_OPTS);
var ind = rubric.indicators['自我反思频率'];

// weak insight 应该被 Step 1 过滤（ins.strength === 'weak' → 排除）
// 所以只有 strong insight 被计入。1天正向，没有负向。
assert(ind.evidenceCount === 1, 'evidenceCount=1（weak被过滤，只计strong）');
assert(ind.positiveDayCount === 1, 'positiveDayCount=1（仅strong计入正向）');
assert(ind.negativeDayCount === 0, 'negativeDayCount=0（weak未计入任何方向）');
assert(ind.cappedLevel === 1, 'cappedLevel=1（仅1天正向=level 1）');

// 如果 strength 字段没写入 insight 对象，ins.strength 会是 undefined，
// undefined !== 'weak' → Step 1 不会过滤，evidenceCount 会是 2
console.log('\n--- 3. 反向验证：如果 strength 未写入会怎样 ---');

// 模拟 bug 场景：手工抹掉 strength 字段
var buggyInsights = [];
for (var bi = 0; bi < insights.length; bi++) {
  var copy = {};
  var keys = Object.keys(insights[bi]);
  for (var ki = 0; ki < keys.length; ki++) {
    copy[keys[ki]] = insights[bi][keys[ki]];
  }
  delete copy.strength; // 模拟漏写 strength 的 bug
  buggyInsights.push(copy);
}

var buggyRubric = computeRubric(buggyInsights, RUBRIC_OPTS);
var buggyInd = buggyRubric.indicators['自我反思频率'];

// 没有 strength 字段 → undefined !== 'weak' → 两条都通过 Step 1
// weak 那条 pattern='仅陈述事件' (neg), strong 那条 pattern='情绪觉察' (pos)
// 同一天内：pos=1, neg=1 → 相等且都>0 → neutralDaySet（不计入正向）
// 但pattern='仅陈述事件'是neg，会被累积到negativeDaySet...
// 实际：同一天，posCount=1 (strong/情绪觉察), negCount=1 (weak/仅陈述事件)
// posCount === negCount → neutralDaySet → 不计入posDaySet/negDaySet
// 所以 positiveDayCount=0, negativeDayCount=0
assert(buggyInd.evidenceCount === 2, 'bug场景: evidenceCount=2（weak漏过）');
assert(buggyInd.positiveDayCount === 0, 'bug场景: positiveDayCount=0（同天pos/neg相等→neutral）');
assert(buggyInd.cappedLevel === 0, 'bug场景: cappedLevel=0（无正向天）');

// 对比：修复后 evidenceCount=1 positiveDayCount=1 cappedLevel=1
//   vs  bug   evidenceCount=2 positiveDayCount=0 cappedLevel=0
assert(ind.evidenceCount !== buggyInd.evidenceCount, '修复后与bug场景结果不同（证明strength字段生效）');

console.log('\n=== 结果汇总 ===');
console.log('Passed: ' + passed + '/Failed: ' + failed);
if (failed > 0) {
  console.log('[FAIL] ' + failed + ' 个断言失败');
  process.exit(1);
} else {
  console.log('[PASS] 全部 ' + passed + ' 个断言通过');
}
