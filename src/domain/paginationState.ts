export interface PaginationStatus {
  isLoadingMore: boolean;
  hasLoadMoreError: boolean;
}

export const INITIAL_PAGINATION_STATUS: PaginationStatus = {
  isLoadingMore: false,
  hasLoadMoreError: false,
};

export function beginLoadMore(): PaginationStatus {
  return {
    isLoadingMore: true,
    hasLoadMoreError: false,
  };
}

export function finishLoadMoreSuccess(): PaginationStatus {
  return {
    isLoadingMore: false,
    hasLoadMoreError: false,
  };
}

export function finishLoadMoreError(
  state: PaginationStatus,
  abortedOrStale: boolean,
): PaginationStatus {
  if (abortedOrStale) {
    return state;
  }
  return {
    isLoadingMore: false,
    hasLoadMoreError: true,
  };
}

export function resetPaginationStatus(): PaginationStatus {
  return {
    isLoadingMore: false,
    hasLoadMoreError: false,
  };
}
