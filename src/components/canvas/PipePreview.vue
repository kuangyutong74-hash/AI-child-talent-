<template>
  <canvas ref="canvasRef" class="block w-[72px] h-[56px]" aria-hidden="true"></canvas>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { drawPipe } from './PipeRenderer.js'

const props = defineProps({
  def: { type: String, required: true },
  rot: { type: Number, default: 0 },
})
const canvasRef = ref(null)

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = 72 * dpr
  canvas.height = 56 * dpr
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, 72, 56)
  drawPipe(ctx, 36, 28, props.def, props.rot, 42, false)
}

onMounted(render)
watch(() => [props.def, props.rot], render)
</script>
