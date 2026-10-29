# TravelGenie AI 🧞‍♂️✈️

> **An intelligent, full-stack AI travel planner and expense management platform powered by Multi-Engine AI (Local SLM + Google Gemini), Django REST Framework, PostgreSQL 16, and React 18.**

---

## 🌟 Key Features

### 🧠 1. Multi-Engine AI Trip Planner (Local SLM & Google Gemini)
- **Engine Selector**: Choose between:
  - ⚡ **Local SLM (`qwen-local`)**: High-speed, private, offline inference via local Ollama daemon. Zero cloud latency and no API token limits.
  - ✨ **Google Gemini API**: Cloud LLM generating world-aware day-by-day itineraries with attractions, timings, and estimated costs.
  - 🔄 **Smart Auto (Failover)**: Automatically queries local SLM first, cascades to Gemini cloud, and gracefully falls back to the dynamic Curated Knowledge Base if offline.
- **Normalized Relational Storage**: Generated itineraries are parsed, validated, and persisted into structured relational tables (`Trip`, `DayPlan`, `Activity`).
- **Resilient Geocoding**: Destination coordinates resolution with automatic offline coordinate fallbacks for Leaflet map markers.

### 🗺️ 2. Interactive Leaflet Maps & Navigation
- **Destination & Route Visualizer**: Dynamic OpenStreetMap pins rendered using Leaflet and React-Leaflet.
- **Turn-by-Turn Navigation**: Interactive popup cards with one-click deep links to Google Maps directions.

### 💰 3. Smart Budget Planner & Expense Tracker (`/budget`)
- **Trip Target Budget**: Set and update financial allocations per trip with instant backend persistence.
- **Real-Time Utilization Progress Bar**: Dynamic visual warning indicators as spending approaches or exceeds the budget limit.
- **Categorical Breakdown**: Live aggregation across categories (Transport, Lodging, Food, Activities, Shopping, Miscellaneous) calculating balance remaining.

### 🛫 4. Live Travel Bookings Hub & Reservations (`/bookings`)
- **Interactive Reservations Manager**: Full CRUD for logging flight, hotel, and rental bookings with reference numbers and costs.
- **Dynamic Search Cards**: Pre-fills travel destinations and dates for:
  - ✈️ **Google Flights**: Deep link route searching.
  - 🏨 **Booking.com**: Instant city and check-in/out accommodation lookups.
  - 🏡 **Airbnb**: Vacation rental search bound to destination and party size.

### 🔐 5. Database Security, RBAC & Authentication
- **Argon2id Password Hashing**: Utilizes industry-standard `Argon2PasswordHasher` (`argon2-cffi`) as primary hasher, with BCrypt fallback.
- **SQL Injection Prevention**: Built with Django ORM parameterized queries (prepared statements), ensuring user data is never concatenated into raw SQL.
- **Stateless JWT Auth**: SimpleJWT (Access + Refresh tokens) with Axios interceptors for automatic token injection and refresh.
- **Token Blacklisting**: Revokes tokens upon server-side logout to eliminate session replay vulnerabilities.
- **Admin Analytics Console (`/admin`)**: Metric overviews, user management, and system-wide trip audits.

### ☀️ 6. Live Meteorological Forecasts (`/weather`)
- **Real-Time Weather Widget**: Dynamic weather forecasts and temperature tracking powered by the Open-Meteo API.

---

## 🏗️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Leaflet / React-Leaflet, Lucide Icons, Axios |
| **Backend** | Python 3.12, Django 5.x, Django REST Framework (DRF), SimpleJWT, Django CORS Headers, Python-Decouple |
| **Database** | PostgreSQL 16 (Relational Schema, Views, Triggers, Stored Procedures, Composite Indices) |
| **AI / SLM** | Local Ollama (`qwen-local` / `qwen2.5`) + Google Gemini 1.5/2.5 Flash API |
| **Security** | Argon2id (`argon2-cffi`), BCrypt, Parameterized Prepared Statements, Token Blacklisting |
| **DevOps & CI/CD** | Docker, Docker Compose, GitHub Actions (`.github/workflows/ci.yml`), Nginx |

---

## 🗂️ Project Directory Structure

```text
Travel-Genie/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI (Django tests + Vite build)
├── backend/
│   ├── travelgenie/              # Django core settings, URLs, WSGI/ASGI
│   ├── accounts/                 # Custom User, Argon2 hashing, JWT auth, RBAC
│   ├── trips/                    # Trips, Itineraries, Destinations, Activities
│   │   └── migrations/
│   │       ├── 0001_initial.py
│   │       ├── 0002_raw_sql.py   # PostgreSQL view, triggers, and stored procedures
│   │       └── 0003_alter_trip_status.py
│   ├── budget/                   # Budgets and expense tracking aggregates
│   │   └── migrations/
│   │       └── 0003_add_description_column.py
│   ├── bookings/                 # Live booking endpoints and reservation records
│   ├── ai_planner/               # Dual AI engine: Ollama SLM + Gemini API
│   ├── admin_panel/              # Platform analytics & admin endpoints
│   ├── datadump.json             # Seed database with sample users and trips
│   ├── requirements.txt          # Python dependencies
│   ├── manage.py
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                  # Centralized Axios API modules (auth, ai, budget, trips)
│   │   ├── components/           # AiEngineSelector, Navbar, Map, WeatherWidget
│   │   ├── context/              # AuthContext (JWT session state)
│   │   └── pages/                # Dashboard, NewTrip, TripDetail, Budget, Bookings, MapPage, Admin
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml            # Multi-container orchestration (Postgres, Backend, Frontend)
├── start.bat                     # 1-Click automated Windows launcher
├── README_FOR_WINDOWS.md         # Windows setup guide
├── README_FOR_MAC.md             # macOS setup guide
└── README.md                     # Main documentation
```

---

## 🚀 Getting Started

### Option 1: One-Click Launch on Windows (Docker Desktop)
1. Ensure **Docker Desktop** is running.
2. Double-click **`start.bat`** in the project root.
3. The script automatically builds containers, initializes PostgreSQL, imports initial demo data from `datadump.json`, and opens the browser.

---

### Option 2: Docker Compose (macOS / Linux / Windows)
1. Ensure Docker is running.
2. Build and start containers in the background:
   ```bash
   docker compose up --build -d
   ```
3. Load demo users and seed data:
   ```bash
   docker compose exec backend python manage.py loaddata datadump.json
   ```
4. Access the applications:
   - **Web App (Frontend):** [http://localhost:5173](http://localhost:5173) *(or [http://localhost:3000](http://localhost:3000))*
   - **Backend API:** [http://localhost:8000/api/](http://localhost:8000/api/)
   - **Django Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

### Option 3: Native Local Setup (Without Docker)

#### 1. Backend Setup:
```bash
cd backend
python -m venv venv

# Activate venv:
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata datadump.json
python manage.py runserver 8000
```

#### 2. Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Default Credentials (After Seeding)

| Role | Username / Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@travelgenie.com` | `admin123` | Full Access + Admin Panel (`/admin`) + Django Admin |
| **Traveler (Johith)** | `johithbabu2006@gmail.com` | `admin123` | Itinerary planner, Budgeting, Bookings |
| **Traveler (Bassil)** | `bassilh2006@gmail.com` | `admin123` | Itinerary planner, Budgeting, Bookings |

---

## 🗄️ Advanced Database & Security Architecture

- **Argon2id Hashing**: Password hashes are computed using memory-hard Argon2 (`argon2$argon2id$v=19$...`), securing user records against brute-force attacks.
- **SQL Injection Prevention**: Django ORM compiles all data lookups into parameterized prepared statements (`%s`), isolating raw user input from SQL execution logic.
- **Database View (`v_trip_cost_summary`)**: Aggregates trip target budgets, cumulative expenses, and remaining budget directly at the SQL engine level.
- **Stored Procedure (`sp_trip_budget_report`)**: Pre-compiled database routine calculating categorical budget distributions.
- **PostgreSQL Trigger (`trg_expense_after_insert`)**: Automatically monitors expenditure on `budget_expense` insertions and updates `trips_trip.status = 'over_budget'` when thresholds are crossed.
- **Native Backup & Recovery**:
  - **Backup:** `pg_dump -U postgres -d travelgenie -F c -f travelgenie_backup.dump`
  - **Restore:** `pg_restore -U postgres -d travelgenie --clean travelgenie_backup.dump`

---

## 🧪 Testing & CI/CD Pipeline

Continuous Integration runs on every push and pull request via GitHub Actions:
- **Backend**: Runs Django unit tests and system integrity checks.
- **Frontend**: Runs production Vite bundling (`npm run build`) ensuring zero syntax or import errors.

To run tests locally:
```bash
# Backend tests
cd backend && python manage.py test

# Frontend build check
cd frontend && npm run build
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
