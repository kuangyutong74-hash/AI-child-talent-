<template>
  <span v-if="!loaded" class="inline-block select-none" :class="[emojiClass, customClass]">{{ fallback }}</span>
  <img v-else :src="svgSrc" :alt="name" class="inline-block object-contain select-none" :class="imgClass" />
</template>

<script setup>
/**
 * CharacterImage — 角色头像组件（沫沫/壳壳/彩彩）
 *
 * 自动尝试加载 src/assets/characters/{charId}.svg
 * SVG 不存在时回退显示 emoji
 *
 * 用法:
 *   <CharacterImage charId="keke" size="lg" />
 *   <CharacterImage charId="caicai" size="xl" />
 */
import { ref, computed, onMounted } from 'vue'
import momoGeneratedSrc from '../../assets/generated/momo-guide.png'
import kekeGeneratedSrc from '../../assets/generated/keke-crab.png'
import caicaiGeneratedSrc from '../../assets/generated/caicai-fish.png'

const props = defineProps({
  charId: { type: String, required: true },    // momo / keke / caicai
  size: { type: String, default: 'md' },       // sm md lg xl
  customClass: { type: String, default: '' },
})

const FALLBACKS = { momo: '🐬', keke: '🦀', caicai: '🐠' }
const name = computed(() => ({ momo: '沫沫', keke: '壳壳', caicai: '彩彩' })[props.charId] || '')
const fallback = computed(() => FALLBACKS[props.charId] || '🐟')

const GENERATED_SOURCES = {
  momo: momoGeneratedSrc,
  keke: kekeGeneratedSrc,
  caicai: caicaiGeneratedSrc,
}
const loaded = ref(Boolean(GENERATED_SOURCES[props.charId]))
const svgSrc = computed(() => {
  if (GENERATED_SOURCES[props.charId]) return GENERATED_SOURCES[props.charId]
  try {
    return new URL(`../../assets/characters/${props.charId}.svg`, import.meta.url).href
  } catch { return '' }
})

const sizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16', xl: 'w-24 h-24' }
const emojiMap = { sm: 'text-xl', md: 'text-2xl', lg: 'text-5xl', xl: 'text-6xl' }
const emojiClass = computed(() => emojiMap[props.size] || emojiMap.md)
const imgClass = computed(() => `${sizeMap[props.size] || sizeMap.md} drop-shadow-lg ${props.customClass}`)

onMounted(() => {
  if (GENERATED_SOURCES[props.charId]) return
  if (svgSrc.value) {
    const img = new Image()
    img.onload = () => { loaded.value = true }
    img.onerror = () => { loaded.value = false }
    img.src = svgSrc.value
  }
})
</script>
