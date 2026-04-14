import { api, Exercise } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useCreateExercise(
  options?: Omit<UseMutationOptions<Exercise, Error, { file: File; title: string }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title: string }) =>
      api.exercises.create(file, title),
    ...options,
  });
}
