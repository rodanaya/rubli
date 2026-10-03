# RUBLI documentation

Start with the project [README](../README.md). The pages below go deeper. Each one states its own limits.

## Understand the data and the model

| Document | Read it to learn |
|---|---|
| [DATA.md](DATA.md) | Where every record comes from, the CompraNet structures A–D, validation rules, the post-CompraNet ComprasMX gap, entity resolution, and **known limitations** |
| [RISK_METHODOLOGY.md](RISK_METHODOLOGY.md) | How the v0.8.5 risk indicator is computed: features, coefficients, thresholds, model history |
| [MODEL_CARD.md](MODEL_CARD.md) | Intended and out-of-scope uses, evaluation (forward-holdout AUC 0.656), failure modes, monitoring |
| [GROUND_TRUTH.md](GROUND_TRUTH.md) | The 1,417 labelled cases: provenance, scope, false positives, caveats |
| [ARIA_SPEC.md](ARIA_SPEC.md) | The investigation-queue pipeline: priority score, pattern signals, registry cross-checks |

## Work on the code

| Document | Read it to learn |
|---|---|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Running locally, building a database, required checks, conventions |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Core tables and columns |
| [SCORING.md](SCORING.md) | Which scoring script does what. **Read before any rescore** |
| [QUERY_OPTIMIZATION.md](QUERY_OPTIMIZATION.md) | SQLite indexing, caching and pagination patterns |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Frontend chart primitives, colour tokens and copy rules |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Running your own instance with Docker Compose and Caddy |

## Reference

| Document | Content |
|---|---|
| [INSTITUTION_TYPES_REFERENCE.md](INSTITUTION_TYPES_REFERENCE.md) | 19-type institution taxonomy, size tiers, autonomy levels |
| [VENDOR_CLASSIFICATION_METHODOLOGY.md](VENDOR_CLASSIFICATION_METHODOLOGY.md) | How vendor industry classifications are sourced |
| [press/](press/) | Press kit (Spanish): press release, journalists' guide, technical one-pager |
