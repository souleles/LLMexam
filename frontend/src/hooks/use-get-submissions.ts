import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetSubmissions(exerciseId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Submissions, exerciseId],
    queryFn: () => api.submissions.list(exerciseId!),
    enabled: !!exerciseId,
  });
}
