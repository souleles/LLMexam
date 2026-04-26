import { Checkpoint } from '@/lib/api';
import {
  Box,
  Card,
  CardBody,
  Divider,
  Heading,
  HStack,
  List,
  ListIcon,
  ListItem,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiCheckCircle } from 'react-icons/fi';

interface CheckpointsCardProps {
  checkpoints: Checkpoint[];
}

export function CheckpointsCard({ checkpoints }: CheckpointsCardProps) {
  return (
    <Card h="full">
      <CardBody>
        <VStack align="start" spacing={4}>
          <HStack>
            <FiCheckCircle size={24} />
            <Heading size="md">Εξαγμένα Checkpoints ({checkpoints.length})</Heading>
          </HStack>
          <Divider />
          {checkpoints.length === 0 ? (
            <Box textAlign="center" py={8} w="full">
              <Text color="gray.400">
                Δεν έχουν εξαχθεί checkpoints ακόμα. Χρησιμοποιήστε το chat παρακάτω.
              </Text>
            </Box>
          ) : (
            <Box maxHeight="600px" overflowY="auto">
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
            </Box>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
