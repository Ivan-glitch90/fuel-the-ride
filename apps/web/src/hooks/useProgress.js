import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getProgress } from '../api/progress.js';

/** Progress chart data for a date range. Keeps the previous range on screen while the next one loads. */
export function useProgress({ from } = {}) {
  return useQuery({
    queryKey: ['progress', { from }],
    queryFn: () => getProgress({ from }),
    placeholderData: keepPreviousData,
  });
}
