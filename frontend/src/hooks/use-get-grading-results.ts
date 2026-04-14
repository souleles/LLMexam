import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetGradingResults(exerciseId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.GradingResults, exerciseId],
    queryFn: () => api.grading.getResults(exerciseId!),
    enabled: !!exerciseId,
  });
}
