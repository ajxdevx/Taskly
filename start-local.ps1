$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting Taskly..." -ForegroundColor Green

$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (!(Test-Path (Join-Path $Backend ".venv"))) {
  python -m venv (Join-Path $Backend ".venv")
}
& (Join-Path $Backend ".venv\Scripts\python.exe") -m pip install -q -r (Join-Path $Backend "requirements.txt")

if (!(Test-Path (Join-Path $Frontend "node_modules"))) {
  Push-Location $Frontend
  npm install
  Pop-Location
}

Write-Host "Opening backend and frontend (API auto-resets old demo users on startup)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Backend'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Frontend'; npm run dev"

Write-Host ""
Write-Host "Taskly is starting." -ForegroundColor Green
Write-Host "  App:      http://localhost:5173" -ForegroundColor White
Write-Host "  API docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Login:    ajxdevx@taskly.io / demo" -ForegroundColor White
Write-Host ""
