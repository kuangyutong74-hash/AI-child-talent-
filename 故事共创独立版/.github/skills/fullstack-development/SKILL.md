---
name: fullstack-development
description: 'Full-stack development workflow for Story Co-creation project. Use for setting up dev environment, understanding architecture, implementing features across backend and frontend, debugging the application stack, and understanding project patterns and conventions.'
argument-hint: 'Step name (setup, architecture, feature-development, debugging)'
user-invocable: true
---

# Full-Stack Development Workflow

Guide for new developers to contribute to the Story Co-creation Module (故事共创模块) independent version.

## When to Use This Skill

- **First-time setup**: Getting the project running on your machine
- **Understanding architecture**: Learning how backend and frontend communicate
- **Implementing features**: Building new functionality across the stack
- **Debugging issues**: Troubleshooting problems that span multiple layers
- **Contributing**: Learning project conventions and workflow

## Quick Start

The fastest way to get started:

```powershell
# Run the automated setup
cd backend
.\..\..\.github\skills\fullstack-development\scripts\setup.ps1

# Then follow the prompts to install dependencies and start services
```

**First time only**: After setup, configure your `.env`:
- Copy `backend/.env.example` to `backend/.env`
- Add your DeepSeek API key: `LLM_API_KEY=sk-xxx`

## Project Architecture

The project consists of three independent but integrated systems:

### 📱 Frontend (Port 5174)
- **Framework**: Vite + React 19 + TypeScript
- **State Management**: Context API (AuthContext, StoryContext)
- **Key Directories**:
  - `src/pages/` - Main routes (LoginPage, StoryPlayPage, etc.)
  - `src/components/` - Reusable UI components
  - `src/hooks/` - Custom hooks (useSpeechInput, useSSE, useTTS)
  - `src/api/` - API client configuration
  - `src/contexts/` - Global state (auth, story)
  - `src/assets/` - Images, icons, fonts

### 🔧 Backend (Port 8010)
- **Framework**: FastAPI with async/await
- **Database**: SQLite with SQLAlchemy ORM
- **Key Directories**:
  - `app/routers/` - API endpoints (auth, stories, characters, etc.)
  - `app/services/` - Business logic (LLM, TTS, content guard)
  - `app/models/` - Database models (SQLAlchemy)
  - `app/schemas/` - Request/response validation (Pydantic)
  - `app/prompts/` - LLM prompt templates (story_director, talent_evaluator)
  - `app/tests/` - Pytest test suite

### 🔐 Authentication System
- Independent JWT-based auth (not tied to main platform)
- User registration and login endpoints
- Token stored in frontend localStorage
- All requests require Bearer token

See [Project Structure Reference](./references/project-structure.md) for full directory details.

## Development Workflows

### 1. Environment Setup (First Time Only)

**Prerequisites**: Python 3.10+, Node.js 18+, Git

```powershell
# Backend setup
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env

# Frontend setup
cd ..\frontend
npm install
```

**Configuration**:
- Edit `backend/.env` and add your `LLM_API_KEY` (DeepSeek)
- Frontend proxies `/api` requests to `http://localhost:8010`

### 2. Running the Application

**Terminal 1 - Backend**:
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

**Terminal 2 - Frontend**:
```powershell
cd frontend
npm run dev
```

**Access**: 
- Frontend: http://localhost:5174/story-create/login
- Backend Health: http://localhost:8010/api/health
- API Docs: http://localhost:8010/docs (Swagger)

### 3. Implementing a Feature

**Workflow**: Database Model → Backend API → Frontend UI → Test & Debug

1. **Start with schema** - Define what data you need
   - Create SQLAlchemy model in `backend/app/models/`
   - Create Pydantic schema in `backend/app/schemas/`

2. **Build the backend** - Implement business logic
   - Create service in `backend/app/services/` if needed
   - Add router in `backend/app/routers/`
   - Test with `/docs` Swagger UI

3. **Build the frontend** - Create user interface
   - Add API client method in `frontend/src/api/`
   - Create React components in `frontend/src/components/`
   - Connect to state (AuthContext, StoryContext)

4. **Integration test** - Verify end-to-end flow
   - Run both services locally
   - Test in browser with all user flows
   - Check network requests in DevTools

See [Feature Implementation Template](./templates/feature-template.md) for detailed example.

### 4. Debugging Issues

**Backend issues** (500 errors, invalid responses):
1. Check console output in Terminal 1 (backend)
2. Review database state: `backend/app/database.py`
3. Use Swagger UI `/docs` to test endpoints directly
4. Add `print()` statements or use debugger

**Frontend issues** (UI bugs, API errors):
1. Open DevTools (F12) → Network tab
2. Check API request/response in Console
3. Review React components for state issues
4. Check console for TypeScript/React errors

**Auth issues** (401 Unauthorized):
1. Verify token exists: DevTools → Application → localStorage
2. Check token expiry and format
3. Verify `Authorization: Bearer <token>` header sent

**LLM issues** (AI features not working):
1. Verify `LLM_API_KEY` is set in `.env`
2. Check API quota and rate limits
3. Review prompts in `backend/app/prompts/`
4. Test with Swagger UI first

## Key Patterns & Conventions

### API Endpoints

All endpoints follow RESTful conventions with `/api` prefix:

```
POST   /api/auth/register       - User registration
POST   /api/auth/login          - User login
POST   /api/stories             - Create story
GET    /api/stories/{id}        - Get story details
POST   /api/characters          - Add character
GET    /api/talents             - Get talent evaluation
```

### Frontend State Management

Two main contexts:
- `AuthContext` - User authentication state
- `StoryContext` - Current story and related data

Access via: `const { user, token } = useContext(AuthContext);`

### LLM Integration

All LLM calls go through `backend/app/services/llm_service.py`:

```python
from app.services.llm_service import LLMService
response = await LLMService.generate_story(prompt, context)
```

Prompts are in `backend/app/prompts/` organized by feature.

### Database Operations

Always use async context:

```python
async with get_db() as db:
    user = await db.query(User).filter(...).first()
```

### Error Handling

Consistent error responses:

```python
from fastapi import HTTPException
raise HTTPException(
    status_code=400,
    detail="Invalid input: story title required"
)
```

## Testing

Run tests with pytest:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/ -v
```

Test files in `backend/tests/`:
- `test_multilabel_recall.py`
- `test_scoring_quality_gates.py`
- `test_non_scoring_regressions.py`

## Resources

- [Project Structure Reference](./references/project-structure.md) - Detailed directory map
- [Feature Implementation Template](./templates/feature-template.md) - Step-by-step feature example
- [Setup Script](./scripts/setup.ps1) - Automated environment setup
- FastAPI Docs: http://localhost:8010/docs (when running)
- React Component Pattern: See `frontend/src/components/` for examples

## Common Tasks Checklist

- [ ] Environment setup complete (both `.venv` and `node_modules`)
- [ ] `.env` configured with API key
- [ ] Both backend and frontend services running
- [ ] Can access http://localhost:5174/story-create/login
- [ ] Created test account and logged in
- [ ] Can see Swagger UI at http://localhost:8010/docs

**Next**: Pick a feature from [Feature Template](./templates/feature-template.md) and start contributing!
