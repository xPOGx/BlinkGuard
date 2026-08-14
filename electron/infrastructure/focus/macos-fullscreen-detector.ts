import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
	FocusEnvironmentPort,
	FocusForegroundSnapshot,
} from "../../application/ports/focus-environment-port";
import type { PauseAppRule } from "../../../shared/preferences";
import { FocusHostSession } from "./focus-host-session";

/**
 * Long-running JXA host: frontmost PID + CGWindowList bounds, or Space
 * fullscreen heuristics (Dock Fullscreen Backdrop / missing Menubar).
 * Protocol: write `c <excludePid1>,...\n` →
 * `0` | `0|||proc|title` | `F|||proc|title` | `1|pid|l|t|r|b|proc|title`.
 * `l <excludePids>` → `L[{p,t},…]`.
 */
const HOST_SCRIPT = `
ObjC.import("Cocoa");
ObjC.import("CoreGraphics");
ObjC.import("Foundation");

function readStdinLine() {
  var fh = $.NSFileHandle.fileHandleWithStandardInput;
  var parts = [];
  while (true) {
    var data = fh.readDataOfLength(1);
    if (!data || data.length === 0) return null;
    var s = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding));
    if (s === "\\n") break;
    if (s === "\\r") continue;
    parts.push(s);
  }
  return parts.join("");
}

function sanitizeToken(s) {
  return String(s || "").replace(/\\|/g, " ").replace(/[\\r\\n]/g, " ").trim();
}

function identityTail(front, windowList, pid) {
  var proc = "";
  try {
    var url = front.executableURL;
    if (url) proc = sanitizeToken(ObjC.unwrap(url.lastPathComponent));
  } catch (e) {}
  if (!proc) {
    try {
      proc = sanitizeToken(ObjC.unwrap(front.localizedName));
    } catch (e2) {}
  }
  var title = "";
  var bestArea = 0;
  for (var i = 0; i < windowList.length; i++) {
    var w = windowList[i];
    if (!w) continue;
    var ownerPid = w.kCGWindowOwnerPID;
    var layer = w.kCGWindowLayer;
    if (layer === undefined || layer === null) layer = 0;
    if (ownerPid !== pid || layer !== 0) continue;
    var bounds = w.kCGWindowBounds;
    var width = bounds ? Number(bounds.Width) || 0 : 0;
    var height = bounds ? Number(bounds.Height) || 0 : 0;
    var area = width * height;
    if (area >= bestArea) {
      bestArea = area;
      title = sanitizeToken(w.kCGWindowName || "");
    }
  }
  return proc + "|" + title;
}

function testFullscreen(excludePids) {
  var front = $.NSWorkspace.sharedWorkspace.frontmostApplication;
  if (!front) return "0";
  var pid = front.processIdentifier;
  for (var i = 0; i < excludePids.length; i++) {
    if (Number(excludePids[i]) === pid) return "0";
  }

  var options = $.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements;
  var raw = $.CGWindowListCopyWindowInfo(options, $.kCGNullWindowID);
  if (!raw) return "0";
  var windowList = ObjC.deepUnwrap(raw) || [];
  var tail = identityTail(front, windowList, pid);

  var best = null;
  var bestArea = 0;
  var hasMenubar = false;
  var hasFullscreenBackdrop = false;

  for (var i = 0; i < windowList.length; i++) {
    var w = windowList[i];
    if (!w) continue;
    var owner = w.kCGWindowOwnerName || "";
    var name = w.kCGWindowName || "";
    var ownerPid = w.kCGWindowOwnerPID;
    var layer = w.kCGWindowLayer;
    if (layer === undefined || layer === null) layer = 0;
    var bounds = w.kCGWindowBounds;

    if (owner === "Window Server" && name === "Menubar") hasMenubar = true;
    if (owner === "Dock" && name === "Fullscreen Backdrop") {
      hasFullscreenBackdrop = true;
    }

    if (ownerPid === pid && layer === 0 && bounds) {
      var width = Number(bounds.Width) || 0;
      var height = Number(bounds.Height) || 0;
      var area = width * height;
      if (area > bestArea) {
        bestArea = area;
        best = bounds;
      }
    }
  }

  if (best && bestArea > 0) {
    var left = Number(best.X) || 0;
    var top = Number(best.Y) || 0;
    var right = left + (Number(best.Width) || 0);
    var bottom = top + (Number(best.Height) || 0);
    return "1|" + pid + "|" + left + "|" + top + "|" + right + "|" + bottom + "|" + tail;
  }

  if (hasFullscreenBackdrop || !hasMenubar) return "F|||" + tail;
  return "0|||" + tail;
}

function listApps(excludePids) {
  var options = $.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements;
  var raw = $.CGWindowListCopyWindowInfo(options, $.kCGNullWindowID);
  if (!raw) return "L[]";
  var windowList = ObjC.deepUnwrap(raw) || [];
  var items = [];
  var seen = {};
  for (var i = 0; i < windowList.length; i++) {
    var w = windowList[i];
    if (!w) continue;
    var layer = w.kCGWindowLayer;
    if (layer === undefined || layer === null) layer = 0;
    if (layer !== 0) continue;
    var ownerPid = w.kCGWindowOwnerPID;
    var skip = false;
    for (var e = 0; e < excludePids.length; e++) {
      if (Number(excludePids[e]) === ownerPid) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    var owner = w.kCGWindowOwnerName || "";
    if (owner === "Window Server" || owner === "Dock") continue;
    var title = sanitizeToken(w.kCGWindowName || "");
    var proc = "";
    try {
      var app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(ownerPid);
      if (app) {
        try {
          var url = app.executableURL;
          if (url) proc = sanitizeToken(ObjC.unwrap(url.lastPathComponent));
        } catch (e1) {}
        if (!proc) {
          try {
            proc = sanitizeToken(ObjC.unwrap(app.localizedName));
          } catch (e2) {}
        }
      }
    } catch (e3) {}
    if (!proc) proc = sanitizeToken(owner);
    if (!proc) continue;
    var key = proc + "|" + title;
    if (seen[key]) continue;
    seen[key] = true;
    items.push({ p: proc, t: title });
  }
  try {
    return "L" + JSON.stringify(items);
  } catch (e4) {
    return "L[]";
  }
}

while (true) {
  var line = readStdinLine();
  if (line === null) break;
  line = String(line).trim();
  if (line === "q") break;
  if (line.indexOf("c ") === 0 || line.indexOf("l ") === 0) {
    var rest = line.substring(2).trim();
    var exclude = rest.length > 0 ? rest.split(",") : [];
    if (line.indexOf("l ") === 0) {
      console.log(listApps(exclude));
    } else {
      console.log(testFullscreen(exclude));
    }
  }
}
`.trimStart();

/**
 * macOS foreground probe via a long-running JXA (osascript) host
 * (NSWorkspace + CGWindowList). No native Node addon.
 */
export class MacosFullscreenDetector implements FocusEnvironmentPort {
	private scriptPath: string | null = null;
	private readonly session = new FocusHostSession(() =>
		spawn("osascript", ["-l", "JavaScript", this.ensureScriptPath()], {
			stdio: ["pipe", "pipe", "pipe"],
		}),
	);

	isOtherAppFullscreen(): boolean {
		return this.probeForeground().isFullscreen;
	}

	probeForeground(): FocusForegroundSnapshot {
		this.session.refreshProbe(String(process.pid));
		return this.session.snapshot;
	}

	listRunningApps(): Promise<PauseAppRule[]> {
		return this.session.listRunningApps(String(process.pid));
	}

	supportsFullscreenDetection(): boolean {
		return true;
	}

	dispose(): void {
		this.session.dispose();
	}

	private ensureScriptPath(): string {
		if (this.scriptPath) return this.scriptPath;
		const file = path.join(
			os.tmpdir(),
			"blinkguard-detect-fullscreen-host.jxa.js",
		);
		fs.writeFileSync(file, HOST_SCRIPT, "utf8");
		this.scriptPath = file;
		return file;
	}
}
