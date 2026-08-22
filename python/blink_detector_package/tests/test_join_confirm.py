"""Join-at-test-time helper tests — no camera."""

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

from join_confirm import (  # noqa: E402
	frames_have_confirm,
	join_frames,
	write_joined_trace,
)
from metrics import evaluate_dir  # noqa: E402
from trace_io import label_path_for_trace  # noqa: E402


def _write_ndjson(path: Path, frames: list[dict], header=None) -> None:
	with path.open("w", encoding="utf-8") as handle:
		if header:
			handle.write(json.dumps(header) + "\n")
		for frame in frames:
			handle.write(json.dumps(frame) + "\n")


class JoinConfirmTests(unittest.TestCase):
	def test_join_copies_confirm_keeps_baked_ear(self):
		baked = [
			{
				"t": 1.0,
				"video_index": 0,
				"avg_ear": 0.30,
				"yaw": 0.1,
				"pitch": 0.0,
			},
			{
				"t": 1.1,
				"video_index": 1,
				"avg_ear": 0.28,
				"yaw": 0.1,
				"pitch": 0.0,
			},
		]
		ocec = [
			{
				"t": 9.0,
				"video_index": 0,
				"avg_ear": 0.99,
				"yaw": 9.9,
				"pitch": 9.9,
				"left_ocec": 0.8,
				"right_ocec": 0.7,
			},
			{
				"t": 9.1,
				"video_index": 1,
				"avg_ear": 0.11,
				"left_ocec": 0.2,
				"right_ocec": 0.1,
			},
		]
		joined = join_frames(baked, [ocec])
		self.assertEqual(joined[0]["avg_ear"], 0.30)
		self.assertEqual(joined[0]["yaw"], 0.1)
		self.assertEqual(joined[0]["left_ocec"], 0.8)
		self.assertEqual(joined[1]["left_ocec"], 0.2)
		self.assertTrue(frames_have_confirm(joined))

	def test_missing_join_key_stays_null(self):
		baked = [{"t": 1.0, "video_index": 5, "avg_ear": 0.3}]
		ocec = [{"t": 1.0, "video_index": 0, "left_ocec": 0.4}]
		joined = join_frames(baked, [ocec])
		self.assertIsNone(joined[0]["left_ocec"])

	def test_write_joined_does_not_overwrite_baked(self):
		with tempfile.TemporaryDirectory() as tmp:
			root = Path(tmp)
			baked = root / "session.ndjson"
			ocec = root / "session.ocec.ndjson"
			_write_ndjson(
				baked,
				[{"t": 1.0, "video_index": 0, "avg_ear": 0.31}],
			)
			_write_ndjson(
				ocec,
				[{"t": 1.0, "video_index": 0, "left_ocec": 0.55}],
			)
			out = write_joined_trace(baked, companions=[ocec])
			self.assertIsNotNone(out)
			self.assertEqual(out.name, "session.joined.ndjson")
			raw = baked.read_text(encoding="utf-8")
			self.assertNotIn("left_ocec", raw)
			self.assertEqual(
				label_path_for_trace(out).name,
				"session.labels.json",
			)

	def test_joined_eval_skips_without_confirm(self):
		with tempfile.TemporaryDirectory() as tmp:
			root = Path(tmp)
			joined = root / "session.joined.ndjson"
			labels = root / "session.labels.json"
			_write_ndjson(joined, [{"t": 1.0, "avg_ear": 0.3}])
			labels.write_text(
				json.dumps({"scenario": "session", "blinks": []}),
				encoding="utf-8",
			)
			result = evaluate_dir(root, kind="joined", require_confirm=True)
			self.assertEqual(result["traces_evaluated"], 0)
			self.assertIsNotNone(result["skipped_reason"])


if __name__ == "__main__":
	unittest.main()
