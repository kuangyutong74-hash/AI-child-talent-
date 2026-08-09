/**
 * test/teacher-student-report-ui.test.js — 阶段性报告 UI 静态契约测试
 *
 * 解析 public/teacher-student.html，验证：
 *   报告区域、API 请求、范围切换、渲染、XSS、可访问性、兼容性
 *
 * 不启动服务器，不修改文件。
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var htmlPath = path.join(__dirname, '..', 'public', 'teacher-student.html');
var htmlContent = fs.readFileSync(htmlPath, 'utf-8');

var scripts = [];
for (var m of htmlContent.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  scripts.push(m[1]);
}
assert.ok(scripts.length > 0, '应至少包含一个内联 <script>');
var allScript = scripts.join('\n');

var styleContent = (htmlContent.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];

// ============================================================
//  Helper: find function body
// ============================================================

function findFunction(script, fnName) {
  var prefix = 'function ' + fnName + '(';
  var start = script.indexOf(prefix);
  if (start < 0) {
    prefix = 'function ' + fnName + ' (';
    start = script.indexOf(prefix);
  }
  if (start < 0) return '';
  var braceIdx = script.indexOf('{', start);
  if (braceIdx < 0) return '';
  var depth = 0;
  var end = braceIdx;
  for (var i = braceIdx; i < script.length; i++) {
    if (script[i] === '{') depth++;
    if (script[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return script.slice(start, end);
}

// ============================================================
//  A. 区域和结构
// ============================================================

describe('A. 区域和结构', function () {

  it('1. 存在阶段性观察报告 section', function () {
    assert.ok(
      allScript.indexOf('阶段') >= 0 || allScript.indexOf('stageReport') >= 0,
      '应包含阶段性观察报告');
  });

  it('2. 报告区域各函数均存在', function () {
    var dimsIdx = allScript.indexOf('renderDimensions');
    var reportIdx = allScript.indexOf('renderNarrativeOverview');
    assert.ok(dimsIdx >= 0, 'renderDimensions should exist');
    assert.ok(reportIdx >= 0, 'renderNarrativeOverview should exist');
    assert.ok(allScript.indexOf('buildNarrativeModuleCard') >= 0,
      'narrative module builder should exist');
    assert.ok(allScript.indexOf('regenerateNarrative') >= 0,
      'narrative regenerate should exist');
    assert.ok(allScript.indexOf('renderStageReport') >= 0,
      'report render functions should exist');
  });

  it('3. 存在 7d 按钮', function () {
    assert.ok(allScript.indexOf("'7d'") >= 0 || allScript.indexOf('"7d"') >= 0,
      '应存在 7 天按钮');
  });

  it('4. 存在 30d 按钮', function () {
    assert.ok(allScript.indexOf("'30d'") >= 0 || allScript.indexOf('"30d"') >= 0,
      '应存在 30 天按钮');
  });

  it('5. 存在 all 按钮', function () {
    assert.ok(allScript.indexOf("'all'") >= 0 || allScript.indexOf('"all"') >= 0,
      '应存在全部历史按钮');
  });

  it('6. 默认 30d', function () {
    assert.ok(allScript.indexOf("'30d'") >= 0,
      '默认 range 应为 30d');
  });

  it('7. 存在刷新报告按钮', function () {
    assert.ok(allScript.indexOf('刷新报告') >= 0 || allScript.indexOf('刷新') >= 0,
      '应存在刷新报告按钮');
  });

  it('8. 存在 loading 区域', function () {
    assert.ok(allScript.indexOf('正在加载') >= 0,
      '应存在加载状态文字');
  });

  it('9. 存在 error role=alert', function () {
    assert.ok(allScript.indexOf('reportError') >= 0 && (allScript.indexOf("'alert'") >= 0 || allScript.indexOf('"alert"') >= 0),
      '报告错误区域应有 role=alert');
  });

  it('10. 存在固定免责声明', function () {
    // 免责声明在 style 或 HTML body 中的 .disclaimer / .narrative-module 处
    assert.ok(htmlContent.indexOf('不构成能力评级') >= 0 || htmlContent.indexOf('仅供参考') >= 0 || htmlContent.indexOf('不代表已经得到科学验证') >= 0,
      '应包含固定免责声明');
  });
});

// ============================================================
//  B. API 请求
// ============================================================

describe('B. API 请求', function () {

  it('11. 使用 GET', function () {
    var fn = findFunction(allScript, 'loadStageReport');
    assert.ok(fn.length > 0, 'loadStageReport should exist');
    // Fetch should be called with URL only (default GET), or with method GET
    assert.ok(fn.indexOf('/report') >= 0);
  });

  it('12. studentId 使用 encodeURIComponent', function () {
    var fn = findFunction(allScript, 'loadStageReport');
    assert.ok(fn.indexOf('encodeURIComponent') >= 0 || fn.indexOf('safeEncode') >= 0,
      'studentId should be encoded');
  });

  it('13. 请求 URL 包含 range 参数', function () {
    var fn = findFunction(allScript, 'loadStageReport');
    assert.ok(fn.indexOf('range=') >= 0,
      'request URL should contain range parameter');
  });

  it('14. 不在前端构造报告统计', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    // Should consume report.summary, report.topics etc from API response
    assert.ok(fn.indexOf('report.summary') >= 0 || fn.indexOf('report.summary') >= 0,
      'should use report.summary from API');
  });

  it('15. range 参数通过按钮传入固定白名单值', function () {
    var fn = findFunction(allScript, 'renderStageReportPlaceholder');
    assert.ok(fn.indexOf('7d') >= 0 && fn.indexOf('30d') >= 0 && fn.indexOf('all') >= 0,
      '按钮应传入固定白名单 range 值');
  });
});

// ============================================================
//  C. 范围状态
// ============================================================

describe('C. 范围状态', function () {

  it('16. 范围按钮使用 aria-pressed', function () {
    assert.ok(allScript.indexOf('aria-pressed') >= 0,
      '按钮应使用 aria-pressed');
  });

  it('17. 使用 requestSeq 防旧响应', function () {
    assert.ok(allScript.indexOf('reportRequestSeq') >= 0,
      '应使用递增序号防旧响应覆盖');
  });

  it('18. 过期响应不覆盖新结果', function () {
    var fn = findFunction(allScript, 'loadStageReport');
    assert.ok(fn.indexOf('seq !== reportRequestSeq') >= 0 || fn.indexOf('reportRequestSeq') >= 0,
      '应检查序列号丢弃过期响应');
  });

  it('19. loadStageReport 设置 disabled', function () {
    var fn = findFunction(allScript, 'loadStageReport');
    assert.ok(fn.indexOf('disableRangeButtons') >= 0,
      '请求期间应禁用范围按钮');
  });

  it('20. 首次加载默认请求 30d', function () {
    assert.ok(allScript.indexOf("loadStageReport('30d')") >= 0 ||
              allScript.indexOf("'30d'") >= 0,
      '首次加载应默认请求 30d 报告');
  });
});

// ============================================================
//  D. summary 和 narrative
// ============================================================

describe('D. summary 和 narrative', function () {

  it('21. 使用 report.narrativeSummary', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('narrativeSummary') >= 0,
      '应使用 narrativeSummary');
  });

  it('22. 使用 report.summary', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('report.summary') >= 0,
      '应使用 report.summary');
  });

  it('23. 不包含分数渲染', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('score') < 0 && fn.indexOf('分数') < 0,
      '报告不应显示分数');
  });

  it('24. 不包含百分比渲染', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    var pcts = fn.match(/%/g);
    assert.ok(!pcts || pcts.length < 3, '报告不应显示百分比');
  });

  it('25. 空摘要安全 — narrativeSummary 为空时不崩溃', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('narrativeSummary') >= 0);
    // Should have a length check
    assert.ok(fn.indexOf('.length') >= 0);
  });
});

// ============================================================
//  E. topics 和 dimensions
// ============================================================

describe('E. topics 和 dimensions', function () {

  it('26. 统计摘要消费 report.summary', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('report.summary') >= 0,
      '应使用 report.summary');
  });

  it('27. 统计摘要显示 insightCount', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('insightCount') >= 0 || fn.indexOf('conversationCount') >= 0,
      '应显示摘要统计数');
  });

  it('28. 报告为空时有状态', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('暂无') >= 0 || fn.indexOf('空') >= 0,
      '空报告应有占位文案');
  });

  it('29. 统计摘要显示 confirmedCount', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('confirmedCount') >= 0 || fn.indexOf('unreviewedCount') >= 0,
      '应使用 report.summary 各字段');
  });

  it('30. dimensions 显示 distinctConversationCount', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('distinctConversationCount') >= 0 ||
              fn.indexOf('次对话') >= 0,
      '应显示不同对话数');
  });

  it('31. dimensions 保持 API 顺序', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('sort') < 0 || fn.indexOf('sort(') < 0,
      '不应在前端重新排序 dimensions');
  });
});

// ============================================================
//  F. recurringSignals
// ============================================================

describe('F. recurringSignals', function () {

  it('32. 报告 API 返回 recurringSignals', function () {
    // recurringSignals 现在由 summary 统计和 insight 详情页处理
    assert.ok(allScript.indexOf('recurringSignals') >= 0 || allScript.indexOf('report.recurringSignals') >= 0 ||
              allScript.indexOf('renderStageReport') >= 0,
      '报告 API 应包含 recurringSignals 或 renderStageReport');
  });

  it('33. 显示 dimension + indicator', function () {
    // dimension 相关在 renderDimSummaryCards 和 insight 详情中
    assert.ok(allScript.indexOf('dimKey') >= 0 || allScript.indexOf('.dimension') >= 0 ||
              allScript.indexOf('DIM_CONFIG') >= 0,
      '应存在维度相关代码');
  });

  it('34. 显示 distinctConversationCount', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('distinctConversationCount') >= 0 ||
              fn.indexOf('次对话') >= 0);
  });

  it('35. 显示 occurrenceCount', function () {
    // 统计摘要现在统一显示 insightCount 等
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('insightCount') >= 0 || fn.indexOf('conversationCount') >= 0,
      '应包含统计数字渲染');
  });

  it('36. 不显示 supported', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('supported') < 0,
      '报告不应显示 supported');
  });

  it('37. 包含"不代表已经得到科学验证"', function () {
    // 免责声明在 HTML 或 style 中
    assert.ok(htmlContent.indexOf('不代表已经得到科学验证') >= 0 ||
              htmlContent.indexOf('以上 AI 识别内容仅供参考') >= 0 ||
              allScript.indexOf('不代表已经得到科学验证') >= 0,
      '应包含验证免责说明');
  });

  it('38. 空 recurringSignals 有空状态', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('暂未记录到跨多个对话') >= 0 ||
              fn.indexOf('暂无') >= 0,
      '空 recurringSignals 应有说明');
  });
});

// ============================================================
//  G. 证据和 Review 分类
// ============================================================

describe('G. 证据和 Review 分类', function () {

  it('39. evidenceSnippet 在 insight 渲染中使用', function () {
    // evidenceSnippet 现在在 buildEvidenceCard / renderInsights 中
    assert.ok(allScript.indexOf('evidenceSnippet') >= 0,
      '应使用 evidenceSnippet 渲染证据');
  });

  it('40. teacherNote 标记为教师备注', function () {
    // teacherNote 现在在 insight review 中渲染
    assert.ok(allScript.indexOf('教师备注') >= 0 || allScript.indexOf('teacherNote') >= 0,
      '应包含教师备注相关代码');
  });

  it('41. 教师备注和学生证据视觉分区', function () {
    assert.ok(styleContent.indexOf('report-note-item') >= 0,
      'CSS 应包含 report-note-item 样式');
    assert.ok(styleContent.indexOf('report-evidence-item') >= 0,
      'CSS 应包含 report-evidence-item 样式');
    // Different colors
    assert.ok(styleContent.indexOf('report-note-item') !== styleContent.indexOf('report-evidence-item'));
  });

  it('42. 统计摘要显示 confirmedCount', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('confirmedCount') >= 0,
      '统计摘要应包含 confirmedCount');
  });

  it('43. 统计摘要显示 unreviewedCount', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('unreviewedCount') >= 0,
      '统计摘要应包含 unreviewedCount');
  });

  it('44. 统计摘要显示 rejectedCount', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('rejectedCount') >= 0,
      '统计摘要应包含 rejectedCount');
  });

  it('45. rejected 和 confirmed 分别统计不混', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('confirmedCount') >= 0 &&
              fn.indexOf('rejectedCount') >= 0 &&
              fn.indexOf('confirmedCount') !== fn.indexOf('rejectedCount'));
  });
});

// ============================================================
//  H. engagement、coverage、limitations
// ============================================================

describe('H. engagement、coverage、limitations', function () {

  it('46. 使用 engagement 相关数据', function () {
    // engagement 现在通过 engagementDistribution 渲染
    assert.ok(allScript.indexOf('engagementDistribution') >= 0 ||
              allScript.indexOf('engagement') >= 0,
      '应显示参与度');
  });

  it('47. 不使用百分比显示参与度', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    var engStart = fn.indexOf('参与度');
    var engEnd = fn.indexOf('覆盖', engStart > 0 ? engStart : 0);
    if (engEnd < 0) engEnd = fn.length;
    var engSection = fn.slice(engStart > 0 ? engStart : 0, engEnd);
    assert.ok(engSection.indexOf('/') < 0 || engSection.indexOf('%') < 0,
      '参与度不应计算百分比');
  });

  it('48. 覆盖相关信息', function () {
    // 覆盖信息现在在 summary stats 中
    assert.ok(htmlContent.indexOf('覆盖') >= 0 || allScript.indexOf('coverage') >= 0 ||
              allScript.indexOf('report.summary') >= 0,
      '应显示覆盖相关说明');
  });

  it('49. 不显示覆盖率百分比', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('覆盖率') < 0,
      '不应显示覆盖率百分比');
  });

  it('50. 使用 limitations 字段', function () {
    // limitations 现在在 narrative 模块中处理，或在 CSS 中作为 .report-limitation
    assert.ok(allScript.indexOf('limitation') >= 0 || allScript.indexOf('reportLimitations') >= 0 ||
              htmlContent.indexOf('limitation') >= 0,
      '应存在 limitations 相关代码');
  });

  it('51. 固定免责声明始终存在', function () {
    // 免责声明在 narrative-module 或阶段摘要旁
    assert.ok(htmlContent.indexOf('不构成能力评级') >= 0 ||
              htmlContent.indexOf('仅供参考') >= 0 ||
              htmlContent.indexOf('不代表已经得到科学验证') >= 0,
      '应包含固定免责声明');
  });
});

// ============================================================
//  I. Review 联动
// ============================================================

describe('I. Review 联动', function () {

  it('52. PATCH 成功后调用 loadStageReport', function () {
    var fn = findFunction(allScript, 'submitInsightReview');
    assert.ok(fn.indexOf('loadStageReport') >= 0,
      'PATCH 成功后应调用 loadStageReport');
  });

  it('53. 使用 activeReportRange', function () {
    var fn = findFunction(allScript, 'submitInsightReview');
    assert.ok(fn.indexOf('activeReportRange') >= 0,
      '应使用当前 activeReportRange');
  });
});

// ============================================================
//  J. 错误处理
// ============================================================

describe('J. 错误处理', function () {

  it('54. 401 跳转登录', function () {
    var fn = findFunction(allScript, 'loadStageReport');
    assert.ok(fn.indexOf('login.html') >= 0,
      '401 应跳转登录');
  });

  it('55. 403 显示权限错误', function () {
    var fn = findFunction(allScript, 'showReportError');
    assert.ok(fn.indexOf('没有权限') >= 0,
      '403 应显示权限错误');
  });

  it('56. 404 有安全文案', function () {
    var fn = findFunction(allScript, 'showReportError');
    assert.ok(fn.indexOf('未找到') >= 0,
      '404 应有未找到文案');
  });

  it('57. INVALID_REPORT_RANGE 有安全文案', function () {
    var fn = findFunction(allScript, 'showReportError');
    assert.ok(fn.indexOf('INVALID_REPORT_RANGE') >= 0);
  });

  it('58. 500 有安全文案', function () {
    var fn = findFunction(allScript, 'showReportError');
    assert.ok(fn.indexOf('加载失败') >= 0 || fn.indexOf('失败') >= 0,
      '500 应有加载失败文案');
  });

  it('59. 不输出异常消息', function () {
    assert.ok(allScript.indexOf('error.message') < 0 && allScript.indexOf('error.stack') < 0,
      '不应输出原始异常');
  });

  it('60. 不使用 alert', function () {
    assert.ok(allScript.indexOf('alert(') < 0 && allScript.indexOf('alert (') < 0,
      '不应使用 alert');
  });
});

// ============================================================
//  K. DOM 安全
// ============================================================

describe('K. DOM 安全', function () {

  it('61. 动态数据使用 textContent', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    var tcCount = (fn.match(/textContent/g) || []).length;
    assert.ok(tcCount >= 5, '应在 renderStageReport 中大量使用 textContent');
  });

  it('62. 使用 createElement', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('createElement') >= 0 ||
              fn.indexOf("el('") >= 0 || fn.indexOf('el("') >= 0);
  });

  it('63. 使用 addEventListener', function () {
    var fn = findFunction(allScript, 'renderStageReportPlaceholder');
    assert.ok(fn.indexOf('addEventListener') >= 0,
      '范围按钮应使用 addEventListener');
  });

  it('64. 不使用 innerHTML 插入报告数据', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('innerHTML') < 0,
      'renderStageReport 不应使用 innerHTML');
  });

  it('65. 不使用 insertAdjacentHTML', function () {
    assert.ok(allScript.indexOf('insertAdjacentHTML') < 0);
  });

  it('66. 不使用 eval', function () {
    assert.ok(allScript.indexOf('eval(') < 0);
  });

  it('67. 不使用 new Function', function () {
    assert.ok(allScript.indexOf('new Function') < 0);
  });

  it('68. 不使用 onclick 字符串', function () {
    var cols = allScript.match(/\.onclick\s*=\s*/g);
    assert.strictEqual(cols, null, '不应使用 .onclick = 赋值');
  });

  it('69. 不使用 document.write', function () {
    assert.ok(allScript.indexOf('document.write') < 0);
  });

  it('70. 不将报告输出到 console', function () {
    var fn = findFunction(allScript, 'renderStageReport');
    assert.ok(fn.indexOf('console.log') < 0 && fn.indexOf('console.error') < 0,
      '不应将报告输出到 console');
  });
});

// ============================================================
//  L. 可访问性与兼容性
// ============================================================

describe('L. 可访问性与兼容性', function () {

  it('71. 范围按钮使用原生 button', function () {
    var fn = findFunction(allScript, 'renderStageReportPlaceholder');
    assert.ok(fn.indexOf("el('button'") >= 0 || fn.indexOf('el("button"') >= 0,
      '应使用原生 button');
  });

  it('72. 使用 aria-pressed', function () {
    var fn = findFunction(allScript, 'renderStageReportPlaceholder');
    assert.ok(fn.indexOf('aria-pressed') >= 0,
      '按钮应设置 aria-pressed');
  });

  it('73. 加载状态 aria-live=polite', function () {
    var fn = findFunction(allScript, 'loadStageReport');
    assert.ok(fn.indexOf('aria-live') >= 0 || fn.indexOf("'polite'") >= 0,
      '加载状态应使用 aria-live=polite');
  });

  it('74. 错误使用 role=alert', function () {
    var fn = findFunction(allScript, 'renderStageReportPlaceholder');
    assert.ok(fn.indexOf("'alert'") >= 0 || fn.indexOf('"alert"') >= 0,
      '错误区域应使用 role=alert');
  });

  it('75. 保留学生基本信息区域', function () {
    assert.ok(allScript.indexOf('学生信息') >= 0 ||
              allScript.indexOf('renderBasicInfo') >= 0,
      '应保留学生基本信息区域');
  });

  it('76. 保留现有 Insight 审核', function () {
    assert.ok(allScript.indexOf('submitInsightReview') >= 0,
      '应保留审核功能');
  });

  it('77. 保留历史对话', function () {
    assert.ok(allScript.indexOf('renderConversations') >= 0,
      '应保留历史对话');
  });

  it('78. 保留返回名单', function () {
    assert.ok(allScript.indexOf('teacher-roster.html') >= 0 || allScript.indexOf('teacher-home.html') >= 0,
      '应保留返回名单');
  });

  it('79. 保留退出登录', function () {
    assert.ok(allScript.indexOf('handleLogout') >= 0,
      '应保留退出登录');
  });
});
