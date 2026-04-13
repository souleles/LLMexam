import { PageTransition } from '@/components/PageTransition';
import { SubmissionDetail } from '@/components/SubmissionDetail';
import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { Box, Button, Skeleton, Stack, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft } from 'react-icons/fi';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export function ExerciseSubmissionDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { exerciseId, submissionId } = useParams<{ exerciseId: string; submissionId: string }>();

  const stateSubmission = location.state?.submission;

  const { data: fetchedSubmission, isLoading } = useQuery({
    queryKey: [QueryKeys.Submissions, submissionId],
    queryFn: () => api.submissions.get(submissionId!),
    enabled: !!submissionId && !stateSubmission,
  });

  const submission = stateSubmission ?? fetchedSubmission;

  if (isLoading) {
    return (
      <Box>
        <Button
          leftIcon={<FiArrowLeft />}
          variant="ghost"
          mb={6}
          onClick={() => navigate(`/exercises/${exerciseId}`)}
        >
          Πίσω στην Άσκηση
        </Button>
        <Stack spacing={4}>
          <Skeleton height="60px" />
          <Skeleton height="300px" />
        </Stack>
      </Box>
    );
  }

  if (!submission) {
    return (
      <Box textAlign="center" py={12}>
        <Text fontSize="lg" color="gray.400">
          Δεν βρέθηκαν δεδομένα υποβολής
        </Text>
        <Button mt={4} onClick={() => navigate(`/exercises/${exerciseId}`)}>
          Πίσω στην Άσκηση
        </Button>
      </Box>
    );
  }

  return (
    <PageTransition>
      <Box>
        <Button
          leftIcon={<FiArrowLeft />}
          variant="ghost"
          mb={6}
          onClick={() => navigate(`/exercises/${exerciseId}`)}
        >
          Πίσω στην Άσκηση
        </Button>
        <SubmissionDetail submission={submission} />
      </Box>
    </PageTransition>
  );
}
