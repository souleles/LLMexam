import { api } from '@/lib/api';
import { PageTransition } from '@/components/PageTransition';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  HStack,
  Icon,
  Skeleton,
  Spinner,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiChevronRight, FiFile, FiFileText, FiUser } from 'react-icons/fi';

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [miniReport, setMiniReport] = useState<string | null | undefined>(undefined);

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

  const miniReportMutation = useMutation({
    mutationFn: () => api.students.getMiniReport(studentId!),
    onSuccess: (data) => setMiniReport(data.report),
  });

  // Use saved report from DB on first load, override with freshly generated one
  const displayReport = miniReport !== undefined ? miniReport : (student?.miniReport ?? null);

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
        <Text fontSize="lg" color="gray.400">
          Ο φοιτητής δεν βρέθηκε
        </Text>
        <Button mt={4} onClick={() => navigate('/students')}>
          Πίσω στους Φοιτητές
        </Button>
      </Box>
    );
  }

  return (
    <PageTransition>
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
                  bg="brand.900"
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
                    <Text color="gray.400">
                      <strong>ΑΜ:</strong> {student.studentIdentifier}
                    </Text>
                    {student.email && (
                      <Text color="gray.400">
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

          {/* Mini Report Card */}
          <Card>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between">
                  <HStack spacing={3}>
                    <Icon as={FiFileText} color="brand.400" boxSize={5} />
                    <Heading size="md">Mini Report</Heading>
                  </HStack>
                  <Button
                    size="sm"
                    colorScheme="brand"
                    onClick={() => miniReportMutation.mutate()}
                    isLoading={miniReportMutation.isPending}
                    loadingText="Δημιουργία..."
                    isDisabled={miniReportMutation.isPending}
                  >
                    {miniReport || student?.miniReport ? 'Ανανέωση' : 'Δημιουργία'}
                  </Button>
                </HStack>

                {miniReportMutation.isPending && (
                  <HStack spacing={3} py={4} justify="center">
                    <Spinner size="sm" color="brand.400" />
                    <Text color="gray.400" fontSize="sm">
                      Δημιουργία report με AI...
                    </Text>
                  </HStack>
                )}

                {miniReportMutation.isError && (
                  <Text color="red.400" fontSize="sm">
                    Σφάλμα κατά τη δημιουργία του report. Παρακαλώ δοκιμάστε ξανά.
                  </Text>
                )}

                {displayReport && !miniReportMutation.isPending && (
                  <Box>
                    {student?.miniReportAt && miniReport === undefined && (
                      <Text fontSize="xs" color="gray.500" mb={2}>
                        Τελευταία ενημέρωση: {new Date(student.miniReportAt).toLocaleString('el-GR')}
                      </Text>
                    )}
                    <Box
                      p={4}
                      bg="gray.750"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="gray.600"
                      maxHeight="300px"
                      overflowY="auto"
                    >
                      <Text fontSize="sm" lineHeight="tall" whiteSpace="pre-wrap" color="gray.200">
                        {displayReport}
                      </Text>
                    </Box>
                  </Box>
                )}

                {!displayReport && !miniReportMutation.isPending && !miniReportMutation.isError && (
                  <Text color="gray.500" fontSize="sm" textAlign="center" py={4}>
                    Πατήστε «Δημιουργία» για να δημιουργηθεί αξιολογητικό report για τον φοιτητή.
                  </Text>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Submissions Card */}
          <Card>
            <CardBody>
              <VStack align="stretch" spacing={4}>
                <Heading size="md">Υποβεβλημένες Εργασίες</Heading>

                {submissionsLoading ? (
                  <Stack spacing={3}>
                    <Skeleton height="60px" />
                    <Skeleton height="60px" />
                  </Stack>
                ) : submissions.length === 0 ? (
                  <Box textAlign="center" py={8}>
                    <Text color="gray.500">Δεν υπάρχουν υποβολές για αυτόν τον φοιτητή</Text>
                  </Box>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {submissions.map((submission) => (
                      <Box
                        key={submission.id}
                        p={4}
                        borderWidth="1px"
                        borderRadius="md"
                        cursor="pointer"
                        _hover={{ bg: 'gray.700', borderColor: 'brand.400' }}
                        onClick={() =>
                          navigate(`/student-exercises/${submission.id}`, { state: { submission } })
                        }
                      >
                        <HStack justify="space-between">
                          <HStack spacing={3}>
                            <Icon as={FiFile} color="gray.500" />
                            <VStack align="start" spacing={0}>
                              <Text fontWeight="medium">{submission.exerciseTitle}</Text>
                              <Text fontSize="sm" color="gray.400">
                                {new Date(submission.createdAt).toLocaleDateString('el-GR')} •{' '}
                                {submission.fileName}
                              </Text>
                            </VStack>
                          </HStack>
                          <HStack spacing={2}>
                            {submission.gradingResult && (
                              <>
                                <Badge
                                  colorScheme={submission.gradingResult.passed ? 'green' : 'red'}
                                  textTransform="none"
                                >
                                  {submission.gradingResult.passedCheckpoints}/
                                  {submission.gradingResult.totalCheckpoints}
                                </Badge>
                                {submission.gradingResult.teacherScore !== null &&
                                  submission.gradingResult.teacherScore !== undefined ? (
                                  <Badge colorScheme="blue" textTransform="none">
                                    Καθηγητής: {submission.gradingResult.teacherScore}/
                                    {submission.gradingResult.totalCheckpoints}
                                  </Badge>
                                ) : (
                                  <Text fontSize="sm" fontWeight="bold">
                                    {Math.round(submission.gradingResult.score)}%
                                  </Text>
                                )}
                              </>
                            )}
                            <Icon as={FiChevronRight} color="gray.400" />
                          </HStack>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                )}
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </PageTransition>
  );
}
