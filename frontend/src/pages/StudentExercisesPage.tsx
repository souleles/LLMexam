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
  HStack,
  Text,
  useToast,
  Select,
  Divider,
  Badge,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FiUpload, FiCheck, FiX } from 'react-icons/fi';
import { api, GradingResult } from '@/lib/api';
import { FileUploader } from '@/components/FileUploader';
import { queryClient } from '@/lib/queryClient';

export function StudentExercisesPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<GradingResult[]>([]);
  const toast = useToast();
  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: api.exercises.list,
  }); const gradeMutation = useMutation({
    mutationFn: async ({
      exerciseId,
      file,
      studentId,
      studentName,
    }: {
      exerciseId: string;
      file: File;
      studentId: string;
      studentName: string;
    }) => {
      // Upload and grade in one call
      const gradingResults = await api.submissions.uploadAndGrade(exerciseId, studentId, studentName, file);
      return gradingResults;
    },
    onSuccess: (data) => {
      setResults(data);
      toast({
        title: 'Ολοκληρώθηκε η βαθμολόγηση',
        description: 'Τα αποτελέσματα εμφανίζονται παρακάτω',
        status: 'success',
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Σφάλμα',
        description: error.message || 'Αποτυχία βαθμολόγησης εργασίας',
        status: 'error',
        duration: 5000,
      });
    },
  });

  const saveResultsMutation = useMutation({
    mutationFn: api.grading.saveResults,
    onSuccess: () => {
      toast({
        title: 'Αποθηκεύτηκαν τα αποτελέσματα',
        description: 'Τα αποτελέσματα βαθμολόγησης αποθηκεύτηκαν στη βάση δεδομένων',
        status: 'success',
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['grading'] });
    },
    onError: () => {
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία αποθήκευσης αποτελεσμάτων',
        status: 'error',
        duration: 3000,
      });
    },
  });

  const handleFindResults = () => {
    if (!selectedExerciseId || !file || !studentId.trim() || !studentName.trim()) {
      toast({
        title: 'Λείπουν πληροφορίες',
        description: 'Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    gradeMutation.mutate({
      exerciseId: selectedExerciseId,
      file,
      studentId,
      studentName,
    });
  };

  const handleSaveResults = () => {
    if (results.length === 0) {
      toast({
        title: 'Δεν υπάρχουν αποτελέσματα',
        description: 'Παρακαλώ βαθμολογήστε πρώτα μια εργασία',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    saveResultsMutation.mutate(results as any);
  };

  const passedCount = results.filter((r) => r.matched).length;
  const totalCount = results.length;

  return (
    <Box>
      <VStack align="stretch" spacing={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Βαθμολόγηση Εργασίας Φοιτητή</Heading>
          <Text color="gray.600">
            Ανεβάστε το αρχείο εργασίας ενός φοιτητή και ελέγξτε έναντι των σημείων ελέγχου
          </Text>
        </VStack>

        {/* Upload Form */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Επιλογή Άσκησης</FormLabel>
                <Select
                  placeholder="Επιλέξτε άσκηση..."
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                >
                  {exercises
                    .filter((ex) => ex.status === 'approved')
                    .map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.title}
                      </option>
                    ))}
                </Select>
              </FormControl>

              <HStack spacing={4} w="full">
                <FormControl isRequired flex={1}>
                  <FormLabel>Αριθμός Μητρώου </FormLabel>
                  <Input
                    placeholder="π.χ. 2019030001"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </FormControl>

                <FormControl isRequired flex={1}>
                  <FormLabel>Ονοματεπώνυμο</FormLabel>
                  <Input
                    placeholder="π.χ. Γιάννης Παπαδόπουλος"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </FormControl>
              </HStack>              <FormControl isRequired>
                <FormLabel>Αρχείο Εργασίας Φοιτητή (.zip ή μεμονωμένο αρχείο)</FormLabel>
                <FileUploader
                  accept=".sql,.txt,.py,.pdf,.docx,.js,.ts,.tsx,.zip"
                  maxFiles={1}
                  onFilesSelected={(files) => setFile(files[0] || null)}
                />
                <Text fontSize="sm" color="gray.500" mt={2}>
                  Μπορείτε να ανεβάσετε ένα ZIP αρχείο με πολλαπλά αρχεία ή ένα μεμονωμένο αρχείο
                </Text>
              </FormControl>

              <Button
                leftIcon={<FiUpload />}
                colorScheme="brand"
                size="lg"
                w="full"
                onClick={handleFindResults}
                isLoading={gradeMutation.isPending}
                loadingText="Βαθμολόγηση..."
              >
                Εύρεση Αποτελεσμάτων
              </Button>
            </VStack>
          </CardBody>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <>
            <Card>
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <HStack justify="space-between">
                    <Heading size="md">Αποτελέσματα Βαθμολόγησης</Heading>
                    <HStack>
                      <Text fontWeight="bold">
                        Βαθμός: {passedCount}/{totalCount}
                      </Text>
                      <Badge colorScheme={passedCount === totalCount ? 'green' : 'yellow'}>
                        {Math.round((passedCount / totalCount) * 100)}%
                      </Badge>
                    </HStack>
                  </HStack>

                  <Divider />

                  <Accordion allowMultiple>
                    {results.map((result, index) => (
                      <AccordionItem key={result.checkpointId}>
                        <h2>
                          <AccordionButton>
                            <Box flex="1" textAlign="left">
                              <HStack>
                                {result.matched ? (
                                  <FiCheck color="green" />
                                ) : (
                                  <FiX color="red" />
                                )}
                                <Text fontWeight="medium">
                                  Checkpoint {index + 1}: {result.checkpointDescription}
                                </Text>
                              </HStack>
                            </Box>
                            <Badge colorScheme={result.matched ? 'green' : 'red'} mr={2}>
                              {result.matched ? 'ΠΕΤΥΧΕ' : 'ΑΠΕΤΥΧΕ'}
                            </Badge>
                            <AccordionIcon />
                          </AccordionButton>
                        </h2>
                        <AccordionPanel pb={4}>                          {result.matched && result.matchedSnippets.length > 0 ? (
                          <VStack align="stretch" spacing={3}>
                            <Text fontWeight="medium">Βρέθηκε στις γραμμές:</Text>
                            {result.matchedSnippets.map((snippet, idx) => (
                              <Box key={idx}>
                                <Text fontSize="sm" color="gray.600" mb={1}>
                                  Γραμμή {snippet.line}:
                                </Text>
                                <Code p={2} borderRadius="md" display="block">
                                  {snippet.snippet}
                                </Code>
                              </Box>
                            ))}
                          </VStack>
                        ) : (
                          <Text color="gray.500">
                            Δεν βρέθηκαν αποτελέσματα για αυτό το checkpoint
                          </Text>
                        )}
                        </AccordionPanel>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  <Divider />                  <Button
                    colorScheme="green"
                    size="lg"
                    onClick={handleSaveResults}
                    isLoading={saveResultsMutation.isPending}
                    loadingText="Αποθήκευση..."
                  >
                    Αποθήκευση Αποτελεσμάτων στη Βάση Δεδομένων
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </>
        )}
      </VStack>
    </Box>
  );
}
