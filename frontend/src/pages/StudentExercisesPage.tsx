import { FileUploader } from '@/components/FileUploader';
import { PageTransition } from '@/components/PageTransition';
import { GradingAccordion } from '@/components/GradingAccordion';
import { GradingResult } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useGetExercises } from '@/hooks/use-get-exercises';
import { useGetStudents } from '@/hooks/use-get-students';
import { useUploadAndGrade } from '@/hooks/use-upload-and-grade';
import { useSaveTeacherScore } from '@/hooks/use-save-teacher-score';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
  useToast,
  VStack
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FiCpu, FiSave, FiUpload } from 'react-icons/fi';
import ReactSelect from 'react-select';
import { darkSelectStyles } from '@/lib/helpers';

export function StudentExercisesPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Array<{ value: string; label: string }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [regexResults, setRegexResults] = useState<GradingResult[]>([]);
  const [llmResults, setLlmResults] = useState<GradingResult[]>([]);
  const [teacherPassed, setTeacherPassed] = useState<number>(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: exercises = [] } = useGetExercises();
  const { data: students = [] } = useGetStudents();

  const exerciseOptions = useMemo(() => exercises
    .filter((ex) => ex.status === 'approved')
    .map((ex) => ({
      value: ex.id,
      label: ex.title,
    })), [exercises]);

  const studentOptions = useMemo(() => students.map((s) => ({
    value: s.id,
    label: `${s.lastName} ${s.firstName} - ${s.studentIdentifier}`,
  })), [students]);

  const regexGradeMutation = useUploadAndGrade({
    onSuccess: (data: any) => {
      if (data.submissionId) setSubmissionId(data.submissionId);
      if (data.checkpoints) {
        setRegexResults(data.checkpoints);
        setTeacherPassed(data.checkpoints.filter((r: any) => r.matched).length);
      }
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Submissions] });
      const n = selectedStudentIds.length;
      toast({
        title: 'Ολοκληρώθηκε η βαθμολόγηση (Regex)',
        description: n === 1 ? 'Βαθμολογήθηκε 1 φοιτητής' : `Βαθμολογήθηκαν ${n} φοιτητές`,
        status: 'success',
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Σφάλμα',
        description: error?.response?.data?.message || 'Αποτυχία βαθμολόγησης εργασίας',
        status: 'error',
        duration: 5000,
      });
    },
  });

  const llmGradeMutation = useUploadAndGrade({
    onSuccess: (data: any) => {
      if (data.submissionId) setSubmissionId(data.submissionId);
      if (data.checkpoints) {
        setLlmResults(data.checkpoints);
      }
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Submissions] });
      const n = selectedStudentIds.length;
      toast({
        title: 'Ολοκληρώθηκε η βαθμολόγηση (LLM)',
        description: n === 1 ? 'Βαθμολογήθηκε 1 φοιτητής' : `Βαθμολογήθηκαν ${n} φοιτητές`,
        status: 'success',
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Σφάλμα',
        description: error?.response?.data?.message || 'Αποτυχία βαθμολόγησης με LLM',
        status: 'error',
        duration: 5000,
      });
    },
  });

  const saveScoreMutation = useSaveTeacherScore({
    onSuccess: () => {
      toast({
        title: 'Επιτυχής αποθήκευση',
        description: 'Ο βαθμός του εκπαιδευτικού αποθηκεύτηκε',
        status: 'success',
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Submissions] });
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

  const handleGrade = async (method: 'regex' | 'llm') => {
    if (!selectedExerciseId || !file || selectedStudentIds.length === 0) {
      toast({
        title: 'Λείπουν πληροφορίες',
        description: 'Παρακαλώ επιλέξτε άσκηση, φοιτητή/ές και αρχείο',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    const vars = { exerciseId: selectedExerciseId, studentIds: selectedStudentIds, file, method };
    if (method === 'regex') {
      await regexGradeMutation.mutateAsync(vars);
    } else {
      await llmGradeMutation.mutateAsync(vars);
    }
  };

  const handleTeacherGrade = async () => await saveScoreMutation.mutateAsync({ submissionId: submissionId!, score: teacherPassed })

  // Use whichever result set is non-empty to drive the accordion structure
  const allCheckpoints = regexResults.length > 0 ? regexResults : llmResults;
  const hasAnyResults = regexResults.length > 0 || llmResults.length > 0;

  const regexPassedCount = regexResults.filter((r) => r.matched).length;
  const llmPassedCount = llmResults.filter((r) => r.matched).length;
  const totalCount = allCheckpoints.length;

  return (
    <PageTransition>
      <Box>
        <VStack align="stretch" spacing={6}>
          <VStack align="start" spacing={1}>
            <Heading size="lg">Βαθμολόγηση Εργασίας Φοιτητή</Heading>
            <Text color="gray.400">
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
                    styles={darkSelectStyles}
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
                    styles={darkSelectStyles}
                  />
                  {selectedStudentIds.length > 0 && (
                    <FormHelperText>
                      <strong>{selectedStudentIds.length} επιλεγμένοι</strong>
                    </FormHelperText>
                  )}
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Αρχείο Εργασίας (.zip, .rar ή μεμονωμένο αρχείο)</FormLabel>
                  <FileUploader
                    accept=".sql,.txt,.py,.pdf,.docx,.js,.ts,.tsx,.zip,.rar"
                    maxFiles={1}
                    onFilesSelected={(files) => setFile(files[0] || null)}
                  />
                  <FormHelperText>
                    ZIP ή RAR αρχείο με πολλαπλά αρχεία ή ένα μεμονωμένο αρχείο
                  </FormHelperText>
                </FormControl>

                <HStack w="full" spacing={3}>
                  <Button
                    leftIcon={<FiUpload />}
                    colorScheme="brand"
                    size="lg"
                    flex="1"
                    onClick={() => handleGrade('regex')}
                    isLoading={regexGradeMutation.isPending}
                    loadingText="Βαθμολόγηση..."
                  >
                    Βαθμολόγηση με Regex Patterns
                  </Button>
                  <Button
                    leftIcon={<FiCpu />}
                    colorScheme="purple"
                    size="lg"
                    flex="1"
                    onClick={() => handleGrade('llm')}
                    isLoading={llmGradeMutation.isPending}
                    loadingText="Βαθμολόγηση με LLM..."
                  >
                    Βαθμολόγηση με LLM
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Results */}
          {hasAnyResults && (
            <Card>
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <VStack align="stretch" spacing={2}>
                    <Heading size="md">Αποτελέσματα Βαθμολόγησης</Heading>
                    <Text fontSize="sm" color="gray.500">
                      {selectedStudentIds.map((s) => s.label).join(' · ')}
                    </Text>
                  </VStack>

                  <GradingAccordion
                    items={allCheckpoints.map((cp) => {
                      const regex = regexResults.find((r) => r.checkpointId === cp.checkpointId);
                      const llm = llmResults.find((r) => r.checkpointId === cp.checkpointId);
                      return {
                        checkpointId: cp.checkpointId,
                        checkpointDescription: cp.checkpointDescription,
                        ...(regex && { regexMatched: regex.matched, regexSnippets: regex.matchedSnippets }),
                        ...(llm && { llmMatched: llm.matched, llmSnippets: llm.matchedSnippets }),
                      };
                    })}
                  />

                  <VStack align="stretch" spacing={2}>
                    <HStack spacing={4} pt={1} w="full" flexWrap="wrap">
                      {regexResults.length > 0 && (
                        <HStack flex="1" minW="160px">
                          <Text fontWeight="medium" color="gray.400">Βαθμός Regex:</Text>
                          <Text fontWeight="bold">{regexPassedCount}/{totalCount}</Text>
                          <Badge colorScheme={regexPassedCount === totalCount ? 'green' : 'yellow'}>
                            {Math.round((regexPassedCount / totalCount) * 100)}%
                          </Badge>
                        </HStack>
                      )}
                      <HStack flex="1" minW="160px">
                        <Text fontWeight="medium" color="gray.400">Βαθμός LLM:</Text>
                        {llmResults.length > 0
                          ? (
                            <>
                              <Text fontWeight="bold">{llmPassedCount}/{totalCount}</Text>
                              <Badge colorScheme={llmPassedCount === totalCount ? 'green' : 'yellow'}>
                                {Math.round((llmPassedCount / totalCount) * 100)}%
                              </Badge>
                            </>
                          )
                          : <Text fontWeight="bold">Δεν έχει βαθμολογηθεί</Text>
                        }
                      </HStack>
                    </HStack>
                  </VStack>
                  <Divider />
                  <VStack align="stretch">
                    <HStack w="full" flexWrap="wrap">
                      <HStack flex={1} minW="300px">
                        <Text fontWeight="medium" color="gray.400">Βαθμός Εκπαιδευτικού:</Text>
                        <NumberInput
                          value={teacherPassed}
                          min={0}
                          max={totalCount}
                          size="sm"
                          w="80px"
                          onChange={(_, val) => setTeacherPassed(isNaN(val) ? 0 : Math.min(totalCount, Math.max(0, val)))}
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
                      <HStack flex={1}>
                        <Button
                          rightIcon={<FiSave />}
                          colorScheme="green"
                          onClick={handleTeacherGrade}
                          isLoading={saveScoreMutation.isPending}
                          isDisabled={!submissionId}
                        >
                          Αποθήκευση βαθμολογίας Εκπαιδευτικού
                        </Button>
                      </HStack>
                    </HStack>
                  </VStack>
                </VStack>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Box>
    </PageTransition>
  );
}
