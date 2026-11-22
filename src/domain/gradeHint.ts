export interface GradeHintState {
  discovered: boolean;
  shownCount: number;
  lastShownAt: number | null;
}

export const GRADE_HINT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
export const GRADE_HINT_MAX_REMINDERS = 3;

export const DEFAULT_GRADE_HINT_STATE: GradeHintState = {
  discovered: false,
  shownCount: 0,
  lastShownAt: null,
};

export function parseGradeHintState(raw: string | null): GradeHintState {
  if (!raw) return { ...DEFAULT_GRADE_HINT_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<GradeHintState>;
    const discovered = typeof parsed.discovered === 'boolean' ? parsed.discovered : false;
    const shownCount =
      typeof parsed.shownCount === 'number' &&
      Number.isInteger(parsed.shownCount) &&
      parsed.shownCount >= 0
        ? parsed.shownCount
        : 0;
    const lastShownAt =
      typeof parsed.lastShownAt === 'number' && Number.isFinite(parsed.lastShownAt)
        ? parsed.lastShownAt
        : null;
    return { discovered, shownCount, lastShownAt };
  } catch {
    return { ...DEFAULT_GRADE_HINT_STATE };
  }
}

export function shouldShowGradeHint(state: GradeHintState, now: number): boolean {
  if (state.discovered) return false;
  if (state.shownCount >= GRADE_HINT_MAX_REMINDERS) return false;
  if (state.lastShownAt === null) return true;
  return now - state.lastShownAt >= GRADE_HINT_COOLDOWN_MS;
}

export function recordGradeHintShown(state: GradeHintState, now: number): GradeHintState {
  return {
    ...state,
    shownCount: state.shownCount + 1,
    lastShownAt: now,
  };
}

export function markGradeHintDiscovered(state: GradeHintState): GradeHintState {
  return {
    ...state,
    discovered: true,
  };
}
