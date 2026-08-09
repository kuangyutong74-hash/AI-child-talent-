<template>
  <div class="start-screen h-full relative overflow-hidden px-5 py-5 md:px-10 md:py-8">
    <StartEffects />

    <div class="relative z-10 h-full max-w-6xl mx-auto grid lg:grid-cols-[1.08fr_.92fr] gap-5 items-center">
      <section class="start-hero-panel">
        <div class="emergency-chip inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider mb-5">
          <span class="w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7] animate-pulse"></span>
          <span v-html="p('深海基地紧急呼叫')"></span>
        </div>

        <div class="cover-title-row flex items-center gap-4 mb-5">
          <div class="momo-orbit"><MomoDolphin size="hero" /></div>
          <div class="min-w-0 cover-title-copy">
            <div class="cover-eyebrow" v-html="p('沫沫 AI 邀请你加入')"></div>
            <h1 class="font-bold leading-none start-title">
              <span v-html="p('蔚蓝深海基地')"></span>
            </h1>
            <div class="title-signal">
              <span></span>
              <small>BLUE OCEAN BASE · REBUILD MISSION</small>
            </div>
          </div>
        </div>

        <p class="hero-story max-w-2xl text-base md:text-xl font-medium leading-relaxed mb-6"
           v-html="p('风暴摧毁了海底家园，珊瑚公寓、电力管网和海洋议事厅都在等待修复。小队长，带领伙伴们让基地重新发光吧！')"></p>

        <div class="flex flex-wrap items-center gap-3">
          <button @mouseenter="playHover" @click="startGame" class="start-cta group">
            <span v-html="p('开始深海任务')"></span>
            <span class="text-xl group-hover:translate-x-1 transition-transform">→</span>
          </button>
          <div class="hero-meta text-sm leading-relaxed">
            <div v-html="p('适合 6–10 岁 · 约 15 分钟')"></div>
            <div class="mt-0.5" v-html="p('观察 · 规划 · 沟通')"></div>
          </div>
        </div>
      </section>

      <section class="mission-console">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="text-white font-bold text-xl" v-html="p('基地修复路线')"></div>
            <div class="text-cyan-50/85 text-sm mt-1" v-html="p('完成三项任务，获得守护者勋章')"></div>
          </div>
          <span class="text-xs px-3 py-1 rounded-full bg-amber-300/15 text-amber-200 border border-amber-200/20">3 MISSIONS</span>
        </div>
        <div class="space-y-3">
          <div v-for="(mission, i) in missions" :key="mission.title" class="mission-row">
            <div class="mission-icon">
              <img :src="mission.iconSrc" :alt="mission.title" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between gap-2">
                <span class="text-white font-bold" v-html="p(mission.title)"></span>
                <span class="text-xs font-bold text-cyan-100/75">0{{ i + 1 }}</span>
              </div>
              <div class="text-sm text-cyan-50/85 mt-0.5" v-html="p(mission.desc)"></div>
            </div>
            <span class="text-lg text-cyan-100/85">›</span>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-cyan-100/70">
          <span>BLUE OCEAN BASE</span><span>v1.0 · ONLINE</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { playHover } from '../utils/sounds.js'
import { usePinyinText } from '../utils/pinyin.js'
import StartEffects from './effects/StartEffects.vue'
import MomoDolphin from './characters/MomoDolphin.vue'
import coralApartmentIcon from '../assets/generated/nav/nav-coral-apartment.png'
import currentGridIcon from '../assets/generated/nav/nav-current-grid.png'
import mediationIcon from '../assets/generated/nav/nav-mediation.png'
const { p } = usePinyinText()

const emit = defineEmits(['go-level'])

function startGame() {
  emit('go-level', 'LEVEL_1')
}

const missions = [
  { iconSrc: coralApartmentIcon, title: '珊瑚公寓', desc: '观察共生关系，安顿海洋伙伴' },
  { iconSrc: currentGridIcon, title: '洋流电网', desc: '规划管线路径，重启基地能源' },
  { iconSrc: mediationIcon, title: '海洋议事厅', desc: '理解伙伴情绪，完成公平调解' },
]
</script>

<style scoped>
.start-screen::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(circle at 18% 22%, rgba(34,211,238,.16), transparent 28%),
              radial-gradient(circle at 82% 72%, rgba(99,102,241,.18), transparent 30%);
  pointer-events: none;
}
.start-hero-panel {
  padding: clamp(18px, 2.5vw, 34px);
  border: 1px solid rgba(255,255,255,.28);
  border-radius: 28px;
  background: linear-gradient(145deg, rgba(236,254,255,.34), rgba(255,255,255,.14));
  box-shadow: 0 18px 50px rgba(8,47,73,.12), inset 0 1px rgba(255,255,255,.5);
  backdrop-filter: blur(10px);
}
.emergency-chip {
  color: #075985;
  border: 1px solid rgba(8,145,178,.22);
  background: rgba(236,254,255,.82);
  box-shadow: 0 5px 16px rgba(8,47,73,.1), inset 0 1px white;
}
.cover-title-copy {
  padding: 13px 17px 14px;
  border: 1px solid rgba(255,255,255,.55);
  border-radius: 20px;
  background: linear-gradient(120deg, rgba(255,255,255,.83), rgba(207,250,254,.66));
  box-shadow: 0 10px 28px rgba(8,47,73,.13), inset 0 1px white;
  backdrop-filter: blur(12px);
}
.start-title {
  display: block;
  white-space: nowrap;
  width: max-content;
  max-width: none;
  font-size: clamp(2.7rem, 4.25vw, 5.2rem);
  letter-spacing: -.035em;
  background: linear-gradient(105deg, #082f49 2%, #0369a1 31%, #0f766e 58%, #4338ca 86%, #312e81 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255,255,255,.5);
  text-shadow: 0 2px 0 rgba(255,255,255,.9), 0 9px 22px rgba(8,47,73,.22);
  filter: drop-shadow(0 2px 1px rgba(8,47,73,.12));
}
.start-title :deep(ruby) { white-space: nowrap; }
.cover-eyebrow {
  display: inline-flex;
  margin-bottom: 7px;
  color: #0e7490;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .15em;
}
.title-signal {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 11px;
  color: rgba(14,116,144,.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .12em;
}
.title-signal span {
  width: 46px;
  height: 2px;
  border-radius: 99px;
  background: linear-gradient(90deg, #0891b2, transparent);
  box-shadow: 0 0 8px rgba(8,145,178,.35);
}
.title-signal small { font-size: 8px; white-space: nowrap; }
.momo-orbit {
  width: 132px; height: 158px; flex: 0 0 132px; border-radius: 44%; display: grid; place-items: center;
  background: radial-gradient(circle at 35% 25%, rgba(255,255,255,.3), rgba(34,211,238,.08));
  border: 1px solid rgba(165,243,252,.3); box-shadow: 0 0 34px rgba(34,211,238,.18), inset 0 0 20px rgba(255,255,255,.08);
}
.hero-story {
  padding: 12px 16px;
  color: #083f52;
  border-left: 4px solid rgba(8,145,178,.6);
  border-radius: 0 16px 16px 0;
  background: rgba(255,255,255,.68);
  box-shadow: 0 7px 22px rgba(8,47,73,.1), inset 0 1px white;
  text-shadow: 0 1px white;
}
.hero-meta {
  color: #0e5d74;
  padding: 7px 11px;
  border-radius: 12px;
  background: rgba(236,254,255,.7);
  font-weight: 700;
}
.start-cta {
  display: inline-flex; align-items: center; gap: 18px; padding: 14px 26px; border-radius: 16px;
  color: white; font-size: 18px; font-weight: 700; border: 1px solid rgba(255,255,255,.24);
  background: linear-gradient(135deg, #fb7185, #f97316); box-shadow: 0 12px 30px rgba(249,115,22,.24);
  transition: transform .2s, box-shadow .2s;
}
.start-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 38px rgba(249,115,22,.34); }

.mission-console {
  padding: 22px;
  border-radius: 24px;
  color: #164e63;
  background:
    radial-gradient(circle at 90% 0, rgba(165,243,252,.42), transparent 34%),
    linear-gradient(145deg, rgba(255,255,255,.9), rgba(207,250,254,.76));
  border: 1px solid rgba(255,255,255,.78);
  box-shadow: 0 22px 60px rgba(8,47,73,.16), inset 0 1px white;
  backdrop-filter: blur(16px) saturate(1.08);
}
.mission-console :is(.text-white, .text-cyan-50\/85, .text-cyan-100\/75, .text-cyan-100\/70, .text-cyan-100\/85) {
  color: #155e75 !important;
}
.mission-console .text-amber-200 {
  color: #a04708 !important;
  background: rgba(254,243,199,.88) !important;
  border-color: rgba(217,119,6,.25) !important;
}
.mission-row {
  display: flex; align-items: center; gap: 13px; padding: 13px; border-radius: 16px;
  background: rgba(255,255,255,.7);
  border: 1px solid rgba(8,145,178,.13);
  box-shadow: 0 6px 18px rgba(8,47,73,.07), inset 0 1px white;
  transition: .2s ease;
}
.mission-row:hover {
  transform: translateX(4px);
  background: rgba(255,255,255,.92);
  border-color: rgba(6,182,212,.34);
  box-shadow: 0 9px 22px rgba(8,47,73,.11), inset 0 1px white;
}
.mission-icon {
  width: 52px; height: 52px; display: grid; place-items: center; flex: none; overflow: hidden;
  padding: 3px; border-radius: 15px;
  border: 1px solid rgba(8,145,178,.18);
  background: rgba(255,255,255,.92);
  box-shadow: 0 7px 18px rgba(8,47,73,.12), inset 0 1px white;
}
.mission-icon img {
  width: 100%; height: 100%; display: block; object-fit: cover; border-radius: 11px;
}
@media (max-width: 1023px) {
  .start-screen { overflow-y: auto; }
  .mission-console { max-width: 680px; margin: 0 auto; }
  .start-title { font-size: clamp(2.5rem, 8vw, 4.5rem); }
}
@media (max-width: 600px) {
  .cover-title-row { gap: 8px; }
  .momo-orbit { width: 82px; height: 112px; flex-basis: 82px; }
  .start-title { font-size: clamp(2rem, 9vw, 3rem); }
  .title-signal small { display: none; }
}
</style>
