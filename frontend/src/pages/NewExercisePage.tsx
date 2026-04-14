import { PageTransition } from '@/components/PageTransition';
import {
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  useToast,
  HStack,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { Exercise } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useCreateExercise } from '@/hooks/use-create-exercise';
import { FileUploader } from '@/components/FileUploader';

export function NewExercisePage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useCreateExercise({
    onSuccess: (exercise: Exercise) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Exercises] });
      toast({
        title: 'Επιτυχής δημιουργία άσκησης',
        description: 'Τώρα μπορείτε να εξάγετε τα σημεία ελέγχου χρησιμοποιώντας το chat',
        status: 'success',
        duration: 3000,
      });
      navigate(`/exercises/${exercise.id}`);
    },
    onError: () => {
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία δημιουργίας άσκησης',
        status: 'error',
        duration: 3000,
      });
    },
  });

  const handleSubmit = () => {
    if (!file || !title.trim()) {
      toast({
        title: 'Λείπουν πληροφορίες',
        description: 'Παρακαλώ δώστε τίτλο και αρχείο PDF',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    createMutation.mutate({ file, title });
  };

  return (
    <PageTransition>
    <Box>
      <Button
        leftIcon={<FiArrowLeft />}
        variant="ghost"
        mb={6}
        onClick={() => navigate('/exercises')}
      >
        Πίσω στις Ασκήσεις
      </Button>

      <VStack align="start" spacing={6} >
        <VStack align="start" spacing={1}>
          <Heading size="lg">Δημιουργία Νέας Άσκησης</Heading>
          <Text color="gray.400">
            Ανεβάστε ένα PDF άσκησης και θα σας βοηθήσουμε να εξάγετε τα σημεία ελέγχου βαθμολόγησης
          </Text>
        </VStack>

        <Card w="full">
          <CardBody>
            <VStack spacing={6}>
              <FormControl isRequired>
                <FormLabel>Τίτλος Άσκησης</FormLabel>
                <Input
                  placeholder="π.χ. Εργασία SQL 1 - Ερωτήματα Βάσης Δεδομένων"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  size="lg"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Αρχείο PDF Άσκησης</FormLabel>
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
                  Δημιουργία & Εξαγωγή Checkpoints
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
