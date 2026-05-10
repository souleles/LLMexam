import { PageTransition } from '@/components/PageTransition';
import {
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Select,
  VStack,
  useToast,
  HStack,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/BackButton';
import { Exercise, ExerciseType } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useCreateExercise } from '@/hooks/use-create-exercise';
import { FileUploader } from '@/components/FileUploader';

export function NewExercisePage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [exerciseType, setExerciseType] = useState<ExerciseType | ''>('');
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useCreateExercise({
    onSuccess: (exercise: Exercise) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Exercises] });
      const isProject = exercise.exerciseType === ExerciseType.PROJECT;
      toast({
        title: 'Επιτυχής δημιουργία',
        description: isProject
          ? 'Το project δημιουργήθηκε. Μπορείτε να το εγκρίνετε και να ανεβάσετε εργασίες.'
          : 'Τώρα μπορείτε να εξάγετε τα σημεία ελέγχου χρησιμοποιώντας το chat',
        status: 'success',
        duration: 3000,
      });
      navigate(`/exercises/${exercise.id}`);
    },
    onError: () => {
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία δημιουργίας',
        status: 'error',
        duration: 3000,
      });
    },
  });

  const handleSubmit = () => {
    if (!file || !title.trim() || !exerciseType) {
      toast({
        title: 'Λείπουν πληροφορίες',
        description: 'Παρακαλώ δώστε τίτλο, τύπο και αρχείο PDF',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    createMutation.mutate({ file, title, exerciseType });
  };

  const helperText = {
    [ExerciseType.EXERCISE]:
      'Κλασική άσκηση με checkpoints και regex patterns. Το LLM σας βοηθά να ορίσετε τα κριτήρια βαθμολόγησης.',
    [ExerciseType.PROJECT]:
      'Ολοκληρωμένο project χωρίς προκαθορισμένα checkpoints. Η βαθμολόγηση γίνεται αποκλειστικά με LLM.',
  };

  return (
    <PageTransition>
    <Box>
      <BackButton buttonText="Πίσω στις Ασκήσεις" navigationUrl="/exercises" mb={6} />

      <VStack align="start" spacing={6} >
        <VStack align="start" spacing={1}>
          <Heading size="lg">Δημιουργία Νέας Άσκησης</Heading>
          <Text color="gray.400">
            Ανεβάστε ένα PDF και επιλέξτε τον τύπο για να ξεκινήσετε
          </Text>
        </VStack>

        <Card w="full">
          <CardBody>
            <VStack spacing={6}>
              <FormControl isRequired>
                <FormLabel>Τίτλος</FormLabel>
                <Input
                  placeholder="π.χ. Εργασία SQL 1 - Ερωτήματα Βάσης Δεδομένων"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  size="lg"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Τύπος</FormLabel>
                <Select
                  placeholder="Επιλέξτε τύπο..."
                  value={exerciseType}
                  onChange={(e) => setExerciseType(e.target.value as ExerciseType)}
                  size="lg"
                >
                  <option value={ExerciseType.EXERCISE}>Άσκηση</option>
                  <option value={ExerciseType.PROJECT}>Project</option>
                </Select>
                {exerciseType && (
                  <FormHelperText>{helperText[exerciseType]}</FormHelperText>
                )}
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Αρχείο PDF</FormLabel>
                <FileUploader
                  accept=".pdf"
                  maxFiles={1}
                  onFilesSelected={(files) => setFile(files[0] || null)}
                />
              </FormControl>

              <HStack spacing={4} w="full" justify="flex-end">
                <Button variant="outline" onClick={() => navigate('/exercises')}>
                  Ακύρωση
                </Button>
                <Button
                  colorScheme="brand"
                  onClick={handleSubmit}
                  isLoading={createMutation.isPending}
                  loadingText="Δημιουργία..."
                >
                  {exerciseType === ExerciseType.PROJECT ? 'Δημιουργία Project' : 'Δημιουργία & Εξαγωγή Checkpoints'}
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
    </PageTransition>
  );
}
