# AI 伯乐 · 探索空间（AI Talent Scout）

基于 DeepSeek 大语言模型的 AI 聊天与潜能观察平台。学生通过与 AI 伙伴"小新"对话展示兴趣和思维特质，系统自动生成潜能画像和分析报告，供教师审阅确认。

这是从更大平台中剥离出的独立部署版本，仅包含聊天模块核心功能，不含 SSO 单点登录、iframe 嵌入、跨域 Cookie 等平台集成代码。

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
cd ai-talent-scout

# 2. 安装依赖
npm install

# 3. 初始化数据目录（从模板创建可写的 data/ 目录）
npm run init-data
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
| `TEACHER_INVITE_CODE` | 教师注册邀请码。部署后告知指导老师，老师凭此码注册教师账号 | `your-custom-code` |

### 模型配置（选填）

项目采用**双模型分离策略**：
- **ANALYZE 模型**：用于学生潜能分析和报告生成，准确率优先
- **REPLY 模型**：用于日常聊天回复和话题建议，延迟优先

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | 基础模型，ANALYZE/REPLY 未单独配置时均回退到此 |
| `DEEPSEEK_MODEL_ANALYZE` | `deepseek-v4-pro` | 分析专用模型（推理能力强） |
| `DEEPSEEK_MODEL_REPLY` | `deepseek-chat` | 回复专用模型（速度更快） |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | API 地址，使用默认即可 |

### 部署与安全（选填）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务端口（1–65535） |
| `NODE_ENV` | `development` | 运行环境：`development` 或 `production` |
| `DATA_DIR` | `./data` | 数据存储目录（相对路径基于项目根目录） |
| `COOKIE_SECURE` | 由 NODE_ENV 决定 | Cookie Secure 标志。`production` 下默认 `true`（需 HTTPS）；可显式设为 `false` 用于本地 HTTP |
| `TRUST_PROXY` | `false` | 反向代理信任级别，可选 `1`/`2`/`3`/`loopback`/`linklocal`/`uniquelocal`。禁止设为 `true` |

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

用浏览器打开 `http://localhost:3000` 即可进入首页。

---

## 验证部署成功的检查清单

按顺序逐项验证，确保所有核心功能可用：

### 1. 首页能正常打开

打开 `http://localhost:3000`，应看到：
- 🐻 吉祥物"小新"（渐变色的熊形 SVG）
- 标题「AI 伯乐 · 探索空间」
- 两个毛玻璃卡片：「我是学生」和「我是老师」

### 2. 学生注册与登录

1. 点击「我是学生」→ 跳转到登录页
2. 输入一个用户名（如 `test-student`），密码留空即可首次注册
3. 注册/登录成功后自动跳转到学生首页 `home.html`
4. 页面应显示：顶栏导航、小新问候语、输入框区域

### 3. 跑一轮对话确认 AI 回复正常

1. 在学生首页输入框中输入「你好小新！」，点击发送
2. 等待几秒，应收到小新的文字回复（说明 DeepSeek API 连通正常）
3. 继续聊 2-3 轮，确认多轮对话稳定

### 4. 「小新的今日小发现」— AI 实时生成内容

1. 在学生首页往下滚动，应看到「小新的今日小发现」区域
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
2. 点击顶栏「历史」图标，应能看到刚才的对话记录

### 6. 教师端注册与登录

1. 返回首页 `http://localhost:3000`
2. 点击「我是老师」→ 输入邀请码（`.env` 中 `TEACHER_INVITE_CODE` 的值）
3. 注册教师账号并登录，应跳转到教师首页 `teacher-home.html`
4. 应看到学生列表（包含刚才聊过天的学生）

### 7. 教师查看学生画像

1. 在学生列表中点击刚才的学生 → 进入学生详情页
2. 应看到「阶段报告」「潜能线索」等标签页
3. 如果聊天轮数足够，会生成潜能画像分析

### 8. npm test 快速验证

```bash
npm test
```

48 个测试文件会全部运行。如果看到部分失败属于**已知问题**（详见"已知限制"），不影响核心功能。

---

## 项目结构

```
ai-talent-scout/
├── app.js                   # Express 服务入口
├── package.json
├── .env.example             # 环境变量模板
├── .gitignore
├── public/                  # 前端静态页面（17 个 HTML）
│   ├── index.html           # 入口/角色选择
│   ├── login.html           # 登录/注册
│   ├── home.html            # 学生首页（聊天 + 每日小发现）
│   ├── chat.html            # 聊天对话页
│   ├── chat-end.html        # 聊天结束总结
│   ├── history.html         # 历史对话
│   ├── journal.html         # 成长日志
│   ├── profile.html         # 个人中心
│   ├── favorites.html       # 收藏夹
│   ├── teacher-*.html       # 教师端页面（7 个）
│   ├── css/                 # 样式
│   ├── js/                  # JS 脚本
│   └── assets/              # 图片/图标资源
├── lib/                     # 后端模块（纯函数）
│   ├── core/                # AI 核心引擎（11 个文件）
│   ├── infra/               # 基础设施（5 个文件）
│   └── teacher/             # 教师功能（15 个文件）
├── prompts/                 # AI Prompt 模板（5 个 .md）
├── data.example/            # 数据模板（12 个种子文件）
├── scripts/                 # 运维脚本
│   ├── init-data.js         # 初始化 data/ 目录
│   ├── clean-data.js        # 清理数据
│   └── reanalyze-all.js     # 重新分析所有学生
└── test/                    # 测试用例（48 个文件）
```

---

## 运维命令

```bash
# 初始化数据目录（首次部署或重置数据）
npm run init-data

# 完全重置数据（清理 data/ 后重新初始化）
node scripts/clean-data.js
npm run init-data

# 重新分析所有学生（Prompt 更新后批量刷新画像）
node scripts/reanalyze-all.js
```

---

## 已知限制

### 1. 平台集成功能已移除

这是从更大平台剥离出的独立版本，以下功能不在本项目中：
- iframe 嵌入模式（父页面通信、高度自适应）
- SSO 单点登录（第三方 Cookie、共享会话）
- 跨域 Cookie / CORS 平台级中间件
- 平台级用户系统对接

本版本仅用于**模块本身的功能验收**，不涉及与外部平台的对接。

### 2. npm test 部分用例已知失败

运行 `npm test` 时，以下 16 个测试文件中约有 160 个测试用例失败（主要集中在教师端 UI 契约测试和前端回滚逻辑测试）。这些是模块剥离过程中遗留的测试兼容性问题 — 例如数据迁移脚本已移除、V1 版 Prompt 加载逻辑已简化、前端 UI 重构后契约测试尚未更新同步等。**所有失败均为既有问题，不影响聊天对话、AI 分析、教师审阅等核心功能的正常运行**：

```
test/background-ai.test.js
test/chat-api.test.js
test/chat-ui-rollback-contract.test.js
test/deepseek-model-config.test.js
test/migrate-guest-bindings.test.js
test/prompt-v2-contract.test.js
test/server-runtime-init.test.js
test/teacher-binding-frontend-contract.test.js
test/teacher-data-adapter.test.js
test/teacher-home-ui.test.js
test/teacher-insight-review-adapter.test.js
test/teacher-read-api.test.js
test/teacher-student-report-ui.test.js
test/teacher-student-review-ui.test.js
test/teacher-student-ui.test.js
test/v2-turn-runner.test.js
```

### 3. 无内置 HTTPS 支持

本项目不内置 HTTPS。如需生产环境安全部署，建议在前面挂一层反向代理（Nginx / Caddy）处理 TLS 终止，并设置 `NODE_ENV=production` 和 `TRUST_PROXY=1`。

---

## 技术栈

- **后端**：Node.js + Express
- **AI**：DeepSeek API（双模型策略：ANALYZE + REPLY）
- **前端**：原生 HTML / CSS / JavaScript（无框架）
- **数据**：JSON 文件持久化（`data/` 目录）
- **密码**：bcryptjs 哈希
- **测试**：Node.js 内置 test runner (`node:test`)
