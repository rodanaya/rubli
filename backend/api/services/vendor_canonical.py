"""Canonical vendor identity (backend/scripts/migrate_vendors.py).

The ETL minted one vendor id per name spelling and CompraNet era; vendor_canonical
maps every member of a merged group to its surviving canonical_id (ids not in the
table are their own canonical). vendor_stats is keyed by canonical id only.
On a DB without the table (pre-migration, test fixtures) every id is canonical.
"""
from __future__ import annotations

import sqlite3

ABSORBED_IDS_SQL = "SELECT vendor_id FROM vendor_canonical WHERE canonical_id <> vendor_id"


def _has(conn: sqlite3.Connection, table: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
    ).fetchone() is not None


def has_canonical(conn: sqlite3.Connection) -> bool:
    return _has(conn, "vendor_canonical")


def canonical_id(conn: sqlite3.Connection, vendor_id: int) -> int:
    if not has_canonical(conn):
        return vendor_id
    row = conn.execute("SELECT canonical_id FROM vendor_canonical WHERE vendor_id = ?", (vendor_id,)).fetchone()
    return row[0] if row else vendor_id


def group_ids(conn: sqlite3.Connection, canonical: int) -> list[int]:
    """Every raw vendor id whose contracts belong to this canonical id."""
    if not has_canonical(conn):
        return [canonical]
    ids = [r[0] for r in conn.execute("SELECT vendor_id FROM vendor_canonical WHERE canonical_id = ?", (canonical,))]
    return ids or [canonical]


def not_absorbed(conn: sqlite3.Connection, col: str) -> str:
    """SQL predicate: the id is canonical (absorbed ids are hidden from lists)."""
    return f"{col} NOT IN ({ABSORBED_IDS_SQL})" if has_canonical(conn) else "1 = 1"


def rfc_recovery_source(conn: sqlite3.Connection, vendor_id: int) -> str | None:
    """'raw_rows' | 'rupc' when vendors.rfc was recovered by the migration (company RFCs only)."""
    if not _has(conn, "vendor_rfc_quality"):
        return None
    row = conn.execute(
        "SELECT best_rfc_source FROM vendor_rfc_quality WHERE vendor_id = ? AND rfc_recovered = 1 AND display_ok = 1",
        (vendor_id,),
    ).fetchone()
    return row[0] if row else None


# UI copy per tier (entity-resolution findings, § 8; working notes not in this repo)
LINK_NOTE = {
    "en": "Possibly the same entity (name variant). Not merged: contracts, risk indicators and sanctions are shown separately.",
    "es": "Posible misma entidad (variante del nombre). No fusionada: contratos, indicadores de riesgo y sanciones se muestran por separado.",
}
RFC_RELATED_NOTE = {
    "en": "Shares a tax ID with {name}: related, not necessarily the same company.",
    "es": "Comparte RFC con {name}: relacionada, no necesariamente la misma empresa.",
}


def link_note(tier: str, lang: str, name: str) -> str:
    return (RFC_RELATED_NOTE[lang].format(name=name) if tier == "PROBABLE_rfc_related" else LINK_NOTE[lang])


def possible_same_entities(conn: sqlite3.Connection, vendor_id: int, limit: int = 20) -> list[dict]:
    """Public link-only candidates ('possibly the same entity') for a canonical vendor.

    Never merged: contracts, risk and sanctions stay separate. Only rows marked
    public by the migration (never personas físicas, never the analyst-only tiers).
    """
    if not _has(conn, "vendor_match_candidates"):
        return []
    ids = group_ids(conn, vendor_id)
    ph = ",".join("?" * len(ids))
    rows = conn.execute(
        f"""
        SELECT CASE WHEN left_vendor_id IN ({ph}) THEN right_vendor_id ELSE left_vendor_id END AS other,
               tier, score
        FROM vendor_match_candidates
        WHERE public = 1 AND (left_vendor_id IN ({ph}) OR right_vendor_id IN ({ph}))
        """,
        [*ids, *ids, *ids],
    ).fetchall()
    out: dict[int, dict] = {}
    for other, tier, score in rows:
        cid = canonical_id(conn, other)
        if cid == vendor_id or cid in out:
            continue
        out[cid] = {"vendor_id": cid, "tier": tier, "score": score}
    return list(out.values())[:limit]
