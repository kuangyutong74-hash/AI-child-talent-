/**
 * 🐬 语音播报系统 — Edge TTS 神经网络 AI 语音
 * ────────────────────────────────────────────────
 * 废弃旧的 window.speechSynthesis，全面改用微软 Edge 神经网络语音。
 * 所有角色声音播放统一经过此模块，自动处理音频中断避免重叠。
 *
 * 支持"播放/停止/重播"切换模式：
 *   点击播放 → 再点击停止 → 再点击重新播放
 *
 * 后端端点: GET /api/tts?text=xxx&voice=xxx
 * 音源:     edge_tts → MP3 流 → Audio 播放
 */

// ── 角色自然语音配置：音色 + 韵律 ──
const VOICE_PROFILES = {
  momo: {
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: '-3%',
    pitch: '+0Hz',
    volume: '+0%',
  }, // 🐬 沫沫 · 温柔、稳定、亲切
  keke: {
    voice: 'zh-CN-YunxiNeural',
    rate: '-4%',
    pitch: '+6Hz',
    volume: '+0%',
  }, // 🦀 壳壳 · 清亮、童趣的少年声
  caicai: {
    voice: 'zh-CN-XiaoyiNeural',
    rate: '+5%',
    pitch: '+4Hz',
    volume: '+1%',
  }, // 🐠 彩彩 · 明快、有活力的少女声
}

// 默认用 沫沫 音色
const DEFAULT_PROFILE = VOICE_PROFILES.momo

// ── 全局状态 ──
let currentAudio = null
let currentResolve = null  // playTTS 当前 pending 的 resolve，确保 stopTTS 能解除等待
let lastPlayedKey = null

/**
 * 获取角色对应的 Edge TTS 音色代码
 * @param {string} role - 'momo' | 'keke' | 'caicai'
 * @returns {string} Edge TTS voice code
 */
export function getVoiceCode(role) {
  return (VOICE_PROFILES[role] || DEFAULT_PROFILE).voice
}

export function getVoiceProfile(role) {
  return VOICE_PROFILES[role] || DEFAULT_PROFILE
}

function normalizeSpeechText(text) {
  return text
    .replace(/^[\s“”"'「」『』]*?(沫沫|壳壳|彩彩)\s*[说：:，,]*/u, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/[“”「」『』]/g, '')
    .replace(/([！。？，、])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 播放神经网络语音（自动中断上一段）
 * 返回 Promise，播放结束 / 被停止 / 出错时 resolve
 * @param {string} text  - 要朗读的文本
 * @param {string} role  - 角色标识: 'momo' | 'keke' | 'caicai'
 * @returns {Promise<void>}
 */
export function playTTS(text, role = 'momo') {
  // 立即中断当前播放（也会 resolve 上一个 promise）
  stopTTS()

  const speechText = normalizeSpeechText(text || '')
  if (!speechText) return Promise.resolve()

  return new Promise((resolve) => {
    currentResolve = resolve

    const profile = getVoiceProfile(role)
    const params = new URLSearchParams({
      text: speechText,
      voice: profile.voice,
      rate: profile.rate,
      pitch: profile.pitch,
      volume: profile.volume,
    })
    const url = `http://localhost:8005/api/tts?${params.toString()}`

    currentAudio = new Audio(url)
    currentAudio.play().catch(err => {
      console.warn('[TTS] 播放失败:', err)
      cleanup()
      resolve()
    })
    currentAudio.onended = () => {
      cleanup()
      resolve()
    }
    currentAudio.onerror = () => {
      console.warn('[TTS] 音频错误')
      cleanup()
      resolve()
    }
  })
}

function cleanup() {
  currentAudio = null
  currentResolve = null
}

/**
 * 切换播放/停止 — 同一个按钮点击播放，再点击停止，再点击重新播放
 * 不同按钮：自动切换为新内容
 *
 * 返回 Promise，播放结束 / 被停止 / 出错时 resolve。
 * await 此 Promise 可在播放完成后执行后续逻辑（如引导推进）。
 *
 * @param {string} text  - 要朗读的文本
 * @param {string} role  - 角色标识
 * @returns {Promise<void>} - 播放结束后 resolve
 */
export function toggleTTS(text, role = 'momo') {
  const key = text + '||' + role

  // 同一个按钮正在播放 → 停止
  if (currentAudio && lastPlayedKey === key) {
    stopTTS()
    lastPlayedKey = null
    return Promise.resolve()
  }

  // 不同按钮 或 没有在播放 → 播放
  lastPlayedKey = key
  return playTTS(text, role)
}

/**
 * 立即停止当前语音播放
 */
export function stopTTS() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  // 确保正在 await playTTS / toggleTTS 的调用方可以继续
  if (currentResolve) {
    const r = currentResolve
    currentResolve = null
    r()
  }
}

/**
 * 判断是否有语音正在播放
 * @returns {boolean}
 */
export function isPlaying() {
  return currentAudio !== null
}
