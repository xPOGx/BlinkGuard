/**
 * Tag/CI Windows publish entry.
 *
 * Signing: when CSC_LINK (+ CSC_KEY_PASSWORD if required) is set, electron-builder
 * signs the executable. Without those secrets, builds stay unsigned
 * (signAndEditExecutable=false) so CI still packages successfully.
 *
 * Optional GitHub Actions secrets for signed releases:
 *   CSC_LINK              — base64 or file path to .pfx / code-signing cert
 *   CSC_KEY_PASSWORD      — certificate password
 * macOS notarize (build.yml mac job), if used:
 *   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
 */
import { spawnSync } from "node:child_process";

const hasSigningCert = Boolean(process.env.CSC_LINK?.trim());
const signFlag = hasSigningCert
	? "--config.win.signAndEditExecutable=true"
	: "--config.win.signAndEditExecutable=false";

if (!hasSigningCert) {
	console.warn(
		"[publish-windows] CSC_LINK not set — packaging unsigned Windows build",
	);
} else {
	console.log("[publish-windows] CSC_LINK present — enabling Windows signing");
}

const args = [
	"electron-builder",
	"--win",
	signFlag,
	"--publish",
	"always",
	"-c.publish.provider=github",
	"-c.publish.owner=xPOGx",
	"-c.publish.repo=BlinkGuard",
	"-c.publish.releaseType=release",
];

const tsc = spawnSync("npx", ["tsc"], { stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const vite = spawnSync("npx", ["vite", "build"], {
	stdio: "inherit",
	shell: true,
});
if (vite.status !== 0) process.exit(vite.status ?? 1);

const builder = spawnSync("npx", args, { stdio: "inherit", shell: true });
process.exit(builder.status ?? 1);
