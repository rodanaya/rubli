# RUBLI frontend

React 19 + TypeScript + Vite single-page app for [rubli.xyz](https://rubli.xyz). Tailwind 4, TanStack Query, react-i18next (Spanish and English), Recharts and hand-written SVG for charts.

## Run it

Node 22 (the version the Docker build uses).

```bash
cd frontend
npm ci                 # add --legacy-peer-deps if npm reports a peer-dependency conflict
npm run dev            # http://localhost:3009
```

### Without a local database

The backend needs the multi-GB SQLite database. To work on the UI without it, point the dev proxy at the public API:

```bash
VITE_API_URL=https://rubli.xyz npm run dev
```

or put `VITE_API_URL=https://rubli.xyz` in `frontend/.env.local` (gitignored). Read-only pages work; write endpoints need a key you won't have.

## How it talks to the API

The app calls relative URLs under `/api/v1` (`src/api/client.ts`). In development, Vite proxies `/api/` to `VITE_API_URL` (default `http://127.0.0.1:8001`, the local `uvicorn api.main:app --port 8001` started from `backend/`). In production, Caddy terminates TLS and forwards everything to the frontend container, whose nginx serves `dist/` and proxies `/api/` to the backend container (`nginx.conf`). See [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md) and [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Environment variables

| Variable | Read by | Purpose |
|---|---|---|
| `VITE_API_URL` | `vite.config.ts` | Dev-proxy target for `/api/` |
| `VITE_API_BASE_URL` | `src/api/client.ts` | Override the `/api/v1` base path in a build |
| `VITE_APP_URL` | citations | Canonical site URL used in citation blocks (defaults to the current origin) |
| `VITE_REQUIRE_AUTH` | `src/App.tsx` | `1` puts the app behind login (off by default) |
| `VITE_RUBLI_WRITE_KEY` | `src/api/client.ts` | Local development only. Never set it in a production build: Vite inlines it into the bundle |
| `VITE_SENTRY_DSN` | error reporting | Optional |

Copy `frontend/.env.example` to `frontend/.env.local` to start.

## Gates (run before a PR)

```bash
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json   # strict: unused locals/params fail
npm run build                                                        # tsc -b + vite build
npm run lint:tokens                                                  # raw hex / forbidden Tailwind classes
npm run test:run                                                     # vitest
```

`npm run test:e2e` runs the Playwright specs in `e2e/` against a running dev server.

## Conventions

- Risk levels come from `getRiskLevelFromScore` in `src/lib/constants.ts`; colours from the design tokens, not hex literals ([docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md)).
- Every visible string is bilingual (locale files in `src/i18n/locales/{es,en}`).
- Scores are **risk indicators**, never "probability of corruption"; the case set is "labelled cases", not verified corruption. See [CONTRIBUTING.md](../CONTRIBUTING.md).
