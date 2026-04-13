import { PageTransition } from '@/components/PageTransition';
import { DataTable } from '@/components/DataTable';
import { api, Exercise, ExerciseStatus } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Text,
  Tr,
  Td,
  VStack,
} from '@chakra-ui/react';
import { useMutation, UseMutationResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ExerciseColumns } from '@/lib/columns';

const RenderRow = ({ exercise, deleteMutation }: {
  exercise: Exercise; deleteMutation: UseMutationResult<void, unknown, string>
}) => {
  const navigate = useNavigate();
  const handleDelete = (id: string) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την άσκηση;')) {
      deleteMutation.mutate(id);
    }
  };
  return (
    <Tr
      key={exercise.id}
      _hover={{ bg: 'gray.700' }}
      cursor="pointer"
      onClick={() => navigate(`/exercises/${exercise.id}`)}
    >
      <Td fontWeight="medium">{exercise.title}</Td>
      <Td>
        <Badge
          colorScheme={exercise.status === ExerciseStatus.APPROVED ? 'green' : 'yellow'}
          textTransform="none"
        >
          {exercise.status === ExerciseStatus.APPROVED ? 'Εγκεκριμένο' : 'Πρόχειρο'}
        </Badge>
      </Td>
      <Td color="gray.400">{new Date(exercise.createdAt).toLocaleDateString('el-GR')}</Td>
      <Td color="gray.400">{new Date(exercise.updatedAt).toLocaleDateString('el-GR')}</Td>
      <Td>
        <HStack spacing={2}>
          <IconButton
            icon={<FiEye />}
            aria-label="Προβολή άσκησης"
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); navigate(`/exercises/${exercise.id}`); }}
          />
          <IconButton
            icon={<FiTrash2 />}
            aria-label="Διαγραφή άσκησης"
            size="sm"
            variant="ghost"
            colorScheme="red"
            isLoading={deleteMutation.isPending}
            onClick={(e) => { e.stopPropagation(); handleDelete(exercise.id); }}
          />
        </HStack>
      </Td>
    </Tr>
  )
}

export function ExercisesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: [QueryKeys.Exercises],
    queryFn: api.exercises.list,
  });

  const deleteMutation = useMutation({
    mutationFn: api.exercises.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.Exercises] }),
  });

  return (
    <PageTransition>
      <Box>
        <HStack justify="space-between" mb={8}>
          <VStack align="start" spacing={1}>
            <Heading size="lg">Ασκήσεις</Heading>
            <Text color="gray.400">Διαχείριση των ασκήσεων και των σημείων ελέγχου βαθμολόγησης</Text>
          </VStack>
          <Button leftIcon={<FiPlus />} colorScheme="brand" onClick={() => navigate('/exercises/new')}>
            Νέα Άσκηση
          </Button>
        </HStack>

        <DataTable
          columns={ExerciseColumns}
          data={exercises}
          isLoading={isLoading}
          emptyText="Δεν υπάρχουν ασκήσεις ακόμα"
          emptySubtext="Ξεκινήστε ανεβάζοντας την πρώτη σας άσκηση"
          pagination={{
            pageSizeOptions: [10, 25, 50],
            defaultPageSize: 10,
          }}
          renderRow={(exercise) => <RenderRow exercise={exercise} deleteMutation={deleteMutation} />}
        />
      </Box>
    </PageTransition>
  );
}
