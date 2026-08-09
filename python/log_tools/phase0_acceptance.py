#!/usr/bin/env python3
"""
Phase 0 acceptance pass/fail for a post-rebuild JSONL window.

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\phase0_acceptance.py --since 2026-08-09T17:58:27+00:00
  venv\\Scripts\\python.exe log_tools\\phase0_acceptance.py --minutes 15

Hard loop: check_exe_mtime → restart → scenarios → this script → ONE gate → rebuild.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))

from analyze_blink_jsonl import (  # noqa: E402
	_completion_attempts,
	_is_look_down,
	default_log_path,
	load_camera_states,
	load_rows,
	parse_ts,
	pct,
)


def _gap_stats(rows: list) -> tuple[int, int, float | None]:
	times = [t for t, bd in rows if bd.get("credited")]
	gaps = [
		(times[i] - times[i - 1]).total_seconds()
		for i in range(1, len(times))
	]
	if not gaps:
		return 0, 0, None
	fast = sum(1 for g in gaps if g < 0.5)
	median = sorted(gaps)[len(gaps) // 2]
	return len(gaps), fast, median


def main() -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--path", type=Path, default=None)
	parser.add_argument("--minutes", type=float, default=None)
	parser.add_argument("--since", type=str, default=None)
	parser.add_argument(
		"--include-rotated",
		action="store_true",
		help="Also read blink-detector.jsonl.1",
	)
	args = parser.parse_args()

	path = args.path or default_log_path()
	paths = [path]
	if args.include_rotated:
		paths.append(Path(str(path) + ".1"))

	cutoff = None
	if args.since:
		cutoff = parse_ts(args.since)
	elif args.minutes is not None:
		cutoff = datetime.now(timezone.utc) - timedelta(minutes=args.minutes)

	rows = load_rows(paths, cutoff)
	states = load_camera_states(paths, cutoff)
	print(f"log={path}")
	print(f"events={len(rows)}")
	if not rows:
		print("FAIL: no blinkDebug rows in window (restart + --since?)")
		return 1

	print(f"from={rows[0][0].isoformat()} to={rows[-1][0].isoformat()}")

	phases = Counter()
	for _, bd in rows:
		phase = bd.get("phase") or ("complete" if bd.get("credited") else "?")
		phases[phase] += 1

	starts = phases.get("start", 0)
	completes = phases.get("complete", 0)
	rejects = sum(c for p, c in phases.items() if str(p).startswith("reject_"))
	start_to_complete = (completes / starts) if starts else None

	attempts = _completion_attempts(rows)
	frontal = [b for b in attempts if not _is_look_down(b)]
	look_down = [b for b in attempts if _is_look_down(b)]

	def credit_rate(items: list[dict]) -> float | None:
		if not items:
			return None
		return sum(1 for b in items if b.get("credited") is True) / len(items)

	fr_rate = credit_rate(frontal)
	ld_rate = credit_rate(look_down)

	rd = [b for _, b in rows if b.get("phase") == "reject_duration"]
	rd_timeout = sum(1 for b in rd if float(b.get("duration") or 0) > 0.55)
	rr = phases.get("reject_recovery", 0)
	ro = [b for _, b in rows if b.get("phase") == "reject_opening"]
	ro_shortish = sum(1 for b in ro if float(b.get("duration") or 0) < 0.12)
	face_lost = phases.get("skip_face_lost", 0)
	face_quality = phases.get("skip_face_quality", 0)

	gap_n, gap_fast, gap_med = _gap_stats(rows)

	health = [s for _, s in states if s.get("kind") == "camera_health"]
	loop_fps = [
		float(s["loop_fps"])
		for s in health
		if s.get("loop_fps") is not None
	]
	gate_fps = [
		float(s["gate_fps"])
		for s in health
		if s.get("gate_fps") is not None
	]
	lumas = [
		float(s["mean_luma"])
		for s in health
		if s.get("mean_luma") is not None
	]

	print("--- funnel ---")
	stc = f"{start_to_complete:.3f}" if start_to_complete is not None else "n/a"
	print(f"start={starts} complete={completes} reject={rejects} start_to_complete={stc}")
	fr_s = f"{fr_rate:.3f}" if fr_rate is not None else "n/a"
	ld_s = f"{ld_rate:.3f}" if ld_rate is not None else "n/a"
	print(f"frontal: n={len(frontal)} credit_rate={fr_s}")
	print(f"look_down: n={len(look_down)} credit_rate={ld_s}")
	print(
		f"reject_duration={len(rd)} (timeout>0.55={rd_timeout}) "
		f"reject_recovery={rr} "
		f"reject_opening={len(ro)} (dur<0.12={ro_shortish})"
	)
	print(f"skip_face_lost={face_lost} skip_face_quality={face_quality}")
	if gap_med is not None:
		print(f"credit_gaps: n={gap_n} lt_0.5s={gap_fast} median={gap_med:.3f}s")
	else:
		print("credit_gaps: n=0")
	if loop_fps or gate_fps or lumas:
		print("--- camera_health ---")
		if loop_fps:
			print(
				f"loop_fps: p50={pct(loop_fps, 0.5):.1f} "
				f"p90={pct(loop_fps, 0.9):.1f} last={loop_fps[-1]:.1f}"
			)
		if gate_fps:
			print(
				f"gate_fps: p50={pct(gate_fps, 0.5):.1f} "
				f"p90={pct(gate_fps, 0.9):.1f} last={gate_fps[-1]:.1f}"
			)
		if lumas:
			print(
				f"mean_luma: p50={pct(lumas, 0.5):.1f} "
				f"p90={pct(lumas, 0.9):.1f} last={lumas[-1]:.1f}"
			)

	checks: list[tuple[str, bool, str]] = []
	checks.append(
		(
			"credit_gaps_lt_0.5s",
			gap_fast <= 1,
			f"lt_0.5s={gap_fast} (want <=1)",
		)
	)
	if start_to_complete is not None and starts >= 20:
		checks.append(
			(
				"start_to_complete",
				start_to_complete >= 0.45,
				f"{start_to_complete:.3f} (want >=0.45 when start>=20)",
			)
		)
	if look_down and len(look_down) >= 15:
		ld_ro = sum(1 for b in look_down if b.get("phase") == "reject_opening")
		ld_ro_share = ld_ro / len(look_down)
		checks.append(
			(
				"look_down_reject_opening_share",
				ld_ro_share <= 0.25,
				f"{ld_ro_share:.3f} (want <=0.25)",
			)
		)
		ld_rd_to = sum(
			1
			for b in look_down
			if b.get("phase") == "reject_duration"
			and float(b.get("duration") or 0) > 0.55
		)
		checks.append(
			(
				"look_down_timeout_share",
				(ld_rd_to / len(look_down)) <= 0.20,
				f"{ld_rd_to / len(look_down):.3f} (want <=0.20)",
			)
		)
	checks.append(
		(
			"skip_face_lost",
			face_lost <= max(5, starts // 20),
			f"{face_lost} (want low vs start={starts})",
		)
	)

	print("--- acceptance ---")
	failed = 0
	for name, ok, detail in checks:
		status = "PASS" if ok else "FAIL"
		if not ok:
			failed += 1
		print(f"{status} {name}: {detail}")

	print(
		"\nScenarios: frontal | 60s no-blink | chat look-down | "
		"side-monitor | walk-away | talk no-blink"
	)
	print("Rule: ONE gate constant per rebuild; ban multi-knob PRs.")
	return 1 if failed else 0


if __name__ == "__main__":
	raise SystemExit(main())
