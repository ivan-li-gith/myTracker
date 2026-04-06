# myTracker — Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build a personal life-tracker web app as a free, self-hosted, publicly-deployed default homepage locked down to a single user.

**Architecture:** Decoupled monorepo — `frontend/` (Next.js on Vercel) communicates with `backend/` (FastAPI on Render) via REST API. Neon PostgreSQL is the sole database. Cloudflare Access guards the entire domain at the network edge.

**Tech Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · FastAPI · SQLAlchemy 2.0 (async) · Alembic · Pydantic v2 · Neon PostgreSQL · Render · Vercel · Cloudflare Access · Gemini Flash API (free) · httpx + BeautifulSoup4

---

## Part 1 — Tech Stack Rationale

### Backend Framework: Why FastAPI Wins

| Framework | Pros | Cons | Employer Signal |
|---|---|---|---|
| **FastAPI** | Async-native, Pydantic v2 validation, auto-generated OpenAPI docs, type hints everywhere, Python 3.10+ idioms | Smaller ecosystem than Django | ★★★★★ — dominant in ML/AI companies; shows you know modern Python |
| Django | Batteries-included (admin, ORM, auth), huge community, very mature | Monolithic, REST via DRF is verbose, sync-first, overkill for a personal API | ★★★ — great for web teams, but feels dated for a pure API project |
| Flask | Lightweight, flexible, simple | Requires hand-wiring everything, no async story, no validation, older feel | ★★ — fine for scripts, not competitive portfolio material in 2024+ |

**Verdict: FastAPI.** It is the default choice at ML, fintech, and backend-heavy startups. Its auto-generated `/docs` Swagger UI is a built-in portfolio demo. Pydantic v2 models show type discipline that interviewers respect. Being async-first prepares you for high-concurrency backend roles. This aligns with your ML background — the same companies hiring ML engineers expect FastAPI proficiency.

### Frontend: Next.js 14 (App Router)

- **Why not plain React/Vite?** Next.js adds SSR/SSG (important for fast initial loads), file-based routing, and is the industry standard for React in 2024. App Router with React Server Components is what every senior frontend role now expects.
- Tailwind CSS: utility-first, very fast to build with, avoids CSS file sprawl.
- TypeScript: non-negotiable for a portfolio project. Type-safe API calls via generated types show engineering discipline.

### Database: Neon PostgreSQL

- Serverless PostgreSQL — pauses when idle, wakes on request. Free tier: 0.5 GB storage, unlimited requests.
- Pairs perfectly with SQLAlchemy 2.0 async + `asyncpg` driver.
- Alembic handles migrations — same pattern used in every production Python shop.

---

## Part 2 — Free Services & Third-Party APIs

### Hosting

| Service | Purpose | Free Tier |
|---|---|---|
| **Vercel** | Frontend (Next.js) | Unlimited personal deployments, custom domain, edge CDN |
| **Render** | Backend (FastAPI) | 1 free web service; spins down after 15 min idle (acceptable for personal use) |
| **Neon** | PostgreSQL database | 0.5 GB, 1 project, serverless autoscaling |
| **Cloudflare** | DNS + Zero Trust Access | Free for ≤50 users — blocks entire domain behind SSO |

> **Render cold-start note:** The free tier sleeps after 15 minutes of inactivity. Your first request after idle takes ~30 seconds. For a personal homepage this is fine; the frontend can show a loading state.

### AI / LLM (for Job Tracker scraping)

| Service | Model | Free Tier | Best Use |
|---|---|---|---|
| **Google Gemini Flash** (via `google-generativeai`) | `gemini-1.5-flash` | 15 RPM, 1M TPM, 1500 req/day — completely free | Primary: structured extraction from job HTML |
| **Groq** | Llama 3.1 8B / 70B | 30 RPM, 14,400 req/day — completely free | Backup / faster responses |
| **Hugging Face Inference API** | Various open models | Free with rate limits | Last resort |

**Strategy for Job Tracker:** Use `httpx` to fetch raw HTML from the job posting URL → strip to text with `BeautifulSoup4` → send cleaned text to Gemini Flash with a structured extraction prompt → return a JSON object that pre-fills the job table row. The user reviews and edits before saving. No fine-tuning needed.

**Strategy for Recipe URL scraping:** Same pattern — httpx + BS4 to get page text → Gemini Flash to extract title, ingredients, steps, cook time → pre-fill recipe form.

---

## Part 3 — Security & Authentication

### Zero-Cost Auth Architecture

```
User Browser
     │
     ▼
Cloudflare Access (Zero Trust)  ← guards the entire *.yourdomain.com
     │   (Google OAuth login, free, only you are authorized)
     │
     ├──► Vercel (frontend)       ← Next.js, also has middleware check
     │
     └──► Render (backend API)    ← FastAPI HTTP Basic Auth middleware
                                     (second layer, protects direct API hits)
```

**Layer 1 — Cloudflare Access (primary):**
- Create a free Cloudflare account → add your domain → enable Zero Trust.
- Create one "Access Application" covering `*.<yourdomain>.com`.
- Add yourself as the sole authorized user via your Google/GitHub account.
- No one can reach any page without authenticating through Cloudflare first. Zero cost for personal use.

**Layer 2 — FastAPI HTTP Basic Auth (defense in depth):**
- Add a single `Depends(verify_basic_auth)` to all FastAPI routers.
- Credentials stored as environment variables on Render (`API_USER`, `API_PASS`).
- Protects against anyone who somehow bypasses Cloudflare and hits the Render URL directly.
- The Next.js frontend passes these credentials in every API request header.

**Why not JWT/session tokens?** For a single-user personal app behind Cloudflare Access, full JWT auth is unnecessary complexity. HTTP Basic Auth over HTTPS is perfectly secure as a backend fence.

---

## Part 4 — Database Schema

### Core Tables

```
users                          (future-proofing, single row for now)
├── id           SERIAL PK
├── email        TEXT UNIQUE
└── created_at   TIMESTAMPTZ

categories                     (shared across payments and expenses)
├── id           SERIAL PK
├── name         TEXT NOT NULL
└── type         TEXT           -- 'payment' | 'expense'

payments                       (bill / subscription reminders)
├── id           SERIAL PK
├── name         TEXT NOT NULL
├── amount       NUMERIC(10,2)
├── due_date     DATE NOT NULL
├── recurrence   TEXT           -- 'monthly' | 'yearly' | 'one-time'
├── category_id  FK → categories
├── is_paid      BOOLEAN DEFAULT FALSE
└── notes        TEXT

tasks
├── id           SERIAL PK
├── name         TEXT NOT NULL
├── description  TEXT
├── due_date     DATE
├── completed    BOOLEAN DEFAULT FALSE
├── completed_at TIMESTAMPTZ
└── created_at   TIMESTAMPTZ

habits
├── id           SERIAL PK
├── name         TEXT NOT NULL
├── target_freq  INT            -- times per week
├── created_at   TIMESTAMPTZ
└── archived     BOOLEAN DEFAULT FALSE

habit_logs                     (one row per completion event)
├── id           SERIAL PK
├── habit_id     FK → habits
└── logged_at    TIMESTAMPTZ    -- streak computed at query time

job_applications
├── id           SERIAL PK
├── company      TEXT NOT NULL
├── role         TEXT NOT NULL
├── url          TEXT
├── status       TEXT           -- 'applied' | 'phone_screen' | 'interview' | 'offer' | 'rejected'
├── date_applied DATE
├── salary_range TEXT
├── location     TEXT
├── job_type     TEXT           -- 'remote' | 'hybrid' | 'onsite'
├── notes        TEXT
└── created_at   TIMESTAMPTZ

expenses
├── id           SERIAL PK
├── name         TEXT NOT NULL
├── amount       NUMERIC(10,2) NOT NULL
├── date         DATE NOT NULL
├── category_id  FK → categories
└── notes        TEXT

expense_splits                 (bill-splitting sessions, not persisted participants)
├── id           SERIAL PK
├── title        TEXT
├── total        NUMERIC(10,2)
├── participants JSONB          -- [{"name":"Alice","owes":25.00}, ...]
└── created_at   TIMESTAMPTZ

recipes
├── id           SERIAL PK
├── title        TEXT NOT NULL
├── source_url   TEXT
├── ingredients  TEXT           -- markdown / freeform
├── steps        TEXT           -- markdown
├── cook_time    TEXT
├── category     TEXT
├── is_favorite  BOOLEAN DEFAULT FALSE
└── created_at   TIMESTAMPTZ

docs                           (documentation & how-to guides)
├── id           SERIAL PK
├── title        TEXT NOT NULL
├── category     TEXT
├── content      TEXT           -- markdown (supports image/video links)
├── is_favorite  BOOLEAN DEFAULT FALSE
└── created_at   TIMESTAMPTZ
```

### Key Relationships
- `payments.category_id` → `categories` (where `type = 'payment'`)
- `expenses.category_id` → `categories` (where `type = 'expense'`)
- `habit_logs.habit_id` → `habits`
- All other tables are self-contained

### Streak Computation Note
Streaks are computed at query time using a SQL window function or Python logic over `habit_logs`, not stored. This avoids stale state from missed cron resets.

---

## Part 5 — High-Level Architecture

```
myTracker/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, middleware, router registration
│   │   ├── config.py            # Settings (pydantic-settings, env vars)
│   │   ├── database.py          # Async SQLAlchemy engine + session factory
│   │   ├── auth.py              # HTTP Basic Auth dependency
│   │   ├── models/              # SQLAlchemy ORM models (one file per domain)
│   │   │   ├── payments.py
│   │   │   ├── tasks.py
│   │   │   ├── habits.py
│   │   │   ├── jobs.py
│   │   │   ├── expenses.py
│   │   │   ├── recipes.py
│   │   │   └── docs.py
│   │   ├── schemas/             # Pydantic v2 request/response schemas
│   │   │   └── (mirrors models/)
│   │   ├── routers/             # One APIRouter per domain
│   │   │   ├── payments.py
│   │   │   ├── tasks.py
│   │   │   ├── habits.py
│   │   │   ├── jobs.py
│   │   │   ├── expenses.py
│   │   │   ├── recipes.py
│   │   │   ├── docs.py
│   │   │   └── dashboard.py     # Aggregation endpoint
│   │   └── services/
│   │       └── scraper.py       # httpx + BS4 + Gemini Flash logic
│   ├── alembic/                 # Migrations
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile               # (optional, for Render)
│
└── frontend/
    ├── app/                     # Next.js App Router
    │   ├── layout.tsx           # Root layout, nav sidebar
    │   ├── page.tsx             # Dashboard (home)
    │   ├── payments/page.tsx
    │   ├── tasks/page.tsx
    │   ├── habits/page.tsx
    │   ├── jobs/page.tsx
    │   ├── expenses/page.tsx
    │   ├── docs/page.tsx
    │   └── recipes/page.tsx
    ├── components/              # Shared UI components (Table, Modal, Card, etc.)
    ├── lib/
    │   ├── api.ts               # Typed fetch wrapper for all backend calls
    │   └── types.ts             # TypeScript interfaces mirroring Pydantic schemas
    ├── tailwind.config.ts
    └── package.json
```

---

## Part 6 — Phased Implementation Roadmap

Build in this exact order. Each phase produces a working, testable increment.

---

### Phase 0 — Project Scaffold & Infrastructure (Day 1)

**Goal:** Repository exists, both apps run locally, database is connected.

- [ ] Create `myTracker/` directory with `backend/` and `frontend/` subdirectories
- [ ] `git init` at the repo root; create `.gitignore` covering `__pycache__`, `.env`, `.next`, `node_modules`, `*.pyc`
- [ ] **Backend:** Create Python virtual environment (`python -m venv .venv`); install core deps: `fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg alembic pydantic-settings python-dotenv httpx beautifulsoup4 google-generativeai`
- [ ] Create `backend/app/config.py` using `pydantic-settings` to load env vars: `DATABASE_URL`, `API_USER`, `API_PASS`, `GEMINI_API_KEY`
- [ ] Create `backend/app/database.py` with async SQLAlchemy engine and session dependency
- [ ] Create `backend/app/main.py` with a minimal FastAPI app (`GET /health` returns `{"status": "ok"}`)
- [ ] Provision Neon PostgreSQL (free tier at neon.tech); copy connection string to `.env`
- [ ] Run `alembic init alembic`; configure `alembic.ini` and `env.py` to use `DATABASE_URL` from config
- [ ] Verify backend starts: `uvicorn app.main:app --reload` → `curl localhost:8000/health`
- [ ] **Frontend:** `npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir`
- [ ] Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local`
- [ ] Create `frontend/lib/api.ts` — a simple `apiFetch` wrapper that attaches Basic Auth header to every request
- [ ] Verify frontend starts: `npm run dev` → `localhost:3000` renders Next.js default page

---

### Phase 1 — Auth Middleware (Day 1–2)

**Goal:** Every backend endpoint requires credentials; unauthenticated requests get 401.

- [ ] Create `backend/app/auth.py` with a `verify_credentials` FastAPI dependency using `HTTPBasic` from `fastapi.security`
- [ ] Credentials compared using `secrets.compare_digest` (timing-safe) against env vars
- [ ] Add the dependency globally via `app.include_router(..., dependencies=[Depends(verify_credentials)])` for all routers
- [ ] Test: `curl localhost:8000/health` without auth → 401; with correct Basic Auth → 200
- [ ] Add CORS middleware to `main.py` allowing only `http://localhost:3000` (dev) and your Vercel domain (prod)
- [ ] Update `frontend/lib/api.ts` to inject `Authorization: Basic <base64>` header using env vars
- [ ] Test: Next.js app calls `/health` successfully; direct browser hit to API URL fails

---

### Phase 2 — Database Models & First Migration (Day 2)

**Goal:** All tables exist in Neon; Alembic can generate and run migrations.

- [ ] Create all SQLAlchemy ORM models in `backend/app/models/` (one file per domain, see schema above)
- [ ] Create a shared `Base = declarative_base()` in `database.py` that all models import
- [ ] Run `alembic revision --autogenerate -m "initial schema"` — review the generated migration file
- [ ] Run `alembic upgrade head` — verify all tables appear in Neon dashboard
- [ ] Create Pydantic v2 schemas in `backend/app/schemas/` mirroring each model with `Create`, `Update`, and `Read` variants
- [ ] Write a quick smoke test: create one row via SQLAlchemy async session, read it back, assert fields match

---

### Phase 3 — Tasks & Habits (Day 3–4)

**Goal:** Full CRUD for tasks and habits; streak calculation working; frontend pages functional.

- [ ] Create `backend/app/routers/tasks.py` — endpoints: `GET /tasks`, `POST /tasks`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}`
- [ ] Create `backend/app/routers/habits.py` — endpoints: `GET /habits`, `POST /habits`, `POST /habits/{id}/log`, `DELETE /habits/{id}`
- [ ] Implement streak logic: for each habit, query `habit_logs` for the past N days and compute current streak (consecutive weeks with at least `target_freq` logs)
- [ ] Register both routers in `main.py`
- [ ] Verify all endpoints via Swagger UI at `localhost:8000/docs`
- [ ] **Frontend — Tasks page:** Table of tasks with checkbox to mark complete, "Add Task" modal (name, due date, description), filter toggle to hide/show completed
- [ ] **Frontend — Habits page:** Card per habit showing name, target frequency, current streak; "Log Today" button; "Add Habit" modal

---

### Phase 4 — Payment Reminders (Day 4–5)

**Goal:** Bills/subscriptions tracked with due dates; overdue items highlighted.

- [ ] Create `backend/app/routers/payments.py` — full CRUD; include a computed field `days_until_due` in response
- [ ] Create `backend/app/routers/categories.py` — CRUD for categories (shared with expenses)
- [ ] **Frontend — Payments page:** Table sorted by `due_date ASC`; overdue rows highlighted red; "Mark Paid" button resets `is_paid` and bumps `due_date` by one recurrence period; "Add Payment" modal with category dropdown

---

### Phase 5 — Expenses & Expense Divider (Day 5–6)

**Goal:** Personal expenses tracked by category; bill-splitter calculator works without persistence.

- [ ] Create `backend/app/routers/expenses.py` — full CRUD; include aggregate endpoint `GET /expenses/summary` returning total and per-category breakdown for current month
- [ ] **Frontend — Expenses page:** Expense list with category filter and month picker; monthly summary cards at top; editable charge names inline; "Add Expense" modal
- [ ] **Expense Divider sub-section (same page, below expenses):** Purely frontend component — user enters total bill, adds participant names, assigns items or equal split → calculator shows each person's share; "Save Split" hits `POST /expense-splits` to log it for records
- [ ] Create `backend/app/routers/expense_splits.py` — `POST` and `GET` only (splits are read-only records)

---

### Phase 6 — Job Tracker + AI Scraping (Day 6–8)

**Goal:** Job application table populated with one-click URL scraping via Gemini Flash.

- [ ] Create `backend/app/services/scraper.py`:
  - `fetch_and_clean(url: str) -> str`: use `httpx` (with a browser-like User-Agent header) to GET the URL; parse with `BeautifulSoup4`; extract and clean visible text (strip scripts, styles, nav); truncate to ~8000 characters
  - `extract_job_info(raw_text: str) -> dict`: send to Gemini Flash with a structured prompt asking for JSON with fields: `company`, `role`, `location`, `job_type`, `salary_range`; parse and return
- [ ] Create `backend/app/routers/jobs.py`:
  - `POST /jobs/scrape` — accepts `{"url": "..."}`, returns extracted fields (does NOT save yet)
  - Full CRUD for `GET /jobs`, `POST /jobs`, `PATCH /jobs/{id}`, `DELETE /jobs/{id}`
- [ ] **Frontend — Jobs page:** Full-width table with columns: Company, Role, Status (dropdown), Date Applied, Location, Type, Salary, Notes, Link; "Add via URL" button → scrape endpoint pre-fills modal → user reviews and edits → save; "Add Manual" button → blank modal; status column uses colored badges; rows are inline-editable

---

### Phase 7 — Docs & Cookbook (Day 8–10)

**Goal:** Markdown how-to guides and recipe manager, both with favorites and search.

- [ ] Create `backend/app/routers/docs.py` and `backend/app/routers/recipes.py` — full CRUD + `PATCH /{id}/favorite` toggle
- [ ] Add recipe URL scraping to `scraper.py`: `extract_recipe_info(raw_text: str) -> dict` → fields: `title`, `ingredients`, `steps`, `cook_time`, `category`
- [ ] Add `POST /recipes/scrape` endpoint (same pattern as jobs)
- [ ] **Frontend — Docs page:** Left sidebar with category list; main area renders selected doc content as Markdown (use `react-markdown` package); star/unstar toggle; "Add Guide" modal with textarea and category picker; support pasting YouTube/video URLs (rendered as `<iframe>` by `react-markdown` plugin)
- [ ] **Frontend — Recipes page:** Card grid layout; each card shows title, cook time, category, star icon; clicking opens full recipe in modal; "Add via URL" pre-fills via scraper; "Add Manual" opens blank form; category filter tabs at top

---

### Phase 8 — Dashboard (Day 10–11)

**Goal:** The home page aggregates urgent info from all modules into a single glanceable view.

- [ ] Create `backend/app/routers/dashboard.py` — single `GET /dashboard` endpoint that queries:
  - Tasks due today or overdue (not completed)
  - Payments due within 7 days (not paid)
  - Habits with zero logs this week
  - This month's expense total vs last month
  - Job applications in active stages (phone_screen, interview)
- [ ] Return a single JSON response with all sections
- [ ] **Frontend — Dashboard (home page):** Widget cards in a grid layout:
  - "Due Today" task list with quick-complete checkbox
  - "Upcoming Bills" with amount and days remaining
  - "Habit Check-In" with one-click log buttons
  - "Monthly Spend" with amount and trend arrow
  - "Active Applications" count with status badges

---

### Phase 9 — Deployment (Day 11–13)

**Goal:** The app is live on the internet, locked to you, on a custom domain, all free.

#### Backend → Render

- [ ] Create a `render.yaml` (or configure via Render dashboard): web service, Python 3.11, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] Add all env vars (`DATABASE_URL`, `API_USER`, `API_PASS`, `GEMINI_API_KEY`) in Render dashboard under "Environment"
- [ ] Push `backend/` to GitHub and connect to Render; trigger first deploy
- [ ] Verify: `curl https://your-app.onrender.com/health` with Basic Auth header returns 200

#### Frontend → Vercel

- [ ] Connect `frontend/` (or the monorepo root) to Vercel; set root directory to `frontend/`
- [ ] Add env var `NEXT_PUBLIC_API_URL=https://your-app.onrender.com` in Vercel dashboard
- [ ] Deploy; verify all API calls succeed from the Vercel preview URL

#### Auth → Cloudflare Access

- [ ] Add your domain to Cloudflare (free); update DNS nameservers
- [ ] In Zero Trust dashboard → Access → Applications → "Add Application" → Self-hosted
- [ ] Set domain to `*.<yourdomain>.com`; add an "Allow" policy with your email address as the sole user
- [ ] Test: open an incognito browser → navigating to your domain prompts Cloudflare login → only your account gets through
- [ ] Update CORS in FastAPI `main.py` to allow `https://<yourdomain>.com`

---

### Phase 10 — Polish (Day 13–14)

**Goal:** Production-ready quality — loading states, error handling, mobile responsiveness.

- [ ] Add a loading skeleton component shown while API calls are in-flight
- [ ] Add toast notifications for create/update/delete success and error states (use `react-hot-toast`)
- [ ] Ensure all pages are mobile-responsive (Tailwind responsive prefixes: `sm:`, `md:`, `lg:`)
- [ ] Add a navigation sidebar that collapses to a hamburger menu on mobile
- [ ] Handle Render cold-start: show a "Connecting to backend..." banner if `/health` takes > 3 seconds
- [ ] Write `README.md` documenting local dev setup and deployment steps (this doubles as portfolio documentation)

---

## Summary

| Phase | Deliverable | Days |
|---|---|---|
| 0 | Repo scaffold, both apps run locally | 1 |
| 1 | Auth middleware, CORS, secure API | 1–2 |
| 2 | Full database schema migrated to Neon | 2 |
| 3 | Tasks & Habits (full CRUD + streaks) | 3–4 |
| 4 | Payment Reminders | 4–5 |
| 5 | Expenses & Bill Splitter | 5–6 |
| 6 | Job Tracker + AI URL scraping | 6–8 |
| 7 | Docs & Cookbook (markdown + scraping) | 8–10 |
| 8 | Dashboard home page | 10–11 |
| 9 | Full deployment (Render + Vercel + Cloudflare) | 11–13 |
| 10 | Polish, mobile, error handling | 13–14 |

**Total estimated time:** 2 weeks of focused evening/weekend work for a new grad comfortable in Python. Each phase produces a working, committable increment — you can stop after any phase and have a real, usable tool.
