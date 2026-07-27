// ================================================================
// 蔚蓝深海基地重建计划 · 后端 API 服务器
// Node.js + Express · 端口 3000
// ================================================================

import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ================================================================
// 常量与配置
// ================================================================

const PORT = 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'db_logs.json')

const app = express()

// ================================================================
// 中间件
// ================================================================

app.use(cors({
  origin: true,
  methods: ['GET', 'POST'],
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// ================================================================
// JSON 数据库工具（零配置，纯文件存储）
// ================================================================

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    // 文件不存在或格式错误，初始化空库
    return { logs: [], assessments: [] }
  }
}

function writeDB(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

// ================================================================
// ✅【核心算法】第 1 关 · 多维天赋评估映射算法
// ================================================================

function calculateLevel1Assessment(raw) {
  // ---------- 提取原始指标 ----------
  const dragCount = raw.block_drag_count ?? 0
  const placementAttempts = raw.species_placement_attempts ?? 0
  const gravityFailures = raw.block_gravity_fall_failures ?? 0
  const removalCount = raw.removal_count ?? 0
  const checkAttempts = raw.check_attempts ?? 0
  const successfulPairs = raw.successful_pairs ?? 0
  const totalErrors = raw.total_errors ?? 0
  const pairDetails = raw.pair_details ?? []

  const totalActions = dragCount + placementAttempts
  const totalCorrections = gravityFailures + removalCount

  // ---------------------------------------------------------------
  // 1. 【效率指数 EFFICIENCY INDEX (EI)】
  //    理论最少拖拽次数(8) / 实际总操作数
  // ---------------------------------------------------------------
  const THEORY_MIN_DRAGS = 8
  const EI = totalActions > 0
    ? Math.round((THEORY_MIN_DRAGS / totalActions) * 100) / 100
    : 0

  let EIComment = ''
  let EILevel = ''
  if (EI >= 0.8) {
    EIComment = '沉思型规划者，行动前具备深思熟虑的计划能力'
    EILevel = 'A+'
  } else if (EI >= 0.6) {
    EIComment = '平衡型探索者，规划与行动并重，策略灵活'
    EILevel = 'A'
  } else if (EI >= 0.5) {
    EIComment = '渐进式学习者，在尝试中不断优化策略'
    EILevel = 'B'
  } else {
    EIComment = '敏捷试错者，习惯通过实践反馈获取空间认知'
    EILevel = 'C'
  }

  // ---------------------------------------------------------------
  // 2. 【空间修正率 SPATIAL CORRECTION RATE (SCR)】
  //    衡量抗挫折与自我纠错能力
  // ---------------------------------------------------------------
  let SCR = 0
  let SCRComment = ''
  let SCRLevel = ''

  if (gravityFailures === 0 && removalCount === 0) {
    SCR = 1.0
    SCRComment = '空间受力感知极佳，未受重力规则干扰，一步到位完成空间配置'
    SCRLevel = 'A+'
  } else {
    // 修正率 = 1 - (纠正次数 / (总操作 + 纠正次数))
    const denominator = totalActions + totalCorrections
    SCR = denominator > 0
      ? Math.round((1 - totalCorrections / denominator) * 100) / 100
      : 0

    if (SCR >= 0.85) {
      SCRComment = '具备优秀的抗挫折与自我纠错能力，能快速从空间判断失误中调整'
      SCRLevel = 'A'
    } else if (SCR >= 0.70) {
      SCRComment = '具备基础的空间修正意识，在试错中逐步优化布局'
      SCRLevel = 'B'
    } else {
      SCRComment = '处于空间探索敏感期，需要通过反复实践积累空间受力经验'
      SCRLevel = 'C'
    }
  }

  // ---------------------------------------------------------------
  // 3. 【自然图式掌握度 NATURAL SCHEMA MASTERY (CM)】
  //    孩子对物种习性/共生关系的直觉敏锐度
  // ---------------------------------------------------------------
  const maxPairs = 4
  const CMScore = Math.round((successfulPairs / maxPairs) * 100) / 100

  // 构建证据片段
  const evidenceList = []
  const speciesLabels = {
    clownfish_anemone: '双锯鱼 ⇋ 海葵（共生保护）',
    garden_eel: '花园鳗 → 沙地（栖息地需求）',
    shrimp_goby: '枪虾 ⇋ 鰕虎鱼（合作共生）',
    remora_turtle: '鮣鱼 ⇋ 海龟（依附共生）',
  }

  for (const pair of pairDetails) {
    const label = speciesLabels[pair.id] || pair.id || pair.label
    if (pair.done) {
      if (checkAttempts <= 1) {
        evidenceList.push(`✅ 首次尝试即直觉性完成「${label}」，表现出对该生态关系的本能理解`)
      } else {
        evidenceList.push(`✅ 经过 ${checkAttempts} 次验证后正确完成「${label}」，具备学习迁移能力`)
      }
    } else {
      evidenceList.push(`⏳ 「${label}」尚未完全掌握，建议后续加强该生态关系体验`)
    }
  }

  let CMComment = ''
  let CMLevel = ''
  if (CMScore >= 0.75) {
    CMComment = '具备优秀的自然图式感知力，对海洋物种共生关系有本能直觉，展现出生态学思维萌芽'
    CMLevel = 'A'
  } else if (CMScore >= 0.50) {
    CMComment = '对海洋共生关系有基础认知，部分配对关系需要进一步体验强化即可掌握'
    CMLevel = 'B'
  } else {
    CMComment = '自然图式尚在建构中，需要更多生态关系探索经验来建立物种关联认知'
    CMLevel = 'C'
  }

  // ---------------------------------------------------------------
  // 返回完整的评估结果
  // ---------------------------------------------------------------
  return {
    efficiency_index: {
      score: EI,
      level: EILevel,
      comment: EIComment,
      details: {
        theory_min_drags: THEORY_MIN_DRAGS,
        actual_drag_count: dragCount,
        actual_placement_attempts: placementAttempts,
        total_actions: totalActions,
      },
    },
    spatial_correction_rate: {
      score: SCR,
      level: SCRLevel,
      comment: SCRComment,
      details: {
        block_gravity_fall_failures: gravityFailures,
        removal_count: removalCount,
        total_corrections: totalCorrections,
        total_actions: totalActions,
        correction_rate: totalCorrections > 0
          ? Math.round((1 - totalCorrections / (totalActions + totalCorrections)) * 100) / 100
          : 1.0,
      },
    },
    natural_schema_mastery: {
      score: CMScore,
      level: CMLevel,
      comment: CMComment,
      evidence: evidenceList,
      details: {
        successful_pairs: successfulPairs,
        total_pairs: maxPairs,
        check_attempts: checkAttempts,
        pair_details: pairDetails,
      },
    },
    // 综合天赋画像
    talent_profile: {
      dominant_trait: EI >= 0.7 ? 'PLANNER' : (EI < 0.5 ? 'EXPERIMENTER' : 'BALANCED'),
      summary: generateTalentSummary(EI, SCR, CMScore, EIComment, SCRComment, CMComment),
    },
  }
}

/**
 * 生成综合天赋画像摘要
 */
function generateTalentSummary(EI, SCR, CM, eiCmt, scrCmt, cmCmt) {
  const traits = []
  if (EI >= 0.7) traits.push('🧠 沉思型规划')
  else if (EI < 0.5) traits.push('⚡ 敏捷试错')
  else traits.push('⚖️ 平衡策略')

  if (SCR >= 0.85) traits.push('🛠️ 高抗挫折')
  else if (SCR >= 0.6) traits.push('🔄 渐进修正')

  if (CM >= 0.75) traits.push('🌊 生态直觉敏锐')
  else if (CM >= 0.5) traits.push('📖 生态认知建构中')

  return `【综合天赋画像】${traits.join(' · ')}。${eiCmt}。${scrCmt}。${cmCmt}`
}

// ================================================================
// 路由：接收关卡评估数据
// POST /api/assessment/submit-level
// ================================================================

app.post('/api/assessment/submit-level', (req, res) => {
  try {
    const rawData = req.body

    // ---------- 基础校验 ----------
    if (!rawData || !rawData.level) {
      return res.status(400).json({
        success: false,
        message: '缺少关卡标识 (level)',
      })
    }

    // ---------- 构建存储记录 ----------
    const logEntry = {
      id: `${rawData.level}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      level: rawData.level,
      studentId: rawData.studentId || 'unknown',
      timestamp: rawData.timestamp || new Date().toISOString(),
      duration_seconds: rawData.duration_seconds ?? 0,
      // 保留原始指标（供后续复盘分析）
      raw_metrics: rawData.raw_metrics || {},
      // 原始请求完整副本（审计用途）
      _raw_payload: rawData,
    }

    // ---------- 按关卡执行评估算法 ----------
    if (rawData.level === 'LEVEL_1') {
      logEntry.assessment = calculateLevel1Assessment(rawData.raw_metrics || {})

      // 回写前端额外字段
      logEntry.assessment._feedback = {
        EI_hint: logEntry.assessment.efficiency_index.comment,
        SCR_hint: logEntry.assessment.spatial_correction_rate.comment,
        CM_hint: logEntry.assessment.natural_schema_mastery.comment,
        talent_summary: logEntry.assessment.talent_profile.summary,
      }
    } else {
      // 未来关卡扩展占位
      logEntry.assessment = {
        _note: `Level ${rawData.level} 评估算法待实现`,
        raw_scores: rawData.raw_metrics || {},
      }
    }

    // ---------- 持久化到本地 JSON 数据库 ----------
    const db = readDB()
    db.logs.push(logEntry)
    writeDB(db)

    // ---------- 返回给前端 ----------
    return res.json({
      success: true,
      message: `🎯 Level ${rawData.level} 数据已成功记录并完成天赋评估`,
      data: {
        logId: logEntry.id,
        assessment: logEntry.assessment,
      },
    })
  } catch (err) {
    console.error('[Server Error]', err)
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message,
    })
  }
})

// ================================================================
// ✅【核心算法】第 3 关 · 智能对话评估算法
// POST /api/assessment/level3-chat
// ================================================================

// 关键词词库
const KEYWORDS = {
  // 🏆 建设性关键词（同理心、双赢、友善）
  constructive: [
    '对不起', '抱歉', '理解', '明白', '知道', '别难过', '别生气', '安慰',
    '抱抱', '加油', '没关系', '和平', '分享', '轮流', '让一让', '和好',
    '商量', '公平', '大家', '朋友', '一起', '开心', '喜欢', '我们',
    '团结', '合作', '包容', '体谅', '忍让', '退一步', '各退一步',
    '好好说', '好好商量', '互相', '帮助', '支持', '鼓励', '温柔',
    '消消气', '冷静', '听我说', '可以', '好的', '行', '没问题',
    '试试', '相信', '一定行', '最棒', '好办法', '同意',
  ],
  // 🚫 攻击性关键词
  unfriendly: [
    '不要', '不行', '讨厌', '烦', '哼', '不', '坏', '滚', '走开',
    '闭嘴', '打你', '揍你', '笨蛋', '傻瓜', '讨厌鬼', '自私',
    '不公平', '凭什么', '就不', '偏不', '你错', '怪你', '都怪',
  ],
  // 🌊 海洋/调解相关（正面加分辅助词）
  marine_positive: [
    '大海', '海洋', '珊瑚', '小鱼', '海葵', '贝壳', '海龟',
    '基地', '阳台', '露台', '阳光', '水', '浪花', '泡泡',
    '沫沫', '壳壳', '彩彩', '小队长',
  ],
}

function classifyInput(text) {
  const lower = text.toLowerCase()

  // 先测攻击性（优先级高）
  const hasUnfriendly = KEYWORDS.unfriendly.some(w => lower.includes(w))
  if (hasUnfriendly) return 'unfriendly'

  // 测建设性
  const constructiveScore = KEYWORDS.constructive.filter(w => lower.includes(w)).length
  const marineScore = KEYWORDS.marine_positive.filter(w => lower.includes(w)).length

  if (constructiveScore >= 1 || (marineScore >= 2 && text.length >= 4)) {
    return 'constructive'
  }

  // 最少字数检查（避免乱码/单字）
  if (text.length < 3) return 'off_topic'

  // 检查是否与主题相关（包含任何有意义的中文字）
  const chineseChars = text.match(/[一-鿿]/g)
  if (!chineseChars || chineseChars.length < 2) return 'off_topic'

  // 默认归为建设性（给予鼓励）
  return 'constructive'
}

// 壳壳回复库（随机选取）
const KEKE_REPLIES = {
  constructive: [
    '唔……小队长说的话让我心里暖暖的。如果彩彩愿意商量的话，我也不是不能让步啦……🦀',
    '哼……既然小队长都这么说了，那我……我试试看和彩彩好好相处吧。谢谢你……',
    '你真的愿意听我说话……我好感动。那……那我和彩彩各退一步，试试看一起用阳台……',
    '呜呜……小队长你真好。其实我也不想吵架，只是太吵了我真的好害怕……现在好多了。',
    '嗯！小队长说得对，朋友之间应该互相理解。那我去跟彩彩说对不起……',
  ],
  off_topic: [
    '唔，小队长说的事情听起来是很好啦……可是彩彩的大喇叭还在嗡嗡响，我的头都要炸了，根本顾不上别的。小队长，你快帮我们拿个主意吧……🦀',
    '那个……我知道小队长想聊点轻松的，可是我现在满脑子都是阳台的纠纷，彩彩的音乐声吵得我根本静不下心……你能不能先帮我们想想办法呀？',
    '唔……好像很好玩的样子……可是我这边还在跟彩彩吵架呢，阳台到底怎么分呀？你快帮我们调解吧！🦀',
    '唉……要是没有这场吵架，我也好想跟小队长一起玩的……可是彩彩每天放音乐，我的海螺壳都在震，你快帮我们商量个公平的办法好不好……',
  ],
  unfriendly: [
    '呜……小队长好凶……我只是想安安静静看会儿书而已……为什么要凶我……😢',
    '我……我做错什么了吗？小队长为什么要这么说我……好难过……',
    '呜呜……连小队长也欺负我……那我还是自己缩在壳里好了……',
  ],
}

// 彩彩回复库（随机选取）
const CAICAI_REPLIES = {
  constructive: [
    '哇塞！小队长说得太好啦！我就知道小队长最聪明了！那我们说好了，上午静悄悄下午嗨起来！耶！🐠',
    '哈哈！小队长你真是太棒啦！这个主意我举双手双脚赞成！彩彩现在超开心的！🌟',
    '好耶好耶！终于有人理解我啦！跳舞是我的生命呀！小队长万岁！我们快点和好吧！🎉',
    '嘿嘿，既然小队长都发话了，那我彩彩就给壳壳一个面子吧！不过晚上可得让我跳个够哦！',
    '太棒啦！我就喜欢大家开开心心的！小队长我们拉钩，以后再也不吵架了！🤝',
  ],
  off_topic: [
    '哇！这个好好玩！不过先等一下哈——我跟壳壳还在抢阳台呢！你快帮我们评评理，到底该怎么办呀！🐠',
    '哈哈哈小队长你太可爱啦！我也好想聊这个！但是不行不行，我们现在阳台的架还没吵完呢！你快帮我们出主意啦！🎯',
    '嘿嘿有意思！但是彩彩现在满脑子都是打架呢！壳壳那个闷葫芦都不理我！小队长你快帮我们调解啦！不然我要闷坏啦！🐠',
  ],
  unfriendly: [
    '哼！小队长你怎么这样说话！我彩彩最讨厌不讲道理的人了！不理你了！😤',
    '什么嘛！我还以为小队长是来帮我们的，结果你也偏心！我不干我不干！',
    '哼！就算你是小队长也不能这么说话！我要去找沫沫告状！🐠',
  ],
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getScoreIncrement(category, text) {
  if (category === 'constructive') {
    // 根据输入长度和关键词密度决定加分
    const constructiveCount = KEYWORDS.constructive.filter(w => text.toLowerCase().includes(w)).length
    if (constructiveCount >= 3 && text.length >= 10) return 15
    if (constructiveCount >= 2 || text.length >= 8) return 12
    return 10
  }
  return 0
}

function getAngerDeltas(category) {
  if (category === 'constructive') return { keke: -8, caicai: -6 }
  if (category === 'unfriendly') return { keke: 8, caicai: 6 }
  return { keke: 1, caicai: 1 } // off_topic: slight annoyance
}

function getEmotions(category) {
  if (category === 'constructive') return { keke: 'relieved', caicai: 'happy' }
  if (category === 'unfriendly') return { keke: 'sad', caicai: 'angry' }
  return { keke: 'confused', caicai: 'confused' }
}

app.post('/api/assessment/level3-chat', (req, res) => {
  try {
    const { student_input, round, current_harmony, current_keke_anger, current_caicai_anger } = req.body

    if (!student_input || typeof student_input !== 'string') {
      return res.status(400).json({ success: false, message: '缺少学生输入 (student_input)' })
    }

    const text = student_input.trim()
    if (text.length < 1) {
      return res.status(400).json({ success: false, message: '输入内容不能为空' })
    }

    // 1. 分类
    const category = classifyInput(text)

    // 2. 加分
    const scoreIncrement = getScoreIncrement(category, text)

    // 3. 愤怒值变化
    const angerDeltas = getAngerDeltas(category)

    // 4. NPC 回复（随机选取）
    const kekeReply = randomPick(KEKE_REPLIES[category])
    const caicaiReply = randomPick(CAICAI_REPLIES[category])

    // 5. 情绪
    const emotions = getEmotions(category)

    // 6. 计算新的和解度
    const newHarmony = Math.min(100, (current_harmony || 70) + scoreIncrement)
    const newKekeAnger = Math.max(0, Math.min(100, (current_keke_anger || 50) + angerDeltas.keke))
    const newCaicaiAnger = Math.max(0, Math.min(100, (current_caicai_anger || 50) + angerDeltas.caicai))

    return res.json({
      success: true,
      data: {
        score_increment: scoreIncrement,
        category,
        keke_reply: kekeReply,
        caicai_reply: caicaiReply,
        keke_emotion: emotions.keke,
        caicai_emotion: emotions.caicai,
        new_harmony: newHarmony,
        new_keke_anger: newKekeAnger,
        new_caicai_anger: newCaicaiAnger,
        keke_anger_delta: angerDeltas.keke,
        caicai_anger_delta: angerDeltas.caicai,
      },
    })
  } catch (err) {
    console.error('[Level3 Chat Error]', err)
    return res.status(500).json({ success: false, message: '服务器内部错误', error: err.message })
  }
})

// ================================================================
// 健康检查
// ================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

// ================================================================
// 启动服务器
// ================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║     🌊 蔚蓝深海基地 · API 服务器          ║
║     ───────────────────────────            ║
║     🚀 端口: ${PORT}                        ║
║     📍 http://localhost:${PORT}              ║
║     📦 数据存储: db_logs.json              ║
║     🔬 天赋评估引擎: 已就绪                 ║
╚════════════════════════════════════════════╝
  `)
})
