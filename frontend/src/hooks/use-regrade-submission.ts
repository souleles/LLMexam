import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

interface RegradeVars {
  submissionId: string;
  method: 'regex' | 'llm';
}

export function useRegradeSubmission(
  options?: Omit<UseMutationOptions<any, Error, RegradeVars>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ submissionId, method }: RegradeVars) =>
      api.submissions.regrade(submissionId, method),
    ...options,
  });
}
