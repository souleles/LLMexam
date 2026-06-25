import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

interface ExplainLlmFailuresVars {
  submissionId: string;
}

interface ExplainLlmFailuresResult {
  submissionId: string;
  explanations: Array<{ checkpointId: string; checkpointDescription: string; checkpointOrder: number; explanation: string }>;
}

export function useExplainLlmFailures(
  options?: Omit<UseMutationOptions<ExplainLlmFailuresResult, Error, ExplainLlmFailuresVars>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ submissionId }: ExplainLlmFailuresVars) =>
      api.submissions.explainLlmFailures(submissionId),
    ...options,
  });
}
