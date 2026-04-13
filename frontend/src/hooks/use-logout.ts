import { httpClient } from '@/lib/httpClient';
import { QueryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useLogoutProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['logoutProfile'],
    mutationFn: async () => {
      const response = await httpClient.post('/api/auth/logout');
      queryClient.setQueryData([QueryKeys.Profile], () => null);
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Profile] });
      return response;
    },
    onSuccess: () => { },
    onError: () => { }
  });
}