# Capture the main BlinkGuard settings window (PrintWindow) to a PNG.
# Usage: powershell.exe -File capture-window.ps1 <out.png>
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinCap {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
function Find-BlinkGuardWindow {
	$script:found = [IntPtr]::Zero
	$null = [WinCap]::EnumWindows({
		param($h, $l)
		if ([WinCap]::IsWindowVisible($h)) {
			$sb = New-Object System.Text.StringBuilder 512
			[void][WinCap]::GetWindowText($h, $sb, $sb.Capacity)
			if ($sb.ToString() -eq "BlinkGuard") { $script:found = $h }
		}
		return $true
	}, [IntPtr]::Zero)
	if ($script:found -eq [IntPtr]::Zero) { throw "BlinkGuard window not found" }
	return $script:found
}
$out = $args[0]
if (-not $out) { throw "Usage: capture-window.ps1 <out.png>" }
$hwnd = Find-BlinkGuardWindow
[void][WinCap]::ShowWindow($hwnd, 9)
[void][WinCap]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 400
$rect = New-Object WinCap+RECT
[void][WinCap]::GetWindowRect($hwnd, [ref]$rect)
$w = $rect.Right - $rect.Left; $h = $rect.Bottom - $rect.Top
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [WinCap]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc)
if (-not $ok) { $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $w, $h)) }
$g.Dispose(); $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
Write-Host "saved $out"
