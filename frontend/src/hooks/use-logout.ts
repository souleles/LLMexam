import { httpClient } from '@/lib/httpClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useLogoutProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['logoutProfile'],
    mutationFn: async () => {
      const response = await httpClient.post('/api/auth/logout');
      queryClient.setQueryData(['profile'], () => null);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      return response;
    },
    onSuccess: () => { },
    onError: () => { }
  });
}