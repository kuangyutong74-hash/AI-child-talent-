/**
 * 🐟 粒子系统引擎
 * 通用粒子发射器，用于气泡、珊瑚孢子、星光、电流粒子等
 *
 * 用法:
 *   const ps = new ParticleSystem(100)
 *   ps.emit(x, y, { count: 20, speed: 2, color: '#ff6b6b', size: 4 })
 *   // 每帧:
 *   ps.update()
 *   ps.draw(ctx)
 */

export class ParticleSystem {
  constructor(maxParticles = 80) {
    this.particles = []
    this.maxParticles = maxParticles
    this.autoEmit = null // { interval, timer }
  }

  /**
   * 发射粒子
   * @param {number} x - 中心x
   * @param {number} y - 中心y
   * @param {object} config
   * @param {number} config.count - 粒子数量
   * @param {number} config.speed - 扩散速度
   * @param {number} config.size - 粒子大小
   * @param {string|function} config.color - 颜色或返回颜色的函数
   * @param {number} config.life - 生命期（帧数）
   * @param {number} config.spread - 扩散角度（弧度）
   * @param {number} config.gravity - 重力（可选）
   * @param {boolean} config.fadeOut - 是否淡出
   * @param {boolean} config.glow - 是否发光
   */
  emit(x, y, config = {}) {
    const count = config.count || 1
    const speed = config.speed || 1
    const size = config.size || 3
    const life = config.life || 120
    const spread = config.spread || Math.PI * 2
    const gravity = config.gravity || 0
    const fadeOut = config.fadeOut !== false
    const glow = config.glow || false

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // 淘汰最旧的粒子
        this.particles.shift()
      }
      const angle = Math.random() * spread
      const v = speed * (0.5 + Math.random())
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - (gravity ? gravity * 0.1 : 0),
        size: size * (0.5 + Math.random()),
        life,
        maxLife: life,
        color: typeof config.color === 'function' ? config.color() : (config.color || '#ffffff'),
        fadeOut,
        glow,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
      })
    }
  }

  /**
   * 启动自动发射器
   */
  startAutoEmit(fn, intervalMs = 300) {
    this.stopAutoEmit()
    this.autoEmit = { timer: setInterval(fn, intervalMs) }
  }

  stopAutoEmit() {
    if (this.autoEmit?.timer) {
      clearInterval(this.autoEmit.timer)
      this.autoEmit = null
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.02 // 轻微下沉
      p.vx *= 0.99 // 阻力
      p.vy *= 0.99
      p.rotation += p.rotSpeed
      p.life--
      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }
  }

  draw(ctx, layerAlpha = 1) {
    for (const p of this.particles) {
      const alpha = p.fadeOut ? Math.min(1, p.life / p.maxLife * 2) : 1
      const scale = p.fadeOut ? 0.3 + 0.7 * (p.life / p.maxLife) : 1

      ctx.save()
      ctx.globalAlpha = alpha * layerAlpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.scale(scale, scale)

      if (p.glow) {
        ctx.shadowColor = p.color
        ctx.shadowBlur = 12
      }

      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(0, 0, p.size * scale, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  /** 获取当前粒子数 */
  get count() { return this.particles.length }

  /** 清空所有粒子 */
  clear() { this.particles = [] }

  /** 销毁（停止自动发射+清空） */
  destroy() {
    this.stopAutoEmit()
    this.clear()
  }
}
