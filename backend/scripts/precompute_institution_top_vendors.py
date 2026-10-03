"""Rebuild institution_top_vendors for canonical institution groups.

institution_top_vendors (top-50 vendors per institution by contract count) has no
other builder in the repo. After scripts/migrate_institutions.py, a canonical
institution's rows must cover its absorbed ids, and absorbed ids must have none.
This rebuilds only the canonical ids whose contracts changed identity (groups
with >1 member, plus container re-attribution targets passed via --also);
every other institution's rows are left as they are.

    python -m scripts.precompute_institution_top_vendors --db PATH [--also 227,384]
"""
import argparse
import sqlite3
import time
from datetime import datetime, timezone

try:
    from scripts._institution_canonical import install_contracts_canon, delete_absorbed_rows
except ImportError:  # run as a plain file from backend/scripts
    from _institution_canonical import install_contracts_canon, delete_absorbed_rows

MAX_CONTRACT_VALUE = 100_000_000_000  # 100B MXN — reject above (data-validation rule)
TOP_N = 50

FILL = """
INSERT INTO institution_top_vendors
    (institution_id, vendor_id, vendor_name, rfc, contract_count, total_value_mxn, avg_risk_score,
     first_year, last_year, rank_by_count, sector_id, hr_count, da_count, sb_count, flags_computed_at)
SELECT institution_id, vendor_id, vendor_name, rfc, n, tv, ar, fy, ly, rk, sector_id, hr, da, sb, ?
FROM (
    SELECT c.institution_id, c.vendor_id, v.name AS vendor_name, v.rfc,
           COUNT(*) AS n, SUM(COALESCE(c.amount_mxn, 0)) AS tv, AVG(c.risk_score) AS ar,
           MIN(c.contract_year) AS fy, MAX(c.contract_year) AS ly, i.sector_id,
           SUM(CASE WHEN c.risk_score >= 0.40 THEN 1 ELSE 0 END) AS hr,
           SUM(CASE WHEN c.is_direct_award = 1 THEN 1 ELSE 0 END) AS da,
           SUM(CASE WHEN c.is_single_bid = 1 THEN 1 ELSE 0 END) AS sb,
           ROW_NUMBER() OVER (PARTITION BY c.institution_id
                              ORDER BY COUNT(*) DESC, SUM(COALESCE(c.amount_mxn, 0)) DESC) AS rk
    FROM contracts_canon c
    JOIN vendors v ON v.id = c.vendor_id
    JOIN institutions i ON i.id = c.institution_id
    WHERE c.institution_id IN (SELECT id FROM temp._itv_targets)
      AND COALESCE(c.amount_mxn, 0) <= ?
    GROUP BY c.institution_id, c.vendor_id
)
WHERE rk <= ?
"""


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True)
    p.add_argument("--also", default="", help="extra canonical ids to rebuild (comma-separated)")
    a = p.parse_args()
    t0 = time.time()
    conn = sqlite3.connect(a.db, timeout=60)
    if not install_contracts_canon(conn):
        print("no institution_canonical table — nothing to do")
        return
    extra = [int(x) for x in a.also.split(",") if x.strip()]
    conn.execute("DROP TABLE IF EXISTS temp._itv_targets")
    conn.execute("""CREATE TEMP TABLE _itv_targets AS
                    SELECT canonical_id AS id FROM institution_canonical
                    GROUP BY canonical_id HAVING COUNT(*) > 1""")
    conn.executemany("INSERT INTO temp._itv_targets VALUES (?)", [(i,) for i in extra])
    conn.commit()
    try:
        conn.execute("BEGIN")
        dropped = delete_absorbed_rows(conn, "institution_top_vendors")
        conn.execute("DELETE FROM institution_top_vendors WHERE institution_id IN (SELECT id FROM temp._itv_targets)")
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        n = conn.execute(FILL, (now, MAX_CONTRACT_VALUE, TOP_N)).rowcount
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    k = conn.execute("SELECT COUNT(DISTINCT id) FROM temp._itv_targets").fetchone()[0]
    print(f"institution_top_vendors: {n} rows for {k} canonical ids, {dropped} absorbed rows dropped, "
          f"{time.time() - t0:.1f}s -> {a.db}")


if __name__ == "__main__":
    main()
