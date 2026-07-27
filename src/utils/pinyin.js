/**
 * 拼音工具模块
 * 提供全局拼音显示开关和文本→拼音HTML转换
 * 使用 pinyin-pro 库
 */
import { ref, computed, inject } from 'vue'
import { pinyin } from 'pinyin-pro'

// ============================================================
// 全局拼音状态（singleton）
// ============================================================
const showPinyin = ref(false)

/**
 * 切换拼音显示状态
 */
export function togglePinyin() {
  showPinyin.value = !showPinyin.value
}

/**
 * 获取拼音显示状态（只读）
 */
export function usePinyinState() {
  return computed(() => showPinyin.value)
}

/**
 * 设置拼音显示状态
 */
export function setPinyinState(val) {
  showPinyin.value = val
}

// ============================================================
// LRU 缓存 — 避免重复转换相同文本
// ============================================================
const cache = new Map()
const MAX_CACHE = 200

function cacheGet(key) {
  if (cache.has(key)) {
    const val = cache.get(key)
    // 移动到末尾（最近使用）
    cache.delete(key)
    cache.set(key, val)
    return val
  }
  return undefined
}

function cacheSet(key, val) {
  if (cache.size >= MAX_CACHE) {
    // 删除最早使用的条目
    const firstKey = cache.keys().next().value
    cache.delete(firstKey)
  }
  cache.set(key, val)
}

// ============================================================
// 拼音转换
// ============================================================

/**
 * 将中文字符串转换为带拼音注解的 HTML
 * 非中文/标点保持原样
 *
 * @param {string} text - 要转换的文本
 * @param {boolean} [force=false] - 是否强制转换（忽略 showPinyin 状态）
 * @returns {string} HTML 字符串
 */
export function toPinyinHtml(text, force = false) {
  if (!text) return text || ''

  // 没有开启拼音且非强制 → 原样返回（但转义HTML）
  if (!force && !showPinyin.value) {
    return escapeHtml(text)
  }

  // 检查缓存
  const cached = cacheGet(text)
  if (cached) return cached

  let result = ''
  let hanBuffer = '' // 连续汉字缓冲区

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (/[一-鿿]/.test(char)) {
      // 是汉字 → 添加到缓冲区
      hanBuffer += char
    } else {
      // 非汉字 → 先处理缓冲区中的汉字
      if (hanBuffer) {
        result += processHanBuffer(hanBuffer)
        hanBuffer = ''
      }
      // 非汉字字符原样输出
      result += escapeHtml(char)
    }
  }

  // 处理末尾的汉字缓冲区
  if (hanBuffer) {
    result += processHanBuffer(hanBuffer)
  }

  cacheSet(text, result)
  return result
}

/**
 * 处理连续汉字 → 每个字用 <ruby> 包裹，<rt> 为拼音
 */
function processHanBuffer(buffer) {
  if (!buffer) return ''

  // 批量获取拼音 — 返回数组，每个元素是每个字的拼音
  const pyArray = pinyin(buffer, {
    toneType: 'symbol',   // 声调符号：nǐ hǎo
    type: 'array',        // 返回数组
    v: true,              // ü 显示为 ü（而非 v）
  })

  let out = ''
  for (let i = 0; i < buffer.length; i++) {
    const py = pyArray[i] || ''
    out += `<ruby>${escapeHtml(buffer[i])}<rt>${py}</rt></ruby>`
  }
  return out
}

/**
 * HTML 转义（防止 XSS）
 */
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return str.replace(/[&<>"']/g, m => map[m])
}

/**
 * 判断文本是否包含中文
 */
export function hasChinese(text) {
  if (!text) return false
  return /[一-鿿]/.test(text)
}

// ============================================================
// Vue 组件 Composables
// ============================================================

/**
 * 在子组件中调用：
 * 返回 { showPinyin, togglePinyin, p(text) }
 *
 * 用法：<span v-html="p('蔚蓝深海基地')" />
 *
 * 依赖父组件在 App.vue 中 provide('showPinyin', ...) 和 provide('togglePinyin', ...)
 */
export function usePinyinText() {
  const showPinyinState = inject('showPinyin', null)
  const togglePinyinFn = inject('togglePinyin', null)

  /**
   * p() — 便捷拼音转换函数
   * 在模板中用 v-html="p('文字')" 来显示带拼音的文字
   */
  function p(text) {
    // 如果父组件没有 provide，回退到直接使用全局状态
    if (showPinyinState === null) {
      return toPinyinHtml(text)
    }
    if (!showPinyinState.value) return escapeHtml(text || '')
    return toPinyinHtml(text, true)
  }

  return {
    showPinyin: showPinyinState || usePinyinState(),
    togglePinyin: togglePinyinFn || togglePinyin,
    p,
  }
}
