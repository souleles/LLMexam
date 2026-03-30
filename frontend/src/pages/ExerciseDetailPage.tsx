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
  useDisclosure,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiArrowLeft, FiFileText, FiCheckCircle, FiMessageSquare } from 'react-icons/fi';
import { api } from '@/lib/api';
import { ChatInterface } from '@/components/ChatInterface';

export function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const { isOpen: isChatOpen, onOpen: onChatOpen, onClose: onChatClose } = useDisclosure();

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

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', exerciseId],
    queryFn: () => api.conversations.list(exerciseId!),
    enabled: !!exerciseId,
  });
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
          <Button
            leftIcon={<FiMessageSquare />}
            colorScheme="brand"
            onClick={onChatOpen}
          >
            Άνοιγμα Chat
          </Button>
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
                      <Text color="gray.500">Δεν έχουν εξαχθεί checkpoints ακόμα</Text>
                      <Button
                        mt={4}
                        size="sm"
                        colorScheme="brand"
                        variant="outline"
                        onClick={onChatOpen}
                      >
                        Εξαγωγή Checkpoints
                      </Button>
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

        {/* Chat History */}
        {conversations.length > 0 && (
          <Card>
            <CardBody>
              <VStack align="start" spacing={4}>
                <Heading size="md">Ιστορικό Συνομιλίας</Heading>
                <Divider />
                <VStack align="stretch" spacing={3} w="full">
                  {conversations.map((msg) => (
                    <Box
                      key={msg.id}
                      p={4}
                      bg={msg.role === 'professor' ? 'blue.50' : 'gray.50'}
                      borderRadius="md"
                      borderLeft="4px"
                      borderLeftColor={msg.role === 'professor' ? 'blue.500' : 'gray.400'}
                    >
                      <Text fontWeight="bold" fontSize="sm" mb={2}>
                        {msg.role === 'professor' ? 'Εσείς' : 'Βοηθός'}
                      </Text>
                      <Text fontSize="sm" whiteSpace="pre-wrap">
                        {msg.content}
                      </Text>
                      <Text fontSize="xs" color="gray.500" mt={2}>
                        {new Date(msg.createdAt).toLocaleString('el-GR')}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </VStack>
            </CardBody>
          </Card>
        )}
      </VStack>

      {/* Chat Interface Modal/Drawer */}
      {exercise && (
        <ChatInterface
          isOpen={isChatOpen}
          onClose={onChatClose}
          exerciseId={exercise.id}
          extractedText={exercise.extractedText || ''}
        />
      )}
    </Box>
  );
}
