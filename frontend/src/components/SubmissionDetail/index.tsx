import { Submission } from '@/lib/api';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Code,
  Heading,
  HStack,
  Icon,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { FiCheck, FiDownload, FiX } from 'react-icons/fi';

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
              <Text fontWeight="medium">Αρχείο Υποβολής</Text>
              <Text fontSize="sm" color="gray.400">
                {submission.fileName} ({submission.fileType}) •{' '}
                {new Date(submission.createdAt).toLocaleDateString('el-GR')}
              </Text>
            </VStack>
            <Button
              leftIcon={<FiDownload />}
              size="sm"
              colorScheme="blue"
              variant="ghost"
              onClick={() => handleDownload(submission.fileUrl, submission.fileName)}
            >
              Λήψη
            </Button>
          </HStack>
        </CardBody>
      </Card>

      {/* Participating Students */}
      {submission.students.length > 1 && (
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
              <Text fontWeight="medium">Αποτελέσματα Βαθμολόγησης</Text>

              {/* Summary */}
              <HStack spacing={6} p={3} bg="gray.700" borderRadius="md">
                <VStack align="start" spacing={0}>
                  <Text fontSize="xs" color="gray.400">
                    Βαθμός LLM
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
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th w="50px">#</Th>
                    <Th>Checkpoint</Th>
                    <Th w="100px" textAlign="center">
                      Κατάσταση
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(submission.gradingResult.checkpointResults ?? []).map((cr) => (
                    <Tr key={cr.id}>
                      <Td>{cr.checkpointOrder}</Td>
                      <Td>
                        <Text fontSize="sm">{cr.checkpointDescription}</Text>
                        {cr.matched && cr.matchedSnippets.length > 0 && (
                          <VStack align="start" spacing={1} mt={2}>
                            {cr.matchedSnippets.map((raw, idx) => {
                              const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
                              return (
                                <Box key={idx}>
                                  <Text fontSize="xs" color="gray.400">
                                    {s.file ? `${s.file} — Γραμμή ${s.line}` : `Γραμμή ${s.line}`}:
                                  </Text>
                                  <Code fontSize="xs" p={1} borderRadius="md" display="block">
                                    {s.snippet}
                                  </Code>
                                </Box>
                              );
                            })}
                          </VStack>
                        )}
                      </Td>
                      <Td textAlign="center">
                        {cr.matched ? (
                          <Icon as={FiCheck} color="green.500" boxSize={5} />
                        ) : (
                          <Icon as={FiX} color="red.500" boxSize={5} />
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
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
