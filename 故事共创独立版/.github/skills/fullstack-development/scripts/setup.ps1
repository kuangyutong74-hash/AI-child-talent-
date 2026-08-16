# Setup script for Story Co-creation Module development environment
# This script automates the initial setup for new developers

param(
    [string]$Action = "setup",
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$All
)

# Color output helpers
function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

# Check prerequisites
function Check-Prerequisites {
    Write-Info "🔍 Checking prerequisites..."
    
    $issues = @()
    
    # Check Python
    $pythonVersion = python --version 2>$null
    if ($?) {
        Write-Success "✓ Python found: $pythonVersion"
    } else {
        $issues += "Python not found. Please install Python 3.10+ from https://python.org"
    }
    
    # Check Node.js
    $nodeVersion = node --version 2>$null
    if ($?) {
        Write-Success "✓ Node.js found: $nodeVersion"
    } else {
        $issues += "Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    }
    
    # Check Git
    $gitVersion = git --version 2>$null
    if ($?) {
        Write-Success "✓ Git found: $gitVersion"
    } else {
        $issues += "Git not found. Please install Git from https://git-scm.com"
    }
    
    if ($issues.Count -gt 0) {
        Write-Error-Custom "❌ Prerequisites not met:"
        foreach ($issue in $issues) {
            Write-Error-Custom "  - $issue"
        }
        exit 1
    }
    
    Write-Success "✅ All prerequisites met`n"
}

# Setup backend
function Setup-Backend {
    Write-Info "🔧 Setting up backend..."
    
    # Navigate to backend directory
    if (-Not (Test-Path "backend")) {
        Write-Error-Custom "❌ backend directory not found. Make sure you're in the project root."
        exit 1
    }
    
    Push-Location backend
    
    # Create virtual environment
    if (-Not (Test-Path ".venv")) {
        Write-Info "Creating Python virtual environment..."
        python -m venv .venv
        Write-Success "✓ Virtual environment created"
    } else {
        Write-Info "Virtual environment already exists, skipping creation"
    }
    
    # Activate virtual environment
    Write-Info "Activating virtual environment..."
    & .\.venv\Scripts\Activate.ps1
    
    # Install requirements
    Write-Info "Installing Python dependencies..."
    .\.venv\Scripts\python.exe -m pip install -q --upgrade pip
    .\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
    Write-Success "✓ Python dependencies installed"
    
    # Setup .env file
    if (-Not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Write-Info "Copying .env.example to .env..."
            Copy-Item .env.example .env
            Write-Warning-Custom "⚠️  .env created. You need to add your API key:"
            Write-Info "   1. Edit backend/.env"
            Write-Info "   2. Add your DeepSeek API key: LLM_API_KEY=sk-xxxx"
            Write-Info "   3. Save the file"
        } else {
            Write-Error-Custom "❌ .env.example not found"
        }
    } else {
        Write-Info ".env file already exists"
    }
    
    Pop-Location
    Write-Success "✅ Backend setup complete`n"
}

# Setup frontend
function Setup-Frontend {
    Write-Info "🎨 Setting up frontend..."
    
    if (-Not (Test-Path "frontend")) {
        Write-Error-Custom "❌ frontend directory not found. Make sure you're in the project root."
        exit 1
    }
    
    Push-Location frontend
    
    # Install npm dependencies
    Write-Info "Installing npm dependencies (this may take a minute)..."
    npm install --quiet
    Write-Success "✓ npm dependencies installed"
    
    Pop-Location
    Write-Success "✅ Frontend setup complete`n"
}

# Start services
function Start-Services {
    Write-Info "🚀 Starting services..."
    
    Write-Info "Opening two PowerShell windows for backend and frontend"
    Write-Info "Backend will run on http://localhost:8010"
    Write-Info "Frontend will run on http://localhost:5174"
    
    # Start backend in new PowerShell window
    $backendScript = {
        cd backend
        Write-Host "Starting backend..." -ForegroundColor Cyan
        .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
    }
    
    # Start frontend in new PowerShell window
    $frontendScript = {
        cd frontend
        Write-Host "Starting frontend..." -ForegroundColor Cyan
        npm run dev
    }
    
    Write-Host "Opening backend terminal..." -ForegroundColor Yellow
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", $backendScript
    
    Start-Sleep -Seconds 2
    
    Write-Host "Opening frontend terminal..." -ForegroundColor Yellow
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", $frontendScript
    
    Write-Success "✅ Services started in new windows`n"
    Write-Info "Once started, open your browser:"
    Write-Info "  Frontend: http://localhost:5174/story-create/login"
    Write-Info "  Backend API docs: http://localhost:8010/docs"
}

# Show help
function Show-Help {
    Write-Host @"
Story Co-creation Module - Setup Script

USAGE:
    .\setup.ps1 [Options]

OPTIONS:
    -Action <string>   Action to perform: setup, start, backend, frontend
                      Default: setup
    -Backend          Setup only backend
    -Frontend         Setup only frontend
    -All              Setup both (same as no flags)

EXAMPLES:
    .\setup.ps1                    # Full setup (backend + frontend)
    .\setup.ps1 -Backend           # Setup only backend
    .\setup.ps1 -Frontend          # Setup only frontend
    .\setup.ps1 -Action start      # Start both services (after setup)

FIRST TIME SETUP:
    1. .\setup.ps1                 # Install everything
    2. Edit backend/.env and add your LLM_API_KEY
    3. .\setup.ps1 -Action start   # Start the services

REQUIREMENTS:
    - Python 3.10 or higher
    - Node.js 18 or higher
    - Git

FOR MORE INFO:
    See ../SKILL.md for full development guide
"@
}

# Main execution
try {
    # Check if user asked for help
    if ($Action -eq "help" -or $Action -eq "-h" -or $Action -eq "--help") {
        Show-Help
        exit 0
    }
    
    # Determine what to setup
    $setupBackend = $Backend -or $All -or ($Action -eq "setup" -and -not $Frontend)
    $setupFrontend = $Frontend -or $All -or ($Action -eq "setup" -and -not $Backend)
    
    if ($Action -eq "setup" -and -not $Backend -and -not $Frontend) {
        $setupBackend = $true
        $setupFrontend = $true
    }
    
    Write-Host @"
╔════════════════════════════════════════════════════╗
║   Story Co-creation Module - Setup Script         ║
╚════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan
    
    Check-Prerequisites
    
    if ($setupBackend) {
        Setup-Backend
    }
    
    if ($setupFrontend) {
        Setup-Frontend
    }
    
    if ($Action -eq "start") {
        Start-Services
    } else {
        Write-Info "✨ Setup complete!"
        Write-Info ""
        Write-Info "Next steps:"
        Write-Info "  1. Edit backend/.env and add your LLM_API_KEY"
        Write-Info "  2. Run: .\setup.ps1 -Action start"
        Write-Info ""
        Write-Info "OR start manually:"
        Write-Info "  Terminal 1: cd backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload"
        Write-Info "  Terminal 2: cd frontend && npm run dev"
    }
    
} catch {
    Write-Error-Custom "❌ Setup failed: $_"
    exit 1
}
