/**
 * 🌿 海草动画
 * 贝塞尔曲线绘制，随风/水流摆动
 *
 * 每根海草由 3 个控制点的二次贝塞尔曲线构成
 * 控制点随时间做正弦偏移模拟水流摆动
 */

export class Seaweed {
  /**
   * @param {number} x - 底部x位置
   * @param {number} baseY - 底部y位置（海底）
   * @param {number} height - 海草高度
   * @param {number} index - 序号（用于差异化）
   */
  constructor(x, baseY, height, index = 0) {
    this.x = x
    this.baseY = baseY
    this.height = height
    this.index = index
    this.segments = 3 + Math.floor(Math.random() * 2)

    // 每根海草有 2-4 片叶子
    this.leaves = []
    const leafCount = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < leafCount; i++) {
      this.leaves.push({
        pos: 0.3 + Math.random() * 0.5,
        side: Math.random() > 0.5 ? 1 : -1,
        size: 4 + Math.random() * 8,
      })
    }

    // 随机颜色（绿色系）
    const greens = [
      ['#2d7d3a', '#4a9e5a'],
      ['#1a6b2a', '#3d8a4a'],
      ['#3d8a4a', '#5aad6b'],
      ['#2d6b3a', '#4a9e5a'],
    ]
    this.colors = greens[Math.floor(Math.random() * greens.length)]
    this.phase = Math.random() * Math.PI * 2
    this.windPhase = Math.random() * Math.PI * 2
    this.windSpeed = 0.002 + Math.random() * 0.003
    this.swayAmp = 15 + Math.random() * 20
    this.curvature = (Math.random() - 0.5) * 0.5
  }

  update(time) {
    // windPhase 随时间变化
    this.windPhase += this.windSpeed
  }

  draw(ctx, alpha = 1) {
    ctx.save()
    ctx.globalAlpha = 0.7 * alpha

    const h = this.height
    const sway = Math.sin(this.windPhase) * this.swayAmp
    const curve = this.curvature * h * 0.3

    // 使用二次贝塞尔画海草茎
    // 底部固定在 (this.x, this.baseY)
    // 顶部随水流摆动
    const topX = this.x + sway
    const topY = this.baseY - h

    // 多段贝塞尔让海草更自然弯曲
    ctx.beginPath()
    ctx.moveTo(this.x, this.baseY)

    const steps = this.segments
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps
      const y = this.baseY - h * t
      const swayFactor = Math.sin(this.windPhase * (1 + t) + t * 0.5) * this.swayAmp * t * 0.8
      const x = this.x + swayFactor + curve * t * (1 - t) * 2

      const cpY = y + h / steps * 0.5
      const cpX = x + (sway * t * 0.3)

      ctx.quadraticCurveTo(cpX, cpY, x, y)
    }

    ctx.strokeStyle = this.colors[0]
    ctx.lineWidth = 3 + Math.random() * 0.5
    ctx.lineCap = 'round'
    ctx.stroke()

    // 画叶子
    for (const leaf of this.leaves) {
      const ly = this.baseY - h * leaf.pos
      const lx = this.x +
        Math.sin(this.windPhase * (1 + leaf.pos) + leaf.pos * 0.5) *
        this.swayAmp * leaf.pos * 0.8

      ctx.beginPath()
      ctx.ellipse(
        lx + leaf.side * leaf.size * 0.8,
        ly - leaf.size * 0.3,
        leaf.size * 0.6,
        leaf.size * 0.3,
        leaf.side * 0.4 + Math.sin(this.windPhase + leaf.pos) * 0.1,
        0, Math.PI * 2
      )
      ctx.fillStyle = this.colors[1]
      ctx.fill()
    }

    ctx.globalAlpha = 1
    ctx.restore()
  }
}
