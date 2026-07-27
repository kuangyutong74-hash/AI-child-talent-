<template>
  <Teleport v-if="targetSelector" to="body">
    <div v-if="visible" class="tutorial-spotlight-layer">
      <div v-if="spotlightStyle" class="tutorial-spotlight" :style="spotlightStyle"></div>
      <div v-else class="tutorial-full-dim"></div>
      <div class="tutorial-guide-position">
        <div ref="bubbleRef"
             class="pointer-events-auto bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-xl border-2 border-cyan-300"
             style="box-shadow: 0 4px 20px rgba(56,189,248,0.25);">
          <div class="flex items-center gap-2 mb-1.5">
            <MomoDolphin size="sm" />
            <span class="text-sm font-bold text-cyan-700">沫沫</span>
          </div>
          <p class="text-sm md:text-base text-cyan-800 leading-relaxed font-medium" v-html="p(message)"></p>
          <button @click.stop="$emit('skip')"
              class="mt-2 text-xs font-medium text-cyan-700/85 hover:text-cyan-900 hover:underline transition-all float-right bg-transparent border-none cursor-pointer">
            [跳过引导]
          </button>
          <div class="clear-both"></div>
        </div>
      </div>
    </div>
  </Teleport>

  <template v-else>
    <div v-if="visible" class="fixed inset-0 z-40 bg-black/60 pointer-events-none"></div>
    <div v-if="visible"
         class="fixed right-[3%] top-1/2 -translate-y-1/2 z-50 pointer-events-none max-w-[320px] w-[85vw]">
      <div ref="bubbleRef"
           class="pointer-events-auto bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-xl border-2 border-cyan-300"
           style="box-shadow: 0 4px 20px rgba(56,189,248,0.25);">
        <div class="flex items-center gap-2 mb-1.5">
          <MomoDolphin size="sm" />
          <span class="text-sm font-bold text-cyan-700">沫沫</span>
        </div>
        <p class="text-sm md:text-base text-cyan-800 leading-relaxed font-medium" v-html="p(message)"></p>
        <button @click.stop="$emit('skip')"
            class="mt-2 text-xs font-medium text-cyan-700/85 hover:text-cyan-900 hover:underline transition-all float-right bg-transparent border-none cursor-pointer">
          [跳过引导]
        </button>
        <div class="clear-both"></div>
      </div>
    </div>
  </template>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'
import { usePinyinText } from '../utils/pinyin.js'
import MomoDolphin from './characters/MomoDolphin.vue'

const { p } = usePinyinText()

const props = defineProps({
  visible: { type: Boolean, default: false },
  message: { type: String, default: '' },
  targetSelector: { type: String, default: '' },
})

const emit = defineEmits(['skip'])

const bubbleRef = ref(null)
const spotlightStyle = ref(null)
let tween = null
let frameId = null

function updateSpotlight() {
  if (!props.visible || !props.targetSelector) {
    spotlightStyle.value = null
    return
  }
  const target = document.querySelector(props.targetSelector)
  if (!target) {
    spotlightStyle.value = null
    return
  }
  const rect = target.getBoundingClientRect()
  const padding = 8
  spotlightStyle.value = {
    left: `${Math.max(6, rect.left - padding)}px`,
    top: `${Math.max(6, rect.top - padding)}px`,
    width: `${Math.min(window.innerWidth - 12, rect.width + padding * 2)}px`,
    height: `${Math.min(window.innerHeight - 12, rect.height + padding * 2)}px`,
  }
}

function scheduleSpotlightUpdate() {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = requestAnimationFrame(updateSpotlight)
}

function startBounce() {
  if (!bubbleRef.value) return
  stopBounce()
  tween = gsap.to(bubbleRef.value, {
    y: -6,
    duration: 0.8,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: -1,
  })
}

function stopBounce() {
  if (tween) { tween.kill(); tween = null }
}

watch([() => props.visible, () => props.targetSelector], ([val]) => {
  if (val) nextTick(() => {
    startBounce()
    scheduleSpotlightUpdate()
  })
  else stopBounce()
})
onMounted(() => {
  window.addEventListener('resize', scheduleSpotlightUpdate)
  window.addEventListener('scroll', scheduleSpotlightUpdate, true)
  if (props.visible) nextTick(() => {
    startBounce()
    scheduleSpotlightUpdate()
  })
})
onUnmounted(() => {
  stopBounce()
  if (frameId) cancelAnimationFrame(frameId)
  window.removeEventListener('resize', scheduleSpotlightUpdate)
  window.removeEventListener('scroll', scheduleSpotlightUpdate, true)
})
</script>

<style scoped>
.tutorial-spotlight-layer {
  position: fixed;
  inset: 0;
  z-index: 9990;
  pointer-events: none;
  overflow: hidden;
}

.tutorial-full-dim {
  position: absolute;
  inset: 0;
  background: rgba(2, 15, 30, 0.72);
}

.tutorial-spotlight {
  position: fixed;
  border-radius: 18px;
  border: 3px solid rgba(250, 204, 21, 0.96);
  box-shadow:
    0 0 0 9999px rgba(2, 15, 30, 0.72),
    0 0 0 7px rgba(250, 204, 21, 0.2),
    0 0 28px 8px rgba(250, 204, 21, 0.72);
  transition: left 0.28s ease, top 0.28s ease, width 0.28s ease, height 0.28s ease;
}

.tutorial-guide-position {
  position: fixed;
  right: 3%;
  top: 50%;
  width: min(320px, 85vw);
  transform: translateY(-50%);
  pointer-events: none;
}

@media (max-width: 900px) {
  .tutorial-guide-position {
    right: 50%;
    top: auto;
    bottom: 3%;
    transform: translateX(50%);
  }
}
</style>
