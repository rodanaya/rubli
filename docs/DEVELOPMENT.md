# Development guide

How to run RUBLI locally, where the data comes from, and which checks a change must pass.

---

## Prerequisites

- Python **3.11** (CI and the Docker image use 3.11; avoid backslashes inside f-string expressions for compatibility)
- Node.js **22** (CI; 20 also works) with npm
- Git
- ~10 GB free disk if you build the database yourself

## 0. One-command setup (Linux, macOS, Git Bash)

A top-level `Makefile` wraps the commands below:

```bash
make setup      # .venv + backend and frontend dependencies; copies backend/.env.example and frontend/.env.example
make backend    # API on http://127.0.0.1:8001 (needs a database, see below)
make frontend   # Vite on http://localhost:3009
make test       # backend pytest + frontend vitest
make lint       # ruff (error-class rules) + lint:tokens + tsc
make build      # production frontend bundle
```

On Windows without `make`, run the recipe commands by hand.

## 1. Frontend only (no database needed)

The quickest way to work on the UI is to point the Vite dev proxy at the public API:

```bash
cd frontend
npm install            # add --legacy-peer-deps if npm reports a peer-dependency conflict
VITE_API_URL=https://rubli.xyz npm run dev
# PowerShell: $env:VITE_API_URL="https://rubli.xyz"; npm run dev
```

Open <http://localhost:3009> (the port is strict; if 3009 is busy, run `npm run dev -- --port 3010`). The proxy forwards `/api` to the target, so no CORS setup is needed. Please be gentle with the public API: it is rate-limited.

## 2. Full stack

```bash
# Backend — port 8001 (run from backend/, the module is api.main)
python -m venv .venv && source .venv/bin/activate     # repo-root .venv, as in the Makefile. Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt  # API + tests; requirements-scripts.txt adds the ML / entity-resolution pipeline
cd backend
uvicorn api.main:app --port 8001 --host 127.0.0.1 --reload

# Frontend — second terminal, from the repository root; port 3009, proxies /api to http://127.0.0.1:8001 by default
cd frontend
npm install
npm run dev
```

| URL | What |
|---|---|
| <http://localhost:3009> | Site |
| <http://127.0.0.1:8001/docs> | OpenAPI explorer (start with `ENABLE_DOCS=true`) |
| <http://127.0.0.1:8001/health> | Health check |

On first boot the backend runs integrity checks over the whole `contracts` table. Expect 30–60 seconds before it answers. On Windows, use `127.0.0.1` rather than `localhost` to avoid a slow DNS fallback.

### Configuration

The backend reads environment variables; the defaults suit local development. Every variable is listed with a comment in `backend/.env.example` and `frontend/.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_PATH` | `backend/RUBLI_NORMALIZED.db` | SQLite file to serve |
| `CORS_ORIGINS` | `http://localhost:3009,http://127.0.0.1:3009` | Comma-separated; `*` is rejected |
| `RUBLI_WRITE_KEY` | unset | Shared key for write endpoints (workspace, review, pipeline triggers) |
| `RUBLI_JWT_SECRET` | dev fallback | **Must** be set in any deployment |
| `DB_QUERY_TIMEOUT` | built-in | Per-query timeout in seconds |
| `ENABLE_DOCS` | `false` | Set to `true` to serve the OpenAPI explorer at `/docs` |
| `RUBLI_ENV` | `dev` | `dev`/`development`/`local`/`test` allow writes without a key when `RUBLI_WRITE_KEY` is unset; any other value (e.g. `production`) makes write endpoints fail closed (503) without the key |
| `SENTRY_DSN` | unset | Optional error reporting |

Frontend: `VITE_API_URL` (dev proxy target).

## Getting a database

The database is **not** in the repository: it is several GB, and the raw registries it is built from include personal data that must not be redistributed. You have two options.

**A. Work against the public API** (§1). This is enough for most frontend work and for reading data.

**B. Build from public sources.** The ingest is reproducible; the risk scores are only partly reproducible (see below). Install the pipeline extras first: `pip install -r backend/requirements-scripts.txt` (it includes `requirements.txt` and `requirements-api.txt`).

1. Download the CompraNet open-data contract files (`Contratos_CompraNet<year>`, XLSX for 2002–2022 and CSV for 2023–2025) into `original_data/` at the repository root. This folder is git-ignored.
2. Create the schema and load:
   ```bash
   cd backend
   python -m scripts.etl_create_schema
   python -m scripts.etl_pipeline           # validates amounts: >100B rejected, >10B flagged
   python -m scripts.etl_classify           # sectors / categories
   ```
3. Optional registries: `load_sat_efos.py`, `load_sfp_sanctions.py`, `load_rupc.py`, `scrape_asf.py`.
4. Features and baselines: `compute_factor_baselines.py`, then `compute_z_features.py`.
5. Aggregates: `_refresh_stats_tables.py`, `precompute_stats.py`.
6. ARIA: `python -m scripts.aria_init_schema && python -m scripts.aria_pipeline`.

**What you cannot fully reproduce today:** the v0.8.5 coefficients are documented in [RISK_METHODOLOGY.md](RISK_METHODOLOGY.md), but the training script, the train/test split and the builder of the five v2 features are not in the repository. The ComprasMX collector is not included either. Read [SCORING.md](SCORING.md) before running any scoring script: several older scorers still exist and will overwrite active scores with a retired model.

## 3. Checks a change must pass

CI runs the same commands (`.github/workflows/`).

### Backend

```bash
python -m pytest backend/tests/ -q --tb=short -p no:cacheprovider
```

Tests that need the full database skip themselves, with a reason, when it is absent. Without a database about 230 tests run and about 700 skip. CI runs this database-free configuration.

### Frontend

Run from `frontend/`. All must exit with zero errors:

```bash
npx tsc --noEmit -p tsconfig.app.json   # the strict config used by the build (noUnusedLocals/Parameters)
npm run build
npm run lint:tokens                     # rejects raw hex colours and forbidden Tailwind classes in pages/components
npx vitest run                          # unit tests
```

End-to-end tests (Playwright) live in `frontend/e2e/` and need a running stack: `npm run test:e2e`.

## 4. Conventions that reviews enforce

**Data and copy**

- Scores are **risk indicators**. Never write "probability of corruption" or call a vendor corrupt because of a score.
- Use the canonical aggregates (`vendor_stats`, `institution_stats`, `category_stats`), not raw `vendors.avg_risk_score`.
- Risk thresholds come from `getRiskLevelFromScore` in `frontend/src/lib/constants.ts` (0.60 / 0.40 / 0.25). Do not inline them.
- Never return a natural person's RFC from an endpoint. Use the shared masking helpers in `backend/api/pii.py`.
- Parameterised SQL only.

**Frontend**

- Render entities outside their own page with `<EntityIdentityChip>`, and vendor names with `formatVendorName` / `formatEntityName`.
- Pick currency helpers by surface: `formatCompactMXN` for tables, axes and tooltips; `formatDualCurrency` for hero numbers. Spanish output uses Mexican conventions (MDP, *billones*).
- No green for "low risk"; low uses `text-text-muted`.
- All visible strings are bilingual (ES primary, EN) via i18n.

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for chart primitives.

**Database**

- SQLite allows one writer. Run a WAL checkpoint (`backend/scripts/_wal_checkpoint.py`) before schema changes, and back up the file before any mass update.
- Put static FastAPI routes before `/{id}` routes in a router.
- Use cursor pagination for large lists.

## 5. Repository layout

```
backend/
  api/            FastAPI app (main.py, routers/, services/, models/)
  scripts/        ETL, features, scoring, ARIA, registry loaders, precomputes
  hyperion/       Entity-resolution primitives (normalisation, blocking, similarity)
  data/           Small reviewed reference files (crosswalks, seeds)
  tests/          pytest suite
Makefile          Developer tasks (setup, backend, frontend, test, lint, build)
frontend/
  src/pages/      Routed pages
  src/components/ Shared UI and chart primitives
  src/lib/        Constants, formatters, story content
  src/i18n/       ES / EN locales
  e2e/            Playwright specs
scripts/          Deployment and ops shell scripts
docs/             Reference documentation
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend silent for a minute after start | Startup integrity scan; wait |
| `database is locked` | Another writer (an ETL script or a `sqlite3` shell) holds the lock; close it |
| Port 8001 / 3009 in use | Find the PID (`netstat -ano \| findstr :8001` on Windows, `lsof -i :8001` elsewhere) and stop it |
| Frontend shows empty data | Is the backend running, or is `VITE_API_URL` set? |
