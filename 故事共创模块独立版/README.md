# AI 伯乐 · 故事共创模块（独立版）

与 AI 故事导演一起共创故事的儿童教育应用。孩子选择年龄段通道、创建专属角色后，
与故事导演一问一答地完成一篇属于自己的故事；后台 AI 会同步观察语言表达与创造力表现，
生成适合孩子阅读的创作回顾和家长视角的成长分析。

本模块为独立版本：自带前端、后端与本地数据库，**无账号登录**，安装依赖后即可在单台
设备上直接使用。

## 功能特性

- **双年龄段通道**：幼儿通道（4-7 岁）与学龄通道（8-12 岁），AI 会根据年龄调整故事风格、
  词汇难度、提问方式与评价口径
- **分年龄段的角色与设定**：两个通道拥有不同的初始形象、预设角色、人设选项与故事主题
  - 4-7 岁：温暖熟悉的幻想伙伴（小精灵、小龙、小宇航员、美人鱼），人设侧重情绪与善意
  - 8-12 岁：冒险探索型伙伴（探险家、海盗、巫师、机器人），人设侧重能力与目标
- **角色管理**：我的角色卡片标注年龄段、创建时间与已创作故事名称，支持按年龄段筛选
- **故事共创**：SSE 流式输出，AI 故事导演开场 → 孩子回答 → 导演续写，直至故事完结；
  全程内置内容安全过滤与隐私脱敏
- **词语查询**：故事中选中词语即可获得按年龄段解释的释义
- **故事书架**：孩子的故事书架与家长书架（含删除保护）
- **天赋观察**：创作过程中的亮点回顾与家长视角的语言/想象力成长分析
- **语音朗读**：AI 回复支持在线语音朗读（edge-tts）
- **背景音乐与引导动画**：面向儿童的视觉与交互设计

## 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 | Vite · React 19 · TypeScript · React Router 7 |
| 后端 | FastAPI · SQLAlchemy 2（async）· aiosqlite（SQLite） |
| AI | DeepSeek Chat（openai SDK 兼容接口） |
| TTS | edge-tts（微软在线语音，免费） |
| 测试 | pytest |

## 目录结构

```text
故事共创模块独立版/
├─ frontend/                  # 前端（Vite + React + TypeScript）
│  ├─ public/story-create/    # 图片、字体、音频等静态资源
│  └─ src/
│     ├─ api/                 # 接口封装（apiFetch、各资源端点）
│     ├─ components/          # 页面组件（角色、故事、画廊、共享组件）
│     ├─ contexts/            # 年龄段通道 / 故事进行状态
│     ├─ data/                # 分年龄段的角色、人设与主题配置
│     ├─ hooks/               # SSE、TTS、语音输入等 hooks
│     ├─ pages/               # 主页、通道选择、角色、故事、画廊、天赋页
│     └─ styles/              # 全局主题与动画
├─ backend/                   # 后端（FastAPI）
│  ├─ app/
│  │  ├─ main.py              # 应用入口与路由注册
│  │  ├─ config.py            # 配置（环境变量）
│  │  ├─ database.py          # SQLite 连接与数据库迁移
│  │  ├─ models/              # ORM 模型（角色、故事、消息、观察）
│  │  ├─ schemas/             # Pydantic 请求/响应模型
│  │  ├─ routers/             # 角色、故事、观察、天赋、词语、TTS 接口
│  │  ├─ services/            # LLM、内容安全、观察、天赋、TTS 服务
│  │  └─ prompts/             # 故事导演 / 故事精灵 / 天赋评估提示词
│  ├─ tests/                  # 后端单元测试
│  ├─ requirements.txt        # Python 依赖
│  └─ .env.example            # 环境变量示例（不含真实密钥）
└─ story_cocreate.db          # SQLite 数据库（首次启动自动创建，已加入 .gitignore）
```

## 环境要求

- **Node.js** ≥ 18（开发使用 v22）
- **Python** ≥ 3.11（开发使用 3.12）

## 快速开始

### 1. 启动后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

如需使用 AI 故事导演与词语查询，请编辑 `backend/.env`，将 DeepSeek 密钥填写到
`LLM_API_KEY=` 后面（未配置时后端可启动，但涉及 LLM 的功能会提示不可用）。
**请勿把包含真实密钥的 `.env` 提交到仓库。**

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

后端健康检查：<http://localhost:8010/api/health>，接口文档：<http://localhost:8010/docs>。

### 2. 启动前端

另开一个 PowerShell 窗口：

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开 <http://localhost:5174/story-create>。首次进入会引导选择年龄段通道
（选择结果保存在浏览器 localStorage 中），随后进入主页开始创作。

### 后续启动

后端：

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

前端：

```powershell
cd frontend
npm run dev
```

## 环境变量

后端通过 `backend/.env` 读取配置（详见 `.env.example`）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `LLM_API_KEY` | DeepSeek API 密钥 | 空（LLM 功能不可用） |
| `LLM_BASE_URL` | LLM 接口地址 | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 使用的模型 | `deepseek-chat` |

## API 概览

所有接口挂载在 `/api/v1` 前缀下（本地开发无需认证）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/characters` | 角色列表（含年龄段、创建时间与故事名称） |
| POST | `/characters` | 创建角色（昵称、形象、颜色、人设、年龄段） |
| PATCH | `/characters/{id}` | 修改角色年龄段 |
| DELETE | `/characters/{id}` | 删除角色（级联删除相关故事） |
| GET | `/stories` | 故事列表（可按角色、状态筛选） |
| POST | `/stories` | 创建故事（角色、主题、标题） |
| GET | `/stories/{id}` | 故事详情 |
| PATCH | `/stories/{id}` | 修改故事标题 / 状态 |
| DELETE | `/stories/{id}` | 软删除故事（家长书架仍可见） |
| GET | `/stories/parent/all` | 家长视角全部故事（含已删除） |
| GET | `/stories/{id}/messages` | 故事对话记录（已过滤与脱敏） |
| POST | `/stories/{id}/turn` | 核心接口：提交孩子发言，SSE 流式返回 AI 续写 |
| GET | `/observations?story_id={id}` | 逐轮观察记录 |
| GET | `/observations/summary/{id}` | 观察摘要 |
| GET | `/talents/{id}` | 家长视角天赋报告 |
| GET | `/talents/{id}/feedback` | 孩子视角创作回顾（无分数） |
| GET | `/dictionary/lookup?word=&age_group=` | 按年龄段解释词语 |
| POST | `/tts` | 文本转语音（返回 MP3） |

## 数据存储

- 数据保存在模块根目录的 SQLite 文件 `story_cocreate.db` 中（首次启动自动建表并执行迁移）
- 数据表：`characters`（角色）、`stories`（故事）、`story_messages`（对话）、`observations`（观察记录）
- 年龄通道选择保存在浏览器 localStorage（键 `story_create_age_group`），与后端数据无关

## 测试

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests
```

当前测试覆盖天赋评分的质量门控、多标签召回与非评分路径回归（35 个用例）。

## 构建部署

前端生产构建：

```powershell
cd frontend
npm run build      # 产物输出到 frontend/dist
npm run preview    # 本地预览构建产物
```

后端部署（以 Render 为例，见 `backend/render.yaml`）：

```powershell
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

部署到远程环境时，前端需通过 `VITE_API_URL` 环境变量指向后端地址（本地开发由
Vite 代理自动转发，无需配置）。

## 默认端口

- 前端开发服务器：**5174**（`/api` 请求自动代理到 8010）
- 后端：**8010**

## 安全说明

- 本模块面向儿童使用，后端内置了输入内容安全过滤、敏感信息脱敏与 AI 输出净化
- 家长书架保留已删除故事，便于家长回顾；孩子书架不显示已删除内容
- 本版本为单机使用，无账号体系；请勿将含密钥的 `.env` 或数据库文件上传到公开仓库
