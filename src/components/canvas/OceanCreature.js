/**
 * 🐟 海洋生物渲染类
 * 纯 Canvas 绘制，不依赖任何图片资源
 * 所有生物用几何图形 + 渐变色绘制
 *
 * 包含:
 *   Fish      - 普通鱼群（简单椭圆+尾巴）
 *   Jellyfish - 水母（半圆伞+触须）
 *   Turtle    - 海龟（椭圆壳+四肢）
 */

// ─────────────────────────────────────────────────────────────
// 调色板（海洋生物配色）
// ─────────────────────────────────────────────────────────────
const FISH_COLORS = [
  ['#ff6b6b', '#ee5a24'], // 小丑鱼橙红
  ['#ffd93d', '#f6b93b'], // 黄高鳍刺尾鱼
  ['#6bcb77', '#2d7d46'], // 绿色
  ['#4d96ff', '#3742fa'], // 蓝唐王鱼
  ['#ff85a2', '#ee5a6f'], // 粉红
  ['#a66cff', '#7c3aed'], // 紫
  ['#00d2d3', '#0abde3'], // 青
  ['#f368e0', '#ee5f85'], // 品红
  ['#feca57', '#ff9f43'], // 金
  ['#2ecc71', '#27ae60'], // 翠绿
]

export class Fish {
  constructor(w, h) {
    this.reset(w, h)
    this.phase = Math.random() * Math.PI * 2
  }

  reset(w, h) {
    this.x = Math.random() * w
    this.y = h * 0.15 + Math.random() * h * 0.55
    this.size = 8 + Math.random() * 18
    this.speed = 0.3 + Math.random() * 0.8
    this.waveAmp = 0.5 + Math.random() * 1.2
    this.waveFreq = 0.015 + Math.random() * 0.025
    this.phase = Math.random() * Math.PI * 2
    this.dir = Math.random() > 0.5 ? 1 : -1
    this.tailPhase = Math.random() * Math.PI * 2
    this.colorPair = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)]
    this.opacity = 0.6 + Math.random() * 0.4
    this.eyeBlink = Math.random() * 300
    this.eyeFrame = 0
  }

  update(w, h, time) {
    // 水平游动
    this.x += this.speed * this.dir
    // 正弦上下摆动
    this.y += Math.sin(time * this.waveFreq + this.phase) * this.waveAmp * 0.05
    // 尾巴摆动
    this.tailPhase += 0.08
    this.eyeFrame++

    // 边界回弹（带随机深度变化）
    if (this.dir > 0 && this.x > w + 40) {
      this.dir = -1
      this.y = h * 0.15 + Math.random() * h * 0.55
    } else if (this.dir < 0 && this.x < -40) {
      this.dir = 1
      this.y = h * 0.15 + Math.random() * h * 0.55
    }
  }

  draw(ctx, layerAlpha = 1) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.scale(this.dir, 1)
    ctx.globalAlpha = this.opacity * layerAlpha

    const s = this.size
    const tailWag = Math.sin(this.tailPhase) * 0.3

    // 鱼身（椭圆）
    ctx.beginPath()
    ctx.ellipse(0, 0, s, s * 0.4, 0, 0, Math.PI * 2)
    ctx.fillStyle = this.colorPair[0]
    ctx.fill()

    // 鱼尾（三角形）
    ctx.beginPath()
    ctx.moveTo(-s * 0.7, 0)
    ctx.lineTo(-s * 1.3 - tailWag * s * 0.3, -s * 0.35)
    ctx.lineTo(-s * 1.3 - tailWag * s * 0.3, s * 0.35)
    ctx.closePath()
    ctx.fillStyle = this.colorPair[1]
    ctx.fill()

    // 背鳍（小三角）
    ctx.beginPath()
    ctx.moveTo(s * 0.1, -s * 0.35)
    ctx.lineTo(s * 0.3, -s * 0.55)
    ctx.lineTo(s * 0.5, -s * 0.35)
    ctx.closePath()
    ctx.fillStyle = this.colorPair[1]
    ctx.fill()

    // 眼睛（白底+黑瞳+高光）
    const isBlinking = this.eyeFrame % this.eyeBlink < 4
    if (!isBlinking) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(s * 0.35, -s * 0.08, s * 0.12, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a1a2e'
      ctx.beginPath()
      ctx.arc(s * 0.38, -s * 0.06, s * 0.07, 0, Math.PI * 2)
      ctx.fill()
      // 高光
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(s * 0.42, -s * 0.12, s * 0.03, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
    ctx.restore()
  }
}

// ─────────────────────────────────────────────────────────────
// 水母
// ─────────────────────────────────────────────────────────────
const JELLY_COLORS = [
  ['rgba(200,120,255,0.5)', '#c878ff'],
  ['rgba(255,150,200,0.5)', '#ff96c8'],
  ['rgba(100,200,255,0.5)', '#64c8ff'],
  ['rgba(255,200,100,0.5)', '#ffc864'],
]

export class Jellyfish {
  constructor(w, h) {
    this.x = Math.random() * w
    this.y = h * 0.05 + Math.random() * h * 0.4
    this.size = 15 + Math.random() * 20
    this.speed = 0.15 + Math.random() * 0.25
    this.dir = Math.random() > 0.5 ? 1 : -1
    this.pulsePhase = Math.random() * Math.PI * 2
    this.driftPhase = Math.random() * Math.PI * 2
    this.colors = JELLY_COLORS[Math.floor(Math.random() * JELLY_COLORS.length)]
    this.tentacleCount = 6 + Math.floor(Math.random() * 6)
  }

  update(w, h, time) {
    this.x += Math.sin(time * 0.003 + this.driftPhase) * 0.3
    this.y += Math.sin(time * 0.005 + this.pulsePhase) * 0.15
    this.pulsePhase += 0.03

    if (this.x < -40) this.x = w + 20
    if (this.x > w + 40) this.x = -20
    if (this.y < -20) this.y = h * 0.4
    if (this.y > h * 0.5) this.y = h * 0.05
  }

  draw(ctx, layerAlpha = 1) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.globalAlpha = layerAlpha

    const pulse = 1 + Math.sin(this.pulsePhase) * 0.08
    const s = this.size * pulse

    // 伞体（半透明半圆）
    ctx.beginPath()
    ctx.ellipse(0, 0, s, s * 0.6, 0, Math.PI, Math.PI * 2)
    ctx.closePath()

    const grad = ctx.createRadialGradient(0, -s * 0.1, 0, 0, 0, s * 0.8)
    grad.addColorStop(0, this.colors[0])
    grad.addColorStop(1, this.colors[1])
    ctx.fillStyle = grad
    ctx.fill()

    // 伞边缘发光
    ctx.strokeStyle = this.colors[1]
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.4 * layerAlpha
    ctx.beginPath()
    ctx.ellipse(0, 0, s, s * 0.6, 0, Math.PI, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1

    // 触须
    ctx.strokeStyle = this.colors[1]
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.3 * layerAlpha
    for (let i = 0; i < this.tentacleCount; i++) {
      const angle = (i / this.tentacleCount) * Math.PI * 2
      const tx = Math.cos(angle) * s * 0.7
      const ty = Math.sin(angle) * s * 0.5 + s * 0.4

      ctx.beginPath()
      ctx.moveTo(tx, ty)
      const len = s * (0.8 + Math.sin(this.pulsePhase + i) * 0.3)
      const endX = tx + Math.sin(this.pulsePhase * 0.7 + i * 0.5) * len * 0.3
      const endY = ty + len
      ctx.quadraticCurveTo(
        tx + Math.sin(this.pulsePhase * 0.5 + i) * len * 0.2,
        ty + len * 0.5,
        endX, endY
      )
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }
}

// ─────────────────────────────────────────────────────────────
// 海龟
// ─────────────────────────────────────────────────────────────
export class Turtle {
  constructor(w, h) {
    this.x = Math.random() * w
    this.y = h * 0.5 + Math.random() * h * 0.3
    this.size = 25 + Math.random() * 15
    this.speed = 0.2 + Math.random() * 0.3
    this.dir = Math.random() > 0.5 ? 1 : -1
    this.flipperPhase = Math.random() * Math.PI * 2
  }

  update(w, h, time) {
    this.x += this.speed * this.dir
    this.flipperPhase += 0.05

    if (this.dir > 0 && this.x > w + 60) { this.dir = -1; this.y = h * 0.4 + Math.random() * h * 0.3 }
    if (this.dir < 0 && this.x < -60) { this.dir = 1; this.y = h * 0.4 + Math.random() * h * 0.3 }
  }

  draw(ctx, layerAlpha = 1) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.scale(this.dir, 1)
    ctx.globalAlpha = layerAlpha
    const s = this.size
    const fp = Math.sin(this.flipperPhase) * 0.3

    // 龟壳（椭圆，六边形纹理）
    ctx.beginPath()
    ctx.ellipse(0, 0, s, s * 0.65, 0, 0, Math.PI * 2)
    const shellGrad = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s)
    shellGrad.addColorStop(0, '#5d9b5d')
    shellGrad.addColorStop(0.5, '#3d7a3d')
    shellGrad.addColorStop(1, '#2d5a2d')
    ctx.fillStyle = shellGrad
    ctx.fill()
    ctx.strokeStyle = '#1a4a1a'
    ctx.lineWidth = 1
    ctx.stroke()

    // 龟壳纹理
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.4)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // 头部
    ctx.beginPath()
    ctx.ellipse(s * 0.6, -s * 0.1, s * 0.25, s * 0.2, 0.3, 0, Math.PI * 2)
    ctx.fillStyle = '#6b8e6b'
    ctx.fill()
    // 眼睛
    ctx.fillStyle = '#1a1a2e'
    ctx.beginPath()
    ctx.arc(s * 0.7, -s * 0.15, s * 0.06, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(s * 0.72, -s * 0.18, s * 0.025, 0, Math.PI * 2)
    ctx.fill()

    // 前肢（划水动画）
    ctx.beginPath()
    ctx.ellipse(s * 0.35, s * 0.5 + fp * s * 0.2, s * 0.2, s * 0.35, 0.5 + fp, 0, Math.PI * 2)
    ctx.fillStyle = '#6b8e6b'
    ctx.fill()

    // 后肢
    ctx.beginPath()
    ctx.ellipse(-s * 0.35, s * 0.45 - fp * s * 0.15, s * 0.18, s * 0.3, -0.3 - fp, 0, Math.PI * 2)
    ctx.fillStyle = '#6b8e6b'
    ctx.fill()

    ctx.restore()
  }
}
