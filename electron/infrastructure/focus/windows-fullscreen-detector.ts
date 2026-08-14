import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrowserWindow } from "electron";
import type {
	FocusEnvironmentPort,
	FocusForegroundSnapshot,
} from "../../application/ports/focus-environment-port";
import type { PauseAppRule } from "../../../shared/preferences";
import { FocusHostSession } from "./focus-host-session";

const HOST_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class BlinkGuardFg {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr hProcess, uint dwFlags, StringBuilder lpExeName, ref uint lpdwSize);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool CloseHandle(IntPtr hObject);
  public const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
}
"@ | Out-Null

function Sanitize-Token([string]$Value) {
  if ([string]::IsNullOrEmpty($Value)) { return "" }
  return (($Value -replace '[|\\r\\n]+', ' ').Trim())
}

function Get-FgIdentity([IntPtr]$Hwnd) {
  $titleSb = New-Object System.Text.StringBuilder 512
  [void][BlinkGuardFg]::GetWindowText($Hwnd, $titleSb, $titleSb.Capacity)
  $title = Sanitize-Token $titleSb.ToString()
  $procId = [uint32]0
  [void][BlinkGuardFg]::GetWindowThreadProcessId($Hwnd, [ref]$procId)
  $proc = ""
  if ($procId -ne 0) {
    $handle = [BlinkGuardFg]::OpenProcess([BlinkGuardFg]::PROCESS_QUERY_LIMITED_INFORMATION, $false, $procId)
    if ($handle -ne [IntPtr]::Zero) {
      try {
        $size = [uint32]1024
        $pathSb = New-Object System.Text.StringBuilder 1024
        if ([BlinkGuardFg]::QueryFullProcessImageName($handle, 0, $pathSb, [ref]$size)) {
          $proc = Sanitize-Token ([System.IO.Path]::GetFileName($pathSb.ToString()))
        }
      } finally {
        [void][BlinkGuardFg]::CloseHandle($handle)
      }
    }
  }
  return "$proc|$title"
}

function Test-Fullscreen([string[]]$Exclude) {
  $hwnd = [BlinkGuardFg]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) { return "0" }
  $id = $hwnd.ToInt64().ToString()
  if ($Exclude -contains $id) { return "0" }
  $tail = Get-FgIdentity $hwnd
  if (-not [BlinkGuardFg]::IsWindowVisible($hwnd)) { return "0|||$tail" }
  if ([BlinkGuardFg]::IsIconic($hwnd)) { return "0|||$tail" }
  $rect = New-Object BlinkGuardFg+RECT
  if (-not [BlinkGuardFg]::GetWindowRect($hwnd, [ref]$rect)) { return "0|||$tail" }
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  if ($w -le 0 -or $h -le 0) { return "0|||$tail" }
  return "1|$id|$($rect.Left)|$($rect.Top)|$($rect.Right)|$($rect.Bottom)|$tail"
}

function List-Apps([string[]]$Exclude) {
  $items = @()
  Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      if ($_.MainWindowHandle -eq [IntPtr]::Zero) { return }
      $id = $_.MainWindowHandle.ToInt64().ToString()
      if ($Exclude -contains $id) { return }
      $title = Sanitize-Token ([string]$_.MainWindowTitle)
      $name = [string]$_.ProcessName
      if ([string]::IsNullOrEmpty($name)) { return }
      $proc = Sanitize-Token ($name + ".exe")
      $items += @{ p = $proc; t = $title }
    } catch {}
  }
  $json = ConvertTo-Json -Compress -InputObject @($items)
  if ($null -eq $json -or $json -eq "") { $json = "[]" }
  return "L$json"
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq "q") { break }
  if ($line.StartsWith("c ") -or $line.StartsWith("l ")) {
    $exclude = @()
    $rest = $line.Substring(2).Trim()
    if ($rest.Length -gt 0) {
      $exclude = $rest.Split(",") | Where-Object { $_ -ne "" }
    }
    if ($line.StartsWith("l ")) {
      Write-Output (List-Apps $exclude)
    } else {
      Write-Output (Test-Fullscreen $exclude)
    }
    [Console]::Out.Flush()
  }
}
`.trimStart();

/**
 * Windows foreground probe via a long-running PowerShell host
 * (Win32 GetForegroundWindow / GetWindowRect / process image / title).
 * Protocol: `c` → `0` | `0|||proc|title` | `1|hwnd|l|t|r|b|proc|title`;
 * `l` → `L[{p,t},…]`.
 */
export class WindowsFullscreenDetector implements FocusEnvironmentPort {
	private scriptPath: string | null = null;
	private readonly session = new FocusHostSession(() =>
		spawn(
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
		),
	);

	isOtherAppFullscreen(): boolean {
		return this.probeForeground().isFullscreen;
	}

	probeForeground(): FocusForegroundSnapshot {
		this.session.refreshProbe(ownWindowHwnds().join(","));
		return this.session.snapshot;
	}

	listRunningApps(): Promise<PauseAppRule[]> {
		return this.session.listRunningApps(ownWindowHwnds().join(","));
	}

	supportsFullscreenDetection(): boolean {
		return true;
	}

	dispose(): void {
		this.session.dispose();
	}

	private ensureScriptPath(): string {
		if (this.scriptPath) return this.scriptPath;
		const file = path.join(os.tmpdir(), "blinkguard-detect-fullscreen-host.ps1");
		fs.writeFileSync(file, HOST_SCRIPT, "utf8");
		this.scriptPath = file;
		return file;
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
