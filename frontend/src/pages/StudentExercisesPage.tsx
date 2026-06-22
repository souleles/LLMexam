import { ExplainRegexFailuresButton } from '@/components/ExplainRegexFailuresButton';
import { FileUploader } from '@/components/FileUploader';
import { PageTransition } from '@/components/PageTransition';
import { GradingAccordion } from '@/components/GradingAccordion';
import { ExerciseType, Submission } from '@/lib/api';
import { mapCheckpointResultsToAccordionItems } from '@/lib/helpers';
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
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [teacherPassed, setTeacherPassed] = useState<number>(0);
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

  const selectedExercise = useMemo(
    () => exercises.find((ex) => ex.id === selectedExerciseId),
    [exercises, selectedExerciseId],
  );
  const isProjectExercise = selectedExercise?.exerciseType === ExerciseType.PROJECT;

  const studentOptions = useMemo(() => students.map((s) => ({
    value: s.id,
    label: `${s.lastName} ${s.firstName} - ${s.studentIdentifier}`,
  })), [students]);

  const regexGradeMutation = useUploadAndGrade({
    onSuccess: (data: Submission) => {
      setSubmission(data);
      if (data.gradingResult?.passedCheckpoints != null) {
        setTeacherPassed(data.gradingResult.passedCheckpoints);
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
    onSuccess: (data: Submission) => {
      setSubmission(data);
      // No regex results yet (first grade for this submission) — default the
      // teacher override to the LLM pass count instead of leaving it at 0.
      if (data.gradingResult?.passedCheckpoints == null && data.gradingResult?.llmPassedCheckpoints != null) {
        setTeacherPassed(data.gradingResult.llmPassedCheckpoints);
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

  const handleTeacherGrade = async () => await saveScoreMutation.mutateAsync({ submissionId: submission!.id, score: teacherPassed })

  const gradingResult = submission?.gradingResult ?? null;
  const hasAnyResults = !!gradingResult;
  const totalCount = gradingResult?.totalCheckpoints ?? 0;
  const regexPassedCount = gradingResult?.passedCheckpoints ?? null;
  const llmPassedCount = gradingResult?.llmPassedCheckpoints ?? null;
  const projectReport = gradingResult?.projectReport ?? null;
  const hasFailedRegexCheckpoints =
    !isProjectExercise && (gradingResult?.checkpointResults ?? []).some((cr) => cr.matched === false);

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

                {selectedExercise?.exerciseType && <HStack w="full" spacing={3}>
                  {!isProjectExercise && (
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
                  )}
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
                </HStack>}
              </VStack>
            </CardBody>
          </Card>

          {/* Results */}
          <Card>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" align="start">
                  <VStack align="stretch" spacing={2}>
                    <Heading size="md">Αποτελέσματα Βαθμολόγησης</Heading>
                    <Text fontSize="sm" color="gray.500">
                      {selectedStudentIds.map((s) => s.label).join(' · ')}
                    </Text>
                  </VStack>
                  {submission && (
                    <ExplainRegexFailuresButton
                      submissionId={submission.id}
                      hasFailedRegex={hasFailedRegexCheckpoints}
                      onExplained={setSubmission}
                    />
                  )}
                </HStack>

                {regexGradeMutation.isPending || llmGradeMutation.isPending ? (
                  <HStack spacing={3} justify="center" py={10}>
                    <Text fontSize="lg" color="gray.600">Βαθμολόγηση σε εξέλιξη...</Text>
                  </HStack>
                )
                  : hasAnyResults
                    ? <>
                      <GradingAccordion items={mapCheckpointResultsToAccordionItems(gradingResult!)} />

                      <VStack align="stretch" spacing={2}>
                        <HStack spacing={4} pt={1} w="full" flexWrap="wrap">
                          {regexPassedCount != null && (
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
                            {llmPassedCount != null
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
                      {isProjectExercise && projectReport && (
                        <>
                          <Divider />
                          <VStack align="stretch" spacing={1}>
                            <Text fontWeight="bold" fontSize="sm">Project Report</Text>
                            <Text fontSize="sm" color="gray.200" lineHeight="tall">{projectReport}</Text>
                          </VStack>
                        </>
                      )}
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
                              isDisabled={!submission}
                            >
                              Αποθήκευση βαθμολογίας Εκπαιδευτικού
                            </Button>
                          </HStack>
                        </HStack>
                      </VStack>
                    </>
                    : <Text color="gray.500" fontStyle="italic">
                      Δεν υπάρχουν αποτελέσματα προς εμφάνιση. Παρακαλώ ανεβάστε ένα αρχείο και βαθμολογήστε για να δείτε τα αποτελέσματα εδώ.
                    </Text>}
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </PageTransition>
  );
}
