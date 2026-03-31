import {
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
  useToast,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FiArrowLeft, FiFileText, FiCheckCircle, FiSend, FiCheck } from 'react-icons/fi';
import { useRef, useEffect, useState, useCallback } from 'react';
import { api, ConversationMessage } from '@/lib/api';
import { useLlmStream } from '@/hooks/useLlmStream';
import { parseMessageContent } from '@/lib/parseMessageContent';
import { queryClient } from '@/lib/queryClient';

export function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { buffer, streaming, sendMessage, error, pendingCheckpoints, clearPendingCheckpoints } =
    useLlmStream(exerciseId!);

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

  // Seed messages state from DB once on load
  const { data: dbMessages = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', exerciseId],
    queryFn: () => api.conversations.list(exerciseId!),
    enabled: !!exerciseId,
    staleTime: Infinity,
  });

  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && dbMessages.length > 0) {
      seeded.current = true;
      setMessages(dbMessages.map((m) => ({ ...m, content: parseMessageContent(m.content) || m.content })));
    }
  }, [dbMessages]);

  // When streaming ends, finalize the assistant message into messages
  const prevStreaming = useRef(false);
  useEffect(() => {
    if (prevStreaming.current && !streaming && buffer) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          exerciseId: exerciseId!,
          role: 'assistant',
          content: buffer,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    prevStreaming.current = streaming;
  }, [streaming, buffer, exerciseId]);

  const acceptMutation = useMutation({
    mutationFn: () => api.checkpoints.bulkReplace(exerciseId!, pendingCheckpoints),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkpoints', exerciseId] });
      clearPendingCheckpoints();
      toast({ title: 'Checkpoints αποθηκεύτηκαν', status: 'success', duration: 3000 });
    },
    onError: () => {
      toast({ title: 'Σφάλμα αποθήκευσης', status: 'error', duration: 3000 });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, buffer]);

  const handleSend = useCallback(() => {
    if (!input.trim() || streaming) return;
    const text = input;
    setMessages((prev) => [
      ...prev,
      {
        id: `professor-${Date.now()}`,
        exerciseId: exerciseId!,
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

  if (exerciseLoading || checkpointsLoading || conversationsLoading) {
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
        <Text fontSize="lg" color="gray.600">
          Η άσκηση δεν βρέθηκε
        </Text>
        <Button mt={4} onClick={() => navigate('/exercises')}>
          Πίσω στις Ασκήσεις
        </Button>
      </Box>
    );
  }

  return (
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
              <Badge colorScheme={exercise.status === 'approved' ? 'green' : 'yellow'}>
                {exercise.status === 'approved' ? 'Εγκεκριμένο' : 'Πρόχειρο'}
              </Badge>
              <Text color="gray.500" fontSize="sm">
                Δημιουργήθηκε {new Date(exercise.createdAt).toLocaleDateString('el-GR')}
              </Text>
            </HStack>
          </VStack>
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
                    <Text fontSize="sm" color="gray.600" wordBreak="break-all">
                      {exercise.originalPdfPath}
                    </Text>
                  </VStack>
                  {exercise.extractedText && (
                    <VStack align="start" spacing={2} w="full">
                      <Text fontWeight="medium">Προεπισκόπηση Εξαγμένου Κειμένου:</Text>
                      <Box
                        p={4}
                        bg="gray.50"
                        borderRadius="md"
                        w="full"
                        maxH="300px"
                        overflowY="auto"
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
                      <Text color="gray.500">
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
                              <Text fontSize="sm" color="gray.600">
                                {checkpoint.pattern.length} μοτίβο/α
                              </Text>
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

        {/* Inline Chat */}
        <Card>
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Heading size="md">Συνομιλία & Εξαγωγή Checkpoints</Heading>
                {pendingCheckpoints.length > 0 && (
                  <Button
                    leftIcon={<FiCheck />}
                    colorScheme="green"
                    size="sm"
                    isLoading={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate()}
                  >
                    Αποδοχή Checkpoints ({pendingCheckpoints.length})
                  </Button>
                )}
              </HStack>
              <Divider />

              {/* Messages area */}
              <Box h="400px" overflowY="auto" px={1}>
                <VStack spacing={4} align="stretch">
                  {messages.length === 0 && !streaming && (
                    <Box textAlign="center" py={8}>
                      <Text color="gray.500">
                        Ξεκινήστε ζητώντας από την AI να εξάγει checkpoints από την άσκηση
                      </Text>
                      <Text fontSize="sm" color="gray.400" mt={2}>
                        Παράδειγμα: "Εξήγαγε όλα τα checkpoints βαθμολόγησης από αυτή την άσκηση"
                      </Text>
                    </Box>
                  )}

                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}

                  {streaming && buffer && (
                    <MessageBubble
                      message={{
                        id: 'streaming',
                        exerciseId: exerciseId!,
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

              {/* Input */}
              <HStack>
                <Input
                  placeholder="Ρωτήστε για checkpoints..."
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
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
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

  return (
    <VStack align="start" spacing={2}>
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <Text key={i} whiteSpace="pre-wrap" fontSize="sm">{seg.value}</Text>
        ) : (
          <OrderedList key={i} spacing={1} pl={4}>
            {seg.items.map((item, j) => {
              const match = item.match(/^\d+\.\s+(.+)/);
              return (
                <ListItem key={j}>
                  <Text fontSize="sm">{match ? match[1] : item}</Text>
                </ListItem>
              );
            })}
          </OrderedList>
        )
      )}
    </VStack>
  );
}

interface MessageBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isProfessor = message.role === 'professor';

  return (
    <HStack align="start" alignSelf={isProfessor ? 'flex-end' : 'flex-start'} maxW="80%" spacing={3}>
      {!isProfessor && <Avatar size="sm" name="AI Assistant" bg="brand.500" />}
      <Box
        bg={isProfessor ? 'brand.500' : 'gray.100'}
        color={isProfessor ? 'white' : 'gray.800'}
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
      {isProfessor && <Avatar size="sm" name="Professor" bg="gray.500" />}
    </HStack>
  );
}
