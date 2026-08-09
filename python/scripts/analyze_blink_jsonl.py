#!/usr/bin/env python3
"""Shim — preferred path is python/log_tools/analyze_blink_jsonl.py."""

from __future__ import annotations

import runpy
from pathlib import Path

_target = (
	Path(__file__).resolve().parents[1]
	/ "log_tools"
	/ "analyze_blink_jsonl.py"
)
runpy.run_path(str(_target), run_name="__main__")
