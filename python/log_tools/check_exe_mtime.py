#!/usr/bin/env python3
"""
Compare installed blink_detector.exe mtime vs package sources.

Stale exe = Python edits not running until rebuild + app restart.

Watches domain/*.py, domain/classifier_weights.json,
infrastructure/*.py (Stage 3 vision/ROI), and application/*.py
(detector stdin / session config).

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\check_exe_mtime.py
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))

from paths import domain_package_dir, installed_blink_exe  # noqa: E402


def _mtime_utc(path: Path) -> datetime | None:
	if not path.exists():
		return None
	return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)


def _newest_py(directory: Path) -> tuple[Path | None, datetime | None]:
	if not directory.is_dir():
		return None, None
	newest = None
	newest_path = None
	for path in sorted(directory.glob("*.py")):
		m = _mtime_utc(path)
		if m is None:
			continue
		if newest is None or m > newest:
			newest = m
			newest_path = path
	for path in sorted(directory.glob("classifier_weights.json")):
		m = _mtime_utc(path)
		if m is None:
			continue
		if newest is None or m > newest:
			newest = m
			newest_path = path
	return newest_path, newest


def main() -> int:
	exe = installed_blink_exe()
	package = domain_package_dir().parent
	domain = package / "domain"
	infrastructure = package / "infrastructure"
	exe_m = _mtime_utc(exe)
	print(f"exe={exe}")
	print(f"exe_mtime_utc={exe_m.isoformat() if exe_m else 'MISSING'}")

	candidates: list[tuple[Path, datetime]] = []
	for label, directory in (
		("domain", domain),
		("infrastructure", infrastructure),
		("application", package / "application"),
	):
		path, m = _newest_py(directory)
		print(f"{label}={directory}")
		print(
			f"newest_{label}_py={path.name if path else '?'} "
			f"mtime_utc={m.isoformat() if m else 'n/a'}"
		)
		if path is not None and m is not None:
			candidates.append((path, m))

	if exe_m is None:
		print("status=MISSING_EXE rebuild required")
		return 2
	if not candidates:
		print("status=NO_SOURCE_PY")
		return 1

	newest_path, newest = max(candidates, key=lambda item: item[1])
	print(f"newest_source={newest_path} mtime_utc={newest.isoformat()}")

	if exe_m >= newest:
		print("status=OK exe newer-or-equal package sources")
		return 0

	lag_s = (newest - exe_m).total_seconds()
	print(
		f"status=STALE exe behind {newest_path.name} by {lag_s:.0f}s — "
		"rebuild + restart"
	)
	return 3


if __name__ == "__main__":
	raise SystemExit(main())
