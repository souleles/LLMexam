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
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiChevronRight, FiFile, FiUser } from 'react-icons/fi';

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
