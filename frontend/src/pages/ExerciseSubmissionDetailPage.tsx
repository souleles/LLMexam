import { BackButton } from '@/components/BackButton';
import { PageTransition } from '@/components/PageTransition';
import { SubmissionDetail } from '@/components/SubmissionDetail';
import { useGetSingleSubmission } from '@/hooks/use-get-single-submission';
import { Box, Skeleton, Stack, Text } from '@chakra-ui/react';
import { useLocation, useParams } from 'react-router-dom';

export function ExerciseSubmissionDetailPage() {
  const location = useLocation();
  const { exerciseId, submissionId } = useParams<{ exerciseId: string; submissionId: string }>();

  const stateSubmission = location.state?.submission;

  const { data: fetchedSubmission, isLoading } = useGetSingleSubmission(submissionId, !stateSubmission);

  const submission = stateSubmission ?? fetchedSubmission;

  if (isLoading) {
    return (
      <Box>
        <BackButton buttonText="Πίσω στην Άσκηση" navigationUrl={`/exercises/${exerciseId}`} mb={6} />
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
        <BackButton buttonText="Πίσω στην Άσκηση" navigationUrl={`/exercises/${exerciseId}`} mt={4} />
      </Box>
    );
  }

  return (
    <PageTransition>
      <Box>
        <BackButton buttonText="Πίσω στην Άσκηση" navigationUrl={`/exercises/${exerciseId}`} mb={6} />
        <SubmissionDetail submission={submission} />
      </Box>
    </PageTransition>
  );
}
