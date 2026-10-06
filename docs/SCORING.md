# Scoring scripts: which one does what (read before any rescore)

> **Active model: v0.8.5** (ElasticNet logistic + PU correction, run `CAL-v8-202605020212`, 2026-05-02). It writes `contracts.risk_score_v8`, `risk_score` and `risk_level`. Intercept −2.6157 · c = 0.32 · 18 non-zero features (reads `contract_z_features_v2`). High-risk rate 11.0%. Forward-holdout AUC 0.656; the originally reported 0.785 is not reproducible. Details: [RISK_METHODOLOGY.md](RISK_METHODOLOGY.md), [MODEL_CARD.md](MODEL_CARD.md).

## The wrong-script hazard

The full v0.8.5 scorer is **not** in `backend/scripts/` as a named script. The older scorers are, so the easy mistake is to "rescore" with one of them, which silently replaces the active scores with a retired model.

| Script | Produces | Status |
|---|---|---|
| `_patch_v85_ghost_fp.py` | Post-scoring adjustments to `risk_score_v8` (ghost-companion boost, structural false-positive cap) | v0.8.5 **patch only** |
| `_score_v6_now.py` | v6.0 scores | ❌ retired model, do not run against the active columns |
| `calculate_risk_scores_v6.py` | v6.0 | ❌ retired |
| `calibrate_risk_model_v6_enhanced.py` | v6.0 calibration | ❌ retired |
| `calibrate_risk_model_v5.py`, `calibrate_risk_model_v6.py` | v5 / v6 | ❌ retired |
| *(v0.8.5 trainer and full scorer)* | `risk_score_v8` from the stored betas + `contract_z_features_v2` | ⚠️ **Not in the repository.** To be re-created for v0.9 |

The stored coefficients in `model_calibration` (`model_version = 'v0.8.5'`, `sector_id = 0`) reproduce `risk_score_v8` for 1,983 of 2,000 sampled contracts; the remaining 17 are patch adjustments. `score = min(1, sigmoid(intercept + β·z) / 0.32)`.

## Hard guardrails: reject any rescore that violates one

- `intercept < −0.5`
- `c_pu > 0.30`
- high-risk rate (high + critical) within the project's 2–15% triage band
- Brier score no worse than 0.1128
- no temporal or label leakage. v5.1's 0.957 AUC was leakage. Hold out vendors by time (forward holdout), and report independently sourced cases separately from model-discovered ones.

## Provenance details

- The calibration row uses `sector_id = 0`, **not** `NULL`. Older rows used `NULL`, and the read path once served v6.0 coefficients to SHAP because of that. See `backend/api/services/active_model.py`.
- v0.8.5 coefficients are stored as `{"names": [...], "values": [...]}`; older rows use a flat `{name: value}` dict.

## If you must rescore

1. Confirm you are running a v0.8.5-compatible scorer, not one of the retired scripts above.
2. Check the guardrails on the result **before** writing.
3. Back up the database: run `backend/scripts/_wal_checkpoint.py`, then copy the file.
4. Recompute downstream tables: `vendor_stats`, `institution_stats`, `category_stats`, `feature_importance`, `vendor_shap_v52`, and the ARIA queue.
