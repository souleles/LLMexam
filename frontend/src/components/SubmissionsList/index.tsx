import { Submission } from '@/lib/api';
import {
  Badge,
  Box,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiChevronRight, FiFile } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

interface SubmissionsListProps {
  submissions: Submission[];
  isLoading: boolean;
  /** Show exercise title as the primary row label (default: true) */
  showExerciseTitle?: boolean;
  /** Show student name(s) as the primary row label (default: false) */
  showStudents?: boolean;
  /** Build the navigation path for a submission row (default: /student-exercises/:id) */
  buildPath?: (submission: Submission) => string;
}

export function SubmissionsList({
  submissions,
  isLoading,
  showExerciseTitle = true,
  showStudents = false,
  buildPath = (s) => `/student-exercises/${s.id}`,
}: SubmissionsListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton height="60px" />
        <Skeleton height="60px" />
      </Stack>
    );
  }

  if (submissions.length === 0) {
    return (
      <Box textAlign="center" py={8}>
        <Text color="gray.500">Δεν υπάρχουν υποβολές</Text>
      </Box>
    );
  }

  return (
    <Box maxHeight="400px" overflowY="auto">
      <VStack align="stretch" spacing={2}>
        {submissions.map((submission) => {
          const studentNames = submission.students
            .map((s) => `${s.lastName} ${s.firstName}`)
            .join(', ');

          const primaryLabel = showStudents
            ? studentNames || '—'
            : showExerciseTitle
              ? submission.exerciseTitle
              : null;

          return (
            <Box
              key={submission.id}
              p={4}
              borderWidth="1px"
              borderRadius="md"
              cursor="pointer"
              _hover={{ bg: 'gray.700', borderColor: 'brand.400' }}
              onClick={() =>
                navigate(buildPath(submission), {
                  state: { submission },
                })
              }
            >
              <HStack justify="space-between">
                <HStack spacing={3}>
                  <Icon as={FiFile} color="gray.500" />
                  <VStack align="start" spacing={0}>
                    {primaryLabel && (
                      <Text fontWeight="medium">{primaryLabel}</Text>
                    )}
                    <Text fontSize="sm" color="gray.400">
                      {new Date(submission.createdAt).toLocaleDateString('el-GR')}{' '}
                      • {submission.fileName}
                    </Text>
                  </VStack>
                </HStack>
                <HStack spacing={2}>
                  {submission.gradingResult && (
                    <>
                      <Badge
                        colorScheme={submission.gradingResult.passedCheckpoints === submission.gradingResult.totalCheckpoints ? 'green' : submission.gradingResult.passedCheckpoints > 0 ? 'yellow' : 'red'}
                        textTransform="none"
                      >
                        LLM: {submission.gradingResult.passedCheckpoints}/
                        {submission.gradingResult.totalCheckpoints}
                      </Badge>
                      {submission.gradingResult.teacherScore != null ? (
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
          );
        })}
      </VStack>
    </Box>
  );
}
