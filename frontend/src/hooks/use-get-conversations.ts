import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetConversations(
  exerciseId: string,
  conversationType: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [QueryKeys.Conversations, exerciseId, conversationType],
    queryFn: () => api.conversations.listByType(exerciseId, conversationType),
    enabled: !!exerciseId && enabled,
    staleTime: Infinity,
  });
}
