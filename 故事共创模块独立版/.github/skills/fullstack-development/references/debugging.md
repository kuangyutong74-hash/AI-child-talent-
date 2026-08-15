# Debugging Guide

Common issues and solutions for the Story Co-creation development environment.

## Environment Setup Issues

### Issue: `Python not found` or `command not recognized`

**Symptoms**:
- Error when running `python` or `.venv\Scripts\python.exe`
- Python command doesn't work in PowerShell

**Solutions**:
1. **Check Python installation**:
   ```powershell
   python --version
   ```
   If error, install Python 3.10+ from https://python.org
   
2. **Use full path if needed**:
   ```powershell
   # Find Python installation
   Get-Command python
   ```

3. **Recreate virtual environment**:
   ```powershell
   cd backend
   rm -r .venv
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

### Issue: `npm not found` or Node version mismatch

**Symptoms**:
- `command not found: npm`
- `npm WARN` messages about version compatibility

**Solutions**:
1. **Install/update Node.js**: https://nodejs.org (LTS recommended)

2. **Clear npm cache**:
   ```powershell
   npm cache clean --force
   npm install
   ```

3. **Check versions**:
   ```powershell
   node --version
   npm --version
   ```

### Issue: `.venv` activation doesn't work

**Symptoms**:
- Command prompt doesn't show `(.venv)`
- Virtual environment not activated

**Solutions**:
```powershell
# PowerShell 5.1 activation
cd backend
.\.venv\Scripts\Activate.ps1

# If you get "cannot be loaded because running scripts is disabled"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\.venv\Scripts\Activate.ps1
```

---

## Backend Issues (Port 8010)

### Issue: `Address already in use` or Port 8010 occupied

**Symptoms**:
```
ERROR: [Errno 10048] Only one usage of each socket address...
OSError: [Errno 48] Address already in use
```

**Solutions**:
```powershell
# Find process using port 8010
Get-NetTCPConnection -LocalPort 8010

# Kill the process (replace PID with actual process ID)
Stop-Process -Id <PID> -Force

# Or use different port
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8011
```

### Issue: `ModuleNotFoundError` - missing dependencies

**Symptoms**:
```
ModuleNotFoundError: No module named 'fastapi'
```

**Solutions**:
```powershell
# Reinstall requirements
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Check installation
.\.venv\Scripts\python.exe -m pip list
```

### Issue: Database errors - `database is locked`

**Symptoms**:
```
sqlite3.OperationalError: database is locked
```

**Solutions**:
1. **Check file locks**: Close other tools accessing database
2. **Restart backend**: Kill and restart the Uvicorn process
3. **Check SQLite file**:
   ```powershell
   # Verify database file exists and is accessible
   ls backend/app.db
   ```

### Issue: API returns 500 Internal Server Error

**Symptoms**:
- Endpoint works in Swagger but returns 500
- Error appears in backend console

**Solutions**:
1. **Check console output**: Look at backend terminal for error trace
2. **Test in Swagger UI**: 
   - Go to http://localhost:8010/docs
   - Try the endpoint there to see detailed error
3. **Add debug logging**:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   logger = logging.getLogger(__name__)
   logger.debug("Variable value:", some_var)
   ```
4. **Check database**: Use SQLite browser to verify data exists

### Issue: `401 Unauthorized` on authenticated endpoints

**Symptoms**:
```
{
  "detail": "Not authenticated"
}
```

**Solutions**:
1. **Verify token in request**: Check DevTools Network tab
   - Look for `Authorization: Bearer <token>` header
2. **Test without auth first**:
   - Use public endpoints to verify API works
3. **Check token expiry**:
   ```python
   # In backend console
   import jwt
   token = "your_token_here"
   decoded = jwt.decode(token, options={"verify_signature": False})
   print(decoded)  # Check exp (expiration) field
   ```

### Issue: LLM/DeepSeek API errors

**Symptoms**:
```
Error calling LLM: 401 Unauthorized
openai.error.AuthenticationError: Invalid API key
```

**Solutions**:
1. **Verify API key**: 
   ```powershell
   # Check .env file
   cat backend/.env | grep LLM_API_KEY
   ```
2. **Validate key format**: DeepSeek keys start with `sk-`
3. **Check API quota**: Log into DeepSeek console
4. **Test API directly**:
   ```python
   import openai
   openai.api_key = "sk-your-key"
   openai.api_base = "https://api.deepseek.com/v1"
   
   response = openai.ChatCompletion.create(
       model="deepseek-chat",
       messages=[{"role": "user", "content": "Hi"}]
   )
   print(response)
   ```

---

## Frontend Issues (Port 5174)

### Issue: `npm install` fails or hangs

**Symptoms**:
- Installation takes too long
- `ERR!` messages appear
- Stuck on certain package

**Solutions**:
```powershell
# Clear cache and retry
npm cache clean --force
rm node_modules -Force -Recurse
rm package-lock.json
npm install

# Or use alternative registry (if npm registry is slow)
npm config set registry https://registry.npmmirror.com
npm install
```

### Issue: TypeScript errors - `Could not find module` or type errors

**Symptoms**:
```
error TS2307: Cannot find module '@/types'
error TS1192: Module can only be default-imported using 'esModuleInterop'
```

**Solutions**:
1. **Rebuild TypeScript**:
   ```powershell
   cd frontend
   npx tsc -b
   ```
2. **Check imports**: 
   - Verify path is correct
   - Check file exists
3. **Install missing types**:
   ```powershell
   npm install --save-dev @types/node
   ```

### Issue: `Port 5174 already in use`

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use :::5174
```

**Solutions**:
```powershell
# Find and kill process using port 5174
Get-NetTCPConnection -LocalPort 5174 | 
    Stop-Process -Force

# Or configure different port in vite.config.ts
```

### Issue: Vite dev server won't start

**Symptoms**:
- `npm run dev` doesn't show server started message
- Browser doesn't load

**Solutions**:
```powershell
cd frontend

# Clear Vite cache
rm .vite -Force -Recurse

# Clear node modules and reinstall
rm node_modules -Force -Recurse
rm package-lock.json
npm install

# Try starting again
npm run dev
```

### Issue: API requests return 404 or Connection refused

**Symptoms**:
- Frontend can't reach backend
- `GET http://localhost:8010/api/... 404`
- `Connection refused`

**Solutions**:
1. **Verify backend is running**: Check Terminal 1 for `Uvicorn running` message
2. **Check port**: Make sure backend uses 8010
3. **Verify proxy config**: In `vite.config.ts`, check proxy settings:
   ```typescript
   server: {
       proxy: {
           '/api': {
               target: 'http://localhost:8010',
               changeOrigin: true
           }
       }
   }
   ```
4. **Check DevTools Network**: See what URL is actually being requested

### Issue: Styling not applying or CSS errors

**Symptoms**:
- Styles look broken
- Colors/fonts wrong
- CSS file not loading

**Solutions**:
1. **Check CSS import**:
   ```typescript
   import './styles/global.css'  // Correct
   import './styles/global'      // Wrong
   ```
2. **Verify file exists**: Check path in `src/styles/`
3. **Check CSS syntax**: Look for typos or invalid CSS
4. **Hard refresh**: `Ctrl+Shift+R` in browser
5. **Clear Vite cache**:
   ```powershell
   rm .vite -Force -Recurse
   npm run dev
   ```

---

## Authentication Issues

### Issue: `Cannot login` or stuck on login screen

**Symptoms**:
- Login button doesn't respond
- Stays on login page after clicking
- Error in console

**Solutions**:
1. **Check network request**: Open DevTools → Network → try login
   - Look for `/api/auth/login` request
   - Check response status and message
2. **Verify credentials**: 
   - Use correct email/password (register new account if needed)
3. **Check token storage**:
   ```javascript
   // In browser console
   localStorage.getItem('token')
   ```
4. **Test backend auth endpoint** in Swagger:
   - Go to http://localhost:8010/docs
   - Try `/auth/login` endpoint manually

### Issue: `Logged in but immediately logged out` or persistent logout

**Symptoms**:
- Can log in but page refreshes and logged out
- Token not persisting
- Have to re-login on every page refresh

**Solutions**:
1. **Check localStorage**: Verify token saved
   ```javascript
   // DevTools Console
   console.log(localStorage.getItem('token'))
   ```
2. **Check token expiry**: Decode token in backend:
   ```python
   import jwt
   token = localStorage.getItem('token')  # from browser
   jwt.decode(token, options={"verify_signature": False})
   ```
3. **Check AuthContext**: Ensure component reads from localStorage on mount
4. **Verify CORS**: Check backend allows credentials

---

## Database Issues

### Issue: `Database corruption` or can't open database

**Symptoms**:
```
sqlite3.DatabaseError: database disk image is malformed
```

**Solutions**:
```powershell
# Backup and remove database
cd backend
cp app.db app.db.backup
rm app.db

# Restart backend (recreates database)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### Issue: Database doesn't show expected data

**Symptoms**:
- Created record but can't retrieve it
- Query returns empty

**Solutions**:
1. **Check database directly**: Use SQLite browser
   ```powershell
   # List all tables
   sqlite3 backend/app.db ".tables"
   
   # Query data
   sqlite3 backend/app.db "SELECT * FROM users;"
   ```
2. **Check if transaction committed**: 
   - Ensure `await db.commit()` in service code
3. **Restart services**: Might be caching issue

---

## General Troubleshooting

### Checklist for most issues:

1. **Restart services**
   - Kill both backend and frontend
   - Start fresh terminals
   - Usually fixes intermittent issues

2. **Clear caches**
   ```powershell
   # Backend: Remove .venv and recreate
   # Frontend: Remove node_modules
   # Browser: Ctrl+Shift+Delete → Clear all
   ```

3. **Check logs**
   - Backend console (Terminal 1)
   - Frontend console (Terminal 2)
   - Browser DevTools Console

4. **Verify prerequisites**
   ```powershell
   python --version  # Should be 3.10+
   node --version    # Should be 18+
   npm --version
   ```

5. **Check .env configuration**
   ```powershell
   # Backend
   cat backend/.env | grep -E "LLM_|DATABASE_|JWT_"
   ```

6. **Test endpoints individually**
   - Use Swagger UI for backend: http://localhost:8010/docs
   - Use browser Network tab for frontend

### Getting Help

When reporting an issue, include:
1. Error message (full text)
2. Which service (backend/frontend/browser)
3. Steps to reproduce
4. Output of:
   ```powershell
   python --version
   node --version
   npm --version
   cat backend/.env  # (without API keys)
   ```
5. Screenshots if UI related

See `SKILL.md` for more information.
