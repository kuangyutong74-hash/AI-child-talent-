/**
 * 🎵 按钮音效系统 — Web Audio API 合成，无需外部文件
 *
 * 用法:
 *   import { playHover, playClick } from '../utils/sounds.js'
 *   <button @mouseenter="playHover" @click="playClick">按钮</button>
 */

let audioCtx = null

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

/** 按钮悬停音效：轻柔单音叮声 */
export function playHover() {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch (e) { /* 自动降级 */ }
}

/** 按钮点击音效：双音上升叮咚 */
export function playClick() {
  try {
    const ctx = getCtx()
    const t = ctx.currentTime
    // 第一个音
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.value = 660
    gain1.gain.setValueAtTime(0.08, t)
    gain1.gain.linearRampToValueAtTime(0.06, t + 0.03)
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc1.connect(gain1).connect(ctx.destination)
    osc1.start(t)
    osc1.stop(t + 0.12)
    // 第二个音（稍高）
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.value = 990
    gain2.gain.setValueAtTime(0.06, t + 0.05)
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    osc2.connect(gain2).connect(ctx.destination)
    osc2.start(t + 0.05)
    osc2.stop(t + 0.16)
  } catch (e) { /* 自动降级 */ }
}

/** 成功音效：三连上升叮咚 + 尾音 */
export function playSuccess() {
  try {
    const ctx = getCtx()
    const t = ctx.currentTime
    ;[660, 880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const st = t + i * 0.08
      gain.gain.setValueAtTime(0, st)
      gain.gain.linearRampToValueAtTime(0.08, st + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(st)
      osc.stop(st + 0.25)
    })
  } catch (e) { /* 自动降级 */ }
}
