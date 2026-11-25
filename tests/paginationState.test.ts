import { describe, expect, it } from 'vitest';
import {
  beginLoadMore,
  finishLoadMoreError,
  finishLoadMoreSuccess,
  INITIAL_PAGINATION_STATUS,
  resetPaginationStatus,
} from '../src/domain/paginationState';
import { getStrings } from '../src/i18n/strings';

describe('paginationState', () => {
  it('starts idle with no loading or error state', () => {
    expect(INITIAL_PAGINATION_STATUS).toEqual({
      isLoadingMore: false,
      hasLoadMoreError: false,
    });
  });

  it('surfaces a load-more error on non-aborted failure and clears loading', () => {
    const loading = beginLoadMore();
    expect(loading).toEqual({
      isLoadingMore: true,
      hasLoadMoreError: false,
    });

    const failed = finishLoadMoreError(loading, false);
    expect(failed).toEqual({
      isLoadingMore: false,
      hasLoadMoreError: true,
    });
  });

  it('clears a previous load-more error when retrying and succeeds cleanly', () => {
    const failed = finishLoadMoreError(beginLoadMore(), false);
    expect(failed.hasLoadMoreError).toBe(true);

    const retrying = beginLoadMore();
    expect(retrying).toEqual({
      isLoadingMore: true,
      hasLoadMoreError: false,
    });

    const recovered = finishLoadMoreSuccess();
    expect(recovered).toEqual({
      isLoadingMore: false,
      hasLoadMoreError: false,
    });
  });

  it('ignores aborted or stale load-more rejections without setting an error', () => {
    const idle = resetPaginationStatus();
    expect(finishLoadMoreError(idle, true)).toBe(idle);

    const loading = beginLoadMore();
    expect(finishLoadMoreError(loading, true)).toBe(loading);
  });

  it('resets both flags on new search, reset, or tab restore', () => {
    const failed = finishLoadMoreError(beginLoadMore(), false);
    expect(failed.hasLoadMoreError).toBe(true);

    expect(resetPaginationStatus()).toEqual({
      isLoadingMore: false,
      hasLoadMoreError: false,
    });
  });

  it('provides localized Arabic and English load-more error messages', () => {
    expect(getStrings('ar').loadMoreError.trim().length).toBeGreaterThan(0);
    expect(getStrings('en').loadMoreError.trim().length).toBeGreaterThan(0);
  });
});
