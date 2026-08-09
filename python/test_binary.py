#!/usr/bin/env python3
"""
Smoke-test the standalone blink detector binary.

Must not hang on CI: frozen sidecar may open a camera (slow/missing on
headless runners) and produce little or no stdout. Never block forever on
readline() — that ignored the old wall-clock loop.
"""

from __future__ import annotations

import json
import platform
import subprocess
import sys
import threading
import time
from pathlib import Path

# Keep the process alive briefly to catch instant crashes, then stop.
ALIVE_SEC = 2
TERMINATE_SEC = 5


def get_executable_name() -> str:
	if platform.system() == "Windows":
		return "blink_detector.exe"
	return "blink_detector"


def _drain(stream, lines: list[str], prefix: str) -> None:
	if stream is None:
		return
	for line in stream:
		text = line.strip()
		if not text:
			continue
		lines.append(text)
		print(f"{prefix}{text}", flush=True)


def test_binary() -> bool:
	binary_path = Path(__file__).parent / "dist" / get_executable_name()

	if not binary_path.exists():
		print(f"ERROR: Binary not found at: {binary_path}")
		print("Please run the build script first: ./build.sh")
		return False

	print(f"Testing binary: {binary_path}")
	print(f"Binary size: {binary_path.stat().st_size / (1024 * 1024):.1f} MB")

	process: subprocess.Popen[str] | None = None
	stdout_lines: list[str] = []
	stderr_lines: list[str] = []
	threads: list[threading.Thread] = []

	try:
		process = subprocess.Popen(
			[str(binary_path)],
			stdin=subprocess.PIPE,
			stdout=subprocess.PIPE,
			stderr=subprocess.PIPE,
			text=True,
			bufsize=1,
		)
		print("OK: Binary started successfully", flush=True)

		threads = [
			threading.Thread(
				target=_drain,
				args=(process.stdout, stdout_lines, "Output: "),
				daemon=True,
			),
			threading.Thread(
				target=_drain,
				args=(process.stderr, stderr_lines, "stderr: "),
				daemon=True,
			),
		]
		for thread in threads:
			thread.start()

		assert process.stdin is not None
		process.stdin.write(json.dumps({"ear_threshold": 0.20}) + "\n")
		process.stdin.flush()
		print("OK: Sent test configuration", flush=True)

		deadline = time.monotonic() + ALIVE_SEC
		while time.monotonic() < deadline:
			if process.poll() is not None:
				break
			time.sleep(0.1)

		early_exit = process.poll()
		if early_exit is not None and early_exit != 0:
			print(f"ERROR: Binary exited early with code {early_exit}")
			if stderr_lines:
				print("stderr (tail):")
				for line in stderr_lines[-20:]:
					print(f"  {line}")
			return False

		if process.poll() is None:
			process.terminate()
			try:
				process.wait(timeout=TERMINATE_SEC)
			except subprocess.TimeoutExpired:
				process.kill()
				process.wait(timeout=TERMINATE_SEC)

		print("OK: Binary terminated successfully", flush=True)

		if stdout_lines:
			print(f"OK: Binary produced {len(stdout_lines)} lines of output")
		else:
			# Frozen sidecar may stay quiet until camera/session config; process
			# start + clean terminate is enough for a packaging smoke test.
			print("WARNING: No output received from binary (OK if process stayed up)")
		return True

	except Exception as e:
		print(f"ERROR: Error testing binary: {e}")
		return False
	finally:
		if process is not None and process.poll() is None:
			process.kill()
			try:
				process.wait(timeout=TERMINATE_SEC)
			except subprocess.TimeoutExpired:
				pass
		for thread in threads:
			thread.join(timeout=1)


def main() -> None:
	print("Testing standalone blink detector binary...")

	success = test_binary()

	if success:
		print("\nSUCCESS: Binary test passed! The standalone executable works correctly.")
		print("\nYou can now:")
		print("1. Copy the binary to your Electron app's resources folder")
		print("2. Update your Electron code to use the binary instead of Python script")
		print("3. Distribute your app without requiring Python installation")
	else:
		print("\nERROR: Binary test failed. Please check the build process.")
		sys.exit(1)


if __name__ == "__main__":
	main()
