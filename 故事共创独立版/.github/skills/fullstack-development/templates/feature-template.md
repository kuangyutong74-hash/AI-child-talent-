# Feature Implementation Template

Step-by-step guide to implement a new feature from start to finish.

## Example Feature: Add "Story Difficulty Level" Tracking

This example walks through adding a new feature that lets users rate the difficulty level of each story.

---

## Phase 1: Database & Schema

### Step 1a: Create Database Model

Edit `backend/app/models/story.py`:

```python
# Add to Story class
class Story(Base):
    __tablename__ = "stories"
    
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    # ... existing fields ...
    
    # ADD THIS
    difficulty_level = Column(Integer, default=1)  # 1-5 scale
    difficulty_feedback = Column(String, nullable=True)  # User's explanation
```

### Step 1b: Create Pydantic Schema

Edit `backend/app/schemas/story.py`:

```python
# Add to StoryUpdate schema
class StoryUpdate(BaseModel):
    title: Optional[str] = None
    # ... existing fields ...
    
    # ADD THIS
    difficulty_level: Optional[int] = Field(None, ge=1, le=5)
    difficulty_feedback: Optional[str] = Field(None, max_length=500)

# Create response schema that includes new fields
class StoryResponse(BaseModel):
    id: int
    title: str
    # ... existing fields ...
    
    # ADD THIS
    difficulty_level: int
    difficulty_feedback: Optional[str]
    
    class Config:
        from_attributes = True
```

### Step 1c: Create Migration (if using Alembic)

If using database migrations, create migration file. For SQLite with this project, just ensure the model schema is up to date.

---

## Phase 2: Backend API

### Step 2a: Add Service Method

Edit `backend/app/services/story_service.py` (or create if new):

```python
async def update_story_difficulty(
    db: AsyncSession,
    story_id: int,
    difficulty_level: int,
    feedback: str = None
) -> Story:
    """Update difficulty rating for a story."""
    query = select(Story).where(Story.id == story_id)
    story = await db.scalar(query)
    
    if not story:
        raise ValueError(f"Story {story_id} not found")
    
    story.difficulty_level = difficulty_level
    story.difficulty_feedback = feedback
    
    db.add(story)
    await db.commit()
    await db.refresh(story)
    
    return story
```

### Step 2b: Add Router Endpoint

Edit `backend/app/routers/stories.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.story_service import update_story_difficulty
from app.schemas.story import StoryUpdate, StoryResponse

router = APIRouter(prefix="/api/stories", tags=["stories"])

@router.patch("/{story_id}/difficulty")
async def set_story_difficulty(
    story_id: int,
    update: StoryUpdate,
    db: AsyncSession = Depends(get_db)
) -> StoryResponse:
    """Update story difficulty rating."""
    try:
        story = await update_story_difficulty(
            db,
            story_id,
            update.difficulty_level,
            update.difficulty_feedback
        )
        return StoryResponse.from_orm(story)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

### Step 2c: Test with Swagger

1. Start backend: `python -m uvicorn app.main:app --reload`
2. Open http://localhost:8010/docs
3. Find the new `PATCH /api/stories/{story_id}/difficulty` endpoint
4. Test the endpoint with sample data

---

## Phase 3: Frontend Components

### Step 3a: Add API Client Method

Edit `frontend/src/api/endpoints.ts`:

```typescript
export const storyAPI = {
    // ... existing methods ...
    
    // ADD THIS
    updateDifficulty: async (
        storyId: number,
        difficulty: number,
        feedback?: string
    ) => {
        const response = await apiClient.patch(
            `/stories/${storyId}/difficulty`,
            {
                difficulty_level: difficulty,
                difficulty_feedback: feedback
            }
        );
        return response.data;
    }
};
```

### Step 3b: Create Component

Create `frontend/src/components/Story/DifficultyRating.tsx`:

```typescript
import React, { useState } from 'react';
import { storyAPI } from '../../api/endpoints';
import './DifficultyRating.css';

interface DifficultyRatingProps {
    storyId: number;
    initialLevel?: number;
    initialFeedback?: string;
    onSaved?: (level: number) => void;
}

export const DifficultyRating: React.FC<DifficultyRatingProps> = ({
    storyId,
    initialLevel = 1,
    initialFeedback = '',
    onSaved
}) => {
    const [level, setLevel] = useState(initialLevel);
    const [feedback, setFeedback] = useState(initialFeedback);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        try {
            setIsLoading(true);
            await storyAPI.updateDifficulty(storyId, level, feedback);
            onSaved?.(level);
        } catch (error) {
            console.error('Failed to save difficulty:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="difficulty-rating">
            <label>Difficulty Level</label>
            <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        className={`star ${star <= level ? 'active' : ''}`}
                        onClick={() => setLevel(star)}
                        aria-label={`Rate ${star} stars`}
                    >
                        ⭐
                    </button>
                ))}
            </div>
            
            <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us why this difficulty..."
                className="feedback-input"
            />
            
            <button
                onClick={handleSave}
                disabled={isLoading}
                className="save-button"
            >
                {isLoading ? 'Saving...' : 'Save Rating'}
            </button>
        </div>
    );
};
```

### Step 3c: Create Styles

Create `frontend/src/components/Story/DifficultyRating.css`:

```css
.difficulty-rating {
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #f9f9f9;
}

.difficulty-rating label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
}

.rating-stars {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.rating-stars .star {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0.3;
    transition: opacity 0.2s;
}

.rating-stars .star.active {
    opacity: 1;
}

.rating-stars .star:hover {
    opacity: 0.6;
}

.feedback-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.9rem;
    resize: vertical;
    min-height: 60px;
    margin-bottom: 1rem;
}

.save-button {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}

.save-button:hover {
    background: #0056b3;
}

.save-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### Step 3d: Integrate into Page

Edit `frontend/src/pages/StoryPlayPage.tsx`:

```typescript
import { DifficultyRating } from '../components/Story/DifficultyRating';

export const StoryPlayPage: React.FC = () => {
    const { storyId } = useParams<{ storyId: string }>();
    const [story, setStory] = useState(null);

    // ... existing code ...

    return (
        <div className="story-play-page">
            {/* Existing story content */}
            
            {/* ADD THIS */}
            <section className="story-controls">
                <DifficultyRating
                    storyId={parseInt(storyId!)}
                    initialLevel={story?.difficulty_level || 1}
                    initialFeedback={story?.difficulty_feedback}
                    onSaved={(level) => {
                        console.log('Saved difficulty:', level);
                    }}
                />
            </section>
        </div>
    );
};
```

---

## Phase 4: Testing & Debugging

### Step 4a: Test Backend Endpoint

```powershell
# Terminal 1: Backend
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload

# Terminal 2: Test with curl
$headers = @{
    "Authorization" = "Bearer <your-token>"
    "Content-Type" = "application/json"
}

$body = @{
    difficulty_level = 4
    difficulty_feedback = "Too many dialogue options"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8010/api/stories/1/difficulty" `
    -Method PATCH `
    -Headers $headers `
    -Body $body
```

### Step 4b: Test Frontend Component

1. Start frontend: `npm run dev`
2. Open DevTools (F12) → Network tab
3. Navigate to a story
4. Click difficulty rating stars
5. Submit feedback
6. Verify:
   - Network request shows correct data
   - Response includes updated difficulty
   - UI updates without refresh

### Step 4c: Check Database

```python
# In Python interactive shell
from app.database import SessionLocal
from app.models.story import Story

session = SessionLocal()
story = session.query(Story).first()
print(f"Difficulty: {story.difficulty_level}")
print(f"Feedback: {story.difficulty_feedback}")
```

---

## Phase 5: Refinement

### Checklist Before Done

- [ ] Backend endpoint works in Swagger UI
- [ ] Frontend component renders without errors
- [ ] User can set and save difficulty rating
- [ ] Difficulty persists after page reload
- [ ] Feedback textarea works (optional field)
- [ ] Loading states work correctly
- [ ] Error messages are user-friendly
- [ ] TypeScript has no errors
- [ ] Styles match project theme
- [ ] Works on mobile (if responsive)
- [ ] Tests written (if required)

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| 400 Bad Request from API | Check Pydantic schema validation; use Swagger to test exact format |
| CORS error | Verify backend CORS settings in `app/main.py` |
| Token 401 error | Check `Authorization` header in DevTools Network tab |
| Component not rendering | Check React DevTools for prop errors |
| Styles not applying | Verify CSS import path and class names |
| Database not saving | Check SQLAlchemy session commit in service method |

---

## Quick Reference

### Common Patterns

**Async database query:**
```python
from sqlalchemy import select
query = select(Story).where(Story.id == id)
story = await db.scalar(query)
```

**API request from frontend:**
```typescript
const response = await apiClient.post('/endpoint', data);
```

**React Context access:**
```typescript
const { user, token } = useContext(AuthContext);
```

**State update:**
```typescript
const [value, setValue] = useState(initialValue);
```

### File Locations Quick Lookup

| Need | File Location |
|------|---|
| Add DB field | `backend/app/models/*.py` |
| Validate input | `backend/app/schemas/*.py` |
| Business logic | `backend/app/services/*.py` |
| API route | `backend/app/routers/*.py` |
| API call | `frontend/src/api/endpoints.ts` |
| React component | `frontend/src/components/` |
| Page | `frontend/src/pages/` |
| Global state | `frontend/src/contexts/` |
| Custom hook | `frontend/src/hooks/` |
| Styles | `frontend/src/styles/` |

---

## Next Steps

1. **Run the full stack test**: Start both backend and frontend
2. **Create a test user**: Register new account in UI
3. **Verify database**: Check SQLite has new columns
4. **Test all flows**: Try on different browser tab, verify persistence
5. **Ask for code review**: Share changes with team

See `SKILL.md` for debugging guide if issues arise.
