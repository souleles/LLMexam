import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

interface UploadAndGradeVars {
  exerciseId: string;
  studentIds: Array<{ value: string; label: string }>;
  file: File;
}

export function useUploadAndGrade(
  options?: Omit<UseMutationOptions<any, Error, UploadAndGradeVars>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ exerciseId, studentIds, file }: UploadAndGradeVars) =>
      api.submissions.uploadAndGrade(
        exerciseId,
        studentIds.map((s) => s.value),
        file,
      ),
    ...options,
  });
}
