<template>
  <canvas ref="canvasRef" class="absolute inset-0 w-full h-full pointer-events-none z-10"></canvas>
</template>

<script setup>
/**
 * 🏠 第一关·珊瑚特效
 * - 配对成功时爆发珊瑚色粒子
 * - 持续飘浮的微生物光点
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ParticleSystem } from '../canvas/ParticleSystem.js'

const canvasRef = ref(null)
let ctx = null
let ps = null
let animFrameId = null

const props = defineProps({
  // 传入配对成功时的位置 { x, y }，触发粒子爆发
  triggerBurst: { type: Object, default: null },
})

const emit = defineEmits(['burst-done'])

function init() {
  const canvas = canvasRef.value
  ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  ps = new ParticleSystem(100)
}

function animate() {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ps.update()
  ps.draw(ctx)
  animFrameId = requestAnimationFrame(animate)
}

// 配对成功 → 珊瑚粒子爆发
function triggerCoralBurst(pos) {
  const rect = canvasRef.value.getBoundingClientRect()
  const x = pos.clientX - rect.left
  const y = pos.clientY - rect.top

  ps.emit(x, y, {
    count: 40,
    speed: 3,
    size: 4,
    spread: Math.PI * 2,
    life: 80,
    color: () => {
      const colors = ['#ff6b6b', '#ffd93d', '#ff85a2', '#fb7185', '#fda4af']
      return colors[Math.floor(Math.random() * colors.length)]
    },
    fadeOut: true,
  })

  // 第二次爆发（延迟一点）
  setTimeout(() => {
    ps.emit(x, y, {
      count: 20, speed: 2, size: 3,
      spread: Math.PI * 2, life: 60,
      color: '#ffd93d', fadeOut: true, glow: true,
    })
  }, 150)
}

watch(() => props.triggerBurst, (pos) => {
  if (pos) triggerCoralBurst(pos)
})

onMounted(() => { init(); animate() })
onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  ps?.destroy()
})
</script>
