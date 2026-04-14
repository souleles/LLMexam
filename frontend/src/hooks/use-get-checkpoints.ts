import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetCheckpoints(exerciseId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Checkpoints, exerciseId],
    queryFn: () => api.checkpoints.list(exerciseId!),
    enabled: !!exerciseId,
  });
}
