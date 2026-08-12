/**
 * Electron-free GitHub Releases contract for About → Release notes.
 */

export const GITHUB_RELEASES_OWNER = "xpogx-org";
export const GITHUB_RELEASES_REPO = "BlinkGuard";

export const GITHUB_REPO_PAGE_URL =
	`https://github.com/${GITHUB_RELEASES_OWNER}/${GITHUB_RELEASES_REPO}`;

export const GITHUB_RELEASES_PAGE_URL = `${GITHUB_REPO_PAGE_URL}/releases`;

export const GITHUB_RELEASES_API_URL =
	`https://api.github.com/repos/${GITHUB_RELEASES_OWNER}/${GITHUB_RELEASES_REPO}/releases?per_page=20`;

export type ReleaseNotesEntry = {
	tagName: string;
	name: string;
	body: string;
	publishedAt: string | null;
	htmlUrl: string;
	prerelease: boolean;
};

export type GetReleaseNotesResult =
	| { status: "ok"; releases: ReleaseNotesEntry[] }
	| { status: "error"; message: string };

type GithubReleaseJson = {
	tag_name?: unknown;
	name?: unknown;
	body?: unknown;
	published_at?: unknown;
	html_url?: unknown;
	prerelease?: unknown;
	draft?: unknown;
};

export function mapGithubRelease(raw: unknown): ReleaseNotesEntry | null {
	if (!raw || typeof raw !== "object") return null;
	const release = raw as GithubReleaseJson;
	if (release.draft === true) return null;
	if (typeof release.tag_name !== "string" || !release.tag_name.trim()) {
		return null;
	}
	if (typeof release.html_url !== "string" || !release.html_url.trim()) {
		return null;
	}

	const tagName = release.tag_name.trim();
	const name =
		typeof release.name === "string" && release.name.trim()
			? release.name.trim()
			: tagName;
	const rawBody = typeof release.body === "string" ? release.body : "";
	const body = stripDuplicateReleaseHeading(rawBody, name, tagName);
	const publishedAt =
		typeof release.published_at === "string" && release.published_at.trim()
			? release.published_at
			: null;

	return {
		tagName,
		name,
		body,
		publishedAt,
		htmlUrl: release.html_url.trim(),
		prerelease: release.prerelease === true,
	};
}

/**
 * GitHub release bodies often repeat the release title as a leading `#` / `##`
 * heading. The UI already shows `name`, so drop that duplicate first heading.
 */
export function stripDuplicateReleaseHeading(
	body: string,
	name: string,
	tagName: string,
): string {
	const normalized = body.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
	const match = /^(#{1,3})\s+(.+?)\s*(?:\n+|$)/.exec(normalized);
	if (!match) return body;

	const headingText = (match[2] ?? "").trim();
	if (!isDuplicateReleaseTitle(headingText, name, tagName)) {
		return body;
	}

	return normalized.slice(match[0].length).replace(/^\n+/, "");
}

function isDuplicateReleaseTitle(
	headingText: string,
	name: string,
	tagName: string,
): boolean {
	const heading = normalizeReleaseTitle(headingText);
	if (!heading) return false;
	const candidates = [name, tagName, tagName.replace(/^v/i, "")];
	return candidates.some((candidate) => {
		const normalized = normalizeReleaseTitle(candidate);
		return normalized.length > 0 && normalized === heading;
	});
}

function normalizeReleaseTitle(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function mapGithubReleases(raw: unknown): ReleaseNotesEntry[] {
	if (!Array.isArray(raw)) return [];
	const releases: ReleaseNotesEntry[] = [];
	for (const item of raw) {
		const mapped = mapGithubRelease(item);
		if (mapped) releases.push(mapped);
	}
	return releases;
}

/** Allow only https URLs for in-app markdown / release links. */
export function isAllowedExternalUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:";
	} catch {
		return false;
	}
}
