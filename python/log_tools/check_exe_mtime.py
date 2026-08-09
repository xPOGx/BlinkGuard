#!/usr/bin/env python3
"""
Compare installed blink_detector.exe mtime vs domain package sources.

Stale exe = Python edits not running until rebuild + app restart.

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


def main() -> int:
	exe = installed_blink_exe()
	domain = domain_package_dir()
	exe_m = _mtime_utc(exe)
	print(f"exe={exe}")
	print(f"exe_mtime_utc={exe_m.isoformat() if exe_m else 'MISSING'}")

	if not domain.is_dir():
		print(f"domain=MISSING ({domain})")
		return 1

	py_files = sorted(domain.glob("*.py"))
	newest = None
	newest_path = None
	for path in py_files:
		m = _mtime_utc(path)
		if m is None:
			continue
		if newest is None or m > newest:
			newest = m
			newest_path = path

	print(f"domain={domain}")
	print(
		f"newest_domain_py={newest_path.name if newest_path else '?'} "
		f"mtime_utc={newest.isoformat() if newest else 'n/a'}"
	)

	if exe_m is None:
		print("status=MISSING_EXE rebuild required")
		return 2
	if newest is None:
		print("status=NO_DOMAIN_PY")
		return 1
	if exe_m >= newest:
		print("status=OK exe newer-or-equal domain")
		return 0

	lag_s = (newest - exe_m).total_seconds()
	print(f"status=STALE exe behind domain by {lag_s:.0f}s — rebuild + restart")
	return 3


if __name__ == "__main__":
	raise SystemExit(main())
