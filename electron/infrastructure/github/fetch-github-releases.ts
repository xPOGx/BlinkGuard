import { net } from "electron";
import {
	GITHUB_RELEASES_API_URL,
	mapGithubReleases,
	type GetReleaseNotesResult,
} from "../../../shared/release-notes";

const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = {
	expiresAt: number;
	result: GetReleaseNotesResult;
};

let cache: CacheEntry | null = null;

export type FetchGithubReleasesOptions = {
	/** Injected for tests; defaults to Electron `net.fetch`. */
	fetchImpl?: typeof fetch;
	/** Bypass in-memory cache. */
	forceRefresh?: boolean;
	now?: () => number;
};

export async function fetchGithubReleases(
	options: FetchGithubReleasesOptions = {},
): Promise<GetReleaseNotesResult> {
	const now = options.now?.() ?? Date.now();
	if (!options.forceRefresh && cache && cache.expiresAt > now) {
		return cache.result;
	}

	const fetchImpl = options.fetchImpl ?? net.fetch.bind(net);

	try {
		const response = await fetchImpl(GITHUB_RELEASES_API_URL, {
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "BlinkGuard",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});

		if (!response.ok) {
			const result: GetReleaseNotesResult = {
				status: "error",
				message: `GitHub returned ${response.status}`,
			};
			return result;
		}

		const json: unknown = await response.json();
		const releases = mapGithubReleases(json);
		const result: GetReleaseNotesResult = { status: "ok", releases };
		cache = { expiresAt: now + CACHE_TTL_MS, result };
		return result;
	} catch (error) {
		return {
			status: "error",
			message: error instanceof Error ? error.message : String(error),
		};
	}
}

/** Test helper — clears the 15-minute in-memory cache. */
export function clearGithubReleasesCache(): void {
	cache = null;
}
