<template>
  <!-- 🐠 彩彩（鹦嘴鱼 · 活泼性格） -->
  <span v-if="!loaded" class="text-5xl md:text-6xl select-none"
        :class="{ 'animate-bounce-in': excited }">🐠</span>
  <img v-else :src="svgSrc" alt="彩彩" class="character-img" :class="sizeClass" />
</template>

<script setup>
/**
 * 彩彩角色组件
 *
 * 🔴 使用 AI 生成 SVG 后替换：
 * 1. 用 AI 生成鹦嘴鱼 SVG
 * 2. 保存到 src/assets/characters/caicai.svg
 *
 * AI 提示词:
 *   "vibrant parrotfish with colorful rainbow scales, big expressive eyes,
 *    energetic pose, cartoon style, bright pink and blue gradient, underwater"
 */
import { ref, computed } from 'vue'

const props = defineProps({
  size: { type: String, default: 'md' },
  excited: { type: Boolean, default: false },
})

const loaded = ref(false)
const svgSrc = computed(() => '')
const sizeClass = computed(() => {
  const map = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' }
  return map[props.size] || map.md
})
</script>

<style scoped>
.character-img {
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
}
</style>
