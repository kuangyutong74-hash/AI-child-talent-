/**
 * test/teacher-binding-frontend-contract.test.js — 前端静态合同测试
 *
 * 验证前端 HTML 文件满足 Phase 7 安全合同：
 *  - 无 studentCode 残留
 *  - 正确的 API 调用
 *  - token 不持久化
 *  - textContent 安全使用
 *  - 按钮防重复
 *  - 不硬编码 token 有效期
 *
 * 使用: node --test test/teacher-binding-frontend-contract.test.js
 * 仅使用 node:test、node:assert 和 fs，不引入新依赖。
 */
'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');

var PUBLIC_DIR = path.join(__dirname, '..', 'public');

function readHtml(filename) {
  return fs.readFileSync(path.join(PUBLIC_DIR, filename), 'utf-8');
}

var profileHtml = readHtml('profile.html');
var teacherHomeHtml = readHtml('teacher-home.html');
var teacherStudentHtml = readHtml('teacher-student.html');

// ==========================================================
//  A. profile.html — 移除旧 studentCode 内容
// ==========================================================

describe('A. profile.html — no legacy studentCode', function () {
  it('1. does not contain "studentCode"', function () {
    assert.strictEqual(profileHtml.indexOf('studentCode'), -1,
      'profile.html must not contain studentCode');
  });

  it('2. does not contain "6位专属码"', function () {
    assert.strictEqual(profileHtml.indexOf('6位专属码'), -1,
      'profile.html must not reference 6-digit code');
  });

  it('3. does not contain "交给老师" with studentCode context', function () {
    assert.strictEqual(profileHtml.indexOf('专属码'), -1,
      'profile.html must not contain 专属码');
  });

  it('4. does not contain old "把这个6位数字告诉你的老师" hint', function () {
    assert.strictEqual(profileHtml.indexOf('把这个6位数字告诉你的老师'), -1,
      'profile.html must not contain old studentCode hint');
  });
});

// ==========================================================
//  B. teacher-home.html — 移除 studentCode
// ==========================================================

describe('B. teacher-home.html — no legacy studentCode', function () {
  it('5. does not contain studentCodeInput element', function () {
    assert.strictEqual(teacherHomeHtml.indexOf('studentCodeInput'), -1,
      'teacher-home.html must not contain studentCodeInput');
  });

  it('6. does not call JSON.stringify({ studentCode', function () {
    // Check for the pattern: JSON.stringify({ studentCode
    assert.strictEqual(teacherHomeHtml.indexOf('JSON.stringify({ studentCode'), -1,
      'teacher-home.html must not send studentCode');
  });

  it('7. does not contain "专属码"', function () {
    assert.strictEqual(teacherHomeHtml.indexOf('专属码'), -1,
      'teacher-home.html must not contain 专属码');
  });

  it('8. does not contain "学生码"', function () {
    assert.strictEqual(teacherHomeHtml.indexOf('学生码'), -1,
      'teacher-home.html must not contain 学生码');
  });
});

// ==========================================================
//  C. teacher-student.html — 移除 studentCode
// ==========================================================

describe('C. teacher-student.html — no legacy studentCode', function () {
  it('9. does not contain "专属码"', function () {
    assert.strictEqual(teacherStudentHtml.indexOf('专属码'), -1,
      'teacher-student.html must not contain 专属码');
  });

  it('10. does not contain "studentCode"', function () {
    assert.strictEqual(teacherStudentHtml.indexOf('studentCode'), -1,
      'teacher-student.html must not reference studentCode');
  });
});

// ==========================================================
//  D. profile.html — API endpoint references
// ==========================================================

describe('D. profile.html — uses real API endpoints', function () {
  it('11. calls POST /api/student/binding-invitations', function () {
    assert.ok(
      profileHtml.indexOf('/api/student/binding-invitations') >= 0,
      'profile.html must call student binding-invitations API'
    );
  });

  it('12. calls GET /api/student/binding-invitations (list)', function () {
    // Must have at least two references: POST + GET
    var matches = profileHtml.match(/\/api\/student\/binding-invitations/g);
    assert.ok(matches && matches.length >= 2,
      'profile.html must reference binding-invitations at least twice (POST + GET)');
  });

  it('13. calls DELETE /api/student/binding-invitations/', function () {
    assert.ok(
      profileHtml.indexOf('/api/student/binding-invitations/') >= 0,
      'profile.html must call DELETE /api/student/binding-invitations/:id'
    );
  });

  it('14. calls GET /api/student/bound-teachers', function () {
    assert.ok(
      profileHtml.indexOf('/api/student/bound-teachers') >= 0,
      'profile.html must call bound-teachers API'
    );
  });

  it('15. calls DELETE /api/student/bound-teachers/', function () {
    assert.ok(
      profileHtml.indexOf('/api/student/bound-teachers/') >= 0,
      'profile.html must call DELETE /api/student/bound-teachers/:id (unbind)'
    );
  });
});

// ==========================================================
//  E. teacher-home.html — API endpoint references
// ==========================================================

describe('E. teacher-home.html — uses token exchange', function () {
  it('16. calls /api/teacher/bind-student', function () {
    assert.ok(
      teacherHomeHtml.indexOf('/api/teacher/bind-student') >= 0,
      'teacher-home.html must call bind-student API'
    );
  });

  it('17. sends bindingToken in request body', function () {
    assert.ok(
      teacherHomeHtml.indexOf('bindingToken') >= 0,
      'teacher-home.html must use bindingToken field'
    );
  });

  it('18. no reference to "token=" cookie manipulation', function () {
    assert.strictEqual(teacherHomeHtml.indexOf('token='), -1,
      'teacher-home.html must not manipulate cookie token');
  });
});

// ==========================================================
//  F. Token persistence — no writes to storage
// ==========================================================

describe('F. no token persistence to storage', function () {
  var allFiles = [profileHtml, teacherHomeHtml];

  allFiles.forEach(function (html, idx) {
    var names = ['profile.html', 'teacher-home.html'];
    var name = names[idx];

    it('F.' + (idx * 5 + 19) + '. ' + name + ' does not write to localStorage', function () {
      assert.strictEqual(html.indexOf('localStorage.setItem'), -1,
        name + ' must not write token to localStorage');
    });

    it('F.' + (idx * 5 + 20) + '. ' + name + ' does not write to sessionStorage', function () {
      assert.strictEqual(html.indexOf('sessionStorage.setItem'), -1,
        name + ' must not write token to sessionStorage');
    });

    it('F.' + (idx * 5 + 21) + '. ' + name + ' does not write to document.cookie', function () {
      assert.strictEqual(html.indexOf('document.cookie ='), -1,
        name + ' must not write to document.cookie');
    });

    it('F.' + (idx * 5 + 22) + '. ' + name + ' does not put token in URL params', function () {
      // URLSearchParams with token
      assert.strictEqual(html.indexOf('URLSearchParams') >= 0 && html.indexOf('token') >= 0, false,
        name + ' must not construct URL with token param');
    });

    it('F.' + (idx * 5 + 23) + '. ' + name + ' does not use console.log with token-like strings', function () {
      // Must not log raw token — we check for console.log that references token
      var lines = html.split('\n');
      var hasLog = false;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('console.log') >= 0 && lines[i].indexOf('token') >= 0) {
          hasLog = true;
          break;
        }
      }
      assert.strictEqual(hasLog, false,
        name + ' must not console.log tokens');
    });
  });
});

// ==========================================================
//  G. Button anti-duplicate-click (disabled during request)
// ==========================================================

describe('G. anti-duplicate-click mechanisms', function () {
  it('28. profile.html create button has disabled logic', function () {
    assert.ok(
      profileHtml.indexOf('.disabled') >= 0 || profileHtml.indexOf('disabled = true') >= 0 || profileHtml.indexOf('disabled=true') >= 0,
      'profile.html must disable buttons during request'
    );
  });

  it('29. teacher-home.html bind button has disabled logic', function () {
    assert.ok(
      teacherHomeHtml.indexOf('.disabled') >= 0 || teacherHomeHtml.indexOf('disabled = true') >= 0 || teacherHomeHtml.indexOf('disabled=true') >= 0,
      'teacher-home.html must disable buttons during request'
    );
  });

  it('30. teacher-home.html has bindSubmitting guard', function () {
    assert.ok(
      teacherHomeHtml.indexOf('bindSubmitting') >= 0,
      'teacher-home.html must use bindSubmitting flag to prevent double-submit'
    );
  });
});

// ==========================================================
//  H. Safe DOM — textContent over innerHTML
// ==========================================================

describe('H. safe DOM practices — textContent usage', function () {
  it('31. profile.html uses textContent (not innerHTML) for dynamic data', function () {
    // Must have textContent assignments (for username, status etc.)
    var textContentCount = (profileHtml.match(/\.textContent\s*=/g) || []).length;
    assert.ok(textContentCount >= 5,
      'profile.html must use textContent for dynamic content (found ' + textContentCount + ')');
  });

  it('32. profile.html does not use innerHTML with + concatenation for user data', function () {
    // Check for dangerous patterns like innerHTML = ... + variable
    var innerHtmlDanger = profileHtml.match(/\.innerHTML\s*=\s*.*\+/g);
    // Some innerHTML uses are OK (static templates), but must not concatenate with data
    if (innerHtmlDanger && innerHtmlDanger.length > 0) {
      for (var i = 0; i < innerHtmlDanger.length; i++) {
        var line = innerHtmlDanger[i];
        // The hint line uses innerHTML with + for strong tags — it's static trusted HTML
        // Ensure no variable concatenation with user data
        assert.ok(
          line.indexOf('token-hint') >= 0 || line.indexOf('strong') >= 0 || line.indexOf('token-label') >= 0,
          'profile.html innerHTML usage must be static trusted HTML only, found: ' + line
        );
      }
    }
  });

  it('33. teacher-home.html uses textContent for dynamic data', function () {
    var textContentCount = (teacherHomeHtml.match(/\.textContent\s*=/g) || []).length;
    assert.ok(textContentCount >= 3,
      'teacher-home.html must use textContent for dynamic content (found ' + textContentCount + ')');
  });
});

// ==========================================================
//  I. No hardcoded "15分钟" token expiration
// ==========================================================

describe('I. no hardcoded token expiration times', function () {
  it('34. profile.html does not hardcode 15-minute expiration', function () {
    assert.strictEqual(profileHtml.indexOf('15分钟'), -1,
      'profile.html must not hardcode "15分钟" for token expiration');
  });

  it('35. profile.html does not say "请在15分钟内使用"', function () {
    assert.strictEqual(profileHtml.indexOf('请在15分钟内'), -1,
      'profile.html must not say "请在15分钟内"');
  });

  it('36. teacher-home.html does not hardcode token expiration time', function () {
    assert.strictEqual(teacherHomeHtml.indexOf('15分钟'), -1,
      'teacher-home.html must not hardcode "15分钟"');
  });
});

// ==========================================================
//  J. Correct invite prompting text in profile.html
// ==========================================================

describe('J. correct invite prompt text', function () {
  it('37. profile.html says "请尽快交给你要邀请的老师"', function () {
    assert.ok(
      profileHtml.indexOf('请尽快交给你要邀请的老师') >= 0,
      'profile.html must use correct invite prompt: "请尽快交给你要邀请的老师"'
    );
  });

  it('38. profile.html says "邀请码只会显示这一次"', function () {
    assert.ok(
      profileHtml.indexOf('邀请码只会显示这一次') >= 0,
      'profile.html must warn token is shown only once'
    );
  });

  it('39. profile.html references expiresAt from server response', function () {
    assert.ok(
      profileHtml.indexOf('expiresAt') >= 0,
      'profile.html must use expiresAt from GET list response'
    );
  });

  it('40. profile.html has fallback when expiresAt unavailable', function () {
    assert.ok(
      profileHtml.indexOf('可在下方邀请列表查看有效期') >= 0,
      'profile.html must show list-ref hint when expiresAt not yet available'
    );
  });
});

// ==========================================================
//  K. Teacher error messages are safe and fixed
// ==========================================================

describe('K. teacher error messages — fixed safe prompts', function () {
  it('41. teacher-home uses unified invalid/expired message', function () {
    assert.ok(
      teacherHomeHtml.indexOf('该邀请码无效或已失效，请向学生获取新的邀请码') >= 0,
      'teacher-home must use unified invalid token message'
    );
  });

  it('42. teacher-home does not expose internal error codes to user', function () {
    // INTERNAL_ERROR should map to a safe prompt
    assert.ok(
      teacherHomeHtml.indexOf('服务器繁忙，请稍后重试') >= 0,
      'teacher-home must show safe internal error prompt'
    );
  });

  it('43. teacher-home does not expose err.message', function () {
    assert.strictEqual(teacherHomeHtml.indexOf('err.message'), -1,
      'teacher-home must not expose err.message');
    assert.strictEqual(teacherHomeHtml.indexOf('err.stack'), -1,
      'teacher-home must not expose err.stack');
  });

  it('44. teacher-home explicitly handles HTTP 403 status', function () {
    // Must check resp.status === 403 (not relying on Chinese error text)
    assert.ok(
      teacherHomeHtml.indexOf('resp.status === 403') >= 0,
      'teacher-home must check resp.status === 403'
    );
  });

  it('45. 403 message contains "当前账号不是教师"', function () {
    assert.ok(
      teacherHomeHtml.indexOf('当前账号不是教师，请使用教师账号登录') >= 0,
      'teacher-home must show safe 403 prompt'
    );
  });

  it('46. 403 check occurs BEFORE else fallback to prevent wrong message', function () {
    // The 403 check (resp.status === 403) must appear before the catch-all else
    var idx403 = teacherHomeHtml.indexOf("resp.status === 403");
    var idxElse = teacherHomeHtml.indexOf("服务器繁忙，请稍后重试");
    assert.ok(idx403 >= 0 && idxElse >= 0 && idx403 < idxElse,
      '403 status check must come before else fallback ("服务器繁忙")');
  });

  it('47. teacher-home handles 401 with redirect to login', function () {
    assert.ok(
      teacherHomeHtml.indexOf("resp.status === 401") >= 0,
      'teacher-home must check resp.status === 401'
    );
    assert.ok(
      teacherHomeHtml.indexOf("window.location.href = '/login.html?role=teacher'") >= 0,
      'teacher-home must redirect to teacher login on 401'
    );
  });
});

// ==========================================================
//  L. Profile unbind confirmation exists
// ==========================================================

describe('L. profile.html unbind confirmation', function () {
  it('44. unbind has confirmation dialog', function () {
    assert.ok(
      profileHtml.indexOf('confirm(') >= 0,
      'profile.html must have confirmation before unbind'
    );
  });

  it('45. confirmation text mentions loss of access', function () {
    assert.ok(
      profileHtml.indexOf('这位老师将无法继续查看') >= 0 ||
      profileHtml.indexOf('确定解除绑定吗') >= 0,
      'profile.html unbind confirmation must mention access loss'
    );
  });

  it('46. teacherId is encodeURIComponent encoded', function () {
    assert.ok(
      profileHtml.indexOf('encodeURIComponent') >= 0,
      'profile.html must encode URI components for safety'
    );
  });
});

// ==========================================================
//  M. No studentId/teacherId forging in client requests
// ==========================================================

describe('M. no client-side identity forging', function () {
  it('47. profile.html does not send studentId in POST body', function () {
    // POST creates invitation with {} body or empty body, studentId comes from cookie
    assert.ok(profileHtml.indexOf("body: '{}'") >= 0 || profileHtml.indexOf("body:'{}'") >= 0,
      'profile.html must not send studentId in POST body');
  });

  it('48. teacher-home.html does not send teacherId in POST body', function () {
    // Must only send { bindingToken }
    // Check there is no teacherId in the bind-student request body
    var bindSection = teacherHomeHtml.substring(
      teacherHomeHtml.indexOf('bind-student'),
      teacherHomeHtml.indexOf('bind-student') + 500
    );
    assert.strictEqual(bindSection.indexOf('teacherId'), -1,
      'teacher-home must not send teacherId in bind request');
  });

  it('49. teacher-home.html does not send studentId in bind request', function () {
    var bindSection = teacherHomeHtml.substring(
      teacherHomeHtml.indexOf('bind-student'),
      teacherHomeHtml.indexOf('bind-student') + 500
    );
    assert.strictEqual(bindSection.indexOf('studentId'), -1,
      'teacher-home must not send studentId in bind request');
  });
});

// ==========================================================
//  N. Revoke button respects backend state contract
// ==========================================================

describe('N. revoke respects backend contract', function () {
  it('50. profile only shows revoke for pending or claimed status', function () {
    assert.ok(
      profileHtml.indexOf("inv.status === 'pending' || inv.status === 'claimed'") >= 0,
      'profile.html must only show revoke for pending or claimed states'
    );
  });

  it('51. profile handles revoke INVALID_REQUEST by refreshing list', function () {
    assert.ok(
      profileHtml.indexOf('loadInvitations()') >= 0,
      'profile.html must refresh invitations list on revoke errors'
    );
  });
});
