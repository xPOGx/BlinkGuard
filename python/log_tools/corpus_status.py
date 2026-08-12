#!/usr/bin/env python3
"""
Print the Stage-0 corpus checklist and verify which sessions are ready.

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\corpus_status.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))

from paths import fixtures_sessions_dir  # noqa: E402
from trace_io import label_path_for_trace  # noqa: E402

SCENARIOS = (
	("frontal_calm", "Face camera; ~20 intentional blinks, calm"),
	("no_blink_60s", "60s looking at camera without blinking"),
	("chat_look_down", "Eyes on screen bottom / chat; natural blinks"),
	("side_monitor_left", "Glance toward left monitor; blink while turned"),
	("side_monitor_right", "Glance toward right monitor; blink while turned"),
	("walk_away_return", "Leave frame 5-10s, return, blink"),
	("talk_no_blink", "Talk / jaw motion without intentional blinks"),
	("dark_room", "(optional) Dim light, frontal blinks"),
)


def main() -> int:
	sessions = fixtures_sessions_dir()
	sessions.mkdir(parents=True, exist_ok=True)
	print(f"sessions dir: {sessions}")
	print()
	ready = 0
	for stem, desc in SCENARIOS:
		trace = sessions / f"{stem}.ndjson"
		labels = label_path_for_trace(trace)
		if trace.exists() and labels.exists():
			status = "READY"
			ready += 1
		elif trace.exists():
			status = "trace only — need label"
		else:
			status = "missing"
		print(f"  [{status:24}] {stem}")
		print(f"    {desc}")
	print()
	print(f"{ready}/{len(SCENARIOS)} labeled (optional dark_room included in count)")
	if ready == 0:
		print()
		print("Your part:")
		print("  1. npm run dev  (or open BlinkGuard)")
		print("  2. Start tracking + camera")
		print("  3. Debug > EAR trace recording > Start")
		print("  4. Do one scenario > Stop > save as fixtures/sessions/<stem>.ndjson")
		print("  5. Tell me - I will run label assist + metrics")
		print()
		print("Or save directly into fixtures/sessions/ with the stem filenames above.")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
