import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetExercises() {
  return useQuery({
    queryKey: [QueryKeys.Exercises],
    queryFn: api.exercises.list,
  });
}
