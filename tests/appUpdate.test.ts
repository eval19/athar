import { describe, expect, it, vi } from 'vitest';
import {
  EMPTY_UPDATE_STATE,
  getSettingsUpdate,
  getVisibleLandingUpdate,
  isAllowedApkDownloadUrl,
  isAllowedReleasePageUrl,
  isNewerStableVersion,
  parseGitHubLatestRelease,
  parseStableSemver,
  parseUpdateStorageState,
  shouldCheckForUpdates,
  UPDATE_CHECK_INTERVAL_MS,
} from '../src/domain/appUpdate';
import {
  assertAllowedGitHubApiUrl,
  checkForAppUpdate,
} from '../src/services/updateChecker';

describe('appUpdate', () => {
  it('parses strictly stable MAJOR.MINOR.PATCH versions and rejects pre-releases', () => {
    expect(parseStableSemver('v1.4.0')).toEqual([1, 4, 0]);
    expect(parseStableSemver('1.3.2')).toEqual([1, 3, 2]);
    expect(parseStableSemver('v1.4.0-beta.1')).toBeNull();
    expect(parseStableSemver('v1.4.0-rc.1')).toBeNull();
    expect(parseStableSemver('1.4.0-alpha')).toBeNull();
    expect(parseStableSemver('v1.4')).toBeNull();
    expect(parseStableSemver('latest')).toBeNull();
  });

  it('compares stable semver versions accurately', () => {
    expect(isNewerStableVersion('v1.4.0', '1.3.0')).toBe(true);
    expect(isNewerStableVersion('v1.3.1', '1.3.0')).toBe(true);
    expect(isNewerStableVersion('v2.0.0', '1.9.9')).toBe(true);
    expect(isNewerStableVersion('v1.3.0', '1.3.0')).toBe(false);
    expect(isNewerStableVersion('v1.2.9', '1.3.0')).toBe(false);
    expect(isNewerStableVersion('v1.4.0-beta.1', '1.3.0')).toBe(false);
  });

  it('extracts direct APK download URL from a newer stable GitHub release', () => {
    const payload = {
      tag_name: 'v1.4.0',
      draft: false,
      prerelease: false,
      html_url: 'https://github.com/eval19/athar/releases/tag/v1.4.0',
      assets: [
        {
          name: 'notes.txt',
          browser_download_url:
            'https://github.com/eval19/athar/releases/download/v1.4.0/notes.txt',
        },
        {
          name: 'athar-v1.4.0-android.apk',
          browser_download_url:
            'https://github.com/eval19/athar/releases/download/v1.4.0/athar-v1.4.0-android.apk',
        },
      ],
    };

    const parsed = parseGitHubLatestRelease(payload, '1.3.0');
    expect(parsed).toEqual({
      version: '1.4.0',
      downloadUrl:
        'https://github.com/eval19/athar/releases/download/v1.4.0/athar-v1.4.0-android.apk',
      releaseUrl: 'https://github.com/eval19/athar/releases/tag/v1.4.0',
    });
  });

  it('ignores draft releases, pre-releases, and pre-release tag names', () => {
    const base = {
      tag_name: 'v1.4.0',
      draft: false,
      prerelease: false,
      html_url: 'https://github.com/eval19/athar/releases/tag/v1.4.0',
      assets: [],
    };

    expect(parseGitHubLatestRelease({ ...base, draft: true }, '1.3.0')).toBeNull();
    expect(parseGitHubLatestRelease({ ...base, prerelease: true }, '1.3.0')).toBeNull();
    expect(
      parseGitHubLatestRelease({ ...base, tag_name: 'v1.4.0-rc.1' }, '1.3.0'),
    ).toBeNull();
  });

  it('rejects untrusted or non-GitHub APK URLs and falls back safely to release page', () => {
    expect(
      isAllowedApkDownloadUrl(
        'https://github.com/eval19/athar/releases/download/v1.4.0/athar-v1.4.0-android.apk',
      ),
    ).toBe(true);
    expect(isAllowedApkDownloadUrl('https://evil.example/athar.apk')).toBe(false);
    expect(
      isAllowedApkDownloadUrl(
        'https://github.com/other/athar/releases/download/v1.4.0/athar.apk',
      ),
    ).toBe(false);
    expect(
      isAllowedApkDownloadUrl(
        'http://github.com/eval19/athar/releases/download/v1.4.0/athar.apk',
      ),
    ).toBe(false);
    expect(isAllowedReleasePageUrl('javascript:alert(1)')).toBe(false);

    const spoofedPayload = {
      tag_name: 'v1.4.0',
      draft: false,
      prerelease: false,
      html_url: 'https://evil.example/phish',
      assets: [
        {
          name: 'athar-v1.4.0-android.apk',
          browser_download_url: 'https://evil.example/fake.apk',
        },
      ],
    };

    const parsed = parseGitHubLatestRelease(spoofedPayload, '1.3.0');
    expect(parsed).toEqual({
      version: '1.4.0',
      downloadUrl: 'https://github.com/eval19/athar/releases/tag/v1.4.0',
      releaseUrl: 'https://github.com/eval19/athar/releases/tag/v1.4.0',
    });
  });

  it('enforces 24-hour cooldown and per-version landing dismissal', () => {
    const now = 1_700_000_000_000;
    expect(shouldCheckForUpdates(EMPTY_UPDATE_STATE, now)).toBe(true);

    const recent = { ...EMPTY_UPDATE_STATE, lastCheckedAt: now - 1000 };
    expect(shouldCheckForUpdates(recent, now)).toBe(false);

    const stale = {
      ...EMPTY_UPDATE_STATE,
      lastCheckedAt: now - UPDATE_CHECK_INTERVAL_MS,
    };
    expect(shouldCheckForUpdates(stale, now)).toBe(true);

    const update = {
      version: '1.4.0',
      downloadUrl:
        'https://github.com/eval19/athar/releases/download/v1.4.0/athar-v1.4.0-android.apk',
      releaseUrl: 'https://github.com/eval19/athar/releases/tag/v1.4.0',
    };

    const dismissedState = {
      lastCheckedAt: now,
      dismissedVersion: '1.4.0',
      availableUpdate: update,
    };
    expect(getVisibleLandingUpdate(dismissedState, '1.3.0')).toBeNull();
    expect(getSettingsUpdate(dismissedState, '1.3.0')).toEqual(update);

    // Once user upgrades to 1.4.0, both landing & settings hide the banner
    expect(getSettingsUpdate(dismissedState, '1.4.0')).toBeNull();

    // A newer 1.5.0 release re-appears on landing even though 1.4.0 was dismissed
    const newerState = {
      lastCheckedAt: now,
      dismissedVersion: '1.4.0',
      availableUpdate: { ...update, version: '1.5.0' },
    };
    expect(getVisibleLandingUpdate(newerState, '1.3.0')?.version).toBe('1.5.0');
  });

  it('strips tampered untrusted URLs when hydrating localStorage state', () => {
    const tampered = JSON.stringify({
      lastCheckedAt: 1000,
      dismissedVersion: null,
      availableUpdate: {
        version: '1.4.0',
        downloadUrl: 'https://attacker.example/malware.apk',
        releaseUrl: 'https://attacker.example/',
      },
    });

    const parsed = parseUpdateStorageState(tampered);
    expect(parsed.availableUpdate).toBeNull();
  });

  it('allowlists only the official GitHub releases API URL and fails silently on network error', async () => {
    expect(() =>
      assertAllowedGitHubApiUrl('https://api.github.com/repos/eval19/athar/releases/latest'),
    ).not.toThrow();
    expect(() =>
      assertAllowedGitHubApiUrl('https://api.github.com/repos/other/athar/releases/latest'),
    ).toThrow();
    expect(() =>
      assertAllowedGitHubApiUrl('http://api.github.com/repos/eval19/athar/releases/latest'),
    ).toThrow();
    expect(() => assertAllowedGitHubApiUrl('https://evil.example/latest')).toThrow();

    const failingFetcher = vi.fn(async () => {
      throw new Error('offline');
    });
    const res = await checkForAppUpdate({
      force: true,
      currentVersion: '1.3.0',
      fetcher: failingFetcher,
    });
    expect(res.status).toBe('error');
    expect(res.state.availableUpdate).toBeNull();
  });
});
