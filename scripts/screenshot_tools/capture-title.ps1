# Capture a visible window whose title contains a substring.
# Usage: powershell.exe -File capture-title.ps1 <title-substring> <out.png>
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinCap2 {
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
$needle = $args[0]; $out = $args[1]
$script:matches = @()
$null = [WinCap2]::EnumWindows({
	param($h, $l)
	if ([WinCap2]::IsWindowVisible($h)) {
		$sb = New-Object System.Text.StringBuilder 512
		[void][WinCap2]::GetWindowText($h, $sb, $sb.Capacity)
		$title = $sb.ToString()
		if ($title -and ($title -like "*$needle*")) {
			$script:matches += [pscustomobject]@{ Hwnd = $h; Title = $title }
		}
	}
	return $true
}, [IntPtr]::Zero)
if (-not $script:matches -or $script:matches.Count -eq 0) { throw "No window matching *$needle*" }
$pick = $script:matches | Where-Object { $_.Title -ne "BlinkGuard" } | Select-Object -First 1
if (-not $pick) { $pick = $script:matches | Select-Object -First 1 }
$hwnd = $pick.Hwnd
[void][WinCap2]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 350
$rect = New-Object WinCap2+RECT
[void][WinCap2]::GetWindowRect($hwnd, [ref]$rect)
$w = $rect.Right - $rect.Left; $h = $rect.Bottom - $rect.Top
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[void][WinCap2]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc); $g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
Write-Host "saved $out ($w x $h) title=$($pick.Title)"
