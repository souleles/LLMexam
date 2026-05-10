import { api, Exercise, ExerciseType } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useCreateExercise(
  options?: Omit<UseMutationOptions<Exercise, Error, { file: File; title: string; exerciseType: ExerciseType }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ file, title, exerciseType }: { file: File; title: string; exerciseType: ExerciseType }) =>
      api.exercises.create(file, title, exerciseType),
    ...options,
  });
}
