import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetExercise(exerciseId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Exercises, exerciseId],
    queryFn: () => api.exercises.get(exerciseId!),
    enabled: !!exerciseId,
  });
}
