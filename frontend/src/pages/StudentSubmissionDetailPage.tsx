import { PageTransition } from '@/components/PageTransition';
import { SubmissionDetail } from '@/components/SubmissionDetail';
import { useGetSingleSubmission } from '@/hooks/use-get-single-submission';
import { Box, Button, Skeleton, Stack, Text } from '@chakra-ui/react';
import { FiArrowLeft } from 'react-icons/fi';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export function StudentSubmissionDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { submissionId } = useParams<{ submissionId: string }>();

  const stateSubmission = location.state?.submission;

  const { data: fetchedSubmission, isLoading } = useGetSingleSubmission(submissionId, !stateSubmission);

  const submission = stateSubmission ?? fetchedSubmission;

  if (isLoading) {
    return (
      <Box>
        <Button leftIcon={<FiArrowLeft />} variant="ghost" mb={6} onClick={() => navigate(-1)}>
          Πίσω στον Φοιτητή
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
        <Button mt={4} onClick={() => navigate(-1)}>
          Πίσω
        </Button>
      </Box>
    );
  }

  return (
    <PageTransition>
      <Box>
        <Button leftIcon={<FiArrowLeft />} variant="ghost" mb={6} onClick={() => navigate(-1)}>
          Πίσω στον Φοιτητή
        </Button>
        <SubmissionDetail submission={submission} />
      </Box>
    </PageTransition>
  );
}
