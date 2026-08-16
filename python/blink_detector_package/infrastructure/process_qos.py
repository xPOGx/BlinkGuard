"""Opt this process out of OS background throttling while the camera is live.

Windows: HighQoS via ProcessPowerThrottling (not SetPriorityClass).
macOS: NSProcessInfo activity that still allows idle system sleep.
Other platforms: no-op.

Failures must never raise into the detector loop.
"""

from __future__ import annotations

import sys

PROCESS_POWER_THROTTLING = 4
PROCESS_POWER_THROTTLING_CURRENT_VERSION = 1
PROCESS_POWER_THROTTLING_EXECUTION_SPEED = 0x1
PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION = 0x4

# NSActivityUserInitiatedAllowingIdleSystemSleep =
# (0x00FFFFFF | (1<<20)) & ~(1<<20)  — bit 20 is idle-system-sleep disabled.
NS_ACTIVITY_IDLE_SYSTEM_SLEEP_DISABLED = 1 << 20
NS_ACTIVITY_USER_INITIATED_ALLOWING_IDLE_SYSTEM_SLEEP = (
	0x00FFFFFF & ~NS_ACTIVITY_IDLE_SYSTEM_SLEEP_DISABLED
)

_boosted = False
_macos_activity = None
_macos_process_info = None


def is_boosted():
	return _boosted


def reset_for_tests():
	global _boosted, _macos_activity, _macos_process_info
	_boosted = False
	_macos_activity = None
	_macos_process_info = None


def boost_capture():
	"""Hold high-execution-speed classification. Idempotent. Returns a debug token."""
	global _boosted
	if _boosted:
		return "already"
	try:
		if sys.platform == "win32":
			_win_set_high_qos()
			_boosted = True
			return "boosted"
		if sys.platform == "darwin":
			_macos_begin_activity()
			_boosted = True
			return "activity"
		return "noop"
	except Exception as error:
		return f"failed:{error}"


def release_capture():
	"""Return to system-managed QoS. Idempotent. Returns a debug token."""
	global _boosted
	if not _boosted:
		return "idle"
	try:
		if sys.platform == "win32":
			_win_reset_qos()
		elif sys.platform == "darwin":
			_macos_end_activity()
		_boosted = False
		return "released"
	except Exception as error:
		_boosted = False
		return f"failed:{error}"


def _win_set_high_qos():
	both = (
		PROCESS_POWER_THROTTLING_EXECUTION_SPEED
		| PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION
	)
	if _win_apply(both, 0):
		return
	if _win_apply(PROCESS_POWER_THROTTLING_EXECUTION_SPEED, 0):
		return
	raise OSError(_win_last_error())


def _win_reset_qos():
	if not _win_apply(0, 0):
		raise OSError(_win_last_error())


def _win_apply(control_mask, state_mask):
	import ctypes
	from ctypes import wintypes

	class PROCESS_POWER_THROTTLING_STATE(ctypes.Structure):
		_fields_ = [
			("Version", wintypes.ULONG),
			("ControlMask", wintypes.ULONG),
			("StateMask", wintypes.ULONG),
		]

	kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
	kernel32.GetCurrentProcess.restype = wintypes.HANDLE
	kernel32.SetProcessInformation.argtypes = [
		wintypes.HANDLE,
		ctypes.c_int,
		ctypes.c_void_p,
		wintypes.DWORD,
	]
	kernel32.SetProcessInformation.restype = wintypes.BOOL

	state = PROCESS_POWER_THROTTLING_STATE()
	state.Version = PROCESS_POWER_THROTTLING_CURRENT_VERSION
	state.ControlMask = control_mask
	state.StateMask = state_mask
	ok = kernel32.SetProcessInformation(
		kernel32.GetCurrentProcess(),
		PROCESS_POWER_THROTTLING,
		ctypes.byref(state),
		ctypes.sizeof(state),
	)
	return bool(ok)


def _win_last_error():
	import ctypes

	return ctypes.get_last_error()


def _macos_begin_activity():
	global _macos_activity, _macos_process_info
	import ctypes
	import ctypes.util

	lib_name = ctypes.util.find_library("objc")
	if not lib_name:
		raise OSError("libobjc not found")
	objc = ctypes.cdll.LoadLibrary(lib_name)
	objc.objc_getClass.restype = ctypes.c_void_p
	objc.objc_getClass.argtypes = [ctypes.c_char_p]
	objc.sel_registerName.restype = ctypes.c_void_p
	objc.sel_registerName.argtypes = [ctypes.c_char_p]

	msg = objc.objc_msgSend
	msg.restype = ctypes.c_void_p

	ns_process_info = objc.objc_getClass(b"NSProcessInfo")
	if not ns_process_info:
		raise OSError("NSProcessInfo missing")
	msg.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
	process_info = msg(ns_process_info, objc.sel_registerName(b"processInfo"))
	if not process_info:
		raise OSError("processInfo missing")

	ns_string = objc.objc_getClass(b"NSString")
	msg.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_char_p]
	reason = msg(
		ns_string,
		objc.sel_registerName(b"stringWithUTF8String:"),
		b"BlinkGuard camera capture",
	)
	if not reason:
		raise OSError("activity reason string missing")

	msg.argtypes = [
		ctypes.c_void_p,
		ctypes.c_void_p,
		ctypes.c_uint64,
		ctypes.c_void_p,
	]
	activity = msg(
		process_info,
		objc.sel_registerName(b"beginActivityWithOptions:reason:"),
		ctypes.c_uint64(NS_ACTIVITY_USER_INITIATED_ALLOWING_IDLE_SYSTEM_SLEEP),
		reason,
	)
	if not activity:
		raise OSError("beginActivity returned null")

	msg.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
	msg(activity, objc.sel_registerName(b"retain"))
	_macos_process_info = process_info
	_macos_activity = activity


def _macos_end_activity():
	global _macos_activity, _macos_process_info
	if _macos_activity is None or _macos_process_info is None:
		_macos_activity = None
		_macos_process_info = None
		return
	import ctypes
	import ctypes.util

	lib_name = ctypes.util.find_library("objc")
	if not lib_name:
		_macos_activity = None
		_macos_process_info = None
		return
	objc = ctypes.cdll.LoadLibrary(lib_name)
	objc.sel_registerName.restype = ctypes.c_void_p
	objc.sel_registerName.argtypes = [ctypes.c_char_p]
	msg = objc.objc_msgSend
	msg.restype = ctypes.c_void_p
	msg.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]
	msg(
		_macos_process_info,
		objc.sel_registerName(b"endActivity:"),
		_macos_activity,
	)
	msg.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
	msg(_macos_activity, objc.sel_registerName(b"release"))
	_macos_activity = None
	_macos_process_info = None
