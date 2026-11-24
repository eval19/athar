export interface ScrollHeaderState {
  hidden: boolean;
  lastY: number;
  accumulatedDelta: number;
}

export interface ScrollMetrics {
  scrollY: number;
  viewportHeight: number;
  documentHeight: number;
  hideAfterY?: number;
}

export const HEADER_TOP_LOCK_Y = 16;
export const HEADER_HIDE_DELTA_PX = 16;
export const HEADER_REVEAL_DELTA_PX = 24;
export const HEADER_DEFAULT_HIDE_AFTER_Y = 72;
export const HEADER_BOTTOM_BOUNCE_MARGIN_PX = 12;

export function createScrollHeaderState(initialY = 0): ScrollHeaderState {
  return {
    hidden: false,
    lastY: Math.max(0, initialY),
    accumulatedDelta: 0,
  };
}

/**
 * Pure headroom-style scroll state machine for Athar's top header row:
 * - Always visible near the top of the page (<= HEADER_TOP_LOCK_Y)
 * - Hides after scrolling down past the header height by >= HEADER_HIDE_DELTA_PX
 * - Reveals smoothly anywhere down the page on a small upward scroll (>= HEADER_REVEAL_DELTA_PX)
 * - Ignores tiny thumb jitter and rubber-band overscroll bounce at the very bottom
 */
export function stepScrollHeader(
  state: ScrollHeaderState,
  metrics: ScrollMetrics,
): ScrollHeaderState {
  const y = Math.max(0, metrics.scrollY);

  if (y <= HEADER_TOP_LOCK_Y) {
    if (!state.hidden && state.lastY === y && state.accumulatedDelta === 0) {
      return state;
    }
    return {
      hidden: false,
      lastY: y,
      accumulatedDelta: 0,
    };
  }

  const delta = y - state.lastY;
  if (delta === 0) return state;

  const isScrollable = metrics.documentHeight > metrics.viewportHeight;
  const atBottom =
    isScrollable &&
    y + metrics.viewportHeight >= metrics.documentHeight - HEADER_BOTTOM_BOUNCE_MARGIN_PX;

  // Prevent bottom rubber-band bounce from unexpectedly revealing a hidden header
  if (state.hidden && atBottom && delta < 0) {
    return {
      hidden: true,
      lastY: y,
      accumulatedDelta: 0,
    };
  }

  const sameDirection =
    state.accumulatedDelta === 0 ||
    Math.sign(delta) === Math.sign(state.accumulatedDelta);
  const nextDelta = sameDirection ? state.accumulatedDelta + delta : delta;
  const hideAfterY = Math.max(
    HEADER_TOP_LOCK_Y,
    metrics.hideAfterY ?? HEADER_DEFAULT_HIDE_AFTER_Y,
  );

  if (!state.hidden && nextDelta >= HEADER_HIDE_DELTA_PX && y > hideAfterY) {
    return {
      hidden: true,
      lastY: y,
      accumulatedDelta: 0,
    };
  }

  if (state.hidden && nextDelta <= -HEADER_REVEAL_DELTA_PX) {
    return {
      hidden: false,
      lastY: y,
      accumulatedDelta: 0,
    };
  }

  return {
    hidden: state.hidden,
    lastY: y,
    accumulatedDelta: nextDelta,
  };
}
