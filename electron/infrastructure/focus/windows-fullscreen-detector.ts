import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrowserWindow, screen } from "electron";
import type { FocusEnvironmentPort } from "../../application/ports/focus-environment-port";
import {
	isNearFullscreenCover,
	parseProbeBounds,
} from "./fullscreen-geometry";

const HOST_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class BlinkGuardFg {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@ | Out-Null

function Test-Fullscreen([string[]]$Exclude) {
  $hwnd = [BlinkGuardFg]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) { return "0" }
  $id = $hwnd.ToInt64().ToString()
  if ($Exclude -contains $id) { return "0" }
  if (-not [BlinkGuardFg]::IsWindowVisible($hwnd)) { return "0" }
  if ([BlinkGuardFg]::IsIconic($hwnd)) { return "0" }
  $rect = New-Object BlinkGuardFg+RECT
  if (-not [BlinkGuardFg]::GetWindowRect($hwnd, [ref]$rect)) { return "0" }
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  if ($w -le 0 -or $h -le 0) { return "0" }
  return "1|$id|$($rect.Left)|$($rect.Top)|$($rect.Right)|$($rect.Bottom)"
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq "q") { break }
  if ($line.StartsWith("c ")) {
    $exclude = @()
    $rest = $line.Substring(2).Trim()
    if ($rest.Length -gt 0) {
      $exclude = $rest.Split(",") | Where-Object { $_ -ne "" }
    }
    Write-Output (Test-Fullscreen $exclude)
    [Console]::Out.Flush()
  }
}
`.trimStart();

/**
 * Windows foreground fullscreen probe via a long-running PowerShell host
 * (Win32 GetForegroundWindow / GetWindowRect). No native Node addon.
 */
export class WindowsFullscreenDetector implements FocusEnvironmentPort {
	private host: ChildProcessWithoutNullStreams | null = null;
	private buffer = "";
	private pending: {
		resolve: (value: string) => void;
		reject: (error: Error) => void;
	} | null = null;
	private lastResult = false;
	private inFlight = false;
	private scriptPath: string | null = null;

	isOtherAppFullscreen(): boolean {
		void this.refresh();
		return this.lastResult;
	}

	supportsFullscreenDetection(): boolean {
		return true;
	}

	dispose(): void {
		if (this.pending) {
			this.pending.reject(new Error("fullscreen detector disposed"));
			this.pending = null;
		}
		if (this.host && !this.host.killed) {
			try {
				this.host.stdin.write("q\n");
			} catch {
				/* ignore */
			}
			this.host.kill();
		}
		this.host = null;
	}

	private ensureScriptPath(): string {
		if (this.scriptPath) return this.scriptPath;
		const file = path.join(os.tmpdir(), "blinkguard-detect-fullscreen-host.ps1");
		fs.writeFileSync(file, HOST_SCRIPT, "utf8");
		this.scriptPath = file;
		return file;
	}

	private ensureHost(): ChildProcessWithoutNullStreams | null {
		if (this.host && !this.host.killed) return this.host;
		try {
			const child = spawn(
				"powershell.exe",
				[
					"-NoProfile",
					"-NonInteractive",
					"-ExecutionPolicy",
					"Bypass",
					"-File",
					this.ensureScriptPath(),
				],
				{ stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
			);
			child.stdout.setEncoding("utf8");
			child.stdout.on("data", (chunk: string) => {
				this.buffer += chunk;
				const newline = this.buffer.indexOf("\n");
				if (newline === -1) return;
				const line = this.buffer.slice(0, newline).trim();
				this.buffer = this.buffer.slice(newline + 1);
				if (this.pending) {
					const { resolve } = this.pending;
					this.pending = null;
					resolve(line);
				}
			});
			child.on("exit", () => {
				this.host = null;
				if (this.pending) {
					this.pending.reject(new Error("fullscreen host exited"));
					this.pending = null;
				}
			});
			this.host = child;
			return child;
		} catch {
			return null;
		}
	}

	private async refresh(): Promise<void> {
		if (this.inFlight) return;
		this.inFlight = true;
		try {
			const line = await this.query();
			this.lastResult = this.interpret(line);
		} catch {
			this.lastResult = false;
		} finally {
			this.inFlight = false;
		}
	}

	private query(): Promise<string> {
		const host = this.ensureHost();
		if (!host) return Promise.resolve("0");
		if (this.pending) {
			return Promise.resolve(this.lastResult ? "1" : "0");
		}
		const handles = ownWindowHwnds().join(",");
		return new Promise<string>((resolve, reject) => {
			this.pending = { resolve, reject };
			try {
				host.stdin.write(`c ${handles}\n`);
			} catch (error) {
				this.pending = null;
				reject(error instanceof Error ? error : new Error(String(error)));
			}
			setTimeout(() => {
				if (this.pending?.resolve === resolve) {
					this.pending = null;
					reject(new Error("fullscreen probe timed out"));
				}
			}, 1500);
		});
	}

	private interpret(line: string): boolean {
		const bounds = parseProbeBounds(line);
		if (!bounds) return false;

		const display = screen.getDisplayMatching(bounds);
		return isNearFullscreenCover(bounds, display.bounds);
	}
}

function ownWindowHwnds(): string[] {
	const ids: string[] = [];
	for (const win of BrowserWindow.getAllWindows()) {
		if (win.isDestroyed()) continue;
		try {
			const buf = win.getNativeWindowHandle();
			const hwnd =
				buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0));
			ids.push(hwnd.toString());
		} catch {
			/* ignore */
		}
	}
	return ids;
}
