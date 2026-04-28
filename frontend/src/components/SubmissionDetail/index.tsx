import { GradingAccordion } from '@/components/GradingAccordion';
import { Submission } from '@/lib/api';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiDownload } from 'react-icons/fi';

interface SubmissionDetailProps {
  submission: Submission;
}

export function SubmissionDetail({ submission }: SubmissionDetailProps) {
  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.click();
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
            <Button
              leftIcon={<FiDownload />}
              size="sm"
              colorScheme="blue"
              variant="outline"
              onClick={() => handleDownload(submission.fileUrl, submission.fileName)}
            >
              Λήψη
            </Button>
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
              <Text fontWeight="bold">Αποτελέσματα Βαθμολόγησης</Text>

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
          <Text fontSize="sm" color="yellow.300">
            Η εργασία δεν έχει βαθμολογηθεί ακόμα
          </Text>
        </Box>
      )}
    </VStack>
  );
}
