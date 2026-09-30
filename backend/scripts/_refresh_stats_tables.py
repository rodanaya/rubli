#!/usr/bin/env python3
"""
Refresh institution_stats and vendor_stats from current contracts table.

Run after any risk scoring run to sync derived stats with actual contract scores.
Uses risk_level column (pre-computed) for high-risk counts, and
recalculates all aggregate metrics from scratch.

High-risk thresholds (v6.x): critical >= 0.60, high >= 0.40
high_risk_pct = 100 * (critical + high) / total_contracts  → stored as 0-100
"""

import sqlite3
import logging
from pathlib import Path
import os

try:
    from scripts._institution_canonical import install_contracts_canon, delete_absorbed_rows
    from scripts import _vendor_canonical as vcanon
except ImportError:  # run as a plain file from backend/scripts
    from _institution_canonical import install_contracts_canon, delete_absorbed_rows
    import _vendor_canonical as vcanon

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DB_PATH = Path(os.environ.get("DATABASE_PATH", str(Path(__file__).parent.parent / "RUBLI_NORMALIZED.db")))


def refresh_institution_stats(conn: sqlite3.Connection) -> None:
    log.info("Refreshing institution_stats from current contracts …")
    conn.execute("PRAGMA synchronous = OFF")

    # Canonical ids (scripts/migrate_institutions.py): absorbed ids fold into their
    # canonical row; the upsert also creates a row for a canonical id that had none.
    install_contracts_canon(conn)
    conn.execute("""
        INSERT INTO institution_stats (
            institution_id, total_contracts, total_value_mxn, avg_risk_score,
            high_risk_count, high_risk_pct, direct_award_count, direct_award_pct,
            single_bid_count, single_bid_pct, vendor_count,
            first_contract_year, last_contract_year, updated_at)
        SELECT s.*, CURRENT_TIMESTAMP
        FROM (
            SELECT
                institution_id,
                COUNT(*)                                                                 AS tc,
                SUM(COALESCE(amount_mxn, 0))                                             AS tv,
                AVG(COALESCE(risk_score, 0))                                             AS avg_r,
                SUM(CASE WHEN risk_level IN ('high','critical') THEN 1 ELSE 0 END)       AS hrc,
                ROUND(100.0 * SUM(CASE WHEN risk_level IN ('high','critical') THEN 1 ELSE 0 END) / COUNT(*), 2) AS hrp,
                SUM(CASE WHEN is_direct_award = 1 THEN 1 ELSE 0 END)                    AS dac,
                ROUND(100.0 * SUM(CASE WHEN is_direct_award = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) AS dap,
                SUM(CASE WHEN is_single_bid = 1 THEN 1 ELSE 0 END)                      AS sbc,
                ROUND(100.0 * SUM(CASE WHEN is_single_bid = 1 THEN 1 ELSE 0 END) / COUNT(*), 2)  AS sbp,
                COUNT(DISTINCT vendor_id)                                                AS vc,
                MIN(CAST(strftime('%Y', contract_date) AS INTEGER))                      AS fcy,
                MAX(CAST(strftime('%Y', contract_date) AS INTEGER))                      AS lcy
            FROM contracts_canon
            WHERE institution_id IS NOT NULL
            GROUP BY institution_id
        ) s
        WHERE true
        ON CONFLICT(institution_id) DO UPDATE SET
            total_contracts    = excluded.total_contracts,
            total_value_mxn    = excluded.total_value_mxn,
            avg_risk_score     = excluded.avg_risk_score,
            high_risk_count    = excluded.high_risk_count,
            high_risk_pct      = excluded.high_risk_pct,
            direct_award_count = excluded.direct_award_count,
            direct_award_pct   = excluded.direct_award_pct,
            single_bid_count   = excluded.single_bid_count,
            single_bid_pct     = excluded.single_bid_pct,
            vendor_count       = excluded.vendor_count,
            first_contract_year = excluded.first_contract_year,
            last_contract_year  = excluded.last_contract_year,
            updated_at         = CURRENT_TIMESTAMP
    """)
    affected = conn.execute("SELECT changes()").fetchone()[0]
    dropped = delete_absorbed_rows(conn, "institution_stats")
    conn.commit()
    log.info("  %d absorbed-id rows dropped", dropped)

    total = conn.execute("SELECT COUNT(*) FROM institution_stats").fetchone()[0]
    log.info("  institution_stats refreshed: %d rows updated, %d total", affected, total)


def refresh_vendor_stats(conn: sqlite3.Connection) -> None:
    log.info("Refreshing vendor_stats from current contracts …")

    # Canonical ids (scripts/migrate_vendors.py): absorbed ids fold into their
    # canonical row; the upsert also creates a row for a canonical id that had none.
    grouped = vcanon.install_contracts_vcanon(conn)
    conn.execute("""
        INSERT INTO vendor_stats (
            vendor_id, total_contracts, total_value_mxn, avg_risk_score,
            high_risk_pct, direct_award_pct, single_bid_pct, sector_count,
            institution_count, first_contract_year, last_contract_year, updated_at)
        SELECT s.*, CURRENT_TIMESTAMP
        FROM (
            SELECT
                vendor_id,
                COUNT(*)                                                                          AS tc,
                SUM(COALESCE(amount_mxn, 0))                                                      AS tv,
                AVG(COALESCE(risk_score, 0))                                                      AS avg_r,
                ROUND(100.0 * SUM(CASE WHEN risk_level IN ('high','critical') THEN 1 ELSE 0 END) / COUNT(*), 2) AS hrp,
                ROUND(100.0 * SUM(CASE WHEN is_direct_award = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) AS dap,
                ROUND(100.0 * SUM(CASE WHEN is_single_bid = 1 THEN 1 ELSE 0 END) / COUNT(*), 2)   AS sbp,
                COUNT(DISTINCT sector_id)                                                          AS sc,
                COUNT(DISTINCT institution_id)                                                     AS ic,
                MIN(CAST(strftime('%Y', contract_date) AS INTEGER))                                AS fcy,
                MAX(CAST(strftime('%Y', contract_date) AS INTEGER))                                AS lcy
            FROM contracts_vcanon
            WHERE vendor_id IS NOT NULL
            GROUP BY vendor_id
        ) s
        WHERE true
        ON CONFLICT(vendor_id) DO UPDATE SET
            total_contracts     = excluded.total_contracts,
            total_value_mxn     = excluded.total_value_mxn,
            avg_risk_score      = excluded.avg_risk_score,
            high_risk_pct       = excluded.high_risk_pct,
            direct_award_pct    = excluded.direct_award_pct,
            single_bid_pct      = excluded.single_bid_pct,
            sector_count        = excluded.sector_count,
            institution_count   = excluded.institution_count,
            first_contract_year = excluded.first_contract_year,
            last_contract_year  = excluded.last_contract_year,
            updated_at          = CURRENT_TIMESTAMP
    """)
    affected = conn.execute("SELECT changes()").fetchone()[0]
    dropped = vcanon.delete_absorbed_rows(conn, "vendor_stats")
    synced = 0
    if grouped:
        # vendors.* totals feed /vendors/top and rankings: canonical rows carry the group
        synced = conn.execute("""
            UPDATE vendors SET
                total_contracts  = vs.total_contracts,
                total_amount_mxn = vs.total_value_mxn,
                avg_risk_score   = vs.avg_risk_score
            FROM vendor_stats vs
            WHERE vs.vendor_id = vendors.id
              AND vendors.id IN (SELECT canonical_id FROM vendor_canonical)
        """).rowcount
    conn.commit()
    log.info("  %d absorbed-id rows dropped, %d canonical vendors rows synced", dropped, synced)

    total = conn.execute("SELECT COUNT(*) FROM vendor_stats").fetchone()[0]
    log.info("  vendor_stats refreshed: %d rows updated, %d total", affected, total)


def main() -> None:
    import argparse
    p = argparse.ArgumentParser(description="Refresh institution_stats and vendor_stats from contracts")
    p.add_argument("--institutions-only", action="store_true")
    p.add_argument("--vendors-only",      action="store_true")
    p.add_argument("--db",                default=str(DB_PATH))
    args = p.parse_args()

    conn = sqlite3.connect(args.db, timeout=120)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 60000")

    if not args.vendors_only:
        refresh_institution_stats(conn)

    if not args.institutions_only:
        refresh_vendor_stats(conn)

    conn.close()
    log.info("Done.")


if __name__ == "__main__":
    main()
