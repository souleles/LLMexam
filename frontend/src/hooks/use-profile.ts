import { httpClient } from '@/lib/httpClient';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery, UseQueryResult } from '@tanstack/react-query';

export function useGetProfile(): UseQueryResult<{ username: string }> {
  return useQuery({
    queryFn: async () => {
      const response = await httpClient.get("/api/auth/profile");
      return response.data;
    },
    queryKey: [QueryKeys.Profile],
    staleTime: 1000 * 60 * 60 * 5 //5 hours
  });
}
