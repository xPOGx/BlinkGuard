# Click at (relX, relY) relative to the BlinkGuard window top-left (incl. chrome).
# Usage: powershell.exe -File click-rel.ps1 <relX> <relY>
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseClick {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public const uint LEFTDOWN = 0x0002;
  public const uint LEFTUP = 0x0004;
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    mouse_event(LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
    System.Threading.Thread.Sleep(40);
    mouse_event(LEFTUP, 0, 0, 0, UIntPtr.Zero);
  }
}
"@
function Find-BlinkGuardWindow {
	$script:found = [IntPtr]::Zero
	$null = [MouseClick]::EnumWindows({
		param($h, $l)
		if ([MouseClick]::IsWindowVisible($h)) {
			$sb = New-Object System.Text.StringBuilder 512
			[void][MouseClick]::GetWindowText($h, $sb, $sb.Capacity)
			if ($sb.ToString() -eq "BlinkGuard") { $script:found = $h }
		}
		return $true
	}, [IntPtr]::Zero)
	if ($script:found -eq [IntPtr]::Zero) { throw "BlinkGuard window not found" }
	return $script:found
}
$relX = [int]$args[0]; $relY = [int]$args[1]
$hwnd = Find-BlinkGuardWindow
[void][MouseClick]::ShowWindow($hwnd, 9)
[void][MouseClick]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 200
$rect = New-Object MouseClick+RECT
[void][MouseClick]::GetWindowRect($hwnd, [ref]$rect)
[MouseClick]::Click(($rect.Left + $relX), ($rect.Top + $relY))
Write-Host "clicked ($relX,$relY)"
