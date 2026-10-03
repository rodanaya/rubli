# Changelog

All notable changes to RUBLI are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Model versions (v0.8.5, …) are numbered separately from releases.

## [1.0.0] — 2026-10-02 — First public release

The first open-source release of the code. Data and scores are those served at [rubli.xyz](https://rubli.xyz) on this date.

### Data

- **3,055,837 CompraNet contracts**, 2002–2025, ingested from the four CompraNet file layouts (structures A–D) with amount validation: over 100B MXN rejected, over 10B MXN flagged. The data horizon is **2025-09-28**, when the upstream feed froze; 2004 has no source file.
- **ComprasMX gap recovery.** 97,847 post-CompraNet procedures (2025-09-28 → 2026-09-30), 52,304 of them with award amounts recovered by OCR (355.3B MXN). They are kept in a separate table and graded by a structural red-flag indicator, not by the risk model.
- **Entity resolution.** 3,462 canonical institutions and 316,967 canonical vendors. Merges require a grade-A RFC or an exact normalised legal name with co-signals (99.46% measured precision on the automatic tiers). Merges touching labelled or sanctioned vendors go to human review, and natural persons are never merged by name. The old ~19%-precision fuzzy grouping was removed from the site.
- **Year correction.** About 176K contracts from the 2010 source file are now dated in 2011–2012, as their contract dates show; year-keyed aggregates were rebuilt.
- **Contract ids.** Rows with NULL ids were de-duplicated or assigned ids, and ids are now required.
- External registries cross-referenced: SAT EFOS (Art. 69-B), SFP sanctioned suppliers, RUPC, and ASF audit findings through a reviewed institution crosswalk.

### Model and queue

- **Risk model v0.8.5** (trained 2026-05-02): one global ElasticNet logistic regression over 21 sector-year z-score features with positive-unlabelled correction. 11.0% of contracts are high or critical; 4.98% are critical.
- **Honest validation.** Forward-holdout AUC is **0.656** and in-sample AUC is **0.733**. The previously reported test AUC of 0.785 could not be reproduced and is withdrawn. A model card documents intended use, slices, failure modes and rollback gates.
- **ARIA investigation queue** over 248,944 vendors. All 299 Tier-1 vendors are existing labelled cases; new leads start in Tier 2.
- **Labelled case set:** 1,427 cases, published with their provenance (989 model/ARIA-surfaced, 363 press, 25 official records, 1 audit, 49 other) and described as labelled, not verified.

### Fixes from the pre-publication audit

- **Personal data.** Natural persons' RFCs are now masked server-side on every endpoint, including dossier exports and the gap table.
- **Sanctions matching.** The 20-character name-prefix match was replaced by exact normalised-name or RFC matching, with each match labelled by strength. Flagged vendors fell from about 7,600, mostly false matches, to about 1,140.
- **Labels and copy.** Pattern labels are no longer shown for natural persons or public bodies. The "documented case" banner requires a sourced, non-false-positive link. A private individual was removed from a story. A story no longer presents RUBLI's own label as confirmation of a case. A non-existent "OECD 2023" citation was removed everywhere.
- **Methodology copy.** The site no longer claims per-sector models or bootstrap confidence intervals. The `institution_diversity` feature is described correctly (it is a buyer-concentration index), as is the recency feature. Outdated v5.1/v0.6.5 validation tables were removed.
- **Outliers.** Suspected decimal errors are flagged relative to each vendor's own history, so one contract cannot drive a ranking.
- **EFOS.** Only definitive-stage listings are flagged; cleared (*desvirtuado*) and *favorecido* entries are not.

### Repository

- Rewritten README, documentation index, methodology, model card, data and schema documentation.
- Developer tooling: top-level `Makefile`, layered requirements (`requirements-api.txt` ← `requirements.txt` ← `requirements-scripts.txt`), documented `.env.example` files, a single CI workflow, and a test suite that runs without the database.
- Added a Code of Conduct (Contributor Covenant 2.1), a security and personal-data policy, and citation metadata.
- Licensing: code under Apache-2.0; derived data and documentation under CC BY 4.0.

### Known open issues

- The v0.8.5 training script, its train/test split, and the builder for five v2 features are not in the repository.
- `network_member_count` still uses the retired fuzzy grouping, and year-keyed features predate the 2010 correction. Both will be rebuilt in v0.9.
- Most labelled cases are model-surfaced. v0.9 will train and report on independently sourced cases separately.
- About 141K contract titles from 2003–2010 carry an encoding artefact ("ý") with no clean public source to restore them.

## Before 1.0

RUBLI was developed privately from January to September 2026. That period covers models v3.3 → v0.8.5, the ARIA pipeline, the bilingual editorial site, and long-form stories. Methodology for retired models is summarised in [docs/RISK_METHODOLOGY.md](docs/RISK_METHODOLOGY.md#7-model-history).
