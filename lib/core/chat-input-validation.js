/**
 * lib/chat-input-validation.js — 聊天消息校验纯函数
 *
 * 无依赖、不访问 data/、不调用 AI、不 throw。
 * 阈值可注入测试。
 *
 * 导出：
 *   validateChatMessage(value, options) → { ok, message? } | { ok, status, error }
 */

'use strict';

function isString(val) { return typeof val === 'string'; }
function isFinitePositiveInteger(val) { return typeof val === 'number' && Number.isFinite(val) && val >= 1 && Math.floor(val) === val; }

/**
 * 校验单条学生聊天消息。
 *
 * @param {*} value - req.body.message 原始值
 * @param {object} [options]
 * @param {number} [options.maxLength=2000] - 最大字符数 (String.length)
 * @returns {{ ok: true, message: string }} | {{ ok: false, status: number, error: string }}
 */
function validateChatMessage(value, options) {
  var opts = options || {};
  var maxLength = isFinitePositiveInteger(opts.maxLength) ? opts.maxLength : 2000;

  // 1. 类型校验
  if (!isString(value)) {
    return { ok: false, status: 400, error: 'INVALID_REQUEST' };
  }

  // 2. trim 空值校验
  var trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, status: 400, error: 'MESSAGE_EMPTY' };
  }

  // 3. 长度上限（基于 String.length，即 UTF-16 code unit 计数）
  if (trimmed.length > maxLength) {
    return { ok: false, status: 400, error: 'MESSAGE_TOO_LONG' };
  }

  return { ok: true, message: trimmed };
}

module.exports = { validateChatMessage: validateChatMessage };
