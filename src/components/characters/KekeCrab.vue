<template>
  <!-- 🦀 壳壳（寄居蟹 · 敏感性格） -->
  <span v-if="!loaded" class="text-5xl md:text-6xl select-none"
        :class="{ 'filter hue-rotate-15': anger > 60 }">🦀</span>
  <img v-else :src="svgSrc" alt="壳壳" class="character-img" :class="sizeClass" />
</template>

<script setup>
/**
 * 壳壳角色组件
 *
 * 🔴 使用 AI 生成 SVG 后替换：
 * 1. 用 AI 生成寄居蟹 SVG
 * 2. 保存到 src/assets/characters/keke.svg
 *
 * AI 提示词:
 *   "shy hermit crab with spiral shell house, expressive big eyes,
 *    cartoon style, kawaii, warm brown and orange colors, underwater"
 */
import { ref, computed } from 'vue'

const props = defineProps({
  size: { type: String, default: 'md' },
  anger: { type: Number, default: 0 },
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
