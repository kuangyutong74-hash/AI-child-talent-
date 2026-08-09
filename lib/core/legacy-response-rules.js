/**
 * legacy-response-rules.js — 从 app.js 原样提取的回复规则纯函数
 *
 * 用途：
 *   将当前 app.js 中已有的硬规则检测逻辑提取为独立纯函数，
 *   供生产代码和测试代码共同使用。本阶段不修改任何规则含义，
 *   只做原样迁移。
 *
 * 提取来源：app.js（以下行号基于当前版本）
 *   - hasChoicePattern:  第 506-509 行的 choicePattern 正则
 *   - filterGreeting:    第 538-547 行的中途问候过滤器
 *   - isFarewellReply:   第 1156-1184 行的 farewell 检测函数
 */

// ============================================================
//  选择式追问检测（"是A还是B" 句式）
//  app.js:506-509 原样正则
// ============================================================

/**
 * 构建二选一检测正则（每次调用生成新 RegExp 实例，避免 lastIndex 状态污染）
 */
function buildChoicePattern() {
  const prefix = '是' + '[^？！。\\n]{1,60}' + '还是';
  const bare =
    '(?:还是|或者)' +
    '(?!算了|不要|别说|那句|那样|那个|下次|再)' +
    '[^？！。\\n]{1,40}' +
    '[？?]';
  return new RegExp(prefix + '[^？！。\\n]{1,40}' + '[？?]' + '|' + bare);
}

/**
 * 检测文本中是否包含二选一结构（"是A还是B" / "A还是B?" / "A或者B?"）
 * @param {string} text - 待检测的 AI 回复文本
 * @returns {boolean}
 */
function hasChoicePattern(text) {
  return buildChoicePattern().test(text);
}

// ============================================================
//  中途问候过滤器
//  app.js:538-547 原样逻辑
// ============================================================

const GREETING_PATTERN = /^(嘿[，,]?\s*|你好呀[～~]?\s*|嗨[，,]?\s*|好久不见[～~]?\s*)/;

/**
 * 检测文本是否以问候语开头
 * @param {string} text
 * @returns {boolean}
 */
function startsWithGreeting(text) {
  return GREETING_PATTERN.test(text);
}

/**
 * 非首轮回复如果以问候语开头，去掉问候部分
 * @param {string} reply - AI 回复文本
 * @param {number} userMsgCount - 当前 session 中学生消息总数（含本轮刚发的）
 * @returns {string} - 过滤后的回复文本
 */
function filterGreeting(reply, userMsgCount) {
  if (userMsgCount > 1 && startsWithGreeting(reply)) {
    const withoutGreeting = reply.replace(GREETING_PATTERN, '').trim();
    if (withoutGreeting.length > 2) {
      return withoutGreeting;
    }
  }
  return reply;
}

// ============================================================
//  Farewell 检测（收尾阶段识别）
//  app.js:1156-1184 原样函数
// ============================================================

const FAREWELL_PATTERNS = [
  '下次再聊', '下次见', '拜拜', '再见', '下次聊',
  '随时来找小新', '随时找我', '下次再跟小新',
  '下次再跟你说', '下次再聊啦', '下次再和小新',
  '今天先到这儿', '先聊到这儿', '今天就到这儿',
  '也要开心哦', '下次继续', '下次再来',
  '跟你聊天很开心', '很开心和你聊',
  '期待下次', '回头再聊',
];

/**
 * 判断 AI 回复是否进入了自然收尾阶段
 * @param {string} reply - AI 回复文本
 * @param {Array<{role: string, content: string}>} history - 当前会话完整历史
 * @returns {boolean}
 */
function isFarewellReply(reply, history) {
  // 对话轮数太少，不可能进入收尾阶段
  const userRounds = history.filter(function (m) { return m.role === 'user'; }).length;
  if (userRounds < 5) return false;

  // 匹配 farewell 关键词
  const matchesFarewell = FAREWELL_PATTERNS.some(function (p) { return reply.includes(p); });
  if (!matchesFarewell) return false;

  // 如果回复较长且包含问句，大概率还在深度对话中，不是真正收尾
  const containsQuestion = reply.includes('？') || reply.includes('?');
  if (containsQuestion && reply.length > 30) return false;

  return true;
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  buildChoicePattern,
  hasChoicePattern,
  GREETING_PATTERN,
  startsWithGreeting,
  filterGreeting,
  FAREWELL_PATTERNS,
  isFarewellReply,
};
