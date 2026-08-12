/**
 * Tag/CI macOS publish entry.
 *
 * Signing/notarize: when APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID
 * (and a signing identity / CSC_LINK) are set, electron-builder signs and notarizes.
 * Without those, builds stay unsigned so CI still packages successfully.
 *
 * Optional GitHub Actions secrets:
 *   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
 *   CSC_LINK / CSC_KEY_PASSWORD (or a keychain identity on the runner)
 */
import { spawnSync } from "node:child_process";

const hasAppleNotarize = Boolean(
	process.env.APPLE_ID?.trim() &&
		process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim() &&
		process.env.APPLE_TEAM_ID?.trim(),
);
const hasSigningIdentity = Boolean(
	process.env.CSC_LINK?.trim() || process.env.CSC_NAME?.trim(),
);

const macFlags = [];
if (!hasSigningIdentity) {
	macFlags.push("--config.mac.identity=null");
	console.warn(
		"[publish-mac] No CSC_LINK/CSC_NAME — packaging unsigned macOS build",
	);
} else {
	console.log("[publish-mac] Signing identity present — enabling macOS signing");
}

if (hasAppleNotarize && hasSigningIdentity) {
	macFlags.push("--config.mac.notarize=true");
	console.log("[publish-mac] Apple notarize credentials present — enabling notarize");
} else {
	macFlags.push("--config.mac.notarize=false");
	if (!hasAppleNotarize) {
		console.warn(
			"[publish-mac] Apple notarize secrets not set — skipping notarize",
		);
	}
}

const args = [
	"electron-builder",
	"--mac",
	...macFlags,
	"--publish",
	"always",
	"-c.publish.provider=github",
	"-c.publish.owner=xpogx-org",
	"-c.publish.repo=BlinkGuard",
	"-c.publish.releaseType=release",
];

const env = {
	...process.env,
	// Avoid auto-discovery failures on CI when no Developer ID is installed.
	...(hasSigningIdentity
		? {}
		: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }),
};

const tsc = spawnSync("npx", ["tsc"], { stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const vite = spawnSync("npx", ["vite", "build"], {
	stdio: "inherit",
	shell: true,
});
if (vite.status !== 0) process.exit(vite.status ?? 1);

const builder = spawnSync("npx", args, { stdio: "inherit", shell: true, env });
process.exit(builder.status ?? 1);
