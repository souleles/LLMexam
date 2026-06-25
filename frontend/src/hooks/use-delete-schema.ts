import { api, Exercise } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useDeleteSchema(
  options?: Omit<UseMutationOptions<Exercise, Error, { exerciseId: string }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ exerciseId }) => api.exercises.deleteSchema(exerciseId),
    ...options,
  });
}
