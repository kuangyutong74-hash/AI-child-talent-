<template>
  <div class="flex flex-col h-full p-3 md:p-4 gap-3">

    <!-- ============================================================ -->
    <!-- 顶部：沫沫对话框 + 关卡信息                                 -->
    <!-- ============================================================ -->
    <div class="shrink-0 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 bg-cyan-50/80 px-4 py-2 rounded-full border border-cyan-200/50">
          <MomoDolphin size="sm" :animate="false" />
          <span class="level-helper-text text-sm md:text-base" v-html="p('来修复洋流电网吧！⚡')"></span>
        </div>
        <span class="level-main-title text-sm md:text-base" v-html="p('⚡ 第二关：洋流电网')"></span>
      </div>
      <div class="flex gap-2 items-center">
        <!-- 沫沫提示：电路连通后引导点击检查 -->
        <div v-if="readyToCheck"
             class="flex items-center gap-1.5 px-3 py-1 bg-cyan-100/90 rounded-full border border-cyan-300/60 text-cyan-700 text-xs font-bold animate-bounce-in whitespace-nowrap">
          <MomoDolphin size="sm" :animate="false" />
          <span v-html="p('点击检查连通！')"></span>
        </div>
        <button @mouseenter="playHover" @click="submitCheck"
                class="px-4 py-1.5 bg-gradient-to-r from-emerald-400 to-green-500 text-white text-xs md:text-sm rounded-full shadow-lg hover:scale-105 transition-transform font-bold"
                :class="{ 'guide-highlight': readyToCheck }">
          <span v-html="p('🔍 检查连通')"></span>
        </button>
        <button @mouseenter="playHover" @click="resetLevel"
                class="px-3 py-1.5 bg-white/70 text-rose-500 text-xs md:text-sm rounded-full border border-rose-200 hover:bg-rose-50 transition-all">
          ↺ <span v-html="p('重置')"></span>
        </button>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 主游戏区：左侧大网格 + 右侧管道材料箱                       -->
    <!-- ============================================================ -->
    <div class="flex-1 flex gap-2 min-h-0">

      <!-- ===== 左侧：大型网格区 ===== -->
      <div class="flex-[3] flex flex-col items-center bg-cyan-50/30 rounded-xl border border-cyan-200/30 p-2 overflow-auto">
        <div class="flex items-center justify-between w-full mb-1.5">
          <h3 class="text-sm font-bold text-cyan-800" v-html="p('🌊 海底电网 · ' + ROWS + 'x' + COLS)"></h3>
          <div class="flex items-center gap-2 text-xs text-cyan-800/85 font-medium">
            <span class="endpoint-route-legend">
              <img :src="generatorDevice" alt="发电机" />
              <span class="endpoint-route-current">➜</span>
              <img :src="crystalReceiverDevice" alt="能源水晶接收站" />
            </span>
            <span>连通: <span :class="isConnected ? 'text-emerald-600 font-bold' : 'text-rose-400'">{{ isConnected ? '✅' : '❌' }}</span></span>
          </div>
        </div>

        <!-- 网格（放大格子，宽屏下饱满） -->
        <div ref="gridWrapperRef" class="relative w-full" :style="{ maxWidth: (COLS * 64 + 16) + 'px' }">
          <!-- ⚡ 电光特效 Canvas（覆盖在网格区域上方） -->
          <Level2Effects :connectionPath="connectionPath" :isConnected="isConnected" />
          <div ref="gridRef" class="grid gap-1 p-2 rounded-xl border-2 shadow-inner"
             :style="{
               gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
               width: '100%',
               background: 'linear-gradient(180deg, rgba(34,211,238,0.10) 0%, rgba(34,211,238,0.05) 60%, rgba(254,243,199,0.20) 100%)',
               borderColor: 'rgba(34,211,238,0.25)',
             }">
          <div v-for="(cell, idx) in flatGrid" :key="idx"
               :data-row="cell.row"
               :data-col="cell.col"
               class="relative flex items-center justify-center transition-all duration-200 cursor-pointer select-none rounded-lg group"
               :style="{ width: '56px', height: '56px', fontSize: '28px' }"
               :class="[
                 gridCellClass(cell),
                 showTutorial && tutorialStep === 2 && ((cell.row === 0 && cell.col === 1) || (cell.row === 1 && cell.col === 0)) ? 'z-50 ring-4 ring-yellow-400 shadow-[0_0_20px_#facc15] scale-105 pointer-events-auto' : ''
               ]"
               @click="onCellClick(cell.row, cell.col)"
               @contextmenu.prevent="onRightClick(cell.row, cell.col)">
            
            <!-- 右键删除提示（hover时显示） -->
            <div v-if="cell.pipe"
                 class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-400/80 rounded-full flex items-center justify-center text-white text-[9px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              ✕
            </div>
            
            <!-- 起点 -->
            <div v-if="cell.row === start.row && cell.col === start.col"
                 class="endpoint-device endpoint-generator"
                 title="深海能源发电机（起点）">
              <span class="endpoint-glow"></span>
              <img :src="generatorDevice" alt="深海能源发电机起点" draggable="false" />
            </div>
            <!-- 终点 -->
            <div v-else-if="cell.row === end.row && cell.col === end.col"
                 class="endpoint-device endpoint-receiver"
                 title="能源水晶接收站（终点）">
              <span class="endpoint-glow"></span>
              <img :src="crystalReceiverDevice" alt="能源水晶接收站终点" draggable="false" />
            </div>
            <!-- 海底障碍物小场景 -->
            <div v-else-if="cell.obstacle"
                 class="obstacle-scene"
                 :class="'obstacle-' + cell.obstacle.kind"
                 :title="cell.obstacle.label">
              <span class="obstacle-halo"></span>
              <span class="obstacle-emoji">{{ cell.obstacle.emoji }}</span>
              <span class="obstacle-bubble bubble-a"></span>
              <span class="obstacle-bubble bubble-b"></span>
            </div>
            <!-- 已放置管道 -->
            <span v-else-if="cell.pipe" class="text-2xl leading-none select-none pipe-glyph opacity-0"
                  :style="getPipeStyle(cell.pipe.rot)">
              {{ cell.pipe.def }}
            </span>
            <!-- 高亮提示 -->
            <div v-else-if="highlightCells.includes(cellKey(cell.row, cell.col))"
                 class="absolute inset-1 rounded-lg ring-2 ring-emerald-400/50 bg-emerald-400/10">
            </div>
          </div>
        </div>
        </div><!-- closes wrapper, gridRef, v-for -->

        <div v-if="feedbackMsg" class="mt-2 px-4 py-2 rounded-xl text-sm w-full max-w-lg text-center transition-all"
             :class="feedbackOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'">
          <span v-html="feedbackMsg"></span>
        </div>
      </div>

      <!-- ===== 右侧：管道选择器（加宽） ===== -->
      <div class="w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto">
        
        <!-- 管道库（放大卡片） -->
        <div class="bg-white/60 rounded-2xl p-4 border border-cyan-200/30">
          <h4 class="text-lg md:text-xl font-bold text-cyan-700 mb-3"><span v-html="p('🔧 管道库')"></span></h4>
        <p class="text-sm text-cyan-800/90 font-medium mb-3" v-html="p('点击选中 → 点击网格放置')"></p>
          <div class="grid grid-cols-2 gap-3">
            <div v-for="(pipe, i) in pipeTypes" :key="i"
                 @mouseenter="playHover" @click="selectPipeType(i)"
                 class="relative flex flex-col items-center bg-white/80 rounded-xl py-4 border-2 cursor-pointer hover:shadow-lg transition-all"
                 :class="[
                   selectedPipe === i ? 'border-cyan-400 shadow-md bg-cyan-50/80' : 'border-cyan-200/40 hover:border-cyan-300',
                   showTutorial && tutorialStep === 1 && i === 0 ? 'z-50 ring-4 ring-yellow-400 shadow-[0_0_20px_#facc15] scale-105 pointer-events-auto' : ''
                 ]">
              <PipePreview :def="pipe.def" :rot="pipe.previewRot || 0" />
            <span class="text-sm font-bold text-cyan-900 mt-1.5" v-html="p(pipe.label)"></span>
            </div>
          </div>
        </div>

        <!-- 操作说明 -->
        <div class="bg-cyan-50/60 rounded-2xl p-4 border border-cyan-200/20">
          <h5 class="text-base font-bold text-cyan-700 mb-2"><span v-html="p('💡 操作')"></span></h5>
          <ul class="text-sm text-cyan-900/90 font-medium space-y-1.5 leading-relaxed">
            <li v-html="p('• 选管道 → 点格子放置')"></li>
            <li v-html="p('• 点击已放管道可旋转')"></li>
            <li v-html="p('• 右键点击可移除')"></li>
            <li v-html="p('• 绕过障碍物 🪸🪨🦀')"></li>
            <li class="flex items-center gap-1.5">
              <span v-html="p('• 连通')"></span>
              <img :src="generatorDevice" alt="发电机" class="inline-endpoint-icon" />
              <span class="text-cyan-600 font-black">→</span>
              <img :src="crystalReceiverDevice" alt="能源水晶接收站" class="inline-endpoint-icon" />
              <span v-html="p('即过关')"></span>
            </li>
          </ul>
        </div>

        <!-- 进度 -->
        <div class="bg-white/60 rounded-2xl p-4 border border-cyan-200/30">
          <div class="flex items-center justify-between mb-2">
            <span class="text-base font-bold text-cyan-700" v-html="p('⚡ 连通状态')"></span>
            <span class="text-sm font-bold" :class="isConnected ? 'text-emerald-600' : 'text-cyan-400'">
              {{ isConnected ? '✅' : '🔌' }} <span v-html="p(isConnected ? '已连通' : '未连通')"></span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 第二关故事背景弹窗 -->
    <!-- ============================================================ -->
    <div v-if="showStoryPopup"
         class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
         @click.self="startGame">
      <div class="w-[560px] max-w-[90vw] bg-white rounded-3xl shadow-2xl border-2 border-cyan-200 overflow-hidden animate-bounce-in">
        <div class="bg-gradient-to-r from-cyan-100 to-blue-100 px-6 py-6 text-center border-b border-cyan-200">
          <MomoDolphin size="xl" class="block mx-auto mb-2" />
          <h3 class="text-2xl font-bold text-cyan-800"><span v-html="p('📖 故事背景')"></span></h3>
        </div>
        <div class="px-8 py-6">
          <div class="flex items-start gap-3 mb-3">
            <p class="text-base md:text-lg text-cyan-700/90 leading-relaxed flex-1" v-html="p('太棒了，小鱼们都住进新家啦！但是由于基地的电力中断，公寓里还黑漆漆的。发电机在左上角，基地的能源水晶在右下角。小队长，我们需要绕开海底坚硬的黑色礁石，铺设洋流管道，重新连通电网！照亮我们的深海家园吧！')">
            </p>
            <button @mouseenter="playHover" @click.stop="toggleTTS('太棒了，小鱼们都住进新家啦！但是由于基地的电力中断，公寓里还黑漆漆的。发电机在左上角，基地的能源水晶在右下角。小队长，我们需要绕开海底坚硬的黑色礁石，铺设洋流管道，重新连通电网！照亮我们的深海家园吧！', 'momo')"
                    class="shrink-0 w-10 h-10 rounded-full bg-cyan-100/80 border border-cyan-200 flex items-center justify-center text-lg hover:scale-110 transition-transform">🔊</button>
          </div>
          <div class="mt-6 text-center">
            <button @mouseenter="playHover" @click="startGame"
                    class="px-10 py-3 bg-gradient-to-r from-rose-400 to-pink-500 text-white text-lg rounded-full shadow-lg hover:scale-105 transition-transform font-bold">
              <span v-html="p('⚡ 开始修复')"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 第二关新手引导（动画遮罩）                                      -->
    <!-- ============================================================ -->
    <TutorialOverlay
      :visible="showTutorial && tutorialStep === 1"
      message="先点击选中这根直直的电线管道吧！👉"
      @skip="skipTutorial"
    />

    <TutorialOverlay
      :visible="showTutorial && tutorialStep === 2"
      message="点击这里，把管子接在发电机旁边吧！⚡"
      @skip="skipTutorial"
    />

    <TutorialOverlay
      :visible="showTutorial && tutorialStep === 3"
      message="点击已放好的管道可旋转方向，右键点击可删除哦！🔄"
      @skip="skipTutorial"
    />

    <!-- ============================================================ -->
    <!-- 通关庆祝弹窗                                                 -->
    <!-- ============================================================ -->
    <div v-if="showComplete"
         class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="w-[480px] max-w-[90vw] bg-white rounded-3xl shadow-2xl border-2 border-emerald-200 overflow-hidden">
        <div class="bg-gradient-to-r from-emerald-100 to-cyan-100 px-6 py-5 text-center border-b border-emerald-200">
          <div class="text-6xl mb-2">⚡</div>
          <h3 class="text-2xl font-bold text-emerald-800" v-html="p('电网修复成功！')"></h3>
        </div>
        <div class="px-6 py-5 text-center">
          <p class="text-cyan-900 text-base font-medium mb-3" v-html="p('小队长，你太棒了！所有的灯都亮起来了！🌟')">
          </p>
          <div class="flex justify-center gap-6 mb-4 text-sm text-cyan-800 font-medium">
            <span v-html="p('⏱ 用时: ' + duration + '秒')"></span>
            <span v-html="p('🔧 管道: ' + placedCount + '根')"></span>
            <span v-html="p('🔄 旋转: ' + rotateCount + '次')"></span>
          </div>
        </div>
        <div class="px-6 py-4 bg-gray-50/80 border-t border-cyan-200/30 flex justify-center">
          <button @mouseenter="playHover" @click="goNextLevel"
                  class="px-8 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-full shadow-lg hover:scale-105 transition-transform font-bold">
            🚀 <span v-html="p('前往下一关')"></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import TutorialOverlay from './TutorialOverlay.vue'
import { stopTTS, toggleTTS } from '../utils/tts.js'
import { playHover, playClick } from '../utils/sounds.js'
import { usePinyinText } from '../utils/pinyin.js'
import Level2Effects from './effects/Level2Effects.vue'
import PipePreview from './canvas/PipePreview.vue'
import MomoDolphin from './characters/MomoDolphin.vue'
import generatorDevice from '../assets/level2/generator.png'
import crystalReceiverDevice from '../assets/level2/crystal-receiver.png'

const { p } = usePinyinText()

const emit = defineEmits(['complete'])

// ===================================================================
// 故事背景弹窗 + 语音播报
// ===================================================================
const showStoryPopup = ref(true)

function startGame() {
  showStoryPopup.value = false
  stopTTS()
  // 故事弹窗关闭后启动新手引导
  setTimeout(() => startTutorial(), 500)
}

onUnmounted(() => {
  stopTTS()
  gridResizeObserver?.disconnect()
})

// ===================================================================
// 网格尺寸
// ===================================================================
const ROWS = 8
const COLS = 10

// ===================================================================
// 可用管道类型列表
const pipeTypes = [
  { char: '─', label: '直铁管', def: '─', previewRot: 0 },
  { char: '┌', label: '弯头管', def: '┌', previewRot: 0 },
  { char: '┬', label: '三通管', def: '┬', previewRot: 0 },
]

// ===================================================================
// 海洋障碍物（随机生成，丰富多彩）
// ===================================================================
const OCEAN_OBSTACLES = [
  { emoji: '🪸', kind: 'coral', label: '坚硬珊瑚礁' },
  { emoji: '🪨', kind: 'rock', label: '深海玄武岩' },
  { emoji: '🌿', kind: 'weed', label: '缠绕海草' },
  { emoji: '🐚', kind: 'shell', label: '巨型贝壳' },
  { emoji: '🦀', kind: 'crab', label: '守路寄居蟹' },
  { emoji: '🐡', kind: 'puffer', label: '鼓起的河豚' },
  { emoji: '🪼', kind: 'jelly', label: '发光水母' },
  { emoji: '⭐', kind: 'star', label: '礁石海星' },
]

function randomObstacle() {
  return { ...OCEAN_OBSTACLES[Math.floor(Math.random() * OCEAN_OBSTACLES.length)] }
}

// ===================================================================
// 网格状态
// ===================================================================
const start = { row: 0, col: 0 }
const end = { row: ROWS - 1, col: COLS - 1 }

function addProtectedSegment(set, from, to) {
  let row = from.row
  let col = from.col
  set.add(`${row},${col}`)
  while (row !== to.row || col !== to.col) {
    if (row !== to.row) row += Math.sign(to.row - row)
    else col += Math.sign(to.col - col)
    set.add(`${row},${col}`)
  }
}

// 双层随机礁石屏障：每层仅留一个缺口，保证可解但必须多次转弯。
function generateGrid() {
  const grid = []
  const obstaclePositions = new Set()
  const protectedRoute = new Set()
  const firstWall = 2 + Math.floor(Math.random() * 2)
  const secondWall = 6 + Math.floor(Math.random() * 2)
  const firstGap = 1 + Math.floor(Math.random() * (ROWS - 2))
  let secondGap = 1 + Math.floor(Math.random() * (ROWS - 2))
  while (Math.abs(secondGap - firstGap) < 3) {
    secondGap = 1 + Math.floor(Math.random() * (ROWS - 2))
  }

  addProtectedSegment(protectedRoute, start, { row: 0, col: firstWall - 1 })
  addProtectedSegment(protectedRoute, { row: 0, col: firstWall - 1 }, { row: firstGap, col: firstWall })
  addProtectedSegment(protectedRoute, { row: firstGap, col: firstWall }, { row: firstGap, col: secondWall - 1 })
  addProtectedSegment(protectedRoute, { row: firstGap, col: secondWall - 1 }, { row: secondGap, col: secondWall })
  addProtectedSegment(protectedRoute, { row: secondGap, col: secondWall }, { row: secondGap, col: COLS - 1 })
  addProtectedSegment(protectedRoute, { row: secondGap, col: COLS - 1 }, end)

  for (let r = 0; r < ROWS; r++) {
    if (r !== firstGap) obstaclePositions.add(`${r},${firstWall}`)
    if (r !== secondGap) obstaclePositions.add(`${r},${secondWall}`)
  }

  // 额外散落 4–6 个障碍，但绝不占用预留的可通关路线。
  const targetCount = (ROWS - 1) * 2 + 4 + Math.floor(Math.random() * 3)
  let attempts = 0
  while (obstaclePositions.size < targetCount && attempts++ < 200) {
    const r = Math.floor(Math.random() * ROWS)
    const c = Math.floor(Math.random() * COLS)
    const key = `${r},${c}`
    if (protectedRoute.has(key)) continue
    if ((r === start.row && c === start.col) || (r === end.row && c === end.col)) continue
    obstaclePositions.add(key)
  }

  for (let r = 0; r < ROWS; r++) {
    const row = []
    for (let c = 0; c < COLS; c++) {
      const key = `${r},${c}`
      row.push({
        row: r, col: c,
        obstacle: obstaclePositions.has(key) ? randomObstacle() : null,
        pipe: null, // { def, rot }
        energized: false,
      })
    }
    grid.push(row)
  }
  return grid
}

const grid = reactive(generateGrid())

const flatGrid = computed(() => {
  const arr = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      arr.push(grid[r][c])
  return arr
})

function cellKey(r, c) { return `${r},${c}` }

// ===================================================================
// 游戏状态
// ===================================================================
const selectedPipe = ref(0)
const placedCount = ref(0)
const rotateCount = ref(0)
const isConnected = ref(false)
const showComplete = ref(false)
const readyToCheck = computed(() => isConnected.value && !showComplete.value)
const duration = ref(0)
const feedbackMsg = ref('')
const feedbackOk = ref(false)
const highlightCells = ref([])
const checkAttempts = ref(0)
const gameStartTime = ref(Date.now())

// 📊 行为量化评分系统 —— 无效交互追踪
const meaninglessClicks = ref(0)           // 无意义点击（点击已占格子等）
const blankClicks = ref(0)                // 空白点击（点击网格外区域）
const randomDrags = ref(0)                // 随意拖拽（Level 2 无原生拖拽，保留字段）
const invalidDrops = ref(0)               // 无效放置（放到障碍物等）
const totalOperations = ref(0)            // 总操作次数

// ⚡ 电流特效路径（从真实 DOM 位置计算）
const gridRef = ref(null)
const gridWrapperRef = ref(null)
const connectionPath = ref([])

function updateConnectionPath() {
  if (!gridRef.value || !gridWrapperRef.value) return

  const wrapperRect = gridWrapperRef.value.getBoundingClientRect()
  const path = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].pipe) {
        // 直接读取真实格子中心，避免自适应列宽与固定步长产生累计偏移。
        const cellEl = gridRef.value.querySelector(`[data-row="${r}"][data-col="${c}"]`)
        if (!cellEl) continue
        const cellRect = cellEl.getBoundingClientRect()
        const cx = cellRect.left - wrapperRect.left + cellRect.width / 2
        const cy = cellRect.top - wrapperRect.top + cellRect.height / 2
        const cellSize = Math.min(cellRect.width, cellRect.height)
        path.push({
          x: cx, y: cy, row: r, col: c,
          // 金属管壁较厚，略收短中心线，圆头仍会自然覆盖格子间隙且不被外框裁切。
          size: cellSize - 4,
          def: grid[r][c].pipe.def,
          rot: grid[r][c].pipe.rot,
          energized: grid[r][c].energized,
        })
      }
    }
  }
  connectionPath.value = path
}

// 自动监听 grid 变化更新路径（用 ref 包裹的 reactive 数组需要手动触发）
watch(() => placedCount.value, () => {
  setTimeout(() => updateConnectionPath(), 50) // 等待DOM渲染
})

let gridResizeObserver = null
onMounted(() => {
  if (!gridRef.value) return
  gridResizeObserver = new ResizeObserver(() => updateConnectionPath())
  gridResizeObserver.observe(gridRef.value)
  updateConnectionPath()
})

// ===================================================================
// 新手引导状态
// ===================================================================
const showTutorial = ref(false)
const tutorialStep = ref(1)

// 高亮方式：给对应 DOM 元素动态绑定 z-50 ring-4 ring-yellow-400 等类名，
// 使其浮在全屏遮罩（z-40）之上，无需任何坐标计算

function startTutorial() {
  showTutorial.value = true
  tutorialStep.value = 1
}

function advanceTutorial() {
  if (tutorialStep.value === 1) {
    tutorialStep.value = 2
  } else if (tutorialStep.value === 2) {
    tutorialStep.value = 3
  } else if (tutorialStep.value === 3) {
    skipTutorial()
  }
  // 进入步骤3时，3秒后自动关闭引导
  if (tutorialStep.value === 3) {
    setTimeout(() => skipTutorial(), 3000)
  }
}

function skipTutorial() {
  showTutorial.value = false
  tutorialStep.value = 1
}

let feedbackTimer = null

// ===================================================================
// 网格单元样式
// ===================================================================
function gridCellClass(cell) {
  const classes = []
  if (cell.row === start.row && cell.col === start.col) {
    classes.push('bg-cyan-100/75 border-2 border-cyan-400/60 shadow-[inset_0_0_16px_rgba(34,211,238,.2)]')
  } else if (cell.row === end.row && cell.col === end.col) {
    classes.push('bg-teal-100/75 border-2 border-teal-400/60 shadow-[inset_0_0_16px_rgba(45,212,191,.22)]')
  } else if (cell.obstacle) {
    classes.push('obstacle-cell border border-slate-500/30')
  } else if (cell.pipe) {
    classes.push('bg-cyan-100/70 border-2 border-cyan-300/50 shadow-sm')
    if (isConnected.value) {
      classes.push('bg-cyan-200/60 shadow-md')
    }
  } else {
    classes.push('bg-white/50 border border-cyan-100/40 hover:bg-cyan-50/60')
  }
  return classes.join(' ')
}

// ===================================================================
// 管道旋转：点击一次 rot +1（0→1→2→3→0），视觉与端口同步转 90°
// ===================================================================
function getPipeStyle(rot) {
  return {
    display: 'inline-block',
    transform: `rotate(${(rot % 4) * 90}deg)`,
    transition: 'transform 0.15s ease',
  }
}

// ===================================================================
// 点击交互
// ===================================================================
function onCellClick(row, col) {
  const cell = grid[row][col]

  // 起点/终点不能操作
  if ((row === start.row && col === start.col) || (row === end.row && col === end.col)) return
  // 障碍物不能操作
  if (cell.obstacle) {
    invalidDrops.value++ // 试图放到障碍物上 → 无效放置
    totalOperations.value++
    feedbackMsg.value = '❌ 这里有障碍物，不能放置管道哦！'
    feedbackOk.value = false
    clearFeedback()
    return
  }

  // 如果已有管道 → 旋转
  if (cell.pipe) {
    rotatePipe(row, col)
    return
  }

  // 未选中管道就点击空格 → 无意义点击
  if (selectedPipe.value === null || selectedPipe.value === undefined) {
    meaninglessClicks.value++
    totalOperations.value++
    feedbackMsg.value = '👆 先在右边选一个管道类型吧！'
    feedbackOk.value = false
    clearFeedback()
    return
  }

  // 放置新管道
  placePipe(row, col)
}

function selectPipeType(index) {
  selectedPipe.value = index
  // 引导步骤1: 玩家选中直管（index=0）后进入下一步
  if (showTutorial.value && tutorialStep.value === 1 && index === 0) {
    advanceTutorial()
  }
}

function placePipe(row, col) {
  if (selectedPipe.value === null || selectedPipe.value === undefined) {
    feedbackMsg.value = '👆 先在右边选一个管道类型吧！'
    feedbackOk.value = false
    clearFeedback()
    return
  }

  const pipeDef = pipeTypes[selectedPipe.value]
  if (!pipeDef) return

  grid[row][col].pipe = { def: pipeDef.def, rot: 0 }
  placedCount.value++
  totalOperations.value++ // 放置计为一次操作
  // 引导步骤2: 成功放置第一根管道后结束引导
  if (showTutorial.value && tutorialStep.value === 2) {
    advanceTutorial()
  }
  updateConnectivity()

  feedbackMsg.value = `✅ 已放置 ${pipeDef.char}`
  feedbackOk.value = true
  clearFeedback()
}

function rotatePipe(row, col) {
  const cell = grid[row][col]
  if (!cell.pipe) return

  cell.pipe.rot = (cell.pipe.rot + 1) % 4
  rotateCount.value++
  totalOperations.value++ // 旋转计为一次操作
  updateConnectivity()

  feedbackMsg.value = `🔄 已旋转 (${cell.pipe.rot}/4)`
  feedbackOk.value = true
  clearFeedback()
}

// ===================================================================
// 右键删除管道
// ===================================================================
function onRightClick(row, col) {
  const cell = grid[row][col]
  // 起点/终点/障碍物不能删除
  if ((row === start.row && col === start.col) || (row === end.row && col === end.col)) return
  if (cell.obstacle) return
  if (!cell.pipe) return

  cell.pipe = null
  placedCount.value = Math.max(0, placedCount.value - 1)
  totalOperations.value++ // 删除计为一次操作
  isConnected.value = false
  updateConnectivity()

  feedbackMsg.value = '🗑️ 已移除管道（右键删除）'
  feedbackOk.value = true
  clearFeedback()
}

// ===================================================================
// BFS 连通性检测
// ===================================================================
// ===================================================================
// 🔌 端口连通判定 — 管道必须有端口指向对方才能通电
// 方向: 'top' / 'right' / 'bottom' / 'left'
// ===================================================================

const DIR_DELTA = { top: [-1, 0], right: [0, 1], bottom: [1, 0], left: [0, -1] }
const OPPOSITE = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }
const ALL_DIRS = ['top', 'right', 'bottom', 'left']

// 各管道 rot=0（旋转前）时的端口 — 与游戏内显示一致
const BASE_PIPE_PORTS = {
  '─': ['left', 'right'],
  '┌': ['right', 'bottom'],
  '┐': ['left', 'bottom'],
  '└': ['top', 'right'],
  '┘': ['left', 'top'],
  '┬': ['left', 'right', 'bottom'],
}

const PORT_ROTATE_CW = { top: 'right', right: 'bottom', bottom: 'left', left: 'top' }

function rotatePorts(ports, steps) {
  let result = ports
  for (let i = 0; i < steps % 4; i++) {
    result = result.map((p) => PORT_ROTATE_CW[p])
  }
  return result
}

/**
 * 获取管道在指定旋转角下的端口
 * @param {string} def - 管道类型 '─'/'┐'/'└'/'┘'/'┌'/'┬'
 * @param {number} rot - 旋转 0/1/2/3
 * @returns {string[]} 端口方向列表
 */
function getPipePorts(def, rot) {
  const base = BASE_PIPE_PORTS[def]
  if (!base) return []
  return rotatePorts(base, rot % 4)
}

/**
 * 获取格子端口（起点全向、终点全向、障碍物无、管道按 def&rot、空格无）
 */
function isStartCell(row, col) {
  return row === start.row && col === start.col
}

function isEndCell(row, col) {
  return row === end.row && col === end.col
}

function getCellPorts(cell, row, col) {
  if (isStartCell(row, col) || isEndCell(row, col)) return ALL_DIRS.slice()
  if (cell.obstacle) return []
  if (cell.pipe) return getPipePorts(cell.pipe.def, cell.pipe.rot)
  return []
}

/**
 * 两格能通电 ⇔ 双方端口互相指向
 * 起点/终点视为全向接口：只要相邻管道的那一头有开口即可
 */
function canConnect(fromRow, fromCol, fromPorts, toRow, toCol, toPorts, dir) {
  if (isStartCell(fromRow, fromCol)) {
    return toPorts.includes(OPPOSITE[dir])
  }
  if (isEndCell(toRow, toCol)) {
    return fromPorts.includes(dir)
  }
  return fromPorts.includes(dir) && toPorts.includes(OPPOSITE[dir])
}

/**
 * 检查连通路径上是否有多余的管口（如T型管多出一个分支）
 */
function hasDanglingPorts(visited) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${r},${c}`
      // 只检查被电流经过的管道格子
      if (!visited.has(key)) continue
      if (isStartCell(r, c) || isEndCell(r, c)) continue
      if (!grid[r][c].pipe) continue

      const ports = getPipePorts(grid[r][c].pipe.def, grid[r][c].pipe.rot)
      for (const dir of ports) {
        const [dr, dc] = DIR_DELTA[dir]
        const nr = r + dr
        const nc = c + dc
        // 越界 → 多余管口
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return true
        const nKey = `${nr},${nc}`
        // 管口指向的格子不在电流路径上，又不是终点 → 多余管口
        if (!visited.has(nKey) && !isEndCell(nr, nc)) return true
      }
    }
  }
  return false
}

/**
 * BFS 连通检测 — 严格按端口方向走
 * 额外校验：路径上不能有多余管口（T型管伸出第三根不算真正连通）
 */
function updateConnectivity() {
  const visited = new Set()
  const queue = [{ row: start.row, col: start.col }]
  visited.add(`${start.row},${start.col}`)

  while (queue.length > 0) {
    const { row, col } = queue.shift()

    for (const dir of ALL_DIRS) {
      const [dr, dc] = DIR_DELTA[dir]
      const nr = row + dr
      const nc = col + dc

      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue

      const key = `${nr},${nc}`
      if (visited.has(key)) continue

      const fromPorts = getCellPorts(grid[row][col], row, col)
      const toPorts = getCellPorts(grid[nr][nc], nr, nc)

      // 空格 / 障碍物没有端口 → 不通
      if (fromPorts.length === 0 || toPorts.length === 0) continue

      // 端口必须匹配才能通电
      if (!canConnect(row, col, fromPorts, nr, nc, toPorts, dir)) continue

      visited.add(key)
      if (isEndCell(nr, nc)) continue

      queue.push({ row: nr, col: nc })
    }
  }

  // 必须连通终点，且路径上不能有多余管口
  const reachable = visited.has(`${end.row},${end.col}`)
  const clean = reachable && !hasDanglingPorts(visited)

  isConnected.value = clean
  // 只有从发电机真实可达的管道显示电流，断开的管道保持暗色。
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[r][c].energized = Boolean(grid[r][c].pipe && visited.has(`${r},${c}`))
    }
  }
  updateConnectionPath()
}

// ===================================================================
// 提交检查
// ===================================================================
function clearFeedback() {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => { feedbackMsg.value = '' }, 2500)
}

function submitCheck() {
  checkAttempts.value++
  updateConnectivity()

  if (isConnected.value) {
    duration.value = Math.floor((Date.now() - gameStartTime.value) / 1000)
    feedbackMsg.value = '⚡⚡⚡ 电路连通啦！基地恢复电力了！小队长你太棒了！🌟'
    feedbackOk.value = true
    setTimeout(() => { showComplete.value = true }, 1200)
    launchConfetti()
  } else {
    // 检测是"完全没连通"还是"有路径但管口多余"
    const reachable = (() => {
      const q = [{ row: start.row, col: start.col }]
      const v = new Set([`${start.row},${start.col}`])
      while (q.length) {
        const { row, col } = q.shift()
        for (const dir of ALL_DIRS) {
          const [dr, dc] = DIR_DELTA[dir]
          const nr = row + dr, nc = col + dc
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
          const k = `${nr},${nc}`
          if (v.has(k)) continue
          const fP = getCellPorts(grid[row][col], row, col)
          const tP = getCellPorts(grid[nr][nc], nr, nc)
          if (fP.length === 0 || tP.length === 0) continue
          if (!canConnect(row, col, fP, nr, nc, tP, dir)) continue
          v.add(k)
          if (isEndCell(nr, nc)) return true
          q.push({ row: nr, col: nc })
        }
      }
      return false
    })()
    feedbackMsg.value = reachable
      ? '❌ 从发电机到水晶有通路，但有些管道有多余的管口伸到空地上！确保每根管道的每个口都有对应的连接。💪'
      : '❌ 还没连通呢！从深海发电机到能源水晶接收站的路线还差一点，再试试吧！💪'
    feedbackOk.value = false
    // 高亮已放置的管道
    const hl = []
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c].pipe) hl.push(cellKey(r, c))
    highlightCells.value = hl
    setTimeout(() => { highlightCells.value = [] }, 2000)
  }
}

// ===================================================================
// 重置
// ===================================================================
function resetLevel() {
  // 每轮重新生成随机屏障、缺口和散落障碍。
  const nextGrid = generateGrid()
  grid.splice(0, grid.length, ...nextGrid)
  placedCount.value = 0
  rotateCount.value = 0
  isConnected.value = false
  connectionPath.value = []
  showComplete.value = false
  feedbackMsg.value = '🔄 已重置，重新铺设管道吧！'
  feedbackOk.value = true
  clearFeedback()
}

// ===================================================================
// 前往下一关
// ===================================================================
async function goNextLevel() {
  showComplete.value = false
  const dur = Math.floor((Date.now() - gameStartTime.value) / 1000)

  // 上报数据
  const logData = {
    level: 'LEVEL_2',
    studentId: 'stu_9527',
    duration_seconds: dur,
    raw_metrics: {
      block_drag_count: placedCount.value,
      species_placement_attempts: placedCount.value + rotateCount.value,
      block_gravity_fall_failures: rotateCount.value,
      check_attempts: checkAttempts.value,
      removal_count: 0,
      total_errors: 0,
      successful_pairs: isConnected.value ? 1 : 0,
      pipe_count: placedCount.value,
      rotate_count: rotateCount.value,
      grid_rows: ROWS,
      grid_cols: COLS,
      // 📊 行为量化评分系统 —— 无效交互数据
      meaningless_clicks: meaninglessClicks.value,
      blank_clicks: blankClicks.value,
      random_drags: randomDrags.value,
      invalid_drops: invalidDrops.value,
      total_operations: totalOperations.value,
    },
  }

  try {
    await fetch('/api/assessment/submit-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    })
  } catch (err) {
    console.warn('数据同步失败:', err.message)
  }

  emit('complete', {
    level: 'LEVEL_2',
    duration: dur,
    pipes_used: placedCount.value,
    raw_metrics: logData.raw_metrics,
    evidence: `第二关完成：用时${dur}秒，使用${placedCount.value}根管道，旋转${rotateCount.value}次，${isConnected.value ? '成功连通' : '未连通'}`,
  })
}

// ===================================================================
// 简陋庆祝特效
// ===================================================================
function launchConfetti() {
  const container = document.createElement('div')
  container.className = 'fixed inset-0 pointer-events-none z-[999] overflow-hidden'
  document.body.appendChild(container)
  const colors = ['#4fc3f7', '#f44336', '#4caf50', '#ffeb3b', '#e91e63', '#9c27b0', '#ff9800']
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div')
    el.className = 'absolute'
    el.style.left = Math.random() * 100 + '%'
    el.style.top = '-10px'
    el.style.width = (6 + Math.random() * 8) + 'px'
    el.style.height = (6 + Math.random() * 8) + 'px'
    el.style.background = colors[Math.floor(Math.random() * colors.length)]
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
    el.style.animation = `confettiFall ${(2 + Math.random() * 3)}s linear ${Math.random() * 1.5}s forwards`
    container.appendChild(el)
  }
  // Add style
  const style = document.createElement('style')
  style.textContent = `
    @keyframes confettiFall {
      0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg) scale(0.3); opacity: 0; }
    }
  `
  document.head.appendChild(style)
  setTimeout(() => { container.remove() }, 5000)
}
</script>

<style scoped>
.endpoint-device {
  position: relative;
  z-index: 8;
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  filter: drop-shadow(0 5px 5px rgba(3, 45, 62, .28));
}

.endpoint-route-legend {
  display: inline-flex;
  align-items: center;
  gap: .2rem;
  padding: .1rem .45rem;
  border: 1px solid rgba(8, 145, 178, .18);
  border-radius: 999px;
  background: rgba(255, 255, 255, .64);
  box-shadow: inset 0 1px rgba(255,255,255,.7);
}

.endpoint-route-legend img {
  width: 26px;
  height: 26px;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(8,47,73,.18));
}

.endpoint-route-current {
  color: #0891b2;
  font-size: 1rem;
  font-weight: 900;
  text-shadow: 0 0 8px rgba(34,211,238,.42);
}

.inline-endpoint-icon {
  display: inline-block;
  width: 28px;
  height: 28px;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(8,47,73,.2));
}

.endpoint-device img {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

.endpoint-generator {
  transform: translate(-4px, -3px);
}

.endpoint-receiver {
  transform: translate(4px, 3px);
}

.endpoint-glow {
  position: absolute;
  z-index: 1;
  inset: 12px;
  border-radius: 45%;
  background: radial-gradient(circle, rgba(34, 211, 238, .62), rgba(14, 165, 233, .18) 48%, transparent 72%);
  filter: blur(5px);
  animation: endpointPulse 2.1s ease-in-out infinite;
}

.endpoint-receiver .endpoint-glow {
  background: radial-gradient(circle, rgba(103, 232, 249, .78), rgba(45, 212, 191, .22) 48%, transparent 72%);
  animation-delay: -1s;
}

@keyframes endpointPulse {
  0%, 100% { opacity: .62; transform: scale(.9); }
  50% { opacity: 1; transform: scale(1.16); }
}

.obstacle-cell {
  background:
    radial-gradient(circle at 50% 75%, rgba(15, 23, 42, 0.72), transparent 48%),
    linear-gradient(155deg, rgba(30, 58, 78, 0.94), rgba(8, 47, 73, 0.74));
  box-shadow: inset 0 1px 5px rgba(255,255,255,0.13), inset 0 -6px 12px rgba(2,6,23,0.28);
}

.obstacle-scene {
  position: relative;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.obstacle-halo {
  position: absolute;
  inset: 8px 5px 3px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(2,6,23,.55), transparent 68%);
  transform: translateY(10px) scaleY(.38);
  filter: blur(1px);
}

.obstacle-emoji {
  position: relative;
  z-index: 2;
  font-size: 30px;
  line-height: 1;
  filter: drop-shadow(0 4px 3px rgba(2,6,23,.52)) saturate(1.15);
  transform: translateY(1px);
}

.obstacle-bubble {
  position: absolute;
  z-index: 3;
  width: 4px;
  height: 4px;
  border: 1px solid rgba(207,250,254,.75);
  border-radius: 50%;
  background: rgba(255,255,255,.12);
  animation: obstacleBubble 2.8s ease-in-out infinite;
}

.bubble-a { top: 6px; right: 7px; }
.bubble-b { width: 3px; height: 3px; top: 15px; right: 3px; animation-delay: -1.2s; }
.obstacle-jelly .obstacle-emoji,
.obstacle-star .obstacle-emoji {
  filter: drop-shadow(0 0 7px rgba(103,232,249,.8)) drop-shadow(0 4px 3px rgba(2,6,23,.5));
}
.obstacle-coral .obstacle-emoji {
  filter: drop-shadow(0 0 6px rgba(251,113,133,.35)) drop-shadow(0 4px 3px rgba(2,6,23,.5));
}
.obstacle-weed .obstacle-emoji {
  animation: seaweedSway 3s ease-in-out infinite;
  transform-origin: bottom center;
}

@keyframes obstacleBubble {
  0%, 100% { transform: translateY(5px) scale(.7); opacity: .25; }
  50% { transform: translateY(-5px) scale(1.15); opacity: .9; }
}

@keyframes seaweedSway {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(5deg); }
}

.pipe-glyph {
  transform-origin: center center;
}

/* 引导高亮 — 脉动闪烁 */
.guide-highlight {
  animation: guidePulse 0.8s ease-in-out infinite !important;
  box-shadow: 0 0 24px rgba(52, 211, 153, 0.7) !important;
}
@keyframes guidePulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(52, 211, 153, 0.5); }
  50% { transform: scale(1.08); box-shadow: 0 0 36px rgba(52, 211, 153, 0.9); }
}

@keyframes bounceIn {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
.animate-bounce-in { animation: bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
</style>
