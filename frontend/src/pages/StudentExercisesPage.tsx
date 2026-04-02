import { FileUploader } from '@/components/FileUploader';
import { api, GradingResult } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Code,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
  useToast,
  VStack
} from '@chakra-ui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { FiCheck, FiUpload, FiX } from 'react-icons/fi';
import ReactSelect from 'react-select';

export function StudentExercisesPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Array<{ value: string; label: string }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [gradingResults, setGradingResults] = useState<GradingResult[]>([]);
  const [teacherPassed, setTeacherPassed] = useState<number>(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const toast = useToast();

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: api.exercises.list,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: api.students.list,
  });

  const exerciseOptions = exercises
    .filter((ex) => ex.status === 'approved')
    .map((ex) => ({
      value: ex.id,
      label: ex.title,
    }));

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.lastName} ${s.firstName} - ${s.studentIdentifier}`,
  }));

  const gradeMutation = useMutation({
    mutationFn: ({
      exerciseId,
      studentIds,
      file,
    }: {
      exerciseId: string;
      studentIds: Array<{ value: string; label: string }>;
      file: File;
    }) =>
      api.submissions.uploadAndGrade(
        exerciseId,
        studentIds.map((s) => s.value),
        file,
      ),
    onSuccess: (data: any) => {
      // data is the response from uploadAndGrade endpoint
      if (data.submissionId) {
        setSubmissionId(data.submissionId);
      }
      if (data.checkpoints) {
        setGradingResults(data.checkpoints);
        setTeacherPassed(data.checkpoints.filter((r: any) => r.matched).length);
      }
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      const n = selectedStudentIds.length;
      toast({
        title: 'Ολοκληρώθηκε η βαθμολόγηση',
        description: n === 1 ? 'Βαθμολογήθηκε 1 φοιτητής' : `Βαθμολογήθηκαν ${n} φοιτητές`,
        status: 'success',
        duration: 3000,
      });
    },
    onError: (error: AxiosError<Error>) => {
      toast({
        title: 'Σφάλμα',
        description: error.response?.data?.message || 'Αποτυχία βαθμολόγησης εργασίας',
        status: 'error',
        duration: 5000,
      });
    },
  });

  const saveScoreMutation = useMutation({
    mutationFn: () => {
      if (!submissionId) {
        throw new Error('No submission ID available');
      }
      return api.grading.updateTeacherScore(submissionId, teacherPassed);
    },
    onSuccess: () => {
      toast({
        title: 'Επιτυχής αποθήκευση',
        description: 'Ο βαθμός του εκπαιδευτικού αποθηκεύτηκε',
        status: 'success',
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Σφάλμα',
        description: error.message || 'Αποτυχία αποθήκευσης βαθμού',
        status: 'error',
        duration: 5000,
      });
    },
  });

  const handleFindResults = () => {
    if (!selectedExerciseId || !file || selectedStudentIds.length === 0) {
      toast({
        title: 'Λείπουν πληροφορίες',
        description: 'Παρακαλώ επιλέξτε άσκηση, φοιτητή/ές και αρχείο',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    gradeMutation.mutateAsync({ exerciseId: selectedExerciseId, studentIds: selectedStudentIds, file });
  };

  return (
    <Box>
      <VStack align="stretch" spacing={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Βαθμολόγηση Εργασίας Φοιτητή</Heading>
          <Text color="gray.600">
            Ανεβάστε το αρχείο εργασίας και ελέγξτε έναντι των σημείων ελέγχου
          </Text>
        </VStack>

        {/* Upload Form */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Επιλογή Άσκησης</FormLabel>
                <ReactSelect
                  options={exerciseOptions}
                  value={exerciseOptions.find((opt) => opt.value === selectedExerciseId) || null}
                  onChange={(opt) => setSelectedExerciseId(opt?.value || '')}
                  placeholder="Επιλέξτε άσκηση..."
                  noOptionsMessage={() => 'Δεν βρέθηκαν ασκήσεις'}
                  isClearable
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Επιλογή Φοιτητή/ών</FormLabel>
                <ReactSelect
                  isMulti
                  options={studentOptions}
                  value={selectedStudentIds}
                  onChange={(opts) => setSelectedStudentIds(opts as Array<{ value: string; label: string }>)}
                  placeholder="Επιλέξτε φοιτητές..."
                  noOptionsMessage={() => 'Δεν βρέθηκαν φοιτητές'}
                  hideSelectedOptions={false}
                  closeMenuOnSelect={false}
                />
                {selectedStudentIds.length > 0 && (
                  <FormHelperText>
                    <strong>{selectedStudentIds.length} επιλεγμένοι</strong>
                  </FormHelperText>
                )}
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Αρχείο Εργασίας (.zip ή μεμονωμένο αρχείο)</FormLabel>
                <FileUploader
                  accept=".sql,.txt,.py,.pdf,.docx,.js,.ts,.tsx,.zip"
                  maxFiles={1}
                  onFilesSelected={(files) => setFile(files[0] || null)}
                />
                <FormHelperText>
                  ZIP αρχείο με πολλαπλά αρχεία ή ένα μεμονωμένο αρχείο
                </FormHelperText>
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
        {gradingResults.length > 0 && (() => {
          const passedCount = gradingResults.filter((r) => r.matched).length;
          const totalCount = gradingResults.length;
          return (
            <Card>
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <VStack align="stretch" spacing={2}>
                    <Heading size="md">Αποτελέσματα Βαθμολόγησης</Heading>
                    <Text fontSize="sm" color="gray.500">
                      {selectedStudentIds.map((s) => s.label).join(' · ')}
                    </Text>
                  </VStack>

                  <Accordion allowMultiple>
                    {gradingResults.map((result, index) => (
                      <AccordionItem key={result.checkpointId}>
                        <h2>
                          <AccordionButton>
                            <Box flex="1" textAlign="left">
                              <HStack>
                                {result.matched ? <FiCheck color="green" /> : <FiX color="red" />}
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
                        <AccordionPanel pb={4}>
                          {result.matched && result.matchedSnippets.length > 0 ? (
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

                  <VStack align="stretch" spacing={2}>
                    <HStack spacing={4} pt={1} w="full">
                      <HStack flex="1">
                        <Text fontWeight="medium" color="gray.600">LLM Βαθμός:</Text>
                        <Text fontWeight="bold">{passedCount}/{totalCount}</Text>
                        <Badge colorScheme={passedCount === totalCount ? 'green' : 'yellow'}>
                          {Math.round((passedCount / totalCount) * 100)}%
                        </Badge>
                      </HStack>
                      <HStack flex="1">
                        <Text fontWeight="medium" color="gray.600">Βαθμός Εκπαιδευτικού:</Text>
                        <NumberInput
                          value={teacherPassed}
                          min={0}
                          max={totalCount}
                          size="sm"
                          w="80px"
                          onChange={(_, val) => setTeacherPassed(isNaN(val) ? 0 : val)}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontWeight="bold">/{totalCount}</Text>
                        <Badge colorScheme={teacherPassed === totalCount ? 'green' : 'yellow'}>
                          {Math.round((teacherPassed / totalCount) * 100)}%
                        </Badge>
                      </HStack>
                    </HStack>
                  </VStack>
                  <Button
                    colorScheme="green"
                    onClick={() => saveScoreMutation.mutate()}
                    isLoading={saveScoreMutation.isPending}
                    isDisabled={!submissionId}
                  >
                    Αποθήκευση βαθμολογίας
                  </Button>

                </VStack>
              </CardBody>
            </Card>
          );
        })()}
      </VStack>
    </Box>
  );
}
