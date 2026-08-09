# 深海基地重建

一个基于 Vue 3、Vite、Tailwind CSS 和 FastAPI 开发的儿童互动游戏。项目包含三个游戏关卡、角色互动、语音合成以及多维能力评估报告。

## 项目结构

```text
.
├─ src/                    # Vue 前端源码
│  ├─ assets/             # 游戏图片和场景素材
│  ├─ components/         # 关卡、界面、角色和画布组件
│  └─ utils/              # 拼音、音效和语音工具
├─ server/                 # FastAPI 后端与评估系统
│  ├─ agents/             # 游戏角色智能体
│  ├─ requirements.txt    # Python 依赖
│  └─ .env.example        # 环境变量示例
├─ tests/                  # 数据和评分接口测试脚本
├─ index.html              # 前端入口页面
├─ package.json            # 前端依赖与命令
└─ vite.config.js          # Vite 开发服务器配置
```

## 环境要求

- Node.js 20.19+ 或 22.12+
- Python 3.10+

## 本地运行

### 1. 安装前端依赖

```bash
npm install
```

### 2. 安装后端依赖

```bash
python -m pip install -r server/requirements.txt
```

### 3. 配置可选的 AI 能力

复制 `server/.env.example` 为 `server/.env`，然后填写自己的 DeepSeek API Key。未配置密钥时，角色系统会使用内置降级模式，游戏仍可运行。

### 4. 启动后端

```bash
python server/server.py
```

后端默认运行在 `http://localhost:8005`。

### 5. 启动前端

另开一个终端：

```bash
npm run dev
```

前端默认运行在 `http://localhost:3001`。

## 构建前端

```bash
npm run build
```

构建结果生成到 `dist/`。该目录属于生成文件，默认不会提交到 Git。

## 测试脚本

启动后端后，可按需运行：

```bash
python tests/test_quant.py
python tests/test_data.py
```

- `test_quant.py`：快速验证量化评分接口。
- `test_data.py`：执行更完整的数据和报告测试。

## 上传 GitHub 前检查

```bash
git status
npm run build
```

不要提交 `server/.env`、`node_modules/`、`dist/`、日志文件或本地编辑器配置。
