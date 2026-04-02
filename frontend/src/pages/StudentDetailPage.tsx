import { api, StudentSubmission } from '@/lib/api';
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
  Heading,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiDownload, FiFile, FiX, FiUser } from 'react-icons/fi';

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['students', studentId],
    queryFn: () => api.students.get(studentId!),
    enabled: !!studentId,
  });

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['students', studentId, 'submissions'],
    queryFn: () => api.students.getSubmissions(studentId!),
    enabled: !!studentId,
  });

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  if (studentLoading) {
    return (
      <Box>
        <Button leftIcon={<FiArrowLeft />} variant="ghost" mb={6} onClick={() => navigate('/students')}>
          Πίσω στους Φοιτητές
        </Button>
        <Stack spacing={4}>
          <Skeleton height="150px" />
          <Skeleton height="400px" />
        </Stack>
      </Box>
    );
  }

  if (!student) {
    return (
      <Box textAlign="center" py={12}>
        <Text fontSize="lg" color="gray.600">
          Ο φοιτητής δεν βρέθηκε
        </Text>
        <Button mt={4} onClick={() => navigate('/students')}>
          Πίσω στους Φοιτητές
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Button leftIcon={<FiArrowLeft />} variant="ghost" mb={6} onClick={() => navigate('/students')}>
        Πίσω στους Φοιτητές
      </Button>

      <VStack align="stretch" spacing={6}>
        {/* Student Info Card */}
        <Card>
          <CardBody>
            <HStack spacing={4}>
              <Box
                p={4}
                bg="brand.50"
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon as={FiUser} boxSize={8} color="brand.500" />
              </Box>
              <VStack align="start" spacing={1} flex={1}>
                <Heading size="md">
                  {student.lastName} {student.firstName}
                </Heading>
                <HStack spacing={4}>
                  <Text color="gray.600">
                    <strong>ΑΜ:</strong> {student.studentIdentifier}
                  </Text>
                  {student.email && (
                    <Text color="gray.600">
                      <strong>Email:</strong> {student.email}
                    </Text>
                  )}
                </HStack>
              </VStack>
              <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
                {submissions.length} Υποβολές
              </Badge>
            </HStack>
          </CardBody>
        </Card>

        {/* Submissions Card */}
        <Card>
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <Heading size="md">Υποβεβλημένες Εργασίες</Heading>

              {submissionsLoading ? (
                <Stack spacing={3}>
                  <Skeleton height="100px" />
                  <Skeleton height="100px" />
                </Stack>
              ) : submissions.length === 0 ? (
                <Box textAlign="center" py={8}>
                  <Text color="gray.500">Δεν υπάρχουν υποβολές για αυτόν τον φοιτητή</Text>
                </Box>
              ) : (
                <Accordion allowMultiple>
                  {submissions.map((submission) => (
                    <AccordionItem key={submission.id}>
                      <h2>
                        <AccordionButton>
                          <Box flex="1" textAlign="left">
                            <HStack>
                              <Icon as={FiFile} color="gray.500" />
                              <VStack align="start" spacing={0}>
                                <Text fontWeight="medium">{submission.exerciseTitle}</Text>
                                <Text fontSize="sm" color="gray.600">
                                  {new Date(submission.createdAt).toLocaleDateString('el-GR')} •{' '}
                                  {submission.fileName}
                                </Text>
                              </VStack>
                            </HStack>
                          </Box>
                          {submission.gradingResult && (
                            <HStack spacing={2} mr={2}>
                              <Badge
                                colorScheme={submission.gradingResult.passed ? 'green' : 'red'}
                              >
                                {submission.gradingResult.passedCheckpoints}/
                                {submission.gradingResult.totalCheckpoints}
                              </Badge>
                              <Text fontSize="sm" fontWeight="bold">
                                {Math.round(submission.gradingResult.score)}%
                              </Text>
                            </HStack>
                          )}
                          <AccordionIcon />
                        </AccordionButton>
                      </h2>
                      <AccordionPanel pb={4}>
                        <VStack align="stretch" spacing={4}>
                          {/* File Info */}
                          <Box>
                            <HStack justify="space-between">
                              <VStack align="start" spacing={1}>
                                <Text fontSize="sm" fontWeight="medium">
                                  Αρχείο Υποβολής
                                </Text>
                                <Text fontSize="sm" color="gray.600">
                                  {submission.fileName} ({submission.fileType})
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
                          </Box>

                          {/* Participating Students */}
                          {submission.students.length > 1 && (
                            <Box>
                              <Text fontSize="sm" fontWeight="medium" mb={2}>
                                Συμμετέχοντες Φοιτητές
                              </Text>
                              <HStack flexWrap="wrap" gap={2}>
                                {submission.students.map((s) => (
                                  <Badge key={s.id} colorScheme="purple">
                                    {s.lastName} {s.firstName} - {s.studentIdentifier}
                                  </Badge>
                                ))}
                              </HStack>
                            </Box>
                          )}

                          {/* Grading Results */}
                          {submission.gradingResult ? (
                            <Box>
                              <Text fontSize="sm" fontWeight="medium" mb={3}>
                                Αποτελέσματα Βαθμολόγησης
                              </Text>

                              {/* Summary */}
                              <HStack spacing={6} mb={4} p={3} bg="gray.50" borderRadius="md">
                                <VStack align="start" spacing={0}>
                                  <Text fontSize="xs" color="gray.600">
                                    Βαθμός LLM
                                  </Text>
                                  <HStack>
                                    <Text fontWeight="bold">
                                      {submission.gradingResult.passedCheckpoints}/
                                      {submission.gradingResult.totalCheckpoints}
                                    </Text>
                                    <Badge
                                      colorScheme={
                                        submission.gradingResult.score >= 50 ? 'green' : 'red'
                                      }
                                    >
                                      {Math.round(submission.gradingResult.score)}%
                                    </Badge>
                                  </HStack>
                                </VStack>
                                {submission.gradingResult.teacherScore !== null &&
                                  submission.gradingResult.teacherScore !== undefined && (
                                    <VStack align="start" spacing={0}>
                                      <Text fontSize="xs" color="gray.600">
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
                                <VStack align="start" spacing={0}>
                                  <Text fontSize="xs" color="gray.600">
                                    Κατάσταση
                                  </Text>
                                  <Badge
                                    colorScheme={submission.gradingResult.passed ? 'green' : 'red'}
                                  >
                                    {submission.gradingResult.passed ? 'ΠΕΤΥΧΕ' : 'ΑΠΕΤΥΧΕ'}
                                  </Badge>
                                </VStack>
                              </HStack>

                              {/* Checkpoint Results Table */}
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
                                  {submission.gradingResult.checkpointResults.map((cr) => (
                                    <Tr key={cr.id}>
                                      <Td>{cr.checkpointOrder}</Td>
                                      <Td>
                                        <Text fontSize="sm">{cr.checkpointDescription}</Text>
                                        {cr.matched && cr.matchedSnippets.length > 0 && (
                                          <Text fontSize="xs" color="gray.600" mt={1}>
                                            {cr.matchedSnippets.length} αντιστοιχίσεις
                                          </Text>
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
                            </Box>
                          ) : (
                            <Box p={4} bg="yellow.50" borderRadius="md">
                              <Text fontSize="sm" color="yellow.800">
                                Η εργασία δεν έχει βαθμολογηθεί ακόμα
                              </Text>
                            </Box>
                          )}
                        </VStack>
                      </AccordionPanel>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}
