import { api, GradingResult } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useSaveGradingResults(
  options?: Omit<UseMutationOptions<void, Error, GradingResult[]>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: (results: GradingResult[]) => api.grading.saveResults(results),
    ...options,
  });
}
