# 职业体验模拟器模块

本目录仅包含“AI伯乐计划”中的职业体验模拟器模块，不包含统一平台代码、本地测试数据库、第三方依赖目录或个人密钥。

## 目录说明

```text
career-experience-module/
├─ backend/                 # FastAPI 服务与模块核心逻辑
│  ├─ main.py               # 路由、会话管理、页面与 API 入口
│  ├─ services.py           # ECD 证据汇总、报告、异常与安全逻辑
│  ├─ career_data.py        # 职业、情境、选项和任务规则配置
│  ├─ models.py             # SQLAlchemy 数据模型
│  ├─ auth.py               # 轻量身份与会话认证逻辑
│  ├─ config.py             # 环境变量、目录和运行参数
│  ├─ templates/            # Jinja 页面模板
│  └─ static/               # CSS、JavaScript、职业场景与任务素材
├─ .env.example             # 环境变量示例（不含真实密钥）
└─ requirements.txt         # Python 依赖
```

这种组织方式将服务端业务逻辑、页面模板和静态资源放在模块自己的 `backend` 目录下，便于独立运行；职业内容和 ECD 规则集中维护在 `career_data.py` 与 `services.py` 中，避免把规则散落在前端页面脚本中。

## 本地运行

```bash
cd career-experience-module/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

启动成功后访问 `http://127.0.0.1:8000`。

首次运行会在 `backend/` 下自动创建本地 SQLite 数据库。该数据库以及 TTS 缓存均在 `.gitignore` 中排除，不应提交到仓库。

## 说明

- `.env` 中可能包含模型接口密钥，仓库仅保留 `.env.example`。
- `vendor/` 是本地依赖目录，可由 `requirements.txt` 重新安装，因此未提交。
- `static/tts/` 是运行时生成的语音缓存，未提交。
- 项目使用的职业场景、角色与任务素材保留在 `static/images/`，以确保页面克隆后可以正常展示。
