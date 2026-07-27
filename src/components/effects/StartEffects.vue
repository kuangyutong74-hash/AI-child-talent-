<template>
  <canvas ref="canvasRef" class="absolute inset-0 w-full h-full pointer-events-none z-10"></canvas>
</template>

<script setup>
/**
 * 🌟 开始页特效
 * - 标题下方粒子吸引效果
 * - 海豚沫沫周围光点
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { ParticleSystem } from '../canvas/ParticleSystem.js'

const canvasRef = ref(null)
let ctx = null
let ps = null
let animFrameId = null
let time = 0

function init() {
  const canvas = canvasRef.value
  ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  ps = new ParticleSystem(50)

  // 自动发射粒子（从底部升起）
  ps.startAutoEmit(() => {
    ps.emit(
      Math.random() * canvas.width,
      canvas.height + 10,
      {
        speed: 0.3 + Math.random() * 0.8,
        size: 1 + Math.random() * 3,
        color: () => {
          const colors = ['rgba(255,255,255,0.3)', 'rgba(147,197,253,0.3)', 'rgba(103,232,249,0.3)']
          return colors[Math.floor(Math.random() * colors.length)]
        },
        life: 200 + Math.random() * 100,
        gravity: -0.05,
        fadeOut: true,
      }
    )
  }, 200)
}

function animate() {
  time++
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ps.update()
  ps.draw(ctx)
  animFrameId = requestAnimationFrame(animate)
}

onMounted(() => { init(); animate() })
onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  ps?.destroy()
})
</script>
