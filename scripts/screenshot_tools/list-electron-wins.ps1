# List visible Electron windows (HWND, title, bounds) for BlinkGuard processes.
# Usage: powershell.exe -File list-electron-wins.ps1
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinEnumPid {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$pids = @(Get-Process electron -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$script:wins = @()
$null = [WinEnumPid]::EnumWindows({
	param($h, $l)
	if ([WinEnumPid]::IsWindowVisible($h)) {
		$pidOut = [uint32]0
		[void][WinEnumPid]::GetWindowThreadProcessId($h, [ref]$pidOut)
		if ($pids -contains [int]$pidOut) {
			$sb = New-Object System.Text.StringBuilder 512
			[void][WinEnumPid]::GetWindowText($h, $sb, $sb.Capacity)
			$r = New-Object WinEnumPid+RECT
			[void][WinEnumPid]::GetWindowRect($h, [ref]$r)
			$script:wins += [pscustomobject]@{
				Hwnd = [int64]$h
				Pid = $pidOut
				Title = $sb.ToString()
				Left = $r.Left; Top = $r.Top; Right = $r.Right; Bottom = $r.Bottom
				W = $r.Right - $r.Left; H = $r.Bottom - $r.Top
			}
		}
	}
	return $true
}, [IntPtr]::Zero)
$script:wins | Sort-Object W -Descending | Format-Table -AutoSize
