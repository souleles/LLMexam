import { api, Checkpoint } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

type PatternInput = { order: number; pattern: string; patternDescription: string };

export function useAcceptPatterns(
  exerciseId: string,
  options?: Omit<UseMutationOptions<Checkpoint[], Error, PatternInput[]>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: (patterns: PatternInput[]) =>
      api.checkpoints.bulkUpdatePatterns(exerciseId, patterns),
    ...options,
  });
}
