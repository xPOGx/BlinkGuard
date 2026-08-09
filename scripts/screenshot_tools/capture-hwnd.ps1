# Capture a specific HWND (frameless overlays often have empty/generic titles).
# Usage: powershell.exe -File capture-hwnd.ps1 <hwnd> <out.png>
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CapHwnd {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$hwndVal = [int64]$args[0]
$path = $args[1]
$hwnd = [IntPtr]$hwndVal
if (-not [CapHwnd]::IsWindow($hwnd)) { throw "Invalid hwnd $hwndVal" }
[void][CapHwnd]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 200
$r = New-Object CapHwnd+RECT
[void][CapHwnd]::GetWindowRect($hwnd, [ref]$r)
$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[void][CapHwnd]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "saved $path ($w x $h)"
