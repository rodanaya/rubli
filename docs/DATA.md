# Data: sources, processing and known limitations

RUBLI is built only from public records. This page describes where each record comes from, what we do to it, and where it is weak. Read §5 before quoting any figure.

---

## 1. Federal contracts: CompraNet (2002 → 2025-09-28)

CompraNet was Mexico's federal e-procurement system. Its open-data bulk files (`Contratos_CompraNet<year>`, published under `upcp-compranet.buengobierno.gob.mx/cnetassets/datos_abiertos_contratos_expedientes/`) are the backbone of the database.

| | Value |
|---|---|
| Contracts | **3,055,837** |
| Years | 2002–2025; **2004 has no source file**; 2025 is partial |
| Data horizon | **2025-09-28**. The upstream feed froze after CompraNet was legally abolished in 2025 |
| Value | ~9.9 trillion MXN after validation |
| Institutions | **3,462** canonical buyers |
| Vendors | **316,967** canonical suppliers |

The files come in four layouts with very different quality:

| Structure | Years | Vendor RFC coverage | Notes |
|---|---|---:|---|
| A | 2002–2010 | 0.1% | Lowest quality. No publication dates; procedure type mostly missing; vendor matching by name only |
| B | 2010–2017 | 15.7% | All-uppercase text; about 72% direct awards |
| C | 2018–2022 | 30.3% | Mixed case; about 78% direct awards |
| D | 2023–2025 | 47.4% | Best quality; every row has a budget *partida* code |

### Validation rules applied at ingest

| Contract amount | Action | Why |
|---|---|---|
| > 100,000,000,000 MXN | **Rejected** (set to 0, excluded from analytics) | Decimal-place errors. Mexico's whole federal budget is ~8 trillion MXN a year |
| > 10,000,000,000 MXN | **Flagged** for review, included | Rare legitimate mega-contracts exist (energy, infrastructure) |
| ≤ 10,000,000,000 MXN | Accepted | |

The API additionally flags amounts that are implausible *relative to the vendor's own history* (suspected decimal errors), so a single outlier cannot drive a ranking.

Single bid is defined strictly: a **competitive** procedure in which only one vendor appears. A direct award with one vendor is expected and is not counted as a single bid.

## 2. After CompraNet: the ComprasMX gap (2025-09-28 → 2026-10-02)

After CompraNet's bulk feed stopped, awards continued on **ComprasMX**, which does not publish a comparable bulk file. RUBLI recovered them separately:

| | Value |
|---|---|
| Procedures | **98,290** |
| With an award amount recovered by OCR from award documents | **52,537** (356.0 billion MXN) |
| Window | 2025-09-28 → 2026-10-02 |
| Table | `gap_contracts` (kept **separate** from `contracts` and never mixed into CompraNet totals) |

These procedures are **not scored by the v0.8.5 model**. They carry a separate structural red-flag indicator built from six flags: no competition, missing amount, young vendor, EFOS-listed vendor, unusually large amount, and buyer concentration. OCR amounts can be wrong, and 535 procedures are denominated in US dollars or euros (see the `currency` column), so do not sum amounts without converting. The repository includes the loader ([`backend/scripts/load_comprasmx_gap.py`](../backend/scripts/load_comprasmx_gap.py), which takes the staging database path as an argument) but not the collector/OCR pipeline or the grading script.

## 3. External registries

| Source | Publisher | Records | How it is used |
|---|---|---:|---|
| EFOS list (Art. 69-B CFF) | SAT | 13,960 entries (11,208 definitive) | Taxpayers listed for invoicing simulated operations. Only the *definitivo* stage is shown as a flag; *presunto*, *desvirtuado* and *favorecido* entries are not |
| Sanctioned suppliers | SFP | 2,395 | Debarments and fines. Very few rows carry an RFC, so most matches are by exact normalised full name. The site labels each match "RFC-verified", "name match" or "ambiguous" |
| RUPC supplier registry | CompraNet / ComprasMX | 23,704 | Vendor verification and RFC recovery |
| Audit findings | ASF | 692 cases | Linked to buyers through a reviewed institution crosswalk (`backend/data/asf_institution_crosswalk.csv`) |

Loaders: [`load_sat_efos.py`](../backend/scripts/load_sat_efos.py), [`load_sfp_sanctions.py`](../backend/scripts/load_sfp_sanctions.py), [`load_rupc.py`](../backend/scripts/load_rupc.py), [`scrape_asf.py`](../backend/scripts/scrape_asf.py).

A match against any registry is a lead to check. It is not a finding about the contract.

## 4. Entity resolution

The same company appears under many spellings over 23 years, and the same agency changed names and ids across administrations. Since 2026-09 RUBLI resolves both with a precision-first method:

- **Institutions:** 4.4K raw buyer records → **3,462 canonical institutions** (exact normalised names, successor mappings for renamed agencies).
- **Vendors:** 320K raw vendor records → **316,967 canonical vendors**. Only two kinds of evidence may merge vendors automatically:
  1. the same high-quality ("grade A") RFC with agreeing names;
  2. the same normalised legal-entity name, plus at least one co-signal (shared buyer, sector or nearby years), the same legal form, and no conflicting RFC.

  On a held-out gold set these automatic tiers measured **99.46% precision** (95% CI 98.0–99.9%).
- **Guards:** two different grade-A RFCs never merge. Any merge touching a labelled-case vendor or a sanctioned vendor goes to human review. **Natural persons are never merged by name.**
- Fuzzy and phonetic matches are kept as *link-only* candidates for analysts. They never propagate risk, sanctions or labels.

An older fuzzy grouping (`vendor_aliases`, ~19% precision) has been retired from the site. It still feeds one model feature, `network_member_count`, until the next retrain.

Code: [`backend/scripts/_vendor_canonical.py`](../backend/scripts/_vendor_canonical.py), [`_institution_canonical.py`](../backend/scripts/_institution_canonical.py), and the matching primitives in [`backend/hyperion/`](../backend/hyperion/).

## 5. Known limitations

| Issue | Effect | Status |
|---|---|---|
| **2004 missing** | No source file; only a handful of stray rows carry that year | Disclosed; nothing to ingest |
| **2025 partial** | Ends 2025-09-28 (about 93K of a typical ~143K contracts a year) | Upstream frozen. Later awards are in the separate gap table |
| **Structure A quality** | 0.1% RFC coverage, no publication dates. Risk is likely underestimated and vendor matching is weakest | Inherent to the source |
| **Garbled 2003–2010 titles** | About 141K contract titles had accented letters (á, é, í, ó, ª) replaced by "ý" in the source/ETL | No clean public source found. Display strips the artefact; the raw text is unchanged |
| **Mis-yeared 2010 file** | About 176K contracts from the 2010 file were dated 2011–2012 but stored as 2010, creating a fake 2010 spike | **Fixed** (2026-09-30). Model features computed before the fix still use the old years |
| **Label provenance** | 989 of 1,417 labelled cases were surfaced by the model or ARIA | See [GROUND_TRUTH.md](GROUND_TRUTH.md) |
| **Model validation** | The original 0.785 test AUC could not be reproduced; forward-holdout AUC is 0.656 | See [MODEL_CARD.md](MODEL_CARD.md) |
| **`network_member_count`** | Uses the retired ~19%-precision grouping | Rebuild at v0.9 |
| **Award data only** | Execution, payments and delivery are not in CompraNet | Inherent |
| **Federal scope** | State and municipal systems are only partly visible, through federally funded procedures | Inherent |

## 6. Personal data

Natural persons (personas físicas) appear in CompraNet as suppliers. RUBLI never publishes their 13-character RFCs: masking happens server-side on every response. Pattern labels such as "ghost company" are not attached to natural persons or public bodies. Raw SAT/SFP downloads and the database file are not part of this repository.
