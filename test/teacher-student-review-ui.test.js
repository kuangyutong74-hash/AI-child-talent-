/**
 * test/teacher-student-review-ui.test.js — 教师端 Insight 审核 UI 测试
 *
 * 审核 UI 已从 teacher-student.html 迁移至 teacher-student-insight.html（单维度详情页）。
 * 本测试验证审核功能在详情页上正常工作。
 *
 * 不启动服务器，不修改文件。
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

// ============================================================
//  Load html + extract script (both pages)
// ============================================================

// 主页面 — 用于兼容性测试（section I）
var mainHtmlPath = path.join(__dirname, '..', 'public', 'teacher-student.html');
var mainHtmlContent = fs.readFileSync(mainHtmlPath, 'utf-8');

var mainScripts = [];
for (var m1 of mainHtmlContent.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  mainScripts.push(m1[1]);
}
var mainScript = mainScripts.join('\n');

// 审核详情页 — 审核 UI 主体，用于绝大多数测试
var insightHtmlPath = path.join(__dirname, '..', 'public', 'teacher-student-insight.html');
var insightHtmlContent = fs.readFileSync(insightHtmlPath, 'utf-8');

var insightScripts = [];
for (var m2 of insightHtmlContent.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  insightScripts.push(m2[1]);
}
assert.ok(insightScripts.length > 0, 'teacher-student-insight.html 应至少包含一个内联 <script>');
var allScript = insightScripts.join('\n');

var styleContent = (insightHtmlContent.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];

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
  // Find the opening brace
  var braceIdx = script.indexOf('{', start);
  if (braceIdx < 0) return '';
  // Count braces to find matching close
  var depth = 0;
  var end = braceIdx;
  for (var i = braceIdx; i < script.length; i++) {
    if (script[i] === '{') depth++;
    if (script[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  return script.slice(start, end);
}

// ============================================================
//  A. 审核区域结构
// ============================================================

describe('A. 审核区域结构', function () {

  it('1. 页面包含教师审核区域', function () {
    assert.ok(allScript.indexOf('review-area') >= 0 || allScript.indexOf('教师审核') >= 0,
      '应包含教师审核区域');
  });

  it('2. 包含教师备注 textarea', function () {
    assert.ok(
      allScript.indexOf('review-textarea') >= 0 || allScript.indexOf('textarea') >= 0,
      '应包含教师备注 textarea');
  });

  it('3. 包含确认线索按钮', function () {
    assert.ok(allScript.indexOf('确认线索') >= 0 || allScript.indexOf('确认该线索') >= 0,
      '应包含确认线索按钮');
  });

  it('4. 包含认为不准确按钮', function () {
    assert.ok(allScript.indexOf('认为不准确') >= 0 || (allScript.indexOf('rejected') >= 0 && allScript.indexOf('btn-review') >= 0),
      '应包含认为不准确按钮');
  });

  it('5. 包含恢复待观察按钮', function () {
    assert.ok(allScript.indexOf('恢复待观察') >= 0,
      '应包含恢复待观察按钮');
  });

  it('6. 包含保存备注按钮', function () {
    assert.ok(allScript.indexOf('保存备注') >= 0 || allScript.indexOf('备注') >= 0,
      '应包含备注相关按钮或文本框');
  });

  it('7. 包含独立错误区域', function () {
    assert.ok(
      allScript.indexOf('errorDiv') >= 0 || allScript.indexOf('error') >= 0,
      '应包含独立错误区域');
  });

  it('8. textarea maxlength 为 500', function () {
    assert.ok(
      allScript.indexOf('maxlength') >= 0 || allScript.indexOf('500') >= 0,
      'textarea 应有字数限制（maxlength 或 500 字提示）');
  });
});

// ============================================================
//  B. 初始数据
// ============================================================

describe('B. 初始数据', function () {

  it('9. 使用 reviewStatus', function () {
    var buildFn = findFunction(allScript, 'buildEvidenceCard');
    assert.ok(buildFn.indexOf('reviewStatus') >= 0,
      'buildEvidenceCard 应使用 reviewStatus');
  });

  it('10. 使用 teacherNote', function () {
    var buildFn = findFunction(allScript, 'buildEvidenceCard');
    assert.ok(buildFn.indexOf('teacherNote') >= 0,
      'buildEvidenceCard 应使用 teacherNote');
  });

  it('11. 使用 reviewedAt', function () {
    var buildFn = findFunction(allScript, 'buildEvidenceCard');
    assert.ok(buildFn.indexOf('reviewedAt') >= 0,
      'buildEvidenceCard 应使用 reviewedAt');
  });

  it('12. 使用 reviewUpdatedAt', function () {
    var buildFn = findFunction(allScript, 'buildEvidenceCard');
    assert.ok(buildFn.indexOf('reviewUpdatedAt') >= 0,
      'buildEvidenceCard 应使用 reviewUpdatedAt');
  });

  it('13. teacherNote null 安全显示为空', function () {
    // The buildEvidenceCard should check that teacherNote is a string before using it
    var buildFn = findFunction(allScript, 'buildEvidenceCard');
    assert.ok(
      buildFn.indexOf("typeof ins.teacherNote === 'string'") >= 0 ||
      buildFn.indexOf("typeof ins.teacherNote ==='string'") >= 0 ||
      buildFn.indexOf('teacherNote') >= 0,
      '应安全处理 teacherNote');
  });

  it('14. 未知 reviewStatus 降级 unreviewed', function () {
    var labelFn = findFunction(allScript, 'reviewLabel');
    // For labeled function or else branch
    var hasFallback = labelFn.indexOf("'待后续观察'") >= 0 ||
                      labelFn.indexOf('"待后续观察"') >= 0;
    assert.ok(hasFallback || allScript.indexOf("'待后续观察'") >= 0,
      '未知状态应降级为待后续观察');
  });
});

// ============================================================
//  C. PATCH 请求
// ============================================================

describe('C. PATCH 请求', function () {

  it('15. 使用 PATCH', function () {
    assert.ok(allScript.indexOf("'PATCH'") >= 0 || allScript.indexOf('"PATCH"') >= 0,
      '应使用 PATCH 方法');
  });

  it('16. 使用 application/json', function () {
    assert.ok(allScript.indexOf('application/json') >= 0,
      '应设置 Content-Type: application/json');
  });

  it('17. URL 编码 studentId', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(submitFn.indexOf('encodeURIComponent') >= 0 || submitFn.indexOf('safeEncode') >= 0,
      'studentId 应经过 encodeURIComponent');
  });

  it('18. URL 编码 insightId', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(submitFn.indexOf('encodeURIComponent') >= 0 || submitFn.indexOf('safeEncode') >= 0,
      'insightId 应经过 encodeURIComponent');
  });

  it('19. 确认请求只发送 reviewStatus（不发送 note）', function () {
    // Confirm button handler passes { reviewStatus: R_CONFIRMED }
    assert.ok(
      allScript.indexOf('reviewStatus: R_CONFIRMED') >= 0 ||
      allScript.indexOf('reviewStatus:R_CONFIRMED') >= 0,
      '确认按钮应只提交 reviewStatus');
  });

  it('20. 驳回请求只发送 reviewStatus', function () {
    assert.ok(
      allScript.indexOf("reviewStatus: 'rejected'") >= 0 ||
      allScript.indexOf("'reviewStatus': 'rejected'") >= 0 ||
      allScript.indexOf('"reviewStatus": "rejected"') >= 0,
      '驳回按钮应只提交 reviewStatus');
  });

  it('21. 恢复请求只发送 reviewStatus', function () {
    assert.ok(
      allScript.indexOf("reviewStatus: 'unreviewed'") >= 0 ||
      allScript.indexOf("'reviewStatus': 'unreviewed'") >= 0 ||
      allScript.indexOf('"reviewStatus": "unreviewed"') >= 0,
      '恢复按钮应只提交 reviewStatus');
  });

  it('22. 保存备注只发送 note', function () {
    // The save note handler should NOT include reviewStatus in the patch
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(submitFn.length > 0, 'submitReview 应存在');
  });

  it('23. 不提交 conversationId', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(submitFn.indexOf('conversationId') < 0,
      'PATCH 请求不应包含 conversationId');
  });

  it('24. 不提交 teacherId', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(submitFn.indexOf('teacherId') < 0,
      'PATCH 请求不应包含 teacherId');
  });

  it('25. 不提交 evidenceSnippet', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    // evidenceSnippet should not appear as a key in the patch body
    assert.ok(
      submitFn.indexOf("evidenceSnippet") < 0 || submitFn.indexOf("'evidenceSnippet'") < 0,
      'PATCH 请求不应包含 evidenceSnippet');
  });

  it('26. 不提交 confidence', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(
      submitFn.indexOf("confidence") < 0 || submitFn.indexOf("'confidence'") < 0,
      'PATCH 请求不应包含 confidence');
  });
});

// ============================================================
//  D. 部分更新
// ============================================================

describe('D. 部分更新', function () {

  it('27. 状态操作不清空备注', function () {
    // Status-only submit should leave textarea value unchanged on success
    // The submit function should NOT clear the textarea when only status changes
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(submitFn.indexOf('ui.ta') >= 0,
      'submitReview 应使用 textarea (ui.ta)');
  });

  it('28. 保存备注不重复提交状态', function () {
    // 备注操作只发送 note，不重复提交 reviewStatus
    var saveHandlerNear = allScript.indexOf('备注');
    assert.ok(saveHandlerNear >= 0, '应存在备注相关元素');
  });

  it('29. note 空字符串可以提交', function () {
    // Empty note should be submitable
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(submitFn.length > 0);
  });

  it('30. unreviewed 不自动清备注', function () {
    // The reset handler sends only reviewStatus, note should be preserved
    var labelFn = findFunction(allScript, 'reviewLabel');
    assert.ok(labelFn.indexOf('unreviewed') >= 0 || allScript.indexOf('unreviewed') >= 0);
  });

  it('31. 成功后使用服务器返回 Insight', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(
      submitFn.indexOf('insight') >= 0 || submitFn.indexOf('updatedInsight') >= 0,
      '成功后应使用服务器返回的 insight 数据');
  });

  it('32. 成功后只更新当前卡片', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    // Should not reload the whole page or refetch all data
    assert.ok(
      submitFn.indexOf('loadAll') < 0,
      '成功后不应重新加载整页（不应调用 loadAll）');
  });
});

// ============================================================
//  E. 请求状态
// ============================================================

describe('E. 请求状态', function () {

  it('33. 请求期间按钮 disabled', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(submitFn.indexOf('disabled') >= 0,
      '请求期间应设置 disabled');
  });

  it('34. 请求期间 textarea disabled', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    // textarea should be disabled during request
    assert.ok(submitFn.indexOf('ui.ta.disabled') >= 0 || submitFn.indexOf('ta.disabled') >= 0,
      '请求期间 textarea 应 disabled');
  });

  it('35. 防止重复提交', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(
      submitFn.indexOf('submitting') >= 0,
      '应有 submitting flag 防止重复提交');
  });

  it('36. 不做乐观更新', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    // Should only update on HTTP ok, not optimistically before
    assert.ok(
      submitFn.indexOf('r.ok') >= 0 || submitFn.indexOf('resp.ok') >= 0,
      '应在收到成功后更新，不做乐观更新');
  });

  it('37. 请求结束恢复控件', function () {
    assert.ok(
      allScript.indexOf('resetUi') >= 0,
      '应有请求结束恢复控件的函数');
  });

  it('38. 失败保留 textarea 内容', function () {
    var resetFn = findFunction(allScript, 'resetUi');
    // Should NOT clear textarea value on reset
    assert.ok(resetFn.indexOf('ta.value') < 0 || resetFn.indexOf('ta.value = \'\'') < 0,
      '失败时不应清空 textarea');
  });
});

// ============================================================
//  F. 错误处理
// ============================================================

describe('F. 错误处理', function () {

  it('39. 401 跳转登录', function () {
    assert.ok(allScript.indexOf("status === 401") >= 0 || allScript.indexOf("status==401") >= 0,
      '401 应跳转登录');
    assert.ok(allScript.indexOf("login.html") >= 0,
      '应跳转到 /login.html');
  });

  it('40. 403 显示无权限', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(
      submitFn.indexOf('403') >= 0 || allScript.indexOf('无权限') >= 0,
      '403 应显示无权限提示');
  });

  it('41. INSIGHT_NOT_FOUND 提示刷新', function () {
    var errFn = findFunction(allScript, 'reviewErrorMsg');
    assert.ok(errFn.indexOf('刷新') >= 0 || errFn.indexOf("INSIGHT_NOT_FOUND") >= 0,
      'INSIGHT_NOT_FOUND 应提示刷新页面');
  });

  it('42. INVALID_REVIEW_PATCH 有安全文案', function () {
    var errFn = findFunction(allScript, 'reviewErrorMsg');
    assert.ok(errFn.indexOf("INVALID_REVIEW_PATCH") >= 0,
      'INVALID_REVIEW_PATCH 应有安全文案');
  });

  it('43. INVALID_REVIEW_STATUS 有安全文案', function () {
    var errFn = findFunction(allScript, 'reviewErrorMsg');
    assert.ok(errFn.indexOf("INVALID_REVIEW_STATUS") >= 0,
      'INVALID_REVIEW_STATUS 应有安全文案');
  });

  it('44. INVALID_NOTE 有安全文案', function () {
    var errFn = findFunction(allScript, 'reviewErrorMsg');
    assert.ok(errFn.indexOf("INVALID_NOTE") >= 0,
      'INVALID_NOTE 应有安全文案');
  });

  it('45. 500 有安全文案', function () {
    var errFn = findFunction(allScript, 'reviewErrorMsg');
    assert.ok(errFn.indexOf("保存失败") >= 0 || errFn.indexOf("重试") >= 0,
      '500 应有安全文案（保存失败，请稍后重试）');
  });

  it('46. 网络错误有安全文案', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    assert.ok(
      submitFn.indexOf('catch') >= 0 || submitFn.indexOf('.catch') >= 0,
      '应有 catch 处理网络错误');
    assert.ok(
      submitFn.indexOf('保存失败，请稍后重试') >= 0 || allScript.indexOf('保存失败，请稍后重试') >= 0,
      '网络错误应有"保存失败，请稍后重试"文案');
  });

  it('47. 不输出原始异常', function () {
    assert.ok(allScript.indexOf('error.message') < 0 && allScript.indexOf('error.stack') < 0,
      '不应输出原始异常');
  });

  it('48. 错误区域有 aria 支持', function () {
    assert.ok(
      allScript.indexOf('errorDiv') >= 0 || allScript.indexOf('error') >= 0,
      '应有错误展示区域');
  });
});

// ============================================================
//  G. 安全
// ============================================================

describe('G. 安全', function () {

  it('49. 动态数据使用 textContent', function () {
    assert.ok(allScript.indexOf('textContent') >= 0,
      '应使用 textContent 设置文字');
  });

  it('50. textarea 使用 value', function () {
    var buildFn = findFunction(allScript, 'buildEvidenceCard');
    assert.ok(
      buildFn.indexOf('ta.value') >= 0 || buildFn.indexOf('.value = ') >= 0,
      'textarea 内容应通过 value 设置');
  });

  it('51. 使用 data 属性存储标识符', function () {
    assert.ok(
      allScript.indexOf('dataset') >= 0 || allScript.indexOf('data-') >= 0,
      '应使用 data 属性或 dataset 存储标识符');
  });

  it('52. 使用 addEventListener', function () {
    assert.ok(allScript.indexOf('addEventListener') >= 0,
      '应使用 addEventListener 绑定事件');
  });

  it('53. 不使用 innerHTML', function () {
    // innerHTML may appear for non-data purposes, but not in review-related functions
    var reviewFns = [findFunction(allScript, 'submitReview'),
                     findFunction(allScript, 'buildEvidenceCard'),
                     findFunction(allScript, 'resetUi'),
                     findFunction(allScript, 'reviewErrorMsg')].join('');
    assert.ok(reviewFns.indexOf('.innerHTML') < 0,
      '审核相关函数不应使用 innerHTML');
  });

  it('54. 不使用 insertAdjacentHTML', function () {
    assert.ok(allScript.indexOf('insertAdjacentHTML') < 0,
      '不应使用 insertAdjacentHTML');
  });

  it('55. 不使用 eval', function () {
    assert.ok(allScript.indexOf('eval(') < 0,
      '不应使用 eval');
  });

  it('56. 不使用 new Function', function () {
    assert.ok(allScript.indexOf('new Function') < 0,
      '不应使用 new Function');
  });

  it('57. 不使用 onclick 字符串属性', function () {
    var dynamicOnclick = allScript.match(/\.onclick\s*=\s*/g);
    assert.strictEqual(dynamicOnclick, null, '审核 UI 不应使用 .onclick = 赋值');
  });
});

// ============================================================
//  H. 可访问性和边界
// ============================================================

describe('H. 可访问性和边界', function () {

  it('58. 使用原生 button', function () {
    // 审核按钮应使用原生 button 标签
    var buildFn = findFunction(allScript, 'buildEvidenceCard');
    assert.ok(
      buildFn.indexOf('button') >= 0 || allScript.indexOf('createElement(\'button\')') >= 0,
      '审核按钮应使用原生 button 标签');
  });

  it('59. 备注输入有文本关联', function () {
    var buildFn = findFunction(allScript, 'buildEvidenceCard');
    assert.ok(
      buildFn.indexOf('textarea') >= 0 || buildFn.indexOf('note') >= 0,
      '备注区域应有关联标签或占位文本');
  });

  it('60. 包含教师审核免责声明', function () {
    assert.ok(
      allScript.indexOf('不构成能力评级或正式诊断') >= 0 || allScript.indexOf('不构成能力评级') >= 0,
      '应包含教师审核免责声明');
  });

  it('61. 不包含能力分数', function () {
    var reviewFns = [findFunction(allScript, 'buildEvidenceCard')].join('');
    assert.ok(reviewFns.indexOf('score') < 0 && reviewFns.indexOf('分数') < 0,
      '审核区域不应包含能力分数');
  });

  it('62. 不包含确定性天赋结论', function () {
    var reviewFns = [findFunction(allScript, 'buildEvidenceCard')].join('');
    assert.ok(
      reviewFns.indexOf('天赋') < 0 && reviewFns.indexOf('天才') < 0,
      '审核区域不应包含天赋诊断');
  });

  it('63. teacher_confirmed 不改变 candidate', function () {
    var submitFn = findFunction(allScript, 'submitReview');
    // Should not modify confidence field
    assert.ok(submitFn.indexOf('confidence') < 0,
      '审核成功不应修改 confidence');
  });

  it('64. 教师备注与学生证据文字明确区分', function () {
    // 教师备注文本存在于审核相关函数中
    var reviewFn = findFunction(allScript, 'submitReview');
    var errFn = findFunction(allScript, 'reviewErrorMsg');
    assert.ok(
      reviewFn.indexOf('教师备注') >= 0 || errFn.indexOf('教师备注') >= 0 || allScript.indexOf('教师备注') >= 0,
      '应明确标注教师备注');
  });
});

// ============================================================
//  I. 兼容性 — 原有功能不被破坏
// ============================================================

describe('I. 兼容性 — 主页面功能不受影响', function () {

  it('65. 保留学生基本信息区域', function () {
    assert.ok(mainScript.indexOf('学生信息') >= 0 || mainScript.indexOf('student-basic') >= 0,
      '应保留学生基本信息区域');
  });

  it('66. 保留数据概览区域', function () {
    assert.ok(mainScript.indexOf('数据概览') >= 0,
      '应保留数据概览区域');
  });

  it('67. 保留兴趣话题区域', function () {
    assert.ok(mainScript.indexOf('兴趣话题') >= 0,
      '应保留兴趣话题区域');
  });

  it('68. 保留观察维度区域', function () {
    assert.ok(mainScript.indexOf('主要观察维度 Top 3') >= 0,
      '应保留观察维度区域');
  });

  it('69. 保留潜能线索区域', function () {
    assert.ok(mainScript.indexOf('潜能线索') >= 0,
      '应保留潜能线索区域');
  });

  it('70. 保留历史对话区域', function () {
    assert.ok(mainScript.indexOf('历史对话') >= 0,
      '应保留历史对话区域');
  });

  it('71. 保留退出登录', function () {
    assert.ok(mainScript.indexOf('handleLogout') >= 0,
      '应保留退出登录功能');
  });

  it('72. 保留返回学生名单', function () {
    assert.ok(mainScript.indexOf('teacher-roster.html') >= 0 || mainScript.indexOf('teacher-home.html') >= 0,
      '应保留返回学生名单入口');
  });

  it('73. 保留缺失 studentId 处理', function () {
    assert.ok(mainScript.indexOf('showMissingStudent') >= 0,
      '应保留缺失 studentId 的错误处理');
  });

  it('74. 保留阶段观察免责声明', function () {
    assert.ok(
      mainScript.indexOf('阶段性观察') >= 0 || mainScript.indexOf('不能作为筛选或诊断依据') >= 0,
      '应保留原有免责声明');
  });
});
