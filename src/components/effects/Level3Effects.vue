<template>
  <canvas ref="canvasRef" class="absolute inset-0 w-full h-full pointer-events-none z-10"></canvas>
</template>

<script setup>
/**
 * 🤝 第三关·和解特效
 * - 和解度上升时暖色粒子从两侧汇聚
 * - 情绪识别正确时角色光环
 * - 和解度 100% 时金色粒子雨
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ParticleSystem } from '../canvas/ParticleSystem.js'

const canvasRef = ref(null)
let ctx = null
let ps = null
let animFrameId = null

const props = defineProps({
  harmony: { type: Number, default: 0 },
  // 触发庆祝（和解100%时）
  triggerCelebration: { type: Boolean, default: false },
})

function init() {
  const canvas = canvasRef.value
  ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  ps = new ParticleSystem(120)
}

function drawHarmonyGlow(ctx, time) {
  const h = props.harmony
  if (h <= 0) return

  const intensity = h / 100
  const w = ctx.canvas.width
  const centerX = w / 2
  const centerY = ctx.canvas.height / 2

  // 从两侧向中心汇聚的暖色粒子
  if (Math.random() < intensity * 0.3) {
    const side = Math.random() > 0.5 ? 0 : w
    const y = centerY + (Math.random() - 0.5) * ctx.canvas.height * 0.5

    ps.emit(side, y, {
      count: 2 + Math.floor(intensity * 3),
      speed: 0.5 + intensity * 1.5,
      size: 2 + intensity * 3,
      spread: 0.3,
      color: () => {
        const colors = ['#ffd93d', '#ff9f43', '#feca57', '#ff6b6b', '#ff85a2']
        return colors[Math.floor(Math.random() * colors.length)]
      },
      life: 60 + Math.floor(intensity * 40),
      fadeOut: true,
      glow: true,
    })
  }

  // 和解光环（半透明光晕）
  if (h > 30) {
    ctx.save()
    const radius = 100 + h * 2
    const pulse = 0.3 + 0.15 * Math.sin(time * 0.003)

    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    grad.addColorStop(0, `rgba(255, 217, 61, ${intensity * 0.05})`)
    grad.addColorStop(0.5, `rgba(255, 159, 67, ${intensity * pulse * 0.03})`)
    grad.addColorStop(1, 'rgba(255, 107, 107, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawCelebration(ctx, time) {
  // 金色粒子雨
  if (Math.random() > 0.4) {
    ps.emit(
      Math.random() * ctx.canvas.width,
      -10,
      {
        count: 1,
        speed: 1 + Math.random() * 2,
        size: 2 + Math.random() * 4,
        color: () => {
          const colors = ['#ffd700', '#ffec8b', '#ffa500', '#ffd93d']
          return colors[Math.floor(Math.random() * colors.length)]
        },
        life: 80 + Math.random() * 60,
        fadeOut: true,
        glow: true,
      }
    )
  }
}

function animate() {
  const time = Date.now()
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  ps.update()
  drawHarmonyGlow(ctx, time)
  ps.draw(ctx)

  // 庆祝时额外金色粒子
  if (props.triggerCelebration) {
    drawCelebration(ctx, time)
  }

  animFrameId = requestAnimationFrame(animate)
}

onMounted(() => { init(); animate() })
onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  ps?.destroy()
})
</script>
