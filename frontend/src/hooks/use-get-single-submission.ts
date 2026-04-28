import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetSingleSubmission(submissionId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [QueryKeys.Submissions, submissionId],
    queryFn: () => api.submissions.get(submissionId!),
    enabled: !!submissionId && enabled,
    staleTime: Infinity,
  });
}
