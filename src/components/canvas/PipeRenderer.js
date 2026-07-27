/**
 * 第二关管道 Canvas 渲染器
 *
 * 管壁和电流共用同一组 Path2D 几何数据，保证直管、弯管、T 型管的
 * 高光与电流始终贴合，不再出现电流斜穿弯管的情况。
 */

const PIPE_COLORS = {
  shell: '#111827',
  rim: '#475569',
  inner: '#172033',
  highlight: '#e2e8f0',
  powered: '#67e8f9',
}

const BASE_PORTS = {
  '─': ['left', 'right'],
  '┌': ['right', 'bottom'],
  '┐': ['left', 'bottom'],
  '└': ['top', 'right'],
  '┘': ['left', 'top'],
  '┬': ['left', 'right', 'bottom'],
}

const ROTATE_CW = { top: 'right', right: 'bottom', bottom: 'left', left: 'top' }

export function getPipePorts(def, rot = 0) {
  let ports = [...(BASE_PORTS[def] || [])]
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) {
    ports = ports.map(port => ROTATE_CW[port])
  }
  return ports
}

function pointForPort(port, radius) {
  if (port === 'top') return [0, -radius]
  if (port === 'right') return [radius, 0]
  if (port === 'bottom') return [0, radius]
  return [-radius, 0]
}

/**
 * 创建管道中心线。每个端口都通过中心节点连接；弯管使用二次贝塞尔曲线。
 */
export function createPipePath(def, rot, size) {
  const ports = getPipePorts(def, rot)
  const radius = size / 2 + 1
  const path = new Path2D()

  if (ports.length === 2) {
    const [a, b] = ports.map(port => pointForPort(port, radius))
    const opposite = a[0] === -b[0] && a[1] === -b[1]
    path.moveTo(a[0], a[1])
    if (opposite) {
      path.lineTo(b[0], b[1])
    } else {
      // 控制点在格子中心，形成圆润且贴合接头的 90° 弯管。
      path.quadraticCurveTo(0, 0, b[0], b[1])
    }
  } else {
    // T 型管分支共用中心节点。
    for (const port of ports) {
      const [px, py] = pointForPort(port, radius)
      path.moveTo(0, 0)
      path.lineTo(px, py)
    }
  }

  return path
}

function strokeLayer(ctx, path, color, width, blur = 0, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.stroke(path)
  ctx.restore()
}

function metalGradient(ctx, size, powered) {
  const gradient = ctx.createLinearGradient(0, -size / 2, 0, size / 2)
  gradient.addColorStop(0, '#111827')
  gradient.addColorStop(0.18, '#64748b')
  gradient.addColorStop(0.36, powered ? '#a5f3fc' : '#cbd5e1')
  gradient.addColorStop(0.52, powered ? '#0e7490' : '#64748b')
  gradient.addColorStop(0.78, '#334155')
  gradient.addColorStop(1, '#0f172a')
  return gradient
}

function drawConnector(ctx, port, radius, powered) {
  const [px, py] = pointForPort(port, radius - 4)
  const angle = port === 'top' || port === 'bottom' ? Math.PI / 2 : 0
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(angle)
  const collar = ctx.createLinearGradient(0, -10, 0, 10)
  collar.addColorStop(0, '#0f172a')
  collar.addColorStop(0.3, '#94a3b8')
  collar.addColorStop(0.5, powered ? '#cffafe' : '#e2e8f0')
  collar.addColorStop(0.72, '#475569')
  collar.addColorStop(1, '#111827')
  ctx.fillStyle = collar
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(-5, -12, 10, 24, 2)
  ctx.fill()
  ctx.stroke()
  for (const y of [-7, 7]) {
    ctx.beginPath()
    ctx.arc(0, y, 1.6, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-0.5, y - 0.5, 0.65, 0, Math.PI * 2)
    ctx.fillStyle = '#f8fafc'
    ctx.fill()
  }
  ctx.restore()
}

/**
 * 绘制具有外壳、金属边缘、暗色内腔和玻璃高光的管道。
 */
export function drawPipe(ctx, x, y, def, rot, size = 56, powered = false) {
  ctx.save()
  ctx.translate(x, y)
  const path = createPipePath(def, rot, size)

  if (powered) strokeLayer(ctx, path, PIPE_COLORS.powered, 24, 20, 0.42)
  strokeLayer(ctx, path, PIPE_COLORS.shell, 23, 7)
  strokeLayer(ctx, path, PIPE_COLORS.rim, 19)
  strokeLayer(ctx, path, metalGradient(ctx, size, powered), 15)
  strokeLayer(ctx, path, PIPE_COLORS.inner, 7)
  strokeLayer(ctx, path, powered ? '#cffafe' : PIPE_COLORS.highlight, 2.2, powered ? 9 : 0, powered ? 0.95 : 0.55)

  const ports = getPipePorts(def, rot)
  for (const port of ports) drawConnector(ctx, port, size / 2, powered)

  if (ports.length === 3) {
    ctx.beginPath()
    ctx.arc(0, 0, 13, 0, Math.PI * 2)
    ctx.fillStyle = PIPE_COLORS.shell
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, 9, 0, Math.PI * 2)
    ctx.fillStyle = metalGradient(ctx, 24, powered)
    ctx.fill()
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 3
      ctx.beginPath()
      ctx.arc(Math.cos(angle) * 7, Math.sin(angle) * 7, 1.4, 0, Math.PI * 2)
      ctx.fillStyle = '#0f172a'
      ctx.fill()
    }
  }

  ctx.restore()
}

/**
 * 沿与管道完全相同的中心线绘制流动电荷。
 */
export function drawPipeCurrent(ctx, x, y, def, rot, size, phase, intensity = 1) {
  ctx.save()
  ctx.translate(x, y)
  const path = createPipePath(def, rot, size)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([2, 10])
  ctx.lineDashOffset = -phase
  ctx.strokeStyle = `rgba(255,255,255,${0.75 * intensity})`
  ctx.lineWidth = 4
  ctx.shadowColor = '#67e8f9'
  ctx.shadowBlur = 14
  ctx.stroke(path)

  ctx.setLineDash([1, 11])
  ctx.lineDashOffset = -phase - 5
  ctx.strokeStyle = `rgba(34,211,238,${0.9 * intensity})`
  ctx.lineWidth = 2
  ctx.shadowBlur = 8
  ctx.stroke(path)
  ctx.restore()
}

export function drawAllPipes(ctx, grid, rows, cols, cellSize, gap, offsetX, offsetY, powered) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r]?.[c]
      if (!cell?.pipe) continue
      const x = offsetX + c * (cellSize + gap) + cellSize / 2
      const y = offsetY + r * (cellSize + gap) + cellSize / 2
      drawPipe(ctx, x, y, cell.pipe.def, cell.pipe.rot, cellSize, powered)
    }
  }
}
