<template>
  <canvas ref="canvasRef" class="absolute inset-0 w-full h-full pointer-events-none z-10"></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ParticleSystem } from '../canvas/ParticleSystem.js'
import { drawPipe, drawPipeCurrent } from '../canvas/PipeRenderer.js'

const canvasRef = ref(null)
let ctx = null
let ps = null
let animFrameId = null
let resizeObserver = null
let currentPath = []
let currentPhase = 0

const props = defineProps({
  connectionPath: { type: Array, default: () => [] },
  isConnected: { type: Boolean, default: false },
})

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function drawPipes() {
  for (const p of currentPath) {
    if (!p.def) continue
    drawPipe(ctx, p.x, p.y, p.def, p.rot, p.size || 56, p.energized)
  }
}

function drawElectricity(time) {
  currentPhase = (currentPhase + 0.65) % 120
  for (const p of currentPath) {
    if (!p.energized) continue
    const pulse = 0.82 + Math.sin(time * 0.008 + p.row * 0.7 + p.col * 0.4) * 0.18
    drawPipeCurrent(ctx, p.x, p.y, p.def, p.rot, p.size || 56, currentPhase, pulse)

    if (Math.random() > 0.96) {
      ps.emit(p.x, p.y, {
        count: 1, speed: 0.8, size: 2,
        color: '#a5f3fc', life: 18, glow: true, fadeOut: true,
      })
    }
  }
}

function animate(time = 0) {
  if (!ctx || !canvasRef.value) return
  ctx.clearRect(0, 0, canvasRef.value.offsetWidth, canvasRef.value.offsetHeight)
  drawPipes()
  drawElectricity(time)
  ps.update()
  ps.draw(ctx)
  animFrameId = requestAnimationFrame(animate)
}

watch(() => props.connectionPath, (path) => {
  currentPath = Array.isArray(path) ? path : []
}, { deep: true, immediate: true })

onMounted(() => {
  ps = new ParticleSystem(40)
  resizeCanvas()
  resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(canvasRef.value)
  animate()
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  resizeObserver?.disconnect()
  ps?.destroy()
})
</script>
