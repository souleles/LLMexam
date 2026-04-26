import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

interface UploadAndGradeVars {
  exerciseId: string;
  studentIds: Array<{ value: string; label: string }>;
  file: File;
  method?: 'regex' | 'llm';
}

export function useUploadAndGrade(
  options?: Omit<UseMutationOptions<any, Error, UploadAndGradeVars>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ exerciseId, studentIds, file, method = 'regex' }: UploadAndGradeVars) =>
      api.submissions.uploadAndGrade(
        exerciseId,
        studentIds.map((s) => s.value),
        file,
        method,
      ),
    ...options,
  });
}
