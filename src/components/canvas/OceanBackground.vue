<template>
  <canvas
    ref="canvasRef"
    class="ocean-canvas fixed inset-0 w-full h-full pointer-events-none z-0"
    :style="{ opacity: bgOpacity }"
    aria-hidden="true"
  ></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ParticleSystem } from './ParticleSystem.js'
import { Fish, Jellyfish, Turtle } from './OceanCreature.js'
import { LightRays } from './LightRays.js'
import { Seaweed } from './Seaweed.js'

const props = defineProps({
  currentLevel: { type: String, default: 'START' },
  bgOpacity: { type: Number, default: 1 },
})

const LEVEL_THEME = {
  START: {
    top: '#0b88b6', mid: '#087c94', bot: '#0d746f', bottom: '#124e63',
    accent: '#8be9f6', warm: '#f0b86a', motion: 0.78,
  },
  LEVEL_1: {
    top: '#138cad', mid: '#137e8b', bot: '#9a6470', bottom: '#174f63',
    accent: '#f5a8a8', warm: '#ffbd78', motion: 0.82,
  },
  LEVEL_2: {
    top: '#087cac', mid: '#086f83', bot: '#106d68', bottom: '#123f53',
    accent: '#70f0e2', warm: '#a5f3fc', motion: 0.9,
  },
  LEVEL_3: {
    top: '#3976c4', mid: '#5256b4', bot: '#71368c', bottom: '#173e5b',
    accent: '#c4b5fd', warm: '#f0abfc', motion: 0.62,
  },
  END_CEREMONY: {
    top: '#159bb4', mid: '#13847d', bot: '#a56a25', bottom: '#145267',
    accent: '#fde68a', warm: '#fbbf24', motion: 0.86,
  },
  REPORT: {
    top: '#2298bd', mid: '#0b7c91', bot: '#2b8972', bottom: '#155367',
    accent: '#a7f3d0', warm: '#bae6fd', motion: 0.42,
  },
}

const canvasRef = ref(null)
let ctx = null
let w = 0
let h = 0
let dpr = 1
let creatures = []
let bubbles = null
let lightRays = null
let seaweeds = []
let animFrameId = null
let resizeTimer = null
let lastFrame = 0
let startTime = performance.now()
let reducedMotion = false
let motionQuery = null
let currentTheme = { ...LEVEL_THEME.START }
let transitionFrom = { ...LEVEL_THEME.START }
let transitionTo = { ...LEVEL_THEME.START }
let transitionStartedAt = 0
const TRANSITION_MS = 1100

function colorToRgb(color) {
  if (color.startsWith('rgb')) {
    const [r, g, b] = color.match(/\d+/g).map(Number)
    return { r, g, b }
  }
  const value = color.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

function mixColor(a, b, amount) {
  const from = colorToRgb(a)
  const to = colorToRgb(b)
  const channel = (key) => Math.round(from[key] + (to[key] - from[key]) * amount)
  return `rgb(${channel('r')}, ${channel('g')}, ${channel('b')})`
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function themeAt(time) {
  if (!transitionStartedAt) return transitionTo
  const progress = Math.min(1, (time - transitionStartedAt) / TRANSITION_MS)
  const eased = easeInOut(progress)
  currentTheme = {
    top: mixColor(transitionFrom.top, transitionTo.top, eased),
    mid: mixColor(transitionFrom.mid, transitionTo.mid, eased),
    bot: mixColor(transitionFrom.bot, transitionTo.bot, eased),
    bottom: mixColor(transitionFrom.bottom, transitionTo.bottom, eased),
    accent: transitionTo.accent,
    warm: transitionTo.warm,
    motion: transitionFrom.motion + (transitionTo.motion - transitionFrom.motion) * eased,
  }
  if (progress === 1) transitionStartedAt = 0
  return currentTheme
}

function setCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas) return
  w = window.innerWidth
  h = window.innerHeight
  dpr = Math.min(window.devicePixelRatio || 1, reducedMotion ? 1.25 : 1.75)
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function createScene() {
  bubbles?.destroy()
  const density = reducedMotion ? 0.55 : 1
  const fishCount = Math.min(11, Math.max(5, Math.floor(w / 150))) * density
  creatures = Array.from({ length: Math.round(fishCount) }, () => new Fish(w, h))

  const jellyCount = reducedMotion ? 1 : 2
  for (let i = 0; i < jellyCount; i++) creatures.push(new Jellyfish(w, h))
  if (!reducedMotion && w > 780) creatures.push(new Turtle(w, h))

  bubbles = new ParticleSystem(reducedMotion ? 16 : 30)
  bubbles.startAutoEmit(() => {
    if (document.hidden || bubbles.count >= (reducedMotion ? 12 : 24)) return
    const useLeftEdge = Math.random() > 0.5
    const edgeWidth = Math.max(70, w * 0.13)
    const x = useLeftEdge
      ? Math.random() * edgeWidth
      : w - Math.random() * edgeWidth
    bubbles.emit(x, h + 8, {
      speed: 0.35 + Math.random() * 0.75,
      size: 1.5 + Math.random() * 3.2,
      color: 'rgba(225,250,255,0.38)',
      life: 220 + Math.random() * 150,
      gravity: -0.1,
      fadeOut: true,
    })
  }, reducedMotion ? 850 : 470)

  lightRays = new LightRays(w, h)
  seaweeds = []
  const weedCount = Math.min(10, 5 + Math.floor(w / 260))
  for (let i = 0; i < weedCount; i++) {
    const side = i % 2 === 0 ? 0 : 1
    const sideWidth = Math.min(w * 0.18, 240)
    const x = side === 0 ? Math.random() * sideWidth : w - Math.random() * sideWidth
    seaweeds.push(new Seaweed(x, h + 5, 62 + Math.random() * 62, i))
  }
}

function drawBackground(time) {
  const theme = themeAt(time)
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, theme.top)
  gradient.addColorStop(0.3, theme.mid)
  gradient.addColorStop(0.67, theme.bot)
  gradient.addColorStop(1, theme.bottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  const surfaceGlow = ctx.createRadialGradient(w * 0.5, -h * 0.06, 0, w * 0.5, 0, w * 0.68)
  surfaceGlow.addColorStop(0, 'rgba(238,253,255,0.16)')
  surfaceGlow.addColorStop(0.48, 'rgba(186,242,250,0.055)')
  surfaceGlow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = surfaceGlow
  ctx.fillRect(0, 0, w, h * 0.28)
}

function drawSurfaceCaustics(time) {
  const speed = reducedMotion ? 0.00006 : 0.00014
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.lineWidth = 1.2
  for (let row = 0; row < 4; row++) {
    ctx.beginPath()
    const y = 18 + row * 21
    for (let x = -30; x <= w + 30; x += 18) {
      const wave = Math.sin(x * 0.022 + time * speed + row * 1.7) * (6 + row * 1.4)
      if (x === -30) ctx.moveTo(x, y + wave)
      else ctx.lineTo(x, y + wave)
    }
    ctx.strokeStyle = `rgba(225,252,255,${0.07 - row * 0.011})`
    ctx.stroke()
  }
  ctx.restore()
}

function drawFarReef(time) {
  ctx.save()
  const drift = Math.sin(time * 0.00016) * 5
  const farGradient = ctx.createLinearGradient(0, h * 0.7, 0, h)
  farGradient.addColorStop(0, 'rgba(8,47,73,0)')
  farGradient.addColorStop(1, 'rgba(4,32,48,0.42)')
  ctx.fillStyle = farGradient
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(0, h * 0.84)
  ctx.quadraticCurveTo(w * 0.08, h * 0.73 + drift, w * 0.17, h * 0.87)
  ctx.lineTo(w * 0.29, h)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(w, h)
  ctx.lineTo(w, h * 0.79)
  ctx.quadraticCurveTo(w * 0.91, h * 0.7 - drift, w * 0.82, h * 0.86)
  ctx.lineTo(w * 0.7, h)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawLargeSilhouettes(time) {
  if (reducedMotion) return
  const cycle = (time * 0.018) % (w + 520)
  const x = cycle - 260
  const y = h * 0.19 + Math.sin(time * 0.00042) * 18
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = 0.055
  ctx.filter = 'blur(4px)'
  ctx.fillStyle = '#062f43'
  ctx.beginPath()
  ctx.ellipse(0, 0, 82, 25, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-68, 0)
  ctx.lineTo(-118, -34)
  ctx.lineTo(-108, 32)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawLevelAtmosphere(time) {
  const level = props.currentLevel
  const theme = currentTheme
  ctx.save()

  if (level === 'LEVEL_2') {
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = 'rgba(112,240,226,0.11)'
    ctx.lineWidth = 1.2
    for (let i = 0; i < 5; i++) {
      const y = h * (0.18 + i * 0.14)
      const offset = (time * 0.025 * theme.motion + i * 110) % (w + 180)
      ctx.beginPath()
      ctx.moveTo(offset - 180, y)
      ctx.bezierCurveTo(offset - 120, y - 18, offset - 55, y + 18, offset, y)
      ctx.stroke()
    }
  }

  if (level === 'LEVEL_1' || level === 'END_CEREMONY') {
    const count = reducedMotion ? 8 : 16
    for (let i = 0; i < count; i++) {
      const x = ((i * 97 + time * 0.006 * theme.motion) % (w + 80)) - 40
      const y = h * (0.18 + ((i * 43) % 62) / 100)
      const pulse = 0.45 + Math.sin(time * 0.0012 + i) * 0.2
      ctx.globalAlpha = level === 'END_CEREMONY' ? pulse * 0.32 : pulse * 0.15
      ctx.fillStyle = theme.warm
      ctx.beginPath()
      ctx.arc(x, y, level === 'END_CEREMONY' ? 2.1 : 1.45, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (level === 'LEVEL_3') {
    const glow = ctx.createRadialGradient(w * 0.82, h * 0.24, 0, w * 0.82, h * 0.24, w * 0.28)
    glow.addColorStop(0, 'rgba(216,180,254,0.11)')
    glow.addColorStop(1, 'rgba(216,180,254,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
  }

  ctx.restore()
}

function safeZoneAlpha(x, y) {
  const dx = (x - w * 0.5) / (w * 0.36)
  const dy = (y - h * 0.5) / (h * 0.4)
  const distance = Math.sqrt(dx * dx + dy * dy)
  if (distance <= 0.82) return 0.2
  if (distance >= 1.25) return 0.62
  return 0.2 + ((distance - 0.82) / 0.43) * 0.42
}

function drawForegroundGlass() {
  ctx.save()
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.18, w * 0.5, h * 0.5, Math.max(w, h) * 0.68)
  vignette.addColorStop(0, 'rgba(3,34,51,0)')
  vignette.addColorStop(0.72, 'rgba(3,34,51,0.025)')
  vignette.addColorStop(1, 'rgba(2,25,39,0.18)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)

  const safeGlow = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, Math.min(w * 0.44, h * 0.72))
  safeGlow.addColorStop(0, 'rgba(226,250,252,0.035)')
  safeGlow.addColorStop(1, 'rgba(226,250,252,0)')
  ctx.fillStyle = safeGlow
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

function drawFrame(now) {
  const time = now - startTime
  drawBackground(now)
  drawFarReef(time)
  drawLargeSilhouettes(time)
  lightRays?.draw(ctx, time, props.currentLevel === 'REPORT' ? 0.42 : 0.72)
  drawSurfaceCaustics(time)
  drawLevelAtmosphere(time)

  bubbles?.update()
  bubbles?.draw(ctx, props.currentLevel === 'REPORT' ? 0.12 : 0.22)

  for (const creature of creatures) {
    creature.update(w, h, time)
    const levelMotion = LEVEL_THEME[props.currentLevel]?.motion ?? 0.75
    creature.draw(ctx, safeZoneAlpha(creature.x, creature.y) * levelMotion)
  }

  for (const seaweed of seaweeds) {
    seaweed.update(time)
    seaweed.draw(ctx, props.currentLevel === 'REPORT' ? 0.28 : 0.46)
  }
  drawForegroundGlass()
}

function animate(now) {
  animFrameId = requestAnimationFrame(animate)
  if (document.hidden) return
  const targetFps = reducedMotion ? 20 : 45
  const interval = 1000 / targetFps
  if (now - lastFrame < interval) return
  lastFrame = now - ((now - lastFrame) % interval)
  drawFrame(now)
}

function onResize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    setCanvasSize()
    lightRays?.resize(w, h)
  }, 140)
}

function onMotionChange(event) {
  reducedMotion = event.matches
  setCanvasSize()
  createScene()
}

watch(() => props.currentLevel, (level) => {
  transitionFrom = { ...currentTheme }
  transitionTo = { ...(LEVEL_THEME[level] || LEVEL_THEME.START) }
  transitionStartedAt = performance.now()
})

onMounted(() => {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d', { alpha: true, desynchronized: true })
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion = motionQuery.matches
  setCanvasSize()
  currentTheme = { ...(LEVEL_THEME[props.currentLevel] || LEVEL_THEME.START) }
  transitionFrom = { ...currentTheme }
  transitionTo = { ...currentTheme }
  createScene()
  animFrameId = requestAnimationFrame(animate)
  window.addEventListener('resize', onResize, { passive: true })
  motionQuery.addEventListener?.('change', onMotionChange)
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  clearTimeout(resizeTimer)
  window.removeEventListener('resize', onResize)
  motionQuery?.removeEventListener?.('change', onMotionChange)
  bubbles?.destroy()
})
</script>

<style scoped>
.ocean-canvas {
  background: #0b6177;
  transform: translateZ(0);
  will-change: opacity;
}
</style>
