@echo off
title TravelGenie AI - Windows Launcher
echo ========================================================
echo         Starting TravelGenie AI on Windows
echo ========================================================
echo.
echo Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first and try again.
    pause
    exit /b 1
)

echo [1/3] Building and starting Docker containers...
docker compose up --build -d

echo.
echo [2/3] Waiting 5 seconds for PostgreSQL database to be ready...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Restoring users and database data...
docker compose exec backend python manage.py loaddata datadump.json

echo.
echo ========================================================
echo   TravelGenie AI is now live!
echo.
echo   Frontend:     http://localhost:5173
echo   Django Admin: http://localhost:8000/admin/
echo   Admin Login:  admin@travelgenie.com / admin123
echo ========================================================
echo.
echo Opening browser...
start http://localhost:5173
pause
