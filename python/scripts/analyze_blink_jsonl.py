#!/usr/bin/env python3
"""
Phase 0 blinkDebug JSONL analyzer for BlinkGuard.

Usage:
  python scripts/analyze_blink_jsonl.py
  python scripts/analyze_blink_jsonl.py --minutes 20
  python scripts/analyze_blink_jsonl.py --since 2026-08-07T19:00:00+00:00
  python scripts/analyze_blink_jsonl.py --path %APPDATA%/BlinkGuard/logs/blink-detector.jsonl

Checklist before trusting numbers:
  1. Compare mtime(electron/resources/blink_detector.exe) vs domain/*.py
  2. Restart app / stop-start tracking after rebuild
  3. Pass --since = restart time (UTC) so pre-rebuild rows are excluded

Manual scenarios (run while logging):
  - frontal calm intentional blinks
  - 60s no blink (FP rate)
  - look down at screen bottom
  - side monitor glance
"""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path


def default_log_path() -> Path:
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


def parse_ts(value: str) -> datetime:
	return datetime.fromisoformat(value.replace("Z", "+00:00"))


def load_rows(paths: list[Path], cutoff: datetime | None):
	rows = []
	for path in paths:
		if not path.exists():
			continue
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


def pct(vals: list[float], p: float) -> float:
	if not vals:
		return float("nan")
	vals = sorted(vals)
	index = int(round((len(vals) - 1) * p))
	return vals[index]


def stats(label: str, items: list[dict], key: str) -> None:
	vals = [float(item[key]) for item in items if item.get(key) is not None]
	if not vals:
		print(f"  {label} {key}: n=0")
		return
	print(
		f"  {label} {key}: n={len(vals)} "
		f"p25={pct(vals, 0.25):.4f} p50={pct(vals, 0.5):.4f} "
		f"p75={pct(vals, 0.75):.4f} p90={pct(vals, 0.9):.4f}"
	)


def cooldown_remaining_buckets(label: str, items: list[dict]) -> None:
	"""Bounce (high rem) vs late-cooldown (low rem) for cooldown phases."""
	vals = [
		float(item["cooldown_remaining"])
		for item in items
		if item.get("cooldown_remaining") is not None
	]
	if not vals:
		print(f"  {label} cooldown_remaining buckets: n=0")
		return
	edges = (0.15, 0.30, 0.40, 0.55)
	counts = {
		"lt_0.15": 0,
		"0.15_0.30": 0,
		"0.30_0.40": 0,
		"0.40_0.55": 0,
		"ge_0.55": 0,
	}
	for rem in vals:
		if rem < edges[0]:
			counts["lt_0.15"] += 1
		elif rem < edges[1]:
			counts["0.15_0.30"] += 1
		elif rem < edges[2]:
			counts["0.30_0.40"] += 1
		elif rem < edges[3]:
			counts["0.40_0.55"] += 1
		else:
			counts["ge_0.55"] += 1
	parts = " ".join(f"{name}={n}" for name, n in counts.items())
	print(f"  {label} cooldown_remaining buckets: n={len(vals)} {parts}")
	stats(label, items, "cooldown_remaining")


def main() -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--path", type=Path, default=None)
	parser.add_argument("--minutes", type=float, default=None)
	parser.add_argument("--since", type=str, default=None)
	parser.add_argument(
		"--include-rotated",
		action="store_true",
		help="Also read blink-detector.jsonl.1 next to the active file",
	)
	args = parser.parse_args()

	path = args.path or default_log_path()
	paths = [path]
	if args.include_rotated:
		rotated = Path(str(path) + ".1")
		paths.append(rotated)

	cutoff = None
	if args.since:
		cutoff = parse_ts(args.since)
	elif args.minutes is not None:
		cutoff = datetime.now(timezone.utc) - timedelta(minutes=args.minutes)

	rows = load_rows(paths, cutoff)
	print(f"log={path}")
	print(f"events={len(rows)}")
	if not rows:
		return 0

	print(f"from={rows[0][0].isoformat()} to={rows[-1][0].isoformat()}")
	phases = Counter()
	credited = []
	rejected = []
	for _, bd in rows:
		phase = bd.get("phase") or ("complete" if bd.get("credited") else "?")
		phases[phase] += 1
		if bd.get("credited") is True:
			credited.append(bd)
		else:
			rejected.append(bd)

	print("phases:", dict(phases.most_common()))
	total = len(rows)
	print(f"credit_rate={len(credited) / total:.3f}" if total else "credit_rate=n/a")

	short = [b for b in credited if float(b.get("duration") or 99) < 0.09]
	look_down = [b for b in credited if b.get("look_down")]
	print(f"credited_short={len(short)} credited_look_down={len(look_down)}")

	print("--- credited ---")
	stats("cred", credited, "duration")
	stats("cred", credited, "peak_velocity")
	stats("cred", credited, "absolute_drop")
	stats("cred", credited, "drop")
	stats("cred", credited, "yaw")

	for phase in (
		"reject_velocity",
		"reject_threshold",
		"reject_cooldown",
		"skip_cooldown",
		"reject_opening",
		"reject_bilateral",
	):
		bucket = [b for b in rejected if b.get("phase") == phase]
		if not bucket:
			continue
		print(f"--- {phase} n={len(bucket)} ---")
		stats(phase, bucket, "duration")
		stats(phase, bucket, "peak_velocity")
		stats(phase, bucket, "absolute_drop")
		stats(phase, bucket, "drop")
		if phase in ("reject_cooldown", "skip_cooldown"):
			cooldown_remaining_buckets(phase, bucket)

	# Scenario hint: credits closer than 0.5s often mean FP storms
	times = [t for t, bd in rows if bd.get("credited")]
	gaps = [
		(times[i] - times[i - 1]).total_seconds()
		for i in range(1, len(times))
	]
	fast = sum(1 for g in gaps if g < 0.5)
	if gaps:
		print(
			f"credit_gaps: n={len(gaps)} lt_0.5s={fast} "
			f"median={sorted(gaps)[len(gaps) // 2]:.3f}s"
		)

	print(
		"\nScenarios: frontal blinks | 60s no-blink FP | look-down | "
		"side-monitor | intentional only"
	)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
