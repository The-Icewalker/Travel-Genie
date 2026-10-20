# TravelGenie AI 🧞‍♂️✈️

> **An intelligent, full-stack AI travel planner and expense management platform powered by Google Gemini, Django REST Framework, PostgreSQL, and React.**

---

## 🌟 Key Features

### 🧠 1. AI-Powered Trip Generator (Google Gemini 2.5 Flash)
- **Instant Structured Itineraries:** Generates day-by-day activities, estimated timings, attraction highlights, and cost estimates tailored to user preferences and trip duration.
- **Normalized Relational Storage:** AI-generated plans are automatically parsed, validated, and normalized into relational database tables (`Trips`, `ItineraryDays`, `Activities`).
- **Resilient Geocoding:** Automatic coordinates resolution with fallback coordinate mapping for offline and map rendering safety.

### 🗺️ 2. Interactive Leaflet Maps & Navigation
- **Visualized Itineraries:** Custom map markers indicating destinations, attractions, and daily stops using OpenStreetMap and Leaflet.
- **1-Click Google Maps Routing:** Popups feature direct navigation buttons linking to Google Maps turn-by-turn directions.

### 💰 3. Smart Budget Planner & Expense Tracker
- **Set Trip Budget:** Dynamic budget allocation per trip with instant backend upsert.
- **Visual Progress Bar:** Real-time budget utilization indicator with dynamic color warning when nearing or exceeding allocated funds.
- **Category Breakdown:** Categorized expense tracking (Transport, Lodging, Food, Activities, Shopping, Miscellaneous) with live calculation of balance remaining.

### 🛫 4. Live Travel Bookings Hub (`/bookings`)
- **Unified Booking Providers:** Side-by-side search cards for:
  - ✈️ **Google Flights:** Dynamic deep links with origin, destination, and outbound/return travel dates.
  - 🏨 **Booking.com:** Instant accommodation search with matching city and check-in/out dates.
  - 🏡 **Airbnb:** Vacation rentals with dynamic destination and guest count parameter binding.
- **Pre-filled Search:** Automatically binds destination and travel dates from the selected trip.

### 🔐 5. Role-Based Access Control (RBAC) & Authentication
- **Secure Authentication:** JWT authentication (Access & Refresh tokens) with automatic token refresh in frontend Axios interceptors.
- **Token Blacklisting:** Secure server-side logout preventing reuse of revoked tokens.
- **Admin Analytics Dashboard (`/admin`):** Dedicated administrative console with platform metrics, user management, and trip statistics.

### ☀️ 6. Real-time Weather Widget
- **Live Forecasts:** Live meteorological conditions powered by the Open-Meteo API for trip destinations.

---

## 🏗️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Leaflet / React-Leaflet, Lucide Icons, Axios |
| **Backend** | Python 3.12, Django 5.x, Django REST Framework (DRF), SimpleJWT, Django CORS Headers |
| **Database** | PostgreSQL 16 (Advanced SQL: Views, Triggers, Stored Procedures, Composite Indices) |
| **AI Engine** | Google Gemini 2.5 Flash API (`google-generativeai`) |
| **Containerization** | Docker, Docker Compose, Nginx |

---

## 🗂️ Project Directory Structure

```text
travelgenie-ai/
├── backend/
│   ├── travelgenie/          # Django core settings, URLs, WSGI
│   ├── accounts/             # Custom User, JWT auth, RBAC permissions
│   ├── trips/                # Trips, Itineraries, Destinations, Attractions
│   │   └── migrations/
│   │       ├── 0001_initial.py
│   │       └── 0002_raw_sql.py # PostgreSQL view, triggers, and procedures
│   ├── budget/               # Budgets and expense tracking aggregates
│   ├── bookings/             # Live booking endpoints and atomic records
│   ├── ai_planner/           # Gemini API integration and normalization
│   ├── admin_panel/          # Analytics and administrative endpoints
│   ├── requirements.txt
│   ├── manage.py
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/              # Centralized Axios API services
│   │   ├── components/       # Navbar, WeatherWidget, Map, ProtectedRoute
│   │   ├── context/          # AuthContext for session management
│   │   └── pages/            # Dashboard, Trips, Budget, Bookings, Admin, Auth
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
├── run_local_without_docker.bat # 1-Click native Windows launcher
├── docker-compose.yml        # Multi-container orchestration
└── README.md
```

---

## 🚀 Getting Started

### Option A: 1-Click Launch on Windows (Recommended for Local Dev)

If you are on Windows with PostgreSQL and Python installed:

1. Double-click **`run_local_without_docker.bat`** (or run it in Command Prompt / PowerShell):
   ```cmd
   .\run_local_without_docker.bat
   ```
2. The launcher will:
   - Ensure the PostgreSQL service is running.
   - Run database migrations and seed default data.
   - Launch the Django backend on `http://localhost:8000`.
   - Launch the React frontend on `http://localhost:3000`.

---

### Option B: Docker Compose (Full Stack in Containers)

1. Make sure **Docker Desktop** is running.
2. In the project root directory, run:
   ```bash
   docker compose up --build
   ```
3. In a separate terminal, seed initial demo data:
   ```bash
   docker compose exec backend python manage.py seed_data
   ```
4. Access the applications:
   - **Frontend:** [http://localhost:3000](http://localhost:3000)
   - **Backend API:** [http://localhost:8000/api/](http://localhost:8000/api/)
   - **Django Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

### Option C: Manual Step-by-Step Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver 8000
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Default Credentials (After Seeding)

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@travelgenie.com` | `Admin@123` | Full access + Admin Panel (`/admin`) |
| **Traveler** | `traveler@travelgenie.com` | `Travel@123` | Personal trips, Budget, Bookings |

---

## 🗄️ Advanced Database & SQL Implementation

- **3NF Relational Schema:** Strictly normalized across 12 relational tables preventing update anomalies.
- **Database View (`v_trip_cost_summary`):** High-performance view aggregating total budget, expenses, and remaining balance.
- **Stored Procedure (`sp_trip_budget_report`):** Optimized stored procedure delivering categorical expense breakdowns directly from the database engine.
- **PostgreSQL Trigger (`trg_expense_after_insert`):** Automatically evaluates total spending after an expense insert and updates the trip status to `over_budget` if spending exceeds the target budget.
- **ACID Transactions:** Atomic operations ensuring data consistency when generating itineraries and recording bookings with associated expenses.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
