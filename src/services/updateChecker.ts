import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  type AvailableUpdate,
  GITHUB_REPO_NAME,
  GITHUB_REPO_OWNER,
  LATEST_RELEASE_API_URL,
  parseGitHubLatestRelease,
  shouldCheckForUpdates,
  type UpdateStorageState,
} from '../domain/appUpdate';
import { loadUpdateState, saveUpdateState } from './preferences';
import { desktopFetch, isTauriDesktop } from './desktopBridge';

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0
    ? __APP_VERSION__
    : '1.3.0';

const MAX_RELEASE_JSON_CHARS = 65_536;
const UPDATE_FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_API_PREFIX = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;

export type UpdateCheckOutcome =
  | { status: 'cached'; state: UpdateStorageState }
  | { status: 'update-available'; state: UpdateStorageState }
  | { status: 'up-to-date'; state: UpdateStorageState }
  | { status: 'error'; state: UpdateStorageState };

export function assertAllowedGitHubApiUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Blocked invalid update API URL');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'api.github.com' ||
    !parsed.pathname.startsWith(ALLOWED_API_PREFIX)
  ) {
    throw new Error('Blocked disallowed update API host');
  }
}

async function fetchLatestReleaseJson(): Promise<unknown> {
  assertAllowedGitHubApiUrl(LATEST_RELEASE_API_URL);

  if (isTauriDesktop()) {
    const text = await desktopFetch(LATEST_RELEASE_API_URL, {
      accept: 'application/vnd.github+json',
      maxBytes: MAX_RELEASE_JSON_CHARS,
    });
    if (text.length > MAX_RELEASE_JSON_CHARS) {
      throw new Error('Update response too large');
    }
    return JSON.parse(text) as unknown;
  }

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url: LATEST_RELEASE_API_URL,
      headers: {
        Accept: 'application/vnd.github+json',
      },
      connectTimeout: 8000,
      readTimeout: UPDATE_FETCH_TIMEOUT_MS,
    });
    if (response.url) {
      assertAllowedGitHubApiUrl(response.url);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Update API status ${response.status}`);
    }
    if (typeof response.data === 'string') {
      if (response.data.length > MAX_RELEASE_JSON_CHARS) {
        throw new Error('Update response too large');
      }
      return JSON.parse(response.data) as unknown;
    }
    const serialized = JSON.stringify(response.data);
    if (serialized.length > MAX_RELEASE_JSON_CHARS) {
      throw new Error('Update response too large');
    }
    return response.data as unknown;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    UPDATE_FETCH_TIMEOUT_MS,
  );
  try {
    const res = await fetch(LATEST_RELEASE_API_URL, {
      method: 'GET',
      signal: controller.signal,
      referrerPolicy: 'no-referrer',
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });
    if (res.url) {
      assertAllowedGitHubApiUrl(res.url);
    }
    if (!res.ok) {
      throw new Error(`Update API status ${res.status}`);
    }
    const text = await res.text();
    if (text.length > MAX_RELEASE_JSON_CHARS) {
      throw new Error('Update response too large');
    }
    return JSON.parse(text) as unknown;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function checkForAppUpdate(options?: {
  force?: boolean;
  currentVersion?: string;
  nowMs?: number;
  fetcher?: () => Promise<unknown>;
}): Promise<UpdateCheckOutcome> {
  const nowMs = options?.nowMs ?? Date.now();
  const currentVersion = options?.currentVersion ?? APP_VERSION;
  const stored = loadUpdateState();

  if (!options?.force && !shouldCheckForUpdates(stored, nowMs)) {
    return { status: 'cached', state: stored };
  }

  try {
    const payload = await (options?.fetcher ?? fetchLatestReleaseJson)();
    const availableUpdate: AvailableUpdate | null = parseGitHubLatestRelease(
      payload,
      currentVersion,
    );
    const nextState: UpdateStorageState = {
      lastCheckedAt: nowMs,
      dismissedVersion: stored.dismissedVersion,
      availableUpdate,
    };
    saveUpdateState(nextState);
    return {
      status: availableUpdate ? 'update-available' : 'up-to-date',
      state: nextState,
    };
  } catch {
    return { status: 'error', state: stored };
  }
}

export function dismissLandingUpdate(version: string): UpdateStorageState {
  const current = loadUpdateState();
  const next: UpdateStorageState = {
    ...current,
    dismissedVersion: version,
  };
  saveUpdateState(next);
  return next;
}
