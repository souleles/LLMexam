import { useAuthContext } from '@/contexts/use-auth';
import { Avatar, Box, HStack } from '@chakra-ui/react';
import { MessageContent } from './MessageContent';
import { ChatMessage } from './types';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
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
