# Contributing to RUBLI

Thank you for helping. RUBLI attaches risk indicators to real companies and public bodies, so contributions are held to two standards at once: **the code must work, and every claim must be true.**

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

| You have… | Do this |
|---|---|
| A data error (wrong amount, wrong year, two companies merged, a wrong case link) | Open an issue with the **data correction** label. Give the record id or URL on rubli.xyz, what is wrong, and a public source |
| A correction about a company or person named on the site | Email **rubli-project@proton.me**. These are handled first and privately |
| A security issue or exposed personal data | Follow [SECURITY.md](SECURITY.md). **Never open a public issue** |
| A bug or feature idea | Open an issue with steps to reproduce, or the problem the feature solves |
| Code or documentation | Open a pull request (below) |

## Development setup

The full guide is [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). The short version:

```bash
# Frontend against the public API — no database needed
cd frontend && npm install && VITE_API_URL=https://rubli.xyz npm run dev

# Backend (needs a local database; see docs/DEVELOPMENT.md#getting-a-database)
cd backend && pip install -r requirements.txt && uvicorn api.main:app --port 8001
```

Requirements: Python 3.11, Node 20. On Linux/macOS, `make setup`, `make test` and `make lint` wrap the steps above and below.

## Before you open a pull request

Every PR must pass the same checks CI runs.

```bash
# Backend
python -m pytest backend/tests/ -q --tb=short -p no:cacheprovider

# Frontend (from frontend/)
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm run lint:tokens
npx vitest run
```

Also:

- **Keep the change small and focused.** Don't refactor code you weren't asked to touch.
- **Add or update a test** for any non-trivial logic: a parser, a money path, a SQL query, a matching rule.
- **Bilingual UI.** Every visible string needs Spanish and English (i18n).
- **Parameterised SQL only.** Validate input at the API boundary.
- **No personal data.** Never log, return or commit a natural person's RFC, and never commit `.env` files, database files or raw registry downloads.

## Rules for anything that touches data or wording

These rules come from mistakes this project has already made and fixed.

1. **Risk indicator, not probability.** Never write "X% probability of corruption" and never call a vendor corrupt because of its score.
2. **Labelled cases, not verified cases.** The case set is mostly analyst-written leads. Say where a case comes from.
3. **Cite real sources.** Every external figure or report you cite must be one you have opened. Unverifiable citations are removed.
4. **Respect the amount rules.** Over 100B MXN is rejected; over 10B MXN is flagged. Never sum `estimated_fraud_mxn` as "money stolen".
5. **Don't rescore casually.** Read [docs/SCORING.md](docs/SCORING.md) first. Several retired scorers can still overwrite active scores.
6. **Numbers must match the data.** If you change a figure in docs or copy, say in the PR how you measured it.

## Commit and PR style

- Imperative, scoped subject lines, for example:
  - `fix(api): mask persona-física RFC in dossier export`
  - `docs(methodology): correct institution_diversity description`
  - `feat(frontend § sectors): add year filter to sector table`
- Explain *why* in the body, and reference the issue.
- One logical change per commit, where practical.
- PR description: what changed, how you verified it (commands, screenshots for UI), and any data or wording effect.

## Licensing of contributions

Code you contribute is licensed under [Apache-2.0](LICENSE). Documentation and data contributions are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Only contribute material you have the right to license this way.
