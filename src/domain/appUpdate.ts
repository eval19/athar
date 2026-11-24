export const GITHUB_REPO_OWNER = 'eval19';
export const GITHUB_REPO_NAME = 'athar';
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const STABLE_SEMVER_PATTERN = /^v?(\d{1,5})\.(\d{1,5})\.(\d{1,5})$/;
const APK_DOWNLOAD_PATH_PATTERN = new RegExp(
  `^/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+\\.apk$`,
  'i',
);
const RELEASE_PAGE_PATH_PREFIX = `/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/`;

export interface AvailableUpdate {
  version: string;
  downloadUrl: string;
  releaseUrl: string;
}

export interface UpdateStorageState {
  lastCheckedAt: number;
  dismissedVersion: string | null;
  availableUpdate: AvailableUpdate | null;
}

export const EMPTY_UPDATE_STATE: UpdateStorageState = {
  lastCheckedAt: 0,
  dismissedVersion: null,
  availableUpdate: null,
};

/**
 * Parses strictly stable MAJOR.MINOR.PATCH tags (with optional leading "v").
 * Rejects pre-releases (e.g. v1.4.0-beta.1, v1.4.0-rc.1) and malformed strings.
 */
export function parseStableSemver(raw: string): [number, number, number] | null {
  const match = raw.trim().match(STABLE_SEMVER_PATTERN);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function formatNormalizedVersion(parts: readonly [number, number, number]): string {
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export function isNewerStableVersion(candidate: string, current: string): boolean {
  const candParts = parseStableSemver(candidate);
  const currParts = parseStableSemver(current);
  if (!candParts || !currParts) return false;

  for (let i = 0; i < 3; i++) {
    if (candParts[i] !== currParts[i]) {
      return candParts[i] > currParts[i];
    }
  }
  return false;
}

export function isAllowedReleasePageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname.startsWith(RELEASE_PAGE_PATH_PREFIX) &&
      !parsed.pathname.includes('..')
    );
  } catch {
    return false;
  }
}

export function isAllowedApkDownloadUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      !parsed.username &&
      !parsed.password &&
      APK_DOWNLOAD_PATH_PATTERN.test(parsed.pathname) &&
      !parsed.pathname.includes('..')
    );
  } catch {
    return false;
  }
}

interface RawGitHubAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

interface RawGitHubRelease {
  tag_name?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  html_url?: unknown;
  assets?: unknown;
}

/**
 * Extracts a verified stable update from GitHub's /releases/latest JSON payload.
 * Returns null if the release is a draft/prerelease, not newer than currentVersion,
 * or lacks valid GitHub release URLs.
 */
export function parseGitHubLatestRelease(
  payload: unknown,
  currentVersion: string,
): AvailableUpdate | null {
  if (!payload || typeof payload !== 'object') return null;
  const rel = payload as RawGitHubRelease;

  if (rel.draft === true || rel.prerelease === true) return null;
  if (typeof rel.tag_name !== 'string') return null;

  const parsedParts = parseStableSemver(rel.tag_name);
  if (!parsedParts) return null;

  const version = formatNormalizedVersion(parsedParts);
  if (!isNewerStableVersion(version, currentVersion)) return null;

  const defaultReleaseUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/tag/v${version}`;
  const releaseUrl =
    typeof rel.html_url === 'string' && isAllowedReleasePageUrl(rel.html_url)
      ? rel.html_url
      : defaultReleaseUrl;

  let apkUrl: string | null = null;
  if (Array.isArray(rel.assets)) {
    const validAssets: Array<{ name: string; url: string }> = [];
    for (const item of rel.assets) {
      if (!item || typeof item !== 'object') continue;
      const asset = item as RawGitHubAsset;
      if (
        typeof asset.name === 'string' &&
        typeof asset.browser_download_url === 'string' &&
        isAllowedApkDownloadUrl(asset.browser_download_url)
      ) {
        validAssets.push({ name: asset.name, url: asset.browser_download_url });
      }
    }

    const preferred = validAssets.find((a) => a.name.toLowerCase().startsWith('athar-'));
    apkUrl = preferred?.url ?? validAssets[0]?.url ?? null;
  }

  return {
    version,
    downloadUrl: apkUrl ?? releaseUrl,
    releaseUrl,
  };
}

export function shouldCheckForUpdates(
  state: UpdateStorageState,
  nowMs: number,
): boolean {
  if (state.lastCheckedAt <= 0) return true;
  return nowMs - state.lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS;
}

export function getSettingsUpdate(
  state: UpdateStorageState,
  currentVersion: string,
): AvailableUpdate | null {
  const upd = state.availableUpdate;
  if (!upd) return null;
  if (!isNewerStableVersion(upd.version, currentVersion)) return null;
  return upd;
}

export function getVisibleLandingUpdate(
  state: UpdateStorageState,
  currentVersion: string,
): AvailableUpdate | null {
  const upd = getSettingsUpdate(state, currentVersion);
  if (!upd) return null;
  if (state.dismissedVersion === upd.version) return null;
  return upd;
}

export function parseUpdateStorageState(raw: string | null): UpdateStorageState {
  if (!raw) return { ...EMPTY_UPDATE_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<UpdateStorageState>;
    const lastCheckedAt =
      typeof parsed.lastCheckedAt === 'number' &&
      Number.isFinite(parsed.lastCheckedAt) &&
      parsed.lastCheckedAt >= 0
        ? parsed.lastCheckedAt
        : 0;

    const dismissedVersion =
      typeof parsed.dismissedVersion === 'string' &&
      parseStableSemver(parsed.dismissedVersion)
        ? parsed.dismissedVersion
        : null;

    let availableUpdate: AvailableUpdate | null = null;
    const rawUpd = parsed.availableUpdate;
    if (
      rawUpd &&
      typeof rawUpd === 'object' &&
      typeof rawUpd.version === 'string' &&
      parseStableSemver(rawUpd.version) &&
      typeof rawUpd.downloadUrl === 'string' &&
      typeof rawUpd.releaseUrl === 'string' &&
      (isAllowedApkDownloadUrl(rawUpd.downloadUrl) ||
        isAllowedReleasePageUrl(rawUpd.downloadUrl)) &&
      isAllowedReleasePageUrl(rawUpd.releaseUrl)
    ) {
      availableUpdate = {
        version: formatNormalizedVersion(parseStableSemver(rawUpd.version)!),
        downloadUrl: rawUpd.downloadUrl,
        releaseUrl: rawUpd.releaseUrl,
      };
    }

    return { lastCheckedAt, dismissedVersion, availableUpdate };
  } catch {
    return { ...EMPTY_UPDATE_STATE };
  }
}
