import {
  Box,
  VStack,
  Text,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Badge,
  Code,
  HStack,
  Tag,
} from '@chakra-ui/react';
import { Checkpoint } from '@/lib/api';

interface CheckpointListProps {
  exerciseId: string;
  checkpoints: Checkpoint[];
}

export function CheckpointList({ checkpoints }: CheckpointListProps) {
  return (
    <Card h="calc(100vh - 250px)">
      <CardHeader>
        <HStack justify="space-between">
          <Heading size="md">Checkpoints</Heading>
          <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
            {checkpoints.length}
          </Badge>
        </HStack>
      </CardHeader>
      <CardBody overflowY="auto" pt={0}>
        {checkpoints.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">
              Δεν υπάρχουν checkpoints ακόμα. Χρησιμοποιήστε το chat για να τα εξάγετε.
            </Text>
          </Box>
        ) : (
          <VStack spacing={4} align="stretch">
            {checkpoints
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((checkpoint, idx) => (
                <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} index={idx + 1} />
              ))}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

interface CheckpointCardProps {
  checkpoint: Checkpoint;
  index: number;
}

function CheckpointCard({ checkpoint, index }: CheckpointCardProps) {
  return (
    <Card variant="outline" bg="white">
      <CardBody>
        <VStack align="start" spacing={3}>
          <HStack>
            <Badge colorScheme="purple" fontSize="lg" px={2}>
              #{index}
            </Badge>
            {checkpoint.caseSensitive && (
              <Tag size="sm" colorScheme="orange">
                Διάκριση Πεζών-Κεφαλαίων
              </Tag>
            )}
          </HStack>

          <Text fontWeight="medium">{checkpoint.description}</Text>

          {checkpoint.patterns && checkpoint.patterns.length > 0 && (
            <Box w="full">
              <Text fontSize="sm" fontWeight="medium" color="gray.600" mb={2}>
                Μοτίβα:
              </Text>
              <VStack align="stretch" spacing={2}>
                {checkpoint.patterns.map((pattern, pIdx) => (
                  <Code
                    key={pIdx}
                    p={2}
                    borderRadius="md"
                    fontSize="xs"
                    display="block"
                    whiteSpace="pre-wrap"
                    wordBreak="break-all"
                  >
                    {pattern}
                  </Code>
                ))}
              </VStack>
            </Box>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
