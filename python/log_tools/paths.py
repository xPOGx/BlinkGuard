#!/usr/bin/env python3
"""Shared paths for BlinkGuard blink JSONL / binary freshness tools."""

from __future__ import annotations

import os
import re
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


_TRACE_SUFFIXES = {".ndjson", ".jsonl"}
# Derived siblings of a baked session.ndjson — never mix into the Stage-6 EAR floor.
_DERIVED_STEM = re.compile(
	r"\.(ocec|ap|repro|pnp|joined|u\d+)$",
	re.IGNORECASE,
)


def is_primary_trace(path: Path) -> bool:
	"""True for unsuffixed corpus traces (`session.ndjson`), not `.joined` / `.ocec` / …"""
	if path.name.startswith(("_", ".")):
		return False
	if path.suffix.lower() not in _TRACE_SUFFIXES:
		return False
	return _DERIVED_STEM.search(path.stem) is None


def is_joined_trace(path: Path) -> bool:
	"""True for join-at-test-time siblings (`session.joined.ndjson`)."""
	if path.suffix.lower() not in _TRACE_SUFFIXES:
		return False
	return path.stem.endswith(".joined")


def iter_session_traces(directory: Path, *, kind: str = "primary") -> list[Path]:
	"""List traces in a sessions directory.

	kind:
	  - ``primary``: baked EAR floor (skip derived suffixes)
	  - ``joined``: only ``*.joined.ndjson``
	  - ``all``: every ndjson/jsonl except underscore scratch files
	"""
	found: list[Path] = []
	if not directory.is_dir():
		return found
	for path in sorted(directory.iterdir()):
		if not path.is_file():
			continue
		if path.suffix.lower() not in _TRACE_SUFFIXES:
			continue
		if path.name.startswith(("_", ".")):
			continue
		if kind == "primary":
			if is_primary_trace(path):
				found.append(path)
		elif kind == "joined":
			if is_joined_trace(path):
				found.append(path)
		elif kind == "all":
			found.append(path)
		else:
			raise ValueError(f"unknown kind={kind!r}")
	return found
