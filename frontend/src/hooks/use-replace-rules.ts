import { api, Rule } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useReplaceRules(
  options?: Omit<UseMutationOptions<Rule[], Error, { exerciseId: string; rules: string[] }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ exerciseId, rules }) => api.rules.replace(exerciseId, rules),
    ...options,
  });
}
