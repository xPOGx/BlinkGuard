import path from "node:path";

export interface AppPaths {
	root: string;
	mainDist: string;
	rendererDist: string;
	publicDir: string;
	preload: string;
}

export function configureAppPaths(
	entryDirectory: string,
	devServerUrl: string | undefined,
): AppPaths {
	const root = path.join(entryDirectory, "..");
	const rendererDist = path.join(root, "dist");
	const mainDist = path.join(root, "dist-electron");
	const publicDir = devServerUrl ? path.join(root, "public") : rendererDist;

	process.env.APP_ROOT = root;
	process.env.VITE_PUBLIC = publicDir;

	return {
		root,
		mainDist,
		rendererDist,
		publicDir,
		preload: path.join(entryDirectory, "preload.mjs"),
	};
}
