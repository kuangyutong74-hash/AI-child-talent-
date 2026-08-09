/**
 * 统一 Session Cookie 构建器。
 *
 * 合同（不可变部分）：
 * - Cookie 名：token
 * - HttpOnly
 * - SameSite=Lax
 * - Path=/
 *
 * 可变部分：
 * - Secure：production 或 COOKIE_SECURE=true 时启用
 * - Max-Age：登录 30 天 / 登出 0
 *
 * 使用方式：
 *   res.setHeader('Set-Cookie', buildSessionCookie(tokenValue, cookieSecure));
 *   // 登出时 tokenValue 为空字符串
 */

'use strict';

var TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * @param {string} token — session token（登出时传 ''）
 * @param {boolean} secure — 是否添加 Secure 属性
 * @returns {string} 完整的 Set-Cookie 值
 */
function buildSessionCookie(token, secure) {
  // token 可能为 ''（登出），但不能为 undefined/null
  var tokenStr = (token === undefined || token === null) ? '' : String(token);

  var isLogout = (tokenStr.length === 0);
  var maxAge = isLogout ? 0 : TOKEN_MAX_AGE_SECONDS;

  var parts = [
    'token=' + tokenStr,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=' + maxAge,
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

module.exports = {
  buildSessionCookie: buildSessionCookie,
  TOKEN_MAX_AGE_SECONDS: TOKEN_MAX_AGE_SECONDS,
};
