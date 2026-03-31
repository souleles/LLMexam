import {
  Box,
  Button,
  Heading,
  HStack,
  VStack,
  Text,
  useToast,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Code,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FiArrowLeft, FiUpload, FiBarChart2, FiTrash2 } from 'react-icons/fi';
import { useState } from 'react';
import { api, ExerciseStatus } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { FileUploader } from '@/components/FileUploader';

const ACCEPTED_FILE_TYPES = '.sql,.txt,.py,.pdf,.docx,.js,.ts,.tsx';

export function SubmissionsPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const { data: exercise } = useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: () => api.exercises.get(exerciseId!),
    enabled: !!exerciseId,
  });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['submissions', exerciseId],
    queryFn: () => api.submissions.list(exerciseId!),
    enabled: !!exerciseId,
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.submissions.upload(exerciseId!, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions', exerciseId] });
      toast({
        title: 'Οι υποβολές ανέβηκαν',
        description: 'Τα αρχεία των φοιτητών ανέβηκαν επιτυχώς',
        status: 'success',
        duration: 3000,
      });
      setSelectedFiles([]);
    },
    onError: () => {
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία ανεβάσματος υποβολών',
        status: 'error',
        duration: 3000,
      });
    },
  });

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'Δεν επιλέχθηκαν αρχεία',
        description: 'Παρακαλώ επιλέξτε αρχεία για ανέβασμα',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    uploadMutation.mutate(selectedFiles);
  };

  if (!exercise) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Φόρτωση...</Text>
      </Box>
    );
  }
  if (exercise.status !== ExerciseStatus.APPROVED) {
    return (
      <Box textAlign="center" py={10}>
        <VStack spacing={4}>
          <Text fontSize="lg" color="gray.600">
            Αυτή η άσκηση δεν έχει εγκριθεί ακόμα
          </Text>
          <Button onClick={() => navigate(`/exercises/${exerciseId}/setup`)}>
            Μετάβαση στη Ρύθμιση
          </Button>
        </VStack>
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
            <Heading size="lg">{exercise.title}</Heading>
            <Text color="gray.600" fontSize="sm">
              Ανεβάστε υποβολές φοιτητών για βαθμολόγηση
            </Text>
          </VStack>
        </HStack>
        <Button
          leftIcon={<FiBarChart2 />}
          colorScheme="blue"
          variant="outline"
          onClick={() => navigate(`/exercises/${exerciseId}/results`)}
        >
          Προβολή Αποτελεσμάτων
        </Button>
      </HStack>

      <VStack spacing={6} align="stretch">
        {/* Upload Section */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <FileUploader
                accept={ACCEPTED_FILE_TYPES}
                maxFiles={50}
                onFilesSelected={setSelectedFiles}
              />
              {selectedFiles.length > 0 && (
                <Button
                  leftIcon={<FiUpload />}
                  colorScheme="brand"
                  w="full"
                  onClick={handleUpload}
                  isLoading={uploadMutation.isPending}
                >
                  Ανέβασμα {selectedFiles.length} αρχεί{selectedFiles.length > 1 ? 'ων' : 'ου'}
                </Button>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Submissions List */}
        <Card>
          <CardBody>
            <HStack justify="space-between" mb={4}>
              <Heading size="md">Υποβολές που Ανέβηκαν</Heading>
              <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
                {submissions.length}
              </Badge>
            </HStack>

            {isLoading ? (
              <Text textAlign="center" py={8} color="gray.500">
                Φόρτωση υποβολών...
              </Text>
            ) : submissions.length === 0 ? (
              <Text textAlign="center" py={8} color="gray.500">
                Δεν υπάρχουν υποβολές ακόμα. Ανεβάστε αρχεία φοιτητών για να ξεκινήσετε.
              </Text>
            ) : (
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Φοιτητής</Th>
                      <Th>Όνομα Αρχείου</Th>
                      <Th>Ανέβηκε</Th>
                      <Th>Κατάσταση</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {submissions.map((submission) => (
                      <Tr key={submission.id}>
                        <Td fontWeight="medium">{submission.studentIdentifier}</Td>
                        <Td>
                          <Code fontSize="sm">
                            {submission.originalFilePath.split('/').pop()}
                          </Code>
                        </Td>
                        <Td fontSize="sm" color="gray.600">
                          {new Date(submission.createdAt).toLocaleString('el-GR')}
                        </Td>
                        <Td>
                          <Badge colorScheme="green">Έτοιμο</Badge>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}
