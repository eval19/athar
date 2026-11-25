import { describe, expect, it } from 'vitest';
import type { HadithResult } from '../src/domain/hadith';
import {
  createTabSession,
  getTabSnapshot,
  resetTabScroll,
  saveTabSnapshot,
  type FilterTabSnapshot,
} from '../src/domain/tabSession';

function makeHadith(id: string): HadithResult {
  return {
    id,
    text: `نص حديث ${id}`,
    narrator: 'أبو هريرة',
    muhaddith: 'البخاري',
    source: 'صحيح البخاري',
    pageOrNumber: '1',
    rawGrade: 'صحيح',
    gradeBucket: 'sahih',
  };
}

function makeSnapshot(overrides: Partial<FilterTabSnapshot> = {}): FilterTabSnapshot {
  return {
    items: [makeHadith('h1'), makeHadith('h2')],
    page: 1,
    hasMore: true,
    effectiveQuery: 'الرحمة',
    suggestions: [],
    scrollY: 1240,
    ...overrides,
  };
}

describe('tabSession', () => {
  it('returns null for unseen tabs so first open always starts from top', () => {
    let store = createTabSession('الرحمة');
    store = saveTabSnapshot(store, 'الرحمة', 'sahih', makeSnapshot({ scrollY: 2400 }));

    expect(getTabSnapshot(store, 'الرحمة', 'weak')).toBeNull();
    expect(getTabSnapshot(store, 'الرحمة', 'hasan')).toBeNull();
    expect(getTabSnapshot(store, 'الرحمة', 'all')).toBeNull();
  });

  it('saves and restores independent scroll position and loaded pages per tab', () => {
    let store = createTabSession('الرحمة');
    store = saveTabSnapshot(
      store,
      'الرحمة',
      'sahih',
      makeSnapshot({ page: 2, scrollY: 2450.7 }),
    );
    store = saveTabSnapshot(
      store,
      'الرحمة',
      'weak',
      makeSnapshot({ items: [makeHadith('w1')], page: 1, scrollY: 640.2 }),
    );

    const sahih = getTabSnapshot(store, '  الرحمة  ', 'sahih');
    const weak = getTabSnapshot(store, 'الرحمة', 'weak');

    expect(sahih?.scrollY).toBe(2451);
    expect(sahih?.page).toBe(2);
    expect(weak?.scrollY).toBe(640);
    expect(weak?.items.map((i) => i.id)).toEqual(['w1']);
  });

  it('clears previous query snapshots when saving under a different query', () => {
    let store = createTabSession('الرحمة');
    store = saveTabSnapshot(store, 'الرحمة', 'sahih', makeSnapshot({ scrollY: 1800 }));

    expect(getTabSnapshot(store, 'الصلاة', 'sahih')).toBeNull();

    store = saveTabSnapshot(
      store,
      'الصلاة',
      'all',
      makeSnapshot({ effectiveQuery: 'الصلاة', scrollY: 320 }),
    );

    expect(getTabSnapshot(store, 'الرحمة', 'sahih')).toBeNull();
    expect(getTabSnapshot(store, 'الصلاة', 'sahih')).toBeNull();
    expect(getTabSnapshot(store, 'الصلاة', 'all')?.scrollY).toBe(320);
  });

  it('clamps negative scrollY values to 0 and ignores queries shorter than 2 chars', () => {
    let store = createTabSession('الرحمة');
    store = saveTabSnapshot(store, 'الرحمة', 'sahih', makeSnapshot({ scrollY: -45 }));
    expect(getTabSnapshot(store, 'الرحمة', 'sahih')?.scrollY).toBe(0);

    const unchanged = saveTabSnapshot(store, 'ا', 'weak', makeSnapshot({ scrollY: 300 }));
    expect(unchanged).toBe(store);
    expect(getTabSnapshot(store, 'ا', 'sahih')).toBeNull();
  });

  it('resets a single tab scroll position to 0 when tapping the active tab to jump to top', () => {
    let store = createTabSession('الرحمة');
    store = saveTabSnapshot(store, 'الرحمة', 'sahih', makeSnapshot({ scrollY: 1900 }));
    store = saveTabSnapshot(store, 'الرحمة', 'weak', makeSnapshot({ scrollY: 750 }));

    store = resetTabScroll(store, 'sahih');

    expect(getTabSnapshot(store, 'الرحمة', 'sahih')?.scrollY).toBe(0);
    expect(getTabSnapshot(store, 'الرحمة', 'weak')?.scrollY).toBe(750);
  });
});
