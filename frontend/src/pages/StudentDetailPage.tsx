import { PageTransition } from '@/components/PageTransition';
import { SubmissionsList } from '@/components/SubmissionsList';
import { useGenerateMiniReport } from '@/hooks/use-generate-mini-report';
import { useGetStudent } from '@/hooks/use-get-student';
import { useGetStudentSubmissions } from '@/hooks/use-get-student-submissions';
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
import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { FiFileText, FiPlusCircle, FiRefreshCcw, FiUser } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [miniReport, setMiniReport] = useState<string | null | undefined>(undefined);

  const { data: student, isLoading: studentLoading } = useGetStudent(studentId);
  const { data: submissions = [], isLoading: submissionsLoading } = useGetStudentSubmissions(studentId);

  const miniReportMutation = useGenerateMiniReport({
    onSuccess: (data) => setMiniReport(data.report),
  });

  // Use saved report from DB on first load, override with freshly generated one
  const displayReport = miniReport !== undefined ? miniReport : (student?.miniReport ?? null);

  if (studentLoading) {
    return (
      <Box>
        <BackButton buttonText="Πίσω στους Φοιτητές" navigationUrl="/students" mb={6} />
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
        <BackButton buttonText="Πίσω στους Φοιτητές" navigationUrl="/students" mt={4} />
      </Box>
    );
  }

  return (
    <PageTransition>
      <Box>
        <BackButton buttonText="Πίσω στους Φοιτητές" navigationUrl="/students" mb={6} />

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
                    onClick={() => miniReportMutation.mutate(studentId!)}
                    isLoading={miniReportMutation.isPending}
                    loadingText="Δημιουργία..."
                    isDisabled={miniReportMutation.isPending || submissions.length === 0}
                    rightIcon={miniReport || student?.miniReport
                      ? <FiRefreshCcw />
                      : <FiPlusCircle />
                    }
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
                <SubmissionsList
                  submissions={submissions}
                  isLoading={submissionsLoading}
                  showExerciseTitle
                />
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </PageTransition>
  );
}
