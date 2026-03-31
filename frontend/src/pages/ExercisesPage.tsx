import {
  Box,
  Button,
  Heading,
  HStack,
  Text,
  VStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Card,
  CardBody,
  Skeleton,
  Stack,
} from '@chakra-ui/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FiPlus, FiTrash2, FiEye } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { api, ExerciseStatus } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

export function ExercisesPage() {
  const navigate = useNavigate();

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: api.exercises.list,
  });

  const deleteMutation = useMutation({
    mutationFn: api.exercises.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
  const handleDelete = (id: string) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την άσκηση;')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Box>
        <HStack justify="space-between" mb={8}>
          <VStack align="start" spacing={1}>
            <Heading size="lg">Ασκήσεις</Heading>
            <Text color="gray.600">Διαχείριση των ασκήσεων και των σημείων ελέγχου βαθμολόγησης</Text>
          </VStack>
        </HStack>
        <Card>
          <CardBody>
            <Stack spacing={3}>
              <Skeleton height="40px" />
              <Skeleton height="40px" />
              <Skeleton height="40px" />
            </Stack>
          </CardBody>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={8}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Ασκήσεις</Heading>
          <Text color="gray.600">Διαχείριση των ασκήσεων και των σημείων ελέγχου βαθμολόγησης</Text>
        </VStack>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="brand"
          onClick={() => navigate('/exercises/new')}
        >
          Νέα Άσκηση
        </Button>
      </HStack>

      {exercises.length === 0 ? (
        <Card>
          <CardBody textAlign="center" py={12}>
            <VStack spacing={4}>
              <Text fontSize="lg" color="gray.600">
                Δεν υπάρχουν ασκήσεις ακόμα
              </Text>
              <Text color="gray.500">Ξεκινήστε ανεβάζοντας την πρώτη σας άσκηση</Text>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody p={0}>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Τίτλος</Th>
                  <Th>Κατάσταση</Th>
                  <Th>Δημιουργήθηκε</Th>
                  <Th>Ενημερώθηκε</Th>
                  <Th width="100px">Ενέργειες</Th>
                </Tr>
              </Thead>
              <Tbody>
                {exercises.map((exercise) => (
                  <Tr
                    key={exercise.id}
                    _hover={{ bg: 'gray.50' }}
                    cursor="pointer"
                    onClick={() => navigate(`/exercises/${exercise.id}`)}
                  >                    <Td fontWeight="medium">{exercise.title}</Td>
                    <Td>
                      <Badge colorScheme={exercise.status === ExerciseStatus.APPROVED ? 'green' : 'yellow'} textTransform="none">
                        {exercise.status === ExerciseStatus.APPROVED ? 'Εγκεκριμένο' : 'Πρόχειρο'}
                      </Badge>
                    </Td>
                    <Td color="gray.600">
                      {new Date(exercise.createdAt).toLocaleDateString('el-GR')}
                    </Td>
                    <Td color="gray.600">
                      {new Date(exercise.updatedAt).toLocaleDateString('el-GR')}
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <IconButton
                          icon={<FiEye />}
                          aria-label="Προβολή άσκησης"
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/exercises/${exercise.id}`);
                          }}
                        />
                        <IconButton
                          icon={<FiTrash2 />}
                          aria-label="Διαγραφή άσκησης"
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(exercise.id);
                          }}
                          isLoading={deleteMutation.isPending}
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </Box>
  );
}
