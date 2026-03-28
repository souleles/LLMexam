import {
  Box,
  Button,
  Heading,
  HStack,
  VStack,
  Text,
  Grid,
  GridItem,
  useToast,
  Badge,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { ChatInterface } from '@/components/ChatInterface';
import { CheckpointList } from '@/components/CheckpointList';

export function ExerciseSetupPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: exercise, isLoading: exerciseLoading } = useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: () => api.exercises.get(exerciseId!),
    enabled: !!exerciseId,
  });

  const { data: checkpoints = [] } = useQuery({
    queryKey: ['checkpoints', exerciseId],
    queryFn: () => api.checkpoints.list(exerciseId!),
    enabled: !!exerciseId,
  });

  const approveMutation = useMutation({
    mutationFn: () => api.checkpoints.approve(exerciseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise', exerciseId] });
      toast({
        title: 'Η άσκηση εγκρίθηκε',
        description: 'Μπορείτε τώρα να ανεβάσετε υποβολές φοιτητών',
        status: 'success',
        duration: 3000,
      });
      navigate('/exercises');
    },
    onError: () => {
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία έγκρισης άσκησης',
        status: 'error',
        duration: 3000,
      });
    },
  });

  if (exerciseLoading || !exercise) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Φόρτωση άσκησης...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <HStack spacing={4}>
          <Button
            leftIcon={<FiArrowLeft />}
            variant="ghost"
            onClick={() => navigate('/exercises')}
          >
            Πίσω
          </Button>
          <VStack align="start" spacing={0}>
            <HStack>
              <Heading size="lg">{exercise.title}</Heading>
              <Badge colorScheme={exercise.status === 'approved' ? 'green' : 'yellow'}>
                {exercise.status === 'approved' ? 'Εγκεκριμένο' : 'Πρόχειρο'}
              </Badge>
            </HStack>
            <Text color="gray.600" fontSize="sm">
              Εξάγετε και βελτιώστε τα checkpoints χρησιμοποιώντας το chat
            </Text>
          </VStack>
        </HStack>
        {exercise.status === 'draft' && checkpoints.length > 0 && (
          <Button
            leftIcon={<FiCheck />}
            colorScheme="green"
            onClick={() => approveMutation.mutate()}
            isLoading={approveMutation.isPending}
          >
            Έγκριση Άσκησης
          </Button>
        )}
      </HStack>

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
        <GridItem>
          <ChatInterface exerciseId={exerciseId!} />
        </GridItem>
        <GridItem>
          <CheckpointList exerciseId={exerciseId!} checkpoints={checkpoints} />
        </GridItem>
      </Grid>
    </Box>
  );
}
