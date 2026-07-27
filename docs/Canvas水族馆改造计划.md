# 🎨 全场景 Canvas 海底水族馆 — 详细改造计划

## 📐 架构设计

### 核心思路：Canvas 层叠架构

```
┌──────────────────────────────────────────────────────┐
│  Canvas 背景层（OceanBackground.vue）                  │
│  全屏固定，pointer-events: none                        │
│  ├── 鱼群游动（8-15条，正弦路径）                       │
│  ├── 气泡上升（持续生成）                               │
│  ├── 水下光柱（volumetric light rays）                  │
│  ├── 悬浮粒子（微生物/浮尘）                            │
│  └── 海草摇曳（底部，正弦弯曲）                          │
├──────────────────────────────────────────────────────┤
│  关卡特效 Canvas（LevelXEffects.vue）                   │
│  各关卡特有，覆盖在背景层之上                            │
│  ├── Level 1: 珊瑚粒子 + 配对成功光效                   │
│  ├── Level 2: 已存在 Pipe Canvas + 电光粒子             │
│  ├── Level 3: 和解光芒 + 对话情绪光环                   │
│  ├── 结束页: 已存在 Fireworks Canvas                    │
│  └── 开始页: 标题粒子吸引效果                           │
├──────────────────────────────────────────────────────┤
│  Vue DOM 层（现有组件，完全不改）                       │
│  所有按钮、卡片、拖拽交互保持原样                        │
└──────────────────────────────────────────────────────┘
```

### 关键原则
- **DOM 层不动** — 现有 Vue 组件一个不改，Canvas 只做视觉增强
- **背景 Canvas 跨关卡持久** — 切换关卡鱼群不中断，体验连续
- **关卡 Canvas 按需挂载** — 随 `<component>` 切换自动销毁/创建
- **GSAP 驱动** — 用 GSAP ticker 做渲染循环，精确控制动画时间线

---

## 📁 新增文件结构

```
src/
  components/
    canvas/                          ← 新建：Canvas 组件目录
      OceanBackground.vue            ← 通用海底背景（鱼群+气泡+光柱）
      OceanCreature.js               ← 海洋生物类（鱼、水母、海龟）
      ParticleSystem.js              ← 粒子系统引擎（气泡、浮尘）
      LightRays.js                   ← 水下光柱渲染
      Seaweed.js                     ← 海草动画
    effects/
      Level1Effects.vue              ← 第一关特效（珊瑚生长粒子）
      Level2Effects.vue              ← 第二关特效（电光闪烁）
      Level3Effects.vue              ← 第三关特效（和解光芒）
      StartEffects.vue               ← 开始页特效（标题吸引粒子）
```

---

## 📦 组件开发顺序（按优先级）

### 阶段一：基础引擎（2天）

#### 1.1 `OceanCreature.js` — 海洋生物类

```javascript
// 每帧更新鱼的位置，正弦游动
class Fish {
  constructor(canvasWidth, canvasHeight) {
    this.x = Math.random() * canvasWidth
    this.y = Math.random() * canvasHeight * 0.7
    this.size = 8 + Math.random() * 16
    this.speed = 0.3 + Math.random() * 0.6
    this.waveAmp = 0.5 + Math.random() * 1.5    // 摆动幅度
    this.waveFreq = 0.02 + Math.random() * 0.03  // 摆动频率
    this.phase = Math.random() * Math.PI * 2
    this.direction = Math.random() > 0.5 ? 1 : -1
    this.color = this.randomColor()
    this.tailPhase = 0  // 尾巴摆动
  }

  update() {
    this.x += this.speed * this.direction
    this.y += Math.sin(this.phase + this.x * this.waveFreq) * this.waveAmp
    this.tailPhase += 0.1

    // 边界回弹
    if (this.x > canvasWidth + 50) this.direction = -1
    if (this.x < -50) this.direction = 1
  }

  draw(ctx) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.scale(this.direction, 1)
    // 画鱼身（椭圆）
    // 画鱼尾（摆动）
    // 画眼睛
    ctx.restore()
  }
}

// 类似设计：Jellyfish（水母）、Turtle（海龟）、Bubble（气泡）
```

#### 1.2 `ParticleSystem.js` — 粒子系统

```javascript
class ParticleSystem {
  constructor(maxParticles = 60) {
    this.particles = []
    this.maxParticles = maxParticles
  }

  emit(x, y, config) {
    if (this.particles.length >= this.maxParticles) return
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * config.speed,
      vy: -Math.random() * config.speed,
      life: 1.0,
      decay: 0.005 + Math.random() * 0.015,
      size: config.size || 4,
      color: config.color || '#ffffff',
    })
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.life -= p.decay
      if (p.life <= 0) this.particles.splice(i, 1)
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}
```

#### 1.3 `OceanBackground.vue` — 通用海底背景 Canvas

这是**核心组件**，替换 App.vue 现有的 CSS 气泡。

```vue
<template>
  <canvas ref="canvasRef" class="fixed inset-0 w-full h-full pointer-events-none z-0"></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Fish, Jellyfish, Turtle } from './OceanCreature.js'
import { ParticleSystem } from './ParticleSystem.js'
import { LightRays } from './LightRays.js'
import { Seaweed } from './Seaweed.js'

const canvasRef = ref(null)
let creatures = []
let bubbles = null
let lightRays = null
let seaweeds = []
let animFrameId = null

function initScene(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width = window.innerWidth
  const h = canvas.height = window.innerHeight

  // 创建鱼群（数量随屏幕宽度）
  const fishCount = Math.min(15, Math.floor(w / 80))
  creatures = Array.from({ length: fishCount }, () => new Fish(w, h))

  // 创建水母（2-3只）
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    creatures.push(new Jellyfish(w, h))
  }

  // 气泡粒子系统
  bubbles = new ParticleSystem(40)
  setInterval(() => {
    bubbles.emit(
      Math.random() * w, h + 10,
      { speed: 1 + Math.random() * 2, size: 3 + Math.random() * 6, color: 'rgba(255,255,255,0.4)' }
    )
  }, 300)

  // 光柱
  lightRays = new LightRays(w, h)

  // 海草（底部）
  for (let i = 0; i < 5 + Math.floor(w / 150); i++) {
    seaweeds.push(new Seaweed(i * (w / 8), h, 80 + Math.random() * 60, i))
  }

  // 渐变底色
  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, '#0c4a6e')   // 深蓝海面
    gradient.addColorStop(0.3, '#0e7490')  // 中层
    gradient.addColorStop(0.7, '#155e75')  // 中下层
    gradient.addColorStop(1, '#1e3a5f')    // 深海底部
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
  }

  function animate() {
    drawBackground()
    lightRays.draw(ctx, Date.now())
    seaweeds.forEach(s => { s.update(); s.draw(ctx) })
    bubbles.update(); bubbles.draw(ctx)
    creatures.forEach(c => { c.update(w, h); c.draw(ctx) })
    animFrameId = requestAnimationFrame(animate)
  }

  animate()
  window.addEventListener('resize', onResize)
}

function onResize() { /* 重新计算尺寸 */ }

onMounted(() => { if (canvasRef.value) initScene(canvasRef.value) })
onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  window.removeEventListener('resize', onResize)
})
</script>
```

**在 App.vue 中使用：**

```diff
<template>
  <div class="...">
+   <OceanBackground />
    <!-- 现有气泡div可以删掉 -->
-   <div class="absolute inset-0 pointer-events-none overflow-hidden">...
```

---

### 阶段二：特效 Canvas（3天）

#### 2.1 `LightRays.js` — 水下光柱

```
效果：多根斜向光柱从水面射入，缓慢左右移动

算法：
  1. 生成 3-5 根光柱的参数（角度、宽度、透明度、速度）
  2. 每帧根据时间偏移光柱位置
  3. 用 createRadialGradient 或 fillRect + globalAlpha 绘制
  4. 叠加 blend mode = 'overlay' 或 'screen'
```

#### 2.2 `Seaweed.js` — 海草动画

```
效果：底部海草随"水流"左右摆动

算法：
  1. 贝塞尔曲线画海草茎（二次或三次）
  2. 控制点随时间做正弦偏移
  3. 每根海草不同相位、不同高度
```

#### 2.3 `Level1Effects.vue` — 第一关珊瑚特效

```
挂载位置：LevelOne.vue 内，和 DOM 同层级

效果：
  - 配对成功时：珊瑚生长粒子从配对位置爆发（橙色/粉色粒子）
  - 拖拽时：鼠标轨迹留下微生物光点
  - 持续：海底飘浮的珊瑚孢子

实现：
  用 ParticleSystem.emit() 在配对成功瞬间发射 30-50 个粒子
```

#### 2.4 `Level2Effects.vue` — 第二关电光特效

```
挂载位置：LevelTwo.vue 内

效果：
  - 管道连通判定时：电流从起点闪烁到终点（已有BFS管道逻辑）
  - 持续：管道微微发光脉冲
  - 障碍物周围：暗色漩涡粒子

电流线绘制算法：
  1. 获取 BFS 路径上的所有管道格子中心坐标
  2. 用 lineSegments 连接成路径
  3. 沿路径绘制闪烁白色/青色线条 + glow 阴影
  4. 用 dashOffset 动画模拟电流流动
```

#### 2.5 `Level3Effects.vue` — 第三关和解特效

```
效果：
  - 情绪识别正确：角色周围出现彩色光环
  - 和解度上升：暖色粒子从屏幕两侧向中心汇聚
  - 和解度 100%：全屏金色粒子雨
```

---

### 阶段三：现有 Canvas 改造（1天）

#### 3.1 EndingScreen.vue 的 Fireworks Canvas

当前已是 Canvas 实现，可以增强：
- 升级粒子颜色为金色/蓝色/粉色渐变
- 每个火箭爆炸后产生 60→120 粒子
- 增加拖尾 trail 效果
- 与 GSAP 结合，在勋章翻转时触发特殊烟花

#### 3.2 LevelTwo.vue 的 Pipe Canvas

当前管道用 DOM div 渲染（`grid` + `span` glyph），**不建议改为 Canvas**：
- 拖拽交互需要 DOM 事件
- 已有完整的 `onCellClick` 等逻辑
- 保持 DOM 管道层不动，特效用 Canvas 叠加

---

## 🎨 AI 绘图工具推荐

### 最佳推荐（按适用场景）

| 工具 | 类型 | 免费额度 | 最适合本项目 | 推荐指数 |
|------|------|---------|-------------|---------|
| **Midjourney v6** | 文生图 | 付费 ($10/月) | 角色原画 + 场景概念 | ⭐⭐⭐⭐⭐ |
| **DALL·E 3 (via ChatGPT)** | 文生图 | 付费 (按token) | 卡通海洋场景、角色设计 | ⭐⭐⭐⭐⭐ |
| **Leonardo.ai** | 文生图 | 免费150credits/天 | 游戏素材、道具图标 | ⭐⭐⭐⭐ |
| **Stable Diffusion 3.5** | 开源本地部署 | 完全免费 | 批量生成，可精调 | ⭐⭐⭐⭐ |
| **SeaArt (海艺AI)** | 文生图 | 每日免费 | 中文提示词优化好，卡通风 | ⭐⭐⭐⭐ |
| **通义万相 (Tongyi Wanxiang)** | 文生图 | 免费 | 中国风，卡通风格 | ⭐⭐⭐ |

### 推荐提示词模板

**角色设计（Midjourney/DALL·E 3）：**
```
A cute mechanical dolphin character, underwater robot, 
friendly face, blue and white color scheme, 
glowing cyan eyes, smooth metallic texture, 
cartoon style, Pixar-inspired, warm lighting, 
ocean background --ar 1:1 --v 6 --s 250
```

**场景背景：**
```
Underwater coral reef scene, sun rays coming through water surface, 
colorful corals, fish swimming, gentle particle effects, 
cartoon style, vibrant colors, game background art, 
16:9 aspect ratio, volumetric lighting --ar 16:9 --v 6
```

**各关卡专属素材生成提示：**

| 用途 | 提示词关键词 |
|------|------------|
| 第一关·珊瑚公寓背景 | `colorful coral reef apartment, cartoon, warm light, anemones, sea fans` |
| 第二关·电网背景 | `underwater pipeline grid, bioluminescent cables, dark blue, electric glow` |
| 第三关·议事厅背景 | `underwater meeting room, coral amphitheater, warm light from above, peaceful` |
| 沫沫（海豚AI） | `cute mechanical dolphin, glowing blue eyes, friendly robot, Pixar style` |
| 壳壳（寄居蟹） | `shy hermit crab, expressive eyes, cartoon, detailed shell house` |
| 彩彩（鹦嘴鱼） | `vibrant parrotfish, colorful scales, energetic pose, cartoon style` |

### SVG 转换建议

AI 生成的图 → 用下面工具转 SVG（方便 Vue 组件内联使用）：
- **[Vectorizer.ai](https://vectorizer.ai)** — 免费转矢量图
- **[SVG Trace](https://svgtrace.com)** — 在线位图转 SVG
- **Adobe Illustrator「图像描摹」** — 最精确

---

## 🛠️ 实施路线图

```
阶段一：底层引擎
┌────────────────────────────────────────────────────────────┐
│ Day 1 │  ParticleSystem.js + OceanCreature.js 基础类       │
│       │  测试 Canvas 渲染循环                              │
├────────────────────────────────────────────────────────────┤
│ Day 2 │  OceanBackground.vue 完整背景 Canvas               │
│       │  集成到 App.vue，替换现有 CSS 气泡                 │
│       │  按关卡切换背景色调                                │
├────────────────────────────────────────────────────────────┤
│ Day 3 │  LightRays.js（光柱）+ Seaweed.js（海草）          │
│       │  调试各层混合效果                                  │
└────────────────────────────────────────────────────────────┘

阶段二：关卡特效
┌────────────────────────────────────────────────────────────┐
│ Day 4 │  Level1Effects.vue（珊瑚粒子 + 配对成功光效）      │
│       │  StartEffects.vue（标题吸引粒子）                  │
├────────────────────────────────────────────────────────────┤
│ Day 5 │  Level2Effects.vue（电光闪烁 + 电流动画）          │
│       │  与 Pipe Canvas overlay 结合                       │
├────────────────────────────────────────────────────────────┤
│ Day 6 │  Level3Effects.vue（和解光芒 + 情绪光环）          │
│       │  EndingScreen Fireworks 升级                       │
└────────────────────────────────────────────────────────────┘

阶段三：素材替换（与阶段一/二并行）
┌────────────────────────────────────────────────────────────┐
│ Day 7 │  AI 生成角色 SVG + 场景背景图                      │
│       │  emoji → SVG 内联组件替换                         │
├────────────────────────────────────────────────────────────┤
│ Day 8 │  GSAP 过渡动画绑定                                 │
│       │  关卡切换时 Canvas 和 DOM 同步动画                  │
│       │  全部整合、性能优化                                │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 需要修改的组件清单

| 组件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `App.vue` | 修改 | 删除 CSS 气泡 div，引入 `<OceanBackground />` |
| `style.css` | 修改 | 调整背景为透明以透出 Canvas |
| `LevelOne.vue` | 新增引用 | 引入 `<Level1Effects />`，配对成功时 emit 特效触发 |
| `LevelTwo.vue` | 新增引用 | 引入 `<Level2Effects />`，连通时触发电流动画 |
| `LevelThree.vue` | 新增引用 | 引入 `<Level3Effects />`，和解度变化触发粒子 |
| `StartScreen.vue` | 新增引用 | 引入 `<StartEffects />` |
| `EndingScreen.vue` | 增强 | 升级 Fireworks Canvas 粒子系统 |

**新增 8 个文件，修改 7 个文件，总计约 1500 行代码**

---

## 🚦 是否开始阶段一？

如果你确认，我建议从**阶段一的第 1-2 天**开始——先做 `OceanBackground.vue` 通用背景 Canvas，完成后所有关卡立刻看到海底鱼群游动。这是投入产出比最高的一步，之后各关卡特效用同样的粒子引擎扩展即可。

要开始吗？
