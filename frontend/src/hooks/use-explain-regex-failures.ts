import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

interface ExplainRegexFailuresVars {
  submissionId: string;
}

interface ExplainRegexFailuresResult {
  submissionId: string;
  explanations: Array<{ checkpointId: string; checkpointDescription: string; checkpointOrder: number; explanation: string }>;
}

export function useExplainRegexFailures(
  options?: Omit<UseMutationOptions<ExplainRegexFailuresResult, Error, ExplainRegexFailuresVars>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ submissionId }: ExplainRegexFailuresVars) =>
      api.submissions.explainRegexFailures(submissionId),
    ...options,
  });
}
