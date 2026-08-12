#!/usr/bin/env python3
"""Stage-0 trace replay + metrics unit tests (no camera)."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

_PYTHON = Path(__file__).resolve().parents[2]
_TOOLS = _PYTHON / "log_tools"
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))
if str(_PYTHON) not in sys.path:
	sys.path.insert(0, str(_PYTHON))

from metrics import evaluate_trace, match_events  # noqa: E402
from replay import replay_trace  # noqa: E402
from trace_io import label_path_for_trace, load_trace  # noqa: E402

# Same shape as test_blink_detection._CREDIT_STEPS (open → close → reopen).
_CREDIT_STEPS = (
	(0.1, 0.16),
	(0.1, 0.10),
	(0.1, 0.08),
	(0.1, 0.07),
	(0.1, 0.22),
	(0.1, 0.28),
	(0.1, 0.28),
)


def _write_synthetic_blink_trace(path: Path) -> float:
	"""Write a short frontal blink EAR trace; return trough time."""
	t = 10.0
	frames = []
	for _ in range(15):
		ear = 0.28
		frames.append(
			{
				"t": t,
				"left_ear": ear,
				"right_ear": ear,
				"avg_ear": ear,
				"yaw": 0.0,
				"pitch": 0.0,
				"pose_valid": True,
				"face_status": "ok",
				"face_area": 20000,
				"interocular": 40.0,
				"luma": 80.0,
			}
		)
		t += 0.1

	blink_t = None
	for dt, ear in _CREDIT_STEPS:
		t += dt
		if ear <= 0.08 and blink_t is None:
			blink_t = t
		frames.append(
			{
				"t": t,
				"left_ear": ear,
				"right_ear": ear,
				"avg_ear": ear,
				"yaw": 0.0,
				"pitch": 0.0,
				"pose_valid": True,
				"face_status": "ok",
				"face_area": 20000,
				"interocular": 40.0,
				"luma": 80.0,
			}
		)

	header = {
		"type": "header",
		"schema": "blinkguard.ear_trace.v1",
		"target_fps": 20,
		"pose_strictness": "normal",
		"processing_resolution": [480, 360],
		"face_detect_interval": 1,
		"ear_calibration": None,
	}
	with path.open("w", encoding="utf-8") as handle:
		handle.write(json.dumps(header) + "\n")
		for frame in frames:
			handle.write(json.dumps(frame) + "\n")
	return float(blink_t or t)


class TraceReplayTests(unittest.TestCase):
	def test_match_events_window(self):
		matched = match_events([1.0, 2.0], [1.05, 3.0], match_window_s=0.25)
		self.assertEqual(matched["tp"], 1)
		self.assertEqual(matched["fp"], 1)
		self.assertEqual(matched["fn"], 1)

	def test_replay_credits_synthetic_blink(self):
		with tempfile.TemporaryDirectory() as tmp:
			trace = Path(tmp) / "synthetic.ndjson"
			blink_t = _write_synthetic_blink_trace(trace)
			result = replay_trace(trace)
			self.assertGreaterEqual(
				result["credit_count"],
				1,
				msg=f"phases={result['phase_counts']}",
			)
			closest = min(abs(c["t"] - blink_t) for c in result["credits"])
			self.assertLess(closest, 0.6)

			labels = {
				"trace": trace.name,
				"scenario": "synthetic",
				"blinks": [{"t": blink_t}],
				"notes": "unit",
			}
			labels_path = label_path_for_trace(trace)
			labels_path.write_text(json.dumps(labels), encoding="utf-8")
			metrics = evaluate_trace(trace, labels_path, match_window_s=0.5)
			self.assertGreaterEqual(metrics["tp"], 1)
			self.assertEqual(metrics["fn"], 0)
			self.assertGreater(metrics["f1"], 0.5)

	def test_load_trace_header(self):
		with tempfile.TemporaryDirectory() as tmp:
			trace = Path(tmp) / "synthetic.ndjson"
			_write_synthetic_blink_trace(trace)
			header, frames = load_trace(trace)
			self.assertIsNotNone(header)
			self.assertEqual(header.get("schema"), "blinkguard.ear_trace.v1")
			self.assertGreater(len(frames), 10)

	def test_human_corpus_f1_floor(self):
		"""Regression floor vs Stage-0 video-verified labels (skip if missing)."""
		sessions = _PYTHON / "fixtures" / "sessions"
		if not sessions.is_dir():
			self.skipTest("fixtures/sessions missing")

		rows = []
		frontal = None
		for path in sorted(sessions.glob("*.ndjson")):
			lp = label_path_for_trace(path)
			if not lp.exists():
				continue
			lab = json.loads(lp.read_text(encoding="utf-8"))
			if lab.get("source") != "human_video":
				continue
			result = evaluate_trace(path, lp, match_window_s=0.45)
			rows.append(result)
			if path.stem == "frontal_calm":
				frontal = result

		if len(rows) < 4:
			self.skipTest(f"need ≥4 human_video sessions, found {len(rows)}")

		tp = sum(r["tp"] for r in rows)
		fp = sum(r["fp"] for r in rows)
		fn = sum(r["fn"] for r in rows)
		precision = tp / (tp + fp) if (tp + fp) else 0.0
		recall = tp / (tp + fn) if (tp + fn) else 0.0
		f1 = (
			(2 * precision * recall / (precision + recall))
			if (precision + recall)
			else 0.0
		)
		self.assertGreaterEqual(
			f1,
			0.90,
			msg=f"overall F1={f1:.3f} P={precision:.3f} R={recall:.3f} "
			f"tp={tp} fp={fp} fn={fn} n={len(rows)}",
		)
		if frontal is not None:
			self.assertGreaterEqual(
				frontal["f1"],
				0.88,
				msg=f"frontal_calm F1={frontal['f1']:.3f}",
			)


if __name__ == "__main__":
	unittest.main()
