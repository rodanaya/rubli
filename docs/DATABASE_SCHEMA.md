# Database schema

RUBLI runs on a single SQLite database (WAL mode). The source database is `backend/RUBLI_NORMALIZED.db`. Production serves a slimmed copy, `RUBLI_DEPLOY.db`, built by [`backend/scripts/create_deploy_db.py`](../backend/scripts/create_deploy_db.py), which drops staging, backup and private tables. **Neither file is in the repository.** See [DEVELOPMENT.md](DEVELOPMENT.md#getting-a-database) for how to build one.

This page documents the tables a contributor or data user actually touches. The database also holds about 100 auxiliary tables (precomputes, caches, migration backups prefixed `_`). Use `sqlite3 RUBLI_NORMALIZED.db .tables` for the full list.

---

## Core entities

### `contracts` — one row per CompraNet contract (≈3.06M)

| Column group | Columns |
|---|---|
| Identity | `id` (NOT NULL, unique), `source_structure` (A–D), `source_year`, `contract_number`, `procedure_number`, `expedient_code` |
| Links | `vendor_id` → `vendors`, `institution_id` → `institutions`, `contracting_unit_id`, `sector_id` → `sectors`, `sub_sector_id`, `category_id` → `categories`, `ramo_id` → `ramos` |
| Description | `title`, `description`, `partida_especifica`, `cucop_capitulo`, `spending_class` |
| Procedure | `procedure_type`, `procedure_type_normalized`, `contract_type(_normalized)`, `procedure_character`, `participation_form`, `exception_article`, `caso_fortuito` |
| Dates | `contract_date`, `start_date`, `end_date`, `award_date`, `publication_date`, `opening_date`, `contract_year`, `contract_month`, `sexenio_year` |
| Money | `amount_mxn` (validated; > 100B rejected to 0), `amount_original`, `currency`, `is_foreign_currency`, `is_high_value` |
| Flags | `is_direct_award`, `is_single_bid`, `is_framework`, `is_consolidated`, `is_multiannual`, `is_year_end`, `has_amendment`, `is_election_year`, `publication_delay_days` |
| Risk (active) | `risk_score`, `risk_level` (`critical`/`high`/`medium`/`low`), `risk_score_v8`, `risk_model_version` |
| Risk (archived) | `risk_score_v5`, `risk_score_v6`, `risk_level_v6`, `risk_score_v7`, `risk_level_v7`, `risk_confidence_lower/upper` (empty for v0.8.5) |
| Other signals | `mahalanobis_distance`, `ensemble_anomaly_score`, `data_quality_score`, `data_quality_grade` |

`contract_year` is derived from `contract_date` (corrected 2026-09-30 for the 2010 source file).

### `vendors` — one row per raw supplier record (≈320K)

`id`, `rfc`, `name`, `name_normalized`, `is_individual` (persona física), `vendor_kind`, `size_stratification`, `country_code`, `first_contract_date`, `last_contract_date`, `total_contracts`, `total_amount_mxn`.

**Never publish `rfc` for rows where `is_individual = 1`.** The API masks it server-side. `group_id` and `vendors.avg_risk_score` are legacy fields: use `vendor_canonical` and `vendor_stats` instead.

### `institutions` — one row per raw buyer record

`id`, `siglas`, `name`, `name_normalized`, `ramo_id`, `sector_id`, `institution_type(_id)`, `size_tier(_id)`, `autonomy_level(_id)`, `gobierno_nivel`, `is_federal`, `state_code`.

### Taxonomy

| Table | Content |
|---|---|
| `sectors` | 12 sectors (`id`, `code`, `name_es`, `name_en`, `color`) |
| `ramos` | Budget branches (`clave`) → `sector_id` |
| `sub_sectors`, `categories` | Spending categories under each sector (`partida_pattern`, keywords) |
| `institution_types`, `size_tiers`, `autonomy_levels` | Institution classification ([INSTITUTION_TYPES_REFERENCE.md](INSTITUTION_TYPES_REFERENCE.md)) |

The 12 sectors map from budget *ramo*:

| ID | Code | Ramos |
|---|---|---|
| 1 | salud | 12, 50, 51 |
| 2 | educacion | 11, 25, 48 |
| 3 | infraestructura | 09, 15, 21 |
| 4 | energia | 18, 45, 46, 52, 53 |
| 5 | defensa | 07, 13 |
| 6 | tecnologia | 38, 42 |
| 7 | hacienda | 06, 23, 24 |
| 8 | gobernacion | 01–05, 17, 22, 27, 35, 36, 43 |
| 9 | agricultura | 08 |
| 10 | ambiente | 16 |
| 11 | trabajo | 14, 19, 40 |
| 12 | otros | everything else |

## Entity resolution

| Table | Grain | Purpose |
|---|---|---|
| `vendor_canonical` | vendor | `vendor_id` → `canonical_id`, `group_size`, `match_basis` (316,967 canonical vendors) |
| `vendor_rfc_quality` | vendor | RFC grade (A–D), recovered RFC, `is_persona_fisica`, `display_ok` |
| `vendor_match_judgements` | vendor pair | `same` / `different` / `unsure`, with source, rule version and reviewer. Components over `same` edges define entities |
| `vendor_match_candidates` | vendor pair | Link-only fuzzy candidates (`tier`, `score`). Never used as labels |
| `institution_canonical` | institution | `canonical_id`, `level`, `body_type`, `match_basis` (3,462 canonical institutions) |
| `institution_successor` | institution | Renamed or merged agencies, with `effective_date` and source |

Method: [DATA.md §4](DATA.md#4-entity-resolution).

## Aggregates (read these, not raw columns)

Precomputed by [`_refresh_stats_tables.py`](../backend/scripts/_refresh_stats_tables.py) and [`precompute_stats.py`](../backend/scripts/precompute_stats.py). The API reads these tables, so rebuild them after any scoring or data change.

| Table | Key | Notable columns |
|---|---|---|
| `vendor_stats` | `vendor_id` | `total_contracts`, `total_value_mxn`, `avg_risk_score`, `high_risk_pct`, `direct_award_pct`, `single_bid_pct`, `institution_count`, `primary_sector_id` |
| `institution_stats` | `institution_id` | totals, `high_risk_pct`, `direct_award_pct`, `single_bid_pct`, `vendor_count`, `high_critical_value_mxn` |
| `category_stats` | `category_id` | totals, `avg_risk`, `high_risk_pct`, top vendor and buyer |
| `precomputed_stats` | `stat_key` | JSON blobs for dashboards (`stat_value`) |

## Model

| Table | Content |
|---|---|
| `model_calibration` | One row per model run: `model_version`, `run_id`, `intercept`, `coefficients` (`{"names":[…],"values":[…]}` for v0.8.5), `pu_correction_factor`, `hyperparameters`, `calibration_curve`. The v0.8.5 row uses `sector_id = 0` |
| `factor_baselines` | Sector × year mean / std per feature |
| `contract_z_features`, `contract_z_features_v2` | Per-contract z-scores (16 original + 5 v2 features) |
| `vendor_shap_v52` | Per-vendor linear SHAP values and top factors |
| `drift_report` | Distribution-drift checks |

## Ground truth

`ground_truth_cases`, `ground_truth_vendors`, `ground_truth_contracts`, `ground_truth_institutions`, `ground_truth_sources`. See [GROUND_TRUTH.md](GROUND_TRUTH.md).

## ARIA investigation queue

| Table | Content |
|---|---|
| `aria_queue` | One row per vendor: `ips_final`, `ips_tier` (1–4), `primary_pattern`, external flags (`is_efos_definitivo`, `is_sfp_sanctioned`), `in_ground_truth`, false-positive screens, review status |
| `aria_runs` | Pipeline run log |
| `aria_memos`, `aria_web_evidence` | Analyst / LLM working notes. **Internal; not published** |

See [ARIA_SPEC.md](ARIA_SPEC.md).

## External registries

| Table | Source |
|---|---|
| `sat_efos_vendors` | SAT Art. 69-B list (`rfc`, `company_name`, `stage`, `dof_date`) |
| `sfp_sanctions` | SFP sanctioned suppliers (`company_name`, `rfc` when given, `sanction_type`, dates, `authority`) |
| `rupc_vendors` | Supplier registry |
| `asf_cases`, `asf_institution_crosswalk` | ASF audit findings and the reviewed buyer crosswalk |

## Post-CompraNet awards

`gap_contracts`: ComprasMX procedures from 2025-09-28 onward (`uuid_procedimiento` unique). It holds procedure metadata, `amount_mxn_recovered` (OCR), `currency`, six `flag_*` columns, and `gap_risk_score` / `gap_risk_level` from the structural indicator. **Kept separate from `contracts`.** See [DATA.md §2](DATA.md#2-after-compranet-the-comprasmx-gap-2025-09-28--2026-09-30).

## Application tables (never exported)

`users`, `watchlist_items`, `investigation_folders`, `investigation_folder_items`, `user_issues`, `risk_feedback`.
