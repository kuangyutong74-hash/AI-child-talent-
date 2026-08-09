/**
 * prompt-builder.js — 从 app.js 原样提取的 System Prompt 组装逻辑
 *
 * 用途：
 *   将当前 app.js POST /chat/session 中构建 systemContent 和 messagesForAI
 *   的逻辑提取为独立纯函数，供生产代码和测试代码共同使用。
 *   本阶段不修改任何组装逻辑，只做原样迁移。
 *
 * 提取来源：app.js
 *   - buildSystemContent:  第 434-467 行（notebookHint + continuationRule + systemContent）
 *   - buildMessagesForAI:  第 470-473 行（去掉 topicSource 字段）
 */

// ============================================================
//  buildSystemContent — 构建完整的 system 消息内容
//  app.js:434-467 原样逻辑
// ============================================================

/**
 * 检测最近两轮学生消息是否都为短回复（<5字）
 * @param {Array<{role: string, content: string}>} history - 当前会话完整历史
 * @returns {{ isShortReplies: boolean, notebookHint: string }}
 */
function computeNotebookHint(history) {
  const userMessages = history.filter(function (m) { return m.role === 'user'; });
  const lastTwo = userMessages.slice(-2);
  const isShortReplies = lastTwo.length === 2
    && lastTwo.every(function (m) { return m.content.length < 5; });

  let notebookHint = '';
  if (isShortReplies) {
    const earlierMessages = userMessages.slice(0, -2);
    const earlierTopics = earlierMessages
      .filter(function (m) { return m.content.length >= 5; })
      .map(function (m) { return m.content.slice(0, 50); });
    if (earlierTopics.length > 0) {
      var pick = earlierTopics[earlierTopics.length - 1];
      notebookHint = '\n\n【小新的笔记本提醒】学生已经连续两轮回复很短（少于5个字），看起来不太想主动展开。请你从之前聊过的内容里挑一个未被深入追问的话题，自然地重新提起。例如可以问："对了，你之前说过「' + pick + '」，那个后来怎么样了呀？" 注意：不要用"对了"这种机械的开头，请自然地融入对话，也不要复读上面那句示范。';
    }
  }

  return { isShortReplies: isShortReplies, notebookHint: notebookHint };
}

/**
 * 构建历史续接规则文本（用于恢复旧对话时提醒 AI 不要重新打招呼）
 * @param {Array<{role: string, content: string}>} history - 当前会话完整历史（已包含本轮用户消息）
 * @returns {string}
 */
function buildContinuationRule(history) {
  var historyBeforeThisMsg = history.filter(function (m) { return m.role === 'user'; }).length - 1;
  if (historyBeforeThisMsg > 0) {
    return '\n\n【历史续接模式】这是你和一个学生之间之前聊天的接续。上面是你们之前已经聊过的完整内容（包含多轮对话），现在学生要继续往下聊。请严格遵循以下规则：\n1. 绝对禁止重新自我介绍、打招呼（如"嘿""嗨""你好呀"），你一直在聊天，只是现在继续而已。\n2. 直接针对学生刚才说的内容回应，保持之前对话的自然连贯性。\n3. 你可以自然提及之前聊过的内容，就像你们一直在对话一样。\n4. 不要当作这是新的第一次聊天。';
  }
  return '';
}

/**
 * 构建发送给模型的 system 消息内容
 *
 * 与原 app.js:465-467 完全一致的逻辑：
 *   - 如果 notebookHint 或 continuationRule 非空，则 SYSTEM_PROMPT + continuationRule + notebookHint
 *   - 否则仅 SYSTEM_PROMPT
 *
 * @param {string} systemPrompt - 从 prompts/xiaoxin.md 加载的完整系统提示词
 * @param {Array<{role: string, content: string}>} history - 当前会话完整历史（已包含本轮用户消息）
 * @returns {string} systemContent
 */
function buildSystemContent(systemPrompt, history) {
  var notebookResult = computeNotebookHint(history);
  var continuationRule = buildContinuationRule(history);

  if (notebookResult.notebookHint || continuationRule) {
    return systemPrompt + (continuationRule || '') + (notebookResult.notebookHint || '');
  }
  return systemPrompt;
}

// ============================================================
//  buildMessagesForAI — 构建发送给模型的消息数组（去掉内部字段）
//  app.js:470-473 原样逻辑
// ============================================================

/**
 * 将 session 历史转换为 AI 可接收的消息格式
 * 去掉 topicSource、_ts 等内部字段，只保留 role 和 content
 *
 * @param {Array<{role: string, content: string}>} history
 * @returns {Array<{role: string, content: string}>}
 */
function buildMessagesForAI(history) {
  return history.map(function (m) {
    return {
      role: m.role,
      content: m.content,
    };
  });
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  computeNotebookHint,
  buildContinuationRule,
  buildSystemContent,
  buildMessagesForAI,
};
