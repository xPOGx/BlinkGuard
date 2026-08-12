#!/usr/bin/env python3
"""Shared paths for BlinkGuard blink JSONL / binary freshness tools."""

from __future__ import annotations

import os
from pathlib import Path

_LOG_TOOLS_DIR = Path(__file__).resolve().parent
_PYTHON_DIR = _LOG_TOOLS_DIR.parent
_REPO_ROOT = _PYTHON_DIR.parent


def repo_root() -> Path:
	return _REPO_ROOT


def default_blink_jsonl() -> Path:
	"""Active blink-detector.jsonl under userData (Windows / macOS / Linux)."""
	appdata = os.environ.get("APPDATA")
	if appdata:
		return Path(appdata) / "BlinkGuard" / "logs" / "blink-detector.jsonl"
	home = Path.home()
	mac = (
		home
		/ "Library"
		/ "Application Support"
		/ "BlinkGuard"
		/ "logs"
		/ "blink-detector.jsonl"
	)
	if mac.exists():
		return mac
	return home / ".config" / "BlinkGuard" / "logs" / "blink-detector.jsonl"


def installed_blink_exe() -> Path:
	"""Dev-installed sidecar binary Electron spawns."""
	return _REPO_ROOT / "electron" / "resources" / "blink_detector.exe"


def domain_package_dir() -> Path:
	return (
		_PYTHON_DIR
		/ "blink_detector_package"
		/ "domain"
	)


def fixtures_dir() -> Path:
	"""Committed Stage-0 corpus root (`python/fixtures/`)."""
	return _PYTHON_DIR / "fixtures"


def fixtures_sessions_dir() -> Path:
	"""Labeled EAR-trace sessions (`python/fixtures/sessions/`)."""
	return fixtures_dir() / "sessions"
