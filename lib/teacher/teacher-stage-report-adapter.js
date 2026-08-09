/**
 * teacher-stage-report-adapter.js — 教师阶段性观察报告纯函数适配器
 *
 * 纯函数模块。不读写文件、不访问网络、不调用模型、不依赖 Express。
 * 不修改任何输入参数。
 * 不使用 Date.now()、Math.random()。
 *
 * 导出：
 *   validateReportRange(input)
 *   buildTeacherStageReport(input)
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

var VALID_RANGES = ['7d', '30d', 'all'];

// ============================================================
//  导出 1: validateReportRange
// ============================================================

/**
 * 验证报告时间范围参数。
 *
 * @param {*} input
 * @returns {{ ok: boolean, error: string|null, value: string|null }}
 */
function validateReportRange(input) {
  if (!isString(input)) {
    return { ok: false, error: 'INVALID_REPORT_RANGE', value: null };
  }
  var trimmed = input.trim();
  if (VALID_RANGES.indexOf(trimmed) < 0) {
    return { ok: false, error: 'INVALID_REPORT_RANGE', value: null };
  }
  return { ok: true, error: null, value: trimmed };
}

// ============================================================
//  导出 2: buildTeacherStageReport
// ============================================================

/**
 * 构建学生阶段性观察报告。
 *
 * @param {object} input
 * @param {object} input.student — SafeStudent { id, username, studentCode }
 * @param {Array} input.conversations — 来自 buildStudentConversationSummaries
 * @param {Array} input.insights — 已合并当前教师 Review 的 MergedTalentInsight[]
 * @param {string} input.range — '7d' | '30d' | 'all'
 * @param {number} input.now — 调用方提供的毫秒时间戳
 * @returns {{ ok: boolean, error: string|null, report: object|null }}
 */
function buildTeacherStageReport(input) {
  if (!isNonArrayObject(input)) {
    return { ok: false, error: 'INVALID_INPUT', report: null };
  }

  // ---- 验证 range ----
  var range = input.range;
  var rangeResult = validateReportRange(range);
  if (!rangeResult.ok) {
    return { ok: false, error: rangeResult.error, report: null };
  }
  range = rangeResult.value;

  // ---- 验证 now ----
  var now = input.now;
  if (typeof now !== 'number' || !isFinite(now) || now < 0) {
    return { ok: false, error: 'INVALID_REPORT_NOW', report: null };
  }

  // ---- 安全获取输入 ----
  var student = input.student;
  var conversations = input.conversations;
  var insights = input.insights;
  var narrativeText = input.narrativeText; // 可选：AI 生成的叙述文本，仅 range=all

  if (!isNonArrayObject(student)) {
    return { ok: false, error: 'INVALID_STUDENT', report: null };
  }
  if (!isArray(conversations)) conversations = [];
  if (!isArray(insights)) insights = [];

  // ---- 时间范围 ----
  var cutoffMs;
  if (range === '7d') {
    cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
  } else if (range === '30d') {
    cutoffMs = now - 30 * 24 * 60 * 60 * 1000;
  } else {
    // all
    cutoffMs = null;
  }

  // ---- 过滤 conversations ----
  var includedConvs = [];
  var excludedByRangeCount = 0;
  var excludedInvalidDateCount = 0;
  var includedConvIds = Object.create(null);

  for (var ci = 0; ci < conversations.length; ci++) {
    var conv = conversations[ci];
    if (!isNonArrayObject(conv)) continue;

    var convId = safeGetOwnString(conv, 'id', '');
    if (convId.length === 0) continue;

    if (cutoffMs !== null) {
      // 7d / 30d：严格日期过滤
      var startTime = safeGetOwnString(conv, 'startTime', '');
      var ts;
      try { ts = Date.parse(startTime); } catch (_) { ts = NaN; }

      if (startTime.length === 0 || isNaN(ts)) {
        excludedInvalidDateCount++;
        continue;
      }
      if (ts < cutoffMs) {
        excludedByRangeCount++;
        continue;
      }
      if (ts > now) {
        // 未来日期
        excludedInvalidDateCount++;
        continue;
      }
    } else {
      // all：纳入所有合法对话对象
      // 但仍统计日期无效的条目数量
      var allStartTime = safeGetOwnString(conv, 'startTime', '');
      var allTs;
      try { allTs = Date.parse(allStartTime); } catch (_) { allTs = NaN; }
      if (allStartTime.length === 0 || isNaN(allTs)) {
        excludedInvalidDateCount++;
      }
    }

    includedConvs.push(conv);
    includedConvIds[convId] = true;
  }

  // ---- period ----
  var fromDate = null;
  var toDate = null;

  if (cutoffMs !== null) {
    fromDate = new Date(cutoffMs).toISOString();
    toDate = new Date(now).toISOString();
  } else {
    // all: fromDate/toDate 来自范围内最早和最晚合法 startTime
    for (var pi = 0; pi < includedConvs.length; pi++) {
      var st = safeGetOwnString(includedConvs[pi], 'startTime', '');
      if (st.length === 0) continue;
      var pts;
      try { pts = Date.parse(st); } catch (_) { pts = NaN; }
      if (isNaN(pts)) continue;
      if (fromDate === null || pts < Date.parse(fromDate)) fromDate = st;
      if (toDate === null || pts > Date.parse(toDate)) toDate = st;
    }
  }

  // ---- 计数 conversations 的 analysis / topic ----
  var totalConvCount = isArray(conversations) ? conversations.length : 0;
  var conversationsWithAnalysis = 0;
  var conversationsWithoutAnalysis = 0;
  var conversationsWithTopic = 0;
  var conversationsWithoutTopic = 0;

  for (var ai = 0; ai < includedConvs.length; ai++) {
    var ac = includedConvs[ai];
    if (ac.hasAnalysis === true) {
      conversationsWithAnalysis++;
    } else {
      conversationsWithoutAnalysis++;
    }
    var at = safeGetOwnString(ac, 'activeTopic', '');
    if (at.length > 0) {
      conversationsWithTopic++;
    } else {
      conversationsWithoutTopic++;
    }
  }

  // ---- 过滤 insights ----
  var includedInsights = [];
  var excludedInsightIds = [];

  for (var ii = 0; ii < insights.length; ii++) {
    var ins = insights[ii];
    if (!isNonArrayObject(ins)) continue;

    var insConvId = safeGetOwnString(ins, 'conversationId', '');
    if (insConvId.length === 0) {
      excludedInsightIds.push(safeGetOwnString(ins, 'id', ''));
      continue;
    }

    if (!hop.call(includedConvIds, insConvId)) {
      excludedInsightIds.push(safeGetOwnString(ins, 'id', ''));
      continue;
    }

    includedInsights.push(ins);
  }

  // ---- coverage ----
  var insightsWithEvidence = 0;
  var insightsWithoutEvidence = 0;
  for (var ei = 0; ei < includedInsights.length; ei++) {
    var ev = safeGetOwnString(includedInsights[ei], 'evidenceSnippet', '');
    if (ev.length > 0) {
      insightsWithEvidence++;
    } else {
      insightsWithoutEvidence++;
    }
  }

  var coverage = {
    totalConversationCount: totalConvCount,
    includedConversationCount: includedConvs.length,
    excludedByRangeCount: excludedByRangeCount,
    excludedInvalidDateCount: excludedInvalidDateCount,
    conversationsWithAnalysis: conversationsWithAnalysis,
    conversationsWithoutAnalysis: conversationsWithoutAnalysis,
    conversationsWithTopic: conversationsWithTopic,
    conversationsWithoutTopic: conversationsWithoutTopic,
    totalInsightCount: isArray(insights) ? insights.length : 0,
    includedInsightCount: includedInsights.length,
    insightsWithEvidence: insightsWithEvidence,
    insightsWithoutEvidence: insightsWithoutEvidence,
  };

  // ---- summary ----
  var conversationCount = includedConvs.length;
  var totalTurns = 0;
  var firstSeen = null;
  var lastActive = null;
  var confirmedCount = 0;
  var rejectedCount = 0;
  var unreviewedCount = 0;
  var weakSignalCount = 0;
  var dimSet = Object.create(null);
  var indSet = Object.create(null);

  for (var si = 0; si < includedConvs.length; si++) {
    var sc = includedConvs[si];
    var st2 = safeGetOwnString(sc, 'startTime', '');
    // turnCount
    var tc = sc.turnCount;
    if (typeof tc === 'number' && isFinite(tc) && tc >= 0) {
      totalTurns += tc;
    }
    // firstSeen / lastActive
    if (st2.length > 0) {
      var st2ts;
      try { st2ts = Date.parse(st2); } catch (_) { st2ts = NaN; }
      if (!isNaN(st2ts)) {
        if (firstSeen === null || st2ts < Date.parse(firstSeen)) firstSeen = st2;
        if (lastActive === null || st2ts > Date.parse(lastActive)) lastActive = st2;
      }
    }
  }

  // Review 状态和维度/指标计数（只用正向非 rejected）
  for (var ri = 0; ri < includedInsights.length; ri++) {
    var riIns = includedInsights[ri];
    var rs = safeGetOwnString(riIns, 'reviewStatus', 'unreviewed');
    if (rs === 'teacher_confirmed') {
      confirmedCount++;
    } else if (rs === 'rejected') {
      rejectedCount++;
    } else {
      unreviewedCount++;
    }

    if (riIns.isWeakSignal === true) {
      weakSignalCount++;
    }

    // dimension/indicator 只对非 rejected 且非 weakSignal
    if (rs !== 'rejected' && riIns.isWeakSignal !== true) {
      var d = safeGetOwnString(riIns, 'dimension', '');
      var ind = safeGetOwnString(riIns, 'indicator', '');
      if (d.length > 0) dimSet[d] = true;
      if (ind.length > 0) indSet[ind] = true;
    }
  }

  // ---- 信号质量统计 ----
  var lowQualityConversationCount = 0;
  var lowQualityInsightCount = 0;
  var lowQualityConvSet = Object.create(null);
  for (var sqi = 0; sqi < includedInsights.length; sqi++) {
    var sqIns = includedInsights[sqi];
    if (safeGetOwnString(sqIns, 'signalQuality', 'normal') === 'low') {
      lowQualityInsightCount++;
      var sqCid = safeGetOwnString(sqIns, 'conversationId', '');
      if (sqCid.length > 0 && !hop.call(lowQualityConvSet, sqCid)) {
        lowQualityConvSet[sqCid] = true;
        lowQualityConversationCount++;
      }
    }
  }

  var summary = {
    conversationCount: conversationCount,
    totalTurns: totalTurns,
    firstSeen: firstSeen,
    lastActive: lastActive,
    insightCount: includedInsights.length,
    confirmedCount: confirmedCount,
    rejectedCount: rejectedCount,
    weakSignalCount: weakSignalCount,
    unreviewedCount: unreviewedCount,
    dimensionCount: Object.keys(dimSet).length,
    indicatorCount: Object.keys(indSet).length,
    lowQualityConversationCount: lowQualityConversationCount,
    lowQualityInsightCount: lowQualityInsightCount,
  };

  // ---- topics ----
  var topicMap = Object.create(null);
  var topicFirstSeen = Object.create(null);
  var topicOrder = [];

  for (var ti = 0; ti < includedConvs.length; ti++) {
    var tc2 = includedConvs[ti];
    var topic = safeGetOwnString(tc2, 'activeTopic', '');
    if (topic.length === 0) continue;

    if (!hop.call(topicMap, topic)) {
      topicMap[topic] = { topic: topic, count: 0, conversationIds: Object.create(null) };
      topicFirstSeen[topic] = topicOrder.length;
      topicOrder.push(topic);
    }
    var tEntry = topicMap[topic];

    var cid = safeGetOwnString(tc2, 'id', '');
    if (cid.length > 0 && !hop.call(tEntry.conversationIds, cid)) {
      tEntry.conversationIds[cid] = true;
      tEntry.count++;
    }
  }

  var topics = [];
  for (var tii = 0; tii < topicOrder.length; tii++) {
    var tName = topicOrder[tii];
    var tE = topicMap[tName];
    topics.push({
      topic: tName,
      count: tE.count,
      conversationIds: Object.keys(tE.conversationIds),
    });
  }
  // 排序：count 降序，首次出现顺序
  topics.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return topicFirstSeen[a.topic] - topicFirstSeen[b.topic];
  });

  // ---- dimensions (非 rejected) ----
  var dimMap = Object.create(null);
  var dimFirstSeen = Object.create(null);
  var dimOrder = [];

  for (var di = 0; di < includedInsights.length; di++) {
    var diIns = includedInsights[di];
    var drs = safeGetOwnString(diIns, 'reviewStatus', 'unreviewed');
    if (drs === 'rejected') continue;
    if (diIns.isWeakSignal === true) continue; // weakSignal 不参与

    var dim = safeGetOwnString(diIns, 'dimension', '');
    if (dim.length === 0) continue;

    if (!hop.call(dimMap, dim)) {
      dimMap[dim] = { dimension: dim, count: 0, distinctConversationIds: Object.create(null), indicators: Object.create(null) };
      dimFirstSeen[dim] = dimOrder.length;
      dimOrder.push(dim);
    }
    var dEntry = dimMap[dim];
    dEntry.count++;
    var dcid = safeGetOwnString(diIns, 'conversationId', '');
    if (dcid.length > 0) dEntry.distinctConversationIds[dcid] = true;

    var indicator = safeGetOwnString(diIns, 'indicator', '');
    if (indicator.length > 0) {
      if (!hop.call(dEntry.indicators, indicator)) {
        dEntry.indicators[indicator] = { indicator: indicator, count: 0, distinctConversationIds: Object.create(null) };
      }
      var iEntry = dEntry.indicators[indicator];
      iEntry.count++;
      if (dcid.length > 0) iEntry.distinctConversationIds[dcid] = true;
    }
  }

  var dimensions = [];
  for (var ddi = 0; ddi < dimOrder.length; ddi++) {
    var dName = dimOrder[ddi];
    var dE = dimMap[dName];
    var indList = [];
    var indNames = Object.keys(dE.indicators);
    for (var ini = 0; ini < indNames.length; ini++) {
      var inName = indNames[ini];
      var iE = dE.indicators[inName];
      indList.push({
        indicator: inName,
        count: iE.count,
        distinctConversationCount: Object.keys(iE.distinctConversationIds).length,
      });
    }
    // indicators 排序：count 降序
    indList.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      // tie: 按首次出现（此处保留 map key 顺序）
      return 0;
    });

    dimensions.push({
      dimension: dName,
      count: dE.count,
      distinctConversationCount: Object.keys(dE.distinctConversationIds).length,
      indicators: indList,
    });
  }
  // 排序：count 降序
  dimensions.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return dimFirstSeen[a.dimension] - dimFirstSeen[b.dimension];
  });

  // ---- recurringSignals: dimension + indicator ----
  var signalMap = Object.create(null);
  var signalKeys = [];

  for (var sgi = 0; sgi < includedInsights.length; sgi++) {
    var sgIns = includedInsights[sgi];
    var sgRs = safeGetOwnString(sgIns, 'reviewStatus', 'unreviewed');
    if (sgRs === 'rejected') continue; // rejected 不参与
    if (sgIns.isWeakSignal === true) continue; // weakSignal 不参与

    var sgDim = safeGetOwnString(sgIns, 'dimension', '');
    var sgInd = safeGetOwnString(sgIns, 'indicator', '');
    if (sgDim.length === 0 || sgInd.length === 0) continue; // 两者都必须非空

    var sgKey = sgDim + '|||' + sgInd;

    if (!hop.call(signalMap, sgKey)) {
      signalMap[sgKey] = {
        dimension: sgDim,
        indicator: sgInd,
        occurrenceCount: 0,
        distinctConversationIds: Object.create(null),
        confirmedOccurrenceCount: 0,
        unreviewedOccurrenceCount: 0,
        topicSet: Object.create(null),
        evidence: [],
        _firstIndex: sgi, // 用于稳定排序
      };
      signalKeys.push(sgKey);
    }

    var sgEntry = signalMap[sgKey];
    sgEntry.occurrenceCount++;

    var sgCid = safeGetOwnString(sgIns, 'conversationId', '');
    if (sgCid.length > 0) sgEntry.distinctConversationIds[sgCid] = true;

    if (sgRs === 'teacher_confirmed') {
      sgEntry.confirmedOccurrenceCount++;
    } else {
      sgEntry.unreviewedOccurrenceCount++;
    }

    var sgTopic = sgIns.topic;
    if (sgTopic !== null && isString(sgTopic) && sgTopic.trim().length > 0) {
      sgEntry.topicSet[sgTopic.trim()] = true;
    }

    sgEntry.evidence.push({
      insightId: safeGetOwnString(sgIns, 'id', ''),
      conversationId: sgCid,
      topic: (sgIns.topic !== null && isString(sgIns.topic)) ? sgIns.topic : null,
      observedAt: sgIns.observedAt !== null && isString(sgIns.observedAt) ? sgIns.observedAt : null,
      signal: safeGetOwnString(sgIns, 'signal', ''),
      evidenceSnippet: safeGetOwnString(sgIns, 'evidenceSnippet', ''),
      strengthNote: safeGetOwnString(sgIns, 'strengthNote', ''),
      reviewStatus: sgRs,
      teacherNote: (sgIns.teacherNote && isString(sgIns.teacherNote) && sgIns.teacherNote.length > 0) ? sgIns.teacherNote : null,
    });
  }

  // keep all signals with at least 1 conversation occurrence
  var recurringSignals = [];
  for (var rsi = 0; rsi < signalKeys.length; rsi++) {
    var rk = signalKeys[rsi];
    var re = signalMap[rk];
    var distinctConv = Object.keys(re.distinctConversationIds).length;

    if (distinctConv < 1) continue;

    recurringSignals.push({
      dimension: re.dimension,
      indicator: re.indicator,
      occurrenceCount: re.occurrenceCount,
      distinctConversationCount: distinctConv,
      status: distinctConv >= 2 ? 'multiple_conversations' : 'single_conversation',
      confirmedOccurrenceCount: re.confirmedOccurrenceCount,
      unreviewedOccurrenceCount: re.unreviewedOccurrenceCount,
      topics: Object.keys(re.topicSet),
      evidence: re.evidence,
    });
  }
  // 排序：distinctConversationCount 降序，再 occurrenceCount 降序，再首次出现
  recurringSignals.sort(function (a, b) {
    if (b.distinctConversationCount !== a.distinctConversationCount) return b.distinctConversationCount - a.distinctConversationCount;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    return signalMap[a.dimension + '|||' + a.indicator]._firstIndex -
           signalMap[b.dimension + '|||' + b.indicator]._firstIndex;
  });

  // ---- Review 分类 ----
  var confirmedInsights = [];
  var candidateInsights = [];
  var rejectedInsightsList = [];
  var weakSignalsList = [];

  for (var cli = 0; cli < includedInsights.length; cli++) {
    var clIns = includedInsights[cli];
    var clRs = safeGetOwnString(clIns, 'reviewStatus', 'unreviewed');

    var clCopy = {
      id: safeGetOwnString(clIns, 'id', ''),
      studentId: safeGetOwnString(clIns, 'studentId', ''),
      conversationId: safeGetOwnString(clIns, 'conversationId', ''),
      sessionId: safeGetOwnString(clIns, 'sessionId', ''),
      source: safeGetOwnString(clIns, 'source', ''),
      dimension: safeGetOwnString(clIns, 'dimension', ''),
      indicator: safeGetOwnString(clIns, 'indicator', ''),
      signal: safeGetOwnString(clIns, 'signal', ''),
      evidenceSnippet: safeGetOwnString(clIns, 'evidenceSnippet', ''),
      turnLabel: safeGetOwnString(clIns, 'turnLabel', ''),
      strengthNote: safeGetOwnString(clIns, 'strengthNote', ''),
      topic: (clIns.topic !== null && isString(clIns.topic)) ? clIns.topic : null,
      confidence: safeGetOwnString(clIns, 'confidence', 'candidate'),
      observedAt: (clIns.observedAt !== null && isString(clIns.observedAt)) ? clIns.observedAt : null,
      reviewStatus: clRs,
      teacherNote: (clIns.teacherNote && isString(clIns.teacherNote) && clIns.teacherNote.length > 0) ? clIns.teacherNote : null,
      reviewedAt: (clIns.reviewedAt && isString(clIns.reviewedAt)) ? clIns.reviewedAt : null,
      reviewUpdatedAt: (clIns.reviewUpdatedAt && isString(clIns.reviewUpdatedAt)) ? clIns.reviewUpdatedAt : null,
      isWeakSignal: clIns.isWeakSignal === true,
    };

    if (clIns.isWeakSignal === true) {
      weakSignalsList.push(clCopy);
    }

    if (clRs === 'teacher_confirmed') {
      confirmedInsights.push(clCopy);
    } else if (clRs === 'rejected') {
      rejectedInsightsList.push(clCopy);
    } else {
      candidateInsights.push(clCopy);
    }
  }

  // ---- engagement ----
  var engagement = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (var engi = 0; engi < includedConvs.length; engi++) {
    var ec = includedConvs[engi];
    var eng = safeGetOwnString(ec, 'engagement', '');
    if (eng === 'high' || eng === 'medium' || eng === 'low') {
      engagement[eng]++;
    } else {
      engagement.unknown++;
    }
  }

  // ---- narrativeSummary ----
  // range=all 且有 AI 生成文本时优先使用，7d/30d 或无 AI 文本时回退模板
  var narrativeSummary;
  if (range === 'all' && isString(narrativeText) && narrativeText.trim().length > 0) {
    narrativeSummary = narrativeText;
  } else {
    narrativeSummary = buildNarrativeSummary(summary, topics, coverage);
  }

  // ---- safety alerts ----
  var safetyAlerts = [];
  for (var sai = 0; sai < includedConvs.length; sai++) {
    var sc = includedConvs[sai];
    if (sc.hasSafetyAlert === true) {
      safetyAlerts.push({
        conversationId: safeGetOwnString(sc, 'id', ''),
        activeTopic: safeGetOwnString(sc, 'activeTopic', ''),
        safetyNote: safeGetOwnString(sc, 'safetyNote', ''),
        startTime: safeGetOwnString(sc, 'startTime', ''),
      });
    }
  }

  // ---- limitations ----
  var limitations = buildLimitations(coverage, summary);

  // ---- 安全 student ----
  var safeStudent = {
    id: safeGetOwnString(student, 'id', ''),
    username: safeGetOwnString(student, 'username', ''),
    studentCode: (student.studentCode !== null && student.studentCode !== undefined && isString(student.studentCode)) ? student.studentCode : null,
  };

  return {
    ok: true,
    error: null,
    report: {
      student: safeStudent,
      period: {
        range: range,
        fromDate: fromDate,
        toDate: toDate,
      },
      coverage: coverage,
      summary: summary,
      topics: topics,
      dimensions: dimensions,
      recurringSignals: recurringSignals,
      confirmedInsights: confirmedInsights,
      candidateInsights: candidateInsights,
      rejectedInsights: rejectedInsightsList,
      weakSignals: weakSignalsList,
      engagement: engagement,
      narrativeSummary: narrativeSummary,
      safety: safetyAlerts,
      limitations: limitations,
    },
  };
}

// ============================================================
//  narrativeSummary 模板生成
// ============================================================

var PROHIBITED_WORDS = [
  '擅长', '优秀', '天赋突出', '能力出众', '潜力巨大',
  '明显优于', '确定拥有', '能力等级', '适合从事', '建议筛选',
];

function hasProhibitedWord(text) {
  for (var i = 0; i < PROHIBITED_WORDS.length; i++) {
    if (text.indexOf(PROHIBITED_WORDS[i]) >= 0) return true;
  }
  return false;
}

function buildNarrativeSummary(summary, topics, coverage) {
  if (summary.conversationCount === 0) {
    return '该时间范围内没有可纳入报告的对话记录。';
  }

  var parts = [];

  // 对话次数和轮次
  var convWord = summary.conversationCount === 1 ? '1次对话' : summary.conversationCount + '次对话';
  if (summary.totalTurns > 0) {
    parts.push('在报告周期内，该学生进行了' + convWord + '，累计' + summary.totalTurns + '轮。');
  } else {
    parts.push('在报告周期内，该学生进行了' + convWord + '。');
  }

  // 兴趣话题
  if (topics.length > 0) {
    var topicNames = [];
    for (var ti = 0; ti < topics.length; ti++) {
      topicNames.push(topics[ti].topic);
    }
    parts.push('较常谈到：' + topicNames.join('、') + '。');
  }

  // 线索
  if (summary.insightCount > 0) {
    var cluePart = '当前记录到' + summary.insightCount + '条初步观察线索';
    if (summary.dimensionCount > 0) {
      cluePart += '，涉及' + summary.dimensionCount + '个观察维度';
    }
    cluePart += '。';

    // 确认 / 驳回 / 待观察
    var statusParts = [];
    if (summary.confirmedCount > 0) {
      statusParts.push(summary.confirmedCount + '条已被你确认');
    }
    if (summary.rejectedCount > 0) {
      statusParts.push(summary.rejectedCount + '条你认为不准确');
    }
    if (summary.unreviewedCount > 0) {
      statusParts.push('其余' + summary.unreviewedCount + '条仍待后续观察');
    }
    if (statusParts.length > 0) {
      cluePart += '其中' + statusParts.join('，') + '。';
    }

    parts.push(cluePart);
  }

  var result = parts.join('');
  // 安全检查：不应包含禁止词汇
  if (hasProhibitedWord(result)) {
    return '在报告周期内，该学生进行了' + (summary.conversationCount === 1 ? '1次对话' : summary.conversationCount + '次对话') + '。';
  }
  return result;
}

// ============================================================
//  limitations 生成
// ============================================================

function buildLimitations(coverage, summary) {
  var items = [];

  if (coverage.conversationsWithoutAnalysis > 0) {
    items.push('部分对话尚未生成分析结果。');
  }
  if (coverage.conversationsWithoutTopic > 0) {
    items.push('部分对话未记录明确话题。');
  }
  if (coverage.insightsWithoutEvidence > 0) {
    items.push('部分观察线索暂无可展示的原始证据。');
  }

  // 固定项
  items.push('以上内容仅为阶段性观察，不构成正式诊断。');
  items.push('兴趣话题不等同于能力。');
  items.push('同一指标在多个对话中出现也不代表已经得到科学验证。');
  items.push('教师确认仅代表当前教师的人工判断。');

  return items;
}

// ============================================================
//  导出
// ============================================================

module.exports = {
  validateReportRange: validateReportRange,
  buildTeacherStageReport: buildTeacherStageReport,
};
