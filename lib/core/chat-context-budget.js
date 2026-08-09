/**
 * lib/chat-context-budget.js — AI 历史上下文预算
 *
 * 纯函数模块。不修改输入，不发起网络请求，不读写文件。
 *
 * 导出：
 *   buildBudgetedMessages(options) → { messages, historyMessages, stats }
 *   BUDGET_PRESETS                   — 各路径预设常量
 *
 * 规则：
 *   1. system prompt 完整保留，绝不裁剪
 *   2. 当前用户消息完整保留，只出现一次
 *   3. system + current 均计入 usedChars
 *   4. 剩余预算只用于历史消息
 *   5. 使用 JavaScript string.length
 *   6. 不引入 tokenizer
 *   7. 不修改输入
 *   8. 从最近完整轮次向前选择
 *   9. 完整轮次整体加入或整体丢弃
 *   10. 孤立 assistant 跳过
 *   11. 孤立 user 可作为不完整轮次保留
 *   12. 遇到放不下的轮次时停止（不跳过）
 *   13. 输出恢复原始时间顺序
 *   14. system + current 超预算时仍发送，overBudget=true
 */

'use strict';

// ============================================================
//  预算预设常量
// ============================================================

var BUDGET_PRESETS = Object.freeze({
  V2_ANALYZE:         { maxTotalChars: 14000, maxTurns: 18 },
  V2_GENERATE:        { maxTotalChars: 14000, maxTurns: 18 },
  HTTP_ANALYZE:       { maxTotalChars: 24000, maxTurns: 30 },
  BACKGROUND_ANALYZE: { maxTotalChars: 24000, maxTurns: 40 },
  EXTRACT_EVENTS:     { maxTotalChars: 14000, maxTurns: 20 },
});

// ============================================================
//  公共函数
// ============================================================

/**
 * @param {Object} options
 * @param {Array<{role:string,content:string}>} [options.systemMessages=[]]
 *        — 系统消息（system prompt 等）。完整保留，不裁剪。
 * @param {Array<{role:string,content:string}>} [options.history=[]]
 *        — 不含当前用户消息的历史消息。不修改。
 * @param {string} options.currentUserMessage
 *        — 本轮用户消息。完整保留。
 * @param {number} options.maxTotalChars
 *        — 总字符预算上限。
 * @param {number} options.maxTurns
 *        — 最大保留轮数。
 * @returns {{
 *   messages: Array<{role:string,content:string}>,
 *   historyMessages: Array<{role:string,content:string}>,
 *   stats: {
 *     systemChars: number,
 *     currentMessageChars: number,
 *     historyChars: number,
 *     usedChars: number,
 *     includedTurns: number,
 *     droppedTurns: number,
 *     truncated: boolean,
 *     overBudget: boolean
 *   }
 * }}
 */
function buildBudgetedMessages(options) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('buildBudgetedMessages: options must be an object');
  }

  var systemMessages = Array.isArray(options.systemMessages)
    ? options.systemMessages
    : [];
  var history = Array.isArray(options.history)
    ? options.history
    : [];
  var currentUserMessage = typeof options.currentUserMessage === 'string'
    ? options.currentUserMessage
    : '';
  var maxTotalChars = typeof options.maxTotalChars === 'number' && options.maxTotalChars > 0
    ? options.maxTotalChars
    : 14000;
  var maxTurns = typeof options.maxTurns === 'number' && options.maxTurns > 0
    ? options.maxTurns
    : 30;

  // ---- 计算 system 字符数 ----
  var systemChars = 0;
  var validSystemMessages = [];
  for (var si = 0; si < systemMessages.length; si++) {
    var sm = systemMessages[si];
    if (!sm || typeof sm !== 'object' || Array.isArray(sm)) continue;
    if (typeof sm.content !== 'string') continue;
    validSystemMessages.push({ role: sm.role, content: sm.content });
    systemChars += sm.content.length;
  }

  // ---- 当前用户消息 ----
  var currentMessageChars = currentUserMessage.length;

  // ---- 规范化历史 ----
  var cleanHistory = [];
  for (var hi = 0; hi < history.length; hi++) {
    var hm = history[hi];
    if (!hm || typeof hm !== 'object' || Array.isArray(hm)) continue;
    if (hm.role !== 'user' && hm.role !== 'assistant') continue;
    if (typeof hm.content !== 'string') continue;
    cleanHistory.push({ role: hm.role, content: hm.content });
  }

  // ---- system + current 已超预算 ----
  var fixedChars = systemChars + currentMessageChars;
  if (fixedChars > maxTotalChars) {
    var allMessages = validSystemMessages.concat([
      { role: 'user', content: currentUserMessage },
    ]);
    return {
      messages: allMessages,
      historyMessages: [],
      stats: {
        systemChars: systemChars,
        currentMessageChars: currentMessageChars,
        historyChars: 0,
        usedChars: fixedChars,
        includedTurns: 0,
        droppedTurns: countTurns(cleanHistory),
        truncated: true,
        overBudget: true,
      },
    };
  }

  // ---- 从后向前收集完整轮次 ----
  var remainingBudget = maxTotalChars - fixedChars;
  var rounds = buildRounds(cleanHistory);

  // 从后向前选择轮次
  var selectedRoundIndices = [];
  var historyChars = 0;

  for (var ri = rounds.length - 1; ri >= 0; ri--) {
    // 检查轮数限制
    if (selectedRoundIndices.length >= maxTurns) break;

    var round = rounds[ri];
    var roundChars = 0;
    for (var rj = 0; rj < round.messages.length; rj++) {
      roundChars += round.messages[rj].content.length;
    }

    // 完整轮次放不下时停止，不跳过
    if (historyChars + roundChars > remainingBudget) break;

    selectedRoundIndices.push(ri);
    historyChars += roundChars;
  }

  // 反转 selectedRoundIndices 以恢复时间顺序
  selectedRoundIndices.sort(function (a, b) { return a - b; });

  // ---- 构建输出 ----
  var historyMessages = [];
  for (var si2 = 0; si2 < selectedRoundIndices.length; si2++) {
    var rIdx = selectedRoundIndices[si2];
    var selectedRound = rounds[rIdx];
    for (var sj = 0; sj < selectedRound.messages.length; sj++) {
      historyMessages.push(selectedRound.messages[sj]);
    }
  }

  var includedTurns = 0;
  for (var ti = 0; ti < selectedRoundIndices.length; ti++) {
    if (rounds[selectedRoundIndices[ti]].complete) includedTurns++;
  }

  var allMessages2 = validSystemMessages.concat(
    historyMessages,
    [{ role: 'user', content: currentUserMessage }]
  );

  return {
    messages: allMessages2,
    historyMessages: historyMessages,
    stats: {
      systemChars: systemChars,
      currentMessageChars: currentMessageChars,
      historyChars: historyChars,
      usedChars: systemChars + currentMessageChars + historyChars,
      includedTurns: includedTurns,
      droppedTurns: rounds.length - selectedRoundIndices.length,
      truncated: selectedRoundIndices.length < rounds.length,
      overBudget: false,
    },
  };
}

// ============================================================
//  内部辅助
// ============================================================

/**
 * 将扁平消息数组构建为轮次列表。
 * 一轮 = 一个 user + 紧接的 assistant（可选）。
 *
 * @param {Array<{role:string,content:string}>} messages
 * @returns {Array<{messages:Array, complete:boolean}>}
 */
function buildRounds(messages) {
  var rounds = [];
  var i = 0;

  while (i < messages.length) {
    var m = messages[i];

    if (m.role === 'assistant') {
      // 孤立 assistant：跳过
      i++;
      continue;
    }

    if (m.role === 'user') {
      var roundMsgs = [{ role: m.role, content: m.content }];
      var complete = false;

      // 检查下一个是否是 assistant
      if (i + 1 < messages.length && messages[i + 1].role === 'assistant') {
        roundMsgs.push({ role: messages[i + 1].role, content: messages[i + 1].content });
        complete = true;
        i += 2;
      } else {
        // 孤立 user：保留但不完整
        i += 1;
      }

      rounds.push({ messages: roundMsgs, complete: complete });
    } else {
      // 未知 role：跳过
      i++;
    }
  }

  return rounds;
}

/**
 * 计算扁平消息数组中的完整轮次数。
 */
function countTurns(messages) {
  var rounds = buildRounds(messages);
  var count = 0;
  for (var i = 0; i < rounds.length; i++) {
    if (rounds[i].complete) count++;
  }
  return count;
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  buildBudgetedMessages: buildBudgetedMessages,
  BUDGET_PRESETS: BUDGET_PRESETS,
};
