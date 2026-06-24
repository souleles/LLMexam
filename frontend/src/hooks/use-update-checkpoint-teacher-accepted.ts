import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

interface UpdateCheckpointTeacherAcceptedVars {
  checkpointResultId: string;
  teacherAccepted: boolean;
}

export function useUpdateCheckpointTeacherAccepted(
  options?: Omit<UseMutationOptions<void, Error, UpdateCheckpointTeacherAcceptedVars>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ checkpointResultId, teacherAccepted }: UpdateCheckpointTeacherAcceptedVars) =>
      api.grading.updateCheckpointTeacherAccepted(checkpointResultId, teacherAccepted),
    ...options,
  });
}
