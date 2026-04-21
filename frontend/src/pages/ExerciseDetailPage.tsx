import { PageTransition } from '@/components/PageTransition';
import { InlineChat } from '@/components/Chat/InlineChat';
import { CheckpointsCard } from '@/components/Exercise/CheckpointsCard';
import { SubmissionsList } from '@/components/SubmissionsList';
import { ExerciseStatus } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useGetExercise } from '@/hooks/use-get-exercise';
import { useGetCheckpoints } from '@/hooks/use-get-checkpoints';
import { useGetSubmissions } from '@/hooks/use-get-submissions';
import { useDeleteExercise } from '@/hooks/use-delete-exercise';
import { useApproveExercise } from '@/hooks/use-approve-exercise';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Heading,
  HStack,
  Link,
  Skeleton,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { FiArrowLeft, FiCheck, FiDownload, FiFileText, FiTrash2 } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';

export function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { data: exercise, isLoading: exerciseLoading } = useGetExercise(exerciseId);
  const { data: checkpoints = [], isLoading: checkpointsLoading } = useGetCheckpoints(exerciseId);
  const { data: submissions = [], isLoading: submissionsLoading } = useGetSubmissions(exerciseId);

  const deleteMutation = useDeleteExercise({
    onSuccess: () => {
      toast({ title: 'Η άσκηση διαγράφηκε επιτυχώς', status: 'success', duration: 3000 });
      navigate('/exercises');
    },
    onError: () => {
      toast({ title: 'Σφάλμα διαγραφής άσκησης', status: 'error', duration: 3000 });
    },
  });

  const approveMutation = useApproveExercise({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Exercises, exerciseId] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Exercises] });
      toast({ title: 'Η άσκηση εγκρίθηκε επιτυχώς', status: 'success', duration: 3000 });
    },
    onError: () => {
      toast({ title: 'Σφάλμα έγκρισης άσκησης', status: 'error', duration: 3000 });
    },
  });

  const handleAccepted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QueryKeys.Checkpoints, exerciseId] });
  }, [exerciseId, queryClient]);

  const handleDelete = () => {
    deleteMutation.mutate(exerciseId!);
    onDeleteClose();
  };

  if (exerciseLoading || checkpointsLoading) {
    return (
      <Box>
        <Button leftIcon={<FiArrowLeft />} variant="ghost" mb={6}>
          Πίσω στις Ασκήσεις
        </Button>
        <Stack spacing={4}>
          <Skeleton height="60px" />
          <Skeleton height="400px" />
        </Stack>
      </Box>
    );
  }

  if (!exercise) {
    return (
      <Box textAlign="center" py={12}>
        <Text fontSize="lg" color="gray.400">Η άσκηση δεν βρέθηκε</Text>
        <Button mt={4} onClick={() => navigate('/exercises')}>Πίσω στις Ασκήσεις</Button>
      </Box>
    );
  }

  const isReadOnly = exercise.status !== ExerciseStatus.DRAFT;
  const canApprove = !isReadOnly && checkpoints.length > 0 && checkpoints.every((cp) => cp.pattern);

  return (
    <PageTransition>
      <Box>
        <Button leftIcon={<FiArrowLeft />} variant="ghost" mb={6} onClick={() => navigate('/exercises')}>
          Πίσω στις Ασκήσεις
        </Button>

        <VStack align="stretch" spacing={6}>
          {/* Header */}
          <HStack justify="space-between">
            <VStack align="start" spacing={2}>
              <Heading size="lg">{exercise.title}</Heading>
              <HStack>
                <Badge
                  colorScheme={exercise.status === ExerciseStatus.APPROVED ? 'green' : 'yellow'}
                  textTransform="none"
                >
                  {exercise.status === ExerciseStatus.APPROVED ? 'Εγκεκριμένο' : 'Πρόχειρο'}
                </Badge>
                <Text color="gray.400" fontSize="sm">
                  Δημιουργήθηκε {new Date(exercise.createdAt).toLocaleDateString('el-GR')}
                </Text>
              </HStack>
            </VStack>
            <HStack>
              {canApprove && (
                <Button
                  leftIcon={<FiCheck />}
                  colorScheme="green"
                  onClick={() => approveMutation.mutate(exerciseId!)}
                  isLoading={approveMutation.isPending}
                >
                  Έγκριση Άσκησης
                </Button>
              )}
              <Button
                leftIcon={<FiTrash2 />}
                colorScheme="red"
                onClick={onDeleteOpen}
                isLoading={deleteMutation.isPending}
              >
                Διαγραφή
              </Button>
            </HStack>
          </HStack>

          {/* PDF card */}
          <Card>
            <CardBody>
              <VStack align="start" spacing={4}>
                <HStack>
                  <FiFileText size={24} />
                  <Heading size="md">Ανεβασμένο Αρχείο</Heading>
                </HStack>
                <Divider />
                <HStack justify="space-between" w="full">
                  <HStack spacing={2}>
                    <FiFileText size={16} />
                    <Text fontSize="sm" color="gray.300">{exercise.title}.pdf</Text>
                  </HStack>
                  <Link
                    href={`${import.meta.env.VITE_API_BASE_URL}/api/exercises/${exercise.id}/download`}
                    download
                  >
                    <Button leftIcon={<FiDownload />} size="sm" variant="outline">
                      Λήψη
                    </Button>
                  </Link>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Checkpoints card */}
          <CheckpointsCard checkpoints={checkpoints} />

          {/* Submissions card */}
          {exercise.status !== ExerciseStatus.DRAFT && (
            <Card>
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  <Heading size="md">Υποβεβλημένες Εργασίες</Heading>
                  <SubmissionsList
                    submissions={submissions}
                    isLoading={submissionsLoading}
                    showStudents
                    buildPath={(s) => `/exercises/${exerciseId}/submissions/${s.id}`}
                  />
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Chat */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Συνομιλία & Εξαγωγή
                {isReadOnly && (
                  <Badge ml={2} colorScheme="green" textTransform="none">
                    Μόνο ανάγνωση
                  </Badge>
                )}
              </Heading>
              <Divider mb={4} />
              <Tabs variant="enclosed" colorScheme="brand" isLazy lazyBehavior="unmount">
                <TabList>
                  <Tab>Checkpoints</Tab>
                  <Tab isDisabled={checkpoints.length === 0}>
                    Patterns
                    {checkpoints.length === 0 && (
                      <Text as="span" fontSize="xs" color="gray.400" ml={2}>
                        (αποδεχτείτε checkpoints πρώτα)
                      </Text>
                    )}
                  </Tab>
                </TabList>
                <TabPanels>
                  <TabPanel px={0} pt={4}>
                    <InlineChat
                      exerciseId={exerciseId!}
                      mode="checkpoints"
                      isReadOnly={isReadOnly}
                      onAccepted={handleAccepted}
                    />
                  </TabPanel>
                  <TabPanel px={0} pt={4}>
                    <InlineChat
                      exerciseId={exerciseId!}
                      mode="patterns"
                      patternsEnabled={checkpoints.length > 0}
                      isReadOnly={isReadOnly}
                      onAccepted={handleAccepted}
                    />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </CardBody>
          </Card>
        </VStack>

        {/* Delete dialog */}
        <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Διαγραφή Άσκησης
              </AlertDialogHeader>
              <AlertDialogBody>
                Είστε σίγουροι ότι θέλετε να διαγράψετε την άσκηση "{exercise.title}";
                Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onDeleteClose}>Ακύρωση</Button>
                <Button colorScheme="red" onClick={handleDelete} ml={3}>Διαγραφή</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </Box>
    </PageTransition>
  );
}
