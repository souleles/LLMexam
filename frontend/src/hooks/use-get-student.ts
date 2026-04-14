import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Students, studentId],
    queryFn: () => api.students.get(studentId!),
    enabled: !!studentId,
  });
}
