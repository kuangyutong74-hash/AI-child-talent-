<template>
  <div class="relative w-screen h-screen bg-transparent flex items-center justify-center p-2 md:p-3 overflow-hidden">
    <!-- 🌊 全场景海底 Canvas 背景（鱼群+光柱+海草+气泡） -->
    <OceanBackground :currentLevel="currentState" :bgOpacity="1" />

    <!-- 主游戏面板：全透明玻璃容器，让海底 Canvas 完全透出 -->
    <div class="game-shell relative z-10 w-full max-w-[1600px] h-full mx-auto
                rounded-2xl flex flex-col overflow-hidden"
         :class="{ 'pinyin-text': showPinyin }">

      <!-- ===== 顶部：大号沫沫AI助手对话框（固定高度） ===== -->
      <header class="game-hud flex items-center gap-3 px-4 md:px-5 py-2.5 md:py-3 shrink-0">
        <div class="flex items-center gap-2 shrink-0">
          <span class="hud-avatar"><MomoDolphin size="sm" /></span>
          <div>
            <div class="text-base md:text-lg font-bold text-white">沫沫</div>
        <div class="text-xs text-cyan-100/80 tracking-wider">BASE AI</div>
          </div>
        </div>
        <div class="hud-message flex-1 px-4 py-2 md:px-5 md:py-2.5 text-cyan-50/90 text-xs md:text-sm leading-relaxed min-h-[44px] flex items-center">
          <span v-html="p(stateLabel)"></span>
        </div>
        <div class="hidden xl:flex items-center gap-1.5 shrink-0" aria-label="任务进度">
          <div v-for="(step, i) in missionSteps" :key="step.state"
               class="hud-step"
               :class="{ active: currentState === step.state, done: missionProgress > i }">
            <span>{{ step.icon }}</span><span class="hidden 2xl:inline">{{ step.label }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <!-- 拼音开关按钮 -->
          <button @click="togglePinyin"
                  class="pinyin-toggle-btn px-2.5 py-1 text-xs rounded-full border transition-all font-bold select-none cursor-pointer"
                  :class="showPinyin ?
                    'active bg-cyan-500 text-white border-cyan-400 shadow-md' :
                    'bg-white/10 text-cyan-100/60 border-white/10 hover:text-white hover:border-cyan-300/40'">
            <span v-if="showPinyin">🔊 拼音</span>
            <span v-else>🔇 拼音</span>
          </button>
          <span class="hud-timer text-cyan-50/90 text-sm font-medium whitespace-nowrap">⏱ {{ formatTime(elapsed) }}</span>
        </div>
      </header>

      <!-- 游戏内容区域（flex-1填满剩余空间） -->
      <main class="flex-1 overflow-hidden">
        <component :is="currentComponent" 
                   :gameState="gameState"
                   @go-level="handleGoLevel"
                   @complete="handleLevelComplete"
                   @go-report="handleGoReport"
                   @back-start="handleBackStart" />
      </main>

      <!-- 显示调试栏的浮动按钮（仅隐藏时出现） -->
      <button v-if="!showDebug"
              @click="showDebug = true"
              class="nav-launcher fixed bottom-4 right-4 z-50"
              title="显示调试导航">
        <span>⌘</span>
      </button>

      <!-- 底部：深海控制台导航 -->
      <footer v-if="showDebug"
              class="game-bottom-nav shrink-0">
        <div class="bottom-nav-brand">
          <span class="bottom-nav-signal"></span>
          <span class="hidden md:inline">深海控制台</span>
        </div>
        <nav class="bottom-nav-track" aria-label="游戏页面快速导航">
          <button v-for="(btn, index) in debugButtons" :key="btn.state"
                  @click="handleGoLevel(btn.state)"
                  class="bottom-nav-item"
                  :class="{ active: currentState === btn.state }"
                  :aria-current="currentState === btn.state ? 'page' : undefined">
            <span class="bottom-nav-index">0{{ index + 1 }}</span>
            <span class="bottom-nav-icon-shell" aria-hidden="true">
              <img :src="btn.iconSrc" :alt="btn.iconAlt" class="bottom-nav-icon" />
            </span>
            <span>{{ btn.label }}</span>
            <span v-if="currentState === btn.state" class="bottom-nav-active-dot"></span>
          </button>
        </nav>
        <button @click="showDebug = false"
                class="bottom-nav-close"
                title="收起导航"
                aria-label="收起底部导航">
          ↓
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, provide } from 'vue'
import { togglePinyin, usePinyinState, toPinyinHtml } from './utils/pinyin.js'

// App.vue 是 provide 方，不能 inject 自己，用 toPinyinHtml 直接检查全局状态
function p(text) { return toPinyinHtml(text) }

import StartScreen from './components/StartScreen.vue'
import LevelOne from './components/LevelOne.vue'
import LevelTwo from './components/LevelTwo.vue'
import LevelThree from './components/LevelThree.vue'
import EndingScreen from './components/EndingScreen.vue'
import ReportScreen from './components/ReportScreen.vue'
import navHomeBase from './assets/generated/nav/nav-home-base.png'
import navCoralApartment from './assets/generated/nav/nav-coral-apartment.png'
import navCurrentGrid from './assets/generated/nav/nav-current-grid.png'
import navMediation from './assets/generated/nav/nav-mediation.png'
import guardianMedal from './assets/generated/guardian-medal.png'
import navTalentReport from './assets/generated/nav/nav-talent-report.png'

// 🌊 Canvas 海底背景
import OceanBackground from './components/canvas/OceanBackground.vue'
import MomoDolphin from './components/characters/MomoDolphin.vue'

const showDebug = ref(false)
const currentState = ref('START')
const showPinyin = usePinyinState()

// 向所有子组件提供拼音状态和切换方法
provide('showPinyin', showPinyin)
provide('togglePinyin', togglePinyin)

const stateLabel = computed(() => {
  const map = {
    START: '👋 欢迎小队长！大风暴把蔚蓝基地吹得乱七八糟，小鱼们都无家可归了。快用你的智慧帮它们重建家园吧！🌟',
    LEVEL_1: '🏠 第一关·珊瑚公寓！把海洋生物拖拽到海洋空地里，帮小鱼们找到最合适的家。点击「提交检查」验证配对！🐠',
    LEVEL_2: '⚡ 第二关·洋流电网！铺设管道绕开礁石，连通基地电源！',
    LEVEL_3: '🤝 第三关·海洋议事厅！壳壳和彩彩吵架了，帮它们调解吧！',
    END_CEREMONY: '🎖️ 太棒了！你完成了所有任务！授予你深海基地守护者勋章！',
    REPORT: '📊 来看看你的多元智能发展报告吧！',
  }
  return map[currentState.value] || currentState.value
})

const componentMap = {
  START: StartScreen,
  LEVEL_1: LevelOne,
  LEVEL_2: LevelTwo,
  LEVEL_3: LevelThree,
  END_CEREMONY: EndingScreen,
  REPORT: ReportScreen,
}

const currentComponent = computed(() => componentMap[currentState.value])
const missionSteps = [
  { state: 'LEVEL_1', icon: '🏠', label: '安家' },
  { state: 'LEVEL_2', icon: '⚡', label: '通电' },
  { state: 'LEVEL_3', icon: '🤝', label: '调解' },
]
const missionProgress = computed(() => {
  const map = { START: 0, LEVEL_1: 0, LEVEL_2: 1, LEVEL_3: 2, END_CEREMONY: 3, REPORT: 3 }
  return map[currentState.value] ?? 0
})

const debugButtons = [
  { state: 'START', label: '开始', iconSrc: navHomeBase, iconAlt: '深海基地' },
  { state: 'LEVEL_1', label: '第一关', iconSrc: navCoralApartment, iconAlt: '珊瑚公寓' },
  { state: 'LEVEL_2', label: '第二关', iconSrc: navCurrentGrid, iconAlt: '洋流电网' },
  { state: 'LEVEL_3', label: '第三关', iconSrc: navMediation, iconAlt: '协商调解' },
  { state: 'END_CEREMONY', label: '颁奖', iconSrc: guardianMedal, iconAlt: '守护者勋章' },
  { state: 'REPORT', label: '报告', iconSrc: navTalentReport, iconAlt: '天赋报告' },
]

const gameState = reactive({
  studentId: 'stu_' + Date.now(),
  age: '8',                          // 匿名评测使用固定常模，不向玩家收集年龄
  level1_duration: 0, level1_errors: 0,
  level2_duration: 0, level2_pipes_used: 0,
  level3_duration: 0, level3_harmony_score: 0,
  evidence: [],
  // 完整原始指标存储（用于报告生成）
  level1_raw: null,
  level2_raw: null,
  level3_raw: null,
  level3_dialogue: [],              // 第三关对话完整记录
  // 📊 行为量化评分系统
  skipLevelCount: 0,                // 跳关次数统计
  skipLevelDetails: [],             // 🆕 被跳过的关卡名称列表，如 ['LEVEL_2', 'LEVEL_3']
})

const elapsed = ref(0)
let timerInterval = null

onMounted(() => { timerInterval = setInterval(() => { elapsed.value++ }, 1000) })
onUnmounted(() => { if (timerInterval) clearInterval(timerInterval) })

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

// 📊 关卡顺序映射（用于跳关检测）
const LEVEL_ORDER = ['START', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'END_CEREMONY', 'REPORT']

/** 判断一个状态是否为实际游戏关卡 */
function isGameLevel(state) {
  return state === 'LEVEL_1' || state === 'LEVEL_2' || state === 'LEVEL_3'
}

function handleGoLevel(level) {
  // 每次从封面进入第一关时创建新的匿名评测会话
  if (currentState.value === 'START' && level === 'LEVEL_1') {
    gameState.studentId = 'stu_' + Date.now()
  }

  // 跳关检测：记录跳过的具体关卡名称
  const currentIdx = LEVEL_ORDER.indexOf(currentState.value)
  const targetIdx = LEVEL_ORDER.indexOf(level)

  if (currentIdx >= 0 && targetIdx >= 0) {
    // 向后跳（跳过关卡，非顺序前进）
    if (targetIdx > currentIdx + 1) {
      for (let i = currentIdx + 1; i < targetIdx; i++) {
        const skipped = LEVEL_ORDER[i]
        if (isGameLevel(skipped)) {
          gameState.skipLevelDetails.push(skipped)
          gameState.skipLevelCount++
        }
      }
    }
    // 从后面关卡往前跳（例如 LEVEL_3 → LEVEL_1，跳过了 LEVEL_2）
    if (targetIdx < currentIdx && targetIdx >= 1) {
      for (let i = targetIdx + 1; i < currentIdx; i++) {
        const skipped = LEVEL_ORDER[i]
        if (isGameLevel(skipped)) {
          gameState.skipLevelDetails.push(skipped)
          gameState.skipLevelCount++
        }
      }
    }
  }

  currentState.value = level
}

function handleLevelComplete(data) {
  if (data.level === 'LEVEL_1') {
    gameState.level1_duration = data.duration || 0
    gameState.level1_errors = data.errors || 0
    gameState.level1_raw = data.raw_metrics || null
    gameState.evidence.push(data.evidence || `第一关完成，用时${data.duration}秒`)

    currentState.value = 'LEVEL_2'
  } else if (data.level === 'LEVEL_2') {
    gameState.level2_duration = data.duration || 0
    gameState.level2_pipes_used = data.pipes_used || 0
    gameState.level2_raw = data.raw_metrics || null
    gameState.evidence.push(`第二关完成，用时${data.duration}秒，使用${data.pipes_used}根管道`)

    currentState.value = 'LEVEL_3'
  } else if (data.level === 'LEVEL_3') {
    gameState.level3_duration = data.duration || 0
    gameState.level3_harmony_score = data.harmony_score || 0
    gameState.level3_raw = data.raw_metrics || null
    gameState.level3_dialogue = data.dialogue || []
    gameState.evidence.push(`第三关完成，用时${data.duration}秒，和解度${data.harmony_score}%`)

    currentState.value = 'END_CEREMONY'
  }
}

function handleGoReport() {
  // 跳关检测：从当前状态到 REPORT 之间跳过的关卡数
  const currentIdx = LEVEL_ORDER.indexOf(currentState.value)
  const reportIdx = LEVEL_ORDER.indexOf('REPORT')
  if (currentIdx >= 0 && reportIdx > currentIdx + 1) {
    for (let i = currentIdx + 1; i < reportIdx; i++) {
      const skipped = LEVEL_ORDER[i]
      if (isGameLevel(skipped)) {
        gameState.skipLevelDetails.push(skipped)
        gameState.skipLevelCount++
      }
    }
  }
  currentState.value = 'REPORT'
}

function handleBackStart() {
  Object.assign(gameState, {
    age: '8',
    level1_duration: 0, level1_errors: 0,
    level2_duration: 0, level2_pipes_used: 0,
    level3_duration: 0, level3_harmony_score: 0,
    evidence: [],
    level1_raw: null, level2_raw: null, level3_raw: null,
    level3_dialogue: [],
    skipLevelCount: 0,
    skipLevelDetails: [],
  })
  elapsed.value = 0
  currentState.value = 'START'
}
</script>

<style>
.game-shell {
  background:
    linear-gradient(145deg, rgba(236,254,255,.28), rgba(224,242,254,.18)),
    rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.58);
  box-shadow:
    0 26px 70px rgba(14,116,144,.16),
    0 0 0 1px rgba(103,232,249,.14),
    inset 0 1px rgba(255,255,255,.78);
  backdrop-filter: blur(7px) saturate(1.1);
}
.game-hud {
  position: relative;
  color: #0e5d74;
  background:
    radial-gradient(circle at 15% -80%, rgba(255,255,255,.96), transparent 42%),
    linear-gradient(100deg, rgba(236,254,255,.94), rgba(207,250,254,.88) 52%, rgba(224,242,254,.92));
  border-bottom: 1px solid rgba(8,145,178,.2);
  box-shadow: 0 8px 26px rgba(14,116,144,.13), inset 0 1px rgba(255,255,255,.96);
  backdrop-filter: blur(18px) saturate(1.18);
}
.game-hud::after {
  content: '';
  position: absolute;
  left: 16%;
  right: 16%;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(34,211,238,.72), rgba(45,212,191,.58), transparent);
}
.game-hud .text-white,
.game-hud .text-cyan-50\/90,
.game-hud .text-cyan-100\/80,
.game-hud .text-cyan-100\/60 {
  color: #0e5d74 !important;
}

.game-bottom-nav {
  position: relative;
  z-index: 30;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .55rem .75rem;
  color: #155e75;
  border-top: 1px solid rgba(8, 145, 178, .22);
  background:
    radial-gradient(circle at 50% -70%, rgba(255,255,255,.98), transparent 46%),
    linear-gradient(100deg, rgba(236,254,255,.95), rgba(204,251,241,.9), rgba(224,242,254,.94));
  box-shadow: 0 -9px 28px rgba(14,116,144,.12), inset 0 1px rgba(255,255,255,.96);
  backdrop-filter: blur(20px) saturate(1.18);
}

.bottom-nav-brand {
  flex: none;
  display: flex;
  align-items: center;
  gap: .45rem;
  padding: 0 .35rem;
  color: #0e7490;
  font-size: .72rem;
  font-weight: 800;
  letter-spacing: .08em;
  white-space: nowrap;
}

.bottom-nav-signal {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #14b8a6;
  box-shadow: 0 0 0 4px rgba(20,184,166,.12), 0 0 14px rgba(13,148,136,.5);
  animation: navSignal 1.8s ease-in-out infinite;
}

.bottom-nav-track {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: .4rem;
  overflow-x: auto;
  padding: .18rem;
  scrollbar-width: none;
}
.bottom-nav-track::-webkit-scrollbar { display: none; }

.bottom-nav-item {
  position: relative;
  flex: 0 0 auto;
  min-width: 98px;
  min-height: 43px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .38rem;
  padding: .45rem .75rem;
  overflow: hidden;
  color: #17657b;
  border: 1px solid rgba(8, 145, 178, .16);
  border-radius: 13px;
  background: rgba(255,255,255,.58);
  box-shadow: inset 0 1px rgba(255,255,255,.84);
  font-size: .78rem;
  font-weight: 700;
  white-space: nowrap;
}

.bottom-nav-item:hover {
  color: #075985;
  border-color: rgba(6,182,212,.42);
  background: rgba(255,255,255,.88);
  box-shadow: 0 7px 18px rgba(14,116,144,.12), inset 0 1px white;
  transform: translateY(-2px);
}

.bottom-nav-item.active {
  color: #0c4a6e;
  border-color: rgba(34,211,238,.62);
  background: linear-gradient(135deg, rgba(255,255,255,.98), #a5f3fc 52%, #99f6e4);
  box-shadow: 0 8px 22px rgba(8,145,178,.2), inset 0 1px rgba(255,255,255,.98);
  text-shadow: 0 1px rgba(255,255,255,.4);
}

.bottom-nav-index {
  font-size: .58rem;
  font-weight: 900;
  opacity: .55;
  letter-spacing: .04em;
}

.bottom-nav-icon-shell {
  width: 31px;
  height: 31px;
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 2px;
  border: 1px solid rgba(8,145,178,.18);
  border-radius: 10px;
  background: rgba(255,255,255,.92);
  box-shadow: 0 3px 9px rgba(8,145,178,.12), inset 0 1px white;
  transition: transform .2s ease, box-shadow .2s ease;
}

.bottom-nav-icon {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  border-radius: 7px;
}

.bottom-nav-item.active .bottom-nav-icon-shell {
  transform: translateY(-1px) scale(1.06);
  box-shadow: 0 5px 13px rgba(8,145,178,.24), 0 0 0 2px rgba(103,232,249,.24);
}

.bottom-nav-active-dot {
  position: absolute;
  left: 50%;
  bottom: 3px;
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: #0e7490;
  transform: translateX(-50%);
  box-shadow: 0 0 8px rgba(14,116,144,.6);
}

.bottom-nav-close,
.nav-launcher {
  display: grid;
  place-items: center;
  color: #0e7490;
  border: 1px solid rgba(103,232,249,.5);
  background: linear-gradient(145deg, rgba(236,254,255,.96), rgba(165,243,252,.9));
}

.bottom-nav-close {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 900;
}

.nav-launcher {
  width: 42px;
  height: 42px;
  border-radius: 15px;
  font-size: 1.15rem;
  font-weight: 900;
  box-shadow: 0 10px 28px rgba(8,47,73,.22), 0 0 0 3px rgba(207,250,254,.16);
}

.nav-launcher:hover { transform: translateY(-2px) scale(1.04); }

@keyframes navSignal {
  0%, 100% { opacity: .65; transform: scale(.88); }
  50% { opacity: 1; transform: scale(1.08); }
}

@media (max-width: 767px) {
  .game-bottom-nav { min-height: 58px; gap: .35rem; padding: .4rem .45rem; }
  .bottom-nav-item { min-width: 88px; min-height: 39px; padding: .35rem .55rem; font-size: .7rem; }
  .bottom-nav-index { display: none; }
  .bottom-nav-icon-shell { width: 27px; height: 27px; border-radius: 8px; }
}
.hud-avatar {
  width: 48px; height: 48px; display: grid; place-items: center; border-radius: 15px;
  background: radial-gradient(circle at 35% 20%, white, rgba(207,250,254,.88) 58%, rgba(103,232,249,.42));
  border: 1px solid rgba(8,145,178,.22);
  box-shadow: 0 6px 18px rgba(8,145,178,.14), inset 0 1px white;
}
.hud-message {
  border-radius: 14px;
  color: #155e75 !important;
  background: linear-gradient(90deg, rgba(255,255,255,.8), rgba(240,253,250,.66));
  border: 1px solid rgba(8,145,178,.14);
  box-shadow: inset 0 1px white;
}
.hud-step {
  display: flex; align-items: center; gap: 5px; padding: 6px 9px; border-radius: 10px;
  color: rgba(14,116,144,.46); font-size: 11px; border: 1px solid transparent; transition: .25s;
}
.hud-step.active {
  color: #075985; background: rgba(255,255,255,.82); border-color: rgba(6,182,212,.28);
  box-shadow: 0 6px 16px rgba(8,145,178,.11), inset 0 1px white;
}
.hud-step.done { color: #0f9f83; }
.hud-timer {
  padding: 5px 8px;
  color: #0e7490 !important;
  border: 1px solid rgba(8,145,178,.12);
  border-radius: 9px;
  background: rgba(255,255,255,.66);
}
.game-hud .pinyin-toggle-btn:not(.active) {
  color: #0e7490 !important;
  border-color: rgba(8,145,178,.2) !important;
  background: rgba(255,255,255,.64) !important;
}
.game-hud .pinyin-toggle-btn:not(.active):hover {
  color: #075985 !important;
  border-color: rgba(6,182,212,.42) !important;
  background: rgba(255,255,255,.9) !important;
}
@keyframes bubRise {
  0% { transform: translateY(0) scale(1); opacity: 0.6; }
  80% { opacity: 0.2; }
  100% { transform: translateY(-750px) scale(0.3); opacity: 0; }
}
</style>
