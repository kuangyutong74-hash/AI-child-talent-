<template>
  <img :src="momoSrc" alt="沫沫机械海豚 AI 管家" class="character-img select-none" :class="sizeClass" />
</template>

<script setup>
import { computed } from 'vue'
import momoSrc from '../../assets/generated/momo-guide.png'

const props = defineProps({
  size: { type: String, default: 'md' },
  animate: { type: Boolean, default: true },
})

const sizeClass = computed(() => {
  const map = {
    sm: 'w-11 h-11',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
    hero: 'w-36 h-44 md:w-44 md:h-56',
  }
  return (map[props.size] || map.md) + (props.animate ? ' float-anim' : '')
})
</script>

<style scoped>
.character-img {
  object-fit: contain;
  filter: drop-shadow(0 12px 16px rgba(2, 6, 23, .3)) drop-shadow(0 0 12px rgba(34,211,238,.22));
}
</style>
