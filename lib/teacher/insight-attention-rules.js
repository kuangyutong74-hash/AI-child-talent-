/**
 * insight-attention-rules.js — Insight "需要老师关注" 判定 + 维度级别提示
 *
 * 纯函数模块。不读写文件、不访问网络、不调用模型、不依赖 Express。
 * 不修改任何输入参数。
 *
 * 导出：
 *   computeNeedsTeacherAttention({ insights, rubric, reviewHistory })
 *   computeDimensionAlerts({ rubric, conversationCount })
 */

'use strict';

var hop = Object.prototype.hasOwnProperty;

// ============================================================
//  辅助
// ============================================================

function isNonArrayObject(val) {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function isArray(val) {
  return Array.isArray(val);
}

function isString(val) {
  return typeof val === 'string';
}

// ============================================================
//  常量
// ============================================================

var BOUNDARY_EPSILON = 0.2;
var DIMENSION_NO_DATA_N = 2; // 连续 N 个周期 hasData=false 才触发提示

// ============================================================
//  computeNeedsTeacherAttention
// ============================================================

/**
 * 给每条 insight 附加 needsTeacherAttention 和 attentionReasons。
 *
 * 三条规则（insight 级别）：
 *   1. 该 insight 所属 indicator 的 mixed === true
 *   2. 该 insight 所属 dimension 的 dimensionIndex 在档位边界 0.2 以内
 *   3. reviewHistory 中存在同 student + 同 indicator 的 rejected 记录
 *
 * @param {object} input
 * @param {Array} input.insights — MergedTalentInsight 数组
 * @param {object} input.rubric — computeRubric 的输出
 * @param {Array} input.reviewHistory — teacher-insight-reviews 记录数组
 * @returns {Array} 附加了 needsTeacherAttention / attentionReasons / aiStatus 的 insight 数组
 */
function computeNeedsTeacherAttention(input) {
  if (!isNonArrayObject(input)) return [];

  var insights = isArray(input.insights) ? input.insights : [];
  var rubric = input.rubric;
  var reviewHistory = isArray(input.reviewHistory) ? input.reviewHistory : [];
  var freshnessDays = (typeof input.freshnessDays === 'number' && isFinite(input.freshnessDays) && input.freshnessDays > 0)
    ? Math.floor(input.freshnessDays) : 30;

  // 预计算：哪些 indicator 曾被 teacher 标记为 rejected（规则3）
  var rejectedIndicators = {};
  for (var ri = 0; ri < reviewHistory.length; ri++) {
    var rev = reviewHistory[ri];
    if (!isNonArrayObject(rev)) continue;
    if (rev.reviewStatus !== 'rejected') continue;

    // reviewHistory 里的记录可能不直接带 indicator，
    // 但 insightId 里包含了 indicator 信息。
    // 实际使用中，我们用 studentId + indicator 组合来判断。
    // 由于 reviewHistory 中没有直接存 indicator，我们需要从 insight 反向查找。
    // 简化处理：如果 review 的 studentId 匹配且 reviewStatus === 'rejected'，
    // 记录其 insightId。后续对每个 insight 检查其 indicator 是否命中。
    var sid = rev.studentId;
    if (!isString(sid) || sid.length === 0) continue;
    if (!rejectedIndicators[sid]) rejectedIndicators[sid] = {};
    // 先从 insightId 格式中推断 indicator —— 但这样不可靠。
    // 更好的做法：遍历 insights 找到匹配 insightId 的，记录其 indicator。
    // 我们在第二轮遍历中处理。
  }

  // 构建 "studentId:indicator" → true 的被拒映射
  var rejectedMap = {};
  for (var rj = 0; rj < reviewHistory.length; rj++) {
    var rv = reviewHistory[rj];
    if (!isNonArrayObject(rv)) continue;
    if (rv.reviewStatus !== 'rejected') continue;

    // 在 insights 中匹配 insightId → 获取 indicator
    var rvInsightId = rv.insightId;
    var rvStudentId = rv.studentId;
    if (!isString(rvInsightId) || !isString(rvStudentId)) continue;

    for (var ik = 0; ik < insights.length; ik++) {
      var candidateIns = insights[ik];
      if (!isNonArrayObject(candidateIns)) continue;
      if (candidateIns.id === rvInsightId && candidateIns.studentId === rvStudentId) {
        var indicatorName = candidateIns.indicator;
        if (isString(indicatorName) && indicatorName.length > 0) {
          var key = rvStudentId + ':' + indicatorName;
          rejectedMap[key] = true;
        }
        break;
      }
    }
  }

  // 处理每条 insight
  var result = [];
  for (var ii = 0; ii < insights.length; ii++) {
    var ins = insights[ii];
    if (!isNonArrayObject(ins)) continue;

    var insStudentId = isString(ins.studentId) ? ins.studentId : '';
    var insDimension = isString(ins.dimension) ? ins.dimension : '';
    var insIndicator = isString(ins.indicator) ? ins.indicator : '';

    var attentionReasons = [];
    var needsAttention = false;

    // ---- 规则1: mixed === true ----
    if (rubric && isNonArrayObject(rubric.indicators)) {
      var indData = rubric.indicators[insIndicator];
      if (indData && indData.mixed === true) {
        needsAttention = true;
        attentionReasons.push('表现矛盾：正反方向模式在不同会话中均有出现');
      }
    }

    // ---- 规则2: dimensionIndex 在档位边界附近 ----
    if (rubric && isNonArrayObject(rubric.dimensions)) {
      var dimData = rubric.dimensions[insDimension];
      if (dimData && dimData.hasData && dimData.dimensionIndex !== null) {
        var di = dimData.dimensionIndex;
        // 边界：1.5 和 2.5
        var nearBoundary = false;
        if (di >= 1.5 - BOUNDARY_EPSILON && di <= 1.5 + BOUNDARY_EPSILON) {
          nearBoundary = true;
        }
        if (di >= 2.5 - BOUNDARY_EPSILON && di <= 2.5 + BOUNDARY_EPSILON) {
          nearBoundary = true;
        }
        if (nearBoundary) {
          needsAttention = true;
          attentionReasons.push('维度指数 ' + di.toFixed(2) + ' 在档位边界附近，AI判定容易因证据增减而换档');
        }
      }
    }

    // ---- 规则3: 同 student + 同 indicator 的历史 rejected 记录 ----
    var rejectKey = insStudentId + ':' + insIndicator;
    if (rejectedMap[rejectKey]) {
      needsAttention = true;
      attentionReasons.push('此前该指标曾被教师标记为不准确，同类判断再次出现时建议复核');
    }

    // ---- 规则4: 该指标持续表现为负向模式 (consistentlyNegative) ----
    if (rubric && isNonArrayObject(rubric.indicators)) {
      var indData4 = rubric.indicators[insIndicator];
      if (indData4 && indData4.consistentlyNegative === true) {
        needsAttention = true;
        attentionReasons.push('该指标在近期多次不同日期的对话中持续表现为负向模式，建议教师关注并引导，而非视为稳定优势表现');
      }
    }

    // ---- 规则5: 该指标近期未再出现 (isStale) ----
    if (rubric && isNonArrayObject(rubric.indicators)) {
      var indData5 = rubric.indicators[insIndicator];
      if (indData5 && indData5.isStale === true && indData5.consistentlyNegative !== true) {
        needsAttention = true;
        attentionReasons.push('该指标此前曾稳定观察到，但近期（' + freshnessDays + '天内）未再出现，建议确认是否仍然持续');
      }
    }

    // 构建输出
    var out = {};
    var insKeys = Object.keys(ins);
    for (var ki = 0; ki < insKeys.length; ki++) {
      var k = insKeys[ki];
      if (hop.call(ins, k)) out[k] = ins[k];
    }
    out.needsTeacherAttention = needsAttention;
    out.attentionReasons = attentionReasons;
    out.aiStatus = needsAttention ? 'needs_attention' : 'ai_determined';

    result.push(out);
  }

  return result;
}

// ============================================================
//  computeDimensionAlerts
// ============================================================

/**
 * 计算维度级别的独立提示（与具体 insight 无关）。
 *
 * 触发条件：维度 hasData === false 且 conversationCount >= N（默认2）
 *
 * @param {object} input
 * @param {object} input.rubric — computeRubric 的输出
 * @param {number} input.conversationCount — 学生总对话数
 * @param {number} [input.N] — 连续周期阈值，默认 2
 * @returns {Array<{dimension: string, reason: string, suggestion: string}>}
 */
function computeDimensionAlerts(input) {
  if (!isNonArrayObject(input)) return [];

  var rubric = input.rubric;
  var conversationCount = (typeof input.conversationCount === 'number' && isFinite(input.conversationCount) && input.conversationCount >= 0)
    ? Math.floor(input.conversationCount) : 0;
  var N = (typeof input.N === 'number' && isFinite(input.N) && input.N >= 1) ? Math.floor(input.N) : DIMENSION_NO_DATA_N;

  if (!isNonArrayObject(rubric) || !isNonArrayObject(rubric.dimensions)) return [];
  if (conversationCount < N) return [];

  var DIM_LABELS = {
    '语言表达': '语言表达',
    '兴趣方向': '兴趣方向',
    '内省倾向': '内省倾向',
    '思维方式': '思维方式',
  };

  var DIM_SUGGESTIONS = {
    '语言表达': '建议下次对话中邀请学生描述一件近期经历，观察其叙事组织能力',
    '兴趣方向': '建议下次对话中主动询问学生最近的兴趣或爱好，观察是否有新话题出现',
    '内省倾向': '建议下次对话中引导学生聊聊自己的感受或对某事的看法',
    '思维方式': '建议下次对话中对学生的回答进行追问（如"为什么这样想"），观察其应变能力',
  };

  var alerts = [];
  var dimKeys = Object.keys(rubric.dimensions);
  for (var i = 0; i < dimKeys.length; i++) {
    var dimKey = dimKeys[i];
    if (!hop.call(rubric.dimensions, dimKey)) continue;
    var dim = rubric.dimensions[dimKey];
    if (!isNonArrayObject(dim)) continue;
    if (dim.hasData === true) continue;

    alerts.push({
      dimension: DIM_LABELS[dimKey] || dimKey,
      reason: '连续' + N + '个周期暂无法判断',
      suggestion: DIM_SUGGESTIONS[dimKey] || '建议下次对话主动引导相关话题',
    });
  }

  return alerts;
}

module.exports = {
  computeNeedsTeacherAttention: computeNeedsTeacherAttention,
  computeDimensionAlerts: computeDimensionAlerts,
};
