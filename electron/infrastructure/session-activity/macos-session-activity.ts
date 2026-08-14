import { spawn } from "node:child_process";
import type { SessionActivitySnapshot } from "../../application/ports/session-activity-port";
import { HostedSessionActivity } from "./hosted-session-activity";

const HOST_SCRIPT = `
ObjC.import("Cocoa");
ObjC.import("Foundation");

function writeLine(s) {
  var data = $.NSString.alloc.initWithUTF8String(s + "\\n").dataUsingEncoding($.NSUTF8StringEncoding);
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(data);
}

function clamshellClosed() {
  var task = $.NSTask.alloc.init;
  task.launchPath = "/usr/sbin/ioreg";
  task.arguments = $.NSArray.arrayWithArray(["-r", "-k", "AppleClamshellState", "-d", "4"]);
  var pipe = $.NSPipe.pipe;
  task.standardOutput = pipe;
  task.standardError = $.NSPipe.pipe;
  task.launch;
  task.waitUntilExit;
  var data = pipe.fileHandleForReading.readDataToEndOfFile;
  var str = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding)) || "";
  return /AppleClamshellState"\\s*=\\s*Yes/.test(str);
}

var lastLid = null;
function pollLid() {
  var closed = clamshellClosed();
  if (lastLid === closed) return;
  lastLid = closed;
  writeLine(closed ? "l1" : "l0");
}

var nc = $.NSWorkspace.sharedWorkspace.notificationCenter;
nc.addObserverForNameObjectQueueUsingBlock(
  $.NSWorkspaceScreensDidSleepNotification,
  null,
  $.NSOperationQueue.mainQueue,
  function () { writeLine("d0"); }
);
nc.addObserverForNameObjectQueueUsingBlock(
  $.NSWorkspaceScreensDidWakeNotification,
  null,
  $.NSOperationQueue.mainQueue,
  function () { writeLine("d1"); }
);

pollLid();
$.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(2.0, true, function () {
  pollLid();
});

$.NSRunLoop.currentRunLoop.run;
`.trimStart();

/** macOS display-sleep (NSWorkspace) + lid (AppleClamshellState) probe. */
export class MacosSessionActivity extends HostedSessionActivity {
	constructor(onChange: (snapshot: SessionActivitySnapshot) => void) {
		super(
			onChange,
			"blinkguard-session-activity-host.jxa.js",
			HOST_SCRIPT,
			(scriptPath) =>
				spawn("osascript", ["-l", "JavaScript", scriptPath], {
					stdio: ["pipe", "pipe", "pipe"],
				}),
		);
	}
}
