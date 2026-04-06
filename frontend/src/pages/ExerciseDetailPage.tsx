import { PageTransition } from '@/components/PageTransition';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  HStack,
  VStack,
  Text,
  Badge,
  Grid,
  GridItem,
  Divider,
  List,
  ListItem,
  ListIcon,
  Skeleton,
  Stack,
  Input,
  Spinner,
  Avatar,
  OrderedList,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiFileText, FiCheckCircle, FiSend, FiCheck, FiTrash2 } from 'react-icons/fi';
import { useRef, useEffect, useState, useCallback } from 'react';
import { api, Checkpoint, ConversationMessage, ExerciseStatus } from '@/lib/api';
import { useLlmStream } from '@/hooks/useLlmStream';
import { parseMessageContent } from '@/lib/parseMessageContent';
import { useAuthContext } from '@/contexts/use-auth';

// ── InlineChat ─────────────────────────────────────────────────────────────────

interface InlineChatProps {
  exerciseId: string;
  mode: 'checkpoints' | 'patterns';
  patternsEnabled?: boolean;
  checkpoints?: Checkpoint[];
  isReadOnly?: boolean;
  onAccepted: () => void;
}

function InlineChat({ exerciseId, mode, patternsEnabled = true, checkpoints = [], isReadOnly = false, onAccepted }: InlineChatProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const defaultInput =
    mode === 'checkpoints'
      ? 'Εξήγαγε όλα τα checkpoints βαθμολόγησης από αυτή την άσκηση'
      : 'Δημιούργησε regex patterns για κάθε checkpoint';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const initialScrollDone = useRef(false);

  const {
    buffer, streaming, sendMessage, error, pendingCheckpoints, clearPendingCheckpoints, pendingPatterns, clearPendingPatterns
  } = useLlmStream(exerciseId, mode);

  const conversationType = mode === 'checkpoints' ? 'CHECKPOINT' : 'PATTERN';

  const { data: dbMessages = [] } = useQuery({
    queryKey: ['conversations', exerciseId, conversationType],
    queryFn: () => api.conversations.listByType(exerciseId, conversationType),
    enabled: !!exerciseId && (mode === 'checkpoints' || patternsEnabled),
    staleTime: Infinity,
  });

  // Seed from DB once and scroll to bottom
  useEffect(() => {
    if (!seeded.current && dbMessages.length > 0) {
      seeded.current = true;
      setMessages(dbMessages.map((m) => ({ ...m, content: parseMessageContent(m.content) || m.content })));
    }
  }, [dbMessages]);

  // Initial scroll after messages are rendered (without scrolling the page)
  useEffect(() => {
    if (seeded.current && !initialScrollDone.current && messagesBoxRef.current && messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        if (messagesBoxRef.current) {
          messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
          initialScrollDone.current = true;
        }
      });
    }
  }, [messages]);

  // Pre-populate input when no history
  useEffect(() => {
    if (dbMessages.length === 0 && messages.length === 0) {
      setInput(defaultInput);
    }
  }, [dbMessages.length, messages.length, defaultInput]);

  // Finalize assistant bubble when streaming ends
  const prevStreaming = useRef(false);
  useEffect(() => {
    if (prevStreaming.current && !streaming && buffer) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          exerciseId,
          role: 'assistant',
          content: buffer,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    prevStreaming.current = streaming;
  }, [streaming, buffer, exerciseId]);

  // Scroll to bottom on new messages (after initial load)
  useEffect(() => {
    if (initialScrollDone.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, streaming]);

  const acceptCheckpointsMutation = useMutation({
    mutationFn: () => api.checkpoints.bulkReplace(exerciseId, pendingCheckpoints),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkpoints', exerciseId] });
      clearPendingCheckpoints();
      onAccepted();
      toast({ title: 'Checkpoints αποθηκεύτηκαν', status: 'success', duration: 3000 });
    },
    onError: () => {
      toast({ title: 'Σφάλμα αποθήκευσης checkpoints', status: 'error', duration: 3000 });
    },
  });

  const acceptPatternsMutation = useMutation({
    mutationFn: () =>
      api.checkpoints.bulkUpdatePatterns(
        exerciseId,
        pendingPatterns.map((p) => ({ order: p.order, pattern: p.pattern, patternDescription: p.patternDescription })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkpoints', exerciseId] });
      clearPendingPatterns();
      onAccepted();
      toast({ title: 'Patterns αποθηκεύτηκαν', status: 'success', duration: 3000 });
    },
    onError: () => {
      toast({ title: 'Σφάλμα αποθήκευσης patterns', status: 'error', duration: 3000 });
    },
  });

  const handleSend = useCallback(() => {
    if (!input.trim() || streaming) return;
    const text = input;
    setMessages((prev) => [
      ...prev,
      {
        id: `professor-${Date.now()}`,
        exerciseId,
        role: 'professor',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    sendMessage(text);
    setInput('');
  }, [input, streaming, sendMessage, exerciseId]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasPending = mode === 'checkpoints' ? pendingCheckpoints.length > 0 : pendingPatterns.length > 0;
  const pendingCount = mode === 'checkpoints' ? pendingCheckpoints.length : pendingPatterns.length;
  const acceptMutation = mode === 'checkpoints' ? acceptCheckpointsMutation : acceptPatternsMutation;
  const acceptLabel = mode === 'checkpoints' ? 'Αποδοχή Checkpoints' : 'Αποδοχή Patterns';

  const emptyLabel =
    mode === 'checkpoints'
      ? 'Ξεκινήστε ζητώντας από την AI να εξάγει checkpoints από την άσκηση'
      : 'Ζητήστε από την AI να δημιουργήσει regex patterns για τα checkpoints';
  console.log({ messages, pendingPatterns, pendingCheckpoints });

  return (
    <VStack align="stretch" spacing={4}>
      {!isReadOnly && (
        <HStack justify="flex-end">
          {hasPending && (
            <Button
              leftIcon={<FiCheck />}
              colorScheme="green"
              size="sm"
              isLoading={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
            >
              {acceptLabel} ({pendingCount})
            </Button>
          )}
        </HStack>
      )}

      {/* Messages area */}
      <Box ref={messagesBoxRef} h="400px" overflowY="auto" p={2} bg="gray.850" borderRadius="md">
        <VStack spacing={4} align="stretch">
          {messages.length === 0 && !streaming && (
            <Box textAlign="center" py={8}>
              <Text color="gray.500" fontSize="sm">{emptyLabel}</Text>
            </Box>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {streaming && buffer && (
            <MessageBubble
              message={{
                id: 'streaming',
                exerciseId,
                role: 'assistant',
                content: buffer,
                createdAt: new Date().toISOString(),
              }}
              isStreaming
            />
          )}

          {error && (
            <Text fontSize="sm" color="red.500" textAlign="center">{error}</Text>
          )}

          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Input — hidden when read-only */}
      {!isReadOnly && (
        <HStack>
          <Input
            placeholder={mode === 'checkpoints' ? 'Ρωτήστε για checkpoints...' : 'Ρωτήστε για patterns...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={streaming}
          />
          <Button
            leftIcon={streaming ? <Spinner size="sm" /> : <FiSend />}
            colorScheme="brand"
            onClick={handleSend}
            isDisabled={!input.trim() || streaming}
          >
            Αποστολή
          </Button>
        </HStack>
      )}
    </VStack>
  );
}

// ── ExerciseDetailPage ────────────────────────────────────────────────────────

export function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { data: exercise, isLoading: exerciseLoading } = useQuery({
    queryKey: ['exercises', exerciseId],
    queryFn: () => api.exercises.get(exerciseId!),
    enabled: !!exerciseId,
  });

  const { data: checkpoints = [], isLoading: checkpointsLoading } = useQuery({
    queryKey: ['checkpoints', exerciseId],
    queryFn: () => api.checkpoints.list(exerciseId!),
    enabled: !!exerciseId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.exercises.delete(exerciseId!),
    onSuccess: () => {
      toast({ title: 'Η άσκηση διαγράφηκε επιτυχώς', status: 'success', duration: 3000 });
      navigate('/exercises');
    },
    onError: () => {
      toast({ title: 'Σφάλμα διαγραφής άσκησης', status: 'error', duration: 3000 });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => api.exercises.approve(exerciseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', exerciseId] });
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast({ title: 'Η άσκηση εγκρίθηκε επιτυχώς', status: 'success', duration: 3000 });
    },
    onError: () => {
      toast({ title: 'Σφάλμα έγκρισης άσκησης', status: 'error', duration: 3000 });
    },
  });

  const handleAccepted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['checkpoints', exerciseId] });
  }, [exerciseId]);

  const handleApproveExercise = useCallback(() => {
    approveMutation.mutate();
  }, [approveMutation]);

  const handleDelete = () => {
    deleteMutation.mutate();
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
        <Text fontSize="lg" color="gray.400">
          Η άσκηση δεν βρέθηκε
        </Text>
        <Button mt={4} onClick={() => navigate('/exercises')}>
          Πίσω στις Ασκήσεις
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
          onClick={() => navigate('/exercises')}
        >
          Πίσω στις Ασκήσεις
        </Button>

        <VStack align="stretch" spacing={6}>
          {/* Header */}
          <HStack justify="space-between">
            <VStack align="start" spacing={2}>
              <Heading size="lg">{exercise.title}</Heading>
              <HStack>
                <Badge colorScheme={exercise.status === ExerciseStatus.APPROVED ? 'green' : 'yellow'} textTransform="none">
                  {exercise.status === ExerciseStatus.APPROVED ? 'Εγκεκριμένο' : 'Πρόχειρο'}
                </Badge>
                <Text color="gray.400" fontSize="sm">
                  Δημιουργήθηκε {new Date(exercise.createdAt).toLocaleDateString('el-GR')}
                </Text>
              </HStack>
            </VStack>
            <HStack>
              {exercise.status === ExerciseStatus.DRAFT && checkpoints.length > 0 && checkpoints.every(cp => cp.pattern) && (
                <Button
                  leftIcon={<FiCheck />}
                  colorScheme="green"
                  variant="solid"
                  onClick={handleApproveExercise}
                  isLoading={approveMutation.isPending}
                >
                  Έγκριση Άσκησης
                </Button>
              )}
              <Button
                leftIcon={<FiTrash2 />}
                colorScheme="red"
                variant="solid"
                onClick={onDeleteOpen}
                isLoading={deleteMutation.isPending}
              >
                Διαγραφή
              </Button>
            </HStack>
          </HStack>

          <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
            {/* PDF Info */}
            <GridItem>
              <Card h="full">
                <CardBody>
                  <VStack align="start" spacing={4}>
                    <HStack>
                      <FiFileText size={24} />
                      <Heading size="md">Ανεβασμένο Αρχείο</Heading>
                    </HStack>
                    <Divider />
                    <VStack align="start" spacing={2} w="full">
                      <Text fontWeight="medium">Διαδρομή PDF:</Text>
                      <Text fontSize="sm" color="gray.400" wordBreak="break-all">
                        {exercise.originalPdfPath}
                      </Text>
                    </VStack>
                    {exercise.extractedText && (
                      <VStack align="start" spacing={2} w="full">
                        <Text fontWeight="medium">Προεπισκόπηση Εξαγμένου Κειμένου:</Text>
                        <Box
                          p={4}
                          bg="gray.900"
                          borderRadius="md"
                          w="full"
                          maxH="300px"
                          overflowY="auto"
                          border="1px solid"
                          borderColor="gray.700"
                        >
                          <Text fontSize="sm" whiteSpace="pre-wrap">
                            {exercise.extractedText.substring(0, 500)}
                            {exercise.extractedText.length > 500 && '...'}
                          </Text>
                        </Box>
                      </VStack>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            </GridItem>

            {/* Checkpoints */}
            <GridItem>
              <Card h="full">
                <CardBody>
                  <VStack align="start" spacing={4}>
                    <HStack>
                      <FiCheckCircle size={24} />
                      <Heading size="md">Εξαγμένα Checkpoints</Heading>
                    </HStack>
                    <Divider />
                    {checkpoints.length === 0 ? (
                      <Box textAlign="center" py={8} w="full">
                        <Text color="gray.400">
                          Δεν έχουν εξαχθεί checkpoints ακόμα. Χρησιμοποιήστε το chat παρακάτω.
                        </Text>
                      </Box>
                    ) : (
                      <List spacing={3} w="full">
                        {checkpoints.map((checkpoint, index) => (
                          <ListItem key={checkpoint.id}>
                            <HStack align="start">
                              <ListIcon as={FiCheckCircle} color="green.500" mt={1} />
                              <VStack align="start" spacing={1} flex={1}>
                                <Text fontWeight="medium">
                                  {index + 1}. {checkpoint.description}
                                </Text>
                                {checkpoint.pattern && (
                                  <Text fontSize="xs" color="gray.400" fontFamily="mono">
                                    {checkpoint.pattern}
                                  </Text>
                                )}
                                {checkpoint.patternDescription && (
                                  <Text fontSize="xs" color="gray.500" fontStyle="italic">
                                    {checkpoint.patternDescription}
                                  </Text>
                                )}
                              </VStack>
                            </HStack>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>

          {/* Chat Tabs */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>
                Συνομιλία & Εξαγωγή
                {exercise.status !== ExerciseStatus.DRAFT && (
                  <Badge ml={2} colorScheme="green" textTransform="none">
                    Μόνο ανάγνωση
                  </Badge>
                )}
              </Heading>
              <Divider mb={4} />
              <Tabs variant="enclosed" colorScheme="brand" isLazy lazyBehavior='unmount'>
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
                      checkpoints={checkpoints}
                      isReadOnly={exercise.status !== ExerciseStatus.DRAFT}
                      onAccepted={handleAccepted}
                    />
                  </TabPanel>
                  <TabPanel px={0} pt={4}>
                    <InlineChat
                      exerciseId={exerciseId!}
                      mode="patterns"
                      patternsEnabled={checkpoints.length > 0}
                      checkpoints={checkpoints}
                      isReadOnly={exercise.status !== ExerciseStatus.DRAFT}
                      onAccepted={handleAccepted}
                    />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </CardBody>
          </Card>
        </VStack>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          isOpen={isDeleteOpen}
          leastDestructiveRef={cancelRef}
          onClose={onDeleteClose}
        >
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
                <Button ref={cancelRef} onClick={onDeleteClose}>
                  Ακύρωση
                </Button>
                <Button colorScheme="red" onClick={handleDelete} ml={3}>
                  Διαγραφή
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </Box>
    </PageTransition>
  );
}

// ── Shared rendering helpers ──────────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const hasNumbered = lines.some((l) => /^\d+\.\s/.test(l.trim()));

  if (!hasNumbered) {
    return <Text whiteSpace="pre-wrap" fontSize="sm">{content}</Text>;
  }

  const segments: Array<{ type: 'text'; value: string } | { type: 'list'; items: string[] }> = [];
  let textAccum: string[] = [];
  let listAccum: string[] = [];

  const flushText = () => {
    const t = textAccum.join('\n').trim();
    if (t) segments.push({ type: 'text', value: t });
    textAccum = [];
  };
  const flushList = () => {
    if (listAccum.length) segments.push({ type: 'list', items: [...listAccum] });
    listAccum = [];
  };

  for (const line of lines) {
    if (/^\d+\.\s/.test(line.trim())) {
      flushText();
      listAccum.push(line);
    } else {
      flushList();
      textAccum.push(line);
    }
  }
  flushText();
  flushList();

  let listCounter = 0;
  return (
    <VStack align="start" spacing={2}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <Text key={i} whiteSpace="pre-wrap" fontSize="sm">{seg.value}</Text>;
        }
        const start = listCounter + 1;
        listCounter += seg.items.length;
        return (
          <OrderedList key={i} spacing={1} pl={4} start={start}>
            {seg.items.map((item, j) => {
              const match = item.match(/^\d+\.\s+(.+)/);
              return (
                <ListItem key={j}>
                  <Text fontSize="sm" whiteSpace="pre-wrap">{match ? match[1] : item}</Text>
                </ListItem>
              );
            })}
          </OrderedList>
        );
      })}
    </VStack>
  );
}

interface MessageBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isProfessor = message.role === 'professor';
  const { user } = useAuthContext();
  return (
    <HStack align="start" alignSelf={isProfessor ? 'flex-end' : 'flex-start'} maxW="80%" spacing={3}>
      {!isProfessor && <Avatar size="sm" name="Artificial Intelligence" bg="brand.500" />}
      <Box
        bg={isProfessor ? 'brand.600' : 'gray.700'}
        color={isProfessor ? 'white' : 'gray.100'}
        px={4}
        py={3}
        borderRadius="lg"
        position="relative"
      >
        <MessageContent content={message.content} />
        {isStreaming && (
          <Box
            as="span"
            display="inline-block"
            w="2px"
            h="1em"
            bg="currentColor"
            ml={1}
            animation="blink 1s infinite"
            sx={{
              '@keyframes blink': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0 },
              },
            }}
          />
        )}
      </Box>
      {isProfessor && <Avatar size="sm" name={user?.username} bg="gray.500" />}
    </HStack>
  );
}
