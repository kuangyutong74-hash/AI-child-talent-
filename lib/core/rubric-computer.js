/**
 * lib/rubric-computer.js — 维度/指标等级计算（重构版 v2.0）
 *
 * 不读写文件、不访问网络、不调用模型、不依赖 Express。
 * 不修改任何输入参数。
 *
 * 导出：
 *   DIM_CONFIG, DIM_INDICATORS, PATTERN_DIRECTION
 *   computeRubric(insights, options)
 */

'use strict';

var hop = Object.prototype.hasOwnProperty;

// ============================================================
//  维度/指标常量
// ============================================================

var DIM_CONFIG = [
  { key: '语言表达', label: '语言表达', icon: '🗣', cls: 'blue', order: 0 },
  { key: '兴趣方向', label: '兴趣方向', icon: '🍀', cls: 'green', order: 1 },
  { key: '内省倾向', label: '内省倾向', icon: '◉', cls: 'orange', order: 2 },
  { key: '思维方式', label: '思维方式', icon: '✦', cls: 'purple', order: 3 },
];

var DIM_INDICATORS = {
  '语言表达': ['叙事组织能力', '词汇丰富度与用词选择'],
  '兴趣方向': ['主动话题倾向', '兴趣深度vs广度'],
  '内省倾向': ['自我反思频率', '价值判断表达'],
  '思维方式': ['追问下的应变'],
};

var PATTERN_DIRECTION = {
  '叙事组织能力':     { positive: ['时间顺序', '因果衔接', '背景补充'], negative: ['片段化表达'] },
  '词汇丰富度与用词选择': { positive: ['具体描写', '比喻类比', '个性化用词'], negative: ['笼统表达'] },
  '主动话题倾向':     { positive: ['主动引出', '跨会话重访', '话题转向'], negative: ['被动跟随'] },
  '兴趣深度vs广度':   { positive: ['深度展开', '广度试探', '混合'], negative: ['参与度较低'] },
  '自我反思频率':     { positive: ['情绪觉察', '动机说明', '事后评价'], negative: ['仅陈述事件'] },
  '价值判断表达':     { positive: ['结论+理由', '喜好标准', '评价依据'], negative: ['只有结论'] },
  '追问下的应变':     { positive: ['新增事实', '调整角度', '换例说明'], negative: ['简单重复或回避'] },
};

// ============================================================
//  辅助
// ============================================================

function isNonArrayObject(val) {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function isString(val) {
  return typeof val === 'string';
}

// ============================================================
//  北京时间工具函数
// ============================================================

/**
 * ISO 字符串 → 北京时间 "YYYY-MM-DD"。
 * 不使用 toISOString().slice(0,10)（UTC 切的在北京时间晚间会跨界）。
 *
 * @param {string} isoStr — 可被 Date.parse 解析的 ISO 字符串
 * @returns {string|null} "YYYY-MM-DD" 或 null（解析失败）
 */
function toBeijingDate(isoStr) {
  if (!isString(isoStr)) return null;
  var ts = Date.parse(isoStr);
  if (isNaN(ts)) return null;
  // 转为北京时间 (UTC+8)，加 8 小时偏移
  var d = new Date(ts + 8 * 3600000);
  var y = d.getUTCFullYear();
  var m = d.getUTCMonth() + 1;
  var day = d.getUTCDate();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

/**
 * "YYYY-MM-DD" → 当天北京时间 00:00:00 的毫秒时间戳。
 * 注意：北京时间 00:00 对应 UTC 前一天的 16:00。
 *
 * @param {string} yyyy_mm_dd
 * @returns {number|null}
 */
function beijingDateToMs(yyyy_mm_dd) {
  if (typeof yyyy_mm_dd !== 'string') return null;
  var parts = yyyy_mm_dd.split('-');
  if (parts.length !== 3) return null;
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var day = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(day)) return null;
  // 北京时间当天 00:00:00 = UTC 前一天 16:00:00
  return Date.UTC(y, m - 1, day, -8, 0, 0);  // -8小时 = 北京时间00:00对应UTC
}

/**
 * 返回正整数天数，向下取整。
 * @param {string} dateA "YYYY-MM-DD"
 * @param {number} nowMs 当前毫秒时间戳
 * @returns {number|null}
 */
function daysAgo(dateA, nowMs) {
  var ms = beijingDateToMs(dateA);
  if (ms === null) return null;
  return Math.floor((nowMs - ms) / 86400000);
}

// ============================================================
//  computeRubric
// ============================================================

/**
 * 从 insight 数组计算维度/指标级别的评级数据。
 *
 * @param {Array} insights — TalentInsight 数组（已合并 review 状态）
 * @param {object} [options]
 * @param {number} options.now — 当前毫秒时间戳（必填）
 * @param {number} [options.windowDays=90] — 只统计最近多少天内的证据
 * @param {number} [options.freshnessDays=30] — 新鲜度窗口，"近期"的天数
 * @returns {{ rubricVersion: string, dimensions: object, indicators: object }}
 */
function computeRubric(insights, options) {
  if (!Array.isArray(insights)) insights = [];

  var opts = isNonArrayObject(options) ? options : {};
  var now = typeof opts.now === 'number' && isFinite(opts.now) && opts.now > 0
    ? opts.now : Date.now();
  var windowDays = typeof opts.windowDays === 'number' && isFinite(opts.windowDays) && opts.windowDays > 0
    ? Math.floor(opts.windowDays) : 90;
  var freshnessDays = typeof opts.freshnessDays === 'number' && isFinite(opts.freshnessDays) && opts.freshnessDays > 0
    ? Math.floor(opts.freshnessDays) : 30;

  var windowCutoffMs = now - windowDays * 86400000;

  var result = { rubricVersion: 'v2.0', dimensions: {}, indicators: {} };

  // ==========================================================
  //  Step 1: 过滤
  //  ==========================================================
  //  排除条件（任一为真即排除）：
  //    - reviewStatus === 'rejected' 或 'marked_inaccurate'
  //    - strength === 'weak'（不再要求 wasPrompted）
  //    - observedAt 为 null 或无法解析为合法日期
  //    - observedAt 早于 windowCutoffMs（超出时间窗口）

  function isAcceptable(ins) {
    if (!isNonArrayObject(ins)) return false;
    var reviewStatus = ins.reviewStatus;
    if (reviewStatus === 'rejected' || reviewStatus === 'marked_inaccurate') return false;
    if (ins.strength === 'weak') return false;
    var obs = ins.observedAt;
    if (!isString(obs)) return false;
    var beijingDate = toBeijingDate(obs);
    if (beijingDate === null) return false;
    var obsMs = Date.parse(obs);
    if (isNaN(obsMs)) return false;
    if (obsMs < windowCutoffMs) return false;
    return true;
  }

  // ==========================================================
  //  对每个 (dimension, indicator) 组合执行 Step 2-6
  //  ==========================================================

  // 先按 (dimension, indicator) 分组收集可接受证据
  var groupedByIndicator = {}; // key: "dimension|indicator" → [{ins, beijingDate}]

  for (var si = 0; si < insights.length; si++) {
    var ins = insights[si];
    if (!isAcceptable(ins)) continue;
    var dim = ins.dimension;
    var ind = ins.indicator;
    if (!isString(dim) || dim.length === 0) continue;
    if (!isString(ind) || ind.length === 0) continue;

    var gkey = dim + '|' + ind;
    if (!hop.call(groupedByIndicator, gkey)) {
      groupedByIndicator[gkey] = [];
    }
    groupedByIndicator[gkey].push({
      ins: ins,
      beijingDate: toBeijingDate(ins.observedAt),
    });
  }

  for (var dimKey in DIM_INDICATORS) {
    if (!hop.call(DIM_INDICATORS, dimKey)) continue;
    var indNames = DIM_INDICATORS[dimKey];
    var totalIndicators = indNames.length;
    var sumLevel = 0;
    var determinedCount = 0;
    var dimEvidenceCount = 0;
    var dimConfirmedCount = 0;
    var dimConvSet = {};
    var dimHasData = false;  // hasData: positiveDayCount + negativeDayCount + neutralDayCount > 0 至少一个指标满足

    for (var ii = 0; ii < indNames.length; ii++) {
      var indName = indNames[ii];
      var gkey = dimKey + '|' + indName;
      var items = groupedByIndicator[gkey] || [];

      // ======================================================
      //  Step 2: 按自然日分组（北京时间）
      //  ======================================================
      var dayGroups = {}; // { "YYYY-MM-DD": [item, ...] }
      for (var gi = 0; gi < items.length; gi++) {
        var bjDate = items[gi].beijingDate;
        if (!hop.call(dayGroups, bjDate)) {
          dayGroups[bjDate] = [];
        }
        dayGroups[bjDate].push(items[gi]);
      }

      // ======================================================
      //  Step 3: 方向判断 — 每天归入 pos/neg/neutral
      //  ======================================================
      var dirMap = PATTERN_DIRECTION[indName] || null;
      var positiveDaySet = {};  // { "YYYY-MM-DD": true }
      var negativeDaySet = {};
      var neutralDaySet = {};
      var patternUnknownCount = 0;
      var posConvSet = {};     // backward-compat: conversation-level positive
      var negConvSet = {};     // backward-compat: conversation-level negative
      var convSet = {};        // all distinct conversations
      var topicSet = {};       // topics from positiveDaySet evidence only
      var confCount = 0;

      var dayKeys = Object.keys(dayGroups);
      for (var dk = 0; dk < dayKeys.length; dk++) {
        var date = dayKeys[dk];
        var dayItems = dayGroups[date];
        var posCount = 0;
        var negCount = 0;

        for (var di2 = 0; di2 < dayItems.length; di2++) {
          var item = dayItems[di2];
          var pPattern = isString(item.ins.pattern) ? item.ins.pattern.trim() : '';
          var pConvId = item.ins.conversationId || '';
          if (pConvId.length > 0) {
            convSet[pConvId] = true;
          }

          if (pPattern.length > 0 && dirMap) {
            var isPos = dirMap.positive.indexOf(pPattern) >= 0;
            var isNeg = dirMap.negative.indexOf(pPattern) >= 0;
            if (isPos) { posCount++; if (pConvId.length > 0) posConvSet[pConvId] = true; }
            if (isNeg) { negCount++; if (pConvId.length > 0) negConvSet[pConvId] = true; }
            if (!isPos && !isNeg) patternUnknownCount++;
          } else {
            patternUnknownCount++;
          }
        }

        if (posCount > negCount) {
          positiveDaySet[date] = true;
        } else if (negCount > posCount) {
          negativeDaySet[date] = true;
        } else if (posCount > 0 || negCount > 0) {
          // 相等且都 > 0
          neutralDaySet[date] = true;
        }
        // posCount===0 && negCount===0: 该日无有效方向判断，不计入任何集合
      }

      // topicCount — 只统计 positiveDaySet 对应证据中出现的不同 topic
      for (var dk2 = 0; dk2 < dayKeys.length; dk2++) {
        var date2 = dayKeys[dk2];
        if (!hop.call(positiveDaySet, date2)) continue;
        var dayItems2 = dayGroups[date2];
        for (var dti = 0; dti < dayItems2.length; dti++) {
          var topic = dayItems2[dti].ins.topic;
          if (isString(topic) && topic.trim().length > 0) {
            topicSet[topic.trim()] = true;
          }
        }
      }

      // 统计 confirmedCount (只对 positiveDaySet 中的证据)
      for (var dk3 = 0; dk3 < dayKeys.length; dk3++) {
        var date3 = dayKeys[dk3];
        if (!hop.call(positiveDaySet, date3)) continue;
        var dayItems3 = dayGroups[date3];
        for (var dcti = 0; dcti < dayItems3.length; dcti++) {
          if (dayItems3[dcti].ins.reviewStatus === 'teacher_confirmed') {
            confCount++;
          }
        }
      }

      var positiveDayCount = Object.keys(positiveDaySet).length;
      var negativeDayCount = Object.keys(negativeDaySet).length;
      var neutralDayCount = Object.keys(neutralDaySet).length;
      var topicCount = Object.keys(topicSet).length;
      var totalEvidenceCount = items.length;

      // hasData 的指标级别判定：只要有任何被过滤保留的证据（正/负/neutral），就算有数据
      var indicatorHasData = (positiveDayCount + negativeDayCount + neutralDayCount) > 0;
      if (indicatorHasData) dimHasData = true;

      // backward-compat conversationCount
      var distinctConversationCount = Object.keys(convSet).length;

      // ======================================================
      //  Step 4: baseLevel
      //  ======================================================
      var baseLevel = 0;
      if (positiveDayCount >= 3 && topicCount >= 2) {
        baseLevel = 3;
      } else if (positiveDayCount >= 2) {
        baseLevel = 2;
      } else if (positiveDayCount === 1) {
        baseLevel = 1;
      } else {
        baseLevel = 0;
      }

      // ======================================================
      //  Step 5: 新鲜度降级
      //  ======================================================
      var isStale = false;
      var mostRecentPositiveDaysAgo = null;
      var effectiveLevel = baseLevel;

      if (positiveDayCount > 0) {
        // 找最新的正向日
        var latestPositiveDate = null;
        var latestMs = -Infinity;
        var pDates = Object.keys(positiveDaySet);
        for (var pdi = 0; pdi < pDates.length; pdi++) {
          var pdMs = beijingDateToMs(pDates[pdi]);
          if (pdMs !== null && pdMs > latestMs) {
            latestMs = pdMs;
            latestPositiveDate = pDates[pdi];
          }
        }
        if (latestPositiveDate !== null) {
          mostRecentPositiveDaysAgo = daysAgo(latestPositiveDate, now);
          if (mostRecentPositiveDaysAgo !== null && mostRecentPositiveDaysAgo > freshnessDays) {
            effectiveLevel = Math.max(baseLevel - 1, 0);
            isStale = true;
          }
        }
      }

      // ======================================================
      //  Step 6: 一致性判断
      //  ======================================================
      var consistentlyNegative = (positiveDayCount === 0 && negativeDayCount >= 2);

      // mixed detection (使用 positiveDayCount/negativeDayCount，不是原来的 convCount)
      var mixed = false;
      var counterExamples = [];
      var posDayCount = positiveDayCount;
      var negDayCount = negativeDayCount;

      if (posDayCount >= 2 && negDayCount >= 2) {
        mixed = true;
      } else if (posDayCount >= 2 && negDayCount === 1) {
        // 找到那个负向日的证据作为 counterExamples
        var negDates = Object.keys(negativeDaySet);
        for (var ndi = 0; ndi < negDates.length; ndi++) {
          var ndItems = dayGroups[negDates[ndi]];
          if (!ndItems) continue;
          for (var ndj = 0; ndj < ndItems.length; ndj++) {
            var ndPattern = isString(ndItems[ndj].ins.pattern) ? ndItems[ndj].ins.pattern.trim() : '';
            if (dirMap && dirMap.negative.indexOf(ndPattern) >= 0) {
              counterExamples.push({
                id: ndItems[ndj].ins.id,
                pattern: ndPattern,
                conversationId: ndItems[ndj].ins.conversationId,
              });
            }
          }
        }
      } else if (posDayCount === 1 && negDayCount >= 2) {
        // 找到那个正向日的证据作为 counterExamples
        var posDates = Object.keys(positiveDaySet);
        for (var pdi2 = 0; pdi2 < posDates.length; pdi2++) {
          var pdItems = dayGroups[posDates[pdi2]];
          if (!pdItems) continue;
          for (var pdj = 0; pdj < pdItems.length; pdj++) {
            var pdPattern = isString(pdItems[pdj].ins.pattern) ? pdItems[pdj].ins.pattern.trim() : '';
            if (dirMap && dirMap.positive.indexOf(pdPattern) >= 0) {
              counterExamples.push({
                id: pdItems[pdj].ins.id,
                pattern: pdPattern,
                conversationId: pdItems[pdj].ins.conversationId,
              });
            }
          }
        }
      }

      var cappedLevel;
      if (consistentlyNegative) {
        cappedLevel = 0;
      } else if (mixed) {
        cappedLevel = Math.min(effectiveLevel, 2);
      } else {
        cappedLevel = effectiveLevel;
      }

      // Backward-compat conv counts
      var posConvCount = Object.keys(posConvSet).length;
      var negConvCount = Object.keys(negConvSet).length;

      result.indicators[indName] = {
        level: baseLevel,
        cappedLevel: cappedLevel,
        mixed: mixed,
        // 新字段 (v2.0)
        positiveDayCount: positiveDayCount,
        negativeDayCount: negativeDayCount,
        neutralDayCount: neutralDayCount,
        isStale: isStale,
        consistentlyNegative: consistentlyNegative,
        mostRecentPositiveDaysAgo: mostRecentPositiveDaysAgo,
        // 原有字段（向后兼容）
        distinctConversationCount: distinctConversationCount,
        distinctTopicCount: topicCount,
        evidenceCount: totalEvidenceCount,
        confirmedCount: confCount,
        posConvCount: posConvCount,
        negConvCount: negConvCount,
        patternUnknownCount: patternUnknownCount,
        counterExamples: counterExamples,
      };

      if (cappedLevel > 0) { determinedCount++; sumLevel += cappedLevel; }
      dimEvidenceCount += totalEvidenceCount;
      dimConfirmedCount += confCount;
      // 汇总 conversation set
      var convKeys = Object.keys(convSet);
      for (var ck = 0; ck < convKeys.length; ck++) {
        dimConvSet[convKeys[ck]] = true;
      }
    }

    // ==========================================================
    //  Step 7: 维度档位 tier（三阶段计算）
    //  ==========================================================

    var dimensionIndex = determinedCount > 0 ? sumLevel / determinedCount : null;
    var radarValue = dimensionIndex !== null ? Math.round(dimensionIndex / 3 * 100) : null;
    if (radarValue !== null) { if (radarValue < 1) radarValue = 1; if (radarValue > 100) radarValue = 100; }

    // 阶段1（最高优先级 — consistentlyNegative）
    //  若该维度下任一指标 consistentlyNegative === true
    //    → tier = "需要引导"，直接返回，不再走后续阶段
    var hasConsistentlyNegative = false;
    for (var cni = 0; cni < indNames.length; cni++) {
      var indDataCn = result.indicators[indNames[cni]];
      if (indDataCn && indDataCn.consistentlyNegative === true) {
        hasConsistentlyNegative = true;
        break;
      }
    }

    var tier;
    var staleNote = null;

    if (hasConsistentlyNegative) {
      tier = '需要引导';
    } else if (!dimHasData) {
      // 阶段2（无数据 — hasData=false）
      //   该维度下所有指标的 positiveDayCount+negativeDayCount+neutralDayCount === 0
      //   → 完全没有可用的方向性证据
      tier = '暂无法判断';
    } else if (determinedCount === 0) {
      // 阶段2.5：有证据但全量无法定级（全部是 weak 被滤掉，或全部 neutral/无正向天）
      //   dimHasData=true 但 cappedLevel 全部为 0
      //   → 不是完全没数据，而是数据信息量不足以判定方向
      tier = '微弱信号';
    } else {
      // 阶段3（rawTier计算 + 覆盖率封顶）
      //   先算 rawTier：
      var rawTier;
      if (dimensionIndex === null) {
        rawTier = '暂无法判断';
      } else if (dimensionIndex < 1.5) {
        rawTier = '初步线索';
      } else if (dimensionIndex < 2.5) {
        rawTier = '重复出现';
      } else {
        rawTier = '稳定趋势';
      }

      // 覆盖率封顶：
      //   determinedCount = 该维度下 cappedLevel > 0 的指标个数
      //   totalIndicators = 该维度下的指标总数
      if (determinedCount < totalIndicators) {
        // coverageCap 只封顶"稳定趋势"，不往上提
        if (rawTier === '稳定趋势') {
          tier = '重复出现';
        } else {
          tier = rawTier;
        }
      } else {
        tier = rawTier;
      }
    }

    // staleNote：若某指标 isStale 且整个维度非 consistentlyNegative，附加提示
    if (!hasConsistentlyNegative) {
      for (var sni = 0; sni < indNames.length; sni++) {
        var indDataS = result.indicators[indNames[sni]];
        if (indDataS && indDataS.isStale === true) {
          staleNote = '该维度近期未再观察到，此前观察结果可能已发生变化';
          break;
        }
      }
    }

    result.dimensions[dimKey] = {
      hasData: dimHasData,
      dimensionIndex: dimensionIndex,
      radarValue: radarValue,
      coverage: determinedCount + '/' + totalIndicators,
      tier: tier,
      determinedCount: determinedCount,
      totalIndicators: totalIndicators,
      evidenceCount: dimEvidenceCount,
      confirmedCount: dimConfirmedCount,
      conversationCount: Object.keys(dimConvSet).length,
      staleNote: staleNote,
    };
  }

  return result;
}

module.exports = {
  DIM_CONFIG: DIM_CONFIG,
  DIM_INDICATORS: DIM_INDICATORS,
  PATTERN_DIRECTION: PATTERN_DIRECTION,
  computeRubric: computeRubric,
};
