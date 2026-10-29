# TravelGenie AI - Windows Quickstart Guide

This project is fully dockerized and ready to run on Windows 10/11 with Docker Desktop (WSL2).

## Prerequisites
1. Install **Docker Desktop for Windows**: https://www.docker.com/products/docker-desktop/
2. Ensure Docker Desktop is running (you should see the little whale icon in your taskbar tray).

## Quickstart Option A: Double-Click (Automated)
Simply double-click the **start.bat** file included in this folder!
It will automatically build the containers, start the app, import the database, and launch your browser.

## Quickstart Option B: Manual (PowerShell / Command Prompt)
Open PowerShell in this folder and run:

```powershell
# 1. Build and start containers in the background
docker compose up --build -d

# 2. Load all users (Bassil, Demo, Admin) and trips
docker compose exec backend python manage.py loaddata datadump.json
```

## Access Links
- **TravelGenie Web App:** http://localhost:5173
- **Admin Panel (Django):** http://localhost:8000/admin/
  - **Email / Username:** `admin@travelgenie.com`
  - **Password:** `admin123`
