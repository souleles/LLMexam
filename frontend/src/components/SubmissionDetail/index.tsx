import { DownloadButton } from '@/components/DownloadButton';
import { GradingAccordion } from '@/components/GradingAccordion';
import { useRegradeSubmission } from '@/hooks/use-regrade-submission';
import { useSaveTeacherScore } from '@/hooks/use-save-teacher-score';
import { Submission } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FiEdit2, FiRefreshCw } from 'react-icons/fi';

interface SubmissionDetailProps {
  submission: Submission;
}

export function SubmissionDetail({ submission }: SubmissionDetailProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const queryClient = useQueryClient();

  const total = submission.gradingResult?.totalCheckpoints ?? 0;
  const existingScore = submission.gradingResult?.teacherScore ?? null;
  const [scoreValue, setScoreValue] = useState<number | ''>(existingScore ?? '');

  const saveScoreMutation = useSaveTeacherScore({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Submissions, submission.id] });
      toast({ title: 'Η βαθμολογία αποθηκεύτηκε', status: 'success', duration: 3000 });
      onClose();
    },
    onError: () => {
      toast({ title: 'Σφάλμα αποθήκευσης βαθμολογίας', status: 'error', duration: 3000 });
    },
  });

  const handleOpen = () => {
    setScoreValue(submission.gradingResult?.teacherScore ?? '');
    onOpen();
  };

  const handleSave = async () => {
    if (scoreValue === '') return;
    await saveScoreMutation.mutateAsync({ submissionId: submission.id, score: scoreValue });
  };

  const regradeMutation = useRegradeSubmission({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Submissions, submission.id] });
      toast({ title: 'Η βαθμολόγηση ολοκληρώθηκε', status: 'success', duration: 3000 });
    },
    onError: () => {
      toast({ title: 'Σφάλμα βαθμολόγησης', status: 'error', duration: 3000 });
    },
  });

  const handleRegrade = (method: 'regex' | 'llm') => {
    regradeMutation.mutate({ submissionId: submission.id, method });
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="md">{submission.exerciseTitle}</Heading>

      {/* File Info */}
      <Card>
        <CardBody>
          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Text fontWeight="bold">Αρχείο Υποβολής</Text>
              <Text fontSize="sm" color="gray.400">
                {submission.fileName} ({submission.fileType}) •{' '}
                {new Date(submission.createdAt).toLocaleDateString('el-GR')}
              </Text>
            </VStack>
            <DownloadButton
              url={`${import.meta.env.VITE_API_BASE_URL}/api/submissions/${submission.id}/download`}
              colorScheme="blue"
            />
          </HStack>
        </CardBody>
      </Card>

      {/* Participating Students */}
      {submission.students.length > 0 && (
        <Card>
          <CardBody>
            <Text fontWeight="medium" mb={2}>
              Συμμετέχοντες Φοιτητές
            </Text>
            <HStack flexWrap="wrap" gap={2}>
              {submission.students.map((s) => (
                <Badge key={s.id} colorScheme="purple">
                  {s.lastName} {s.firstName} - {s.studentIdentifier}
                </Badge>
              ))}
            </HStack>
          </CardBody>
        </Card>
      )}

      {/* Grading Results */}
      {submission.gradingResult ? (
        <Card>
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Text fontWeight="bold">Αποτελέσματα Βαθμολόγησης</Text>
                <HStack>
                  <Button
                    leftIcon={<FiRefreshCw />}
                    size="sm"
                    variant="outline"
                    colorScheme="teal"
                    onClick={() => handleRegrade('regex')}
                    isLoading={regradeMutation.isPending && regradeMutation.variables?.method === 'regex'}
                    isDisabled={regradeMutation.isPending}
                  >
                    Regex
                  </Button>
                  <Button
                    leftIcon={<FiRefreshCw />}
                    size="sm"
                    variant="outline"
                    colorScheme="purple"
                    onClick={() => handleRegrade('llm')}
                    isLoading={regradeMutation.isPending && regradeMutation.variables?.method === 'llm'}
                    isDisabled={regradeMutation.isPending}
                  >
                    LLM
                  </Button>
                  <Button
                    leftIcon={<FiEdit2 />}
                    size="sm"
                    variant="outline"
                    colorScheme="blue"
                    onClick={handleOpen}
                    isDisabled={regradeMutation.isPending}
                  >
                    {existingScore != null ? 'Επεξεργασία Βαθμού' : 'Προσθήκη Βαθμού'}
                  </Button>
                </HStack>
              </HStack>

              {/* Summary */}
              <HStack spacing={12} p={3} bg="gray.700" borderRadius="md">
                <VStack align="start" spacing={0}>
                  <Text fontSize="xs" color="gray.400">
                    Βαθμός Regex
                  </Text>
                  <HStack>
                    <Text fontWeight="bold">
                      {submission.gradingResult.passedCheckpoints}/
                      {submission.gradingResult.totalCheckpoints}
                    </Text>
                    <Badge
                      colorScheme={submission.gradingResult.score >= 50 ? 'green' : 'red'}
                    >
                      {Math.round(submission.gradingResult.score)}%
                    </Badge>
                  </HStack>
                </VStack>
                {submission.gradingResult.llmScore != null && (
                  <VStack align="start" spacing={0}>
                    <Text fontSize="xs" color="gray.400">
                      Βαθμός LLM
                    </Text>
                    <HStack>
                      <Text fontWeight="bold">
                        {submission.gradingResult.llmPassedCheckpoints}/
                        {submission.gradingResult.totalCheckpoints}
                      </Text>
                      <Badge
                        colorScheme={submission.gradingResult.llmScore >= 50 ? 'green' : 'red'}
                      >
                        {Math.round(submission.gradingResult.llmScore)}%
                      </Badge>
                    </HStack>
                  </VStack>
                )}
                {submission.gradingResult.teacherScore != null && (
                  <VStack align="start" spacing={0}>
                    <Text fontSize="xs" color="gray.400">
                      Βαθμός Καθηγητή
                    </Text>
                    <HStack>
                      <Text fontWeight="bold">
                        {submission.gradingResult.teacherScore}/
                        {submission.gradingResult.totalCheckpoints}
                      </Text>
                      <Badge colorScheme="blue">
                        {Math.round(
                          (submission.gradingResult.teacherScore /
                            submission.gradingResult.totalCheckpoints) *
                          100,
                        )}
                        %
                      </Badge>
                    </HStack>
                  </VStack>
                )}
              </HStack>

              {/* Checkpoint Results */}
              <GradingAccordion
                items={(submission.gradingResult.checkpointResults ?? []).map((cr) => {
                  const parseSnippets = (raw: Array<{ file?: string; line: number; snippet: string } | string>) =>
                    raw.map((s) => (typeof s === 'string' ? JSON.parse(s) : s));
                  return {
                    checkpointId: cr.checkpointId,
                    checkpointDescription: cr.checkpointDescription,
                    regexMatched: cr.matched,
                    regexSnippets: parseSnippets(cr.matchedSnippets),
                    ...(cr.llmMatched !== undefined && {
                      llmMatched: cr.llmMatched,
                      llmSnippets: parseSnippets(cr.llmMatchedSnippets ?? []),
                    }),
                  };
                })}
              />
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <Box p={4} bg="yellow.900" borderRadius="md">
          <HStack justify="space-between">
            <Text fontSize="sm" color="yellow.300">
              Η εργασία δεν έχει βαθμολογηθεί ακόμα
            </Text>
            <HStack>
              <Button
                leftIcon={<FiRefreshCw />}
                size="sm"
                variant="outline"
                colorScheme="teal"
                onClick={() => handleRegrade('regex')}
                isLoading={regradeMutation.isPending && regradeMutation.variables?.method === 'regex'}
                isDisabled={regradeMutation.isPending}
              >
                Regex
              </Button>
              <Button
                leftIcon={<FiRefreshCw />}
                size="sm"
                variant="outline"
                colorScheme="purple"
                onClick={() => handleRegrade('llm')}
                isLoading={regradeMutation.isPending && regradeMutation.variables?.method === 'llm'}
                isDisabled={regradeMutation.isPending}
              >
                LLM
              </Button>
            </HStack>
          </HStack>
        </Box>
      )}

      {/* Teacher Score Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Βαθμολογία Εκπαιδευτικού</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={3}>
              <Text fontSize="sm" color="gray.400">
                Εισάγετε τον αριθμό checkpoints που πέρασε ο φοιτητής (0–{total}).
              </Text>
              <NumberInput
                value={scoreValue}
                min={0}
                max={total}
                onChange={(_, val) => setScoreValue(isNaN(val) ? '' : Math.min(total, Math.max(0, val)))}
              >
                <NumberInputField placeholder={`0 – ${total}`} />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              {scoreValue !== '' && (
                <Text fontSize="sm" color="gray.400">
                  {Math.round((scoreValue / total) * 100)}% ({scoreValue}/{total})
                </Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={onClose}>Ακύρωση</Button>
            <Button
              colorScheme="blue"
              onClick={handleSave}
              isDisabled={scoreValue === ''}
              isLoading={saveScoreMutation.isPending}
            >
              Αποθήκευση
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
