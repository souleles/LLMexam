import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetRules(exerciseId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Rules, exerciseId],
    queryFn: () => api.rules.list(exerciseId!),
    enabled: !!exerciseId,
  });
}
