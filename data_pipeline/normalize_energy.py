#!/usr/bin/env python3
"""Normalize a source CSV into the Periscope canonical 5-minute schema."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

CANONICAL_FIELDS = ["timestamp", "site_id", "grid_kw", "load_kw", "pv_kw", "bess_kw", "soc_pct", "irradiance_wm2", "temperature_c", "quality_flags"]


def number(row: dict[str, str], key: str, scale: float = 1.0) -> float | None:
    value = row.get(key, "").strip()
    return None if value == "" else float(value) * scale


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--mapping", type=Path, required=True, help="JSON mapping canonical names to source columns")
    parser.add_argument("--site-id", required=True)
    parser.add_argument("--timezone", default="Australia/Darwin")
    parser.add_argument("--grid-positive", choices=["import", "export"], required=True)
    parser.add_argument("--bess-positive", choices=["charge", "discharge"], required=True)
    args = parser.parse_args()
    mapping = json.loads(args.mapping.read_text(encoding="utf-8"))
    timezone = ZoneInfo(args.timezone)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    rows_written = 0
    with args.input.open(newline="", encoding="utf-8-sig") as source, args.output.open("w", newline="", encoding="utf-8") as target:
        reader = csv.DictReader(source)
        writer = csv.DictWriter(target, fieldnames=CANONICAL_FIELDS)
        writer.writeheader()
        for row in reader:
            flags: list[str] = []
            stamp = datetime.fromisoformat(row[mapping["timestamp"]]).replace(tzinfo=timezone).isoformat()
            if stamp in seen:
                flags.append("duplicate_timestamp")
            seen.add(stamp)
            grid = number(row, mapping["grid_kw"])
            bess = number(row, mapping["bess_kw"])
            soc = number(row, mapping["soc_pct"])
            if grid is not None and args.grid_positive == "export": grid *= -1
            if bess is not None and args.bess_positive == "charge": bess *= -1
            if soc is not None and not 0 <= soc <= 100: flags.append("soc_out_of_range")
            output = {
                "timestamp": stamp, "site_id": args.site_id, "grid_kw": grid,
                "load_kw": number(row, mapping["load_kw"]), "pv_kw": number(row, mapping["pv_kw"]),
                "bess_kw": bess, "soc_pct": soc,
                "irradiance_wm2": number(row, mapping.get("irradiance_wm2", "")),
                "temperature_c": number(row, mapping.get("temperature_c", "")),
                "quality_flags": "|".join(flags),
            }
            writer.writerow(output)
            rows_written += 1
    checksum = hashlib.sha256(args.output.read_bytes()).hexdigest()
    metadata = {"input": str(args.input), "output": str(args.output), "rows": rows_written, "sha256": checksum, "timezone": args.timezone, "grid_positive": args.grid_positive, "bess_positive": args.bess_positive, "mapping": mapping}
    args.output.with_suffix(args.output.suffix + ".metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
