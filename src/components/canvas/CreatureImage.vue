<template>
  <!-- 🐟 海洋生物图片（支持 SVG 替换，自动回退 emoji） -->
  <span v-if="!loaded" class="inline-block select-none" :class="[emojiClass, customClass]">{{ emoji }}</span>
  <img v-else :src="svgSrc" :alt="alt" class="inline-block object-contain select-none" :class="imgClass" />
</template>

<script setup>
/**
 * CreatureImage — 海洋生物图片组件
 *
 * 自动尝试加载 src/assets/creatures/{creatureId}.svg
 * 如果 SVG 文件不存在，回退显示 emoji
 *
 * 🔴 替换图片只需:
 *   用 AI 生成 SVG → 存到 src/assets/creatures/{creatureId}.svg → 自动生效
 *
 * AI 提示词模板:
 *   "cute cartoon [生物名], big eyes, friendly, kawaii style, underwater,
 *    clean vector illustration, white background, clip art"
 *
 * 推荐工具: DALL·E 3 / Midjourney → Vectorizer.ai 转 SVG
 */
import { ref, computed, onMounted } from 'vue'
import clownfishSrc from '../../assets/generated/creatures/clownfish.png'
import gardenEelSrc from '../../assets/generated/creatures/garden_eel.png'
import shrimpSrc from '../../assets/generated/creatures/shrimp.png'
import gobySrc from '../../assets/generated/creatures/goby.png'
import anemoneSrc from '../../assets/generated/creatures/anemone.png'
import turtleSrc from '../../assets/generated/creatures/turtle.png'
import remoraSrc from '../../assets/generated/creatures/remora.png'

const props = defineProps({
  creatureId: { type: String, required: true },
  emoji: { type: String, default: '🐟' },
  alt: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm, md, lg, xl
  customClass: { type: String, default: '' },
})

const GENERATED_SOURCES = {
  clownfish: clownfishSrc,
  garden_eel: gardenEelSrc,
  shrimp: shrimpSrc,
  goby: gobySrc,
  anemone: anemoneSrc,
  turtle: turtleSrc,
  remora: remoraSrc,
}

const loaded = ref(Boolean(GENERATED_SOURCES[props.creatureId]))
const svgSrc = computed(() => {
  if (GENERATED_SOURCES[props.creatureId]) return GENERATED_SOURCES[props.creatureId]
  try {
    return new URL(`../../assets/creatures/${props.creatureId}.svg`, import.meta.url).href
  } catch {
    return ''
  }
})

const sizeMap = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-14 h-14', xl: 'w-[76px] h-[76px]' }
const emojiClass = computed(() => {
  const map = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl', xl: 'text-5xl' }
  return map[props.size] || map.md
})
const imgClass = computed(() => {
  return `${sizeMap[props.size] || sizeMap.md} generated-creature drop-shadow-lg ${props.customClass}`
})

onMounted(() => {
  if (GENERATED_SOURCES[props.creatureId]) return
  if (svgSrc.value) {
    const img = new Image()
    img.onload = () => { loaded.value = true }
    img.onerror = () => { loaded.value = false }
    img.src = svgSrc.value
  }
})
</script>

<style scoped>
.generated-creature {
  filter: drop-shadow(0 7px 8px rgba(2, 6, 23, .24)) drop-shadow(0 0 7px rgba(103, 232, 249, .15));
  transition: transform .2s ease, filter .2s ease;
}
.generated-creature:hover {
  filter: drop-shadow(0 9px 11px rgba(2, 6, 23, .3)) drop-shadow(0 0 11px rgba(103, 232, 249, .26));
}
</style>
