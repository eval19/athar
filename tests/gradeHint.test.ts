import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRADE_HINT_STATE,
  GRADE_HINT_COOLDOWN_MS,
  GRADE_HINT_MAX_REMINDERS,
  markGradeHintDiscovered,
  parseGradeHintState,
  recordGradeHintShown,
  shouldShowGradeHint,
} from '../src/domain/gradeHint';

describe('gradeHint cadence', () => {
  const T0 = 1_700_000_000_000;

  it('shows on the very first result visit when never discovered', () => {
    expect(shouldShowGradeHint(DEFAULT_GRADE_HINT_STATE, T0)).toBe(true);
  });

  it('respects the 3-day cooldown after being shown without discovery', () => {
    const afterFirst = recordGradeHintShown(DEFAULT_GRADE_HINT_STATE, T0);
    expect(afterFirst.shownCount).toBe(1);
    expect(afterFirst.lastShownAt).toBe(T0);

    // Same session / 1 hour later / just before 3 days -> quiet
    expect(shouldShowGradeHint(afterFirst, T0 + 60_000)).toBe(false);
    expect(shouldShowGradeHint(afterFirst, T0 + GRADE_HINT_COOLDOWN_MS - 1)).toBe(false);

    // Once 3 days pass -> gently reminds again
    expect(shouldShowGradeHint(afterFirst, T0 + GRADE_HINT_COOLDOWN_MS)).toBe(true);
  });

  it('retires politely after the maximum number of reminders', () => {
    let state = DEFAULT_GRADE_HINT_STATE;
    for (let i = 0; i < GRADE_HINT_MAX_REMINDERS; i++) {
      const now = T0 + i * GRADE_HINT_COOLDOWN_MS;
      expect(shouldShowGradeHint(state, now)).toBe(true);
      state = recordGradeHintShown(state, now);
    }

    // Even a month later, it never nags past the polite cap
    expect(shouldShowGradeHint(state, T0 + 30 * GRADE_HINT_COOLDOWN_MS)).toBe(false);
  });

  it('never shows again once the user opens any grade explanation', () => {
    const discovered = markGradeHintDiscovered(DEFAULT_GRADE_HINT_STATE);
    expect(discovered.discovered).toBe(true);
    expect(shouldShowGradeHint(discovered, T0)).toBe(false);
    expect(shouldShowGradeHint(discovered, T0 + 365 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('safely falls back to defaults on null or malformed stored JSON', () => {
    expect(parseGradeHintState(null)).toEqual(DEFAULT_GRADE_HINT_STATE);
    expect(parseGradeHintState('not-json')).toEqual(DEFAULT_GRADE_HINT_STATE);
    expect(parseGradeHintState('{"discovered":"yes","shownCount":-5}')).toEqual(
      DEFAULT_GRADE_HINT_STATE,
    );

    const parsed = parseGradeHintState(
      JSON.stringify({ discovered: false, shownCount: 2, lastShownAt: T0 }),
    );
    expect(parsed).toEqual({ discovered: false, shownCount: 2, lastShownAt: T0 });
  });
});
