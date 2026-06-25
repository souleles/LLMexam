import { api, Exercise } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useUploadSchema(
  options?: Omit<UseMutationOptions<Exercise, Error, { exerciseId: string; file: File }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ exerciseId, file }) => api.exercises.uploadSchema(exerciseId, file),
    ...options,
  });
}
