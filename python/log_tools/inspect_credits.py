#!/usr/bin/env python3
"""
Drill into credited blinks / FP-storm signals from blink-detector.jsonl.

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\inspect_credits.py
  venv\\Scripts\\python.exe log_tools\\inspect_credits.py --minutes 10
  venv\\Scripts\\python.exe log_tools\\inspect_credits.py --since 2026-08-09T14:16:00+00:00
  venv\\Scripts\\python.exe log_tools\\inspect_credits.py --tail 15
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))

from paths import default_blink_jsonl  # noqa: E402


def parse_ts(value: str) -> datetime:
	return datetime.fromisoformat(value.replace("Z", "+00:00"))


def load_blink_debug(path: Path, cutoff: datetime | None):
	rows = []
	if not path.exists():
		return rows
	with path.open(encoding="utf-8", errors="replace") as handle:
		for line in handle:
			line = line.strip()
			if not line:
				continue
			try:
				obj = json.loads(line)
			except json.JSONDecodeError:
				continue
			ts = obj.get("ts")
			bd = obj.get("blinkDebug")
			if not ts or not isinstance(bd, dict):
				continue
			try:
				t = parse_ts(ts)
			except ValueError:
				continue
			if cutoff is not None and t < cutoff:
				continue
			rows.append((t, bd))
	rows.sort(key=lambda item: item[0])
	return rows


def main() -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--path", type=Path, default=None)
	parser.add_argument("--minutes", type=float, default=None)
	parser.add_argument("--since", type=str, default=None)
	parser.add_argument(
		"--tail",
		type=int,
		default=12,
		help="How many recent completes to print (default 12)",
	)
	args = parser.parse_args()

	path = args.path or default_blink_jsonl()
	cutoff = None
	if args.since:
		cutoff = parse_ts(args.since)
	elif args.minutes is not None:
		cutoff = datetime.now(timezone.utc) - timedelta(minutes=args.minutes)

	rows = load_blink_debug(path, cutoff)
	print(f"log={path}")
	print(f"blinkDebug_events={len(rows)}")
	if not rows:
		return 0

	phases = Counter(
		(bd.get("phase") or ("complete" if bd.get("credited") else "?"))
		for _, bd in rows
	)
	print(f"phases={dict(phases.most_common())}")

	completes = [
		(t, bd)
		for t, bd in rows
		if bd.get("credited") or bd.get("phase") == "complete"
	]
	print(f"completes={len(completes)}")
	if not completes:
		return 0

	open_vel0 = sum(
		1
		for _, c in completes
		if (c.get("peak_opening_velocity") or 0) <= 1e-6
	)
	synth_boost = sum(
		1
		for _, c in completes
		if (c.get("peak_velocity_effective") or 0)
		> (c.get("peak_velocity_raw") or 0) + 0.2
	)
	waive_like = sum(
		1
		for _, c in completes
		if (c.get("peak_opening_velocity") or 0) <= 1e-6
		and (c.get("peak_velocity_effective") or 0) >= 0.95
	)
	short = sum(
		1 for _, c in completes if float(c.get("duration") or 99) < 0.09
	)
	look_down = sum(1 for _, c in completes if c.get("look_down"))
	print(
		f"openVel0={open_vel0} synth_boost={synth_boost} "
		f"waive_like={waive_like} short={short} look_down={look_down}"
	)

	ratios = []
	for _, c in completes:
		live = c.get("live_open_ear")
		ear = c.get("ear")
		if live and ear and float(live) > 0:
			ratios.append(float(ear) / float(live))
	if ratios:
		ratios_sorted = sorted(ratios)
		mid = ratios_sorted[len(ratios_sorted) // 2]
		print(
			f"ear/live_open: n={len(ratios)} "
			f"p50={mid:.3f} min={ratios_sorted[0]:.3f} "
			f"max={ratios_sorted[-1]:.3f}"
		)

	times = [t for t, _ in completes]
	gaps = [
		(times[i] - times[i - 1]).total_seconds()
		for i in range(1, len(times))
	]
	if gaps:
		fast = sum(1 for g in gaps if g < 0.5)
		print(
			f"credit_gaps: n={len(gaps)} lt_0.5s={fast} "
			f"median={sorted(gaps)[len(gaps) // 2]:.3f}s "
			f"min={min(gaps):.3f}s"
		)

	print(f"--- last {min(args.tail, len(completes))} completes ---")
	for t, c in completes[-args.tail :]:
		live = c.get("live_open_ear")
		ear = c.get("ear")
		ratio = (
			f"{float(ear) / float(live):.3f}"
			if live and ear and float(live) > 0
			else "?"
		)
		print(
			f"{t.isoformat()} ear={float(ear or 0):.3f} "
			f"live={float(live or 0):.3f} ratio={ratio} "
			f"drop={float(c.get('drop') or 0):.2f} "
			f"dur={float(c.get('duration') or 0):.3f} "
			f"closed={c.get('closed_frames')} "
			f"rawV={c.get('peak_velocity_raw')} "
			f"effV={c.get('peak_velocity_effective')} "
			f"openV={c.get('peak_opening_velocity')} "
			f"lookDown={c.get('look_down')} "
			f"depressed={c.get('ear_depressed')}"
		)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
