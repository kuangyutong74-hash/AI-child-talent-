/**
 * test/teacher-home-ui.test.js — 教师首页 UI 测试
 *
 * 解析 public/teacher-home.html 和 public/teacher-roster.html，验证：
 *   正确显示后端字段、安全跳转、XSS 防护、空/错误状态
 *
 * 不启动服务器，不修改文件。
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

// ============================================================
//  加载并解析 teacher-home.html
// ============================================================

var HOME_PATH = path.join(__dirname, '..', 'public', 'teacher-home.html');
var ROSTER_PATH = path.join(__dirname, '..', 'public', 'teacher-roster.html');

var homeHtml = fs.readFileSync(HOME_PATH, 'utf-8');
var rosterHtml = fs.readFileSync(ROSTER_PATH, 'utf-8');

var homeScriptMatch = homeHtml.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(homeScriptMatch, 'teacher-home.html 应包含内联 <script>');
var homeScript = homeScriptMatch[1];

var rosterScriptMatch = rosterHtml.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(rosterScriptMatch, 'teacher-roster.html 应包含内联 <script>');
var rosterScript = rosterScriptMatch[1];

// Combined script for backend/API tests
var allScript = homeScript + '\n' + rosterScript;

// ============================================================
//  A. 接口请求与数据使用 (home + roster)
// ============================================================

describe('A. 接口请求与数据使用', function () {

  it('1. 页面请求 /api/teacher/roster', function () {
    assert.ok(allScript.indexOf('/api/teacher/roster') >= 0,
      '脚本中应包含 /api/teacher/roster 的 fetch 调用');
  });

  it('2. 不再包含"学生画像功能开发中"', function () {
    assert.ok(allScript.indexOf('学生画像功能开发中') < 0,
      '不应包含旧的占位 alert 文字');
    assert.ok(allScript.indexOf('alert(') < 0,
      '不应包含旧的 alert 调用');
  });

  it('3. 使用 totalConversations', function () {
    assert.ok(allScript.indexOf('totalConversations') >= 0,
      '脚本中应引用 totalConversations 字段');
  });

  it('4. 使用 lastActiveDate', function () {
    assert.ok(allScript.indexOf('lastActiveDate') >= 0,
      '脚本中应引用 lastActiveDate 字段');
  });

  it('5. 使用 recentInsightCount7d', function () {
    assert.ok(allScript.indexOf('recentInsightCount7d') >= 0,
      '脚本中应引用 recentInsightCount7d 字段');
  });

  it('6. roster 页面使用 topTopics/insightCount', function () {
    // roster page may reference insightCount from roster data
    assert.ok(allScript.indexOf('insightCount') >= 0,
      '脚本中应引用 insightCount 字段');
  });

  it('7. 使用 safetyAlertCount', function () {
    assert.ok(rosterScript.indexOf('safetyAlertCount') >= 0,
      'roster 脚本中应引用 safetyAlertCount 字段');
  });

  it('8. studentId 使用 encodeURIComponent', function () {
    assert.ok(allScript.indexOf('encodeURIComponent') >= 0,
      '跳转 URL 应使用 encodeURIComponent');
  });

  it('9. 跳转到 teacher-student.html 和 teacher-roster.html', function () {
    assert.ok(allScript.indexOf("teacher-student.html?studentId=") >= 0,
      '跳转目标应包含 teacher-student.html');
    assert.ok(allScript.indexOf("teacher-roster.html") >= 0 || homeScript.indexOf("teacher-roster.html") >= 0,
      '首页应跳转到 teacher-roster.html');
  });

  it('10. URL 参数应使用 studentId 而非 username', function () {
    assert.ok(allScript.indexOf('username') < 0 || allScript.indexOf('studentId=') >= 0,
      'URL 参数应使用 studentId 而非 username');
  });
});

// ============================================================
//  B. 空数据与错误状态
// ============================================================

describe('B. 空数据与错误状态', function () {

  it('11. roster 空数组有空状态', function () {
    assert.ok(rosterScript.indexOf('showEmpty') >= 0,
      'roster 应存在 showEmpty 函数');
    assert.ok(rosterScript.indexOf('还没有绑定学生') >= 0 ||
              homeScript.indexOf('还没有绑定学生') >= 0,
      '空状态应显示“还没有绑定学生”');
  });

  it('12. lastActiveDate 为 null/非法时有安全占位', function () {
    // fmtDate is in roster page
    assert.ok(allScript.indexOf('fmtDate') >= 0,
      '应存在 fmtDate 函数');
    assert.ok(allScript.indexOf('暂无对话') >= 0,
      '日期处理应包含"暂无对话"占位符');
  });

  it('13. 首页 summary card 展示加载状态', function () {
    assert.ok(homeScript.indexOf('loadRosterSummary') >= 0,
      '首页应包含 loadRosterSummary 函数');
    assert.ok(homeScript.indexOf('roster-summary-card') >= 0 || homeHtml.indexOf('roster-summary-card') >= 0,
      '首页应包含 roster-summary-card');
  });

  it('14. 401 有登录跳转处理', function () {
    assert.ok(allScript.indexOf('/login.html') >= 0,
      '401/未登录时应跳转到 login.html');
    assert.ok(
      allScript.indexOf("resp.status === 401") >= 0 &&
      allScript.indexOf("window.location.href = '/login.html") >= 0,
      '401 状态应执行 window.location.href 跳转');
  });

  it('15. 403 有权限提示', function () {
    assert.ok(allScript.indexOf('当前账号不是教师') >= 0,
      '403 状态应显示教师权限提示');
  });

  it('16. 请求失败有错误状态', function () {
    assert.ok(rosterScript.indexOf('showError') >= 0 || homeScript.indexOf('showError') >= 0,
      '应存在 showError 函数');
    assert.ok(allScript.indexOf('重新加载') >= 0,
      '错误状态应包含重试按钮');
  });
});

// ============================================================
//  C. 安全与隐私
// ============================================================

describe('C. 安全与隐私', function () {

  it('17. 页面不读取 data/history.json', function () {
    assert.ok(allScript.indexOf('data/history.json') < 0,
      '脚本不应直接读取 data/history.json');
    assert.ok(allScript.indexOf('HISTORY_FILE') < 0,
      '脚本不应引用服务器端文件名');
  });

  it('18. 页面只调用允许的接口', function () {
    var fetchCalls = allScript.match(/['"]\/api\/[^'"]*['"]/g) || [];
    var allowedPrefixes = [
      '/api/auth/me',
      '/api/auth/logout',
      '/api/teacher/roster',
      '/api/teacher/bind-student',
    ];
    for (var i = 0; i < fetchCalls.length; i++) {
      var url = fetchCalls[i].replace(/['"]/g, '');
      var ok = false;
      for (var j = 0; j < allowedPrefixes.length; j++) {
        if (url.indexOf(allowedPrefixes[j]) === 0) { ok = true; break; }
      }
      assert.ok(ok, 'fetch URL "' + url + '" 不在允许列表中');
    }
  });

  it('19. 不使用 innerHTML 插入接口学生数据 (roster)', function () {
    // roster page buildCard uses textContent
    var buildCardFn = rosterScript.slice(
      rosterScript.indexOf('function buildCard'),
      rosterScript.indexOf('\n}', rosterScript.indexOf('function buildCard')) + 2
    );
    assert.ok(buildCardFn.indexOf('innerHTML') < 0,
      'roster buildCard 不应使用 innerHTML');

    // showEmpty/showError use textContent
    assert.ok(rosterScript.indexOf('textContent') >= 0 || homeScript.indexOf('textContent') >= 0,
      '应使用 textContent 设置文字内容');
  });

  it('20. studentId 通过 dataset 保存而非 HTML 属性', function () {
    assert.ok(rosterScript.indexOf('dataset.studentId') >= 0,
      'roster: studentId 应通过 card.dataset.studentId 保存');
    assert.ok(rosterScript.indexOf('addEventListener') >= 0,
      'roster: 应使用 addEventListener 绑定点击事件');
  });
});

// ============================================================
//  D. 页面结构
// ============================================================

describe('D. 页面结构', function () {

  it('roster 页面 card 样式存在', function () {
    assert.ok(rosterHtml.indexOf('roster-grid') >= 0,
      'roster 应包含 .roster-grid 样式');
    assert.ok(rosterHtml.indexOf('student-card') >= 0,
      'roster 应包含 .student-card 样式');
    assert.ok(rosterHtml.indexOf('card-avatar') >= 0,
      'roster 应包含 .card-avatar 样式');
  });

  it('首页 summary card 样式存在', function () {
    assert.ok(homeHtml.indexOf('roster-summary-card') >= 0,
      '首页应包含 .roster-summary-card 样式');
  });

  it('首页有安全风险识别卡片', function () {
    assert.ok(homeHtml.indexOf('safety-card') >= 0,
      '首页应包含安全风险识别卡片');
    assert.ok(homeScript.indexOf('renderSafetyCard') >= 0,
      '首页应包含 renderSafetyCard 函数');
  });

  it('保留绑定学生功能', function () {
    assert.ok(homeScript.indexOf('bindStudent') >= 0,
      '应保留 bindStudent 函数');
    assert.ok(homeScript.indexOf('/api/teacher/bind-student') >= 0,
      '应保留绑定学生接口调用');
    assert.ok(homeHtml.indexOf('bindingTokenInput') >= 0,
      '应使用 bindingTokenInput 输入框');
    assert.strictEqual(homeHtml.indexOf('studentCodeInput'), -1,
      '不应保留 legacy studentCodeInput');
  });

  it('保留退出登录功能', function () {
    assert.ok(homeScript.indexOf('handleLogout') >= 0 || rosterScript.indexOf('handleLogout') >= 0,
      '应保留 handleLogout 函数');
    assert.ok(homeHtml.indexOf('btn-logout') >= 0 || rosterHtml.indexOf('btn-logout') >= 0,
      '应保留退出登录按钮');
  });

  it('window.bindStudent 存在', function () {
    assert.ok(homeScript.indexOf('window.bindStudent = bindStudent') >= 0 ||
              allScript.indexOf('bindStudent') >= 0,
      '应保留 bindStudent');
  });

  it('loadRoster/loadRosterSummary 在页面加载时执行', function () {
    assert.ok(homeScript.indexOf('loadRosterSummary()') >= 0,
      '首页加载时应调用 loadRosterSummary()');
    assert.ok(rosterScript.indexOf('loadRoster()') >= 0,
      'roster 页面加载时应调用 loadRoster()');
  });

  it('viewStudent 使用 studentId 参数', function () {
    assert.ok(rosterScript.indexOf('function viewStudent(studentId)') >= 0,
      'roster: viewStudent 应接受 studentId 参数');
  });
});
