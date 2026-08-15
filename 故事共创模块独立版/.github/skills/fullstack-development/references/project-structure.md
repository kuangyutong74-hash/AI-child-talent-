# Project Structure Reference

Complete directory map for the Story Co-creation Module.

## Root Level

```
故事共创模块独立版/
├── README.md                     # Main project documentation (in Chinese)
├── backend/                      # FastAPI Python backend
├── frontend/                     # React/TypeScript frontend
├── .github/                      # GitHub and tooling config
│   └── skills/                   # Custom development skills
└── data/                         # Data files and migrations
```

## Backend Structure (`backend/`)

### Core Application (`app/`)

```
app/
├── main.py                       # FastAPI application entry point
├── config.py                     # Configuration settings
├── database.py                   # Database connection and session
├── auth.py                       # Authentication utilities
├── models/                       # SQLAlchemy ORM models
│   ├── user.py                   # User model
│   ├── story.py                  # Story model
│   ├── character.py              # Character model
│   ├── message.py                # Story message/turn
│   └── observation.py            # User observation records
├── schemas/                      # Pydantic validation schemas
│   ├── user.py                   # User request/response schemas
│   ├── story.py                  # Story schemas
│   ├── character.py              # Character schemas
│   └── message.py                # Message schemas
├── routers/                      # API route handlers
│   ├── auth.py                   # Login, register, token endpoints
│   ├── stories.py                # Story CRUD endpoints
│   ├── characters.py             # Character management endpoints
│   ├── observations.py           # Observation endpoints
│   ├── talents.py                # Talent evaluation endpoints
│   ├── dictionary.py             # Content dictionary
│   └── tts.py                    # Text-to-speech endpoints
├── services/                     # Business logic services
│   ├── llm_service.py            # LLM (DeepSeek) integration
│   ├── tts_service.py            # Text-to-speech service
│   ├── story_service.py          # Story logic
│   ├── talent_service.py         # Talent evaluation logic
│   ├── observation_service.py    # Observation recording
│   └── content_guard.py          # Content safety filtering
├── prompts/                      # LLM prompt templates
│   ├── story_director.py         # Story generation prompts
│   ├── story_fairy.py            # Story continuation prompts
│   └── talent_evaluator.py       # Talent evaluation prompts
└── __init__.py                   # Package initialization
```

### Testing (`tests/`)

```
tests/
├── test_multilabel_recall.py     # Multi-label classification tests
├── test_scoring_quality_gates.py # Quality assurance tests
└── test_non_scoring_regressions.py  # Regression tests
```

### Configuration Files

```
backend/
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment variables template
├── .env                          # Local environment (not in git)
├── render.yaml                   # Deployment config (Render.com)
└── .venv/                        # Virtual environment (created during setup)
```

## Frontend Structure (`frontend/`)

### Source Code (`src/`)

```
src/
├── main.tsx                      # React app entry point
├── StoryCreateApp.tsx            # Root App component
├── pages/                        # Page components (routes)
│   ├── LoginPage.tsx            # Login/register page
│   ├── StoryPlayPage.tsx        # Main story playing interface
│   ├── CharacterPage.tsx        # Character selection/management
│   ├── TalentPage.tsx           # Talent evaluation display
│   ├── GalleryPage.tsx          # Story gallery/history
│   ├── HomePage.tsx             # Home/dashboard
│   ├── ChannelPage.tsx          # Channel selection
│   ├── *.css                    # Page-specific styles
├── components/                   # Reusable UI components
│   ├── Character/               # Character related components
│   ├── Gallery/                 # Gallery/history components
│   ├── Layout/                  # Layout wrapper components
│   ├── Shared/                  # Common components (buttons, forms)
│   └── Story/                   # Story interaction components
├── contexts/                     # React Context (state management)
│   ├── AuthContext.tsx          # Authentication state
│   └── StoryContext.tsx         # Story/game state
├── hooks/                        # Custom React hooks
│   ├── useSpeechInput.ts        # Speech recognition
│   ├── useSSE.ts                # Server-sent events for streaming
│   └── useTTS.ts                # Text-to-speech integration
├── api/                          # API client layer
│   ├── client.ts                # HTTP client configuration
│   └── endpoints.ts             # API endpoint definitions
├── assets/                       # Static assets (images, icons)
│   └── assetMap.ts              # Asset path mapping
├── styles/                       # Global and shared styles
│   ├── global.css               # Global styles
│   ├── theme.css                # Theme colors and variables
│   ├── animations.css           # Animation definitions
│   ├── responsive.css           # Media query styles
│   └── candy-redesign.css       # UI design system
└── utils/                        # Utility functions
```

### Configuration Files

```
frontend/
├── package.json                 # npm dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── tsconfig.app.json            # App-specific TS config
├── tsconfig.node.json           # Node/build TS config
├── vite.config.ts               # Vite build configuration
├── public/                       # Static assets served as-is
│   └── story-create/
│       ├── audio/               # Audio files
│       ├── decor/               # Decoration/background images
│       ├── fonts/               # Custom fonts
│       ├── home/                # Home page assets
│       └── icons/               # Icon assets
├── index.html                   # HTML entry point
├── node_modules/                # npm packages (created during setup)
└── dist/                        # Build output (created by npm run build)
```

## Data Directory (`data/`)

```
data/
├── users.json                   # User data dumps
├── sessions.json                # Session data
├── bindings.json                # User bindings
├── chat-log.jsonl               # Chat history
├── history.json                 # Interaction history
├── journal.json                 # Journal entries
├── tips.json                    # Tips data
├── tips-favorites.json          # User favorite tips
├── teacher-*.json               # Teacher-related data
└── migrate-to-users.js          # Migration script
```

## Key Entry Points

### Backend
- **Main App**: `backend/app/main.py` - Configures FastAPI app, routes, CORS
- **Database**: `backend/app/database.py` - Creates engine and session
- **Auth**: `backend/app/auth.py` - JWT token generation/verification

### Frontend
- **Entry**: `frontend/index.html` - HTML root + React mount point
- **App**: `frontend/src/main.tsx` - Mounts React app
- **Root**: `frontend/src/StoryCreateApp.tsx` - Routes and layouts
- **Routes**: `frontend/src/pages/` - All page-level components

## Technology Stack

### Backend
- **Runtime**: Python 3.10+
- **Framework**: FastAPI (async)
- **ORM**: SQLAlchemy with async support
- **Database**: SQLite + aiosqlite
- **Auth**: python-jose (JWT), passlib (password hashing)
- **LLM**: OpenAI SDK (compatible with DeepSeek)
- **TTS**: edge-tts (Microsoft TTS)
- **Server**: Uvicorn

### Frontend
- **Runtime**: Node.js 18+
- **Framework**: React 19
- **Language**: TypeScript
- **Build**: Vite
- **State**: React Context API
- **Routing**: React Router v7

## Communication Flow

```
Browser Request
    ↓
Frontend React App (Port 5174)
    ↓
Vite Dev Server Proxy (routes /api to :8010)
    ↓
FastAPI Backend (Port 8010)
    ↓
Database (SQLite)
LLM Service (DeepSeek API)
TTS Service (Microsoft Edge TTS)
    ↓
JSON Response
    ↓
React Component State Update
    ↓
Browser Display
```

## Environment Variables

Key `.env` variables (see `backend/.env.example`):
- `LLM_API_KEY` - DeepSeek API key (required for story generation)
- `DATABASE_URL` - SQLite connection string
- `JWT_SECRET_KEY` - Token signing key
- `ALGORITHM` - JWT algorithm (HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token validity

## Typical Development Tasks

| Task | Primary Files |
|------|---|
| Create new story feature | `models/story.py`, `schemas/story.py`, `routers/stories.py`, `services/story_service.py` |
| Add character management | `models/character.py`, `routers/characters.py`, `components/Character/*` |
| Implement talent evaluation | `services/talent_service.py`, `prompts/talent_evaluator.py`, `pages/TalentPage.tsx` |
| Add authentication | `auth.py`, `routers/auth.py`, `contexts/AuthContext.tsx` |
| Connect to external API | `services/llm_service.py` or new service file |
| Fix UI bug | `components/` or `pages/` + corresponding `*.css` |
