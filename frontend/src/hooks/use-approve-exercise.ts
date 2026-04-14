import { api, Exercise } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useApproveExercise(
  options?: Omit<UseMutationOptions<Exercise, Error, string>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: (id: string) => api.exercises.approve(id),
    ...options,
  });
}
