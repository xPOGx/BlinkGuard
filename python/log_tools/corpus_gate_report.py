#!/usr/bin/env python3
"""
Aggregate reject / waive frequencies across the Stage-0 corpus.

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\corpus_gate_report.py
  venv\\Scripts\\python.exe log_tools\\corpus_gate_report.py --dir fixtures\\sessions
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
_PYTHON = _TOOLS.parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))
if str(_PYTHON) not in sys.path:
	sys.path.insert(0, str(_PYTHON))

from paths import fixtures_sessions_dir  # noqa: E402
from replay import replay_trace  # noqa: E402
from trace_io import label_path_for_trace, load_labels  # noqa: E402

# Waive / reject names the FSM can emit (for "never fired" reporting).
KNOWN_WAIVES = (
	"synthetic_peak",
	"short_strong_drop",
	"ld_one_frame_peak",
	"ld_deep_trough",
	"ld_strong_peak",
	"frontal_opening_peak",
	"ld_short_duration",
	"motion_peak",
	"stronger_eye",
	"ocec_opening",
	"ocec_threshold",
	"ocec_look_down",
	"ocec_velocity",
	"ocec_aperture",
	"ocec_clf",
)
KNOWN_REJECTS = (
	"reject_duration",
	"reject_recovery",
	"reject_velocity",
	"reject_opening",
	"reject_threshold",
	"reject_bilateral",
	"reject_motion",
	"reject_cooldown",
	"reject_yaw",
	"reject_aperture",
	"reject_ocec",
	"reject_classifier",
)


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		description="Corpus reject/waive frequency report",
	)
	parser.add_argument(
		"--dir",
		type=Path,
		default=None,
		help="Sessions directory (default: fixtures/sessions)",
	)
	parser.add_argument(
		"--human-only",
		action="store_true",
		default=True,
		help="Only traces with source=human_video labels (default)",
	)
	parser.add_argument(
		"--all-labeled",
		action="store_true",
		help="Include any labeled trace (not only human_video)",
	)
	args = parser.parse_args(argv)
	root = args.dir or fixtures_sessions_dir()
	if not root.is_dir():
		print(f"Sessions dir not found: {root}", file=sys.stderr)
		return 1

	human_only = not args.all_labeled
	phase_total: Counter[str] = Counter()
	waive_total: Counter[str] = Counter()
	reject_total: Counter[str] = Counter()
	n = 0

	for path in sorted(root.glob("*.ndjson")):
		lp = label_path_for_trace(path)
		if not lp.exists():
			continue
		lab = load_labels(lp)
		if human_only and lab.get("source") != "human_video":
			continue
		result = replay_trace(path)
		n += 1
		phase_total.update(result.get("phase_counts") or {})
		waive_total.update(result.get("waive_counts") or {})
		reject_total.update(result.get("reject_counts") or {})
		print(
			f"{path.stem}: credits={result['credit_count']} "
			f"rejects={dict(result.get('reject_counts') or {})} "
			f"waives={dict(result.get('waive_counts') or {})}"
		)

	print(f"\n=== corpus aggregate (n={n}) ===")
	print("phases:")
	for phase, count in sorted(phase_total.items()):
		print(f"  {phase}: {count}")
	print("rejects:")
	for phase, count in sorted(reject_total.items()):
		print(f"  {phase}: {count}")
	print("waives:")
	for name, count in sorted(waive_total.items()):
		print(f"  {name}: {count}")

	never_reject = [r for r in KNOWN_REJECTS if reject_total.get(r, 0) == 0]
	never_waive = [w for w in KNOWN_WAIVES if waive_total.get(w, 0) == 0]
	print("\nnever fired on this corpus (do not delete without code proof):")
	print(f"  rejects: {never_reject or '(none)'}")
	print(f"  waives: {never_waive or '(none)'}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
