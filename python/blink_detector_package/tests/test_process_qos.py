"""Unit tests for capture-time process QoS (no Win32/AppKit required)."""

from __future__ import annotations

import unittest
from unittest import mock

from blink_detector_package.infrastructure import process_qos


class ProcessQosTests(unittest.TestCase):
	def tearDown(self):
		process_qos.reset_for_tests()

	def test_linux_is_noop(self):
		with mock.patch.object(process_qos.sys, "platform", "linux"):
			self.assertEqual(process_qos.boost_capture(), "noop")
			self.assertFalse(process_qos.is_boosted())
			self.assertEqual(process_qos.release_capture(), "idle")

	def test_windows_boost_and_release(self):
		with mock.patch.object(process_qos.sys, "platform", "win32"):
			with mock.patch.object(process_qos, "_win_set_high_qos") as boost:
				with mock.patch.object(process_qos, "_win_reset_qos") as release:
					self.assertEqual(process_qos.boost_capture(), "boosted")
					self.assertTrue(process_qos.is_boosted())
					self.assertEqual(process_qos.boost_capture(), "already")
					boost.assert_called_once()
					self.assertEqual(process_qos.release_capture(), "released")
					self.assertFalse(process_qos.is_boosted())
					release.assert_called_once()
					self.assertEqual(process_qos.release_capture(), "idle")

	def test_windows_boost_failure_does_not_raise(self):
		with mock.patch.object(process_qos.sys, "platform", "win32"):
			with mock.patch.object(
				process_qos,
				"_win_set_high_qos",
				side_effect=OSError(87),
			):
				self.assertTrue(
					process_qos.boost_capture().startswith("failed:")
				)
				self.assertFalse(process_qos.is_boosted())

	def test_macos_allowing_idle_sleep_clears_bit_20(self):
		self.assertEqual(
			process_qos.NS_ACTIVITY_USER_INITIATED_ALLOWING_IDLE_SYSTEM_SLEEP,
			0x00EFFFFF,
		)
		self.assertEqual(
			process_qos.NS_ACTIVITY_USER_INITIATED_ALLOWING_IDLE_SYSTEM_SLEEP
			& process_qos.NS_ACTIVITY_IDLE_SYSTEM_SLEEP_DISABLED,
			0,
		)
		with mock.patch.object(process_qos.sys, "platform", "darwin"):
			with mock.patch.object(process_qos, "_macos_begin_activity"):
				with mock.patch.object(process_qos, "_macos_end_activity"):
					self.assertEqual(process_qos.boost_capture(), "activity")
					self.assertTrue(process_qos.is_boosted())
					self.assertEqual(process_qos.release_capture(), "released")

	def test_win_apply_retries_execution_speed_only(self):
		with mock.patch.object(
			process_qos,
			"_win_apply",
			side_effect=[False, True],
		) as apply_fn:
			process_qos._win_set_high_qos()
			self.assertEqual(apply_fn.call_count, 2)
			self.assertEqual(
				apply_fn.call_args_list[0][0][0],
				process_qos.PROCESS_POWER_THROTTLING_EXECUTION_SPEED
				| process_qos.PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION,
			)
			self.assertEqual(
				apply_fn.call_args_list[1][0][0],
				process_qos.PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
			)
			self.assertEqual(apply_fn.call_args_list[0][0][1], 0)
			self.assertEqual(apply_fn.call_args_list[1][0][1], 0)


if __name__ == "__main__":
	unittest.main()
