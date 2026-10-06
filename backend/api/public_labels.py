"""Public labeling guard (Sep-2026 pre-publication audit (internal) § P1 B3/B4/B5).

The live site must not tag a real company or person as an offender without
evidence. Three rules, one module, every router routes through it:

  B3  GT membership. A vendor is "documented in a corruption case" only through
      a link that is not a false positive, not a `scandal_actor` fuzzy match,
      confidence high/confirmed_corrupt, and sourced (source_asf/news/legal
      filled, or case_origin official_record/media_report/audit_report).
      Other non-FP links are an "unverified lead" (neutral). FP and
      scandal_actor links are never shown.
  B4  ARIA pattern labels are suppressed for GT false positives, public
      entities, and personas físicas; P7 (= "is in GT") is only shown when
      the vendor is documented.
  B5  Contract amounts: > 10B is flagged for review (data-validation rule);
      a vendor-relative isolated spike is flagged `suspect_decimal` and kept
      out of capture/leader rankings.

Everything is computed from the DB read-only and cached; no table is written.
"""
from __future__ import annotations

import json
import re
import sqlite3
import statistics
from typing import Iterable, Optional

from .cache import app_cache

_CACHE = "public_labels"
_TTL = 3600

# ---------------------------------------------------------------------------
# B3 — ground-truth links
# ---------------------------------------------------------------------------

#: Link is safe to show at all (aliases: gtv = ground_truth_vendors).
PUBLIC_LINK_SQL = (
    "(COALESCE(gtv.is_false_positive, 0) = 0"
    " AND COALESCE(gtv.match_method, '') <> 'scandal_actor')"
)

#: Link may be called "documented" (aliases: gtv, gtc = ground_truth_cases).
DOCUMENTED_LINK_SQL = (
    "(" + PUBLIC_LINK_SQL[1:-1] +
    " AND gtc.confidence_level IN ('high', 'confirmed_corrupt')"
    " AND (TRIM(COALESCE(gtc.source_asf, '')) <> ''"
    "   OR TRIM(COALESCE(gtc.source_news, '')) <> ''"
    "   OR TRIM(COALESCE(gtc.source_legal, '')) <> ''"
    "   OR gtc.case_origin IN ('official_record', 'media_report', 'audit_report')))"
)

# ---------------------------------------------------------------------------
# B4 — public entities (government bodies, public universities, state firms)
# ---------------------------------------------------------------------------

# Names arrive with mojibake (ó → U+FFFD), so accents are matched with `.`
# after every non-ASCII char is folded to '.'. Anchored at the start of the
# name so private firms that merely mention "GOBIERNO" are not caught.
_PUBLIC_ENTITY = re.compile(
    r"^(LA |EL |H\.? )?("
    r"SECRETAR.A (DE|DEL) |GOBIERNO (DEL?|DE LA) |PODER (JUDICIAL|LEGISLATIVO|EJECUTIVO)"
    r"|UNIVERSIDAD (AUT.NOMA|NACIONAL|TECNOL.GICA|POLIT.CNICA|PEDAG.GICA|VERACRUZANA"
    r"|MICHOACANA|JU.REZ|INTERCULTURAL|DE [A-Z]+$|DE GUADALAJARA|DE SONORA|DE GUANAJUATO"
    r"|DE COLIMA|DE QUINTANA)"
    r"|INSTITUTO (POLIT.CNICO NACIONAL|NACIONAL|MEXICANO DEL (SEGURO|PETR.LEO|TRANSPORTE)"
    r"|DE SEGURIDAD Y SERVICIOS|POTOSINO DE INVESTIGACI|TECNOL.GICO (SUPERIOR )?DE )"
    r"|TECNOL.GICO NACIONAL|COMISI.N (FEDERAL DE ELECTRICIDAD|NACIONAL|ESTATAL|DEL AGUA)"
    r"|CFE |PETR.LEOS MEXICANOS|PEMEX|CASA DE MONEDA|COLEGIO DE POSTGRADUADOS|EL COLEGIO DE "
    r"|CENTRO DE INVESTIGACI.N (Y DOCENCIA|CIENT.FICA|EN ALIMENTACI|Y ESTUDIOS|EN MATEM"
    r"|Y DE ESTUDIOS AVANZADOS)|CINVESTAV|INFOTEC|AYUNTAMIENTO|MUNICIPIO DE"
    r"|TELECOMUNICACIONES DE M.XICO|DICONSA|LICONSA|BIRMEX|LABORATORIOS DE BIOL.GICOS Y REACTIVOS"
    r"|SISTEMA (PARA EL|ESTATAL|MUNICIPAL) (DESARROLLO INTEGRAL|DIF)|SERVICIO POSTAL MEXICANO"
    r"|CORREOS DE M.XICO|FERROCARRIL DEL ISTMO|AEROPUERTOS Y SERVICIOS AUXILIARES"
    r"|BANCO NACIONAL DE OBRAS|NACIONAL FINANCIERA|POLIC.A (AUXILIAR|BANCAR.A|FEDERAL)"
    r"|FISCAL.A GENERAL|ADMINISTRACI.N PORTUARIA INTEGRAL|ASIPONA|TALLERES GR.FICOS DE M.XICO"
    r"|IMPRESORA Y ENCUADERNADORA PROGRESO|LOTER.A NACIONAL|PRON.STICOS PARA LA ASISTENCIA"
    r"|SERVICIO DE (ADMINISTRACI.N Y ENAJENACI.N|PROTECCI.N FEDERAL)|GUARDIA NACIONAL"
    r"|SERVICIOS DE SALUD DE)"
)


def _norm_name(name: Optional[str]) -> str:
    s = re.sub(r"[^\x00-\x7f]", ".", (name or "").upper())
    return re.sub(r"\s+", " ", s).strip()


def is_public_entity(name: Optional[str], institution_names: Iterable[str] = ()) -> bool:
    """Name matches a public-body pattern, or equals a buyer institution's name."""
    n = _norm_name(name)
    return bool(n) and (bool(_PUBLIC_ENTITY.search(n)) or n in institution_names)


def is_persona_fisica(is_individual, rfc: Optional[str]) -> bool:
    """vendors.is_individual is imperfect; a 13-char RFC is a persona física too."""
    return bool(is_individual) or len((rfc or "").strip()) == 13


#: Public names for the ARIA pattern codes — signals, not offences.
#: P2 is a missing-RFC heuristic, P4 is built on co-award (not co-bid) data,
#: P6 is a single-buyer count ratio, P7 only means "linked to a GT case".
PATTERN_LABELS: dict[str, tuple[str, str]] = {
    "P1": ("Institutional monopoly", "Monopolio institucional"),
    "P2": ("Low-footprint supplier (no RFC)", "Proveedor de baja huella (sin RFC)"),
    "P3": ("Intermediary", "Intermediario"),
    "P4": ("Co-award pattern", "Patrón de coadjudicación"),
    "P5": ("Systematic overpricing", "Sobreprecio sistemático"),
    "P6": ("Single-buyer dependence", "Dependencia de un solo comprador"),
    "P7": ("Linked to a labelled case", "Vinculado a un caso etiquetado"),
}


# ---------------------------------------------------------------------------
# Cached vendor sets
# ---------------------------------------------------------------------------

def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def label_sets(conn: sqlite3.Connection) -> dict:
    """{documented, leads, fp: set[int], suppressed: {vendor_id: (pattern, reason)}}."""
    cached = app_cache.get(_CACHE, "sets")
    if cached is not None:
        return cached

    documented: set[int] = set()
    leads: set[int] = set()
    fp: set[int] = set()
    if _table_exists(conn, "ground_truth_vendors") and _table_exists(conn, "ground_truth_cases"):
        for vid, is_doc, is_pub in conn.execute(
            f"""SELECT gtv.vendor_id, {DOCUMENTED_LINK_SQL}, {PUBLIC_LINK_SQL}
                FROM ground_truth_vendors gtv
                LEFT JOIN ground_truth_cases gtc ON gtc.id = gtv.case_id
                WHERE gtv.vendor_id IS NOT NULL"""
        ):
            if is_doc:
                documented.add(vid)
            elif is_pub:
                leads.add(vid)
            else:
                fp.add(vid)
    leads -= documented
    fp -= documented | leads

    suppressed: dict[int, tuple[str, str]] = {}
    if _table_exists(conn, "aria_queue"):
        inst = {_norm_name(r[0]) for r in conn.execute("SELECT name FROM institutions")}
        for vid, pattern, name, is_ind, rfc in conn.execute(
            """SELECT q.vendor_id, q.primary_pattern, v.name, v.is_individual, v.rfc
               FROM aria_queue q JOIN vendors v ON v.id = q.vendor_id
               WHERE q.primary_pattern IS NOT NULL"""
        ):
            if vid in fp:
                reason = "false_positive"
            elif is_public_entity(name, inst):
                reason = "public_entity"
            elif is_persona_fisica(is_ind, rfc):
                reason = "persona_fisica"
            elif pattern == "P7" and vid not in documented:
                reason = "unverified_case_link"
            else:
                continue
            suppressed[vid] = (pattern, reason)

    result = {"documented": documented, "leads": leads, "fp": fp, "suppressed": suppressed}
    app_cache.set(_CACHE, "sets", result, maxsize=2, ttl=_TTL)
    return result


def suppressed_ids_json(conn: sqlite3.Connection) -> str:
    """JSON array for `vendor_id NOT IN (SELECT value FROM json_each(?))`."""
    return json.dumps(sorted(label_sets(conn)["suppressed"]))


#: Drop-in SQL guard for queries over aria_queue that bind suppressed_ids_json().
NOT_SUPPRESSED_SQL = "vendor_id NOT IN (SELECT value FROM json_each(?))"


def public_pattern_counts(conn: sqlite3.Connection, raw: dict) -> dict:
    """Subtract suppressed vendors from a {pattern: count} map."""
    out = dict(raw)
    for pattern, _ in label_sets(conn)["suppressed"].values():
        if pattern in out:
            out[pattern] -= 1
    return out


#: Per-pattern scores that would restate a suppressed label.
_PATTERN_DETAIL_KEYS = ("pattern_confidence", "pattern_confidences", "ghost_score", "capture_score")


#: Internal reviewer verdicts in aria_queue.review_status. They are an analyst's
#: triage note, not a public finding.
CONFIRMED_STATUSES = ("confirmed", "confirmed_corrupt")


def public_review_status(raw: Optional[str], vendor_id, documented: set) -> Optional[str]:
    """'confirmed' is shown only for a documented vendor (DOCUMENTED_LINK_SQL:
    tier A/B, sourced, not a false positive); any other confirmed row reads 'reviewed'."""
    if raw in CONFIRMED_STATUSES and vendor_id not in documented:
        return "reviewed"
    return raw


def public_status_counts(conn: sqlite3.Connection, rows: Iterable[tuple]) -> dict:
    """{status: count} from (vendor_id, raw_status) pairs, after public_review_status."""
    documented = label_sets(conn)["documented"]
    out: dict = {}
    for vid, raw in rows:
        k = public_review_status(raw or "pending", vid, documented)
        out[k] = out.get(k, 0) + 1
    return out


def apply_public_labels(
    conn: sqlite3.Connection,
    rows: list[dict],
    *,
    vendor_key: str = "vendor_id",
    pattern_key: str = "primary_pattern",
    gt_keys: tuple[str, ...] = ("in_ground_truth", "is_gt", "gt_overlay"),
) -> list[dict]:
    """Rewrite serialized rows in place so they carry only public-safe labels.

    - `pattern_key` → None (+ `pattern_suppressed` reason) when suppressed.
    - each present `gt_keys` field → documented-case membership only; an
      unverified GT link is reported as `gt_lead` instead.
    - `review_status` → public_review_status (no "confirmed" for undocumented vendors).
    """
    if not rows:
        return rows
    s = label_sets(conn)
    for d in rows:
        vid = d.get(vendor_key)
        if vid is None:
            continue
        hit = s["suppressed"].get(vid)
        if hit and d.get(pattern_key):
            d[pattern_key] = None
            for k in _PATTERN_DETAIL_KEYS:
                if k in d:
                    d[k] = None
            d["pattern_suppressed"] = hit[1]
        if "review_status" in d:
            d["review_status"] = public_review_status(d["review_status"], vid, s["documented"])
        present = [k for k in gt_keys if k in d]
        if present:
            documented = vid in s["documented"]
            for k in present:
                d[k] = int(documented) if type(d[k]) is int else documented
            d["gt_lead"] = vid in s["leads"]
    return rows


def excluded_from_rankings(conn: sqlite3.Connection, vendor_id) -> bool:
    """Never shown as an offender in a leaderboard: GT false positives and
    personas físicas (by is_individual or 13-char RFC)."""
    if vendor_id in label_sets(conn)["fp"]:
        return True
    row = conn.execute(
        "SELECT is_individual, rfc FROM vendors WHERE id = ?", (vendor_id,)
    ).fetchone()
    return row is not None and is_persona_fisica(row[0], row[1])


def ranking_safe(conn: sqlite3.Connection, rows: list[dict], **label_kw) -> list[dict]:
    """Drop rows that must not appear on a named "suspicious"/leader list
    (suppressed labels, GT FPs, personas físicas), then relabel the rest."""
    key = label_kw.get("vendor_key", "vendor_id")
    suppressed = label_sets(conn)["suppressed"]
    kept = [
        d for d in rows
        if d.get(key) not in suppressed and not excluded_from_rankings(conn, d.get(key))
    ]
    return apply_public_labels(conn, kept, **label_kw)


def withhold_persona_names(conn: sqlite3.Connection, rows: list[dict],
                           id_key: str = "vendor_id", name_key: str = "vendor_name") -> list[dict]:
    """Blank the vendor name on rows held by a persona física (a fact list such as
    "largest contracts" keeps the row, but not the person's name; the UI then shows
    an unidentified vendor). Same test as excluded_from_rankings()."""
    ids = sorted({r.get(id_key) for r in rows if r.get(id_key) is not None})
    if not ids:
        return rows
    persons = {
        vid for vid, is_ind, rfc in conn.execute(
            f"SELECT id, is_individual, rfc FROM vendors WHERE id IN ({','.join('?' * len(ids))})", ids
        )
        if is_persona_fisica(is_ind, rfc)
    }
    return [{**r, name_key: ""} if r.get(id_key) in persons else r for r in rows]


# ---------------------------------------------------------------------------
# B5 — amount flags
# ---------------------------------------------------------------------------

REVIEW_THRESHOLD = 10_000_000_000   # docs/DATA.md: > 10B → flag
SPIKE_FLOOR = 1_000_000_000         # only spikes above 1B matter for rankings
SPIKE_X_MEDIAN = 1000               # > 1000× the vendor's median contract
SPIKE_X_NEXT = 100                  # and > 100× its next-largest contract (isolated)


def vendor_suspect_contracts(conn: sqlite3.Connection, vendor_id) -> dict[int, dict]:
    """{contract_id: {...}} for this vendor's isolated spikes — the signature of
    a ×1000 decimal error (e.g. 2604968: 4.2B vs a 0.9M median, next 6.9M)."""
    key = f"spikes:{vendor_id}"
    cached = app_cache.get(_CACHE, key)
    if cached is not None:
        return cached
    rows = conn.execute(
        "SELECT id, amount_mxn, institution_id, contract_year FROM contracts"
        " WHERE vendor_id = ? AND amount_mxn > 0 ORDER BY amount_mxn DESC",
        (vendor_id,),
    ).fetchall()
    out: dict[int, dict] = {}
    if rows and rows[0][1] > SPIKE_FLOOR:
        med = statistics.median(r[1] for r in rows)
        for i, (cid, amt, inst, yr) in enumerate(rows):
            if amt <= SPIKE_FLOOR:
                break
            nxt = rows[i + 1][1] if i + 1 < len(rows) else 0
            if amt > SPIKE_X_MEDIAN * med and amt > SPIKE_X_NEXT * nxt:
                out[cid] = {
                    "vendor_id": vendor_id, "institution_id": inst, "contract_year": yr,
                    "amount_mxn": amt, "vendor_median": med, "next_largest": nxt,
                }
    app_cache.set(_CACHE, key, out, maxsize=4096, ttl=3600)
    return out


def suspect_decimal_contracts(conn: sqlite3.Connection) -> dict[int, dict]:
    """Full scan over every vendor with a > 1B contract (~500). For audits and
    scripts — request paths use vendor_suspect_contracts()."""
    out: dict[int, dict] = {}
    for (vid,) in conn.execute(
        "SELECT DISTINCT vendor_id FROM contracts WHERE amount_mxn > ? AND vendor_id IS NOT NULL",
        (SPIKE_FLOOR,),
    ).fetchall():
        out.update(vendor_suspect_contracts(conn, vid))
    return out


def amount_flag(conn: sqlite3.Connection, contract_id: int, amount, vendor_id) -> Optional[str]:
    """'suspect_decimal' | 'review' (> 10B) | None."""
    if amount is None or amount <= SPIKE_FLOOR:
        return None
    if vendor_id is not None and contract_id in vendor_suspect_contracts(conn, vendor_id):
        return "suspect_decimal"
    if amount > REVIEW_THRESHOLD:
        return "review"
    return None


def capture_pair_excluded(conn: sqlite3.Connection, vendor_id, institution_id) -> bool:
    """A capture/leader row is withheld when its vendor is excluded from
    rankings or its share rests on a suspect-decimal contract at that buyer."""
    if excluded_from_rankings(conn, vendor_id):
        return True
    return any(
        c["institution_id"] == institution_id
        for c in vendor_suspect_contracts(conn, vendor_id).values()
    )
