"""NdjsonTransport stdin EOF → quit (no camera)."""

from __future__ import annotations

import io
import unittest

from blink_detector_package.infrastructure.transport import (
	QUIT_COMMAND,
	NdjsonTransport,
)


class TransportEofTests(unittest.TestCase):
	def test_eof_enqueues_quit_and_stops(self):
		out = io.StringIO()
		transport = NdjsonTransport(
			input_stream=io.StringIO(""),
			output_stream=out,
		)
		transport._read_input()
		self.assertEqual(transport.command_queue.get_nowait(), QUIT_COMMAND)
		self.assertTrue(transport.command_queue.empty())
		self.assertIn("stdin EOF, quitting", out.getvalue())

	def test_stop_is_safe_noop(self):
		transport = NdjsonTransport(
			input_stream=io.StringIO(""),
			output_stream=io.StringIO(),
		)
		self.assertIsNone(transport.stop())


if __name__ == "__main__":
	unittest.main()
