/**
 * 基础安全响应头中间件。
 *
 * 本阶段设置（不会破坏现有页面）：
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: camera=(), microphone=(), geolocation=()
 *
 * 暂不设置：
 * - Content-Security-Policy（需先做 report-only 兼容审查）
 * - Strict-Transport-Security（仅生产 HTTPS）
 * - Cross-Origin-Opener-Policy
 * - Cross-Origin-Resource-Policy
 */

'use strict';

/**
 * Express 中间件。对 HTML 和 API 响应统一设置基础安全头。
 */
function securityHeadersMiddleware(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

module.exports = {
  securityHeadersMiddleware: securityHeadersMiddleware,
};
