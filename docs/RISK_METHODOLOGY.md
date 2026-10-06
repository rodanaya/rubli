# Risk methodology — model v0.8.5

> **Status:** active since 2026-05-02 · run `CAL-v8-202605020212` · one global model
> **Read with:** [MODEL_CARD.md](MODEL_CARD.md) (evaluation and limits) · [GROUND_TRUTH.md](GROUND_TRUTH.md) (labels) · [DATA.md](DATA.md) (sources)

RUBLI gives every federal contract a **risk indicator** between 0 and 1. The indicator measures how closely a contract's procurement characteristics resemble those of contracts linked to RUBLI's labelled cases. It is **not** a probability of corruption, and a high score is not evidence of wrongdoing. It exists to help reporters and auditors decide where to look first in a universe of three million contracts.

---

## 1. Model in one paragraph

A single **ElasticNet-regularised logistic regression** is fit on 21 contract- and vendor-level features. Each feature is a z-score normalised against its own **sector × year** baseline, so a direct award in Defence (where it is the norm) is not penalised the way one in Education is. Because unlabelled contracts are not known to be clean, the raw output is adjusted with the **Elkan & Noto (2008) positive-unlabelled (PU) correction**. There is one model for all twelve sectors; earlier versions with per-sector sub-models are retired.

```
z_i      = clamp((x_i − μ_sector,year) / max(σ_sector,year, 0.1), −5, +5)     # continuous features
z_i      = (x_i − p_sector,year) / √(p(1 − p))                                # binary features
raw      = sigmoid(−2.6157 + Σ β_i · z_i)
score    = min(1, raw / c),   c = 0.32                                         # PU correction
```

Two post-scoring adjustments are applied (script: [`backend/scripts/_patch_v85_ghost_fp.py`](../backend/scripts/_patch_v85_ghost_fp.py)):

- **Ghost-companion boost.** Vendors with a shell-company confidence ≥ 0.4 get `score + confidence × weight` (weight 0.20 / 0.30 / 0.40 by tier), capped at 1.0. The regression alone under-scores small shell vendors.
- **Structural false-positive cap.** A short list of vendors marked as structural monopolies (single licensed suppliers of medical gases, dialysis and similar) are capped at 0.05. They are also excluded from training.

Because of the `min(1, ·)` clip, about 80K contracts are tied at exactly 1.0. Treat the top of the scale as a band, not a ranking.

## 2. Hyper-parameters

| Parameter | Value |
|---|---|
| Model | `elasticnet_global` (scikit-learn logistic regression, ElasticNet penalty) |
| C | 0.2243 |
| l1_ratio | 0.7545 |
| Intercept | −2.6157 |
| PU constant c | 0.32 |
| Features | 21 in, 18 non-zero after regularisation |
| Labels at training time | 1,401 cases (1,417 today) |
| Split | vendor-stratified (not persisted — see §6) |

## 3. Features and coefficients

Coefficients are on standardised (z-score) inputs, so their magnitudes are comparable. Sorted by absolute weight; values are read from the `model_calibration` row for `v0.8.5`.

| Feature | β | What it measures |
|---|---:|---|
| `price_volatility` | +0.558 | Spread of the vendor's contract sizes (std / median) relative to the sector-year norm |
| `institution_diversity` | −0.388 | **Misnamed:** it is a Herfindahl concentration index of the vendor's buyers. Single-buyer vendors therefore score *lower*, which runs against the institutional-capture pattern. Known issue, to be fixed at the next retrain |
| `price_ratio` | +0.358 | Contract amount ÷ sector-year median. The model does see contract size |
| `vendor_concentration` | +0.327 | Vendor's share of value within its sector |
| `cobid_herfindahl` | +0.272 | Concentration of the vendor's co-bidding relationships |
| `recency_z` | −0.247 | Days since the vendor's previous contract (frequent repeat contracting raises the score) |
| `amount_residual_z` | −0.187 | Contract amount relative to the vendor's own history |
| `network_member_count` | +0.166 | Size of the vendor's name-similarity group. Built from an old fuzzy grouping later measured at ~19% precision; rebuild from the new entity-resolution judgements is pending (v0.9) |
| `amendment_flag` | +0.102 | Contract was amended |
| `ad_period_days` | +0.090 | Days between publication of the procedure and contract signing (0–365) |
| `direct_award` | −0.081 | Direct-award procedure (binary) |
| `pub_delay_z` | −0.055 | Delay between the contract date and its CompraNet publication |
| `institution_risk` | −0.034 | Prior risk baseline of the buying institution |
| `sector_spread` | +0.034 | Number of sectors the vendor sells into |
| `industry_mismatch` | −0.017 | Vendor's classified industry differs from the contract's sector |
| `year_end` | +0.017 | Signed in the December rush |
| `same_day_count` | +0.014 | Contracts with the same buyer and vendor on the same day (threshold splitting) |
| `single_bid` | −0.002 | Competitive procedure with exactly one bidder |
| `co_bid_rate` | 0 | Regularised to zero |
| `price_hyp_confidence` | 0 | Regularised to zero |
| `win_rate` | 0 | Regularised to zero |

Several signs are counter-intuitive (`direct_award`, `single_bid` near zero or negative). That is what a regularised model does when correlated vendor-level features already carry the signal; it does not mean direct awards are safe. Feature effects are **associations learned from the label set**, not causal claims.

The 16 original features are computed by [`backend/scripts/compute_z_features.py`](../backend/scripts/compute_z_features.py) against baselines from [`compute_factor_baselines.py`](../backend/scripts/compute_factor_baselines.py). The five v2 features (`amount_residual_z`, `recency_z`, `cobid_herfindahl`, `pub_delay_z`, `amendment_flag`) live in the `contract_z_features_v2` table; the script that built that table is not in this repository.

## 4. Risk levels

| Level | Threshold | Share of scored contracts |
|---|---|---|
| Critical | ≥ 0.60 | 4.98% |
| High | ≥ 0.40 | 6.0% |
| Medium | ≥ 0.25 | 16.2% |
| Low | < 0.25 | 72.9% |

High + critical = **11.0%**. The thresholds were chosen so that this rate falls inside RUBLI's own 2–15% triage target. That band is a project choice, not an external benchmark, and the rate is not an estimate of how much procurement is corrupt.

The frontend reads these thresholds from `getRiskLevelFromScore` in [`frontend/src/lib/constants.ts`](../frontend/src/lib/constants.ts); do not re-implement the ladder.

## 5. Explanations

Per-vendor explanations are exact linear SHAP values (β × z on the vendor's mean z-vector), stored in `vendor_shap_v52`. They show which features pushed a vendor up or down. They do not cover the post-scoring adjustments in §1.

## 6. What we can and cannot reproduce

| Claim | Status |
|---|---|
| Stored coefficients reproduce `risk_score_v8` | **Yes** — 1,983 of 2,000 sampled contracts; the 17 differences are the §1 post-scoring adjustments |
| High-risk rate 11.0% | **Yes** |
| Forward-holdout AUC **0.656** | **Yes** — see [MODEL_CARD.md](MODEL_CARD.md) |
| In-sample AUC **0.733** | **Yes** |
| Originally reported test AUC 0.785 | **No.** The train/test split was not saved, and the training script is not in the repository. The figure is no longer cited |
| Bootstrap confidence intervals | **None published** for v0.8.5 |

## 7. Model history

Older AUCs were measured on different splits, and several were inflated by leakage. They are not comparable with the v0.8.5 forward holdout and are listed only for provenance.

| Version | Period | Approach | Note |
|---|---|---|---|
| v3.3 | Feb 2026 | Expert-weighted checklist | Retired |
| v4.0 | Feb 2026 | Z-scores + logistic regression on 9 cases | In-sample only |
| v5.1 | Mar 2026 | Per-sector sub-models + PU learning | Reported AUC inflated by temporal leakage; scores kept in `risk_score_v5` |
| v0.6.5 | Mar–May 2026 | Institution-scoped labels, curriculum weights | Scores kept in `risk_score_v6` |
| **v0.8.5** | May 2026 → | One global ElasticNet, 21 features | Active, `risk_score_v8` |

## 8. Planned for v0.9

Retraining is paused until label quality improves (see [GROUND_TRUTH.md](GROUND_TRUTH.md)). The open items are:

- train and evaluate on independently sourced cases, reporting model-discovered cases separately;
- rebuild `network_member_count` from the entity-resolution judgements;
- rename and reconsider `institution_diversity`;
- recompute year-keyed features after the 2010–2012 year correction;
- put the training and scoring code in the repository and persist the split.

## References

- Elkan, C. & Noto, K. (2008). *Learning classifiers from only positive and unlabeled data.* KDD.
- Fazekas, M., Tóth, I. J. & King, L. P. (2016). *An objective corruption risk index using public procurement data.* European Journal on Criminal Policy and Research.
- Zou, H. & Hastie, T. (2005). *Regularization and variable selection via the elastic net.* JRSS-B.
