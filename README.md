# RUBLI

**AI-Powered Corruption Detection Platform for Mexican Government Procurement**

[![Backend Tests](https://github.com/rodanaya/rubli/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/rodanaya/rubli/actions/workflows/backend-tests.yml)
[![Frontend Tests](https://github.com/rodanaya/rubli/actions/workflows/frontend-tests.yml/badge.svg)](https://github.com/rodanaya/rubli/actions/workflows/frontend-tests.yml)
[![CodeQL](https://github.com/rodanaya/rubli/actions/workflows/codeql.yml/badge.svg)](https://github.com/rodanaya/rubli/actions/workflows/codeql.yml)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://rubli.xyz)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

🔴 **Live at [rubli.xyz](https://rubli.xyz)**

---

## The Pitch

Mexico's federal government awarded **3.1 million contracts** worth **9.9 trillion pesos** between 2002 and 2025. Most were never investigated. RUBLI changes that.

Using a statistical risk model trained on RUBLI's labelled case set, RUBLI ranks procurement contracts by how closely they resemble contracts in known cases — ghost companies, bid rigging, vendor monopolization, price manipulation — and surfaces them to journalists, auditors, and civil society researchers.

**10.95% of scored contracts (334,075 of 3,051,294) score high or critical.** That rate was set to fall inside RUBLI's own 2–15% calibration target; it is a triage threshold, not an estimate of how much procurement is corrupt.

> **Score interpretation**: Risk scores measure statistical similarity to contracts in labelled cases — not proof of wrongdoing. Use for investigation triage only.

---

## Five Key Findings

1. **10.95%** of scored federal contracts score high or critical on the risk indicator (a triage signal, calibrated to RUBLI's own 2–15% target)
2. **79%** of AMLO-era contracts (Dec 2018–Sep 2024) were direct awards — the highest rate of any administration since 2010 (procedure type is not coded in the 2002–2009 records)
3. **1,427 labelled cases** anchor the model: 363 from press reports, 25 from official records, 1 audit report, and 989 leads the model or ARIA surfaced and analysts wrote up. Most are not adjudicated findings.
4. **Health and Agriculture** sectors concentrate the highest-risk spending: IMSS ghost companies, Segalmex food fraud, COVID-19 procurement abuse
5. The **ghost company problem** is structural: SAT's EFOS registry lists 13,960 definitive fiscal phantoms — most have never been investigated at the contract level

---

## Platform Stats

| Metric | Value |
|--------|-------|
| Contracts scored | **3,051,294** |
| Validated procurement value | **~9.9T MXN** (≈ US$580B real 2024) |
| Vendors tracked | **320,429** |
| Institutions | **4,456** |
| Active risk model | **v0.8.5** (one global ElasticNet, sector-and-year z-score features) |
| Out-of-sample AUC-ROC | **0.656** (forward holdout: vendors added to the case set after training) |
| In-sample AUC-ROC | **0.733** (contract level, all labelled-case contracts) |
| Labelled cases | **1,427** (389 press/official/audit; 989 model-surfaced analyst leads) |
| High-risk rate | **10.95%** — critical 4.98% + high 5.97% |
| ARIA investigation queue | **248,944 vendors** — T1=299 (all already in the case set), T2=1,488 |

The originally reported v0.8.5 test AUC of 0.785 could not be reproduced (the training split was not saved) and is no longer cited.

---

## What It Detects

Six corruption typologies documented in the academic and anti-corruption literature:

| Pattern | Signal | Examples in DB |
|---------|--------|----------------|
| **Ghost company networks** | Vendor has no real operations; registered to phantom addresses | IMSS, La Estafa Maestra, SAT EFOS |
| **Vendor monopolization** | Single vendor captures >30% of institutional budget | Voucher-issuer market (see `el-cartel-de-los-vales` story) |
| **Bid rigging** | Competitors consistently bid together but never win against each other | SixSigma/SAT tender |
| **Overpricing** | Contract amounts 3× above sector median | IPN Cartel de la Limpieza |
| **Conflict of interest** | Politically connected vendors winning contracts | Grupo Higa/Casa Blanca |
| **Emergency procurement abuse** | Crisis procedures used to bypass competition for non-emergency purchases | COVID-19 procurement |

---

## Architecture

```
rubli/
├── backend/                  # Python 3.11 / FastAPI REST API
│   ├── api/
│   │   ├── routers/          # 30+ router modules (60+ endpoints)
│   │   ├── services/         # Business logic layer
│   │   └── main.py           # GZip, CORS, startup checks
│   ├── scripts/              # ETL, risk model training, ARIA pipeline, GT mining
│   └── RUBLI_NORMALIZED.db   # SQLite (~6.4 GB — not in repo)
├── frontend/                 # React 18 + TypeScript + Vite
│   └── src/
│       ├── pages/            # 40+ page components
│       ├── components/       # Shared UI — dot-matrix charts, editorial components
│       ├── api/              # Typed API client
│       ├── i18n/             # ES/EN translations (22+ namespaces)
│       └── hooks/            # Custom React hooks
├── docs/                     # Methodology, model docs, ARIA spec, art direction
│   ├── ART_DIRECTION.md      # Design bible: dot-matrix protocol, typography, color
│   ├── ARIA_SPEC.md          # ARIA investigation pipeline specification
│   └── RISK_METHODOLOGY_v6.md # Active model methodology
└── docker-compose.prod.yml   # Production: backend + frontend + Caddy (HTTPS)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | SQLite (WAL mode), 200MB cache, pre-computed aggregate tables |
| Backend | Python 3.11, FastAPI, uvicorn, service layer pattern |
| Frontend | React 18, TypeScript 5, Vite 5, TanStack Query v5 |
| UI | Tailwind CSS v4, custom editorial dark/light theme |
| Visualization | Custom dot-matrix SVG charts (signature visualization), Recharts for time series |
| Risk Model | Global ElasticNet logistic regression, Elkan & Noto PU-learning, SHAP explanations |
| i18n | react-i18next — Spanish (primary) and English |
| Auth | JWT (python-jose), bcrypt (direct, not passlib), email-validator — `POST /api/v1/auth/{register,login,me,logout}` |
| Deploy | Docker Compose + Caddy (auto-TLS via Let's Encrypt) |

---

## Platform Pages

### Overview

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Intelligence brief — risk distribution, sector heatmap, ARIA alerts |
| Executive Summary | `/executive` | 9-section flagship report for journalists and policymakers |
| Year in Review | `/year-in-review` | Annual snapshot — spending, risk rate, administration comparison |

### Investigate

| Page | Route | Description |
|------|-------|-------------|
| ARIA Queue | `/aria` | Investigation priority queue — T1/T2/T3/T4 tiers, 7 pattern types |
| Administrations | `/administrations` | Presidential comparison: Fox through Sheinbaum (dot-matrix fingerprints) |
| Contracts | `/contracts` | Full contract table — risk filtering, sector, year, bookmarks |
| Spending Categories | `/categories` | CUCOP category-level spend analysis — sexenio comparison |
| Price Intelligence | `/price-analysis` | Pricing anomalies, IQR outlier scatter plots |
| Procurement Calendar | `/procurement-calendar` | Month-by-month award timing — year-end rush, December spikes |
| Collusion Analysis | `/collusion` | Co-bidding ring detection, bid-rotation patterns |
| Vendor Clusters | `/clusters` | Community detection — vendor networks by co-contracting graph |
| State Expenditure | `/states` | Federal funds in state/municipal procurement (484K contracts) |
| Explore | `/explore` | Open-ended filter/search across all contracts |
| Workspace | `/workspace` | Saved vendors, investigation folders, tracked cases |

### Profiles

| Page | Route | Description |
|------|-------|-------------|
| Vendor Profile | `/vendors/:id` | SHAP radar, external records, circuit-board network, collusion signals |
| Vendor Compare | `/vendors/compare` | Side-by-side risk profile comparison for 2 vendors |
| Red Thread | `/thread/:vendorId` | Scroll-driven 6-chapter investigative narrative per vendor |
| Institution Profile | `/institutions/:id` | Vendor concentration, sector exposure, risk trends |
| Institution Compare | `/institutions/compare` | Side-by-side institution risk comparison |
| Institution Scorecards | `/scorecards` | Graded transparency scorecards per institution |
| Institution Report Card | `/report-card` | Semáforo grading — Excelente / Satisfactorio / Regular / Deficiente / Crítico |
| Sector Profile | `/sectors/:id` | Red flag rates, top vendors |
| Contract Detail | `/contracts/:id` | Full risk breakdown with confidence intervals |
| Case Detail | `/cases/:slug` | Fraud type, timeline, detection signals, impact KPIs |
| Investigative Story | `/stories/:slug` | Long-form editorial narrative with bespoke inline charts |

### Understand

| Page | Route | Description |
|------|-------|-------------|
| Sectors | `/sectors` | 12-sector taxonomy with dot-matrix spend visualization |
| Investigations | `/journalists` | 10 original investigative narratives with bespoke inline charts |
| Model Transparency | `/model` | Redirects to `/methodology` |
| Methodology | `/methodology` | Full risk scoring methodology and known limitations |
| API Explorer | `/api-explorer` | Interactive catalog of all 60+ backend endpoints |

---

## Risk Model v0.8.5

The active model (run `CAL-v8-202605020212`, May 2, 2026) is a **single global ElasticNet logistic regression** over 21 z-score features normalized against sector-and-year baselines, with Elkan & Noto PU correction (c = 0.32). 18 features carry non-zero weight; co_bid_rate, price_hyp_confidence and win_rate are regularized to exactly zero.

### Largest coefficients

| Feature | Coefficient | Interpretation |
|---------|------------|----------------|
| **price_volatility** | +0.558 | Vendor contract-size variance vs. sector norm |
| **institution_diversity** | −0.388 | Despite the name, an institution-concentration (HHI) index: single-buyer vendors score *lower*. Runs against the capture pattern — a known limitation. |
| **price_ratio** | +0.358 | Contract amount / sector median (the model does see contract size) |
| **vendor_concentration** | +0.327 | Vendor value share within sector |
| **cobid_herfindahl** | +0.272 | Concentration of co-bidding relationships |
| **recency_z** | −0.247 | Days since the vendor's previous contract: frequent repeat contracting raises the score |
| **amount_residual_z** | −0.187 | Contract amount relative to the vendor's own pattern |
| **network_member_count** | +0.166 | Size of the vendor's name-similarity group |

### Risk Levels

| Level | Threshold | Count | % |
|-------|-----------|-------|---|
| **Critical** | ≥ 0.60 | 152,010 | 4.98% |
| **High** | ≥ 0.40 | 182,065 | 5.97% |
| **Medium** | ≥ 0.25 | 494,149 | 16.19% |
| **Low** | < 0.25 | 2,223,070 | 72.86% |

8,298 contracts loaded after the scoring run are unscored.

### Validation and label quality

- **Out of sample**: AUC 0.656 on 103,889 contracts of the 694 vendors first linked to a case after the run, against contracts of vendors never in the case set.
- **In sample**: AUC 0.733 across all labelled-case contracts (the model saw most of them in training).
- The originally reported test AUC of 0.785 could not be reproduced; the train/test split was not persisted.
- **Labels**: 1,427 cases today (1,401 at training time). 363 press reports, 25 official records, 1 audit report, 989 model- or ARIA-surfaced leads written up by analysts. Unlabelled contracts are treated as negatives. The model is closer to a vendor-risk ranker than a contract-level corruption detector.
- No per-contract confidence intervals are published for v0.8.5.

### Model Evolution

| Version | Reported AUC | GT Cases | Key Advancement |
|---------|--------------|----------|-----------------|
| v3.3 | 0.584 | — | IMF-aligned weighted checklist |
| v4.0 | 0.951 (in-sample) | 9 | Z-score normalization, Mahalanobis |
| v5.1 | 0.957 | 22 | Per-sector sub-models, PU-learning (temporal leakage) |
| v0.6.5 | 0.828 | 748 | Institution-scoped GT, FP exclusions, curriculum learning |
| **v0.8.5** | **0.656** (forward holdout) | **1,401** | Global ElasticNet, 21 features |

*Earlier AUCs were measured on different splits and several were inflated by leakage; they are not comparable with the v0.8.5 forward holdout.*

---

## ARIA: Automated Risk Investigation Algorithm

ARIA is a 9-module pipeline combining risk scores, SHAP explanations, financial scale, and external registries into a unified investigation queue.

```
248,944 vendors
  → IPS score (weighted: risk 40% + anomaly 20% + financial scale 20% + external flags 20%)
  → Pattern classifier (P1–P7: monopoly, ghost, intermediary, bid rigging,
                        overpricing, institutional capture, conflict of interest)
  → Tier assignment (T1: critical / T2: high / T3: medium / T4: monitoring)
  → External cross-reference:
      SAT EFOS 13,960 definitive listings
      SFP sanctions 2,395 records
      RUPC 23,704 contractor registry records
  → Investigation queue with review workflow and memo generation
```

**Current queue:** T1=299 · T2=1,488 · T3=5,578 · T4=241,579. Tier 1 is ground-truth anchored: all 299 T1 vendors are already in the case set, so new leads start in Tier 2.

Full spec: [`docs/ARIA_SPEC.md`](docs/ARIA_SPEC.md)

---

## Design System

RUBLI has a custom editorial design language documented in [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md). The signature element is the **dot-matrix chart** — replacing bar charts throughout the platform.

### The Dot-Matrix Protocol

Each filled dot = one unit of data (stated in the legend). Empty dots = the benchmark. The field of dots reveals the corruption landscape without distorting scale.

```typescript
// Canonical dot-matrix parameters
const N_DOTS  = 50      // dots per row
const DOT_R   = 3       // dot radius (px)
const DOT_GAP = 8       // center-to-center spacing (px)
// EMPTY fill: #f3f1ec (light context) | #2d2926 (dark context)
```

This visualization protocol is used across: Administrations, Sectors, Vendor Profiles, Spending Categories, Ground Truth cases, ARIA queue, and chart components.

### Visual Identity

- **Art provenance**: The Economist · NYT · FT · Der Spiegel
- **Color ground**: cream/parchment `#faf9f6` (light) · near-black warm `#1a1714` (dark)
- **Typography**: Playfair Display (editorial headlines) · Inter (UI/body) · JetBrains Mono (all data values)
- **Risk palette**: red `#ef4444` · amber `#f59e0b` · dark amber `#a16207` · zinc `#71717a`

---

## Data Sources

All procurement data from **COMPRANET**, Mexico's federal electronic procurement system:

| Structure | Years | RFC Coverage | Quality |
|-----------|-------|-------------|---------|
| A | 2002–2010 | 0.1% | Lowest — risk may be underestimated |
| B | 2010–2017 | 15.7% | Better |
| C | 2018–2022 | 30.3% | Good |
| D | 2023–2025 | 47.4% | Best |

### External Data

| Source | Records | Purpose |
|--------|---------|---------|
| SAT EFOS Definitivo | 13,960 RFC-confirmed ghost companies | External flag in ARIA |
| SFP Sanctions | 1,954 debarment records | External flag in ARIA |
| RUPC | 23,704 contractor registry records | Vendor verification |

### Data Validation Rules

- Amounts > 100B MXN: **rejected** (decimal errors — a real COMPRANET problem)
- Amounts > 10B MXN: **flagged** for manual review
- Context: Mexico's entire federal budget is ~8T MXN annually

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- The SQLite database file (`RUBLI_NORMALIZED.db`, ~6.4 GB — not included in repo)

### Development

```bash
# Backend (port 8001)
cd backend
pip install -r requirements-api.txt
uvicorn api.main:app --port 8001 --reload --host 127.0.0.1

# Frontend (port 3009)
cd frontend
npm install
npm run dev -- --port 3009
```

Open `http://localhost:3009`

> **Cold start note**: `_startup_checks()` scans ~3.05M rows on first startup — expect 30–60s. This is expected behavior.

### Docker (Production)

```bash
cp .env.prod.example .env.prod  # fill in VITE_RUBLI_WRITE_KEY
docker compose -f docker-compose.prod.yml up -d --build
```

### Testing

```bash
# Backend (590 tests)
python -m pytest backend/tests/ -q --tb=short -p no:cacheprovider

# TypeScript — BOTH checks required before any commit
cd frontend
npx tsc --noEmit
npm run build
```

---

## API

60+ REST endpoints across 30+ router modules. Interactive docs at [`rubli.xyz/docs`](https://rubli.xyz/docs) or `http://localhost:8001/docs` in dev.

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Fast health check using precomputed stats |
| `GET /api/v1/executive/summary` | Consolidated executive intelligence report |
| `GET /api/v1/contracts` | Paginated contract search with risk/sector/year filters |
| `GET /api/v1/vendors/{id}` | Vendor profile with SHAP radar and risk metrics |
| `GET /api/v1/aria/queue` | ARIA investigation queue with tier/pattern filters |
| `GET /api/v1/analysis/risk-overview` | Platform-wide risk distribution |
| `GET /api/v1/analysis/threshold-gaming` | Threshold-splitting pattern detection |
| `GET /api/v1/analysis/patterns/co-bidding` | Co-bidding collusion analysis |
| `GET /api/v1/network/co-bidders/{id}` | Vendor co-bidding network |
| `GET /api/v1/search` | Federated search across contracts, vendors, institutions |
| `POST /api/v1/auth/register` | Create user account |
| `POST /api/v1/auth/login` | Authenticate and receive JWT |
| `GET /api/v1/auth/me` | Current user profile |
| `POST /api/v1/auth/logout` | Invalidate session |
| `GET /api/v1/watchlist/folders` | Investigation workspace folders |

---

## Known Limitations

1. **Execution-phase fraud is invisible** — RUBLI analyzes contract award data only. Cost overruns, kickbacks, and ghost workers during execution are undetectable from COMPRANET. Cross-reference with ASF audit findings.

2. **Training bias toward large concentrated vendors** — IMSS, Segalmex, and COVID-19 cases account for ~79% of positive training contracts. Novel patterns from small-scale fraud are underdetected.

3. **Ghost company partial blind spot** — Small shell companies (EFOS-type: few contracts, low concentration) score 0.28 avg vs. 0.85 for training-dominant cases. Not fully solved.

4. **Vendor deduplication incomplete** — Same company appears under hundreds of name variants over 23 years. RFC is the primary key when available (0.1% pre-2010, 47% in 2023–2025).

5. **SCAR assumption violated** — Ground truth is selected from high-profile documented scandals, not a random sample of all corruption. The model is best at detecting patterns similar to known cases.

6. **Correlation, not causation** — High score = statistical similarity to known corruption patterns. Not proof of wrongdoing. Scores are investigation triage tools.

Full interactive limitations: [`rubli.xyz/limitations`](https://rubli.xyz/limitations)

---

## Methodology Documentation

| Document | Description |
|----------|-------------|
| [`docs/RISK_METHODOLOGY_v6.md`](docs/RISK_METHODOLOGY_v6.md) | v0.6.5 (superseded May 2, 2026; kept for reference) |
| [`docs/RISK_METHODOLOGY_v5.md`](docs/RISK_METHODOLOGY_v5.md) | v5.1 (preserved for reference) |
| [`docs/RISK_METHODOLOGY_v4.md`](docs/RISK_METHODOLOGY_v4.md) | v4.0 (preserved for reference) |
| [`docs/ARIA_SPEC.md`](docs/ARIA_SPEC.md) | ARIA pipeline specification |
| [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md) | Design bible — typography, color, dot-matrix protocol |

**Key references:**
- Elkan & Noto (2008) — *Learning classifiers from only positive and unlabeled data* (PU-learning correction)
- IMF Working Paper 2022/094 — *Assessing Vulnerabilities to Corruption in Public Procurement*
- OECD (2023) — *Public procurement performance: A framework for measuring efficiency, compliance and strategic goals* (OECD Public Governance Policy Papers No. 36). The 2–15% high-risk band is RUBLI's own calibration target, not an OECD benchmark.

---

## Changelog

### v2.1.0 (April 2026)
- **10 original investigative stories** — long-form editorial narratives with bespoke inline charts, each built on RUBLI data (`/stories/:slug`)
- **User authentication** — JWT register/login/me/logout via `POST /api/v1/auth/*`; bcrypt (direct, not passlib for Python 3.11 compatibility)
- **Year in Review** — annual summary page with dot-matrix spending and administration comparison
- **Investigation Workspace** — renamed from Watchlist; supports folders, case pinning, and review workflow
- **Vendor Compare / Institution Compare** — side-by-side dual-panel risk profiles
- **Procurement Calendar** — month-by-month award timing visualization (December/year-end spike analysis)
- **Collusion Analysis page** — co-bidding ring detection with network visualization
- **Vendor Clusters** — Louvain community detection via co-contracting graph
- **Institution Scorecards & Report Card** — graded transparency assessment (Excelente → Crítico scale)
- **Circuit-board network** — 120-node force-directed network replaces the table in Vendor Profile
- **Executive Summary vertical timeline** — chronological risk narrative across 6 presidential terms
- **Dark empty dots** — dot-matrix empty fill corrected to `#2d2926` across all dark-context charts
- **Design audit** — full compliance pass: `rounded-sm` cards, no emoji in data UI, zinc `#71717a` for low-risk
- **SQLite corruption resilience** — `_ensure_tables()` now does a read-only existence check before acquiring write lock (prevents `database disk image is malformed` on freelist-corrupted DBs)
- **Sector / dashboard latency** — removed live fallback queries from fast endpoints; all stats served from precomputed table

### v2.0.0 (March 2026)
- **Risk model v0.6.5** — institution-scoped ground truth labels, FP exclusions (BAXTER, FRESENIUS, INFRA, PRAXAIR), curriculum learning; HR=13.49% (superseded by v0.8.5)
- **ARIA pipeline v1.1** — 318K vendor queue, 4 tiers, 7 pattern classifiers, external registry cross-reference (EFOS, SFP, RUPC)
- **Ground truth expanded** to 748 windowed/institution-scoped cases (603 vendors)
- **SHAP explanations** — exact linear SHAP per vendor (456K rows in `vendor_shap_v52`)
- **Red Thread** — scroll-driven 6-chapter investigative narrative per vendor
- **Executive Summary** — 9-section flagship report

---

## Acknowledgments

- **COMPRANET** — Mexico's federal procurement transparency platform (datos.gob.mx)
- **SAT** — EFOS definitivo ghost company registry
- **SFP** — Sanction and debarment records
- **IMF / World Bank / OECD** — Risk methodology frameworks
- **Elkan & Noto (2008)** — PU-learning framework used throughout the risk model

---

## License

[Apache License 2.0](LICENSE) — free to use, modify, and distribute with attribution.

---

*RUBLI — open-source procurement intelligence for Mexican federal contracting data. Risk scores are statistical risk indicators. High score ≠ proof of wrongdoing.*
