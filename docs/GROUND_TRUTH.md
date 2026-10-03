# Ground truth: the labelled case set

> **One-line summary:** 1,417 labelled cases, of which 387 come from press reports, official records or audits. The other 989 are leads the model or the ARIA queue surfaced and an analyst wrote up. They are **labelled cases**, not verified or adjudicated corruption.

The case set is the positive class for the risk model (see [RISK_METHODOLOGY.md](RISK_METHODOLOGY.md)) and the reference list behind "linked to a labelled case" on the site. This document explains what a case is, where cases come from, and how much weight each kind deserves.

**Ground-truth labels are not distributed.** The per-case and per-vendor label tables live in the database, which is not in this repository. This document and [RISK_METHODOLOGY.md](RISK_METHODOLOGY.md) describe how they were built.

---

## 1. Provenance

| `case_origin` | Cases | What it means |
|---|---:|---|
| `model_discovery` | 989 | Vendor surfaced by the risk model or ARIA, then written up by an analyst from contract patterns and public sources. Most have no external source attached |
| `media_report` | 361 | Built from investigative journalism |
| `official_record` | 25 | Built from an official record (sanctions, court or prosecutor documents, registries) |
| `audit_report` | 1 | Built from a federal audit (ASF) |
| other / unset | 41 | Mining batches and legacy rows without an origin value |
| **Total** | **1,417** | 1,401 existed when model v0.8.5 was trained |

How to read this:

- **Only 387 cases have an independent origin** (press, official record, audit). If you need a defensible list, filter on `case_origin` and on attached sources (`ground_truth_sources`), not on `confidence_level`.
- **`confidence_level` is an analyst judgement, not evidence.** Many model-discovered cases are rated `high`, and about 700 unsourced cases are rated high or confirmed. The `confirmed_corrupt` value has also been used for open investigations.
- **Circularity.** Model-discovered cases are partly selected by the model they then train. The effect on AUC was measured and is modest (see [MODEL_CARD.md](MODEL_CARD.md) §4), but it is a reason to report independently sourced cases separately.

## 2. What a label covers

A case links to **vendors** (`ground_truth_vendors`), optionally to **institutions** (`ground_truth_institutions`) and to **contracts** (`ground_truth_contracts`). Contract labels are derived: a vendor's contracts count as positive only inside the case's fraud window (`fraud_year_start`–`fraud_year_end`) and, where defined, only with the institutions named in the case (`fraud_institution_ids`).

A positive label therefore means "this contract belongs to a vendor in a labelled case, within its window and scope". It does **not** mean the individual contract was corrupt. A vendor in a case can also hold legitimate contracts.

## 3. False positives

Vendor links can be marked `is_false_positive = 1` with a tier and reason. Typical examples are sole licensed suppliers of a product, vendors matched by name to the wrong company, and links that did not survive review. False-positive vendors are excluded from training, have their scores capped, and are not shown as linked to a case on the site.

## 4. Matching

Vendors are matched to cases by RFC when one is available, otherwise by normalised name. Each link stores `match_method` and `match_confidence`. Name matching on pre-2010 data, where RFC coverage is about 0.1%, is the weakest part of the chain. See [DATA.md](DATA.md) §4 for the entity-resolution rules now used across the platform.

## 5. Tables

| Table | Grain | Key fields |
|---|---|---|
| `ground_truth_cases` | case | `case_id` (`CASE-<id>`), `case_name`, `case_type`, `case_origin`, `confidence_level`, fraud window, `fraud_institution_ids`, `estimated_fraud_mxn` (often NULL or equal to total contract value, so do not sum it as "money stolen") |
| `ground_truth_vendors` | case × vendor | `match_method`, `match_confidence`, `is_false_positive`, `fp_reason`, `curriculum_weight` |
| `ground_truth_contracts` | case × contract | `evidence_strength`, `evidence_tier`, source reference |
| `ground_truth_institutions` | case × institution | role |
| `ground_truth_sources` | case × source | `source_type`, URL, title, date |

Cases name companies. Before republishing any case-level data, filter to sourced cases and remove natural-person names from free-text fields (`case_name`, `notes`).

## 6. Known issues (tracked for v0.9)

- Most cases are self-generated. The next model will be trained and evaluated on sourced cases, with model-discovered cases reported separately.
- About 10 duplicate case pairs remain.
- `case_id` holds mixed integer and text values in some joins.
- A small number of cases added after training have malformed scope JSON that breaks the scoped-training view.

## 7. Adding a case

Add cases only with at least one public source (`ground_truth_sources`) and an explicit `case_origin`. Set `case_id = 'CASE-<id>'`. Never add a natural person as the subject of a case without an official record. Changes to labels do not affect published scores until the next retrain.
