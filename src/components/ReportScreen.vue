<template>
  <div class="report-screen flex flex-col h-full p-3 md:p-5 gap-4 overflow-auto">

    <!-- 顶部标题 -->
    <div class="report-header shrink-0 flex items-center justify-between">
      <div>
        <h2 class="text-xl md:text-2xl font-bold text-cyan-800" v-html="p('📊 多元智能发展报告')"></h2>
      <p class="text-sm text-cyan-100/90" v-html="p('蔚蓝深海基地 · 儿童多元智能评估系统 v2.0')"></p>
      <p class="text-xs text-cyan-50/80 mt-0.5">本报告面向家长与教育工作者，解读儿童在游戏化情境中的发展表现</p>
      </div>
      <div class="text-right text-xs text-cyan-100/80">
        <div v-if="gameState.playerName" class="text-sm font-bold text-cyan-700">{{ gameState.playerName }}</div>
        <div>ID: {{ gameState.studentId }}</div>
        <div>年龄: {{ gameState.age || '—' }}岁</div>
        <div>评测日期: {{ today }}</div>
        <div>总耗时: {{ totalTime }}</div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center animate-pulse">
        <MomoDolphin size="xl" class="block mx-auto mb-4" />
        <div class="text-cyan-500 text-base">正在生成专属报告...</div>
        <div class="text-cyan-700/90 text-sm font-medium mt-1">正在基于游戏行为数据生成评估报告 🧠</div>
      </div>
    </div>

    <!-- 家长快速阅读摘要 -->
    <section v-if="!loading && report" class="report-overview">

      <!-- ⚠️ 无操作数据警告（全跳关时显示） -->
      <div v-if="noGameplayData"
           class="overview-warning-banner">
        <span class="owb-icon">⚠️</span>
        <div class="owb-text">
          <strong>本次评估未产生游戏操作数据</strong>
          <p>所有关卡均被跳过，未实际完成游戏任务。报告中各项评分基于默认值，不能代表真实能力水平。建议完成实际关卡后重新生成评估报告。</p>
        </div>
      </div>

      <div class="overview-score">
        <span class="overview-kicker">综合潜能</span>
        <strong>{{ summaryScore }}</strong>
        <span>{{ quantGrade.label || '多元发展' }}</span>
      </div>
      <div class="overview-main">
        <div class="overview-heading">
          <span>✨ 报告摘要</span>
          <span class="overview-temperament">气质类型 · {{ temperamentLabel }}</span>
        </div>
        <p>{{ coreEvaluation }}</p>
        <div class="overview-strengths">
          <span v-for="item in topStrengthItems" :key="item.name">
            🏆 {{ item.name }} <b>{{ item.score }}分</b>
          </span>
        </div>
      </div>
    </section>

    <!-- 🔍 关键发现高亮（新增） -->
    <section v-if="!loading && report && keyFindings.length" class="report-key-findings">
      <div class="key-findings-header">
        <span>🔍 关键发现</span>
        <small>基于游戏行为数据自动识别</small>
      </div>
      <div class="key-findings-grid">
        <div v-for="(f, i) in keyFindings" :key="i"
             class="key-finding-item"
             :class="'kf-' + f.type">
          <span class="kf-icon">{{ f.icon }}</span>
          <div class="kf-body">
            <strong>{{ f.title }}</strong>
            <p>{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 章节快捷目录 -->
    <nav v-if="!loading && report" class="report-toc" aria-label="报告章节目录">
      <span class="report-toc-label">快速查看</span>
      <button v-for="item in reportSections" :key="item.id" @click="scrollToSection(item.id)">
        <span>{{ item.icon }}</span>{{ item.label }}
      </button>
    </nav>

    <!-- 报告主体 -->
    <div v-if="!loading && report" class="report-body flex-none flex items-start gap-4">

      <!-- ===== 左栏：雷达图 + 分数概览 ===== -->
      <div class="report-summary-column w-[380px] shrink-0 flex flex-col gap-4">

        <!-- 📊 行为量化评分（顶部展示） -->
        <div v-if="quantReport"
             class="bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-50 rounded-xl p-3 border border-indigo-200/40">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-bold text-indigo-600" v-html="p('📊 行为量化评分 · 综合潜能')"></span>
            <span class="text-xs text-indigo-700/80 font-medium">客观行为数据自动计算</span>
          </div>
          <div class="flex items-center justify-center gap-4 mb-2">
            <div class="text-center">
              <div class="text-3xl font-bold" :style="{ color: quantGrade.color }">{{ quantGrade.label }}</div>
              <div class="text-[10px] font-bold" :style="{ color: quantGrade.color }">{{ quantGrade.level }}</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-indigo-700">{{ comprehensiveScore }}</div>
          <div class="text-xs text-indigo-700/80 font-medium">综合得分</div>
            </div>
          </div>
          <!-- 四项得分横条 -->
          <div class="space-y-1">
            <div v-for="bar in scoreBars" :key="bar.key" class="flex items-center gap-1.5">
              <span class="text-[9px] text-indigo-500/70 w-12 shrink-0" v-html="p(bar.label)"></span>
              <div class="flex-1 h-1.5 bg-indigo-100/60 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: (bar.score / 5) * 100 + '%', background: bar.color }"></div>
              </div>
              <span class="text-[9px] font-bold w-3 text-right" :style="{ color: bar.color }">{{ bar.score }}</span>
            </div>
          </div>
        </div>

        <!-- 6维雷达图 -->
        <div id="ability-radar" class="report-anchor bg-white/60 rounded-xl p-3 border border-cyan-200/30 flex flex-col items-center">
          <h3 class="text-sm font-bold text-cyan-700 mb-1" v-html="p('🧠 六维智能雷达图')"></h3>
          <svg viewBox="0 0 300 300" class="w-full max-w-[260px]">
            <!-- 背景网格 -->
            <polygon v-for="level in 5" :key="level"
                     :points="gridPoints(level / 5)"
                     fill="none" stroke="rgba(34,211,238,0.12)" stroke-width="1" />
            <!-- 维度轴 -->
            <line v-for="(d, i) in dims" :key="'axis'+i"
                  :x1="150" :y1="150"
                  :x2="150 + 120 * Math.cos(angle(i))"
                  :y2="150 - 120 * Math.sin(angle(i))"
                  stroke="rgba(34,211,238,0.2)" stroke-width="1" />
            <!-- 维度标签 -->
            <text v-for="(d, i) in dims" :key="'label'+i"
                  :x="150 + 140 * Math.cos(angle(i))"
                  :y="150 - 140 * Math.sin(angle(i))"
                  :fill="d.color" font-size="13" text-anchor="middle" dominant-baseline="middle"
                  font-weight="bold">{{ d.label }}</text>
            <!-- 评分值 -->
            <text v-for="(d, i) in dims" :key="'val'+i"
                  :x="150 + 85 * Math.cos(angle(i))"
                  :y="150 - 85 * Math.sin(angle(i))"
                  fill="white" font-size="12" text-anchor="middle" dominant-baseline="middle"
                  font-weight="bold">{{ displayScore(d.key) }}</text>
            <!-- 同龄人参考虚线（5.5分 = 同龄平均） -->
            <polygon :points="refPoints"
                     fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4" />
            <text x="150" y="100" fill="#94a3b8" font-size="9" text-anchor="middle"
                  font-weight="600">— • — 同龄均值</text>
            <!-- 数据多边形 -->
            <polygon :points="dataPoints"
                     fill="rgba(34,211,238,0.2)" stroke="#22d3ee" stroke-width="2" />
            <circle v-for="(d, i) in dims" :key="'dot'+i"
                    :cx="150 + (displayScore(d.key) / 10) * 120 * Math.cos(angle(i))"
                    :cy="150 - (displayScore(d.key) / 10) * 120 * Math.sin(angle(i))"
                    :fill="d.color" r="5" stroke="white" stroke-width="2" />
          </svg>

          <!-- 等级标签 -->
          <div class="flex flex-wrap gap-1.5 mt-2 justify-center">
            <span v-for="(lvl, key) in gradeLabels" :key="key"
                  class="px-2 py-0.5 rounded text-[10px]"
                  :class="lvl.bg">{{ lvl.label }}</span>
          </div>
        </div>

        <!-- 先天气质卡片 -->
        <div id="temperament" class="report-anchor bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200/40">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-bold text-amber-700" v-html="p('🌟 先天气质')"></span>
            <span class="text-xs font-bold text-amber-600 bg-amber-100/60 px-2 py-0.5 rounded-full">{{ temperamentLabel }}</span>
          </div>
          <p class="text-[10px] text-amber-700/80 leading-relaxed">{{ temperamentDesc }}</p>
          <div class="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
            <div v-for="(val, key) in temperamentDims" :key="key" class="text-[9px] text-amber-600/70 flex justify-between">
              <span>{{ key }}</span>
              <span class="font-bold">{{ val }}</span>
            </div>
          </div>
        </div>

        <!-- 埃里克森人格品质 -->
        <div class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 border border-cyan-200/40">
          <span class="text-sm font-bold text-cyan-700" v-html="p('🎖️ 人格品质')"></span>
          <div class="mt-1 space-y-1">
            <div v-for="(val, key) in eriksonData" :key="key" class="flex items-center gap-2">
              <span class="text-[10px] text-cyan-600/80 w-14 shrink-0">{{ key === 'diligence' ? '勤勉感' : '自信心' }}</span>
              <div class="flex-1 h-2 bg-cyan-100/60 rounded-full overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" :style="{ width: (val / 10) * 100 + '%' }"></div>
              </div>
              <span class="text-[10px] font-bold text-cyan-600 w-6 text-right">{{ val }}</span>
            </div>
          </div>
        </div>

        <!-- 📋 潜能待发展 -->
        <div v-if="report.weaknesses && report.weaknesses.length > 0"
             class="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-3 border border-amber-200/40">
          <h4 class="text-sm font-bold text-amber-700 mb-1" v-html="p('🌱 潜能待发展')"></h4>
          <p class="text-[10px] text-amber-700/80 leading-relaxed whitespace-pre-line">{{ report.weakness_analysis }}</p>
        </div>

        <!-- 💡 个性化培养建议 -->
        <div id="growth-suggestions" class="report-anchor bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-200/40">
          <h4 class="text-sm font-bold text-emerald-700 mb-1" v-html="p('💡 培养建议')"></h4>
          <div v-if="suggestionsParsed.parent && suggestionsParsed.parent.length" class="mb-2">
            <span class="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full mb-1" v-html="p('🏠 给家长的建议')"></span>
            <ul class="text-[10px] text-emerald-700/80 leading-relaxed space-y-1 ml-0">
              <li v-for="(s, i) in suggestionsParsed.parent" :key="'p'+i" class="list-disc list-inside">{{ s }}</li>
            </ul>
          </div>
          <div v-if="suggestionsParsed.teacher && suggestionsParsed.teacher.length">
            <span class="inline-block text-[10px] font-bold text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full mb-1" v-html="p('🏫 给老师的建议')"></span>
            <ul class="text-[10px] text-cyan-700/80 leading-relaxed space-y-1 ml-0">
              <li v-for="(s, i) in suggestionsParsed.teacher" :key="'t'+i" class="list-disc list-inside">{{ s }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ===== 右栏：详细分析 ===== -->
      <div class="report-detail-column flex-1 flex flex-col gap-3 min-w-0">

        <!-- ⭐ 天赋优势总结 -->
        <div class="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-3 border border-emerald-200/40">
          <h4 class="text-sm font-bold text-emerald-700 mb-1" v-html="p('⭐ 天赋优势总结')"></h4>
          <p class="text-[10px] text-emerald-700/80 leading-relaxed whitespace-pre-line">{{ report.strength_summary }}</p>
          <div class="flex gap-2 mt-1.5">
            <span v-for="(s, i) in report.top3_strengths" :key="i"
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="['bg-emerald-100 text-emerald-600', 'bg-cyan-100 text-cyan-600', 'bg-amber-100 text-amber-600'][i]">
              🏆 {{ s[0] }} {{ s[1] }}分
            </span>
          </div>
        </div>

        <!-- 📊 行为量化智能解读（新增） -->
        <div v-if="quantReport?.commentary"
             class="bg-gradient-to-r from-indigo-50 to-sky-50 rounded-xl p-3 border border-indigo-200/40">
          <h4 class="text-sm font-bold text-indigo-700 mb-1.5" v-html="p('📋 行为量化智能解读')"></h4>
          <div class="space-y-2">
            <div v-for="item in commentaryItems" :key="item.key"
                 class="bg-white/60 rounded-lg px-3 py-2 border border-indigo-100/40">
              <div class="flex items-center gap-1.5 mb-0.5">
                <span class="text-xs">{{ item.icon }}</span>
                <span class="text-[10px] font-bold" :style="{ color: item.color }">{{ item.label }}</span>
                <span class="text-[8px] text-indigo-400/70 ml-1">{{ item.sublabel }}</span>
                <span class="text-[10px] ml-auto font-bold" :style="{ color: item.color }">{{ item.score }}分/5分</span>
              </div>
              <!-- 行为证据标签 -->
              <div v-if="item.evidence && item.evidence.length" class="evidence-row-enhanced">
                <span v-for="(ev, ei) in item.evidence" :key="ei"
                      class="evidence-chip" :class="ev.cls || ''">
                  {{ ev.text }} <span class="chip-val">{{ ev.val }}</span>
                  <span v-if="ev.norm" style="color:#94a3b8;font-weight:400;font-size:0.6rem">({{ ev.norm }})</span>
                </span>
              </div>
              <p class="text-[9px] text-indigo-600/70 leading-relaxed">{{ item.text }}</p>
            </div>
          </div>
        </div>

        <!-- 📈 六维能力卡：宽屏两列 -->
        <section class="dimension-section">
          <div class="dimension-section-heading">
            <div>
              <span>📈 六维能力解读</span>
              <small>结论均附带本次游戏行为依据</small>
            </div>
            <div class="dimension-tier-legend">
              <span class="tier-strong">突出优势</span>
              <span class="tier-stable">稳定能力</span>
              <span class="tier-develop">待发展潜能</span>
            </div>
          </div>
          <div class="dimension-card-grid">
            <article v-for="dim in dimensionList" :key="dim.key"
                     class="dimension-analysis-card"
                     :class="dimensionTier(displayScore(dim.key)).className">
              <div class="dimension-card-head">
                <span class="dimension-card-icon" :style="{ background: dim.gradient }">{{ dim.icon }}</span>
                <div>
                  <h4 :style="{ color: dim.color }">{{ dim.label }}</h4>
                  <span :class="dimensionTier(displayScore(dim.key)).className">{{ dimensionTier(displayScore(dim.key)).label }}</span>
                </div>
                <strong :style="{ color: dim.color }">{{ displayScore(dim.key) }}<small>/10</small></strong>
              </div>
              <div class="dimension-progress">
                <i :style="{ width: (displayScore(dim.key) / 10) * 100 + '%', background: dim.gradient }"></i>
              </div>
              <p>{{ dimAnalysis(dim.key) || dimensionFallbackText(dim.key) }}</p>
              <div class="evidence-row">
                <span>数据依据</span>
                <b>{{ dimensionEvidence(dim.key) }}</b>
              </div>
            </article>
          </div>
        </section>

        <!-- 🧠 认知与执行功能特质 -->
        <div id="executive-function" class="report-anchor bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-3 border border-purple-200/40">
          <h4 class="text-sm font-bold text-purple-700 mb-1" v-html="p('🧠 认知与执行功能特质')"></h4>
          <div class="space-y-1">
            <div v-for="(val, key) in chexiData" :key="key" class="flex items-center gap-2">
              <span class="text-[10px] text-purple-600/80 w-20 shrink-0">{{ chexiLabel(key) }}</span>
              <div class="flex-1 h-2 bg-purple-100/60 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: (val / 10) * 100 + '%', background: val >= 7 ? '#a78bfa' : val >= 4 ? '#c4b5fd' : '#e9d5ff' }"></div>
              </div>
              <span class="text-[10px] font-bold text-purple-600 w-6 text-right">{{ val }}</span>
            </div>
          </div>
          <p class="text-[10px] text-purple-700/80 leading-relaxed mt-1.5 whitespace-pre-line">{{ report.cognitive_traits }}</p>
        </div>

        <!-- 💬 第三关对话分析 -->
        <div v-if="report.dialogue_analysis"
             id="dialogue-analysis"
             class="report-anchor bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl p-3 border border-rose-200/40">
          <h4 class="text-sm font-bold text-rose-700 mb-1" v-html="p('💬 对话行为分析')"></h4>
          <p class="text-[10px] text-rose-700/80 leading-relaxed whitespace-pre-line">{{ report.dialogue_analysis }}</p>
          <!-- 展示原始对话 -->
          <details class="mt-1.5">
            <summary class="text-[10px] text-rose-500 cursor-pointer">📝 查看原始对话记录</summary>
            <div class="mt-1 space-y-1 max-h-[200px] overflow-y-auto">
              <div v-for="(msg, i) in gameState.level3_dialogue" :key="i"
                   class="text-[9px] px-2 py-1 rounded"
                   :class="msg.role === 'player' ? 'bg-cyan-50 text-cyan-700 text-right' : msg.role === 'keke' ? 'bg-amber-50 text-amber-700' : msg.role === 'caicai' ? 'bg-rose-50 text-rose-700' : 'bg-cyan-50/60 text-cyan-600'">
                <span class="font-bold">{{ roleIcon(msg.role) }}</span>
                {{ msg.text }}
              </div>
            </div>
          </details>
        </div>

      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="report-actions shrink-0 flex justify-center gap-4 py-3">
      <button @mouseenter="playHover" @click="printReport"
              class="px-6 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm rounded-full shadow-lg hover:scale-105 transition-transform font-bold">
<span v-html="p('📥 下载报告(HTML)')"></span>
      </button>
      <button @mouseenter="playHover" @click="emit('back-start')"
              class="px-6 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-sm rounded-full shadow-lg hover:scale-105 transition-transform font-bold">
🔄 <span v-html="p('重新开始游戏')"></span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePinyinText } from '../utils/pinyin.js'
import MomoDolphin from './characters/MomoDolphin.vue'

const { p } = usePinyinText()
import { playHover, playClick } from '../utils/sounds.js'

const props = defineProps({
  gameState: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['back-start'])

// ════════════════════════════════════════════════════════════════
// 📐 年龄常模数据（与 backend scoring_config.py 保持一致）
// ════════════════════════════════════════════════════════════════
const AGE_NORMS = {
  "6":  { l1: 300, l2: 480, l3: 600, total: 1380 },
  "7":  { l1: 260, l2: 420, l3: 540, total: 1220 },
  "8":  { l1: 220, l2: 360, l3: 480, total: 1060 },
  "9":  { l1: 190, l2: 310, l3: 420, total: 920 },
  "10": { l1: 160, l2: 270, l3: 360, total: 790 },
}
const DEFAULT_AGE = "8"

function getAge() { return props.gameState.age || DEFAULT_AGE }
function getNorm(age) { return AGE_NORMS[age] || AGE_NORMS[DEFAULT_AGE] }

// ════════════════════════════════════════════════════════════════
// 🧩 原始数据快捷访问
// ════════════════════════════════════════════════════════════════
function l1() { return props.gameState.level1_raw || {} }
function l2() { return props.gameState.level2_raw || {} }
function l3() { return props.gameState.level3_raw || {} }

function totalDuration() {
  const g = props.gameState
  return (g.level1_duration || 0) + (g.level2_duration || 0) + (g.level3_duration || 0)
}

function invalidCount(metrics, keys) {
  return keys.reduce((sum, k) => sum + (metrics[k] || 0), 0)
}

function printReport() {
  playClick()
  if (!report.value) return

  const dims = [
    { key: '空间视觉智能', icon: '🏗️', color: '#22d3ee' },
    { key: '自然观察智能', icon: '🌿', color: '#fb923c' },
    { key: '逻辑数理智能', icon: '🧮', color: '#4ade80' },
    { key: '人际社交智能', icon: '🤝', color: '#a78bfa' },
    { key: '语言表达智能', icon: '💬', color: '#f472b6' },
    { key: '专注力与执行能力', icon: '🧠', color: '#f59e0b' },
  ]

  const scores = report.value.dimension_scores || {}
  const dimRows = dims.map(d => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:${d.color}">${d.icon} ${d.key}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">
        <div style="background:#e2e8f0;border-radius:8px;height:12px;width:100%;max-width:200px;overflow:hidden">
          <div style="height:100%;width:${(scores[d.key] || 5) / 10 * 100}%;background:${d.color};border-radius:8px;transition:width 0.5s"></div>
        </div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:18px">${scores[d.key] || 5}</td>
    </tr>
  `).join('')

  const chexiData = report.value.chexi || {}
  const chexiLabels = { task_persistence: '任务坚持力', flexibility: '思维变通力', anti_distraction: '抗分心能力', multi_step_planning: '多步骤统筹', experience_learning: '经验学习力' }
  const chexiRows = Object.entries(chexiData).map(([k, v]) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#6d28d9">${chexiLabels[k] || k}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center">
        <div style="background:#e2e8f0;border-radius:6px;height:10px;width:100%;max-width:150px;overflow:hidden">
          <div style="height:100%;width:${(v / 10) * 100}%;background:#a78bfa;border-radius:6px"></div>
        </div>
      </td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600">${v}</td>
    </tr>
  `).join('')

  const t = report.value.temperament || {}
  const tempDims = t.dimensions ? Object.entries(t.dimensions).map(([k, v]) =>
    `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:12px;font-size:13px;margin:3px">${k}: ${v}</span>`
  ).join('') : ''

  // 培养建议（分家长版和教师版）
  const sug = suggestionsParsed.value
  const parentTipsHtml = sug.parent && sug.parent.length
    ? `<h2 style="font-size:18px;color:#065f46;border-bottom:2px solid #d1fae5;padding-bottom:8px;margin:24px 0 12px 0">🏠 给家长的建议</h2>
       <div class="section"><ul style="margin:0;padding-left:20px">${sug.parent.map(s => `<li style="margin:6px 0;line-height:1.6;color:#475569">${s}</li>`).join('')}</ul></div>`
    : ''

  const teacherTipsHtml = sug.teacher && sug.teacher.length
    ? `<h2 style="font-size:18px;color:#155e75;border-bottom:2px solid #e0f2fe;padding-bottom:8px;margin:24px 0 12px 0">🏫 给老师的建议</h2>
       <div class="section"><ul style="margin:0;padding-left:20px">${sug.teacher.map(s => `<li style="margin:6px 0;line-height:1.6;color:#475569">${s}</li>`).join('')}</ul></div>`
    : ''

  // ── HTML增强：关键发现 + 量化评分证据 + 维度证据 + 建议引用行为数据 ──
  const g = props.gameState
  const _l1 = l1(); const _l2 = l2(); const _l3 = l3()
  const norm = getNorm(getAge())
  const totalD = totalDuration()
  const l1_inv = invalidCount(_l1, ['meaningless_clicks','blank_clicks','random_drags','invalid_drops'])
  const l2_inv = invalidCount(_l2, ['meaningless_clicks','invalid_drops'])
  const totalInv = l1_inv + l2_inv
  const totalOps = (_l1.total_operations||0) + (_l2.total_operations||0)
  const invRatio = totalOps > 0 ? (totalInv / totalOps * 100).toFixed(0) : 0
  const unf = _l3.unfriendly_count ?? 0

  // 关键发现HTML
  const kfItems = keyFindings.value.map(f =>
    `<div style="display:flex;align-items:flex-start;gap:8px;padding:10px 14px;border-radius:10px;margin-bottom:6px;${
      f.type === 'strong' ? 'background:#ecfdf5;border:1px solid #a7f3d0' :
      f.type === 'warn' ? 'background:#fff7ed;border:1px solid #fed7aa' :
      'background:#eff6ff;border:1px solid #bfdbfe'
    }">
      <span style="font-size:18px;line-height:1.4">${f.icon}</span>
      <div>
        <strong style="font-size:14px;color:#0f172a">${f.title}</strong>
        <p style="margin:2px 0 0 0;font-size:13px;color:#475569">${f.desc}</p>
      </div>
    </div>`
  ).join('')

  // 量化评分证据HTML
  const qs = quantReport.value?.scores || {}
  const qLabels = { S1_logical_spatial: '逻辑空间', S2_focus_self_control: '专注自控', S3_persistence: '意志坚持', S4_social_mediation: '社交调解' }
  const qColors = { S1_logical_spatial: '#22d3ee', S2_focus_self_control: '#a78bfa', S3_persistence: '#f59e0b', S4_social_mediation: '#f472b6' }
  const qKeys = ['S1_logical_spatial','S2_focus_self_control','S3_persistence','S4_social_mediation']
  const qRows = qKeys.map(k => {
    const sc = qs[k] || 0
    const ev = quantEvidence(k === 'S1_logical_spatial' ? 'S1' : k === 'S2_focus_self_control' ? 'S2' : k === 'S3_persistence' ? 'S3' : 'S4')
    const evChips = ev.map(e =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:3px 8px;border-radius:6px;background:white;border:1px solid #e2e8f0;white-space:nowrap;${e.cls === 'chip-strong' ? 'background:#d1fae5;border-color:#6ee7b7' : e.cls === 'chip-warn' ? 'background:#fed7aa;border-color:#fb923c' : ''}">
        ${e.text} <strong style="color:#0f172a">${e.val}</strong>
        ${e.norm ? `<span style="color:#94a3b8;font-weight:400">(${e.norm})</span>` : ''}
      </span>`
    ).join('')
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:${qColors[k]}">${qLabels[k]}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:800;font-size:20px;color:${qColors[k]}">${sc}/5</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0"><div style="display:flex;flex-wrap:wrap;gap:4px">${evChips}</div></td>
    </tr>`
  }).join('')

  // 维度证据行
  const dimKeys = ['spatial','logical','naturalist','interpersonal','linguistic','executive']
  const dimEvRows = dimKeys.map(key => {
    const dimNames = { spatial: '空间视觉智能', logical: '逻辑数理智能', naturalist: '自然观察智能', interpersonal: '人际社交智能', linguistic: '语言表达智能', executive: '专注力与执行能力' }
    const ev = dimensionEvidence(key)
    const iconMap = { spatial: '🏗️', logical: '🧮', naturalist: '🌿', interpersonal: '🤝', linguistic: '💬', executive: '🧠' }
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b;white-space:nowrap">${iconMap[key]} ${dimNames[key]}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;line-height:1.5">${ev}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>多维智能发展报告 - ${gs.value.studentId || 'stu_9527'}</title>
<style>
  body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f0f9ff; margin:0; padding:24px; color:#1e293b; font-size:16px; line-height:1.7; }
  .container { max-width:800px; margin:0 auto; background:white; border-radius:16px; padding:32px; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  h1 { font-size:24px; color:#155e75; margin:0 0 4px 0; display:flex; align-items:center; gap:8px; }
  h2 { font-size:18px; color:#155e75; border-bottom:2px solid #e0f2fe; padding-bottom:8px; margin:24px 0 12px 0; }
  h3 { font-size:15px; color:#155e75; margin:16px 0 8px 0; }
  .meta { color:#0e7490; font-size:14px; font-weight:600; margin-bottom:20px; }
  table { width:100%; border-collapse:collapse; }
  .badge { display:inline-block; padding:4px 12px; border-radius:12px; font-size:14px; font-weight:700; margin:3px; }
  .badge-green { background:#d1fae5; color:#065f46; }
  .badge-cyan { background:#cffafe; color:#155e75; }
  .badge-amber { background:#fef3c7; color:#92400e; }
  .badge-rose { background:#ffe4e6; color:#9f1239; }
  .section { background:#f8fafc; border-radius:14px; padding:20px; margin-bottom:16px; border:1px solid #dbeafe; box-shadow:0 4px 14px rgba(15,23,42,.04); }
  .kf-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:14px; padding:16px 20px; margin-bottom:20px; }
  .footer { text-align:center; color:#64748b; font-size:13px; margin-top:28px; padding-top:18px; border-top:1px solid #e2e8f0; }
  .chip { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:#475569; background:white; padding:3px 8px; border-radius:6px; border:1px solid #e2e8f0; white-space:nowrap; }
  .chip-strong { background:#d1fae5; border-color:#6ee7b7; }
  .chip-strong .chip-val { color:#047857; }
  .chip-warn { background:#fed7aa; border-color:#fb923c; }
  .chip-warn .chip-val { color:#c2410c; }
</style></head>
<body>
<div class="container">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <div>
      <h1>📊 多元智能发展报告</h1>
      <div class="meta">蔚蓝深海基地 · 儿童多元智能评估系统 v2.0</div>
      <div style="font-size:14px;color:#475569;margin-top:2px">本报告面向家长及教育工作者，基于游戏化情境中的客观行为数据生成</div>
    </div>
    <div style="text-align:right;font-size:14px;color:#475569;line-height:1.7">
      ${gs.value.playerName ? `<div style="font-size:16px;font-weight:700;color:#155e75">${gs.value.playerName}</div>` : ''}
      <div>ID: ${gs.value.studentId || 'stu_9527'}</div>
      <div>年龄: ${gs.value.age || '—'}岁</div>
      <div>日期: ${today}</div>
      <div>总耗时: ${totalTime.value}</div>
    </div>
  </div>

  <!-- 🔍 关键发现 -->
  ${kfItems ? `
  <div class="kf-box">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-weight:900;font-size:16px;color:#0f172a">🔍 关键发现</span>
      <span style="font-size:12px;color:#64748b">基于行为数据自动识别</span>
    </div>
    ${kfItems}
  </div>` : ''}

  <!-- 📊 行为量化评分（含证据） -->
  ${quantReport.value ? `
  <h2>📊 行为量化评分</h2>
  <div class="section" style="padding:16px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <span style="font-size:14px;font-weight:700;color:#4338ca">综合潜能 · ${quantReport.value.level_label || ''} (${quantReport.value.level || ''})</span>
      <span style="font-size:20px;font-weight:900;color:#4338ca">${quantReport.value.comprehensive_score?.toFixed(1) || '-'}</span>
      <span style="font-size:12px;color:#64748b">/ 5.0</span>
    </div>
    <table>${qRows}</table>
  </div>` : ''}

  <!-- 🧠 六维能力（含行为证据） -->
  <h2>🧠 六维能力评估</h2>
  <div class="section">
    <table>${dimEvRows}</table>
  </div>

  ${report.value.strength_summary ? `
  <h2>⭐ 天赋优势总结</h2>
  <div class="section"><p style="margin:0;line-height:1.7">${report.value.strength_summary}</p></div>
  ` : ''}

  ${report.value.top3_strengths && report.value.top3_strengths.length ? `
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
    ${report.value.top3_strengths.map((s, i) => `<span class="badge ${['badge-green','badge-cyan','badge-amber'][i]}">🏆 ${s[0]} ${s[1]}分</span>`).join('')}
  </div>
  ` : ''}

  <h2>🌟 先天气质</h2>
  <div class="section">
    <div style="font-weight:700;color:#d97706;margin-bottom:6px">${t.label || ''}</div>
    <p style="margin:0 0 8px 0;line-height:1.6">${t.desc || ''}</p>
    <div>${tempDims}</div>
  </div>

  <h2>🧠 认知与执行功能</h2>
  <div class="section">
    <table>${chexiRows}</table>
    ${report.value.cognitive_traits ? `<p style="margin:8px 0 0 0;line-height:1.6;color:#475569">${report.value.cognitive_traits}</p>` : ''}
  </div>

  ${report.value.dialogue_analysis ? `
  <h2>💬 对话行为分析</h2>
  <div class="section"><p style="margin:0;line-height:1.6">${report.value.dialogue_analysis}</p></div>
  ` : ''}

  ${parentTipsHtml}
  ${teacherTipsHtml}

  <div class="footer">
    🐬 蔚蓝深海基地 · 由 OceanTalentAI 评估引擎生成<br>
    本报告面向家长及教育工作者，建议结合儿童日常表现综合评估
  </div>
</div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `报告_${gs.value.studentId || 'student'}_${today.replace(/\//g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const gs = computed(() => props.gameState || {})
const today = new Date().toLocaleDateString('zh-CN')

/** 有效跳关次数：所有关卡无数据时强制至少3次 */
/** 跳关详情文本 */
function skipDetailsText() {
  const details = gs.value.skipLevelDetails || []
  if (!details.length) return ''
  const nameMap = { 'LEVEL_1': '第一关', 'LEVEL_2': '第二关', 'LEVEL_3': '第三关' }
  const names = details.map(d => nameMap[d] || d)
  return '跳过: ' + names.join('、')
}

function effectiveSkipCount() {
  const _l1 = l1()
  const _l2 = l2()
  const _l3 = l3()
  const hasAnyData = (_l1.total_operations || 0) > 0 || (_l2.total_operations || 0) > 0 || (_l3.rounds_used || 0) > 0
  const raw = gs.value.skipLevelCount || 0
  return hasAnyData ? raw : Math.max(raw, 3)
}

/** 是否完全没有游戏操作数据（全跳关） */
const noGameplayData = computed(() => {
  const skip = effectiveSkipCount()
  const l1_ops = (l1().total_operations || 0) + (l2().total_operations || 0)
  return skip >= 3 && l1_ops <= 0
})

// ===================================================================
// 报告数据（从后端API获取）
// ===================================================================
const loading = ref(true)
const report = ref(null)

// 📊 行为量化评分数据
const quantReport = ref(null)

onMounted(async () => {
  // 并行请求：传统报告 + 量化评分
  await Promise.all([
    fetchLegacyReport(),
    fetchQuantitativeReport(),
  ])
  loading.value = false
})

/** 获取传统6维加德纳报告 */
async function fetchLegacyReport() {
  try {
    const res = await fetch('http://localhost:8005/api/assessment/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'report_' + Date.now(),
        student_id: gs.value.studentId || 'stu_9527',
        level1_metrics: gs.value.level1_raw || {},
        level2_metrics: gs.value.level2_raw || {},
        level3_metrics: gs.value.level3_raw || {},
        level3_dialogue: gs.value.level3_dialogue || [],
      }),
    })
    const result = await res.json()
    if (result.success) {
      report.value = result.data
      // 无论后端返回什么，都用本地生成的家长/教师分栏建议覆盖
      report.value.suggestions = getLocalSuggestions()
    } else {
      throw new Error(result.message || '报告生成失败')
    }
  } catch (err) {
    console.warn('报告API调用失败，使用前端本地评分', err)
    report.value = generateLocalReport()
  }
}

/** 📊 获取行为量化评分报告 */
async function fetchQuantitativeReport() {
  // ⚠️ 安全兜底：检测三关均无操作数据但 skipCount 未正确记录的情况
  const _l1 = gs.value.level1_raw || {}
  const _l2 = gs.value.level2_raw || {}
  const _l3 = gs.value.level3_raw || {}
  const hasAnyData = (_l1.total_operations || 0) > 0 || (_l2.total_operations || 0) > 0 || (_l3.rounds_used || 0) > 0
  const effectiveSkip = hasAnyData ? (gs.value.skipLevelCount || 0) : Math.max(gs.value.skipLevelCount || 0, 3)

  try {
    const res = await fetch('http://localhost:8005/api/assessment/quantitative-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: gs.value.studentId || 'stu_9527',
        age: gs.value.age || '8',
        level1_metrics: _l1,
        level2_metrics: _l2,
        level3_metrics: _l3,
        total_skip_count: effectiveSkip,
      }),
    })
    const result = await res.json()
    if (result.success) {
      quantReport.value = result.data
    }
  } catch (err) {
    console.warn('量化评分接口调用失败，跳过量化报告', err)
    quantReport.value = null
  }
}

// ===================================================================
// 降级：本地报告生成（后端不可用时）
// ===================================================================
function generateLocalReport() {
  const g = gs.value
  const l1e = g.level1_errors || 0
  const l2p = g.level2_pipes_used || 0
  const l3h = g.level3_harmony_score || 0
  const skip = effectiveSkipCount()
  const hasData = (l1().total_operations || 0) + (l2().total_operations || 0) > 0 || (l3().rounds_used || 0) > 0

  // 全跳关无操作 → 所有维度假定为低分
  if (!hasData && skip >= 3) {
    return {
      dimension_scores: {
        '空间视觉智能': 1,
        '自然观察智能': 1,
        '逻辑数理智能': 1,
        '人际社交智能': 1,
        '语言表达智能': 1,
        '专注力与执行能力': 1,
      },
      dimension_analysis: {},
      chexi: { task_persistence: 1, flexibility: 1, anti_distraction: 1, multi_step_planning: 1, experience_learning: 1 },
      erikson: { diligence: 1, confidence: 1 },
      temperament: {
        label: '未完成评估',
        desc: '本次游戏中所有关卡均被跳过，未产生足够的操作数据用于评估先天气质。建议在完成实际关卡后重新生成报告。',
        dimensions: { '活动水平': '—', '趋避性': '—', '适应性': '—', '反应强度': '—' },
      },
      top3_strengths: [],
      weaknesses: ['逻辑空间智能', '自然观察智能', '逻辑数理智能', '人际社交智能', '语言表达智能', '专注力与执行能力'],
      strength_summary: '本次评估中所有关卡均被跳过，未能采集到足够的游戏行为数据用于识别天赋优势。',
      weakness_analysis: '由于未实际参与游戏关卡，各维度能力均缺乏评估数据，建议鼓励孩子完成游戏后重新评估。',
      cognitive_traits: '暂无认知与执行功能评估数据。请在完成实际关卡后重新生成报告。',
      dialogue_analysis: '',
      suggestions: getLocalSuggestions(),
    }
  }

  const spatial = Math.max(1, Math.min(10, Math.round((9 - l1e * 1.5 - Math.max(0, l2p - 8) * 0.3) * 10) / 10))
  const naturalist = Math.max(1, Math.min(10, Math.round((8.8 - l1e * 0.8) * 10) / 10))
  const logical = Math.max(1, Math.min(10, Math.round((8.5 - Math.max(0, l2p - 6) * 0.5) * 10) / 10))
  const interpersonal = Math.max(1, Math.min(10, Math.round((l3h * 0.08) * 10) / 10))
  const linguistic = Math.max(1, Math.min(10, Math.round((l3h * 0.08) * 10) / 10))
  const executive = Math.max(1, Math.min(10, Math.round((spatial + logical + interpersonal) / 3 * 10) / 10))

  return {
    dimension_scores: {
      '空间视觉智能': spatial,
      '自然观察智能': naturalist,
      '逻辑数理智能': logical,
      '人际社交智能': interpersonal,
      '语言表达智能': linguistic,
      '专注力与执行能力': executive,
    },
    dimension_analysis: {},
    chexi: {
      task_persistence: Math.min(10, Math.round((l3h / 100 * 5 + 3) * 10) / 10),
      flexibility: Math.min(10, Math.round((5 + (l2p > 8 ? 2 : 0)) * 10) / 10),
      anti_distraction: Math.max(1, Math.min(10, Math.round((8 - l1e * 0.5) * 10) / 10)),
      multi_step_planning: Math.min(10, Math.round((l3h / 100 * 5 + 2) * 10) / 10),
      experience_learning: Math.max(1, Math.min(10, Math.round((7 - Math.min(5, l1e)) * 10) / 10)),
    },
    erikson: {
      diligence: Math.min(10, Math.round(((l3h / 100) * 4 + 3) * 10) / 10),
      confidence: Math.min(10, Math.round(((l3h / 100) * 3 + 4) * 10) / 10),
    },
    temperament: {
      label: l3h >= 80 ? '阳光社交型' : l1e <= 1 ? '专注坚持型' : '沉稳细致型',
      desc: l3h >= 80 ? '该儿童性格开朗外向，乐于与人交往，在社交情境中表现出较高的主动性和合作倾向。' : '该儿童做事认真细致，有较好的耐心和专注维持能力，偏向沉稳型气质。',
      dimensions: {
        '活动水平': l2p >= 15 ? '偏高' : '适中',
        '趋避性': l1e <= 1 ? '趋向' : '平衡',
        '适应性': l1e <= 2 ? '较强' : '中等',
        '反应强度': l1e >= 3 ? '偏强' : '温和',
      },
    },
    top3_strengths: [],
    weaknesses: [],
    strength_summary: '该儿童在游戏过程中展现出以下优势特征，建议在日常教育中予以关注和培养。',
    weakness_analysis: '以下维度尚有发展空间，可通过针对性的活动和引导逐步提升。',
    cognitive_traits: '该儿童的认知与执行功能表现呈现以下特点，可作为个性化教学设计的参考依据。',
    dialogue_analysis: g.level3_dialogue && g.level3_dialogue.length > 0 ? '对话分析将在连接后端后生成。' : '',
    suggestions: getLocalSuggestions(),
  }
}

function getLocalSuggestions() {
  const g = props.gameState
  const _l1 = l1(); const _l2 = l2(); const _l3 = l3()
  const l1e = g.level1_errors || 0
  const l2p = g.level2_pipes_used || 0
  const l3h = g.level3_harmony_score || 0
  const norm = getNorm(getAge())
  const d1 = _l1.duration_seconds || g.level1_duration || 0
  const d2 = _l2.duration_seconds || g.level2_duration || 0
  const totalD = d1 + d2 + (_l3.duration_seconds || g.level3_duration || 0)
  const timeRatio = norm.total > 0 ? (totalD / norm.total).toFixed(2) : '—'
  const l1_inv = invalidCount(_l1, ['meaningless_clicks','blank_clicks','random_drags','invalid_drops'])
  const l2_inv = invalidCount(_l2, ['meaningless_clicks','invalid_drops'])
  const totalInv = l1_inv + l2_inv
  const totalOps = (_l1.total_operations||0) + (_l2.total_operations||0)
  const invRatio = totalOps > 0 ? (totalInv / totalOps * 100).toFixed(0) : 0
  const unf = _l3.unfriendly_count ?? 0
  const skill = effectiveSkipCount()

  // ── 家长引导建议（含行为证据引用） ──
  const parentTips = []
  if (totalD > 0) parentTips.push(
    `⏱ 观察记录：孩子完成三个关卡共用时 ${totalD}秒（同龄常模 ${norm.total}秒，时间比 ${timeRatio}），` +
    (totalD / norm.total <= 0.55 ? '效率显著超出同龄水平，建议继续保持节奏，同时注意避免任务过少带来的挑战不足。' :
     totalD / norm.total <= 1.0 ? '效率处于正常范围，可以通过限时小游戏逐步提升思维敏捷度。' :
     '效率偏慢，建议在日常活动中给予充足的完成时间，避免催促，通过分步骤引导降低认知负荷。')
  )
  if (totalInv > 0) {
    if (invRatio <= 10) parentTips.push(
      `🎯 操作精确度表现优秀（无效操作仅 ${totalInv}次/占比 ${invRatio}%），` +
      `说明孩子在动手前能先思考，这是很好的学习习惯，建议继续通过结构化的动手活动保持。`)
    else if (invRatio <= 20) parentTips.push(
      `🎯 操作中有 ${totalInv}次无效操作（占比 ${invRatio}%），处于正常范围。` +
      `可以通过"先想一想再动手"的口头提示，帮助进一步提升操作精准度。`)
    else parentTips.push(
      `⚠️ 无效操作占比较高（${totalInv}次/占比 ${invRatio}%），` +
      `L1中无效点击 ${l1_inv}次、L2中无效放置 ${l2_inv}次。建议在家多做"停-看-想-做"的四步练习：停下来，看一看目标，想一想怎么做，再动手。`)
  } else if (totalOps > 0) {
    parentTips.push(
      `🎯 三个关卡中零无效操作，表现出极高的专注力和自控力。` +
      `家长可继续提供需要持续注意力的活动（如乐高搭建、拼图、棋类），保持这一优势。`)
  } else {
    parentTips.push(
      `⚠️ 本次游戏中未产生操作记录，专注力评估缺少数据基础。` +
      `建议在完成实际关卡操作后重新评估，以便更准确地了解孩子的专注力发展水平。`)
  }
  if (_l1.check_attempts > 0) {
    if (_l1.check_attempts <= 1)
      parentTips.push(`🧩 第一关仅检查 ${_l1.check_attempts}次即全部配对正确（耗时 ${d1}秒），空间规划能力强。建议多玩建构类游戏（积木、七巧板）进一步发展。`)
    else if (_l1.check_attempts <= 3)
      parentTips.push(`🧩 第一关通过 ${_l1.check_attempts}次检查完成配对，过程中能根据反馈逐步调整。这种"试错-学习"的能力非常宝贵，建议给予充足的探索时间。`)
    else
      parentTips.push(`🧩 第一关尝试了 ${_l1.check_attempts}次才全部配对正确，建议在家玩配对游戏时，先和孩子一起观察图片再动手，培养"先观察再行动"的习惯。`)
  }
  const solQ = _l3.solution_quality ?? -1
  if (solQ >= 0) {
    if (solQ >= 2)
      parentTips.push(`🤝 第三关方案设计中选择了 ${solQ}/3个公平选项，表现出良好的公平意识和换位思考能力。在日常家庭决策中可多征求孩子的意见。`)
    else
      parentTips.push(`🤝 第三关方案设计选择了 ${solQ}/3个公平选项，可以在家庭中通过"轮流决定周末活动"等练习，帮助孩子理解什么是"对双方都公平"的方案。`)
  }
  if (unf > 0)
    parentTips.push(`🔴 对话中出现 ${unf}次不礼貌/脏话表达，建议在家中和孩子讨论：有不同意见时可以怎么好好说。可以通过角色扮演练习"我觉得……你可以……"的表达方式。`)
  if (skill > 0)
    parentTips.push(`⏭ 游戏中出现 ${skill}次跳关行为，遇到困难时倾向于放弃。建议日常中将大目标分解为小步骤，每完成一步都给予具体表扬，逐步培养"坚持到底"的品质。`)

  // ── 教师教学建议（含行为证据引用） ──
  const teacherTips = []
  const connected = _l2.successful_pairs ? true : false
  if (connected) {
    const pipes = _l2.pipe_count || _l2.block_drag_count || l2p || 0
    const optimal = 16
    const deviation = Math.max(0, pipes - optimal)
    if (deviation <= 2)
      teacherTips.push(`⚡ 逻辑推理能力突出（L2使用 ${pipes}根管道一次连通，接近最优 ${optimal}根），建议在数学课中提供拓展性思维题，或在小组合作中担任"策略规划"角色。`)
    else
      teacherTips.push(`⚡ L2通过 ${_l2.check_attempts || 1}次尝试连通能源水晶（使用 ${pipes}根管道），展现了坚持解决问题的态度。建议在课堂活动中肯定这种"不放弃"的精神。`)
  } else if (_l2.pipe_count || l2p) {
    teacherTips.push(`⚡ L2尝试 ${_l2.check_attempts || 0}次后尚未连通，建议在教学引导中使用"从简单开始"策略——先画出最简单的路线图，再一步步增加复杂度。`)
  }
  if (_l3.rounds_used > 0) {
    const harm = _l3.harmony_final || l3h || 0
    if (harm >= 80)
      teacherTips.push(`🤝 社交调解能力突出（和解度 ${harm}%，完成 ${_l3.rounds_used}轮调解），适合担任小组活动的协调者角色，引导其在集体中发挥沟通桥梁作用。`)
    else
      teacherTips.push(`🤝 L3调解和解度 ${harm}%，尚在发展社交协商能力的阶段。建议在课堂中安排结构化的小组合作任务，使用"轮流发言"的方法帮助练习表达与倾听。`)
  }
  if (_l3.emotion_correct > 0)
    teacherTips.push(`💗 情绪识别能力 ${_l3.emotion_correct}/2正确，建议在绘本阅读或班会课中多进行"猜猜TA是什么心情"的互动练习，培养同理心。`)
  if (unf > 0)
    teacherTips.push(`🔴 对话中出现 ${unf}次不礼貌表达，建议在班级中建立"好好说话"的规则，并通过正面示范帮助孩子学会用语言表达不满而非攻击性语言。`)
  if (totalInv > 0 && invRatio > 20)
    teacherTips.push(`🎯 课堂中可能需要额外的注意力支持（游戏中无效操作占 ${invRatio}%），建议安排前排座位，使用"任务清单"帮助维持学习目标。`)
  if (skill > 0)
    teacherTips.push(`⏭ 面对困难时有跳过的倾向，建议将学习任务分解为可达成的子目标，每次完成都给予积极反馈，建立"努力就能进步"的成长型思维。`)

  // 默认补充建议（区分全跳关 vs 有游戏数据）
  if (totalOps <= 0 && !_l3.rounds_used && skill >= 3) {
    if (parentTips.length < 1) parentTips.push('⚠️ 本次游戏所有关卡均被跳过，无法基于实际行为数据提供个性化建议。建议鼓励孩子从第一关开始完成游戏后重新生成报告。')
    if (teacherTips.length < 1) teacherTips.push('⚠️ 学生在本次评估中跳过了所有关卡，未产生操作数据。建议在课堂或家庭中观察学生在实际任务情境中的表现，并鼓励其尝试完成游戏关卡以获得更准确的评估。')
  } else {
    if (parentTips.length < 2) parentTips.push('🎯 各维度发展较为均衡，建议继续保持多元化的学习体验，鼓励孩子在感兴趣的领域深入探索。')
    if (teacherTips.length < 2) teacherTips.push('🎯 该儿童多元智能发展较为全面，建议在教学中提供多样化任务类型，观察其在不同情境中的偏好与优势。')
  }

  return JSON.stringify({ parent: parentTips, teacher: teacherTips })
}

// ===================================================================
// 显示数据处理
// ===================================================================
const totalTime = computed(() => {
  const total = (gs.value.level1_duration || 0) + (gs.value.level2_duration || 0) + (gs.value.level3_duration || 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
})

const reportSections = [
  { id: 'ability-radar', icon: '🧠', label: '能力雷达' },
  { id: 'temperament', icon: '🌟', label: '气质' },
  { id: 'executive-function', icon: '⚙️', label: '执行功能' },
  { id: 'dialogue-analysis', icon: '💬', label: '对话分析' },
  { id: 'growth-suggestions', icon: '🌱', label: '培养建议' },
]

function scrollToSection(id) {
  const target = document.getElementById(id)
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const allDimensionScores = computed(() => dimensionList.map(dim => ({
  name: dim.label,
  score: Number(displayScore(dim.key)) || 0,
})))

const topStrengthItems = computed(() => {
  const backend = report.value?.top3_strengths
  if (Array.isArray(backend) && backend.length) {
    return backend.slice(0, 3).map(item => ({
      name: Array.isArray(item) ? item[0] : item.name,
      score: Array.isArray(item) ? item[1] : item.score,
    }))
  }
  return [...allDimensionScores.value].sort((a, b) => b.score - a.score).slice(0, 3)
})

const summaryScore = computed(() => {
  if (quantReport.value?.comprehensive_score != null) {
    return Number(quantReport.value.comprehensive_score).toFixed(1)
  }
  const values = allDimensionScores.value.map(item => item.score)
  if (!values.length) return '-'
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
})

const coreEvaluation = computed(() => {
  const strongest = topStrengthItems.value[0]?.name || '多元能力'
  const score = topStrengthItems.value[0]?.score || ''
  if (report.value?.strength_summary) {
    const firstSentence = report.value.strength_summary.split(/[。！？\n]/).find(Boolean)
    if (firstSentence) return `${firstSentence}。`
  }
  return `孩子在${strongest}方面表现较为突出（${score}分），整体能力发展均衡，建议结合兴趣持续提供探索和实践机会。`
})

// 📊 行为量化评分显示数据
const comprehensiveScore = computed(() => {
  if (!quantReport.value) return '-'
  return quantReport.value.comprehensive_score?.toFixed(1) || '-'
})

const quantGrade = computed(() => {
  if (!quantReport.value) return { label: '', level: '', color: '#94a3b8' }
  return {
    label: quantReport.value.level_label || '',
    level: quantReport.value.level || '',
    color: quantReport.value.level_color || '#94a3b8',
  }
})

const scoreBars = computed(() => {
  if (!quantReport.value?.scores) return []
  const s = quantReport.value.scores
  return [
    { key: 'S1', label: '逻辑空间', score: s.S1_logical_spatial || 0, color: '#22d3ee' },
    { key: 'S2', label: '专注自控', score: s.S2_focus_self_control || 0, color: '#a78bfa' },
    { key: 'S3', label: '意志坚持', score: s.S3_persistence || 0, color: '#f59e0b' },
    { key: 'S4', label: '社交调解', score: s.S4_social_mediation || 0, color: '#f472b6' },
  ]
})

// 为每个量化维度生成行为证据摘要
function quantEvidence(scoreKey) {
  const g = props.gameState
  const _l1 = l1(); const _l2 = l2(); const _l3 = l3()
  const norm = getNorm(getAge())
  const d1 = _l1.duration_seconds || g.level1_duration || 0
  const d2 = _l2.duration_seconds || g.level2_duration || 0
  const d3 = _l3.duration_seconds || g.level3_duration || 0
  const totalD = d1 + d2 + d3
  const l1_inv = invalidCount(_l1, ['meaningless_clicks','blank_clicks','random_drags','invalid_drops'])
  const l2_inv = invalidCount(_l2, ['meaningless_clicks','invalid_drops'])
  const totalInv = l1_inv + l2_inv
  const totalOps = (_l1.total_operations||0) + (_l2.total_operations||0)
  const evMap = {
    S1: [
      { text: '耗时', val: totalD+'s', norm: '常模 '+norm.total+'s', cls: totalD <= norm.total * 0.55 ? 'chip-strong' : totalD <= norm.total * 0.85 ? '' : 'chip-warn' },
      { text: '速度比', val: (totalD / norm.total).toFixed(2) + 'x', norm: '≤0.55=5分', cls: totalD <= norm.total * 0.55 ? 'chip-strong' : '' },
      { text: 'L1检查', val: (_l1.check_attempts||0)+'次', norm: '1次最优', cls: _l1.check_attempts <= 1 ? 'chip-strong' : '' },
    ],
    S2: [
      { text: '无效操作', val: totalInv+'次', norm: '总操作 '+totalOps+'次', cls: totalInv === 0 && totalOps > 0 ? 'chip-strong' : totalInv === 0 ? 'chip-warn' : '' },
      { text: '占比', val: totalOps > 0 ? (totalInv/totalOps*100).toFixed(0)+'%' : '—', norm: '≤10%=5分', cls: totalInv === 0 && totalOps > 0 ? 'chip-strong' : totalOps === 0 ? 'chip-warn' : totalInv/totalOps <= 0.2 ? '' : 'chip-warn' },
      { text: 'L1无效', val: l1_inv+'次', norm: _l1.total_operations ? _l1.total_operations+'总' : '—' },
      { text: 'L2无效', val: l2_inv+'次', norm: _l2.total_operations ? _l2.total_operations+'总' : '—' },
    ],
    S3: [
      { text: '跳关', val: effectiveSkipCount()+'次', norm: skipDetailsText() || '0次=5分', cls: !effectiveSkipCount() ? 'chip-strong' : 'chip-warn' },
      { text: 'L1完成', val: (_l1.successful_pairs||0)+'/4', norm: _l1.check_attempts ? _l1.check_attempts+'次检查' : '直接跳过', cls: _l1.successful_pairs >= 4 ? 'chip-strong' : '' },
      { text: 'L2连通', val: _l2.successful_pairs ? '✅ 是' : '❌ 否', norm: _l2.check_attempts ? _l2.check_attempts+'次尝试' : '未参与', cls: _l2.successful_pairs ? 'chip-strong' : 'chip-warn' },
    ],
    S4: [
      { text: '和解度', val: (_l3.harmony_final || g.level3_harmony_score || 0)+'%', norm: '≥80%=5分', cls: (_l3.harmony_final||0) >= 80 ? 'chip-strong' : (_l3.harmony_final||0) >= 40 ? '' : 'chip-warn' },
      { text: '调解轮次', val: (_l3.rounds_used||0)+'轮', norm: '3轮满', cls: _l3.rounds_used >= 3 ? 'chip-strong' : '' },
      { text: '情绪识别', val: (_l3.emotion_correct||0)+'/2', norm: '' },
      { text: '方案质量', val: (_l3.solution_quality||0)+'/3', norm: '≥2公平通过', cls: (_l3.solution_quality||0) >= 2 ? 'chip-strong' : 'chip-warn' },
      (_l3.unfriendly_count||0) > 0 ? { text: '不友好', val: _l3.unfriendly_count+'次', norm: '', cls: 'chip-warn' } : null,
    ].filter(Boolean),
  }
  return evMap[scoreKey] || []
}

const commentaryItems = computed(() => {
  if (!quantReport.value?.commentary) return []
  const c = quantReport.value.commentary
  const s = quantReport.value.scores || {}
  return [
    { key: 'S1', icon: '🧩', label: '逻辑空间智能', color: '#22d3ee', score: s.S1_logical_spatial || 0, text: c.S1_commentary,
      sublabel: '思维加工速度 · 空间规划效率', evidence: quantEvidence('S1') },
    { key: 'S2', icon: '🎯', label: '专注自控智能', color: '#a78bfa', score: s.S2_focus_self_control || 0, text: c.S2_commentary,
      sublabel: '冲动控制 · 注意力维持', evidence: quantEvidence('S2') },
    { key: 'S3', icon: '💪', label: '意志坚持智能', color: '#f59e0b', score: s.S3_persistence || 0, text: c.S3_commentary,
      sublabel: '抗挫折 · 任务承诺', evidence: quantEvidence('S3') },
    { key: 'S4', icon: '🤝', label: '社交调解智能', color: '#f472b6', score: s.S4_social_mediation || 0, text: c.S4_commentary,
      sublabel: '共情 · 冲突解决', evidence: quantEvidence('S4') },
  ]
})

function displayScore(key) {
  if (!report.value || !report.value.dimension_scores) return 5
  const map = {
    spatial: '空间视觉智能',
    naturalist: '自然观察智能',
    logical: '逻辑数理智能',
    interpersonal: '人际社交智能',
    linguistic: '语言表达智能',
    executive: '专注力与执行能力',
  }
  const name = map[key] || key
  return report.value.dimension_scores[name] !== undefined ? report.value.dimension_scores[name] : 5
}

function dimAnalysis(key) {
  if (!report.value || !report.value.dimension_analysis) return ''
  const map = {
    spatial: '空间视觉智能',
    naturalist: '自然观察智能',
    logical: '逻辑数理智能',
    interpersonal: '人际社交智能',
    linguistic: '语言表达智能',
  }
  const name = map[key] || key
  return report.value.dimension_analysis[name] || ''
}

function dimensionTier(score) {
  if (score >= 8.5) return { label: '突出优势', className: 'tier-strong' }
  if (score >= 6) return { label: '稳定能力', className: 'tier-stable' }
  return { label: '待发展潜能', className: 'tier-develop' }
}

// ════════════════════════════════════════════════════════════════
// 📋 详细行为证据（每个维度展示具体操作数据 + 常模参照）
// ════════════════════════════════════════════════════════════════
function dimensionEvidence(key) {
  const g = props.gameState
  const _l1 = l1()
  const _l2 = l2()
  const _l3 = l3()
  const norm = getNorm(getAge())

  // 统一耗时
  const d1 = _l1.duration_seconds || g.level1_duration || 0
  const d2 = _l2.duration_seconds || g.level2_duration || 0
  const d3 = _l3.duration_seconds || g.level3_duration || 0
  const totalD = d1 + d2 + d3

  const evidenceMap = {
    // ── 空间视觉智能 ──
    spatial: (() => {
      const drags = _l1.block_drag_count || 0
      const checks = _l1.check_attempts || 0
      const removes = _l1.removal_count || 0
      const pairs = _l1.successful_pairs || 0
      const pipes = _l2.pipe_count || _l2.block_drag_count || g.level2_pipes_used || 0
      const rotates = _l2.rotate_count || 0
      const optimal = 16
      const timeRatio = totalD > 0 && norm.total > 0 ? (totalD / norm.total).toFixed(2) : '—'
      return [
        `⏱ 总耗时 ${totalD}秒（${getAge()}岁常模 ${norm.total}秒，比值 ${timeRatio}）`,
        `🐠 L1：拖拽 ${drags}次 / 检查 ${checks}次 / 移除 ${removes}次 / 配对 ${pairs}/4`,
        `⚡ L2：管道 ${pipes}根（最优 ${optimal}根） / 旋转 ${rotates}次`,
        `📊 L1${checks <= 1 ? '✅ 一次通过' : checks <= 3 ? '✓ 数次检查后通过' : '⚠️ 多次检查'} | L2${_l2.successful_pairs ? '✅ 连通' : '❌ 未连通'}`,
      ].join(' | ')
    })(),

    // ── 自然观察智能 ──
    naturalist: (() => {
      const pairs = _l1.successful_pairs || 0
      const checks = _l1.check_attempts || 0
      const drags = _l1.block_drag_count || 0
      const history = _l1.check_history || []
      const firstPass = history.length > 0
        ? history[0].pairs?.filter(p => p.done).length || 0
        : 0
      return [
        `🐠 完成 ${pairs}/4 组生态配对`,
        `🔍 检查 ${checks}次${firstPass > 0 ? `（首次已对 ${firstPass}/4）` : ''}`,
        `🔄 共拖拽 ${drags}次（最少需 8 次）${drags <= 10 ? '✅ 精准高效' : drags <= 16 ? '✓ 尝试适中' : '⚠️ 多次调整'}`,
      ].join(' | ')
    })(),

    // ── 逻辑数理智能 ──
    logical: (() => {
      const pipes = _l2.pipe_count || _l2.block_drag_count || g.level2_pipes_used || 0
      const rotates = _l2.rotate_count || 0
      const checks = _l2.check_attempts || 0
      const connected = _l2.successful_pairs ? true : false
      const optimal = 16
      const deviation = Math.max(0, pipes - optimal)
      return [
        `⚡ L2：${pipes}根管道（最优 ${optimal}根，偏差 ${deviation}）`,
        `🔄 旋转 ${rotates}次 / 检查 ${checks}次`,
        `${connected ? '✅ 成功连通能源水晶' : '❌ 未连通（尝试 ${checks}次后放弃）'}`,
        `📊 管道效率：${deviation === 0 ? '★ 完美契合最优路径' : deviation <= 4 ? '☆ 接近最优' : '需要提升规划效率'}`,
      ].join(' | ')
    })(),

    // ── 人际社交智能 ──
    interpersonal: (() => {
      const harmony = _l3.harmony_final || g.level3_harmony_score || 0
      const rounds = _l3.rounds_used || 0
      const emotion = _l3.emotion_correct ?? 0
      const evidence = _l3.evidence_correct ?? 0
      const needs = _l3.needs_correct ?? 0
      const solution = _l3.solution_quality ?? 0
      const unf = _l3.unfriendly_count ?? 0
      return [
        `💚 和解度 ${harmony}%${harmony >= 80 ? ' ✅' : harmony >= 50 ? ' ✓' : ' ⚠️'}`,
        `💬 调解 ${rounds}轮`,
        `🎯 情绪识别 ${emotion}/2 | 文字证据 ${evidence}/2 | 需求区分 ${needs}/4 | 方案质量 ${solution}/3`,
        unf > 0 ? `🔴 不友好输入 ${unf}次` : '✅ 全程礼貌交流',
      ].join(' | ')
    })(),

    // ── 语言表达智能 ──
    linguistic: (() => {
      const rounds = _l3.rounds_used || 0
      const blocks = _l3.sentence_blocks_used || 0
      const dialogue = g.level3_dialogue || []
      const playerMsgs = dialogue.filter(m => m.role === 'player')
      const totalChars = playerMsgs.reduce((s, m) => s + (m.text || '').length, 0)
      const avgLen = playerMsgs.length > 0 ? (totalChars / playerMsgs.length).toFixed(0) : 0
      const harmony = _l3.harmony_final || g.level3_harmony_score || 0
      return [
        `💬 ${playerMsgs.length}轮发言 / 共 ${totalChars}字`,
        `📝 平均每轮 ${avgLen}字${avgLen >= 10 ? ' ✅ 表达完整' : avgLen >= 5 ? ' ✓ 基本达意' : ' ⚠️ 偏简短'}`,
        `🧱 使用句子积木 ${blocks}种`,
        harmony >= 80 ? '💚 正向语言促进和解' : '正向表达有提升空间',
      ].join(' | ')
    })(),

    // ── 专注力与执行能力 ──
    executive: (() => {
      const l1_inv = invalidCount(_l1, ['meaningless_clicks', 'blank_clicks', 'random_drags', 'invalid_drops'])
      const l2_inv = invalidCount(_l2, ['meaningless_clicks', 'invalid_drops'])
      const l1_ops = _l1.total_operations || 0
      const l2_ops = _l2.total_operations || 0
      const totalInv = l1_inv + l2_inv
      const totalOps = l1_ops + l2_ops
      const invRatio = totalOps > 0 ? (totalInv / totalOps * 100).toFixed(0) : null
      const checks = (_l1.check_attempts || 0) + (_l2.check_attempts || 0)
      const skip = effectiveSkipCount()
      if (totalOps <= 0) {
        return [
          `⚠️ 未产生操作数据，专注力无法基于本游戏评估。`,
          skip > 0 ? `⏭ 全部 ${skip}关已跳过，建议在完成实际关卡后重新评估。` : '需要更多游戏数据。',
        ].join(' | ')
      }
      return [
        `🎯 总操作 ${totalOps}次，无效 ${totalInv}次（占比 ${invRatio}%）`,
        `${invRatio <= 10 ? '✅ 专注力极强' : invRatio <= 20 ? '✓ 专注力良好' : invRatio <= 35 ? '🟡 中度分心' : '⚠️ 冲动控制需关注'}`,
        `📋 关卡检查共 ${checks}次`,
        skip > 0 ? `⏭ 跳关 ${skip}次` : '✅ 无跳关，全程坚持',
      ].join(' | ')
    })(),
  }
  return evidenceMap[key] || '来自本次游戏过程数据'
}

// ════════════════════════════════════════════════════════════════
// 🔍 关键发现（基于行为数据自动生成高亮）
// ════════════════════════════════════════════════════════════════
const keyFindings = computed(() => {
  const g = props.gameState
  const _l1 = l1()
  const _l2 = l2()
  const _l3 = l3()
  const findings = []

  // —— 优秀发现（绿色） ——
  const d1 = _l1.duration_seconds || g.level1_duration || 0
  const d2 = _l2.duration_seconds || g.level2_duration || 0
  const d3 = _l3.duration_seconds || g.level3_duration || 0
  const totalD = d1 + d2 + d3
  const norm = getNorm(getAge())
  const timeRatio = totalD / norm.total

  if (_l1.check_attempts === 1 && _l1.successful_pairs >= 4) {
    findings.push({ type: 'strong', icon: '✅', title: 'L1 一次通过', desc: '第一关一次检查即全部配对正确，空间规划效率高' })
  }
  if (_l2.check_attempts === 1 && _l2.successful_pairs) {
    findings.push({ type: 'strong', icon: '✅', title: 'L2 一次连通', desc: '第二关一次检查即连通能源水晶，逻辑规划清晰' })
  }
  if (timeRatio <= 0.55 && totalD > 0) {
    findings.push({ type: 'strong', icon: '⚡', title: '极速通关', desc: `总耗时 ${totalD}秒，仅为同龄常模的 ${(timeRatio * 100).toFixed(0)}%，思维效率突出` })
  }
  const l1_inv = invalidCount(_l1, ['meaningless_clicks', 'blank_clicks', 'random_drags', 'invalid_drops'])
  const l2_inv = invalidCount(_l2, ['meaningless_clicks', 'invalid_drops'])
  const totalInv = l1_inv + l2_inv
  const totalOps = (_l1.total_operations || 0) + (_l2.total_operations || 0)
  if (totalInv === 0 && totalOps > 0) {
    findings.push({ type: 'strong', icon: '🎯', title: '零无效操作', desc: '三个关卡无任何无效操作，专注力卓越' })
  }
  const harm = _l3.harmony_final || g.level3_harmony_score || 0
  if (harm >= 90) {
    findings.push({ type: 'strong', icon: '🤝', title: '和解度 ' + harm + '%', desc: '成功让壳壳和彩彩达成高度和解，社交调解能力出色' })
  }
  if (_l3.solution_quality === 3) {
    findings.push({ type: 'strong', icon: '🧩', title: '双赢方案满分', desc: '时间、声音、沟通三方面均选择了公平方案' })
  }
  if (_l3.emotion_correct === 2 && _l3.evidence_correct === 2) {
    findings.push({ type: 'strong', icon: '💗', title: '情绪识别满分', desc: '准确识别双方情绪并找到文字证据，共情能力强' })
  }

  // —— 关注发现（橙色） ——
  const unf = _l3.unfriendly_count ?? 0
  if (unf > 0) {
    findings.push({ type: 'warn', icon: '🔴', title: `脏话行为 ${unf}次`, desc: `对话中出现 ${unf}次不友好/脏话输入，建议关注社交表达方式` })
  }
  if (totalInv > 0) {
    const ratio = totalOps > 0 ? (totalInv / totalOps * 100) : 0
    if (ratio > 30) {
      findings.push({ type: 'warn', icon: '⚠️', title: `无效操作 ${ratio.toFixed(0)}%`, desc: `无效操作占比偏高 (${ratio.toFixed(0)}%)，建议培养事前规划的习惯` })
    }
  }
  if (!_l2.successful_pairs && (_l2.pipe_count || 0) > 0) {
    findings.push({ type: 'warn', icon: '⚠️', title: 'L2 未连通', desc: '第二关尝试后未能连通，遇到困难时可以从简单方案重新开始' })
  }
  if (harm < 40 && _l3.rounds_used > 0) {
    findings.push({ type: 'warn', icon: '💬', title: '和解度偏低 ' + harm + '%', desc: '调解效果不理想，建议在日常中多加练习换位思考' })
  }

  // —— 对比发现（蓝色） ——
  if (totalD > 0 && timeRatio > 0 && timeRatio < 1) {
    findings.push({ type: 'info', icon: '📊', title: `速度是同龄人的 ${(1 / timeRatio).toFixed(1)}倍`, desc: `完成速度${timeRatio <= 0.55 ? '显著' : ''}快于同龄平均水平` })
  }
  const skip = effectiveSkipCount()
  if (skip > 0) {
    const details = g.skipLevelDetails || []
    const nameMap = { 'LEVEL_1': '第一关', 'LEVEL_2': '第二关', 'LEVEL_3': '第三关' }
    const skipNames = details.map(d => nameMap[d] || d).join('、')
    const skipDetail = skipNames ? `（${skipNames}）` : ''
    findings.push({
      type: skip >= 3 ? 'warn' : 'info',
      icon: '⏭',
      title: `跳关 ${skip}次${skip >= 3 ? '（全部关卡）' : ''}`,
      desc: skip >= 3
        ? `所有关卡均被跳过${skipDetail}，未产生有效游戏操作数据。本次报告无法基于实际行为评估各维度能力，建议鼓励孩子完成关卡后重新评估。`
        : `跳过了 ${skipNames}，遇到困难时有跳过倾向，建议将大目标分解为小步骤。`,
    })
  }
  if (_l3.needs_correct === 4) {
    findings.push({ type: 'info', icon: '🧭', title: '需求区分满分', desc: '准确区分表面立场与真实需求，具备良好的分析能力' })
  }
  if (_l1.check_history && _l1.check_history.length >= 2) {
    const first = _l1.check_history[0]?.pairs?.filter(p => p.done).length || 0
    const last = _l1.check_history[_l1.check_history.length - 1]?.pairs?.filter(p => p.done).length || 0
    if (last > first && last === 4) {
      findings.push({ type: 'info', icon: '📈', title: '从错误中学习', desc: `L1从首次${first}/4逐步修正到全部正确，具备良好的经验学习能力` })
    }
  }

  return findings
})

function dimensionFallbackText(key) {
  const fallback = {
    spatial: '能够观察位置关系并组织空间布局，适合通过搭建、拼图和图形任务继续发展。',
    naturalist: '能够关注海洋生物之间的关系，并依据生态线索完成分类与配对。',
    logical: '能够分析路径、避开障碍并逐步修正方案，体现出一定的规划意识。',
    interpersonal: '能够识别伙伴需求并尝试寻找双方都能接受的解决办法。',
    linguistic: '能够在协商情境中表达观点、回应他人并使用语言推动问题解决。',
    executive: '能够持续完成多阶段任务，在尝试、调整和检查中保持目标意识。',
  }
  return fallback[key] || '该能力在本次游戏过程中得到了一定体现。'
}

const dimensionList = [
  { key: 'spatial', label: '空间视觉智能', icon: '🏗️', color: '#22d3ee', gradient: 'linear-gradient(90deg, #22d3ee, #3b82f6)' },
  { key: 'logical', label: '逻辑数理智能', icon: '🧮', color: '#4ade80', gradient: 'linear-gradient(90deg, #4ade80, #22c55e)' },
  { key: 'naturalist', label: '自然观察智能', icon: '🌿', color: '#fb923c', gradient: 'linear-gradient(90deg, #fb923c, #f59e0b)' },
  { key: 'interpersonal', label: '人际社交智能', icon: '🤝', color: '#a78bfa', gradient: 'linear-gradient(90deg, #a78bfa, #8b5cf6)' },
  { key: 'linguistic', label: '语言表达智能', icon: '💬', color: '#f472b6', gradient: 'linear-gradient(90deg, #f472b6, #ec4899)' },
  { key: 'executive', label: '专注力与执行能力', icon: '🧠', color: '#f59e0b', gradient: 'linear-gradient(90deg, #f59e0b, #d97706)' },
]

const gradeLabels = [
  { label: '🔵 9-10 核心天赋', bg: 'bg-emerald-100 text-emerald-600' },
  { label: '🟢 7-8.9 发展潜能', bg: 'bg-cyan-100 text-cyan-600' },
  { label: '🟡 4-6.9 均衡能力', bg: 'bg-amber-100 text-amber-600' },
  { label: '🟠 1-3.9 待激活', bg: 'bg-rose-100 text-rose-500' },
]

// 培养建议解析（兼容旧版纯文本和后端JSON格式）
const suggestionsParsed = computed(() => {
  const raw = report.value?.suggestions || ''
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return { parent: raw.split('\n').filter(Boolean), teacher: [] }
    }
  }
  if (typeof raw === 'object' && raw.parent) return raw
  return { parent: [], teacher: [] }
})

// 先天气质
const temperamentLabel = computed(() => report.value?.temperament?.label || '待分析')
const temperamentDesc = computed(() => report.value?.temperament?.desc || '')
const temperamentDims = computed(() => report.value?.temperament?.dimensions || {})

// 埃里克森
const eriksonData = computed(() => report.value?.erikson || {})

// CHEXI
const chexiData = computed(() => report.value?.chexi || {})

function chexiLabel(key) {
  const map = {
    task_persistence: '任务坚持力',
    flexibility: '思维变通力',
    anti_distraction: '抗分心能力',
    multi_step_planning: '多步骤统筹',
    experience_learning: '经验学习力',
  }
  return map[key] || key
}

function roleIcon(role) {
  const map = { player: '🧒', keke: '🦀', caicai: '🐠', momo: '🐬' }
  return map[role] || '💬'
}

// ===================================================================
// SVG 雷达图
// ===================================================================
const dims = [
  { key: 'spatial',     label: '空间智能',     color: '#22d3ee' },
  { key: 'logical',     label: '逻辑数学',     color: '#4ade80' },
  { key: 'naturalist',  label: '自然观察',     color: '#fb923c' },
  { key: 'interpersonal', label: '人际智能',   color: '#a78bfa' },
  { key: 'linguistic',  label: '语言智能',     color: '#f472b6' },
  { key: 'executive',   label: '执行功能',     color: '#f59e0b' },
]

function angle(i) {
  return (Math.PI / 2) - (i * 2 * Math.PI / 6)
}

function gridPoints(ratio) {
  return dims.map((_, i) => {
    const a = angle(i)
    const r = 120 * ratio
    return `${(150 + r * Math.cos(a)).toFixed(1)},${(150 - r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

const dataPoints = computed(() => {
  return dims.map((d, i) => {
    const a = angle(i)
    const score = displayScore(d.key)
    const r = (score / 10) * 120
    return `${(150 + r * Math.cos(a)).toFixed(1)},${(150 - r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
})

// 同龄人参考线 = 5.5 分（同龄儿童平均水平）
const REF_AVG = 5.5
const refPoints = computed(() => {
  return dims.map((_, i) => {
    const a = angle(i)
    const r = (REF_AVG / 10) * 120
    return `${(150 + r * Math.cos(a)).toFixed(1)},${(150 - r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
})
</script>

<style>
/* 报告导出由 JavaScript 生成独立 HTML 文件完成 */

/* ⚠️ 右上角评估警告横幅（全跳关/无操作数据时显示） */
.overview-warning-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #fff7ed, #fffbeb);
  border: 1px solid #fcd34d;
  border-radius: 0.85rem;
  box-shadow: 0 4px 16px rgba(251,191,36,0.12);
}
.owb-icon { font-size: 1.5rem; line-height: 1.4; flex-shrink: 0; }
.owb-text strong {
  display: block;
  color: #92400e;
  font-size: 0.85rem;
  margin-bottom: 0.2rem;
}
.owb-text p {
  margin: 0;
  color: #a16207;
  font-size: 0.7rem;
  line-height: 1.5;
  font-weight: 500;
}
</style>
