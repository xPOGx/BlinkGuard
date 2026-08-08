import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { screen } from "electron";
import type { FocusEnvironmentPort } from "../../application/ports/focus-environment-port";
import {
	isNearFullscreenCover,
	parseProbeBounds,
} from "./fullscreen-geometry";

/**
 * Long-running JXA host: frontmost PID + CGWindowList bounds, or Space
 * fullscreen heuristics (Dock Fullscreen Backdrop / missing Menubar).
 * Protocol: write `c <excludePid1>,...\n` → `0` | `F` | `1|pid|l|t|r|b`.
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
    return "1|" + pid + "|" + left + "|" + top + "|" + right + "|" + bottom;
  }

  if (hasFullscreenBackdrop || !hasMenubar) return "F";
  return "0";
}

while (true) {
  var line = readStdinLine();
  if (line === null) break;
  line = String(line).trim();
  if (line === "q") break;
  if (line.indexOf("c ") === 0) {
    var rest = line.substring(2).trim();
    var exclude = rest.length > 0 ? rest.split(",") : [];
    console.log(testFullscreen(exclude));
  }
}
`.trimStart();

/**
 * macOS foreground fullscreen probe via a long-running JXA (osascript) host
 * (NSWorkspace + CGWindowList). No native Node addon.
 */
export class MacosFullscreenDetector implements FocusEnvironmentPort {
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
		const file = path.join(
			os.tmpdir(),
			"blinkguard-detect-fullscreen-host.jxa.js",
		);
		fs.writeFileSync(file, HOST_SCRIPT, "utf8");
		this.scriptPath = file;
		return file;
	}

	private ensureHost(): ChildProcessWithoutNullStreams | null {
		if (this.host && !this.host.killed) return this.host;
		try {
			const child = spawn(
				"osascript",
				["-l", "JavaScript", this.ensureScriptPath()],
				{ stdio: ["pipe", "pipe", "pipe"] },
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
		return new Promise<string>((resolve, reject) => {
			this.pending = { resolve, reject };
			try {
				host.stdin.write(`c ${process.pid}\n`);
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
		if (!line || line === "0") return false;
		if (line === "F") return true;

		const bounds = parseProbeBounds(line);
		if (!bounds) return false;

		const display = screen.getDisplayMatching(bounds);
		return isNearFullscreenCover(bounds, display.bounds);
	}
}
