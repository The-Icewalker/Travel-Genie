# TravelGenie AI - macOS Quickstart Guide

This project is fully dockerized and ready to run on macOS (Apple Silicon M1/M2/M3/M4 or Intel).

## Prerequisites
1. Install **Docker Desktop for Mac**: https://www.docker.com/products/docker-desktop/
2. Ensure Docker Desktop is running.

## Quickstart (2 Steps)

### Step 1: Start the Application
Open Terminal in this folder and run:
\\ash
docker compose up --build -d
\
### Step 2: Load Initial Data & Users (Bassil, Demo, Admin)
\\ash
docker compose exec backend python manage.py loaddata datadump.json
\
### Step 3: Open in Browser
- **TravelGenie Web App:** http://localhost:5173
- **Admin Panel (Django):** http://localhost:8000/admin/
  - **Email / Username:** \dmin@travelgenie.com  - **Password:** \dmin123