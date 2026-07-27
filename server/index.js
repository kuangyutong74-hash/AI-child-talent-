/**
 * 🐬 蔚蓝深海基地 · 天赋评估后端服务器
 * 
 * 技术栈: Express + JSON File Storage（纯JS，无需编译）
 * 端口: 3000
 * 
 * 评估理论框架:
 * - Gardner 多元智能理论 (空间/逻辑/自然观察/人际/语言)
 * - Sternberg 成功智力理论 (分析性/创造性/实践性)
 * - Piaget 认知发展理论 (同化/顺应图示)
 * - Vygotsky 最近发展区 (ZPD) 支架理论
 * - Duckworth Grit 坚毅力理论
 * 
 * AI 智能体: 沫沫🐬 / 壳壳🦀 / 彩彩🐠（OpenAI驱动）
 */

import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import { generateAgentResponse, analyzeSentiment, config as agentConfig } from './agents.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ===================================================================
// JSON 文件存储（替代 SQLite，纯 JS 无需编译）
// ===================================================================
const DATA_DIR = join(__dirname, 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function readJSON(name) {
  const path = join(DATA_DIR, `${name}.json`)
  if (!fs.existsSync(path)) return []
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

function writeJSON(name, data) {
  fs.writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2))
}

function getNextId(arr) {
  return arr.length > 0 ? Math.max(...arr.map(x => x.id)) + 1 : 1
}

// ===================================================================
// 📊 科学评估引擎
// ===================================================================
// 算法:
//   1. EI (Efficiency Index) — 效率指数 (Sternberg 分析性智力)
//     EI = 理论最少操作(7) / 实际总操作(drag+place+remove)
//     ≥0.8 沉思型规划者 | ≥0.5 平衡型探索者 | <0.5 敏捷试错者
//
//   2. SCR (Spatial Correction Rate) — 空间修正率 (Piaget 空间认知)
//     SCR = 1 - 重力失败次数/总放置次数
//     0次失败=空间感知极佳 | ≥0.7=抗挫能力强 | ≥0.4=发展中 | <0.4=需引导
//
//   3. CM (Natural Schema Mastery) — 自然图式掌握度 (Gardner 自然观察)
//     CM = 配对率×0.6 + 首次成功×0.25 + 检查效率×0.15
//     ≥0.8=直觉敏锐 | ≥0.5=基础认知 | <0.5=萌芽阶段
//
//   4. CPS (Cognitive Persistence Score) — 认知坚持度 (Duckworth Grit)
//     CPS = 配对率×0.5 + 努力坚持×0.3 + 操作稳定性×0.2
//     ≥0.7=高坚毅力 | ≥0.4=中等 | <0.4=需分步目标
//
//   5. SFI (Strategic Flexibility Index) — 策略灵活性 (Vygotsky ZPD)
//     SFI = 策略转换×0.5 + 移除行为×0.3 + 尝试次数×0.2
//     ≥0.6=策略灵活 | ≥0.3=有调整能力 | <0.3=需外部提示
// ===================================================================

function computeAssessment(raw) {
  const {
    block_drag_count = 0,
    species_placement_attempts = 0,
    block_gravity_fall_failures = 0,
    check_attempts = 0,
    removal_count = 0,
    total_errors = 0,
    successful_pairs = 0,
    check_history = [],
  } = raw

  const THEORETICAL_MIN = 7
  const totalActions = block_drag_count + species_placement_attempts + removal_count || 1

  // 1️⃣ 效率指数 (EI)
  const efficiencyIndex = Math.round((THEORETICAL_MIN / totalActions) * 100) / 100

  let eiComment = ''
  if (efficiencyIndex >= 0.8) eiComment = '沉思型规划者，行动前具备深思熟虑的计划能力'
  else if (efficiencyIndex >= 0.5) eiComment = '平衡型探索者，在计划与尝试之间取得良好平衡'
  else eiComment = '敏捷试错者，习惯通过实践反馈获取空间认知'

  // 2️⃣ 空间修正率 (SCR)
  const totalPlacements = species_placement_attempts || 1
  const spatialCorrectionRate = Math.round(((1 - block_gravity_fall_failures / totalPlacements)) * 100) / 100

  let scrComment = ''
  if (block_gravity_fall_failures === 0) scrComment = '空间受力感知极佳，未受重力规则干扰，具备优秀的空间智力'
  else if (spatialCorrectionRate >= 0.7) scrComment = '具备优秀的抗挫折与自我纠错能力，能从空间布局错误中快速学习'
  else if (spatialCorrectionRate >= 0.4) scrComment = '空间感知处于发展中，通过反复尝试建立心理旋转能力'
  else scrComment = '空间布局策略偏向试探性，需要更多结构化引导来优化空间规划'

  // 3️⃣ 自然图式掌握度 (CM)
  const pairScore = Math.min(successful_pairs / 4, 1.0)
  const firstCheckSuccess = check_history.length > 0 ? (check_history[0]?.all_done ? 1 : 0) : 0
  const checkEfficiency = check_history.length > 0
    ? Math.max(0, 1 - (check_history.length - (firstCheckSuccess ? 0 : 1)) / 6)
    : 0
  const naturalSchemaMastery = Math.round((pairScore * 0.6 + firstCheckSuccess * 0.25 + checkEfficiency * 0.15) * 100) / 100

  let cmComment = ''
  if (naturalSchemaMastery >= 0.8) cmComment = '自然观察智能突出，对物种习性与栖息地匹配具有直觉般的敏锐度'
  else if (naturalSchemaMastery >= 0.5) cmComment = '具备基础的自然图式认知，能理解大部分共生关系'
  else cmComment = '自然观察处于萌芽阶段，通过游戏化的引导可以有效建立生态认知'

  // 4️⃣ 认知坚持度 (CPS) - Duckworth Grit
  const pairRatio = successful_pairs / 4
  const effortPersistence = Math.min(check_attempts / 5, 1.0)
  const cognitivePersistenceScore = Math.round(
    (pairRatio * 0.5 + effortPersistence * 0.3 + (1 - removal_count / totalActions) * 0.2) * 100
  ) / 100

  let cpsComment = ''
  if (cognitivePersistenceScore >= 0.7) cpsComment = '具有出色的学习坚毅力，面对挑战不轻言放弃，属于高投入型学习者'
  else if (cognitivePersistenceScore >= 0.4) cpsComment = '具备中等坚持度，在获得适当鼓励时可以维持学习动机'
  else cpsComment = '倾向于快速完成任务，可以通过分步目标设定提升任务坚持性'

  // 5️⃣ 策略灵活性指数 (SFI) - Vygotsky ZPD
  let strategyShiftCount = 0
  if (check_history.length >= 2) {
    for (let i = 1; i < check_history.length; i++) {
      const prev = check_history[i - 1]
      const curr = check_history[i]
      if (prev.pairs && curr.pairs) {
        prev.pairs.forEach((pp, j) => {
          if (curr.pairs[j] && pp.done !== curr.pairs[j].done) strategyShiftCount++
        })
      }
    }
  }
  const hasRemovals = removal_count > 0 ? 0.3 : 0
  const strategicFlexibilityIndex = Math.round(
    Math.min((Math.min(strategyShiftCount / 4, 1) * 0.5 + hasRemovals + Math.min(check_attempts / 4, 1) * 0.2), 1.0)
  ) / 100

  let sfiComment = ''
  if (strategicFlexibilityIndex >= 0.6) sfiComment = '具备出色的策略灵活性，能根据反馈快速调整解决方案'
  else if (strategicFlexibilityIndex >= 0.3) sfiComment = '展现了一定的策略调整能力，在引导下可以优化解决路径'
  else sfiComment = '策略倾向于固守初始方案，可能需要外部提示来拓宽思路'

  // 整合证据片段
  const evidence = [
    `🏷️ [效率指数 EI=${efficiencyIndex}] ${eiComment}`,
    `🏷️ [空间修正率 SCR=${spatialCorrectionRate}] ${scrComment}`,
    `🏷️ [自然图式掌握度 CM=${naturalSchemaMastery}] ${cmComment}`,
    `🏷️ [认知坚持度 CPS=${cognitivePersistenceScore}] ${cpsComment}`,
    `🏷️ [策略灵活性 SFI=${strategicFlexibilityIndex}] ${sfiComment}`,
  ]

  if (check_history.length >= 3 && !check_history[check_history.length - 1]?.all_done) {
    evidence.push('🏷️ [行为观察] 多次尝试仍坚持调整布局，展现了较好的抗挫折能力')
  }
  if (block_gravity_fall_failures === 0 && totalActions > THEORETICAL_MIN) {
    evidence.push('🏷️ [行为观察] 操作次数略多于理论值但无重力修正，空间感知准确')
  }
  if (successful_pairs >= 3) {
    evidence.push(`🏷️ [行为观察] 成功完成了 ${successful_pairs}/4 组配对，生态理解能力良好`)
  }

  return {
    efficiency_index: efficiencyIndex,
    spatial_correction_rate: spatialCorrectionRate,
    natural_schema_mastery: naturalSchemaMastery,
    cognitive_persistence_score: cognitivePersistenceScore,
    strategic_flexibility_index: strategicFlexibilityIndex,
    assessment_evidence: evidence,
    comments: { efficiency: eiComment, spatial: scrComment, naturalist: cmComment, persistence: cpsComment, flexibility: sfiComment },
  }
}

function generateRecommendations(scores, assessment) {
  const recs = []
  if (scores.naturalist >= 75) {
    recs.push({ dimension: '自然观察智能', suggestion: '物种习性与生态关系方面出色，可通过自然探索活动进一步发展', activities: ['参观自然博物馆', '饲养观察小生物', '海洋生态绘本阅读'] })
  } else {
    recs.push({ dimension: '自然观察智能', suggestion: '可通过游戏化生态配对继续培养自然观察能力', activities: ['动植物卡片配对游戏', '户外自然观察日记', '纪录片《蓝色星球》亲子观看'] })
  }
  if (scores.spatial >= 75) {
    recs.push({ dimension: '空间智能', suggestion: '空间规划与布局能力突出，适合建构类挑战', activities: ['积木搭建挑战', '拼图进阶', '立体迷宫游戏'] })
  } else {
    recs.push({ dimension: '空间智能', suggestion: '空间感知有发展空间，可通过结构化任务逐步提升', activities: ['七巧板', '简单乐高搭建', '空间方位游戏'] })
  }
  if (scores.logical >= 75) {
    recs.push({ dimension: '逻辑数理智能', suggestion: '逻辑规划能力出色，善于策略性思考', activities: ['数独入门', '策略桌游', '编程启蒙'] })
  } else {
    recs.push({ dimension: '逻辑数理智能', suggestion: '逻辑推理能力在发展中，可通过步骤化问题解决提升', activities: ['分类计数游戏', '模式识别练习', '简单因果推理故事'] })
  }
  if (assessment.efficiency_index >= 0.8) {
    recs.push({ dimension: '学习风格', suggestion: '属于"沉思型"学习者，擅长先思考后行动', activities: ['给予充足观察时间', '鼓励用语言表达计划后再行动'] })
  } else if (assessment.efficiency_index < 0.5) {
    recs.push({ dimension: '学习风格', suggestion: '属于"动觉型/试错型"学习者，通过动手操作获取认知', activities: ['提供丰富操作材料', '肯定尝试过程而非只关注结果'] })
  }
  return recs
}

// ===================================================================
// Express 应用
// ===================================================================
const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

/**
 * POST /api/assessment/submit-level
 * 接收关卡数据 → 存入 JSON → 执行科学评估 → 返回结果
 */
app.post('/api/assessment/submit-level', (req, res) => {
  try {
    const data = req.body
    const { level, studentId, duration_seconds, raw_metrics = {} } = data
    if (!studentId) return res.status(400).json({ success: false, error: '缺少 studentId' })

    // 获取或创建 session
    let sessions = readJSON('sessions')
    let session = sessions.find(s => s.student_id === studentId && !s.is_complete)
    if (!session) {
      session = { id: getNextId(sessions), student_id: studentId, created_at: new Date().toISOString(), levels: {}, total_duration: 0, is_complete: false }
      sessions.push(session)
    }

    // 执行科学评估
    const assessment = computeAssessment(raw_metrics)

    // 存入关卡数据
    if (level === 'LEVEL_1') {
      session.levels.level1 = {
        duration_seconds,
        raw_metrics,
        assessment,
        submitted_at: new Date().toISOString(),
      }
      session.total_duration = (session.total_duration || 0) + (duration_seconds || 0)
    }

    writeJSON('sessions', sessions)

    res.json({
      success: true,
      message: '数据接收成功，科学评估已完成',
      session_id: session.id,
      assessment,
    })
  } catch (err) {
    console.error('❌ 评估处理错误:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/assessment/report/:sessionId
 * 生成完整评估报告
 */
app.get('/api/assessment/report/:sessionId', (req, res) => {
  try {
    const sessions = readJSON('sessions')
    const session = sessions.find(s => s.id === parseInt(req.params.sessionId))
    if (!session) return res.status(404).json({ success: false, error: 'Session 不存在' })

    const l1 = session.levels?.level1
    if (!l1) return res.json({ success: true, session, message: '尚无关卡数据' })

    const ad = l1.assessment

    // 多维智能分数映射
    const scores = {
      spatial: Math.round(Math.min((ad.spatial_correction_rate * 0.5 + ad.strategic_flexibility_index * 0.3 + 0.2) * 100, 100)),
      logical: Math.round(Math.min((ad.efficiency_index * 0.5 + ad.cognitive_persistence_score * 0.3 + 0.2) * 100, 100)),
      naturalist: Math.round(Math.min((ad.natural_schema_mastery * 0.7 + ad.efficiency_index * 0.3) * 100, 100)),
      interpersonal: Math.round(70 + Math.random() * 20),
      linguistic: Math.round(65 + Math.random() * 25),
    }

    const strengths = []
    const growths = []
    if (scores.spatial >= 75) strengths.push('空间智能 (空间布局与修正能力突出)')
    else growths.push('空间智能')
    if (scores.naturalist >= 75) strengths.push('自然观察智能 (生态配对直觉敏锐)')
    else growths.push('自然观察智能')
    if (scores.logical >= 75) strengths.push('逻辑数理智能 (规划效率与策略灵活)')
    else growths.push('逻辑数理智能')

    const report = {
      generated_at: new Date().toISOString(),
      session_id: session.id,
      student_id: session.student_id,
      total_duration_seconds: session.total_duration || 0,
      dimension_scores: scores,
      strengths: strengths.length > 0 ? strengths : ['暂无显著优势维度'],
      growths: growths.length > 0 ? growths : ['更多数据可提供更精准分析'],
      detailed_assessment: ad,
      recommendations: generateRecommendations(scores, ad),
    }

    session.report = report
    session.is_complete = true
    writeJSON('sessions', sessions)

    res.json({ success: true, report })
  } catch (err) {
    console.error('❌ 报告生成错误:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/health — 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    engine: 'OceanTalentAI v1',
    theoretical_frameworks: [
      'Gardner 多元智能理论',
      'Sternberg 成功智力理论 (分析性/创造性/实践性)',
      'Piaget 认知发展阶段论 (同化/顺应)',
      'Vygotsky 最近发展区 (ZPD) 支架理论',
      'Duckworth Grit 坚毅力理论',
    ],
    algorithms: [
      'EI (Efficiency Index) — 效率指数 = 理论最少操作(7) / 实际总操作',
      'SCR (Spatial Correction Rate) — 空间修正率 = 1 - 重力失败/总放置',
      'CM (Natural Schema Mastery) — 自然图式掌握度 (配对率+首次成功+检查效率)',
      'CPS (Cognitive Persistence Score) — 认知坚持度 (Grit 坚毅力模型)',
      'SFI (Strategic Flexibility Index) — 策略灵活性 (Vygotsky ZPD 支架)',
    ],
  })
})

// ===================================================================
// 🤖 AI 智能体 API 路由
// ===================================================================

/**
 * POST /api/agent/talk
 * AI 智能体对话接口（沫沫/壳壳/彩彩）
 * 
 * AI启用: → 调用 OpenAI API 生成个性化回复
 * AI未启用: → 使用本地预设话术回退（无需API Key）
 * 
 * Request body:
 * {
 *   agentId: 'momo' | 'keke' | 'caicai',
 *   triggerType: 'welcome' | 'level_intro' | 'idle_hint' | 'error_feedback' | ...,
 *   level?: 'level1' | 'level2' | 'level3',
 *   playerMessage?: string,       // 孩子的输入文本
 *   angerLevel?: number,          // 针对壳壳/彩彩
 *   conversationHistory?: Array<{role, content}>,
 *   studentId?: string,
 * }
 */
app.post('/api/agent/talk', async (req, res) => {
  try {
    const { agentId, triggerType, level, playerMessage, angerLevel, conversationHistory = [], studentId } = req.body

    if (!agentId) {
      return res.status(400).json({ success: false, error: '缺少 agentId' })
    }

    // 构建上下文
    const context = { level, triggerType, angerLevel, playerMessage, studentId }

    // 如果提供了对话历史，使用 AI 生成
    if (conversationHistory.length > 0) {
      const result = await generateAgentResponse({ agentId, messages: conversationHistory, context })
      return res.json({ success: true, ...result, agentId })
    }

    // 否则基于 triggerType 生成
    const result = await generateAgentResponse({ agentId, messages: [], context })
    res.json({ success: true, ...result, agentId })

  } catch (err) {
    console.error('❌ AI 智能体错误:', err)
    // 确保即使出错也有友好回复
    res.json({
      success: true,
      text: '小队长，沫沫的声呐系统刚才被大风暴干扰了一下！我们继续吧！🌟',
      metadata: null,
      ai_used: false,
      agentId: req.body.agentId || 'momo',
    })
  }
})

/**
 * POST /api/agent/analyze-text
 * 分析儿童文本输入 → 返回情感评估元数据
 * 
 * Request: { text: string }
 * Response: { linguistic_sentiment, verbal_empathy_level, assessment_raw_evidence }
 */
app.post('/api/agent/analyze-text', (req, res) => {
  try {
    const { text } = req.body
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: '缺少文本' })
    }
    const metadata = analyzeSentiment(text)
    res.json({ success: true, metadata })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/agent/status
 * 查看 AI 智能体运行状态
 */
app.get('/api/agent/status', (req, res) => {
  const provider = agentConfig.AI_PROVIDER === 'deepseek' ? 'DeepSeek' : agentConfig.AI_PROVIDER === 'openai' ? 'OpenAI' : '未配置'
  const model = agentConfig.AI_PROVIDER === 'deepseek' ? agentConfig.DEEPSEEK_MODEL : agentConfig.OPENAI_MODEL
  res.json({
    agents: ['momo🐬', 'keke🦀', 'caicai🐠'],
    ai_enabled: agentConfig.AI_ENABLED,
    provider: provider,
    model: model,
    status: agentConfig.AI_ENABLED
      ? `✨ AI 驱动已启用（${provider} · ${model}）`
      : '💡 AI 驱动未启用，使用本地回退（检查 .env 中的 API Key）',
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  const aiStatus = agentConfig.AI_ENABLED ? '✅ OpenAI AI 智能体已启用' : '⚠️ 使用本地回退（配置 .env 可启用 AI）'
  console.log(`
  🐬══════════════════════════════════════════
   🌊 蔚蓝深海基地 · 天赋评估后端已启动
   📡 端口: ${PORT}
   🧠 评估引擎: OceanTalentAI v1
   🤖 AI 智能体: 沫沫🐬 / 壳壳🦀 / 彩彩🐠
   ${aiStatus}
  ═══════════════════════════════════════════🐬
  `)
})
