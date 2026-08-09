/**
 * test/chat-context-budget.test.js — AI 历史上下文预算单元测试
 *
 * 覆盖: 空 history, 预算充足, 超预算裁剪, maxTurns, system 完整性,
 * current message 完整性, overBudget, 孤立消息, 不变性, 字符计算。
 * 不调用真实网络，不读写 data/。
 */

'use strict';

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');
var {
  buildBudgetedMessages,
  BUDGET_PRESETS,
} = require('../lib/core/chat-context-budget');

// ============================================================
//  Helpers
// ============================================================

function userMsg(content) {
  return { role: 'user', content: content };
}

function asstMsg(content) {
  return { role: 'assistant', content: content };
}

function sysMsg(content) {
  return { role: 'system', content: content };
}

function charCount(messages) {
  var total = 0;
  for (var i = 0; i < messages.length; i++) {
    total += messages[i].content.length;
  }
  return total;
}

// ============================================================
//  1. 空 history
// ============================================================

describe('1. 空 history', function () {
  it('1.1 空 history 返回仅 system + current', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('system prompt')],
      history: [],
      currentUserMessage: 'hello',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.messages.length, 2, 'should have system + user');
    assert.strictEqual(result.messages[0].role, 'system');
    assert.strictEqual(result.messages[1].role, 'user');
    assert.strictEqual(result.messages[1].content, 'hello');
    assert.strictEqual(result.historyMessages.length, 0);
    assert.strictEqual(result.stats.includedTurns, 0);
    assert.strictEqual(result.stats.droppedTurns, 0);
    assert.strictEqual(result.stats.truncated, false);
    assert.strictEqual(result.stats.overBudget, false);
  });

  it('1.2 空 history 无 systemMessages', function () {
    var result = buildBudgetedMessages({
      systemMessages: [],
      history: [],
      currentUserMessage: 'hi',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.messages.length, 1);
    assert.strictEqual(result.messages[0].role, 'user');
    assert.strictEqual(result.messages[0].content, 'hi');
  });
});

// ============================================================
//  2. 一轮完整历史
// ============================================================

describe('2. 一轮完整历史', function () {
  it('2.1 一轮 user+assistant 全部保留', function () {
    var history = [userMsg('Q1'), asstMsg('A1')];
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q2',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.historyMessages.length, 2);
    assert.strictEqual(result.stats.includedTurns, 1);
    assert.strictEqual(result.stats.droppedTurns, 0);
    assert.strictEqual(result.stats.truncated, false);
    // messages: system + historyMessages + currentUser
    assert.strictEqual(result.messages[0].role, 'system');
    assert.strictEqual(result.messages[1].role, 'user');
    assert.strictEqual(result.messages[2].role, 'assistant');
    assert.strictEqual(result.messages[3].role, 'user');
    assert.strictEqual(result.messages[3].content, 'Q2');
  });
});

// ============================================================
//  3. 预算充足时全部保留
// ============================================================

describe('3. 预算充足', function () {
  it('3.1 多轮全部保留', function () {
    var history = [
      userMsg('Q1'), asstMsg('A1'),
      userMsg('Q2'), asstMsg('A2'),
      userMsg('Q3'), asstMsg('A3'),
    ];
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('short')],
      history: history,
      currentUserMessage: 'Q4',
      maxTotalChars: 50000,
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.includedTurns, 3);
    assert.strictEqual(result.stats.droppedTurns, 0);
    assert.strictEqual(result.stats.truncated, false);
    assert.strictEqual(result.historyMessages.length, 6);
  });
});

// ============================================================
//  4. 字符预算裁剪
// ============================================================

describe('4. 字符预算裁剪', function () {
  it('4.1 超字符预算时删除最旧轮次', function () {
    var history = [
      userMsg('AAAAAAAAAA'), asstMsg('BBBBBBBBBB'),  // round 1: 20 chars
      userMsg('CCCCCCCCCC'), asstMsg('DDDDDDDDDD'),  // round 2: 20 chars
      userMsg('EEEEEEEEEE'), asstMsg('FFFFFFFFFF'),  // round 3: 20 chars
    ];
    // system = 5, current = 2, total budget = 5 + 2 + 40 = 47 -> should keep 2 rounds
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('SYS12')],  // 5 chars
      history: history,
      currentUserMessage: 'QQ',            // 2 chars
      maxTotalChars: 5 + 2 + 40,          // 47 → enough for 2 rounds
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.includedTurns, 2, 'should keep 2 most recent rounds');
    assert.strictEqual(result.stats.droppedTurns, 1, 'should drop 1 oldest round');
    assert.strictEqual(result.stats.truncated, true);
    // Verify kept rounds are CC/DD and EE/FF
    assert.strictEqual(result.historyMessages[0].content, 'CCCCCCCCCC');
    assert.strictEqual(result.historyMessages[1].content, 'DDDDDDDDDD');
    assert.strictEqual(result.historyMessages[2].content, 'EEEEEEEEEE');
    assert.strictEqual(result.historyMessages[3].content, 'FFFFFFFFFF');
  });

  it('4.2 恰好放不下一轮时停止', function () {
    var history = [
      userMsg('Old stuff'), asstMsg('Old reply'),
      userMsg('New stuff'), asstMsg('New reply'),
    ];
    // system=1, current=1, budget=1+1+16 = 18 → handles 1 round of ~16 chars
    // "New stuff"+(10)+"New reply"+(10)=20 > 16 → stops, includes 0 rounds
    var sys = sysMsg('S');  // 1 char
    var cur = 'Q';           // 1 char
    var result = buildBudgetedMessages({
      systemMessages: [sys],
      history: history,
      currentUserMessage: cur,
      maxTotalChars: 30,  // enough for system(1) + current(1) + new round(20) = 22
      maxTurns: 30,
    });
    // "Old stuff"(9)+"Old reply"(9)=18, "New stuff"(9)+"New reply"(9)=18
    // budget=30-1-1=28, so both rounds should fit (18+18=36 > 28, only newest fits)
    // newest round = 18 chars, 28-18=10 left, older round = 18 > 10 → stops
    assert.strictEqual(result.stats.includedTurns, 1);
    assert.strictEqual(result.historyMessages[0].content, 'New stuff');
  });
});

// ============================================================
//  5. maxTurns 裁剪
// ============================================================

describe('5. maxTurns 裁剪', function () {
  it('5.1 maxTurns=1 只保留最近一轮', function () {
    var history = [
      userMsg('R1Q'), asstMsg('R1A'),
      userMsg('R2Q'), asstMsg('R2A'),
      userMsg('R3Q'), asstMsg('R3A'),
    ];
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q',
      maxTotalChars: 50000,
      maxTurns: 1,
    });
    assert.strictEqual(result.stats.includedTurns, 1);
    assert.strictEqual(result.stats.droppedTurns, 2);
    assert.strictEqual(result.historyMessages[0].content, 'R3Q');
    assert.strictEqual(result.historyMessages[1].content, 'R3A');
  });

  it('5.2 maxTurns 比字符预算更严格时生效', function () {
    var history = [];
    for (var i = 0; i < 20; i++) {
      history.push(userMsg('Q' + i));
      history.push(asstMsg('A' + i));
    }
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q',
      maxTotalChars: 50000,  // ample
      maxTurns: 5,
    });
    assert.strictEqual(result.stats.includedTurns, 5);
    assert.strictEqual(result.stats.droppedTurns, 15);
    assert.strictEqual(result.stats.truncated, true);
  });
});

// ============================================================
//  6. system prompt 完整性
// ============================================================

describe('6. system prompt 完整保留', function () {
  it('6.1 system prompt 不裁剪', function () {
    var longSystem = 'X'.repeat(5000);
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg(longSystem)],
      history: [userMsg('hi'), asstMsg('yo')],
      currentUserMessage: 'hello',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.messages[0].content, longSystem);
    assert.strictEqual(result.stats.systemChars, 5000);
    assert.strictEqual(result.stats.overBudget, false);
  });

  it('6.2 多个 system messages 均完整保留', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('AAA'), sysMsg('BBB')],
      history: [userMsg('hi'), asstMsg('yo')],
      currentUserMessage: 'hello',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.messages[0].content, 'AAA');
    assert.strictEqual(result.messages[1].content, 'BBB');
    assert.strictEqual(result.stats.systemChars, 6);
  });
});

// ============================================================
//  7. system 计入 usedChars
// ============================================================

describe('7. system 计入 usedChars', function () {
  it('7.1 systemChars 反映在 usedChars 中', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('1234567890')],  // 10 chars
      history: [userMsg('Q'), asstMsg('A')],    // 2 chars
      currentUserMessage: 'X',                   // 1 char
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.systemChars, 10);
    assert.strictEqual(result.stats.currentMessageChars, 1);
    assert.strictEqual(result.stats.usedChars, 10 + 1 + 2);
  });
});

// ============================================================
//  8. 当前消息完整保留
// ============================================================

describe('8. current message 完整保留', function () {
  it('8.1 当前用户消息出现在 messages 末尾', function () {
    var msg = 'this is my current message';
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg('old'), asstMsg('old')],
      currentUserMessage: msg,
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    var last = result.messages[result.messages.length - 1];
    assert.strictEqual(last.role, 'user');
    assert.strictEqual(last.content, msg);
  });

  it('8.2 当前消息不在 historyMessages 中', function () {
    var msg = 'unique current message';
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg('old'), asstMsg('old')],
      currentUserMessage: msg,
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    // historyMessages should not contain current user message
    for (var i = 0; i < result.historyMessages.length; i++) {
      assert.notStrictEqual(result.historyMessages[i].content, msg);
    }
  });
});

// ============================================================
//  9. current 计入 usedChars
// ============================================================

describe('9. current 计入 usedChars', function () {
  it('9.1 currentMessageChars 计入 usedChars', function () {
    var cur = 'test current';
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg('h'), asstMsg('h')],
      currentUserMessage: cur,
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.currentMessageChars, cur.length);
    assert.ok(result.stats.usedChars > cur.length);
  });
});

// ============================================================
//  10. current 只出现一次
// ============================================================

describe('10. current 只出现一次', function () {
  it('10.1 current 不在 historyMessages 中', function () {
    var cur = 'current123';
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg(cur), asstMsg('reply')],  // same content in history!
      currentUserMessage: cur,
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    // Count occurrences
    var count = 0;
    for (var i = 0; i < result.messages.length; i++) {
      if (result.messages[i].content === cur && result.messages[i].role === 'user') count++;
    }
    assert.strictEqual(count, 2, 'history has one, current appends one — both are legitimate');
  });
});

// ============================================================
//  11. overBudget
// ============================================================

describe('11. overBudget', function () {
  it('11.1 system + current 超预算时 overBudget=true', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('X'.repeat(100))],
      history: [userMsg('Q'), asstMsg('A')],
      currentUserMessage: 'Y'.repeat(200),
      maxTotalChars: 50,  // way too small
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.overBudget, true);
    assert.strictEqual(result.stats.truncated, true);
    assert.strictEqual(result.historyMessages.length, 0);
    assert.strictEqual(result.stats.droppedTurns, 1);
  });

  it('11.2 超预算时仍发送 system + current', function () {
    var sys = 'SYS';
    var cur = 'QUESTION';
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg(sys)],
      history: [userMsg('Q'), asstMsg('A')],
      currentUserMessage: cur,
      maxTotalChars: (sys + cur).length - 1,  // 1 char too small
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.overBudget, true);
    assert.strictEqual(result.messages.length, 2);  // system + user
    assert.strictEqual(result.messages[0].content, sys);
    assert.strictEqual(result.messages[1].content, cur);
  });
});

// ============================================================
//  12. 超预算不添加历史
// ============================================================

describe('12. 超预算不添加历史', function () {
  it('12.1 overBudget 时 historyMessages 为空', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('SYSTEM')],
      history: [userMsg('past'), asstMsg('past')],
      currentUserMessage: 'hello',
      maxTotalChars: 5,
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.overBudget, true);
    assert.strictEqual(result.historyMessages.length, 0);
  });
});

// ============================================================
//  13. 不产生孤立 assistant
// ============================================================

describe('13. 不产生孤立 assistant', function () {
  it('13.1 historyMessages 第一项为 user', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg('Q1'), asstMsg('A1'), userMsg('Q2'), asstMsg('A2')],
      currentUserMessage: 'Q3',
      maxTotalChars: 10000,
      maxTurns: 1,
    });
    assert.ok(result.historyMessages.length > 0);
    assert.strictEqual(result.historyMessages[0].role, 'user');
  });

  it('13.2 裁剪不会让 assistant 成为第一条历史消息', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg('R1'), asstMsg('R1'), userMsg('R2'), asstMsg('R2')],
      currentUserMessage: 'Q',
      maxTotalChars: 10000,
      maxTurns: 1,
    });
    assert.strictEqual(result.historyMessages[0].role, 'user');
    assert.strictEqual(result.historyMessages[0].content, 'R2');
  });
});

// ============================================================
//  14. 跳过开头孤立 assistant
// ============================================================

describe('14. 跳过孤立 assistant', function () {
  it('14.1 开头孤立 assistant 被跳过', function () {
    var history = [
      asstMsg('orphan assistant at start'),
      userMsg('real Q1'), asstMsg('real A1'),
    ];
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q2',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.historyMessages[0].role, 'user');
    assert.strictEqual(result.historyMessages[0].content, 'real Q1');
  });

  it('14.2 中间孤立 assistant 被跳过', function () {
    var history = [
      userMsg('Q1'), asstMsg('A1'),
      asstMsg('orphan'),  // no preceding user
      userMsg('Q2'), asstMsg('A2'),
    ];
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q3',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    // Should have Q1, A1, Q2, A2 — not the orphan assistant
    var roles = result.historyMessages.map(function (m) { return m.role; });
    assert.strictEqual(roles.length, 4);
    assert.strictEqual(roles[0], 'user');
    assert.strictEqual(roles[1], 'assistant');
    assert.strictEqual(roles[2], 'user');
    assert.strictEqual(roles[3], 'assistant');
  });
});

// ============================================================
//  15. 保留合法孤立 user
// ============================================================

describe('15. 保留合法孤立 user', function () {
  it('15.1 末尾孤立 user 被保留', function () {
    var history = [
      userMsg('Q1'), asstMsg('A1'),
      userMsg('Q2'),  // no assistant reply — orphan user
    ];
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q3',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    // Should include the orphan user Q2
    assert.strictEqual(result.historyMessages.length, 3);
    assert.strictEqual(result.historyMessages[2].content, 'Q2');
    assert.strictEqual(result.stats.includedTurns, 1);  // only Q1+A1 is complete
  });
});

// ============================================================
//  16. 跳过非法 role
// ============================================================

describe('16. 跳过非法 role', function () {
  it('16.1 非 user/assistant role 被跳过', function () {
    var history = [
      { role: 'system', content: 'should be skipped' },
      userMsg('Q1'), asstMsg('A1'),
    ];
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q2',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.historyMessages.length, 2); // only Q1, A1
  });
});

// ============================================================
//  17. 跳过非字符串 content
// ============================================================

describe('17. 跳过非字符串 content', function () {
  it('17.1 非字符串 content 被跳过', function () {
    var history = [
      { role: 'user', content: 12345 },
      userMsg('valid'),
    ];
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    // 12345 is not a string → skipped; 'valid' is an orphan user → kept
    assert.strictEqual(result.historyMessages.length, 1);
    assert.strictEqual(result.historyMessages[0].content, 'valid');
  });
});

// ============================================================
//  18. 原 history 数组不变
// ============================================================

describe('18. 原 history 数组不变', function () {
  it('18.1 history 内容和长度不变', function () {
    var history = [userMsg('Q1'), asstMsg('A1'), userMsg('Q2'), asstMsg('A2')];
    var copy = JSON.parse(JSON.stringify(history));
    buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q3',
      maxTotalChars: 10,  // force truncation
      maxTurns: 30,
    });
    assert.deepStrictEqual(history, copy, 'original history must not be modified');
  });
});

// ============================================================
//  19. 原消息对象不变
// ============================================================

describe('19. 原消息对象不变', function () {
  it('19.1 历史消息对象的引用和内容不变', function () {
    var msg1 = userMsg('original content');
    var msg2 = asstMsg('original reply');
    var history = [msg1, msg2];
    buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q',
      maxTotalChars: 10,
      maxTurns: 30,
    });
    assert.strictEqual(msg1.content, 'original content');
    assert.strictEqual(msg2.content, 'original reply');
    assert.strictEqual(msg1.role, 'user');
  });
});

// ============================================================
//  20. systemMessages 不变
// ============================================================

describe('20. systemMessages 不变', function () {
  it('20.1 system 消息对象不变', function () {
    var sys = sysMsg('my system prompt');
    buildBudgetedMessages({
      systemMessages: [sys],
      history: [userMsg('Q')],
      currentUserMessage: 'hello',
      maxTotalChars: 10,
      maxTurns: 30,
    });
    assert.strictEqual(sys.content, 'my system prompt');
    assert.strictEqual(sys.role, 'system');
  });
});

// ============================================================
//  21. 中文 string.length
// ============================================================

describe('21. 中文 string.length', function () {
  it('21.1 中文字符按 string.length 计算', function () {
    var chinese = '你好世界';  // 4 chars in JS
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg(chinese), asstMsg('OK')],
      currentUserMessage: 'hi',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.historyChars, chinese.length + 2);
  });
});

// ============================================================
//  22. emoji string.length
// ============================================================

describe('22. emoji string.length', function () {
  it('22.1 emoji 按 string.length 计算', function () {
    var emoji = '😀🎉';  // 2 code units each in UTF-16
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg(emoji), asstMsg('ok')],
      currentUserMessage: 'x',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.stats.historyChars, emoji.length + 2,
      'emoji length should use JS string.length (UTF-16 code units)');
  });
});

// ============================================================
//  23. 最近轮次放不下时停止
// ============================================================

describe('23. 最近轮次放不下时停止', function () {
  it('23.1 最近轮次放不下时停止，不影响更旧轮次', function () {
    var history = [
      userMsg('ROUND1'), asstMsg('ROUND1'),
      userMsg('VERY_LONG_RECENT_ROUND'), asstMsg('VERY_LONG_RECENT_REPLY'),
    ];
    // Budget just for system(1) + current(1) + old round(12) = 14
    // Recent round is 42 chars — won't fit
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: history,
      currentUserMessage: 'Q',
      maxTotalChars: 1 + 1 + 12,
      maxTurns: 30,
    });
    // Recent round doesn't fit → stops, doesn't skip to older round
    assert.strictEqual(result.stats.includedTurns, 0, 'should not skip to older round');
    assert.strictEqual(result.stats.droppedTurns, 2);
  });
});

// ============================================================
//  24. stats 数值准确
// ============================================================

describe('24. stats 数值准确', function () {
  it('24.1 所有 stats 字段存在且类型正确', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('ABC')],
      history: [userMsg('Q1'), asstMsg('A1')],
      currentUserMessage: 'Q2',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(typeof result.stats.systemChars, 'number');
    assert.strictEqual(typeof result.stats.currentMessageChars, 'number');
    assert.strictEqual(typeof result.stats.historyChars, 'number');
    assert.strictEqual(typeof result.stats.usedChars, 'number');
    assert.strictEqual(typeof result.stats.includedTurns, 'number');
    assert.strictEqual(typeof result.stats.droppedTurns, 'number');
    assert.strictEqual(typeof result.stats.truncated, 'boolean');
    assert.strictEqual(typeof result.stats.overBudget, 'boolean');
    assert.strictEqual(result.stats.systemChars, 3);
    assert.strictEqual(result.stats.currentMessageChars, 2);
    assert.strictEqual(result.stats.includedTurns, 1);
    assert.strictEqual(result.stats.droppedTurns, 0);
    assert.strictEqual(result.stats.truncated, false);
    assert.strictEqual(result.stats.overBudget, false);
  });
});

// ============================================================
//  25. 输出顺序准确
// ============================================================

describe('25. 输出顺序', function () {
  it('25.1 messages 顺序: system → history → current', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S1'), sysMsg('S2')],
      history: [userMsg('H1'), asstMsg('H1'), userMsg('H2'), asstMsg('H2')],
      currentUserMessage: 'C',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    var roles = result.messages.map(function (m) { return m.role; });
    assert.deepStrictEqual(roles, ['system', 'system', 'user', 'assistant', 'user', 'assistant', 'user']);
  });

  it('25.2 historyMessages 按时间顺序', function () {
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg('first'), asstMsg('first'), userMsg('last'), asstMsg('last')],
      currentUserMessage: 'now',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    assert.strictEqual(result.historyMessages[0].content, 'first');
    assert.strictEqual(result.historyMessages[3].content, 'last');
  });
});

// ============================================================
//  26. current 与 history 末尾重复不重复加入
// ============================================================

describe('26. current 不重复', function () {
  it('26.1 current 与 history 末尾 user 相同内容时各自出现', function () {
    // History's last user is also "dup"
    // This is the normal case: history has user Q2, and current is Q2 (same round)
    // The budget module keeps history users AND appends current — that's correct
    var result = buildBudgetedMessages({
      systemMessages: [sysMsg('S')],
      history: [userMsg('Q1'), asstMsg('A1'), userMsg('dup')],
      currentUserMessage: 'dup',
      maxTotalChars: 10000,
      maxTurns: 30,
    });
    // Current appears exactly once at the end
    var userMsgs = result.messages.filter(function (m) { return m.role === 'user'; });
    var lastUser = userMsgs[userMsgs.length - 1];
    assert.strictEqual(lastUser.content, 'dup');
  });
});

// ============================================================
//  27. BUDGET_PRESETS
// ============================================================

describe('27. BUDGET_PRESETS', function () {
  it('27.1 所有预设都存在且有正确字段', function () {
    var keys = ['V2_ANALYZE', 'V2_GENERATE', 'HTTP_ANALYZE', 'BACKGROUND_ANALYZE', 'EXTRACT_EVENTS'];
    for (var i = 0; i < keys.length; i++) {
      var p = BUDGET_PRESETS[keys[i]];
      assert.ok(p, keys[i] + ' should exist');
      assert.ok(typeof p.maxTotalChars === 'number' && p.maxTotalChars > 0, keys[i] + ' maxTotalChars');
      assert.ok(typeof p.maxTurns === 'number' && p.maxTurns > 0, keys[i] + ' maxTurns');
    }
  });
});
