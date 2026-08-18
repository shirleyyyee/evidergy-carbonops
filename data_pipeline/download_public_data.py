#!/usr/bin/env python3
"""Discover and download governed public data files with checksums.

The script intentionally starts from official landing pages instead of embedding
fragile file URLs. It never implies that accepting a CLI flag grants commercial
rights; the flag records that a human reviewed the listed terms.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

USER_AGENT = "EvidergyCarbonOps-MVP/0.1 (+data-governance-contact-required)"


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.links.append(href)


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    landing_url: str
    link_pattern: str
    tier: str
    licence_url: str
    commercial_status: str
    required: bool


def request(url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,*/*"})


def discover(source: Source) -> list[str]:
    with urllib.request.urlopen(request(source.landing_url), timeout=45) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        html = response.read().decode(charset, errors="replace")
    parser = LinkParser()
    parser.feed(html)
    matcher = re.compile(source.link_pattern)
    links = {urllib.parse.urljoin(source.landing_url, href) for href in parser.links}
    return sorted(link for link in links if matcher.search(urllib.parse.urlparse(link).path))


def download(url: str, destination: Path) -> dict[str, object]:
    digest = hashlib.sha256()
    size = 0
    temporary = destination.with_suffix(destination.suffix + ".part")
    with urllib.request.urlopen(request(url), timeout=120) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
            digest.update(chunk)
            size += len(chunk)
    temporary.replace(destination)
    return {"file": str(destination), "bytes": size, "sha256": digest.hexdigest()}


def safe_filename(url: str, source_id: str, index: int) -> str:
    name = Path(urllib.parse.unquote(urllib.parse.urlparse(url).path)).name
    return name if name and "." in name else f"{source_id}-{index}.bin"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", action="append", help="Source id; repeat to select multiple. Defaults to all.")
    parser.add_argument("--output", type=Path, default=Path("data_raw"))
    parser.add_argument("--accept-licence-review", action="store_true", help="Record that a human reviewed the linked terms; this does not grant new rights.")
    parser.add_argument("--discover-only", action="store_true")
    args = parser.parse_args()
    if not args.accept_licence_review:
        parser.error("Read each source licence URL, then pass --accept-licence-review. This records review only.")

    config_path = Path(__file__).with_name("sources.json")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    sources = [Source(**item) for item in config["sources"]]
    selected = set(args.source or [item.id for item in sources])
    unknown = selected - {item.id for item in sources}
    if unknown:
        parser.error(f"Unknown source ids: {', '.join(sorted(unknown))}")

    args.output.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "licence_review_recorded": True,
        "note": "Review flag is not a commercial licence or redistribution permission.",
        "sources": [],
    }
    failures = 0
    for source in [item for item in sources if item.id in selected]:
        entry: dict[str, object] = {"id": source.id, "landing_url": source.landing_url, "licence_url": source.licence_url, "commercial_status": source.commercial_status, "downloads": []}
        try:
            links = discover(source)
            entry["discovered_urls"] = links
            if source.required and not links:
                raise RuntimeError("No matching files discovered; inspect the landing page or update link_pattern.")
            if not args.discover_only:
                source_dir = args.output / source.id
                source_dir.mkdir(exist_ok=True)
                for index, url in enumerate(links, 1):
                    result = download(url, source_dir / safe_filename(url, source.id, index))
                    result["url"] = url
                    entry["downloads"].append(result)  # type: ignore[union-attr]
        except Exception as exc:  # network failures are recorded rather than hidden
            entry["error"] = str(exc)
            failures += int(source.required)
        manifest["sources"].append(entry)  # type: ignore[union-attr]
    manifest_path = args.output / "download_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {manifest_path}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
