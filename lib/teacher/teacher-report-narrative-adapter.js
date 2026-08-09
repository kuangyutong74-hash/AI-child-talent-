/**
 * teacher-report-narrative-adapter.js — 阶段性报告 AI 叙述适配器
 *
 * 纯函数模块。不读写文件、不访问网络、不调用模型、不依赖 Express。
 * 不修改任何输入参数。
 * 不使用 Date.now()、Math.random()。
 *
 * 将 buildTeacherStageReport 产生的结构化报告转换为
 * narrative-report.md prompt 所需的 JSON 输入。
 *
 * 导出：
 *   buildNarrativePromptInput(input)
 *   resolveEffectiveModules(narrativeRecord)
 *   resolveEffectiveNarrative(narrativeRecord)       // v1 兼容，不再推荐使用
 *   hasDataChangedSinceLastAiVersion(record, currentDigest)
 *   buildRawStudentReportData(input)
 *   parseAiNarrativeJson(text)                       // 解析 AI 结构化 JSON 输出
 *   getLatestModuleEdit(record, module)              // 获取某模块最近一次编辑
 */

'use strict';

// ============================================================
//  辅助函数
// ============================================================

var hop = Object.prototype.hasOwnProperty;

function isNonArrayObject(val) {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function isArray(val) {
  return Array.isArray(val);
}

function isString(val) {
  return typeof val === 'string';
}

function safeGetOwnString(obj, key, fallback) {
  if (!isNonArrayObject(obj)) return fallback;
  if (!hop.call(obj, key)) return fallback;
  var v = obj[key];
  return isString(v) ? v : fallback;
}

// ============================================================
//  已知的结构化输出模块名
// ============================================================

var KNOWN_MODULES = ['coreFindings', 'dimensionProfile', 'suggestions', 'evidenceExcerpts'];

// ============================================================
//  导出 1: buildNarrativePromptInput（不变）
// ============================================================

/**
 * 从 buildTeacherStageReport 产生的报告对象中提取 AI 叙述所需的结构化数据，
 * 序列化为 JSON 字符串，直接作为 narrative-report.md prompt 的 user message。
 *
 * @param {object} input
 * @param {object} input.report — buildTeacherStageReport 的 .report 输出
 * @returns {string|null} JSON 字符串，或 null（如果输入无效）
 */
function buildNarrativePromptInput(input) {
  if (!isNonArrayObject(input)) return null;

  var report = input.report;
  if (!isNonArrayObject(report)) return null;

  // ---- period ----
  var period = { range: 'all', description: '全部历史' };
  var reportPeriod = report.period;
  if (isNonArrayObject(reportPeriod)) {
    var rpRange = safeGetOwnString(reportPeriod, 'range', 'all');
    period.range = rpRange;
    if (rpRange === 'all') {
      period.description = '全部历史';
    } else if (rpRange === '30d') {
      period.description = '最近30天';
    } else if (rpRange === '7d') {
      period.description = '最近7天';
    }
  }

  // ---- summary ----
  var summary = {};
  var reportSummary = report.summary;
  if (isNonArrayObject(reportSummary)) {
    summary.conversationCount = safeNum(reportSummary.conversationCount);
    summary.totalTurns = safeNum(reportSummary.totalTurns);
    summary.insightCount = safeNum(reportSummary.insightCount);
    summary.confirmedCount = safeNum(reportSummary.confirmedCount);
    summary.unreviewedCount = safeNum(reportSummary.unreviewedCount);
    summary.rejectedCount = safeNum(reportSummary.rejectedCount);
    summary.dimensionCount = safeNum(reportSummary.dimensionCount);
    summary.indicatorCount = safeNum(reportSummary.indicatorCount);
    summary.lowQualityConversationCount = safeNum(reportSummary.lowQualityConversationCount);
    summary.lowQualityInsightCount = safeNum(reportSummary.lowQualityInsightCount);
    summary.firstSeen = safeGetOwnString(reportSummary, 'firstSeen', null);
    summary.lastActive = safeGetOwnString(reportSummary, 'lastActive', null);
  } else {
    summary = {
      conversationCount: 0, totalTurns: 0, insightCount: 0,
      confirmedCount: 0, unreviewedCount: 0, rejectedCount: 0,
      dimensionCount: 0, indicatorCount: 0,
      lowQualityConversationCount: 0, lowQualityInsightCount: 0,
      firstSeen: null, lastActive: null,
    };
  }

  // ---- topics ----
  var topics = [];
  var reportTopics = report.topics;
  if (isArray(reportTopics)) {
    for (var ti = 0; ti < reportTopics.length; ti++) {
      var t = reportTopics[ti];
      if (!isNonArrayObject(t)) continue;
      var topicName = safeGetOwnString(t, 'topic', '');
      if (topicName.length === 0) continue;
      topics.push({
        topic: topicName,
        count: typeof t.count === 'number' ? t.count : 0,
      });
    }
  }

  // ---- dimensions ----
  var dimensions = [];
  var reportDims = report.dimensions;
  if (isArray(reportDims)) {
    for (var di = 0; di < reportDims.length; di++) {
      var d = reportDims[di];
      if (!isNonArrayObject(d)) continue;
      var dimName = safeGetOwnString(d, 'dimension', '');
      if (dimName.length === 0) continue;
      var indicators = [];
      var rawInds = d.indicators;
      if (isArray(rawInds)) {
        for (var ii = 0; ii < rawInds.length; ii++) {
          var ind = rawInds[ii];
          if (!isNonArrayObject(ind)) continue;
          var indName = safeGetOwnString(ind, 'indicator', '');
          if (indName.length === 0) continue;
          indicators.push({
            indicator: indName,
            count: typeof ind.count === 'number' ? ind.count : 0,
            distinctConversationCount: typeof ind.distinctConversationCount === 'number' ? ind.distinctConversationCount : 0,
          });
        }
      }
      dimensions.push({
        dimension: dimName,
        count: typeof d.count === 'number' ? d.count : 0,
        distinctConversationCount: typeof d.distinctConversationCount === 'number' ? d.distinctConversationCount : 0,
        indicators: indicators,
      });
    }
  }

  // ---- recurringSignals ----
  var recurringSignals = [];
  var reportSignals = report.recurringSignals;
  if (isArray(reportSignals)) {
    for (var ri = 0; ri < reportSignals.length; ri++) {
      var rs = reportSignals[ri];
      if (!isNonArrayObject(rs)) continue;
      var evidence = [];
      var rawEv = rs.evidence;
      if (isArray(rawEv)) {
        for (var ei = 0; ei < rawEv.length; ei++) {
          var ev = rawEv[ei];
          if (!isNonArrayObject(ev)) continue;
          evidence.push({
            evidenceSnippet: safeGetOwnString(ev, 'evidenceSnippet', ''),
            reviewStatus: safeGetOwnString(ev, 'reviewStatus', 'unreviewed'),
            teacherNote: ev.teacherNote !== null && isString(ev.teacherNote) ? ev.teacherNote : null,
          });
        }
      }
      recurringSignals.push({
        dimension: safeGetOwnString(rs, 'dimension', ''),
        indicator: safeGetOwnString(rs, 'indicator', ''),
        occurrenceCount: typeof rs.occurrenceCount === 'number' ? rs.occurrenceCount : 0,
        distinctConversationCount: typeof rs.distinctConversationCount === 'number' ? rs.distinctConversationCount : 0,
        confirmedOccurrenceCount: typeof rs.confirmedOccurrenceCount === 'number' ? rs.confirmedOccurrenceCount : 0,
        unreviewedOccurrenceCount: typeof rs.unreviewedOccurrenceCount === 'number' ? rs.unreviewedOccurrenceCount : 0,
        topics: isArray(rs.topics) ? rs.topics : [],
        evidence: evidence,
      });
    }
  }

  // ---- confirmedInsights (简化为 id + 摘要) ----
  var confirmedInsights = [];
  var reportConfirmed = report.confirmedInsights;
  if (isArray(reportConfirmed)) {
    for (var ci = 0; ci < reportConfirmed.length; ci++) {
      confirmedInsights.push(simplifyInsight(reportConfirmed[ci]));
    }
  }

  // ---- candidateInsights ----
  var candidateInsights = [];
  var reportCandidates = report.candidateInsights;
  if (isArray(reportCandidates)) {
    for (var cni = 0; cni < reportCandidates.length; cni++) {
      candidateInsights.push(simplifyInsight(reportCandidates[cni]));
    }
  }

  // ---- engagement ----
  var engagement = { high: 0, medium: 0, low: 0, unknown: 0 };
  var reportEngagement = report.engagement;
  if (isNonArrayObject(reportEngagement)) {
    engagement.high = typeof reportEngagement.high === 'number' ? reportEngagement.high : 0;
    engagement.medium = typeof reportEngagement.medium === 'number' ? reportEngagement.medium : 0;
    engagement.low = typeof reportEngagement.low === 'number' ? reportEngagement.low : 0;
    engagement.unknown = typeof reportEngagement.unknown === 'number' ? reportEngagement.unknown : 0;
  }

  // ---- coverage ----
  var coverage = {};
  var reportCoverage = report.coverage;
  if (isNonArrayObject(reportCoverage)) {
    coverage.totalConversationCount = safeNum(reportCoverage.totalConversationCount);
    coverage.includedConversationCount = safeNum(reportCoverage.includedConversationCount);
    coverage.conversationsWithoutAnalysis = safeNum(reportCoverage.conversationsWithoutAnalysis);
    coverage.conversationsWithoutTopic = safeNum(reportCoverage.conversationsWithoutTopic);
    coverage.totalInsightCount = safeNum(reportCoverage.totalInsightCount);
    coverage.includedInsightCount = safeNum(reportCoverage.includedInsightCount);
    coverage.insightsWithoutEvidence = safeNum(reportCoverage.insightsWithoutEvidence);
  } else {
    coverage = {
      totalConversationCount: 0, includedConversationCount: 0,
      conversationsWithoutAnalysis: 0, conversationsWithoutTopic: 0,
      totalInsightCount: 0, includedInsightCount: 0, insightsWithoutEvidence: 0,
    };
  }

  var result = {
    period: period,
    summary: summary,
    topics: topics,
    dimensions: dimensions,
    recurringSignals: recurringSignals,
    confirmedInsights: confirmedInsights,
    candidateInsights: candidateInsights,
    engagement: engagement,
    coverage: coverage,
  };

  try {
    return JSON.stringify(result);
  } catch (_) {
    return null;
  }
}

/**
 * 将单条 insight 简化为 AI 叙述所需的摘要格式。
 */
function simplifyInsight(ins) {
  if (!isNonArrayObject(ins)) return null;
  return {
    dimension: safeGetOwnString(ins, 'dimension', ''),
    indicator: safeGetOwnString(ins, 'indicator', ''),
    signal: safeGetOwnString(ins, 'signal', ''),
    evidenceSnippet: safeGetOwnString(ins, 'evidenceSnippet', ''),
    topic: ins.topic !== null && isString(ins.topic) ? ins.topic : null,
    reviewStatus: safeGetOwnString(ins, 'reviewStatus', 'unreviewed'),
    teacherNote: ins.teacherNote !== null && isString(ins.teacherNote) ? ins.teacherNote : null,
    signalQuality: safeGetOwnString(ins, 'signalQuality', 'normal'),
  };
}

function safeNum(n) {
  if (typeof n === 'number' && isFinite(n) && n >= 0) return Math.floor(n);
  return 0;
}

function safeTruncate(str, maxLen) {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  var end = maxLen;
  if (end > 0 && str.charCodeAt(end - 1) >= 0xD800 && str.charCodeAt(end - 1) <= 0xDBFF) {
    end = maxLen + 1;
  }
  var out = str.slice(0, end);
  var lastChar = out.charCodeAt(out.length - 1);
  if (lastChar >= 0xD800 && lastChar <= 0xDBFF) {
    out = out.slice(0, -1);
  }
  return out;
}

// ============================================================
//  导出 2: parseAiNarrativeJson — 解析 AI 输出的结构化 JSON
// ============================================================

/**
 * 解析 AI 模型返回的叙述文本，兼容两种情况：
 *   1. 合法的 JSON 对象字符串，包含 coreFindings 等字段
 *   2. 纯文本（v1 兼容）：包装为 { coreFindings: text, ... }
 *
 * @param {string} rawText — AI 返回的原始文本
 * @returns {{ coreFindings: string, dimensionProfile: string, suggestions: string, evidenceExcerpts: string }|null}
 */
function parseAiNarrativeJson(rawText) {
  if (!isString(rawText) || rawText.trim().length === 0) return null;

  var trimmed = rawText.trim();

  // 尝试 JSON 解析
  try {
    var parsed = JSON.parse(trimmed);
    return normalizeNarrativeModules(parsed);
  } catch (_) {
    // 尝试去掉 markdown 代码块后解析
  }

  var cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    var parsed2 = JSON.parse(cleaned);
    return normalizeNarrativeModules(parsed2);
  } catch (_2) {
    // 纯文本兜底（v1 兼容）。但如果文本以 { 开头，说明是损坏的 JSON，
    // 不应假装解析成功，返回 null 让调用方尝试更早的版本。
    if (trimmed.charCodeAt(0) === 123) return null;
  }

  // 纯文本兜底（v1 兼容）
  return {
    coreFindings: trimmed,
    dimensionProfile: '',
    suggestions: '',
    evidenceExcerpts: '',
  };
}

/**
 * 标准化 AI 输出结果，确保四个模块都存在。
 */
function normalizeNarrativeModules(obj) {
  if (!isNonArrayObject(obj)) return null;

  return {
    coreFindings: isString(obj.coreFindings) ? obj.coreFindings : '',
    dimensionProfile: isString(obj.dimensionProfile) ? obj.dimensionProfile : '',
    suggestions: isString(obj.suggestions) ? obj.suggestions : '',
    evidenceExcerpts: isString(obj.evidenceExcerpts) ? obj.evidenceExcerpts : '',
  };
}

// ============================================================
//  导出 3: resolveEffectiveModules — 分模块解析有效内容
// ============================================================

/**
 * 从 narrative 存储记录中解析出每个模块的当前有效内容。
 *
 * 每个模块的优先级：moduleEdits 最后一条 → AI 最新版本的对应字段 → ''
 *
 * @param {object|null} record — store.findByStudentIdAndRange 的返回值
 * @returns {object} — { moduleName: { text, source, editedAt, editedBy } }
 *   额外带 _aiRaw: 从 AI 版本中解析出的原始模块对象（已标准化）
 */
function resolveEffectiveModules(record) {
  var emptyModule = function () {
    return { text: null, source: 'none', outdated: false, editedAt: null, editedBy: null };
  };

  var result = {};
  for (var mi = 0; mi < KNOWN_MODULES.length; mi++) {
    result[KNOWN_MODULES[mi]] = emptyModule();
  }

  // 从最新到最旧遍历 AI 版本，使用第一个能解析出有效 coreFindings 的版本
  var aiModules = { coreFindings: '', dimensionProfile: '', suggestions: '', evidenceExcerpts: '' };
  var _aiVersionGeneratedAt = null;  // 当前生效的 AI 版本的生成时间

  if (isNonArrayObject(record)) {
    var versions = record.aiGeneratedVersions;
    if (isArray(versions) && versions.length > 0) {
      for (var vi = versions.length - 1; vi >= 0; vi--) {
        var candidate = versions[vi];
        if (!isNonArrayObject(candidate) || !isString(candidate.text)) continue;
        var parsed = parseAiNarrativeJson(candidate.text);
        // 只有成功解析出结构化 JSON（四模块至少有一个非空）才算有效版本
        if (parsed && (
          parsed.coreFindings.length > 0 ||
          parsed.dimensionProfile.length > 0 ||
          parsed.suggestions.length > 0 ||
          parsed.evidenceExcerpts.length > 0
        )) {
          aiModules = parsed;
          _aiVersionGeneratedAt = safeGetOwnString(candidate, 'generatedAt', null);
          break;
        }
      }
    }
  }

  // 构建 moduleEdits 索引：每个模块的最后一条编辑记录
  var latestEditByModule = Object.create(null);
  if (isNonArrayObject(record) && isArray(record.moduleEdits)) {
    for (var ei = 0; ei < record.moduleEdits.length; ei++) {
      var me = record.moduleEdits[ei];
      if (!isNonArrayObject(me)) continue;
      var mName = safeGetOwnString(me, 'module', '');
      if (mName.length === 0) continue;
      // 因为 moduleEdits 是按时间追加的，取最后遇到的
      latestEditByModule[mName] = me;
    }
  }

  // 对每个 known module 确定有效内容
  for (var mj = 0; mj < KNOWN_MODULES.length; mj++) {
    var key = KNOWN_MODULES[mj];
    var edit = latestEditByModule[key];

    if (edit) {
      var editContent = safeGetOwnString(edit, 'content', '');
      if (editContent.length > 0) {
        var editAction = safeGetOwnString(edit, 'action', 'edit');
        var editAiVersionAt = safeGetOwnString(edit, 'aiVersionGeneratedAt', null);

        // ---- coreFindings 版本过时判定 ----
        // 比较编辑记录关联的 AI 版本时间戳和当前最新 AI 版本时间戳。
        // 不一致 → 编辑记录过时。对 confirm/reject 自动失效；
        // 对 edit（教师自定义文本）保留文字但标记 outdated。
        var isStale = false;
        if (key === 'coreFindings') {
          isStale = Boolean(_aiVersionGeneratedAt && (!editAiVersionAt || editAiVersionAt !== _aiVersionGeneratedAt));
        }

        if (isStale && (editAction === 'confirm' || editAction === 'reject')) {
          // 过时 → 跳过这条编辑记录，回退到 AI 最新版本
          // 不设 result，不 continue，自然落入下方 AI fallback
        } else if (isStale && editAction === 'edit') {
          // 教师自定义文本过时 → 保留文字，标记 outdated
          result[key] = {
            text: editContent,
            source: 'teacher_edited_outdated',
            outdated: true,
            editedAt: safeGetOwnString(edit, 'editedAt', null),
            editedBy: safeGetOwnString(edit, 'editedBy', null),
          };
          continue;
        } else {
          // 未过时 → 正常使用编辑记录
          var source;
          if (editAction === 'confirm') {
            source = 'teacher_confirmed';
          } else if (editAction === 'reject') {
            source = 'teacher_rejected';
          } else {
            source = 'teacher_edited';
          }
          result[key] = {
            text: editContent,
            source: source,
            outdated: false,
            editedAt: safeGetOwnString(edit, 'editedAt', null),
            editedBy: safeGetOwnString(edit, 'editedBy', null),
          };
          continue;
        }
      }
    }

    // 回退到 AI 版本
    var aiText = aiModules[key];
    if (aiText.length > 0) {
      result[key] = {
        text: aiText,
        source: 'ai_latest',
        outdated: false,
        editedAt: null,
        editedBy: null,
      };
    }
    // 否则保持 'none'（已在初始化时设置）
  }

  // 附加 _aiRaw 供调用方参考
  result._aiRaw = aiModules;

  return result;
}

// ============================================================
//  导出 4: resolveEffectiveNarrative — v1 兼容（不再推荐使用）
// ============================================================

/**
 * v1 兼容接口。
 * 将四个模块拼接为单一段落返回，优先用 coreFindings。
 *
 * @param {object|null} record
 * @returns {{ text: string|null, source: 'teacher_edited'|'ai_latest'|'none', generatedAt: string|null }}
 */
function resolveEffectiveNarrative(record) {
  var modules = resolveEffectiveModules(record);

  // 找到第一个非空的模块作为 "整体文本"
  var parts = [];
  for (var mi = 0; mi < KNOWN_MODULES.length; mi++) {
    var m = modules[KNOWN_MODULES[mi]];
    if (m.text && m.text.trim().length > 0) {
      parts.push(m.text);
    }
  }

  if (parts.length === 0) {
    return { text: null, source: 'none', generatedAt: null };
  }

  // 确定整体来源：如果任一模块是 teacher_edited，来源就是 teacher_edited
  var source = 'ai_latest';
  for (var mj = 0; mj < KNOWN_MODULES.length; mj++) {
    if (modules[KNOWN_MODULES[mj]].source === 'teacher_edited') {
      source = 'teacher_edited';
      break;
    }
  }

  return {
    text: parts.join('\n\n'),
    source: source,
    generatedAt: null,
  };
}

// ============================================================
//  导出 5: getLatestModuleEdit — 获取某模块最近一次编辑
// ============================================================

/**
 * 返回指定模块最近一条 moduleEdit 记录。
 *
 * @param {object|null} record
 * @param {string} moduleName
 * @returns {object|null} — { module, content, action, editedBy, editedAt } 或 null
 */
function getLatestModuleEdit(record, moduleName) {
  if (!isNonArrayObject(record)) return null;
  if (!isString(moduleName) || moduleName.trim().length === 0) return null;

  var edits = record.moduleEdits;
  if (!isArray(edits)) return null;

  var latest = null;
  var latestTime = -1;

  for (var i = 0; i < edits.length; i++) {
    var me = edits[i];
    if (!isNonArrayObject(me)) continue;
    if (safeGetOwnString(me, 'module', '') !== moduleName) continue;

    var t = Date.parse(safeGetOwnString(me, 'editedAt', ''));
    if (!isNaN(t) && (latest === null || t > latestTime)) {
      latest = {
        module: safeGetOwnString(me, 'module', ''),
        content: safeGetOwnString(me, 'content', ''),
        action: safeGetOwnString(me, 'action', 'edit'),
        editedBy: safeGetOwnString(me, 'editedBy', ''),
        editedAt: safeGetOwnString(me, 'editedAt', ''),
      };
      latestTime = t;
    }
  }

  return latest;
}

// ============================================================
//  导出 6: hasDataChangedSinceLastAiVersion（不变）
// ============================================================

/**
 * 比较当前数据快照和上一次 AI 生成时的 inputDigest，
 * 判断是否有必要触发新的 AI 叙述生成。
 *
 * @param {object|null} record — store.findByStudentIdAndRange 的返回值
 * @param {object} currentDigest — { conversationCount, totalTurns, insightCount, conversationIds }
 * @returns {boolean}
 */
function hasDataChangedSinceLastAiVersion(record, currentDigest) {
  if (!isNonArrayObject(record)) return true; // 无记录 → 需要生成
  if (!isNonArrayObject(currentDigest)) return true;

  var versions = record.aiGeneratedVersions;
  if (!isArray(versions) || versions.length === 0) return true; // 无 AI 版本 → 需要生成

  var lastVersion = versions[versions.length - 1];
  if (!isNonArrayObject(lastVersion)) return true;

  var lastDigest = lastVersion.inputDigest;
  if (!isNonArrayObject(lastDigest)) return true; // 无快照 → 保守起见触发

  // 比较 insightCount
  if (lastDigest.insightCount !== currentDigest.insightCount) return true;

  // 比较 conversationCount
  if (lastDigest.conversationCount !== currentDigest.conversationCount) return true;

  // 比较 conversationIds 集合
  var lastIds = isArray(lastDigest.conversationIds) ? lastDigest.conversationIds : [];
  var currIds = isArray(currentDigest.conversationIds) ? currentDigest.conversationIds : [];

  if (lastIds.length !== currIds.length) return true;

  // 用 Set 比较（不依赖顺序）
  var lastSet = Object.create(null);
  for (var li = 0; li < lastIds.length; li++) {
    if (isString(lastIds[li])) lastSet[lastIds[li]] = true;
  }
  for (var ci = 0; ci < currIds.length; ci++) {
    if (isString(currIds[ci]) && !hop.call(lastSet, currIds[ci])) return true;
  }

  return false;
}

// ============================================================
//  导出 7: buildRawStudentReportData（不变）
// ============================================================

/**
 * 系统后台任务用的纯数据提取函数。不走 teacherCanAccessStudent 权限校验。
 * 从 users + history 中提取单个学生的结构化数据，
 * conversations 和 insights 输出格式与 teacher-data-adapter 中
 * buildStudentConversationSummaries / buildStudentInsights 保持一致，
 * 确保 buildTeacherStageReport 可以消费。
 *
 * 内部复用 teacher-data-adapter 导出的解析函数：
 *   getStudentAllHistory, getValidHits, getValidAnalysis, getValidStartTime
 * 跳过 getValidConversationState（不限制白名单字段）、sanitizeMessages（不需要原始消息）。
 *
 * @param {object} input
 * @param {string} input.studentId
 * @param {Array} input.users
 * @param {Array} input.history
 * @returns {{ student: object|null, conversations: Array, insights: Array }}
 */
function buildRawStudentReportData(input) {
  if (!isNonArrayObject(input)) {
    return { student: null, conversations: [], insights: [] };
  }

  var studentId = input.studentId;
  var users = isArray(input.users) ? input.users : [];
  var history = isArray(input.history) ? input.history : [];

  if (!isString(studentId) || studentId.trim().length === 0) {
    return { student: null, conversations: [], insights: [] };
  }

  // 需要 teacher-data-adapter 导出的解析函数
  var tda;
  try {
    tda = require('./teacher-data-adapter');
  } catch (_) {
    return { student: null, conversations: [], insights: [] };
  }

  if (typeof tda.getStudentAllHistory !== 'function' ||
      typeof tda.getValidHits !== 'function' ||
      typeof tda.getValidAnalysis !== 'function' ||
      typeof tda.getValidStartTime !== 'function') {
    return { student: null, conversations: [], insights: [] };
  }

  // ---- 1. 查找 student ----
  var studentUser = null;
  for (var ui = 0; ui < users.length; ui++) {
    var u = users[ui];
    if (!isNonArrayObject(u)) continue;
    if (u.id === studentId && u.role === 'student') {
      studentUser = u;
      break;
    }
  }

  if (studentUser === null) {
    return { student: null, conversations: [], insights: [] };
  }

  var safeStudent = {
    id: typeof studentUser.id === 'string' ? studentUser.id : '',
    username: typeof studentUser.username === 'string' ? studentUser.username : '',
    studentCode: (studentUser.studentCode !== null && studentUser.studentCode !== undefined && isString(studentUser.studentCode)) ? studentUser.studentCode : null,
  };

  if (safeStudent.id.length === 0) {
    return { student: null, conversations: [], insights: [] };
  }

  // ---- 2. 获取学生所有历史 ----
  var studentHistory = tda.getStudentAllHistory(history, studentId);

  // ---- 3. 按 startTime 从新到旧排序 ----
  var sorted = studentHistory.slice();
  sorted.sort(function (a, b) {
    var sa = tda.getValidStartTime(a);
    var sb = tda.getValidStartTime(b);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    var da = Date.parse(sa);
    var db = Date.parse(sb);
    if (da === db) return 0;
    return db - da;
  });

  // ---- 4. 构建 conversations 数组 ----
  var conversations = [];
  for (var si = 0; si < sorted.length; si++) {
    var entry = sorted[si];
    if (!isNonArrayObject(entry)) continue;

    // preview — 首条合法 user 消息
    var preview = '';
    var msgs = entry.messages;
    if (isArray(msgs)) {
      for (var mi = 0; mi < msgs.length; mi++) {
        var m = msgs[mi];
        if (!isNonArrayObject(m)) continue;
        if (m.role === 'user' && typeof m.content === 'string') {
          preview = safeTruncate(m.content, 40);
          break;
        }
      }
    }

    var completed = entry.completed !== false;

    // activeTopic / engagement — 直接从 conversationState 读，不走白名单过滤
    var activeTopic = null;
    var engagement = null;
    var cs = entry.conversationState;
    if (isNonArrayObject(cs)) {
      if (typeof cs.active_topic === 'string' && cs.active_topic.trim().length > 0) {
        activeTopic = cs.active_topic.trim();
      }
      if (typeof cs.engagement === 'string') {
        engagement = cs.engagement.trim();
      }
    }

    var hits = tda.getValidHits(entry);
    var dimensionsFound = [];
    for (var di = 0; di < hits.length; di++) {
      var dim = hits[di].dimension;
      if (dim.length > 0 && dimensionsFound.indexOf(dim) < 0) {
        dimensionsFound.push(dim);
      }
    }

    var hasAnalysis = tda.getValidAnalysis(entry) !== null;

    conversations.push({
      id: typeof entry.id === 'string' ? entry.id : '',
      sessionId: typeof entry.sessionId === 'string' ? entry.sessionId : '',
      startTime: tda.getValidStartTime(entry),
      turnCount: safeNum(entry.turnCount),
      completed: completed,
      preview: preview,
      weather: typeof entry.weather === 'string' ? entry.weather : null,
      activeTopic: activeTopic,
      engagement: engagement,
      dimensionsFound: dimensionsFound,
      insightCount: hits.length,
      hasAnalysis: hasAnalysis,
    });
  }

  // ---- 5. 构建 insights 数组 ----
  var insights = [];
  for (var ei = 0; ei < sorted.length; ei++) {
    var e = sorted[ei];
    if (!isNonArrayObject(e)) continue;

    if (tda.getValidAnalysis(e) === null) continue;
    var hits = tda.getValidHits(e);
    if (hits.length === 0) continue;

    var convId = typeof e.id === 'string' ? e.id : '';
    var sessId = typeof e.sessionId === 'string' ? e.sessionId : '';
    var observedAt = tda.getValidStartTime(e);

    // topic — 直接从 conversationState 读
    var topic = null;
    var ecs = e.conversationState;
    if (isNonArrayObject(ecs) && typeof ecs.active_topic === 'string' && ecs.active_topic.trim().length > 0) {
      topic = ecs.active_topic.trim();
    }

    for (var hi = 0; hi < hits.length; hi++) {
      var hit = hits[hi];
      var insightId = 'insight-' + convId + '-' + hi;

      insights.push({
        id: insightId,
        studentId: studentId,
        conversationId: convId,
        sessionId: sessId,
        source: 'conversation_analysis',
        dimension: hit.dimension,
        indicator: hit.indicator,
        signal: hit.signal,
        evidenceSnippet: hit.evidenceSnippet,
        turnLabel: hit.turnLabel,
        strengthNote: hit.strengthNote,
        topic: topic,
        confidence: 'candidate',
        observedAt: observedAt,
        reviewStatus: 'unreviewed',
      });
    }
  }

  return { student: safeStudent, conversations: conversations, insights: insights };
}

// ============================================================
//  导出
// ============================================================

// ============================================================
//  导出 8: latestModuleConfirmNeedsRefresh
// ============================================================

/**
 * 检查指定模块的最后一次 confirm 记录是否因数据变化而需要刷新。
 * 用于前端判断"已确认"状态是否仍然有效。
 *
 * @param {object|null} record — store.findByStudentIdAndRange 的返回值
 * @param {string} moduleName — 模块名
 * @param {object} currentDigest — { conversationCount, totalTurns, insightCount, conversationIds }
 * @returns {boolean} — true 表示需要重新确认（数据已变化或从未确认）
 */
function latestModuleConfirmNeedsRefresh(record, moduleName, currentDigest) {
  if (!isNonArrayObject(record)) return true; // 无记录 → 需要确认
  if (!isNonArrayObject(currentDigest)) return true;

  var edits = record.moduleEdits;
  if (!isArray(edits) || edits.length === 0) return true; // 无编辑记录 → 需要确认

  // 从数组末尾向前找最后一条 action=confirm 的同模块记录
  var lastConfirm = null;
  for (var ei = edits.length - 1; ei >= 0; ei--) {
    var me = edits[ei];
    if (!isNonArrayObject(me)) continue;
    if (safeGetOwnString(me, 'module', '') !== moduleName) continue;
    if (safeGetOwnString(me, 'action', '') !== 'confirm') continue;
    lastConfirm = me;
    break;
  }

  if (!lastConfirm) return true; // 从未 confirm → 需要确认

  // 比较 inputDigest
  var lastDigest = lastConfirm.inputDigest;
  if (!isNonArrayObject(lastDigest)) return true; // 无快照 → 保守起见触发

  if (lastDigest.insightCount !== currentDigest.insightCount) return true;
  if (lastDigest.conversationCount !== currentDigest.conversationCount) return true;

  var lastIds = isArray(lastDigest.conversationIds) ? lastDigest.conversationIds : [];
  var currIds = isArray(currentDigest.conversationIds) ? currentDigest.conversationIds : [];
  if (lastIds.length !== currIds.length) return true;

  var lastSet = Object.create(null);
  for (var li = 0; li < lastIds.length; li++) {
    if (isString(lastIds[li])) lastSet[lastIds[li]] = true;
  }
  for (var ci = 0; ci < currIds.length; ci++) {
    if (isString(currIds[ci]) && !hop.call(lastSet, currIds[ci])) return true;
  }

  return false;
}

module.exports = {
  buildNarrativePromptInput: buildNarrativePromptInput,
  resolveEffectiveModules: resolveEffectiveModules,
  resolveEffectiveNarrative: resolveEffectiveNarrative,
  parseAiNarrativeJson: parseAiNarrativeJson,
  getLatestModuleEdit: getLatestModuleEdit,
  hasDataChangedSinceLastAiVersion: hasDataChangedSinceLastAiVersion,
  latestModuleConfirmNeedsRefresh: latestModuleConfirmNeedsRefresh,
  buildRawStudentReportData: buildRawStudentReportData,
  KNOWN_MODULES: KNOWN_MODULES,
};
