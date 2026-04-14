import { api, Checkpoint } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

type CheckpointInput = Pick<
  Checkpoint,
  'order' | 'description' | 'pattern' | 'caseSensitive' | 'patternDescription'
>;

export function useAcceptCheckpoints(
  exerciseId: string,
  options?: Omit<UseMutationOptions<Checkpoint[], Error, CheckpointInput[]>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: (checkpoints: CheckpointInput[]) =>
      api.checkpoints.bulkReplace(exerciseId, checkpoints),
    ...options,
  });
}
