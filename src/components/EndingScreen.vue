<template>
  <div class="ceremony-screen flex flex-col items-center justify-center h-full px-3 py-3 relative overflow-hidden">

    <!-- 深海渐变背景 -->
    <div class="absolute inset-0 bg-gradient-to-b from-[#082f49]/70 via-[#155e75]/55 to-[#312e81]/65 pointer-events-none"></div>
    <div class="absolute inset-0 opacity-30 pointer-events-none"
         style="background: radial-gradient(circle at 50% 20%, #fde047 0%, transparent 45%), radial-gradient(circle at 20% 80%, #22d3ee 0%, transparent 40%), radial-gradient(circle at 80% 70%, #a78bfa 0%, transparent 35%);">
    </div>
    <div class="ceremony-caustics absolute inset-0 pointer-events-none"></div>
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <span v-for="i in 18" :key="'bubble-' + i" class="ceremony-bubble"
            :style="{ left: ((i * 37) % 96) + '%', animationDelay: (-i * .43) + 's', animationDuration: (5 + i % 5) + 's' }"></span>
    </div>

    <!-- 全屏礼花 Canvas -->
    <canvas ref="fireworksCanvas" class="absolute inset-0 pointer-events-none z-20"></canvas>

    <!-- 星光粒子 -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div v-for="i in 24" :key="'star-' + i"
           class="star-dot absolute rounded-full bg-white"
           :style="starStyle(i)"></div>
    </div>

    <!-- 主内容 -->
    <div class="relative z-10 w-full max-w-2xl flex flex-col items-center ceremony-enter">

      <!-- 顶部大标题 -->
      <div class="text-center mb-3">
        <div class="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-100 text-xs md:text-sm font-bold mb-1.5 sparkle-badge">
          <img :src="medalSrc" alt="" class="ceremony-inline-icon" />
          <span v-html="p('任务全部完成')"></span>
          <img :src="medalSrc" alt="" class="ceremony-inline-icon" />
        </div>
        <h1 class="title-glow text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 leading-tight">
          <span v-html="p('恭喜小队长！')"></span>
        </h1>
        <p class="text-cyan-100/90 text-sm md:text-base mt-0.5 font-bold tracking-wide">
          <span v-html="p('蔚蓝深海基地 · 完全复苏')"></span>
        </p>
      </div>

      <!-- 沫沫授勋 -->
      <div class="momo-panel flex items-start gap-2.5 w-full mb-3 bg-white/15 backdrop-blur-md rounded-2xl px-4 py-3 md:px-5 md:py-3.5 border-2 border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <MomoDolphin size="lg" class="shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="text-base md:text-lg font-bold text-cyan-50 mb-0.5" v-html="p('沫沫队长说：')"></div>
          <p class="text-xs md:text-sm text-cyan-100/95 leading-relaxed">
            你太厉害啦！现在正式授予你
            <span class="text-amber-300 font-bold" v-html="p('『深海守护者勋章』')"></span><span v-html="p('，快点击勋章看看你的专属称号吧！')"></span>
            <img :src="medalSrc" alt="守护者勋章" class="dialogue-medal-icon" />
          </p>
        </div>
      </div>

      <!-- 勋章卡片（点击翻转） -->
      <div class="mb-3 flex flex-col items-center">
        <div @click="flipBadge"
             class="badge-wrap relative w-32 h-32 md:w-40 md:h-40 cursor-pointer perspective-1000 badge-bounce">
          <div class="absolute -inset-3 rounded-full bg-amber-400/30 blur-xl animate-pulse pointer-events-none"></div>
          <div class="relative w-full h-full transition-transform duration-700 preserve-3d"
               :class="{ 'rotate-y-180': isFlipped }">
            <!-- 正面 -->
            <div class="badge-face absolute inset-0 flex flex-col items-center justify-center backface-hidden">
              <img :src="medalSrc" alt="深海守护者勋章" class="w-[145%] h-[145%] object-contain medal-image" />
            </div>
            <!-- 背面（称号） -->
            <div class="badge-face medal-back absolute inset-0 flex flex-col items-center justify-center rounded-full backface-hidden rotate-y-180 px-3">
              <span v-for="i in 8" :key="'pearl-' + i" class="medal-pearl"
                    :style="{ transform: `rotate(${i * 45}deg) translateY(-62px)` }"></span>
              <div class="medal-back-crest">
                <MomoDolphin size="md" :animate="false" />
              </div>
              <div class="medal-back-label">
                <span class="text-[9px] md:text-[10px] tracking-[.18em] text-cyan-100/70">DEEP SEA GUARDIAN</span>
                <span class="text-xs md:text-sm font-bold text-white text-center leading-snug">{{ title }}</span>
              </div>
              <div class="medal-waves"><i></i><i></i><i></i></div>
            </div>
          </div>
        </div>
        <div class="text-[10px] md:text-xs text-cyan-100/70 mt-1.5 font-bold animate-pulse">
          <span class="inline-flex items-center gap-1.5">
            <img :src="medalSrc" alt="" class="ceremony-inline-icon" />
            <span v-html="p('点击勋章翻转，查看称号')"></span>
          </span>
        </div>
      </div>

      <!-- 三关战绩 -->
      <div class="w-full mb-3">
        <h3 class="text-center text-sm md:text-base font-bold text-cyan-50 mb-1.5 inline-flex items-center justify-center gap-2 w-full">
          <img :src="homeBaseIcon" alt="" class="ceremony-section-icon" />
          <span v-html="p('冒险战绩')"></span>
        </h3>
        <div class="grid grid-cols-3 gap-2 md:gap-3">
          <div v-for="(lv, i) in levelSummary" :key="i"
               class="level-card relative overflow-hidden rounded-2xl px-2.5 py-2 md:px-4 md:py-3 text-center border"
               :class="lv.cardClass"
               :style="{ animationDelay: `${i * 0.15}s` }">
            <span class="level-card-number">0{{ i + 1 }}</span>
            <div class="level-card-icon">
              <img :src="lv.iconSrc" :alt="lv.label" />
            </div>
            <div class="text-xs md:text-sm font-black tracking-wide" :class="lv.textColor" v-html="p(lv.label)"></div>
            <div class="level-card-time" :class="lv.textColor">
              <span v-html="p('用时')"></span><span>{{ lv.time }}</span>
            </div>
            <div class="level-card-badge mt-1.5 text-[10px] md:text-xs font-black px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                 :class="lv.badgeClass" v-html="p(lv.badge)"></div>
          </div>
        </div>
      </div>

      <!-- 查看报告按钮 -->
      <button @click="handleGoReport"
              @mouseenter="playButtonHover"
              class="report-btn group px-6 py-2.5 md:px-8 md:py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 text-white text-sm md:text-base rounded-full shadow-[0_6px_20px_rgba(251,191,36,0.5)] hover:scale-105 active:scale-95 transition-all font-bold border-2 border-amber-200/50">
        <span class="inline-flex items-center gap-1.5">
          <img :src="reportIcon" alt="" class="report-button-icon" />
          <span v-html="p('查看多维天赋报告')"></span>
          <span class="group-hover:translate-x-1 transition-transform">→</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePinyinText } from '../utils/pinyin.js'
import MomoDolphin from './characters/MomoDolphin.vue'
import medalSrc from '../assets/generated/guardian-medal.png'
import homeBaseIcon from '../assets/generated/nav/nav-home-base.png'
import coralApartmentIcon from '../assets/generated/nav/nav-coral-apartment.png'
import currentGridIcon from '../assets/generated/nav/nav-current-grid.png'
import mediationIcon from '../assets/generated/nav/nav-mediation.png'
import reportIcon from '../assets/generated/nav/nav-talent-report.png'

const { p } = usePinyinText()

const props = defineProps({
  gameState: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['go-report'])

// ── 音效系统（Web Audio API 合成，无需外部文件） ──
let audioCtx = null
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

/** 庆祝号角：C5 → E5 → G5 → C6 依次奏响 */
function playFanfare() {
  try {
    const ctx = getCtx()
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.6)
    })
  } catch (e) { /* 自动降级 */ }
}

/** 勋章翻转音效：三连上升叮咚声 */
function playSparkle() {
  try {
    const ctx = getCtx()
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 1200 + i * 500
      const t = ctx.currentTime + i * 0.08
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.08, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.25)
    }
  } catch (e) { /* 自动降级 */ }
}

/** 按钮悬停音效：轻柔叮声 */
function playButtonHover() {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch (e) { /* 自动降级 */ }
}

// ── 全屏礼花系统（Canvas） ──
const fireworksCanvas = ref(null)
let animFrameId = null
let rockets = []
let particles = []

const FIREWORK_COLORS = [
  '#fde047', '#fbbf24', '#f59e0b', // 金色系
  '#22d3ee', '#06b6d4', '#0891b2', // 青色系
  '#f472b6', '#ec4899', '#db2777', // 粉色系
  '#4ade80', '#22c55e', '#16a34a', // 绿色系
  '#a78bfa', '#8b5cf6', '#7c3aed', // 紫色系
  '#fb923c', '#f97316', '#ea580c', // 橙色系
  '#ffffff', '#f8fafc',             // 白色
]

function createRocket(cw, ch) {
  const targetY = 60 + Math.random() * (ch * 0.45)
  const speed = 3.5 + Math.random() * 3
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.35
  return {
    x: Math.random() * cw,
    y: ch,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    targetY,
    trail: [],
    alive: true,
    color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
  }
}

function explodeRocket(r) {
  const count = 50 + Math.floor(Math.random() * 40)
  const color2 = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25
    const spd = 1.5 + Math.random() * 4
    particles.push({
      x: r.x, y: r.y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      size: 1.5 + Math.random() * 2.5,
      life: 55 + Math.floor(Math.random() * 35),
      maxLife: 90,
      color: i % 3 === 0 ? r.color : color2,
      alpha: 1,
      gravity: 0.04 + Math.random() * 0.03,
      friction: 0.97 + Math.random() * 0.015,
    })
  }
}

function startFireworks() {
  const canvas = fireworksCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let cw, ch

  function resize() {
    cw = canvas.width = canvas.parentElement.clientWidth
    ch = canvas.height = canvas.parentElement.clientHeight
  }
  resize()
  window.addEventListener('resize', resize)

  let nextLaunch = 0
  let launchCount = 0
  const MAX_LAUNCHES = 40 // 最多发射40枚火箭后逐渐停止

  function tick(time) {
    // 发射新火箭
    if (launchCount < MAX_LAUNCHES && time > nextLaunch) {
      if (Math.random() < 0.6) {
        rockets.push(createRocket(cw, ch))
        launchCount++
      }
      nextLaunch = time + 120 + Math.random() * 350
    }

    // 更新火箭
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]
      r.trail.push({ x: r.x, y: r.y })
      if (r.trail.length > 10) r.trail.shift()
      r.x += r.vx
      r.y += r.vy
      if (r.y <= r.targetY || r.y < 20) {
        explodeRocket(r)
        rockets.splice(i, 1)
      }
    }

    // 更新粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.vx *= p.friction
      p.vy *= p.friction
      p.vy += p.gravity
      p.x += p.vx
      p.y += p.vy
      p.life--
      p.alpha = Math.max(0, p.life / p.maxLife)
      if (p.life <= 0 || p.y > ch + 10) {
        particles.splice(i, 1)
      }
    }

    // 绘制
    ctx.clearRect(0, 0, cw, ch)

    // 火箭轨迹
    for (const r of rockets) {
      for (let i = 0; i < r.trail.length; i++) {
        const a = i / r.trail.length
        ctx.globalAlpha = a * 0.5
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(r.trail[i].x, r.trail[i].y, 1.5 * a, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // 火箭头
    for (const r of rockets) {
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffffff'
      ctx.shadowBlur = 8
      ctx.shadowColor = r.color
      ctx.beginPath()
      ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // 粒子
    ctx.globalAlpha = 1
    for (const p of particles) {
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.shadowBlur = 6
      ctx.shadowColor = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1

    // 20秒后逐渐淡出，40秒后完全停止绘制
    const elapsed = performance.now() - startTime
    if (elapsed > 45000 && particles.length === 0 && rockets.length === 0) return

    animFrameId = requestAnimationFrame(tick)
  }

  const startTime = performance.now()
  animFrameId = requestAnimationFrame(tick)
}

function stopFireworks() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  rockets = []
  particles = []
}

// ── 勋章翻转 ──
const isFlipped = ref(false)
function flipBadge() {
  isFlipped.value = !isFlipped.value
  playSparkle()
}

const title = computed(() => {
  const gs = props.gameState || {}
  const l1e = gs.level1_errors || 0
  const l2p = gs.level2_pipes_used || 0
  const l3h = gs.level3_harmony_score || 0

  if (l3h >= 80) return '和平外交官'
  if (l1e === 0 && l2p <= 10) return '空间架构大师'
  if (l2p <= 8) return '效率规划师'
  if (l1e <= 2) return '自然观察家'
  return '全能小队长'
})

const levelSummary = computed(() => {
  const gs = props.gameState || {}
  const fmt = (s) => {
    const m = Math.floor((s || 0) / 60)
    const sec = (s || 0) % 60
    return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
  }
  return [
    {
      iconSrc: coralApartmentIcon, label: '珊瑚公寓', time: fmt(gs.level1_duration),
      cardClass: 'achievement-emerald',
      textColor: 'text-emerald-50', badge: '✦ 建造达人', badgeClass: 'bg-emerald-300/20 text-emerald-50 border border-emerald-200/25',
    },
    {
      iconSrc: currentGridIcon, label: '洋流电网', time: fmt(gs.level2_duration),
      cardClass: 'achievement-amber',
      textColor: 'text-amber-50', badge: '✦ 电路高手', badgeClass: 'bg-amber-300/20 text-amber-50 border border-amber-200/25',
    },
    {
      iconSrc: mediationIcon, label: '议事厅', time: fmt(gs.level3_duration),
      cardClass: 'achievement-violet',
      textColor: 'text-violet-50', badge: '✦ 沟通之星', badgeClass: 'bg-violet-300/20 text-violet-50 border border-violet-200/25',
    },
  ]
})

function starStyle(i) {
  const size = 2 + (i % 4)
  return {
    width: size + 'px',
    height: size + 'px',
    left: ((i * 17 + 7) % 100) + '%',
    top: ((i * 23 + 11) % 100) + '%',
    animation: `twinkle ${1.5 + (i % 3)}s ease-in-out ${(i % 5) * 0.3}s infinite`,
    opacity: 0.4 + (i % 3) * 0.2,
  }
}

function handleGoReport() {
  playButtonHover()
  emit('go-report')
}

onMounted(() => {
  // 页面载入后播放号角 + 启动礼花
  setTimeout(() => playFanfare(), 300)
  startFireworks()
})

onUnmounted(() => {
  stopFireworks()
})
</script>

<style scoped>
.ceremony-screen {
  background: radial-gradient(circle at 50% 18%, rgba(250,204,21,.1), transparent 30%);
}
.ceremony-caustics {
  opacity: .28;
  background-image:
    repeating-radial-gradient(ellipse at 20% 20%, transparent 0 24px, rgba(165,243,252,.18) 26px 28px, transparent 31px 58px);
  background-size: 210px 145px;
  filter: blur(1px);
  animation: causticsDrift 12s linear infinite;
  mix-blend-mode: screen;
}
.ceremony-bubble {
  position: absolute;
  bottom: -30px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(207,250,254,.65);
  background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.65), rgba(103,232,249,.08) 45%, transparent 70%);
  box-shadow: 0 0 8px rgba(34,211,238,.2);
  animation: ceremonyBubbleRise linear infinite;
}
.medal-image {
  filter: drop-shadow(0 10px 16px rgba(2,6,23,.4)) drop-shadow(0 0 18px rgba(251,191,36,.42));
  animation: medalShimmer 2.8s ease-in-out infinite;
}
.medal-back {
  overflow: hidden;
  border: 6px solid #fbbf24;
  background:
    radial-gradient(circle at 35% 24%, rgba(255,255,255,.2), transparent 20%),
    radial-gradient(circle, #0e7490 0 48%, #082f49 49% 62%, #d97706 63% 69%, #fde68a 70% 74%, #92400e 75%);
  box-shadow: 0 0 38px rgba(34,211,238,.42), inset 0 0 18px rgba(2,6,23,.65);
}
.medal-back::before {
  content: '';
  position: absolute;
  inset: 12px;
  border-radius: 50%;
  border: 2px dashed rgba(253,230,138,.62);
  box-shadow: inset 0 0 18px rgba(255,255,255,.08);
}
.medal-pearl {
  position: absolute;
  left: calc(50% - 3px);
  top: calc(50% - 3px);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  transform-origin: 3px 3px;
  background: radial-gradient(circle at 30% 25%, white, #bae6fd 42%, #0369a1 74%);
  box-shadow: 0 0 5px rgba(255,255,255,.7);
}
.medal-back-crest {
  position: relative;
  z-index: 2;
  width: 58px;
  height: 48px;
  display: grid;
  place-items: center;
  overflow: hidden;
  margin-top: -10px;
  filter: drop-shadow(0 4px 6px rgba(2,6,23,.4));
}
.medal-back-label {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 3px 9px;
  border-radius: 8px;
  background: rgba(2,6,23,.36);
  border: 1px solid rgba(253,230,138,.28);
  text-shadow: 0 2px 4px rgba(2,6,23,.6);
}
.medal-waves {
  position: absolute;
  bottom: 18px;
  display: flex;
  gap: 3px;
  opacity: .72;
}
.medal-waves i {
  width: 22px;
  height: 8px;
  border-top: 2px solid #67e8f9;
  border-radius: 50%;
  transform: rotate(-8deg);
}
.perspective-1000 { perspective: 1000px; }
.preserve-3d { transform-style: preserve-3d; }
.backface-hidden { backface-visibility: hidden; }
.rotate-y-180 { transform: rotateY(180deg); }

.ceremony-enter {
  animation: ceremonyIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.title-glow {
  filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.5));
}

.ceremony-inline-icon {
  width: 22px;
  height: 22px;
  display: inline-block;
  flex: none;
  object-fit: contain;
  border-radius: 7px;
  background: rgba(255,255,255,.88);
  box-shadow: 0 2px 8px rgba(2,6,23,.18);
}

.dialogue-medal-icon {
  width: 26px;
  height: 26px;
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  margin-left: 5px;
  border-radius: 8px;
  background: rgba(255,255,255,.86);
}

.ceremony-section-icon {
  width: 30px;
  height: 30px;
  flex: none;
  object-fit: cover;
  border: 1px solid rgba(165,243,252,.45);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(2,6,23,.2);
}

.report-button-icon {
  width: 29px;
  height: 29px;
  flex: none;
  object-fit: cover;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,.6);
  box-shadow: 0 3px 10px rgba(120,53,15,.2);
}

.badge-bounce {
  animation: badgePop 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
}

.level-card {
  animation: cardSlideUp 0.6s ease-out both;
  min-height: 118px;
  box-shadow: 0 10px 28px rgba(2, 6, 23, .2), inset 0 1px rgba(255,255,255,.14);
  backdrop-filter: blur(12px);
  transition: transform .25s ease, box-shadow .25s ease;
}

.level-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 34px rgba(2, 6, 23, .27), inset 0 1px rgba(255,255,255,.2);
}

.achievement-emerald {
  border-color: rgba(110,231,183,.45);
  background: radial-gradient(circle at 50% 0, rgba(52,211,153,.28), transparent 48%), linear-gradient(145deg, rgba(6,78,59,.78), rgba(6,95,70,.48));
}
.achievement-amber {
  border-color: rgba(253,230,138,.48);
  background: radial-gradient(circle at 50% 0, rgba(251,191,36,.3), transparent 48%), linear-gradient(145deg, rgba(120,53,15,.76), rgba(146,64,14,.46));
}
.achievement-violet {
  border-color: rgba(196,181,253,.46);
  background: radial-gradient(circle at 50% 0, rgba(167,139,250,.3), transparent 48%), linear-gradient(145deg, rgba(76,29,149,.76), rgba(91,33,182,.46));
}

.level-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(115deg, rgba(255,255,255,.12), transparent 32%, transparent 72%, rgba(255,255,255,.05));
}

.level-card-number {
  position: absolute;
  top: 7px;
  right: 9px;
  color: rgba(255,255,255,.42);
  font-size: .62rem;
  font-weight: 900;
  letter-spacing: .1em;
}

.level-card-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  margin: 0 auto .2rem;
  padding: 2px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.22);
  border-radius: 13px;
  background: rgba(255,255,255,.86);
  box-shadow: 0 5px 15px rgba(2,6,23,.16), inset 0 1px rgba(255,255,255,.2);
}

.level-card-icon img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border-radius: 10px;
}

.level-card-time {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .25rem;
  margin-top: .18rem;
  font-size: .7rem;
  font-weight: 700;
  opacity: .88;
}

.level-card-badge {
  box-shadow: inset 0 1px rgba(255,255,255,.12);
}

.sparkle-badge {
  animation: sparkle 2s ease-in-out infinite;
}

.report-btn {
  animation: btnGlow 2s ease-in-out infinite;
}

@keyframes ceremonyIn {
  from { opacity: 0; transform: translateY(40px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes badgePop {
  from { opacity: 0; transform: scale(0.3) rotate(-20deg); }
  to { opacity: 1; transform: scale(1) rotate(0deg); }
}

@keyframes cardSlideUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sparkle {
  0%, 100% { box-shadow: 0 0 12px rgba(251, 191, 36, 0.3); }
  50% { box-shadow: 0 0 24px rgba(251, 191, 36, 0.6); }
}

@keyframes btnGlow {
  0%, 100% { box-shadow: 0 6px 20px rgba(251, 191, 36, 0.5); }
  50% { box-shadow: 0 6px 32px rgba(251, 191, 36, 0.75); }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.5); }
}
@keyframes causticsDrift {
  from { background-position: 0 0; transform: scale(1.05) rotate(0deg); }
  to { background-position: 210px 145px; transform: scale(1.1) rotate(2deg); }
}
@keyframes ceremonyBubbleRise {
  0% { transform: translateY(0) scale(.45); opacity: 0; }
  14% { opacity: .75; }
  85% { opacity: .4; }
  100% { transform: translateY(-110vh) translateX(22px) scale(1.2); opacity: 0; }
}
@keyframes medalShimmer {
  0%, 100% { filter: drop-shadow(0 10px 16px rgba(2,6,23,.4)) drop-shadow(0 0 15px rgba(251,191,36,.35)); }
  50% { filter: drop-shadow(0 12px 18px rgba(2,6,23,.36)) drop-shadow(0 0 30px rgba(253,224,71,.72)); }
}
</style>
