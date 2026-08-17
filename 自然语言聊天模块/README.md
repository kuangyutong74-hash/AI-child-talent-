# AI 伯乐 · 自然语言聊天项目

基于 DeepSeek 大语言模型的儿童自然语言聊天应用。孩子与 AI 伙伴"小新"自由对话，对话结束后系统自动生成**潜能画像分析**（写入对话历史，可在历史对话页查看）。

**单机本地版**：无账号体系、无登录/注册、无教师端。所有数据保存在本地 `data/` 目录，单用户（guest）直接使用。

---

## 环境要求

| 依赖 | 最低版本 | 说明 |
|---|---|---|
| Node.js | ≥ 18.x | 推荐 20 LTS 或更高 |
| npm | ≥ 9.x | 随 Node.js 自带 |

**外部服务依赖：**

- [DeepSeek API](https://platform.deepseek.com/) — 提供 AI 对话和推理能力，需要注册并充值

---

## 安装步骤

```bash
# 1. 进入项目目录
cd 自然语言聊天模块

# 2. 安装依赖
npm install

# 3. 初始化数据目录（从模板创建可写的 data/ 目录）
npm run init-data

# 4. （可选，语音输入功能需要）下载离线语音识别模型，约 44MB
npm run fetch-vosk-model
```

---

## 环境变量说明

复制 `.env.example` 为 `.env`，按需修改：

```bash
cp .env.example .env
```

### 必填项

| 变量 | 说明 | 示例 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥。前往 [platform.deepseek.com](https://platform.deepseek.com) → API Keys 创建 | `sk-xxxxxxxxxxxxxxxx` |

### 模型配置（选填）

项目采用**双模型分离策略**：
- **ANALYZE 模型**：用于对话结束后的潜能画像分析，准确率优先
- **REPLY 模型**：用于日常聊天回复、话题建议和回复修正，延迟优先

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | 基础模型，ANALYZE/REPLY 未单独配置时均回退到此 |
| `DEEPSEEK_MODEL_ANALYZE` | `deepseek-v4-pro` | 分析专用模型（推理能力强） |
| `DEEPSEEK_MODEL_REPLY` | `deepseek-v4-flash` | 回复专用模型（延迟优先，快速模型） |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | API 地址，使用默认即可 |

> ⚠️ **模型注意**：`DEEPSEEK_MODEL_REPLY` 请勿使用推理模型（如 `deepseek-v4-pro`）——聊天回复、话题建议、今日小发现等调用的小 token 预算会被 reasoning 消耗殆尽，导致回复为空。

### 部署与安全（选填）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务端口（1–65535） |
| `NODE_ENV` | `development` | 运行环境：`development` 或 `production` |
| `DATA_DIR` | `./data` | 数据存储目录（相对路径基于项目根目录） |
| `TRUST_PROXY` | `false` | 反向代理信任级别，可选 `1`/`2`/`3`/`loopback`/`linklocal`/`uniquelocal`。禁止设为 `true` |

> ⚠️ **安全注意**：`.env` 含 API 密钥、`data/` 含对话数据，均已被 `.gitignore` 忽略。
> **切勿将 `.env` 或 `data/` 中的文件上传到公开仓库**。

---

## 数据目录与初始化

`data.example/` 是安全空种子模板（不含任何真实用户数据、密码、token 或聊天内容），`data/` 是运行时数据目录：

- `npm run init-data` 会验证并安全复制模板到 `data/`，**不会覆盖已有文件**，可安全重复运行；手动方式为 `cp -r data.example/* data/`
- 初始化后 `data/` 共 5 个文件：`history.json`、`journal.json`、`chat-log.jsonl`、`tips.json`、`tip-favorites.json`
- 无账号体系：所有数据均归属单机 guest 用户
- 不要把生产数据复制回 `data.example/`；部署时建议用 `DATA_DIR` 环境变量指定独立持久化目录

---

## 启动命令

```bash
# 开发环境（默认端口 3000）
npm start

# 自定义端口
PORT=8080 npm start

# 生产环境
NODE_ENV=production npm start
```

启动成功后终端输出：

```
Server is running on http://localhost:3000
```

用浏览器打开 `http://localhost:3000` 即可进入首页（`/` 自动跳转到 `/home.html`）。

---

## 验证部署成功的检查清单

按顺序逐项验证，确保所有核心功能可用：

### 1. 首页能正常打开

打开 `http://localhost:3000`，应看到：
- 🐻 吉祥物"小新"（渐变色的熊形 SVG）
- 问候语「嗨，我是小新呀！」
- 「和小新聊聊天」按钮，以及历史对话 / 手账本 / 收藏夹三个功能卡片
- 首次使用时自动弹出**新手引导**（完成后标记保存在浏览器 localStorage，之后不再自动弹出；右上角"引导"按钮可随时重看）

### 2. 跑一轮对话确认 AI 回复正常

1. 点击「和小新聊聊天」进入聊天页
2. 输入「你好小新！」，点击发送
3. 等待几秒，应收到小新的文字回复（说明 DeepSeek API 连通正常）
4. 继续聊 2-3 轮，确认多轮对话稳定；回复后会给出建议话题

### 3. 对话结束自动生成潜能画像

1. 聊天页点击「结束聊天」进入结束页
2. 稍等片刻后打开「历史对话」页，刚才的对话应显示**潜能画像**分析结果
3. 分析为异步生成：若 API 暂时不可用，画像标记为失败，不影响对话数据本身

### 4. 「小新的今日小发现」— AI 实时生成内容

1. 在首页往下滚动，应看到「小新的今日小发现」区域
2. 区域内有 **3 张卡片**，分别对应三个固定类别：
   - 🟢 自然科普（绿色标签）— 有趣的动植物、自然现象知识
   - 🔴 情绪小贴士（红色标签）— 帮助孩子理解和调节情绪的实用方法
   - 🟣 安全知识（紫色标签）— 日常生活中的安全小常识
3. 卡片内容由 DeepSeek 实时生成，每次刷新都可能不同
4. 左右两侧各有箭头按钮（`‹` `›`），点击可**换一批**新内容
5. 每张卡片右上角有爱心 `♡`，点击变红 `❤` 表示收藏该发现，再次点击取消收藏
6. 如果 API 暂时不可用，会显示内置备用卡片（蚂蚁认路 / 深呼吸放松 / 过马路安全等），功能不受影响

### 5. 聊天历史持久化

1. 刷新页面（F5），之前的聊天内容应仍然存在
2. 点击首页「历史对话」卡片，应能看到刚才的对话记录

### 6. 语音输入（离线识别）

1. 打开聊天页，点击输入框旁的麦克风按钮 🎤
2. **初次点击会弹窗询问「允许使用麦克风吗？」**：点「允许」后直接开始语音输入，同意结果会记住，**以后点击直接语音输入、不再弹窗**；点「暂时不了」则本次不使用，下次点击会重新询问
3. 若浏览器也弹出权限请求，请同样点「允许」；若浏览器层面被阻止，弹窗会给出逐步修复指引
4. 首次识别会提示「正在准备语音包…」（本地解压 ~44MB 模型，约 5 秒；之后从浏览器缓存秒开）
5. 说话时输入框实时显示识别文字；说完停顿约 6 秒自动结束（也可直接点麦克风按钮结束）
6. 识别全程在**本机离线运行**（Vosk + WASM），不依赖任何云端语音服务——在国内网络环境下依然可用

### 7. npm test 快速验证

```bash
npm test
```

24 个测试文件全部运行，应全绿通过。

---

## 项目结构

```
自然语言聊天模块/
├── app.js                   # Express 服务入口（聊天 + 分析 + 数据 API）
├── package.json
├── .env.example             # 环境变量模板
├── .gitignore
├── public/                  # 前端静态页面
│   ├── home.html            # 首页（聊天入口 + 每日小发现 + 新手引导）
│   ├── chat.html            # 聊天对话页
│   ├── chat-end.html        # 聊天结束总结
│   ├── history.html         # 历史对话（含潜能画像）
│   ├── journal.html         # 小新的手账本
│   ├── favorites.html       # 收藏夹
│   ├── icons-sprite.html    # SVG 图标合集
│   ├── css/                 # 样式
│   ├── js/                  # JS 脚本（新手引导、拼音等）
│   └── assets/              # 图片/图标资源
│       └── vosk/            # 离线语音识别（vosk.js 入库；模型 zip 不入库，npm run fetch-vosk-model 下载）
├── lib/                     # 后端模块（纯函数）
│   ├── core/                # AI 核心引擎（11 个文件：V2 对话管线、校验、潜能画像计算等）
│   └── infra/               # 基础设施（4 个文件：环境配置、数据目录、安全头等）
├── prompts/                 # AI Prompt 模板（4 个 .md）
├── data.example/            # 数据模板（5 个种子文件）
├── scripts/                 # 运维脚本
│   ├── init-data.js         # 初始化 data/ 目录
│   └── reanalyze-all.js     # 重新分析所有历史对话
└── test/                    # 测试用例（24 个文件）
```

---

## 运维命令

```bash
# 初始化数据目录（首次部署或重置数据）
npm run init-data

# 下载离线语音识别模型（语音输入功能依赖，约 44MB，已存在则跳过）
npm run fetch-vosk-model

# 重新分析所有历史对话（Prompt 更新后批量刷新画像）
node scripts/reanalyze-all.js
```

---

## 架构说明

### 无账号体系

- 所有请求以 `guest` 身份处理，无注册、登录、会话 Cookie
- 数据文件：`history.json`（对话历史 + 潜能画像）、`journal.json`（手账本）、`chat-log.jsonl`（聊天日志）、`tips.json` / `tip-favorites.json`（小发现与收藏）

### 对话管线（V2 恒启用）

每轮对话执行 `analyze → generate → validate → repair → fallback`：

1. **analyze**：用 `analyze-v2.md` 提示词分析学生状态（阶段、情绪、关注点、已知事实）——每轮状态分析用 REPLY（flash）快速模型（低延迟），对话结束后的潜能画像仍用 ANALYZE（pro）推理模型（准确率优先）
2. **generate**：用 `xiaoxin-v2.md` 提示词生成回复（阶段化提问预算，token 预算 600 以压缩推理时间）
3. **validate**：确定性校验器（`lib/core/response-validator.js`）检查回复——问题数量是否超出/不足、二选一追问、重复已知事实等
4. **repair**：校验失败时用 `repair.md` 提示词修正一次
5. **fallback**：修正仍失败时使用确定性兜底回复

话题建议不阻塞回复：前端收到回复后异步调用 `/api/quick-topics` 单独拉取。

### 语音输入（离线 Vosk）

- **为什么不用浏览器自带语音识别**：Web Speech API 依赖 Google 云端服务，在国内网络环境不可达，必然失败
- **方案**：vosk-browser（WASM）+ vosk 官方中文小模型（`vosk-model-small-cn-0.22`），全部本地化在 `public/assets/vosk/`，识别全程离线
- **权限流程**：初次点击麦克风 → 应用内弹窗询问「允许使用麦克风吗？」→ 点「允许」记入 localStorage → 本次及后续点击直接语音输入；浏览器层权限已被拒绝时弹窗切换为修复指引
- **流程**：首次点击麦克风懒加载模型（解压后缓存进浏览器 IndexedDB，之后秒开）→ 麦克风 16kHz 采样 → `acceptWaveform` 实时识别 → 部分结果实时回填输入框 → 停顿 6 秒或手动点按钮结束
- **回退**：模型未下载或 vosk 加载失败时回退系统语音识别（国内环境会提示云端连接失败——请先 `npm run fetch-vosk-model`）
- **注意**：创建识别器必须显式传 16000 采样率（`new KaldiRecognizer(16000)`），否则底层会以 NaN 采样率初始化导致识别失败

### 超时兜底

所有 AI 调用带硬超时（`lib/core/ai-provider-client.js`）：定时器覆盖「fetch + body 读取」全程并用 `Promise.race` 强制截断——部分环境下 abort 信号无法中断已开始的 body 读取，仅靠 AbortController 超时会失效。每轮 analyze 6s 封顶：6s 内完成的用上，超时则降级 `analysis=null` 继续本轮（不影响回复）；generate 25s、repair 15s 兜底。

### 潜能画像（对话结束自动生成）

对话结束后异步执行：提取对话事件 → 生成画像（`lib/core/rubric-computer.js` 潜能指标计算）→ 写入 `history[].analysis`，前端历史页展示。

---

## 已知限制

### 1. 平台集成功能已移除

这是从更大平台剥离出的独立版本，以下功能不在本项目中：
- 登录/注册/教师端（账号体系、学生绑定、报告审阅）
- iframe 嵌入模式（父页面通信、高度自适应）
- SSO 单点登录（第三方 Cookie、共享会话）
- 跨域 Cookie / CORS 平台级中间件

本版本仅用于**模块本身的功能验收**，不涉及与外部平台的对接。

### 2. 无内置 HTTPS 支持

本项目不内置 HTTPS。如需生产环境安全部署，建议在前面挂一层反向代理（Nginx / Caddy）处理 TLS 终止，并设置 `NODE_ENV=production` 和 `TRUST_PROXY=1`。

---

## 技术栈

- **后端**：Node.js + Express
- **AI**：DeepSeek API（双模型策略：ANALYZE + REPLY）
- **前端**：原生 HTML / CSS / JavaScript（无框架）
- **数据**：JSON 文件持久化（`data/` 目录）
- **测试**：Node.js 内置 test runner (`node:test`)
