import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetStudentSubmissions(studentId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Students, studentId, QueryKeys.Submissions],
    queryFn: () => api.students.getSubmissions(studentId!),
    enabled: !!studentId,
  });
}
