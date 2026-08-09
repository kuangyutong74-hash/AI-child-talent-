/**
 * test/chat-input-validation.test.js — chat-input-validation 纯函数测试
 *
 * 覆盖: 类型拒绝、空值、emoji 边界、前后空白、不修改输入、自定义 maxLength。
 * 仅使用 node:test + node:assert，无外部依赖。
 */
'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var { validateChatMessage } = require('../lib/core/chat-input-validation');

// Helpers
function ok(v) { return v && v.ok === true; }
function err(v) { return v && v.ok === false; }

// ==========================================================
//  A. 类型校验 — 非 string 返回 INVALID_REQUEST
// ==========================================================

describe('A. type rejection', function () {
  it('1. undefined → INVALID_REQUEST', function () {
    var r = validateChatMessage(undefined);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.error, 'INVALID_REQUEST');
  });

  it('2. null → INVALID_REQUEST', function () {
    var r = validateChatMessage(null);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REQUEST');
  });

  it('3. number → INVALID_REQUEST', function () {
    var r = validateChatMessage(123);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REQUEST');
  });

  it('4. object → INVALID_REQUEST', function () {
    var r = validateChatMessage({ text: 'hello' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REQUEST');
  });

  it('5. array → INVALID_REQUEST', function () {
    var r = validateChatMessage(['hello']);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REQUEST');
  });

  it('6. boolean → INVALID_REQUEST', function () {
    var r = validateChatMessage(true);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'INVALID_REQUEST');
  });
});

// ==========================================================
//  B. 空值校验 — trim后为空返回 MESSAGE_EMPTY
// ==========================================================

describe('B. empty after trim', function () {
  it('7. empty string → MESSAGE_EMPTY', function () {
    var r = validateChatMessage('');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_EMPTY');
  });

  it('8. spaces only → MESSAGE_EMPTY', function () {
    var r = validateChatMessage('    ');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_EMPTY');
  });

  it('9. TAB only → MESSAGE_EMPTY', function () {
    var r = validateChatMessage('\t');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_EMPTY');
  });

  it('10. newline only → MESSAGE_EMPTY', function () {
    var r = validateChatMessage('\n\n\n');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_EMPTY');
  });

  it('11. mixed whitespace only → MESSAGE_EMPTY', function () {
    var r = validateChatMessage(' \t \n ');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_EMPTY');
  });
});

// ==========================================================
//  C. 正常文本 — trim 并返回
// ==========================================================

describe('C. valid messages', function () {
  it('12. plain text passes', function () {
    var r = validateChatMessage('hello');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.message, 'hello');
  });

  it('13. text with leading/trailing whitespace is trimmed', function () {
    var r = validateChatMessage('  hello world  ');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.message, 'hello world');
  });

  it('14. Chinese text passes', function () {
    var r = validateChatMessage('今天天气真好');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.message, '今天天气真好');
  });

  it('15. mixed Chinese + ASCII', function () {
    var r = validateChatMessage('Hello你好World世界');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.message, 'Hello你好World世界');
  });
});

// ==========================================================
//  D. 长度边界 — 默认 maxLength=2000
// ==========================================================

describe('D. length boundaries (default 2000)', function () {
  it('16. 1999 ASCII chars → ok', function () {
    var msg = 'a'.repeat(1999);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.message.length, 1999);
  });

  it('17. 2000 ASCII chars → ok', function () {
    var msg = 'a'.repeat(2000);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.message.length, 2000);
  });

  it('18. 2001 ASCII chars → MESSAGE_TOO_LONG', function () {
    var msg = 'a'.repeat(2001);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });

  it('19. 2000 Chinese chars → ok', function () {
    var msg = '中'.repeat(2000);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.message.length, 2000);
  });

  it('20. 2001 Chinese chars → MESSAGE_TOO_LONG', function () {
    var msg = '中'.repeat(2001);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });
});

// ==========================================================
//  E. Emoji 边界（双 code-unit emoji）
// ==========================================================

describe('E. emoji boundaries', function () {
  // 😀 = '😀' = 2 code units (String.length = 2)
  it('21. 999 emoji (1998 code units) → ok', function () {
    var msg = '😀'.repeat(999);
    assert.strictEqual(msg.length, 1998);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, true);
  });

  it('22. 1000 emoji (2000 code units) → ok', function () {
    var msg = '😀'.repeat(1000);
    assert.strictEqual(msg.length, 2000);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, true);
  });

  it('23. 1001 emoji (2002 code units) → MESSAGE_TOO_LONG', function () {
    var msg = '😀'.repeat(1001);
    assert.strictEqual(msg.length, 2002);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });

  it('24. mixed ascii + emoji + Chinese counts code units correctly', function () {
    // 1000 ascii + 400 Chinese + 300 emoji = 1000 + 400 + 600 = 2000
    var msg = 'a'.repeat(1000) + '中'.repeat(400) + '😀'.repeat(300);
    assert.strictEqual(msg.length, 2000);
    var r = validateChatMessage(msg);
    assert.strictEqual(r.ok, true);
  });
});

// ==========================================================
//  F. 不修改输入
// ==========================================================

describe('F. does not mutate input', function () {
  it('25. original string unchanged after validation', function () {
    var original = '  hello  ';
    var copy = '  hello  ';
    validateChatMessage(original);
    assert.strictEqual(original, copy);
  });
});

// ==========================================================
//  G. 自定义 maxLength
// ==========================================================

describe('G. custom maxLength', function () {
  it('26. custom maxLength=10: 9 chars ok', function () {
    var r = validateChatMessage('123456789', { maxLength: 10 });
    assert.strictEqual(r.ok, true);
  });

  it('27. custom maxLength=10: 10 chars ok', function () {
    var r = validateChatMessage('1234567890', { maxLength: 10 });
    assert.strictEqual(r.ok, true);
  });

  it('28. custom maxLength=10: 11 chars rejected', function () {
    var r = validateChatMessage('12345678901', { maxLength: 10 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });

  it('29. custom maxLength with Chinese chars', function () {
    var r = validateChatMessage('你好世界', { maxLength: 4 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.message.length, 4);
  });

  it('30. custom maxLength with emoji', function () {
    // 3 emoji = 6 code units
    var msg = '😀'.repeat(3);
    assert.strictEqual(msg.length, 6);
    var r = validateChatMessage(msg, { maxLength: 6 });
    assert.strictEqual(r.ok, true);
  });
});

// ==========================================================
//  H. 非法 maxLength — 安全默认回退到 2000
// ==========================================================

describe('H. invalid maxLength falls back to 2000', function () {
  it('31. maxLength=0 → fallback to 2000, 2001 chars rejected', function () {
    var r = validateChatMessage('a'.repeat(2001), { maxLength: 0 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });

  it('32. maxLength=-1 → fallback to 2000', function () {
    var r = validateChatMessage('a'.repeat(2001), { maxLength: -1 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });

  it('33. maxLength="abc" (string) → fallback to 2000', function () {
    var r = validateChatMessage('a'.repeat(2001), { maxLength: 'abc' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });

  it('34. maxLength=null → fallback to 2000', function () {
    var r = validateChatMessage('a'.repeat(2001), { maxLength: null });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });

  it('35. maxLength=1.5 (non-integer) → fallback to 2000', function () {
    var r = validateChatMessage('a'.repeat(2001), { maxLength: 1.5 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });

  it('36. no options → default 2000', function () {
    var r = validateChatMessage('a'.repeat(2001));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'MESSAGE_TOO_LONG');
  });
});
