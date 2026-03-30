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
  UnorderedList,
  ListItem,
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
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Chat Εξαγωγής Checkpoints</DrawerHeader>

        <DrawerBody>
          <VStack spacing={4} align="stretch" h="full">
            {messages.length === 0 && !buffer && (
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

// Detects "1. foo\n2. bar" lines and renders them as a visual list
function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const isNumberedList = lines.filter((l) => /^\d+\.\s/.test(l.trim())).length > 1;

  if (isNumberedList) {
    const items = lines.filter((l) => l.trim());
    return (
      <UnorderedList spacing={1} styleType="none" m={0} pl={0}>
        {items.map((line, i) => {
          const match = line.match(/^(\d+)\.\s+(.+)/);
          if (!match) return <ListItem key={i}><Text fontSize="sm">{line}</Text></ListItem>;
          return (
            <ListItem key={i}>
              <HStack align="start" spacing={2}>
                <Text fontSize="xs" fontWeight="bold" color="brand.500" minW="20px" mt="1px">
                  {match[1]}.
                </Text>
                <Text fontSize="sm">{match[2]}</Text>
              </HStack>
            </ListItem>
          );
        })}
      </UnorderedList>
    );
  }

  return <Text whiteSpace="pre-wrap" fontSize="sm">{content}</Text>;
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
      {isProfessor && (
        <Avatar size="sm" name="Professor" bg="gray.500" />
      )}
    </HStack>
  );
}
