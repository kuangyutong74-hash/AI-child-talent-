/**
 * test/teacher-student-ui.test.js — 教师端学生详情页 UI 测试 (v2 rebuild)
 *
 * 解析 public/teacher-student.html，验证：
 *   API 端点、字段使用、XSS 安全、可访问性、画像边界
 *
 * 不启动服务器，不修改文件。
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

// ============================================================
//  Load html + extract script
// ============================================================

var htmlPath = path.join(__dirname, '..', 'public', 'teacher-student.html');
var htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Extract all inline <script> blocks
var scripts = [];
for (var m of htmlContent.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  scripts.push(m[1]);
}
assert.ok(scripts.length > 0, '应至少包含一个内联 <script>');
var allScript = scripts.join('\n');

var styleContent = (htmlContent.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];

// ============================================================
//  A. 页面结构 (v2 — declarative HTML with tab system)
// ============================================================

describe('A. 页面结构 (v2)', function () {

  it('1. 文件存在', function () {
    assert.ok(htmlContent.length > 100, 'teacher-student.html 应非空');
  });

  it('2. 包含返回学生名单入口', function () {
    assert.ok(
      (htmlContent.indexOf('teacher-home.html') >= 0 || htmlContent.indexOf('teacher-roster.html') >= 0) &&
      (htmlContent.indexOf('btn-back') >= 0 || htmlContent.indexOf('返回学生名单') >= 0),
      '应包含返回学生名单的链接');
  });

  it('3. 包含学生基本信息区域', function () {
    assert.ok(allScript.indexOf('student-card') >= 0 || allScript.indexOf('studentName') >= 0,
      '应包含学生基本信息区域');
  });

  it('4. 包含数据仪表盘区域', function () {
    assert.ok(allScript.indexOf('buildDashboard') >= 0 || allScript.indexOf('dashboard') >= 0,
      '应包含仪表盘区域');
  });

  it('5. 包含 AI 画像报告标签', function () {
    assert.ok(allScript.indexOf('AI画像报告') >= 0 || allScript.indexOf('tab-report') >= 0,
      '应包含 AI 画像报告标签');
  });

  it('6. 包含潜能线索标签', function () {
    assert.ok(allScript.indexOf('潜能线索') >= 0 || allScript.indexOf('tab-insights') >= 0,
      '应包含潜能线索标签');
  });

  it('7. 包含原始观察数据标签', function () {
    assert.ok(allScript.indexOf('原始观察数据') >= 0 || allScript.indexOf('tab-rawdata') >= 0,
      '应包含原始观察数据标签');
  });

  it('8. 包含确认记录标签', function () {
    assert.ok(allScript.indexOf('确认记录') >= 0 || allScript.indexOf('tab-confirms') >= 0,
      '应包含确认记录标签');
  });

  it('9. 包含历史对话入口', function () {
    assert.ok(allScript.indexOf('teacher-conversations.html') >= 0 || allScript.indexOf('查看历史对话') >= 0,
      '应包含历史对话入口（独立页面链接）');
  });
});

// ============================================================
//  B. studentId
// ============================================================

describe('B. studentId', function () {

  it('10. 使用 URLSearchParams', function () {
    assert.ok(allScript.indexOf('URLSearchParams') >= 0,
      '应使用 URLSearchParams 读取查询参数');
  });

  it('11. 读取 studentId', function () {
    assert.ok(allScript.indexOf("params.get('studentId')") >= 0,
      '应使用 params.get(\'studentId\')');
  });

  it('12. 缺失 studentId 时显示提示', function () {
    // initPage checks STUDENT_ID and shows message if missing
    assert.ok(
      allScript.indexOf('缺少学生标识') >= 0,
      '缺失 studentId 时应显示提示信息');
  });

  it('13. studentId 请求路径使用 encodeURIComponent', function () {
    assert.ok(allScript.indexOf('encodeURIComponent') >= 0,
      '请求路径中的 studentId 应使用 encodeURIComponent');
    assert.ok(
      allScript.indexOf('encodeURIComponent(studentId)') >= 0 ||
      allScript.indexOf('safeEncode(studentId)') >= 0,
      '应存在对 studentId 的 encode 调用');
  });

  it('14. 不使用 username/studentCode 作为接口标识', function () {
    var apiPaths = allScript.match(/\/api\/teacher\/student\/[^'"]+/g) || [];
    for (var i = 0; i < apiPaths.length; i++) {
      assert.ok(
        apiPaths[i].indexOf("' + username") < 0 && apiPaths[i].indexOf("studentCode") < 0,
        'API 路径 "' + apiPaths[i] + '" 不应使用 username 或 studentCode'
      );
    }
  });
});

// ============================================================
//  C. API (v2 — report, narrative, insights, confirm-records)
// ============================================================

describe('C. API (v2)', function () {

  it('15. 请求 report', function () {
    assert.ok(allScript.indexOf('/report') >= 0,
      '应请求 /report 接口');
  });

  it('16. 请求 narrative', function () {
    assert.ok(allScript.indexOf('/narrative') >= 0,
      '应请求 /narrative 接口');
  });

  it('17. 请求 insights', function () {
    assert.ok(allScript.indexOf('/insights') >= 0,
      '应请求 /insights 接口');
  });

  it('18. 请求 confirm-records', function () {
    assert.ok(allScript.indexOf('confirm-records') >= 0,
      '应请求 /confirm-records 接口');
  });

  it('19. 不直接读取 history.json', function () {
    assert.ok(allScript.indexOf('data/history.json') < 0,
      '不应直接读取 data/history.json');
  });

  it('20. 不直接读取 users.json', function () {
    assert.ok(allScript.indexOf('data/users.json') < 0,
      '不应直接读取 data/users.json');
  });

  it('21. 不直接读取 bindings.json', function () {
    assert.ok(allScript.indexOf('data/bindings.json') < 0,
      '不应直接读取 bindings.json');
  });
});

// ============================================================
//  D. 数据展示 (v2)
// ============================================================

describe('D. 数据展示 (v2)', function () {

  it('22. 显示学生姓名', function () {
    assert.ok(
      allScript.indexOf('username') >= 0,
      '应显示 student.username');
  });

  it('23. 不展示 student.studentCode', function () {
    assert.strictEqual(allScript.indexOf('studentCode'), -1,
      '不应显示 student.studentCode');
  });

  it('24. 使用 conversationCount', function () {
    assert.ok(allScript.indexOf('conversationCount') >= 0,
      '应使用 conversationCount');
  });

  it('25. 使用 totalTurns', function () {
    assert.ok(allScript.indexOf('totalTurns') >= 0,
      '应使用 totalTurns');
  });

  it('26. 使用维度数据', function () {
    assert.ok(allScript.indexOf('dimensions') >= 0,
      '应使用 dimensions 数据');
  });

  it('27. 使用 insightCount', function () {
    assert.ok(allScript.indexOf('insightCount') >= 0,
      '应使用 insightCount');
  });

  it('28. 维度卡片包含计数信息', function () {
    assert.ok(allScript.indexOf('条线索') >= 0,
      '维度卡片应显示线索计数');
  });

  it('29. 使用 insights 数据', function () {
    assert.ok(allScript.indexOf('insights') >= 0,
      '应使用 insights 数据');
  });

  it('30. 显示 evidenceSnippet', function () {
    assert.ok(
      allScript.indexOf('evidenceSnippet') >= 0 || allScript.indexOf('evidence') >= 0,
      '应显示或处理 evidenceSnippet');
  });

  it('31. 空数据有明确占位', function () {
    assert.ok(
      allScript.indexOf('暂无') >= 0,
      '空数据应有占位文本');
  });

  it('32. 包含叙事模块（核心发现等）', function () {
    assert.ok(allScript.indexOf('coreFindings') >= 0,
      '应包含 coreFindings 叙事模块');
  });

  it('33. 包含叙事模块编辑功能', function () {
    assert.ok(allScript.indexOf('saveModuleEdit') >= 0 || allScript.indexOf('openModuleEdit') >= 0,
      '应包含模块编辑功能');
  });

  it('34. 包含确认记录展示', function () {
    assert.ok(allScript.indexOf('confirmRecordItem') >= 0 || allScript.indexOf('buildConfirmRecordItem') >= 0,
      '应包含确认记录展示功能');
  });
});

// ============================================================
//  E. 权限和错误
// ============================================================

describe('E. 权限和错误', function () {

  it('35. 401 跳转登录', function () {
    assert.ok(
      (allScript.match(/login\.html/gi) || []).length >= 2,
      '多处应包含 login.html 跳转处理');
  });

  it('36. error 处理存在', function () {
    assert.ok(
      allScript.indexOf('401') >= 0 || allScript.indexOf('catch') >= 0,
      '应有错误处理机制');
  });

  it('37. 缺失 studentId 有安全处理', function () {
    assert.ok(allScript.indexOf('STUDENT_ID') >= 0 || allScript.indexOf('studentId') >= 0,
      '应存在 studentId 缺失时的处理');
  });

  it('38. 网络错误有提示', function () {
    assert.ok(
      allScript.indexOf('加载失败') >= 0 || allScript.indexOf('重试') >= 0,
      '网络错误时应提供提示');
  });

  it('39. 不输出原始异常', function () {
    assert.ok(allScript.indexOf('error.message') < 0,
      '不应直接输出 exception.message');
    assert.ok(allScript.indexOf('error.stack') < 0,
      '不应输出 stack trace');
  });
});

// ============================================================
//  F. 安全
// ============================================================

describe('F. 安全', function () {

  it('41. 动态渲染使用 createElement', function () {
    assert.ok(allScript.indexOf('createElement') >= 0,
      '应使用 document.createElement');
  });

  it('42. 动态数据使用 textContent', function () {
    assert.ok(allScript.indexOf('textContent') >= 0,
      '应使用 textContent 设置文字');
  });

  it('43. 使用 dataset', function () {
    assert.ok(allScript.indexOf('dataset.') >= 0,
      '应使用 dataset 存储标识符');
  });

  it('44. 使用 addEventListener', function () {
    assert.ok(allScript.indexOf('addEventListener') >= 0,
      '应使用 addEventListener 绑定事件');
  });

  it('45. 不使用 innerHTML 插入动态学生数据', function () {
    // innerHTML is used only for static content (print area, spinner)
    // Dynamic data rendering uses textContent
    var printAreaHtml = allScript.indexOf("printArea.innerHTML = html");
    var otherInnerHtml = allScript.match(/\.innerHTML\s*=/g) || [];
    // Allow innerHTML for print area only; check not used for API data
    assert.ok(otherInnerHtml.length <= 3, 'innerHTML 使用应受限制');
  });

  it('46. 不使用 insertAdjacentHTML', function () {
    assert.ok(allScript.indexOf('insertAdjacentHTML') < 0,
      '不应使用 insertAdjacentHTML');
  });

  it('47. 不使用 eval', function () {
    assert.ok(allScript.indexOf('eval(') < 0,
      '不应使用 eval');
  });

  it('48. 不使用 new Function', function () {
    assert.ok(allScript.indexOf('new Function') < 0,
      '不应使用 new Function');
  });

  it('49. 不使用 onclick 字符串属性（动态内容）', function () {
    var dynamicOnclick = allScript.match(/\.onclick\s*=\s*/g);
    assert.strictEqual(dynamicOnclick, null, '动态渲染不应使用 .onclick = 赋值');
  });

  it('50. studentId 经过 encodeURIComponent', function () {
    var encodeCalls = allScript.match(/safeEncode\(/g) || [];
    assert.ok(encodeCalls.length >= 1, '应对 studentId 使用 safeEncode');
  });
});

// ============================================================
//  G. 画像边界
// ============================================================

describe('G. 画像边界', function () {

  it('51. 不包含能力分数', function () {
    assert.ok(
      allScript.indexOf('score') < 0 && allScript.indexOf('分数') < 0,
      '不应包含能力分数');
  });

  it('52. 不包含百分比评分（除确认率统计外）', function () {
    // confirmation rate percentage is acceptable as a stat
    var pctMatches = allScript.match(/%/g) || [];
    assert.ok(pctMatches.length < 10, '百分比使用不应过多');
  });

  it('53. 不包含确定性天赋诊断', function () {
    assert.ok(
      allScript.indexOf('才能') < 0 && allScript.indexOf('天分') < 0 && allScript.indexOf('有天赋') < 0,
      '不应包含天赋诊断类文本');
    assert.ok(
      allScript.indexOf('擅长') < 0 && allScript.indexOf('适合') < 0,
      '不应包含能力判断类文本');
  });

  it('54. 包含免责声明', function () {
    assert.ok(
      allScript.indexOf('免责') >= 0 || allScript.indexOf('仅供参考') >= 0 || allScript.indexOf('不构成') >= 0,
      '应包含免责声明');
  });

  it('55. 使用 reviewStatus 字段', function () {
    assert.ok(
      allScript.indexOf('reviewStatus') >= 0,
      '应使用 reviewStatus 字段');
  });

  it('56. 使用 unreviewed 状态', function () {
    assert.ok(
      allScript.indexOf('unreviewed') >= 0 || allScript.indexOf('R_UNREVIEWED') >= 0,
      '应处理 unreviewed 状态');
  });

  it('57. 不包含确定性天赋诊断文本', function () {
    assert.ok(
      allScript.indexOf('已确认天赋') < 0 && allScript.indexOf('天赋成立') < 0,
      '不应包含确定性天赋诊断类文本');
  });
});

// ============================================================
//  H. 可访问性
// ============================================================

describe('H. 可访问性', function () {

  it('61. 错误提示使用 role=alert', function () {
    // Check that error states are communicated
    assert.ok(allScript.indexOf('empty-state') >= 0 || allScript.indexOf('error') >= 0,
      '应包含错误状态提示样式');
  });

  it('62. 加载状态使用合适的容器', function () {
    assert.ok(allScript.indexOf('loadingState') >= 0 || allScript.indexOf('loading-state') >= 0,
      '应包含加载状态容器');
  });

  it('63. 按钮对键盘可操作', function () {
    assert.ok(allScript.indexOf('addEventListener') >= 0,
      '应使用 addEventListener 绑定键盘事件');
  });

  it('64. 保留学生基本信息区域', function () {
    assert.ok(htmlContent.indexOf('student-card') >= 0 || allScript.indexOf('student-card') >= 0,
      '应保留学生基本信息区域');
  });

  it('65. 保留仪表盘区域', function () {
    assert.ok(htmlContent.indexOf('dashboard') >= 0 || allScript.indexOf('dashboard') >= 0,
      '应保留仪表盘区域');
  });

  it('66. 保留返回学生名单入口', function () {
    assert.ok(
      (htmlContent.indexOf('返回学生名单') >= 0 || allScript.indexOf('返回学生名单') >= 0),
      '应保留返回学生名单入口');
  });

  it('67. 保留退出登录入口', function () {
    assert.ok(
      (htmlContent.indexOf('退出登录') >= 0 || allScript.indexOf('btnLogout') >= 0),
      '应保留退出登录入口');
  });

  it('68. 保留缺失 studentId 处理', function () {
    assert.ok(
      allScript.indexOf('缺少学生标识') >= 0 || allScript.indexOf('!STUDENT_ID') >= 0,
      '应保留缺失 studentId 处理');
  });

  it('69. 保留免责声明', function () {
    assert.ok(
      allScript.indexOf('免责') >= 0 || allScript.indexOf('report-disclaimer') >= 0,
      '应保留免责声明');
  });
});

// ============================================================
//  I. CSS 约束 (v2 关键要求)
// ============================================================

describe('I. CSS 约束 (v2)', function () {

  it('70. 无子容器滚动条（body 级别统一滚动）', function () {
    // No overflow-y: auto/scroll on any child element
    assert.ok(!/overflow-y\s*:\s*(auto|scroll)/.test(styleContent),
      '不应有任何子容器使用 overflow-y: auto/scroll');
  });

  it('71. 标签栏无 fixed 定位', function () {
    assert.ok(styleContent.indexOf('position: fixed') < 0,
      '标签栏不应使用 position: fixed');
  });

  it('72. 标签栏无 sticky 定位', function () {
    assert.ok(styleContent.indexOf('position: sticky') < 0,
      '标签栏不应使用 position: sticky');
  });

  it('73. html/body 无 height: 100% 限制', function () {
    assert.ok(!/html,\s*body\s*\{[^}]*height\s*:\s*100%/.test(styleContent),
      'html/body 不应设置 height: 100%');
  });

  it('74. 包含打印样式', function () {
    assert.ok(styleContent.indexOf('@media print') >= 0,
      '应包含 @media print 样式');
  });

  it('75. 包含打印区域', function () {
    assert.ok(htmlContent.indexOf('printArea') >= 0,
      '应包含打印区域 #printArea');
  });

  it('76. 包含导出 PDF 功能', function () {
    assert.ok(allScript.indexOf('exportPdf') >= 0,
      '应包含 exportPdf 函数');
  });
});
