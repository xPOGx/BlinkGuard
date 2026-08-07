import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cleanDmg = process.argv.includes("--clean-dmg");

if (process.platform !== "darwin") {
	console.log("Skipping quarantine removal (macOS only).");
	process.exit(0);
}

console.log("Removing quarantine attributes from built files...");

const distPath = path.join(__dirname, "..", "dist");

function findAppFiles(dir) {
	const files = [];
	if (!fs.existsSync(dir)) {
		return files;
	}
	for (const item of fs.readdirSync(dir)) {
		const fullPath = path.join(dir, item);
		const stat = fs.statSync(fullPath);
		if (stat.isDirectory() && item.endsWith(".app")) {
			files.push(fullPath);
		} else if (stat.isDirectory()) {
			files.push(...findAppFiles(fullPath));
		}
	}
	return files;
}

function findDmgFiles(dir) {
	const files = [];
	if (!fs.existsSync(dir)) {
		return files;
	}
	for (const item of fs.readdirSync(dir)) {
		const fullPath = path.join(dir, item);
		const stat = fs.statSync(fullPath);
		if (stat.isFile() && item.endsWith(".dmg")) {
			files.push(fullPath);
		}
	}
	return files;
}

try {
	const appFiles = findAppFiles(distPath);
	if (appFiles.length === 0 && !(cleanDmg && findDmgFiles(distPath).length > 0)) {
		console.log("No .app or .dmg files found in dist/; nothing to clean.");
		process.exit(0);
	}

	for (const appFile of appFiles) {
		console.log(`Removing quarantine from: ${appFile}`);
		execSync(`xattr -rd com.apple.quarantine "${appFile}"`, { stdio: "inherit" });
	}

	if (cleanDmg) {
		for (const dmgFile of findDmgFiles(distPath)) {
			console.log(`Removing quarantine from: ${dmgFile}`);
			execSync(`xattr -rd com.apple.quarantine "${dmgFile}"`, { stdio: "inherit" });
		}
	}

	console.log("Quarantine attributes removed successfully.");

	if (!cleanDmg) {
		console.log("\nOptional: npm run remove-quarantine:dmg to also clean .dmg files.");
	} else {
		console.log("\nInstructions for users:");
		console.log('1. Right-click on the .app file and select "Open"');
		console.log('2. Click "Open" in the security dialog that appears');
		console.log("3. The app will now open normally on subsequent launches");
	}
} catch (error) {
	console.error("Error removing quarantine attributes:", error.message);
	console.log("\nAlternative instructions for users:");
	console.log('1. Right-click on the .app file and select "Open"');
	console.log('2. Click "Open" in the security dialog that appears');
	console.log("3. Or run: xattr -rd com.apple.quarantine /path/to/BlinkGuard.app");
	process.exit(0);
}
