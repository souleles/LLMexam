import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useDeleteExercise(
  options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: (id: string) => api.exercises.delete(id),
    ...options,
  });
}
