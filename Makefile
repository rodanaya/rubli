# RUBLI developer tasks (Linux/macOS; on Windows use Git Bash + make, or run the
# commands shown in each recipe by hand: `.venv\Scripts\python` replaces `.venv/bin/python`).
#
#   make setup      create .venv, install backend + frontend deps, copy env examples
#   make backend    API on http://127.0.0.1:8001 (needs backend/RUBLI_NORMALIZED.db or DATABASE_PATH)
#   make frontend   Vite dev server on http://localhost:3009 (proxies /api to the backend)
#   make test       backend pytest (DB-dependent tests skip without the database) + frontend vitest
#   make lint       ruff (error-class rules) + frontend lint:tokens + tsc
#   make build      production frontend bundle in frontend/dist

PYTHON ?= python3
VENV   := .venv
PY     := $(VENV)/bin/python

# Export backend/.env (if present) to the API process.
-include backend/.env
export

.PHONY: setup backend frontend test lint build

$(PY):
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install --upgrade pip

setup: $(PY)
	$(PY) -m pip install -r backend/requirements.txt
	cd frontend && npm ci
	[ -f backend/.env ] || cp backend/.env.example backend/.env
	[ -f frontend/.env.local ] || cp frontend/.env.example frontend/.env.local

backend:
	cd backend && ../$(PY) -m uvicorn api.main:app --reload --port 8001

frontend:
	cd frontend && npm run dev

test:
	cd backend && ../$(PY) -m pytest tests/ -q --tb=short -p no:cacheprovider
	cd frontend && npm run test:run

lint:
	$(PY) -m ruff check backend --select E9,F63,F7,F82
	cd frontend && npm run lint:tokens && npx tsc --noEmit -p tsconfig.app.json

build:
	cd frontend && npm run build
