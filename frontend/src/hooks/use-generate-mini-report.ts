import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useGenerateMiniReport(
  options?: Omit<UseMutationOptions<{ report: string }, Error, string>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: (studentId: string) => api.students.getMiniReport(studentId),
    ...options,
  });
}
