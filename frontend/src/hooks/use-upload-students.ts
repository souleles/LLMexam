import { api, Student } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useUploadStudents(
  options?: Omit<UseMutationOptions<Student[], Error, File>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: (file: File) => api.students.upload(file),
    ...options,
  });
}
