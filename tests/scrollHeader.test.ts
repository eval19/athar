import { describe, expect, it } from 'vitest';
import {
  createScrollHeaderState,
  HEADER_DEFAULT_HIDE_AFTER_Y,
  HEADER_HIDE_DELTA_PX,
  HEADER_REVEAL_DELTA_PX,
  HEADER_TOP_LOCK_Y,
  stepScrollHeader,
} from '../src/domain/scrollHeader';

const VIEWPORT = 800;
const DOC_HEIGHT = 3200;

function scrollTo(state: ReturnType<typeof createScrollHeaderState>, scrollY: number) {
  return stepScrollHeader(state, {
    scrollY,
    viewportHeight: VIEWPORT,
    documentHeight: DOC_HEIGHT,
  });
}

describe('scrollHeader', () => {
  it('stays visible at the top and while scrolling within the initial header zone', () => {
    let state = createScrollHeaderState(0);
    state = scrollTo(state, 30);
    expect(state.hidden).toBe(false);

    state = scrollTo(state, HEADER_DEFAULT_HIDE_AFTER_Y);
    expect(state.hidden).toBe(false);
  });

  it('hides once the user scrolls down past the header threshold', () => {
    let state = createScrollHeaderState(0);
    state = scrollTo(state, 60);
    expect(state.hidden).toBe(false);

    state = scrollTo(state, 96);
    expect(state.hidden).toBe(true);
  });

  it('reveals from deep down the list on a small upward scroll across multiple frames', () => {
    let state = createScrollHeaderState(0);
    state = scrollTo(state, 1400);
    expect(state.hidden).toBe(true);

    // Small smooth upward drag totaling > HEADER_REVEAL_DELTA_PX (24px)
    state = scrollTo(state, 1392);
    expect(state.hidden).toBe(true);

    state = scrollTo(state, 1383);
    expect(state.hidden).toBe(true);

    state = scrollTo(state, 1374);
    expect(state.hidden).toBe(false);
  });

  it('ignores tiny accidental upward jitter below the reveal threshold', () => {
    let state = createScrollHeaderState(0);
    state = scrollTo(state, 1200);
    expect(state.hidden).toBe(true);

    state = scrollTo(state, 1200 - (HEADER_REVEAL_DELTA_PX - 6));
    expect(state.hidden).toBe(true);

    // Resuming downward scroll resets the upward delta cleanly
    state = scrollTo(state, 1210);
    expect(state.hidden).toBe(true);
  });

  it('re-hides cleanly when scrolling down again after revealing mid-page', () => {
    let state = createScrollHeaderState(0);
    state = scrollTo(state, 1500);
    expect(state.hidden).toBe(true);

    state = scrollTo(state, 1460);
    expect(state.hidden).toBe(false);

    state = scrollTo(state, 1460 + HEADER_HIDE_DELTA_PX - 4);
    expect(state.hidden).toBe(false);

    state = scrollTo(state, 1460 + HEADER_HIDE_DELTA_PX + 2);
    expect(state.hidden).toBe(true);
  });

  it('always reveals when returning to the top lock zone, even on a tiny final delta', () => {
    let state = createScrollHeaderState(0);
    state = scrollTo(state, 500);
    expect(state.hidden).toBe(true);

    // Jump straight near top, then cross into top lock zone by just 8px
    state = { hidden: true, lastY: HEADER_TOP_LOCK_Y + 6, accumulatedDelta: 0 };
    state = scrollTo(state, HEADER_TOP_LOCK_Y - 2);
    expect(state.hidden).toBe(false);
  });

  it('guards against bottom rubber-band bounce while still revealing on intentional scroll-up', () => {
    const maxScroll = DOC_HEIGHT - VIEWPORT; // 2400
    let state = createScrollHeaderState(0);
    state = scrollTo(state, maxScroll);
    expect(state.hidden).toBe(true);

    // Tiny bounce inside the 12px bottom margin should NOT pop the header open
    state = scrollTo(state, maxScroll - 8);
    expect(state.hidden).toBe(true);

    // Pulling intentionally up past the bounce strip + reveal threshold reveals it
    state = scrollTo(state, maxScroll - 48);
    expect(state.hidden).toBe(false);
  });

  it('clamps negative elastic overscroll at the top to visible', () => {
    let state = createScrollHeaderState(0);
    state = scrollTo(state, -24);
    expect(state.hidden).toBe(false);
    expect(state.lastY).toBe(0);
  });
});
