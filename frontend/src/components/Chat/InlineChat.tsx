import { useLlmStream } from '@/hooks/useLlmStream';
import { QueryKeys } from '@/lib/queryKeys';
import { useGetConversations } from '@/hooks/use-get-conversations';
import { useAcceptCheckpoints } from '@/hooks/use-accept-checkpoints';
import { useAcceptPatterns } from '@/hooks/use-accept-patterns';
import { ContentBlock, parseMessageContent } from '@/lib/parseMessageContent';
import {
  Box,
  Button,
  HStack,
  Input,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCheck, FiSend } from 'react-icons/fi';
import { useToast } from '@chakra-ui/react';
import { MessageBubble } from './MessageBubble';
import { ChatMessage } from './types';

interface InlineChatProps {
  exerciseId: string;
  mode: 'checkpoints' | 'patterns';
  patternsEnabled?: boolean;
  isReadOnly?: boolean;
  onAccepted: () => void;
}

export function InlineChat({
  exerciseId,
  mode,
  patternsEnabled = true,
  isReadOnly = false,
  onAccepted,
}: InlineChatProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const defaultInput =
    mode === 'checkpoints'
      ? 'Εξήγαγε όλα τα checkpoints βαθμολόγησης από αυτή την άσκηση'
      : 'Δημιούργησε regex patterns για κάθε checkpoint';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const initialScrollDone = useRef(false);

  const {
    buffer,
    streaming,
    sendMessage,
    error,
    pendingCheckpoints,
    clearPendingCheckpoints,
    pendingPatterns,
    clearPendingPatterns,
  } = useLlmStream(exerciseId, mode);

  const conversationType = mode === 'checkpoints' ? 'CHECKPOINT' : 'PATTERN';

  const { data: dbMessages = [] } = useGetConversations(
    exerciseId,
    conversationType,
    mode === 'checkpoints' || patternsEnabled,
  );

  // Seed from DB once
  useEffect(() => {
    if (!seeded.current && dbMessages.length > 0) {
      seeded.current = true;
      setMessages(
        dbMessages.map((m) => {
          const parsed = parseMessageContent(m.content);
          return { ...m, content: parsed || m.content };
        }),
      );
    }
  }, [dbMessages]);

  // Initial scroll after messages render
  useEffect(() => {
    if (seeded.current && !initialScrollDone.current && messagesBoxRef.current && messages.length > 0) {
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

  // Refs so finalize effect doesn't need pending* in its deps
  const latestPendingPatterns = useRef(pendingPatterns);
  const latestPendingCheckpoints = useRef(pendingCheckpoints);
  latestPendingPatterns.current = pendingPatterns;
  latestPendingCheckpoints.current = pendingCheckpoints;

  // Finalize assistant bubble when streaming ends
  const prevStreaming = useRef(false);
  useEffect(() => {
    if (prevStreaming.current && !streaming) {
      const patterns = latestPendingPatterns.current;
      const checkpoints = latestPendingCheckpoints.current;
      let content: string | ContentBlock[];

      if (mode === 'patterns' && patterns.length > 0) {
        content = patterns.map((p, i) => ({
          title: `${p.order ?? i + 1}. ${p.description}`,
          content: [
            { title: 'Pattern', description: p.pattern },
            { title: 'Περιγραφή Pattern', description: p.patternDescription ?? '' },
          ],
        }));
      } else if (mode === 'checkpoints' && checkpoints.length > 0) {
        content = checkpoints.map((p, i) => ({
          title: `${p.order ?? i + 1}. ${p.description}`,
          content: [],
        }));
      } else if (buffer) {
        content = buffer;
      } else {
        prevStreaming.current = streaming;
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          exerciseId,
          role: 'assistant' as const,
          content,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    prevStreaming.current = streaming;
  }, [streaming, buffer, exerciseId, mode]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (initialScrollDone.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, streaming]);

  const acceptCheckpointsMutation = useAcceptCheckpoints(exerciseId, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Checkpoints, exerciseId] });
      clearPendingCheckpoints();
      onAccepted();
      toast({ title: 'Checkpoints αποθηκεύτηκαν', status: 'success', duration: 3000 });
    },
    onError: () => {
      toast({ title: 'Σφάλμα αποθήκευσης checkpoints', status: 'error', duration: 3000 });
    },
  });

  const acceptPatternsMutation = useAcceptPatterns(exerciseId, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Checkpoints, exerciseId] });
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
        role: 'professor' as const,
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
  const acceptIsPending =
    mode === 'checkpoints' ? acceptCheckpointsMutation.isPending : acceptPatternsMutation.isPending;
  const acceptLabel = mode === 'checkpoints' ? 'Αποδοχή Checkpoints' : 'Αποδοχή Patterns';
  const emptyLabel =
    mode === 'checkpoints'
      ? 'Ξεκινήστε ζητώντας από την AI να εξάγει checkpoints από την άσκηση'
      : 'Ζητήστε από την AI να δημιουργήσει regex patterns για τα checkpoints';

  return (
    <VStack align="stretch" spacing={4}>
      {!isReadOnly && (
        <HStack justify="flex-end">
          {hasPending && (
            <Button
              leftIcon={<FiCheck />}
              colorScheme="green"
              size="sm"
              isLoading={acceptIsPending}
              onClick={() =>
                mode === 'checkpoints'
                  ? acceptCheckpointsMutation.mutate(pendingCheckpoints)
                  : acceptPatternsMutation.mutate(
                      pendingPatterns.map((p) => ({
                        order: p.order,
                        pattern: p.pattern,
                        patternDescription: p.patternDescription,
                      })),
                    )
              }
            >
              {acceptLabel} ({pendingCount})
            </Button>
          )}
        </HStack>
      )}

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
