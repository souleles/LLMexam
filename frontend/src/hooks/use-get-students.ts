import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetStudents() {
  return useQuery({
    queryKey: [QueryKeys.Students],
    queryFn: api.students.list,
  });
}
