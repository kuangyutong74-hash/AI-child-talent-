<template>
  <div class="level-one-screen game-stage flex flex-col h-full p-3 md:p-4 gap-3 relative">
    <!-- 🏠 珊瑚特效 Canvas -->
    <Level1Effects :triggerBurst="burstPos" />

    <!-- ============================================================ -->
    <!-- 上部：所有海洋生物在同一行（横向滚动）                        -->
    <!-- ============================================================ -->
    <div class="shrink-0">
      <div class="flex items-center justify-between mb-2">
        <h3 class="level-section-heading text-base md:text-lg"><span v-html="p('🐠 待安顿的海洋生物')"></span></h3>
        <div class="flex gap-1.5 shrink-0 items-center">
          <!-- 沫沫提示：全部配对完成，引导点击提交检查 -->
          <div v-if="allPairedReady"
               class="flex items-center gap-1.5 px-3 py-1 bg-cyan-100/90 rounded-full border border-cyan-300/60 text-cyan-700 text-xs font-bold animate-bounce-in whitespace-nowrap">
            <MomoDolphin size="sm" :animate="false" />
            <span>点击提交检查！</span>
          </div>
          <button @mouseenter="playHover" @click="submitCheck"
                  class="px-4 py-1.5 bg-gradient-to-r from-emerald-400 to-green-500 text-white text-xs md:text-sm rounded-full shadow-lg shadow-emerald-200/50 hover:scale-105 active:scale-95 transition-transform font-bold"
                  :class="{ 'guide-highlight': allPairedReady }">
            <span v-html="p('🔍 提交检查')"></span>
          </button>
          <button @mouseenter="playHover" @click="resetAll"
                  class="px-3 py-1.5 bg-white/70 text-rose-500 text-xs md:text-sm rounded-full border border-rose-200 hover:bg-rose-50 transition-all">
            <span v-html="p('↺ 重置')"></span>
          </button>
        </div>
      </div>

      <!-- 生物卡片：横向一排，可滚动 -->
      <div class="flex gap-2 overflow-x-auto pb-1.5"
           :class="{'relative z-50 ring-4 ring-yellow-400 shadow-[0_0_20px_#facc15] p-2 rounded-xl bg-white/70 transition-all duration-300': showTutorial && tutorialStep === 3}">
        <div v-for="cr in allItems" :key="cr.id"
             draggable="true"
             @dragstart="onDragStart($event, cr)"
             class="relative flex flex-col items-center bg-white/85 rounded-xl px-3 py-2 border border-rose-200/50 cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-[1.03] active:scale-95 transition-all shrink-0 min-w-[80px]"
             :class="{'z-50 ring-4 ring-yellow-400 shadow-[0_0_20px_#facc15] scale-105 pointer-events-auto': showTutorial && tutorialStep === 1 && cr.id === 'anemone'}">
          <CreatureImage :creatureId="cr.id" :emoji="cr.emoji" :alt="cr.name" size="lg" customClass="block mx-auto" />
          <span class="text-[11px] md:text-xs font-bold text-rose-700 mt-0.5 whitespace-nowrap" v-html="p(cr.name)"></span>
            <span class="text-[10px] md:text-xs text-rose-700 font-semibold text-center leading-tight mt-0.5 whitespace-nowrap" v-html="p(cr.want)"></span>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 中部：海洋空地（左侧） + 配对进度（右侧）                    -->
    <!-- ============================================================ -->
    <div class="flex-1 flex gap-3 min-h-0">

      <!-- ===== 左侧：模拟海洋空地（自由放置，无网格） ===== -->
      <div class="flex-[2] flex flex-col min-w-0">
        <div class="flex items-center justify-between mb-1.5">
          <h3 class="level-section-heading compact text-sm md:text-base"><span v-html="p('🌊 海洋空地')"></span></h3>
          <span class="text-xs md:text-sm text-cyan-800 font-medium"><span v-html="p('🖱️ 拖入放置 · 点击移除')"></span></span>
        </div>

        <!-- 海洋场景容器 -->
        <div ref="oceanRef"
             @dragover.prevent="onDragOver"
             @dragleave="onDragLeave"
             @drop="onDropOcean"
             @click="onOceanBackgroundClick"
             class="ocean-habitat relative flex-1 rounded-2xl border-2 overflow-hidden transition-all duration-200 min-h-[360px]"
             :class="[
               isDragOver ? 'border-emerald-400/60 shadow-lg shadow-emerald-200/30' : 'border-cyan-200/30',
               showTutorial && tutorialStep === 2 ? 'z-50 ring-4 ring-yellow-400 shadow-[0_0_20px_#facc15] scale-[1.02]' : ''
             ]">

          <!-- 海底环境层（纯视觉，不影响拖放） -->
          <div class="ocean-caustics pointer-events-none"></div>
          <div class="ocean-ray ocean-ray-one pointer-events-none"></div>
          <div class="ocean-ray ocean-ray-two pointer-events-none"></div>
          <img :src="oceanReefScene"
               alt=""
               aria-hidden="true"
               class="generated-ocean-reef reef-half reef-half-left pointer-events-none select-none" />
          <img :src="oceanReefScene"
               alt=""
               aria-hidden="true"
               class="generated-ocean-reef reef-half reef-half-right pointer-events-none select-none" />
          <div class="sand-dune sand-dune-back pointer-events-none"></div>
          <div class="sand-dune sand-dune-front pointer-events-none"></div>
          <span class="ocean-bubble bubble-one pointer-events-none"></span>
          <span class="ocean-bubble bubble-two pointer-events-none"></span>
          <span class="ocean-bubble bubble-three pointer-events-none"></span>
          <span class="ocean-bubble bubble-four pointer-events-none"></span>

          <!-- 沙地区域指示 -->
          <div class="absolute bottom-0 left-0 right-0 h-[18%] flex items-end justify-center pb-2 pointer-events-none z-[2]">
            <span class="sand-label text-xs md:text-sm font-bold"><span v-html="p('✦ 沙地区域 ✦')"></span></span>
          </div>

          <!-- 空状态提示 -->
          <div v-if="placedItems.length === 0 && !isDragOver"
               class="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
            <div class="text-center">
              <div class="text-4xl md:text-5xl opacity-30 mb-2">🌊</div>
          <div class="text-sm md:text-base text-cyan-800/90 font-medium" v-html="p('把上面的生物拖进来安家吧～')"></div>
            </div>
          </div>

          <!-- 拖入高亮提示 -->
          <div v-if="isDragOver && dragItem && placedItems.length > 0"
               class="absolute inset-0 z-[12] bg-emerald-400/5 pointer-events-none flex items-center justify-center">
          <span class="text-sm text-emerald-800 font-bold bg-white/85 px-4 py-1.5 rounded-full shadow-sm">🖐️ 松开放置</span>
          </div>

          <!-- ===== 已放置的生物（自由浮动） ===== -->
          <div v-for="(item, i) in displayItems" :key="item.uid"
               @click.stop="removePlaced(item.uid)"
               class="absolute z-10 cursor-pointer group transition-all duration-300 hover:z-20"
               :class="{ 'animate-pop-in': item.justPlaced }"
               :style="{ left: item.dispX + '%', top: item.dispY + '%', transform: 'translate(-50%, -50%)' }">

            <!-- 主生物显示（支持 SVG 替换，自动回退 emoji） -->
            <CreatureImage :creatureId="item.id" :emoji="item.emoji" :alt="item.name" size="xl" customClass="block transition-transform duration-200 group-hover:scale-110 drop-shadow-lg" />

            <!-- hover 提示删除 -->
            <div class="absolute -top-2 -right-2 w-5 h-5 bg-rose-400/90 rounded-full flex items-center justify-center text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              ✕
            </div>
          </div>
        </div>

        <!-- 反馈消息 -->
        <div v-if="feedbackMsg" class="mt-2.5 px-4 py-2.5 rounded-xl text-sm md:text-base w-full transition-all"
             :class="feedbackOk ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200' : 'bg-rose-50 text-rose-600 border-2 border-rose-200'">
          <span v-html="feedbackMsg"></span>
        </div>
      </div>

      <!-- ===== 右侧：配对进度面板（加宽） ===== -->
      <div class="w-[320px] shrink-0 flex flex-col gap-2 overflow-y-auto"
           :class="{'relative z-50 ring-4 ring-yellow-400 shadow-[0_0_20px_#facc15] p-2 rounded-xl bg-white/70 transition-all duration-300': showTutorial && tutorialStep === 3}">
        <div class="bg-white/60 rounded-xl p-4 border border-cyan-200/30">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm md:text-base font-bold text-cyan-700"><span v-html="p('🎯 配对进度')"></span></h4>
            <span class="text-xs text-cyan-400">{{ rules.filter(r => r.done).length }}/4</span>
          </div>
          <div class="space-y-2">
            <div v-for="(rule, i) in rules" :key="i"
                 class="flex items-start gap-2 text-xs md:text-sm px-3 py-2 rounded-lg transition-all"
                 :class="rule.done ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white/80 text-cyan-600 border border-cyan-100'">
              <span class="text-base shrink-0 mt-0.5">{{ rule.done ? '✅' : '⏳' }}</span>
              <div class="min-w-0">
                <div class="font-semibold leading-snug flex items-center gap-1">
                  <CreatureImage v-for="c in rule.creatureIds" :key="c" :creatureId="c" :emoji="getEmoji(c)" size="sm" customClass="shrink-0" />
                  <span class="text-[11px] ml-1" v-html="p(rule.shortLabel)"></span>
                </div>
                <div v-if="!rule.done && rule.hint" class="text-[11px] text-cyan-500/80 mt-1" v-html="p(rule.hint)"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 迷你操作指南 -->
        <div class="bg-cyan-50/60 rounded-xl p-4 border border-cyan-200/20">
          <h5 class="text-sm font-bold text-cyan-700 mb-1.5"><span v-html="p('💡 配对指南')"></span></h5>
          <ul class="text-[11px] md:text-xs text-cyan-600/80 space-y-1 leading-relaxed">
            <li v-html="p('• 共生伙伴要放一起（靠近即可）')"></li>
            <li v-html="p('• 花园鳗要埋在沙地，头顶不能有东西')"></li>
            <li v-html="p('• 枪虾和鰕虎鱼紧挨着做邻居')"></li>
            <li v-html="p('• 鮣鱼吸在海龟下方搭便车')"></li>
            <li v-html="p('• 点击海洋里的生物可移除')"></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 海洋科考日志 弹窗（保持原有设计）                              -->
    <!-- ============================================================ -->
    <div v-if="showBook"
         class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
         @click.self="closeBook">
      <div class="w-[680px] max-w-[92vw] bg-white rounded-3xl shadow-2xl border-2 border-cyan-200 overflow-hidden">
        <div class="bg-gradient-to-r from-cyan-100 to-blue-100 px-6 py-5 border-b border-cyan-200">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-4xl">📖</span>
              <h3 class="text-2xl font-bold text-cyan-800"><span v-html="p('海洋科考日志')"></span></h3>
            </div>
              <span class="text-sm text-cyan-800 font-semibold">第 {{ bookPage + 1 }} / 4 页</span>
          </div>
        </div>

        <div class="px-8 py-6 min-h-[260px]">
          <div class="flex justify-center gap-2 mb-4">
            <span v-for="p in 4" :key="p"
                  class="w-3.5 h-3.5 rounded-full transition-all cursor-pointer"
                  :class="p-1 === bookPage ? 'bg-cyan-400 scale-125' : (p-1 < bookPage ? 'bg-emerald-400' : 'bg-gray-200')"
                  @click="bookPage = p-1">
            </span>
          </div>

          <div class="transition-opacity duration-300">
            <div class="flex gap-6 items-start">
              <!-- 真实图片（每页最多2张并列）→ 回退 emoji -->
              <div class="flex gap-2 shrink-0">
                <div v-for="(creatureId, ci) in bookPages[bookPage].photos" :key="ci"
                     class="w-20 h-20 flex items-center justify-center rounded-xl overflow-hidden bg-cyan-50/50">
                  <img v-if="bookPhotoLoaded[bookPage]?.[ci]"
                       :src="bookPhotoSrc(creatureId)"
                       :alt="creatureId"
                       class="w-full h-full object-cover" />
                  <span v-else class="text-4xl">{{ getBookEmoji(bookPage, ci) }}</span>
                </div>
              </div>
              <div>
                <h4 class="text-xl font-bold text-cyan-800 mb-2" v-html="p(bookPages[bookPage].title)"></h4>
                <p class="text-cyan-900 text-base font-medium leading-relaxed" v-html="p(bookPages[bookPage].content)"></p>
                <div class="mt-3 flex gap-2">
                  <span class="px-3 py-1 bg-cyan-100/60 rounded text-sm text-cyan-600" v-html="p('#' + bookPages[bookPage].tag1)"></span>
                  <span class="px-3 py-1 bg-rose-100/60 rounded text-sm text-rose-600" v-html="p('#' + bookPages[bookPage].tag2)"></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50/80 border-t border-cyan-200/30 flex items-center justify-between">
          <button @mouseenter="playHover" @click="prevPage"
                 class="px-5 py-2 text-sm rounded-full border-2 border-cyan-200 text-cyan-600 hover:bg-cyan-50 transition-all"
                 :class="{ 'opacity-30 pointer-events-none': bookPage === 0 }">
            ◀ <span v-html="p('上一页')"></span>
          </button>

          <div v-if="bookPage < 3">
            <button @mouseenter="playHover" @click="nextPage"                   class="px-6 py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-sm rounded-full shadow-lg hover:scale-105 transition-transform font-bold">
              <span v-html="p('下一页')"></span> ▶
            </button>
          </div>
          <div v-else class="flex items-center gap-3">
            <span class="text-emerald-600 font-bold text-base" v-html="p('✅ 科考成功！')"></span>
            <button @mouseenter="playHover" @click="goNextLevel"                   class="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-base rounded-full shadow-lg hover:scale-105 transition-transform font-bold">
              🚀 <span v-html="p('前往下一关')"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 第一关故事背景弹窗 -->
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
            <p class="text-base md:text-lg text-cyan-700/90 leading-relaxed flex-1">
              <span v-html="p('报告小队长！风暴把海底的珊瑚公寓吹塌了，小鱼们都在海里流落失所呢。我们需要根据它们独特的居住秘密，用岩石和珊瑚块为它们建起稳固的公寓，并帮它们搬进最喜欢的房间！快来挑战吧！')"></span>
            </p>
            <button @mouseenter="playHover" @click.stop="toggleTTS('报告小队长！风暴把海底的珊瑚公寓吹塌了，小鱼们都在海里流落失所呢。我们需要根据它们独特的居住秘密，用岩石和珊瑚块为它们建起稳固的公寓，并帮它们搬进最喜欢的房间！快来挑战吧！', 'momo')"
                    class="shrink-0 w-10 h-10 rounded-full bg-cyan-100/80 border border-cyan-200 flex items-center justify-center text-lg hover:scale-110 transition-transform">🔊</button>
          </div>
          <div class="mt-6 text-center">
            <button @mouseenter="playHover" @click="startGame"
                    class="px-10 py-3 bg-gradient-to-r from-rose-400 to-pink-500 text-white text-lg rounded-full shadow-lg hover:scale-105 transition-transform font-bold">
              <span v-html="p('🏗️ 开始重建')"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 第一关新手引导（动画遮罩）                                      -->
    <!-- ============================================================ -->
    <TutorialOverlay
      :visible="showTutorial && tutorialStep === 1"
      message="小队长，先把公主海葵拖出来吧！👇"
      @skip="skipTutorial"
    />

    <TutorialOverlay
      :visible="showTutorial && tutorialStep === 2"
      message="把它稳稳地放在沙地上，给双锯鱼建一个安全的家吧！🎯"
      @skip="skipTutorial"
    />

    <TutorialOverlay
      :visible="showTutorial && tutorialStep === 3"
      message="太棒了！现在试试把其他的海洋小伙伴也配对安顿好吧！🐠🤝"
      @skip="skipTutorial"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import TutorialOverlay from './TutorialOverlay.vue'
import { stopTTS, toggleTTS } from '../utils/tts.js'
import { playHover, playClick, playSuccess } from '../utils/sounds.js'
import { usePinyinText } from '../utils/pinyin.js'
import Level1Effects from './effects/Level1Effects.vue'
import MomoDolphin from './characters/MomoDolphin.vue'
import CreatureImage from './canvas/CreatureImage.vue'
import clownfishPhoto from '../assets/photos/clownfish.jpg'
import anemonePhoto from '../assets/photos/anemone.jpg'
import gardenEelPhoto from '../assets/photos/garden_eel.jpg'
import shrimpPhoto from '../assets/photos/shrimp.jpg'
import gobyPhoto from '../assets/photos/goby.jpg'
import remoraPhoto from '../assets/photos/remora.jpg'
import turtlePhoto from '../assets/photos/turtle.jpg'
import oceanReefScene from '../assets/scenes/ocean-reef.png'

const { p } = usePinyinText()

const props = defineProps({
  studentId: { type: String, default: 'stu_9527' },
})
const emit = defineEmits(['complete'])

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
}

function skipTutorial() {
  showTutorial.value = false
  tutorialStep.value = 1
}

// ===================================================================
// 所有可放置的海洋生物（统一为同一类，无 env / creature 区分）
// ===================================================================
const allItems = [
  { id: 'clownfish', name: '双锯鱼',     emoji: '🐠', want: '想钻海葵睡大觉' },
  { id: 'garden_eel', name: '花园鳗',     emoji: '🪱', want: '要埋进沙地跳舞' },
  { id: 'shrimp',     name: '共生枪虾',   emoji: '🦐', want: '紧挨鰕虎鱼做邻居' },
  { id: 'goby',       name: '鰕虎鱼',     emoji: '🐟', want: '给枪虾当放哨兵' },
  { id: 'anemone',    name: '公主海葵',   emoji: '🌸', want: '给双锯鱼做睡袋' },
  { id: 'turtle',     name: '绿海龟',     emoji: '🐢', want: '让鮣鱼搭便车' },
  { id: 'remora',     name: '鮣鱼(吸盘)', emoji: '🧲', want: '吸海龟肚皮旅行' },
]

// ===================================================================
// 放置数据：每个生物在海洋中的位置（百分比坐标）
// ===================================================================
let uidCounter = 0
const placedItems = ref([]) // { uid, id, name, emoji, x, y, justPlaced }

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

onMounted(() => {
  document.addEventListener('dragend', handleDragEnd)
})

onUnmounted(() => {
  document.removeEventListener('dragend', handleDragEnd)
  stopTTS()
})

// ===================================================================
// 行为指标追踪（用于后端天赋评估引擎 + 行为量化评分系统）
// ===================================================================
const gameStartTime = ref(Date.now())
const blockDragCount = ref(0)             // 拖拽操作次数
const speciesPlacementAttempts = ref(0)   // 放置尝试次数（含失败）
const blockGravityFallFailures = ref(0)   // 移除/纠正次数（重力修正）
const removalCount = ref(0)               // 删除次数
const checkAttempts = ref(0)              // 提交检查次数
const checkHistory = ref([])              // 每次检查的结果快照

// 📊 行为量化评分系统 —— 无效交互追踪
const meaninglessClicks = ref(0)           // 无意义点击（点击装饰/背景）
const blankClicks = ref(0)                // 空白点击（点击非交互区域）
const randomDrags = ref(0)                // 随意拖拽（拖了没放到位）
const invalidDrops = ref(0)               // 无效放置（放到不允许位置）
const totalOperations = ref(0)            // 总操作次数（含有效+无效）

// 🏠 珊瑚爆发特效触发位置
const burstPos = ref(null)

const oceanRef = ref(null)
const isDragOver = ref(false)
let dragItem = null

// ===================================================================
// 拖拽事件
// ===================================================================

function onDragStart(e, item) {
  blockDragCount.value++ // 记录拖拽次数
  dragItem = item
  e.dataTransfer.setData('text/plain', item.id)
  e.dataTransfer.effectAllowed = 'copy'
  // 引导步骤1: 玩家拖动了卡片（任何卡片），进入步骤2
  if (showTutorial.value && tutorialStep.value === 1) {
    advanceTutorial()
  }
  // 引导步骤3: 玩家开始拖动其他卡片进行匹配，结束引导
  if (showTutorial.value && tutorialStep.value === 3) {
    advanceTutorial()
  }
}

function onDragOver(e) {
  if (!dragItem) {
    isDragOver.value = false
    return
  }
  isDragOver.value = true
}

function onDragLeave(e) {
  // 只有真正离开容器时才取消
  if (oceanRef.value && !oceanRef.value.contains(e.relatedTarget)) {
    isDragOver.value = false
  }
}

function onDropOcean(e) {
  speciesPlacementAttempts.value++ // 记录放置尝试（含失败）
  totalOperations.value++ // 每次放置尝试都计为一次操作
  isDragOver.value = false
  if (!dragItem || !oceanRef.value) return

  // 检查是否已经放置过了
  if (placedItems.value.some(p => p.id === dragItem.id)) {
    invalidDrops.value++ // 重复放置 → 无效操作
    feedbackMsg.value = '❌ 这个生物已经放在海洋里啦！点击它可以移除再重新放～'
    feedbackOk.value = false
    dragItem = null
    return
  }

  const rect = oceanRef.value.getBoundingClientRect()
  let x = ((e.clientX - rect.left) / rect.width) * 100
  let y = ((e.clientY - rect.top) / rect.height) * 100
  // 留边距，防止贴边
  x = Math.max(6, Math.min(94, x))
  y = Math.max(6, Math.min(94, y))

  // 海葵必须放在沙地（y >= 78）才符合逻辑
  if (dragItem.id === 'anemone' && y < 78) {
    invalidDrops.value++ // 放到不允许的位置 → 无效放置
    feedbackMsg.value = '❌ 公主海葵需要种在沙地里才能给双锯鱼当睡袋哦！拖到下面的沙地区吧～🏖️'
    feedbackOk.value = false
    dragItem = null
    return
  }

  const uid = ++uidCounter
  placedItems.value.push({ ...dragItem, x, y, uid, justPlaced: true })
  // 引导步骤2: 成功放置后结束引导
  if (showTutorial.value && tutorialStep.value === 2) {
    advanceTutorial()
  }
  // 短暂延迟后去除动画标记
  setTimeout(() => {
    const idx = placedItems.value.findIndex(p => p.uid === uid)
    if (idx !== -1) placedItems.value[idx].justPlaced = false
  }, 500)

  feedbackMsg.value = `✅ 已将 ${dragItem.emoji} ${dragItem.name} 放入海洋！`
  feedbackOk.value = true
  dragItem = null
  updateRules()
  clearFeedback()
}

// ===================================================================
// 移除已放置的生物（点击）
// ===================================================================

function removePlaced(uid) {
  // 记录移除操作：模拟"重力修正"或"布局调整"
  blockGravityFallFailures.value++
  removalCount.value++
  totalOperations.value++ // 移除也计为一次操作
  const idx = placedItems.value.findIndex(p => p.uid === uid)
  if (idx === -1) return
  const item = placedItems.value[idx]
  placedItems.value.splice(idx, 1)
  feedbackMsg.value = `🗑️ 已移除 ${item.emoji} ${item.name}`
  feedbackOk.value = true
  updateRules()
  clearFeedback()
}

// ===================================================================
// 全局拖拽清理
// ===================================================================

function handleDragEnd() {
  // 拖拽结束时如果 dragItem 还在（未被放置到有效区域）→ 随意拖拽
  if (dragItem) {
    randomDrags.value++
    totalOperations.value++
  }
  isDragOver.value = false
  dragItem = null
}

// 📊 点击海洋背景（空白区域/装饰元素）→ 无意义点击
function onOceanBackgroundClick(e) {
  // 只有点击到容器本身或装饰元素才算无意义点击
  // 点击已放置的生物由 @click.stop 阻止冒泡，不会到达这里
  meaninglessClicks.value++
  totalOperations.value++
}

// ===================================================================
// 显示集群（相近的生物在视觉上稍微错开）
// ===================================================================
const CLUSTER_DIST = 8 // 多近算"同一位置"
const CLUSTER_OFFSET = 4 // 错开百分比

const displayItems = computed(() => {
  const items = placedItems.value
  if (items.length === 0) return []

  // BFS 传递闭包聚类：如果 A 和 B 近、B 和 C 近，则 A B C 属于同一簇
  const n = items.length
  const adj = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = items[i].x - items[j].x
      const dy = items[i].y - items[j].y
      if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_DIST) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }

  const visited = new Set()
  const clusters = []

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue
    const cluster = []
    const queue = [i]
    while (queue.length) {
      const idx = queue.shift()
      if (visited.has(idx)) continue
      visited.add(idx)
      cluster.push(idx)
      adj[idx].forEach(nb => { if (!visited.has(nb)) queue.push(nb) })
    }
    clusters.push(cluster)
  }

  // 每个簇内视觉错开
  const result = []
  clusters.forEach(cluster => {
    cluster.forEach((idx, offset) => {
      result.push({
        ...items[idx],
        dispX: items[idx].x + (offset - (cluster.length - 1) / 2) * CLUSTER_OFFSET,
        dispY: items[idx].y + Math.abs(offset - (cluster.length - 1) / 2) * CLUSTER_OFFSET * 0.5,
      })
    })
  })

  return result
})

// ===================================================================
// 配对规则引擎（基于空间距离，无格子）
// ===================================================================
const emojiMap = {
  clownfish: '🐠', garden_eel: '🪱', shrimp: '🦐', goby: '🐟',
  anemone: '🌸', turtle: '🐢', remora: '🧲',
}
function getEmoji(id) { return emojiMap[id] || '🐟' }

const rules = reactive([
  { id: 'clownfish_anemone', creatureIds: ['clownfish', 'anemone'], shortLabel: '双锯鱼 → 海葵',          hint: '把双锯鱼和海葵放在一起', done: false },
  { id: 'garden_eel',        creatureIds: ['garden_eel'],        shortLabel: '花园鳗 → 沙地',           hint: '花园鳗要在沙地处，头顶无遮挡', done: false },
  { id: 'shrimp_goby',       creatureIds: ['shrimp', 'goby'],    shortLabel: '枪虾 ⇋ 鰕虎鱼',           hint: '枪虾和鰕虎鱼相邻', done: false },
  { id: 'remora_turtle',     creatureIds: ['remora', 'turtle'],  shortLabel: '鮣鱼 → 海龟',             hint: '鮣鱼吸在海龟身上',   done: false },
])

// 全部配对完成时高亮引导"提交检查"按钮
const allPairedReady = computed(() => {
  return rules.every(r => r.done) && !showBook.value
})

function pos(id) {
  return placedItems.value.find(p => p.id === id)
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function inSand(p) {
  return p.y >= 78
}

function updateRules() {
  rules.forEach(r => r.done = false)

  // 规则1: 双锯鱼 + 海葵 → 同一位置，且海葵要种在沙地
  const cf = pos('clownfish')
  const an = pos('anemone')
  rules[0].done = !!(cf && an && dist(cf, an) < CLUSTER_DIST && inSand(an))

  // 规则2: 花园鳗 → 沙地，头顶无遮挡
  const eel = pos('garden_eel')
  if (eel && inSand(eel)) {
    const blocked = placedItems.value.some(p =>
      p.id !== 'garden_eel' && Math.abs(p.x - eel.x) < 10 && p.y < eel.y - 4
    )
    rules[1].done = !blocked
  } else {
    rules[1].done = false
  }

  // 规则3: 枪虾 + 鰕虎鱼 → 挨着做邻居（不分左右）
  const sh = pos('shrimp')
  const gb = pos('goby')
  if (sh && gb) {
    rules[2].done = dist(sh, gb) < 20
  } else {
    rules[2].done = false
  }

  // 规则4: 鮣鱼 + 海龟 → 鮣鱼吸在海龟下方附近
  const re = pos('remora')
  const tu = pos('turtle')
  if (re && tu) {
    rules[3].done = dist(re, tu) < 20 && re.y > tu.y - 5
  } else {
    rules[3].done = false
  }
}

// ===================================================================
// 提交检查
// ===================================================================

const feedbackMsg = ref('')
const feedbackOk = ref(false)
let feedbackTimer = null

function clearFeedback() {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => { feedbackMsg.value = '' }, 2500)
}

function submitCheck() {
  checkAttempts.value++
  updateRules()
  const allDone = rules.every(r => r.done)
  const fails = rules.filter(r => !r.done)

  // 记录本次检查快照
  checkHistory.value.push({
    time: Date.now(),
    all_done: allDone,
    pairs: rules.map(r => ({ id: r.id, done: r.done })),
  })

  if (allDone) {
    feedbackMsg.value = '🎉 太棒啦！所有生物都找到了最合适的家！沫沫为你骄傲！🌟'
    feedbackOk.value = true
    // 🏠 触发珊瑚爆发特效
    if (oceanRef.value) {
      const rect = oceanRef.value.getBoundingClientRect()
      burstPos.value = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
    }
    setTimeout(() => { showBook.value = true }, 800)
  } else {
    const hints = []
    fails.forEach(f => {
      if (f.id === 'clownfish_anemone') hints.push('🐠 双锯鱼想找海葵当睡袋，把它们放在一起吧！')
      if (f.id === 'garden_eel') hints.push('🪱 花园鳗头顶不能有东西压着，它想埋在沙地里～')
      if (f.id === 'shrimp_goby') hints.push('🦐 枪虾和鰕虎鱼是最佳邻居，让它们紧挨着吧！')
      if (f.id === 'remora_turtle') hints.push('🧲 鮣鱼想吸在海龟肚子下游历大海，把鮣鱼放在海龟下方附近吧！')
    })
    feedbackMsg.value = '❌ 还有一些小伙伴不太满意……<br>' + hints.join('<br>')
    feedbackOk.value = false
  }
}

// ===================================================================
// 重置
// ===================================================================

function resetAll() {
  placedItems.value = []
  rules.forEach(r => r.done = false)
  feedbackMsg.value = '🔄 已重置，重新开始吧！'
  feedbackOk.value = true
  clearFeedback()
}

// ===================================================================
// 海洋科考日志
// ===================================================================

const showBook = ref(false)
const bookPage = ref(0)

const bookPages = [
  {
    emoji: '🐠🌸', photos: ['clownfish', 'anemone'], title: '双锯鱼 🤝 公主海葵',
    content: '你知道吗？公主海葵的触手里有毒刺，会刺伤其他鱼。但双锯鱼身体表面有一层神奇的"黏液保护衣"，不仅不怕毒刺，还能把海葵当成最安全的睡袋呢！🤝',
    tag1: '共生关系', tag2: '黏液保护',
  },
  {
    emoji: '🪱', photos: ['garden_eel'], title: '花园鳗 🤝 松软沙地',
    content: '花园鳗是非常害羞的鱼。它们要把大半个身体埋在松软的沙子地里，只露出上半身像小草一样摇摆。如果头顶被石头压住，它们就无法探出头来吃浮游生物啦！🪱',
    tag1: '栖息地需求', tag2: '安全感',
  },
  {
    emoji: '🦐🐟', photos: ['shrimp', 'goby'], title: '共生枪虾 🤝 鰕虎鱼',
    content: '枪虾是海底的"挖掘机大王"，但它几乎是个盲人；而鰕虎鱼视力极好。它们住在一个洞里，枪虾挖洞，鰕虎鱼在洞口放哨，它们用触角传递危险信号，形影不离！🦐🐟',
    tag1: '共生合作', tag2: '优势互补',
  },
  {
    emoji: '🧲🐢', photos: ['remora', 'turtle'], title: '鮣鱼 🤝 绿海龟',
    content: '鮣鱼是海洋里的"免费旅行家"！它的头顶长着一个像鞋底一样的吸盘，能牢牢吸在海龟的肚子下面，省力地到处旅行，还能顺便吃海龟掉落的食物碎屑哦！🐢',
    tag1: '依附共生', tag2: '免费旅行',
  },
]

// 📸 科普日志真实图片支持
const bookPhotoLoaded = ref([{}, {}, {}, {}])

const BOOK_PHOTO_SOURCES = {
  clownfish: clownfishPhoto,
  anemone: anemonePhoto,
  garden_eel: gardenEelPhoto,
  shrimp: shrimpPhoto,
  goby: gobyPhoto,
  remora: remoraPhoto,
  turtle: turtlePhoto,
}

function bookPhotoSrc(creatureId) {
  return BOOK_PHOTO_SOURCES[creatureId] || ''
}

const bookEmojiMap = {
  clownfish: '🐠', anemone: '🌸', garden_eel: '🪱',
  shrimp: '🦐', goby: '🐟', remora: '🧲', turtle: '🐢',
}
function getBookEmoji(pageIdx, photoIdx) {
  const id = bookPages[pageIdx]?.photos?.[photoIdx]
  return bookEmojiMap[id] || '🐟'
}

// 尝试预加载所有照片
onMounted(() => {
  bookPages.forEach((page, pi) => {
    (page.photos || []).forEach((creatureId, ci) => {
      const img = new Image()
      img.onload = () => { bookPhotoLoaded.value[pi] = { ...bookPhotoLoaded.value[pi], [ci]: true } }
      img.src = bookPhotoSrc(creatureId)
    })
  })
})

function nextPage() { if (bookPage.value < 3) bookPage.value++ }
function prevPage() { if (bookPage.value > 0) bookPage.value-- }
function closeBook() { showBook.value = false; bookPage.value = 0 }

async function goNextLevel() {
  closeBook()
  const duration = Math.floor((Date.now() - gameStartTime.value) / 1000)
  const errors = rules.filter(r => !r.done).length
  const successfulPairs = rules.filter(r => r.done).length

  // ============================================================
  // 构建 Level 1 完整日志数据包
  // ============================================================
  const logData = {
    level: 'LEVEL_1',
    studentId: props.studentId,
    timestamp: new Date().toISOString(),
    duration_seconds: duration,
    raw_metrics: {
      block_drag_count: blockDragCount.value,
      species_placement_attempts: speciesPlacementAttempts.value,
      block_gravity_fall_failures: blockGravityFallFailures.value,
      check_attempts: checkAttempts.value,
      removal_count: removalCount.value,
      total_errors: errors,
      successful_pairs: successfulPairs,
      pair_details: rules.map(r => ({
        id: r.id,
        label: r.label,
        done: r.done,
      })),
      check_history: checkHistory.value,
      // 📊 行为量化评分系统 —— 无效交互数据
      meaningless_clicks: meaninglessClicks.value,
      blank_clicks: blankClicks.value,
      random_drags: randomDrags.value,
      invalid_drops: invalidDrops.value,
      total_operations: totalOperations.value,
    },
  }

  // ============================================================
  // POST → 后端 API（Vite dev proxy 转发至 :3000）
  // ============================================================
  try {
    const res = await fetch('/api/assessment/submit-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    })
    const result = await res.json()
    if (result.success) {
      console.log('✅ 数据已成功同步至深海数据库！', result.message)
    }
  } catch (err) {
    // 后端未启动时不阻塞游戏流程
    console.warn('⚠️ 数据同步失败（后端可能未启动），本地模式继续运行', err.message)
  }

  // 通知父组件关卡完成
  emit('complete', { level: 'LEVEL_1', duration, errors, raw_metrics: logData.raw_metrics, evidence: '第一关完成：4组配对全部正确' })
}
</script>

<style scoped>
.ocean-habitat {
  background:
    radial-gradient(circle at 50% -15%, rgba(224, 252, 255, .78), transparent 38%),
    linear-gradient(180deg, #72d8ea 0%, #42b9d5 32%, #1689ad 67%, #176f8d 79%, #ddbf78 80%, #f3d797 100%);
  box-shadow:
    inset 0 14px 35px rgba(224, 252, 255, .26),
    inset 0 -16px 28px rgba(123, 82, 31, .15),
    0 12px 30px rgba(8, 91, 121, .16);
}

.ocean-habitat::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: .28;
  background-image:
    radial-gradient(circle at 12% 28%, #fff 0 1px, transparent 2px),
    radial-gradient(circle at 42% 52%, #fff 0 1px, transparent 2px),
    radial-gradient(circle at 74% 22%, #fff 0 1.2px, transparent 2.2px),
    radial-gradient(circle at 89% 58%, #fff 0 1px, transparent 2px);
  background-size: 110px 90px, 150px 130px, 170px 120px, 130px 150px;
  animation: oceanDrift 16s linear infinite;
}

.ocean-caustics {
  position: absolute;
  inset: -20% -10% 24%;
  opacity: .22;
  background:
    repeating-radial-gradient(ellipse at 50% 0%, transparent 0 22px, rgba(255,255,255,.55) 24px 27px, transparent 30px 48px);
  transform: perspective(320px) rotateX(64deg) scale(1.3);
  animation: causticMove 9s ease-in-out infinite alternate;
}

.ocean-ray {
  position: absolute;
  top: -10%;
  width: 18%;
  height: 88%;
  opacity: .22;
  filter: blur(4px);
  background: linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,255,255,0));
  transform: skewX(-15deg);
  transform-origin: top center;
}
.ocean-ray-one { left: 16%; }
.ocean-ray-two { left: 61%; width: 11%; opacity: .14; transform: skewX(13deg); }

.generated-ocean-reef {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 7%;
  width: 100%;
  height: 57%;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 8px 8px rgba(3, 50, 68, .2)) saturate(.94);
}

.reef-half-left {
  clip-path: inset(0 50% 0 0);
  transform: translateX(-14%);
  transform-origin: left bottom;
}

.reef-half-right {
  clip-path: inset(0 0 0 50%);
  transform: translateX(14%);
  transform-origin: right bottom;
}

.sand-dune {
  position: absolute;
  left: -8%;
  width: 116%;
  border-radius: 50% 50% 0 0;
}
.sand-dune-back {
  bottom: -5%;
  height: 23%;
  background: #dfbd73;
  transform: rotate(-1.5deg);
  box-shadow: inset 0 7px 13px rgba(255, 244, 190, .45);
}
.sand-dune-front {
  bottom: -13%;
  height: 27%;
  left: -2%;
  background:
    radial-gradient(circle at 25% 24%, rgba(117,78,30,.23) 0 1px, transparent 2px),
    radial-gradient(circle at 62% 16%, rgba(117,78,30,.2) 0 1px, transparent 2px),
    #f0d38f;
  background-size: 35px 25px, 48px 32px, auto;
  transform: rotate(1.8deg);
}

.ocean-bubble {
  position: absolute;
  z-index: 1;
  width: 10px;
  height: 10px;
  border: 1.5px solid rgba(236, 254, 255, .78);
  border-radius: 50%;
  box-shadow: inset 2px 2px 3px rgba(255,255,255,.38), 0 0 6px rgba(224,252,255,.25);
  animation: bubbleRise 6s ease-in infinite;
}
.bubble-one { left: 10%; bottom: 24%; animation-delay: -1s; }
.bubble-two { left: 28%; bottom: 38%; width: 6px; height: 6px; animation-delay: -4s; }
.bubble-three { right: 14%; bottom: 25%; width: 13px; height: 13px; animation-delay: -2.5s; }
.bubble-four { right: 35%; bottom: 45%; width: 7px; height: 7px; animation-delay: -5s; }

.sand-label {
  padding: .2rem .75rem;
  color: #744315;
  border: 1px solid rgba(120, 74, 19, .18);
  border-radius: 999px;
  background: rgba(255, 246, 202, .72);
  box-shadow: 0 3px 12px rgba(87, 51, 15, .12), inset 0 1px rgba(255,255,255,.7);
  backdrop-filter: blur(4px);
}

@keyframes oceanDrift {
  from { background-position: 0 0, 0 0, 0 0, 0 0; }
  to { background-position: 30px -80px, -25px -100px, 20px -90px, -30px -110px; }
}
@keyframes causticMove {
  from { transform: perspective(320px) rotateX(64deg) scale(1.3) translateX(-2%); }
  to { transform: perspective(320px) rotateX(64deg) scale(1.38) translateX(3%); }
}
@keyframes bubbleRise {
  0% { transform: translateY(22px) scale(.7); opacity: 0; }
  18% { opacity: .8; }
  78% { opacity: .55; }
  100% { transform: translate(10px, -150px) scale(1.12); opacity: 0; }
}

@keyframes popIn {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
.animate-pop-in {
  animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
