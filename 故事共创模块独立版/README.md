# 故事共创模块独立版

这是 AI 伯乐智能体中的的故事共创应用。它拥有独立前端、独立后端和独立账号系统。

## 目录结构

```text
故事共创模块/
├─ frontend/              # Vite + React + TypeScript 前端
│  ├─ public/story-create # 图片、字体等静态资源
│  └─ src                 # 故事页面、组件、接口与独立登录页
├─ backend/               # FastAPI 后端
│  ├─ app                 # 登录、故事、角色、天赋分析等接口
│  ├─ tests               # 后端测试
│  └─ .env.example        # 环境变量示例（不含真实密钥）
└─ README.md
```

## 第一次运行

请分别打开两个 PowerShell 窗口。

### 1. 启动后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

如需使用 AI 故事导演，请打开 `backend/.env`，将自己的 DeepSeek 密钥填写到 `LLM_API_KEY=` 后面。不要把带有真实密钥的 `.env` 上传到 GitHub。

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

后端健康检查地址：<http://localhost:8010/api/health>

### 2. 启动前端

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开：<http://localhost:5174/story-create/login>

首次使用请点击“注册新账号”。这里创建的是本独立版自己的账号，与 AI 伯乐总平台账号互不影响。

## 后续启动

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

## 默认端口

- 独立版前端：5174
- 独立版后端：8010
- 前端开发服务器会自动把 `/api` 请求转发到 8010 端口。
