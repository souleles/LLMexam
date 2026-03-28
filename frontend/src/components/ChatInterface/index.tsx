import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Avatar,
  Spinner,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
} from '@chakra-ui/react';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiSend } from 'react-icons/fi';
import { api, ConversationMessage } from '@/lib/api';
import { useLlmStream } from '@/hooks/useLlmStream';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseId: string;
  extractedText: string;
}

export function ChatInterface({ isOpen, onClose, exerciseId, extractedText }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { buffer, streaming, sendMessage } = useLlmStream(exerciseId);

  const { data: messages = [] } = useQuery({
    queryKey: ['conversations', exerciseId],
    queryFn: () => api.conversations.list(exerciseId),
    enabled: isOpen,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, buffer]);

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="lg">
      <DrawerOverlay />      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Chat Εξαγωγής Checkpoints</DrawerHeader>

        <DrawerBody>
          <VStack spacing={4} align="stretch" h="full">            {messages.length === 0 && !buffer && (
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

            {buffer && (
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

            <div ref={messagesEndRef} />
          </VStack>
        </DrawerBody>        <DrawerFooter borderTopWidth="1px">
          <HStack w="full">
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

interface MessageBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isProfessor = message.role === 'professor';

  return (
    <HStack
      align="start"
      alignSelf={isProfessor ? 'flex-end' : 'flex-start'}
      maxW="80%"
      spacing={3}
    >
      {!isProfessor && (
        <Avatar size="sm" name="AI Assistant" bg="brand.500" />
      )}
      <Box
        bg={isProfessor ? 'brand.500' : 'gray.100'}
        color={isProfessor ? 'white' : 'gray.800'}
        px={4}
        py={3}
        borderRadius="lg"
        position="relative"
      >
        <Text whiteSpace="pre-wrap">{message.content}</Text>
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
      {isProfessor && (
        <Avatar size="sm" name="Professor" bg="gray.500" />
      )}
    </HStack>
  );
}
