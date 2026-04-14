import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

interface SaveTeacherScoreVars {
  submissionId: string;
  score: number;
}

export function useSaveTeacherScore(
  options?: Omit<UseMutationOptions<void, Error, SaveTeacherScoreVars>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ submissionId, score }: SaveTeacherScoreVars) =>
      api.grading.updateTeacherScore(submissionId, score),
    ...options,
  });
}
