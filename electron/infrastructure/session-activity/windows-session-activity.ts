import { spawn } from "node:child_process";
import type { SessionActivitySnapshot } from "../../application/ports/session-activity-port";
import { HostedSessionActivity } from "./hosted-session-activity";

const HOST_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class BlinkGuardSessionForm : Form {
  public static readonly Guid GUID_CONSOLE_DISPLAY_STATE = new Guid("6FE69556-704A-47A0-8F5D-F264D3D1F0E5");
  public static readonly Guid GUID_LIDSWITCH_STATE_CHANGE = new Guid("BA3E0F4D-B817-4094-A2D1-D56379E6A0F3");
  const int WM_POWERBROADCAST = 0x0218;
  const int PBT_POWERSETTINGCHANGE = 0x8013;
  const int DEVICE_NOTIFY_WINDOW_HANDLE = 0;

  [DllImport("user32.dll", SetLastError = true)]
  static extern IntPtr RegisterPowerSettingNotification(IntPtr hRecipient, ref Guid PowerSettingGuid, int Flags);

  [StructLayout(LayoutKind.Sequential, Pack = 4)]
  struct POWERBROADCAST_SETTING {
    public Guid PowerSetting;
    public uint DataLength;
    public byte Data;
  }

  protected override CreateParams CreateParams {
    get {
      CreateParams cp = base.CreateParams;
      cp.Caption = "BlinkGuardSessionActivity";
      cp.Parent = new IntPtr(-3);
      return cp;
    }
  }

  public BlinkGuardSessionForm() {
    ShowInTaskbar = false;
    FormBorderStyle = FormBorderStyle.FixedToolWindow;
    Width = 0;
    Height = 0;
  }

  protected override void SetVisibleCore(bool value) {
    if (!IsHandleCreated) CreateHandle();
    base.SetVisibleCore(false);
  }

  protected override void OnHandleCreated(EventArgs e) {
    base.OnHandleCreated(e);
    Guid display = GUID_CONSOLE_DISPLAY_STATE;
    Guid lid = GUID_LIDSWITCH_STATE_CHANGE;
    RegisterPowerSettingNotification(Handle, ref display, DEVICE_NOTIFY_WINDOW_HANDLE);
    RegisterPowerSettingNotification(Handle, ref lid, DEVICE_NOTIFY_WINDOW_HANDLE);
  }

  protected override void WndProc(ref Message m) {
    if (m.Msg == WM_POWERBROADCAST && m.WParam.ToInt32() == PBT_POWERSETTINGCHANGE) {
      POWERBROADCAST_SETTING setting = (POWERBROADCAST_SETTING)Marshal.PtrToStructure(m.LParam, typeof(POWERBROADCAST_SETTING));
      if (setting.PowerSetting == GUID_CONSOLE_DISPLAY_STATE) {
        Console.WriteLine("d" + setting.Data);
        Console.Out.Flush();
      } else if (setting.PowerSetting == GUID_LIDSWITCH_STATE_CHANGE) {
        Console.WriteLine("l" + setting.Data);
        Console.Out.Flush();
      }
    }
    base.WndProc(ref m);
  }
}
"@ | Out-Null

$form = New-Object BlinkGuardSessionForm
[System.Windows.Forms.Application]::Run($form)
`.trimStart();

/** Windows lid / console-display probe. Protocol: `d0`/`d1`/`d2`, `l0`/`l1`. */
export class WindowsSessionActivity extends HostedSessionActivity {
	constructor(onChange: (snapshot: SessionActivitySnapshot) => void) {
		super(
			onChange,
			"blinkguard-session-activity-host.ps1",
			HOST_SCRIPT,
			(scriptPath) =>
				spawn(
					"powershell.exe",
					[
						"-NoProfile",
						"-NonInteractive",
						"-ExecutionPolicy",
						"Bypass",
						"-File",
						scriptPath,
					],
					{ stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
				),
		);
	}
}
