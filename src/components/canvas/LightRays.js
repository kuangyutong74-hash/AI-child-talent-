/**
 * ☀️ 水下光柱（Volumetric Light Rays）
 * 模拟阳光穿透水面的丁达尔效应
 *
 * 渲染方式:
 *   - 多根梯形光柱从顶部射入
 *   - 每根光柱有独立的角度、宽度、透明度
 *   - 随时间缓慢左右摆动
 *   - 用 gradient + globalCompositeOperation 实现柔和效果
 */

export class LightRays {
  constructor(w, h) {
    this.rays = []
    this.init(w, h)
  }

  init(w, h) {
    this.w = w
    this.h = h
    const count = 2 + Math.floor(Math.random() * 3)
    this.rays = Array.from({ length: count }, () => ({
      x: Math.random() * w * 0.3 + w * 0.1,
      width: 30 + Math.random() * 80,
      angle: (Math.random() - 0.5) * 0.4,  // -0.2 ~ 0.2 rad
      speed: 0.1 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.04 + Math.random() * 0.08,
      length: h * (0.5 + Math.random() * 0.4),
    }))
  }

  draw(ctx, time, intensity = 1) {
    ctx.save()
    const w = this.w
    const h = this.h

    for (const ray of this.rays) {
      const sway = Math.sin(time * 0.0003 + ray.phase) * 30
      const x = ray.x + sway
      const alpha = ray.alpha + Math.sin(time * 0.0005 + ray.phase * 1.3) * 0.02

      ctx.globalAlpha = Math.max(0, alpha) * intensity
      ctx.beginPath()
      ctx.moveTo(x - ray.width / 2, 0)
      ctx.lineTo(x + ray.width / 2, 0)
      ctx.lineTo(x + ray.width / 2 + Math.tan(ray.angle) * ray.length, ray.length)
      ctx.lineTo(x - ray.width / 2 + Math.tan(ray.angle) * ray.length, ray.length)
      ctx.closePath()

      const grad = ctx.createLinearGradient(0, 0, 0, ray.length)
      grad.addColorStop(0, 'rgba(255,255,230,0.15)')
      grad.addColorStop(0.3, 'rgba(200,240,255,0.08)')
      grad.addColorStop(0.7, 'rgba(150,220,255,0.03)')
      grad.addColorStop(1, 'rgba(100,200,255,0)')
      ctx.fillStyle = grad

      // 使用 screen 混合让光柱更亮
      ctx.globalCompositeOperation = 'screen'
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }

    ctx.globalAlpha = 1
    ctx.restore()
  }

  resize(w, h) {
    this.init(w, h)
  }
}
