/**
 * lib/analyze-v2-translator.js — analyze-v2 JSON → V1 兼容格式翻译器
 *
 * 纯函数模块。不读写文件、不访问网络、不调用模型。
 * 不修改任何输入参数。
 */

'use strict';

/**
 * V2 indicator → V1 维度+指标 映射表。
 * Key 来源：prompts/analyze-v2.md「七项指标」定义（行 30-60）。
 */
var V2_INDICATOR_MAP = {
  narrative_organization:  { dim: '语言表达', ind: '叙事组织能力' },
  vocabulary_choice:       { dim: '语言表达', ind: '词汇丰富度与用词选择' },
  active_topic_tendency:   { dim: '兴趣方向', ind: '主动话题倾向' },
  interest_depth_breadth:  { dim: '兴趣方向', ind: '兴趣深度vs广度' },
  self_reflection:         { dim: '内省倾向', ind: '自我反思频率' },
  value_judgment:          { dim: '内省倾向', ind: '价值判断表达' },
  adaptive_elaboration:    { dim: '思维方式', ind: '追问下的应变' },
};

/**
 * 将 analyze-v2 输出翻译为 V1 兼容格式，供下游 teacher-data-adapter 消费。
 * 不修改入参，返回新对象。
 *
 * @param {object|null} v2 — runAnalyze 返回的 v2 JSON（已 parse）
 * @param {number} turnCount — 对话总轮数，用于生成"分析范围"
 * @returns {object|null} V1 兼容格式对象，输入非法时返回 null
 */
function translateV2ToV1Compatible(v2, turnCount) {
  if (!v2 || typeof v2 !== 'object' || Array.isArray(v2)) return null;

  // ---- 命中指标 ----
  var v2Evidence = Array.isArray(v2.evidence) ? v2.evidence : [];
  var hits = [];
  for (var i = 0; i < v2Evidence.length; i++) {
    var ev = v2Evidence[i];
    if (!ev || typeof ev !== 'object') continue;

    var indicator = typeof ev.indicator === 'string' ? ev.indicator.trim() : '';
    var evidenceText = typeof ev.evidence_text === 'string' ? ev.evidence_text.trim() : '';
    var observation = typeof ev.observation === 'string' ? ev.observation.trim() : '';
    var strength = typeof ev.strength === 'string' ? ev.strength.trim().toLowerCase() : '';
    var pattern = typeof ev.pattern === 'string' ? ev.pattern.trim() : '';
    var wasPrompted = ev.was_prompted === true;
    var promptIntensityRaw = typeof ev.prompt_intensity === 'string' ? ev.prompt_intensity.trim().toLowerCase() : '';
    var promptIntensity = (promptIntensityRaw === 'light' || promptIntensityRaw === 'direct' || promptIntensityRaw === 'none')
      ? promptIntensityRaw : 'none';

    // indicator + evidence_text 都为空则跳过
    if (indicator.length === 0 && evidenceText.length === 0) continue;

    // 查 INDICATOR_MAP 获取维度+指标中文名；未知 indicator fallback 用原文
    var mapping = V2_INDICATOR_MAP[indicator] || { dim: '', ind: indicator };
    if (mapping.dim.length === 0 && mapping.ind.length === 0 && indicator.length === 0) continue;

    // 强度备注：三种强度都不留空（对齐 V2 原则 13："strength 表示证据信息量"）
    var strengthNote = observation;
    var strengthLabel = '';
    if (strength === 'weak') {
      strengthLabel = '【弱证据】';
    } else if (strength === 'moderate') {
      strengthLabel = '【中等证据】';
    } else {
      // 'strong' 或非法值 — 仍然生成备注，不留空
      strengthLabel = '【较强证据】';
    }
    if (observation.length > 0) {
      strengthNote = strengthLabel + observation;
    } else {
      strengthNote = strengthLabel;
    }

    hits.push({
      '维度': mapping.dim,
      '指标': mapping.ind,
      '证据片段': evidenceText,
      '说话轮次': '',                       // V2 不提供，留空
      '信号说明': observation,               // 复用 observation
      '强度备注': strengthNote,
      'strength': strength,
      '观察模式': pattern,
      'was_prompted': wasPrompted,
      'prompt_intensity': promptIntensity,
    });
  }

  // ---- 安全提示 ----
  var safetyAlert = v2.safety_alert === true;
  var safetyNote = typeof v2.safety_alert_reason === 'string' ? v2.safety_alert_reason.trim() : '';

  // ---- 活跃话题 — 保留原始 V2 active_topics 供教师端提取话题 ----
  var topics = [];
  var rawTopics = Array.isArray(v2.active_topics) ? v2.active_topics : [];
  for (var ti = 0; ti < rawTopics.length; ti++) {
    var t = rawTopics[ti];
    if (t && typeof t.topic === 'string' && t.topic.trim().length > 0) {
      topics.push({
        topic: t.topic.trim(),
        initiated_by_student: t.initiated_by_student === true,
      });
    }
  }

  // ---- 分析范围 ----
  var safeTurns = (typeof turnCount === 'number' && isFinite(turnCount) && turnCount > 0)
    ? Math.floor(turnCount)
    : 0;
  var scope = safeTurns > 0 ? '第1-' + safeTurns + '轮' : '';

  // ---- 未命中指标 — V2 不产出该概念，始终空（对齐 V2 原则 9:"没有观察到≠不足"） ----
  var noHits = [];

  // ---- 信号质量 — V2 新增 ----
  var signalQuality = typeof v2.signal_quality === 'string' ? v2.signal_quality : 'normal';
  var signalQualityReason = typeof v2.signal_quality_reason === 'string' ? v2.signal_quality_reason.trim() : '';

  return {
    '分析范围': scope,
    '命中指标': hits,
    '未命中指标': noHits,
    '安全提示': safetyAlert,
    '安全提示说明': safetyNote,
    '活跃话题': topics,
    '信号质量': signalQuality,
    '信号质量原因': signalQualityReason,
  };
}

module.exports = {
  translateV2ToV1Compatible: translateV2ToV1Compatible,
  // 导出供测试验证
  _INDICATOR_MAP: V2_INDICATOR_MAP,
};
