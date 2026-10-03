# Model card: RUBLI procurement risk indicator v0.8.5

**Owner:** RUBLI project · **Trained:** 2026-05-02 (run `CAL-v8-202605020212`) · **Card updated:** 2026-10 · **Status:** in production at [rubli.xyz](https://rubli.xyz); retrain (v0.9) paused behind label quality

Format follows Mitchell et al. (2019), *Model Cards for Model Reporting*. Method details are in [RISK_METHODOLOGY.md](RISK_METHODOLOGY.md).

---

## 1. Overview

The model assigns each Mexican federal procurement contract (CompraNet, 2002–2025) a score from 0 to 1. The score says how closely the contract's characteristics resemble contracts tied to RUBLI's labelled cases. It is used to **rank and filter**: it sorts contract tables, sets the risk level shown on vendor, institution and sector pages, and is the largest input to the ARIA investigation queue. Its readers are journalists, auditors, researchers and civil-society analysts.

It is a single global ElasticNet logistic regression over 21 sector-and-year-normalised features with a positive-unlabelled correction (c = 0.32).

## 2. Intended use

**In scope**

- Triage: deciding which contracts, vendors or buyers to examine first.
- Aggregate description: comparing the share of high-indicator contracts across sectors, years or institutions, with the caveats in §5.
- Hypothesis generation for reporting, followed by document-based verification.

**Out of scope. Do not use the score to:**

- state or imply that a contract, company or official is corrupt, or quote it as a "probability of corruption";
- sanction, debar, deny payment to or blacklist any supplier, or make any other automated decision about a person or company;
- rank or name **natural persons** (personas físicas);
- estimate the amount of money lost to corruption;
- evaluate contracts outside the CompraNet federal data it was trained on (state or municipal systems, the post-Sep-2025 ComprasMX awards, other countries);
- compare individual scores across model versions.

**Users:** reporters and analysts reading the site or API; developers working with the open data. No end user receives an automated decision from this model.

## 3. Training data

| Item | Value |
|---|---|
| Universe | 3,051,294 scored CompraNet contracts, 2002–2025 (data horizon 2025-09-28) |
| Positives | Contracts of vendors linked to labelled cases, inside each case's time window (and buyer scope where defined). 1,401 cases at training time |
| Unlabelled | All other contracts, treated as unlabelled (PU learning), not as known-clean |
| Label provenance (today, 1,417 cases) | 989 model/ARIA-surfaced leads written up by analysts · 361 press reports · 25 official records · 1 audit report · 41 other |
| Sample weights | Curriculum weights by case confidence (1.0 / 0.8 / 0.5 / 0.2) |
| Excluded | Vendors marked as structural false positives |

**Known gaps.** Most labels are not adjudicated findings, and 69% originate from the model or the ARIA queue itself (see [GROUND_TRUTH.md](GROUND_TRUTH.md)). Labels are concentrated in a few large cases and in health procurement. RFC coverage, and therefore vendor matching, is weak before 2010. Positive vendors are larger than average, so the model partly learns vendor size.

## 4. Evaluation

**Metric.** ROC-AUC at contract level: how well the score ranks labelled-case contracts above others, independent of the threshold. Because unlabelled contracts include undiscovered positives, every AUC here is a lower-bound-style proxy, not a measure of real-world detection.

**Base rate.** About 12.9% of scored contracts are linked to a labelled vendor, so precision-type figures must be read against that.

### Headline results

| Evaluation | Population | AUC | Reading |
|---|---|---:|---|
| **Forward holdout** (primary) | 103,889 contracts of 694 vendors first linked to a case *after* the run, against contracts of vendors never in the case set | **0.656** | The only true out-of-sample number. Modest discrimination |
| In-sample | All labelled-case contracts (the model saw most of them) | 0.733 | Upper reference, not a generalisation estimate |
| Originally reported test AUC | Vendor-stratified split | ~~0.785~~ | **Not reproducible** (split and training code not preserved). Withdrawn |

### Sliced results

| Slice | Metric | Value | vs. overall |
|---|---|---:|---|
| In-sample, positives from press / official / audit sources | AUC | 0.768 | +0.035 |
| In-sample, positives from model-discovered cases | AUC | 0.731 | −0.002 |
| Vendor-level ranking, model | AUC | ≈ 0.95 | — |
| Vendor-level ranking, **model-free vendor-size baseline** | AUC | 0.858 | most of the vendor-level number is size |
| Vendor-size baseline, vendors with ≥ 100 contracts | AUC | 0.73 | — |

The provenance slices show that label circularity (model-found cases evaluated by the same model) is real but not the main source of optimism. The bigger effects are vendor size and in-sample evaluation. Slices by sector, year and CompraNet data structure (A–D) have **not** been computed for v0.8.5. Treat performance in 2002–2010 (Structure A, almost no RFCs) as unknown.

### Calibration

Scores are **not** calibrated probabilities. Against the observed rate of labelled-vendor contracts in each score bin, the score runs high: for example, contracts scored around 0.62 have an observed labelled rate of about 0.39 (stored post hoc in `model_calibration.calibration_curve`). This comparison is itself biased low because unlabelled positives exist. The training-run Brier score (0.113) comes from the same unreproducible split as the 0.785 AUC.

## 5. Limitations and failure modes

- **Award data only.** Overpricing at execution, kickbacks, ghost deliveries and amendments not captured in CompraNet are invisible.
- **Known-case bias.** The model finds contracts that resemble the cases it was taught. New schemes, small-scale fraud and sectors with few labels are under-detected.
- **Capture pattern penalised.** `institution_diversity` is actually a buyer-concentration (HHI) index with a negative weight, so single-buyer vendors (the institutional-capture pattern) score *lower*.
- **Inflated grouping feature.** `network_member_count` (β +0.166) uses an old name-similarity grouping with ~19% measured precision. About 11.8K vendors and 1.4T MXN of contracts carry an inflated value.
- **Small shell vendors.** The regression under-scores them; a post-hoc ghost-companion boost compensates partly (see methodology §1).
- **Saturation.** About 80K contracts are clipped at 1.0, so the very top is unordered.
- **Mis-yeared rows (fixed in data, not in features).** 175,767 contracts from the 2010 source file were dated 2011–2012 but stored as 2010 at training time. The data has been corrected; year-keyed features have not been recomputed. Measured score effect is small (+0.015 on average).
- **Old data.** Structure A (2002–2010) has 0.1% RFC coverage and no publication dates, so vendor features are noisier.
- **Unscored rows.** Contracts loaded after the run, about 5.8K rows assigned ids in 2026-10, have no score.

## 6. Ethical considerations

- **Defamation risk.** A score attached to a named company can be read as an accusation. The site uses "risk indicator" language throughout, never shows a score as a probability, and its terms say scores are not findings.
- **Natural persons.** Individual suppliers' RFCs are masked server-side. ARIA pattern labels (e.g. "ghost company") are suppressed for personas físicas and public bodies.
- **Feedback loop.** Leads surfaced by the model and written up by analysts become labels, which reinforces the model's own view. v0.9 will train and report on independently sourced cases separately.
- **Uneven coverage.** Buyers with better data (recent years, RFC-rich records) are easier to score. Differences between periods partly reflect data quality, not behaviour.

## 7. Deployment and monitoring

| Item | Value |
|---|---|
| Serving | Scores are precomputed in SQLite (`contracts.risk_score_v8`, `risk_level`) and served read-only by the FastAPI backend. No online inference |
| Explanations | Linear SHAP per vendor (`vendor_shap_v52`) |
| Drift signals | `drift_report` table; high-risk rate per scoring run; share of contracts at 1.0 |
| Release gates for any rescore | intercept < −0.5 · c > 0.30 · high-risk rate within 2–15% · Brier no worse than 0.1128 · no temporal leakage (see [SCORING.md](SCORING.md)) |
| Rollback trigger | Any gate fails, or the forward-holdout AUC on newly labelled vendors falls below 0.60. Previous scores remain in `risk_score_v6` and `risk_score_v5` |

## 8. Reproducibility status

The stored coefficients reproduce `risk_score_v8` for 1,983 of 2,000 sampled contracts; the rest are the post-scoring adjustments. The **training script, the split, and the builder for the five v2 features are not in this repository.** Re-creating them is the first v0.9 task.
