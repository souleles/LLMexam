import {
  Box,
  Button,
  Heading,
  HStack,
  VStack,
  Text,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FiArrowLeft, FiCheck, FiX, FiSave } from 'react-icons/fi';
import { api, GradingResult, Checkpoint } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useState, useEffect } from 'react';

export function GradingResultsPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [results, setResults] = useState<GradingResult[]>([]);

  const { data: exercise } = useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: () => api.exercises.get(exerciseId!),
    enabled: !!exerciseId,
  });

  const { data: checkpoints = [] } = useQuery({
    queryKey: ['checkpoints', exerciseId],
    queryFn: () => api.checkpoints.list(exerciseId!),
    enabled: !!exerciseId,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['submissions', exerciseId],
    queryFn: () => api.submissions.list(exerciseId!),
    enabled: !!exerciseId,
  });

  const { data: fetchedResults = [], isLoading } = useQuery({
    queryKey: ['grading-results', exerciseId],
    queryFn: () => api.grading.getResults(exerciseId!),
    enabled: !!exerciseId,
  });

  useEffect(() => {
    setResults(fetchedResults);
  }, [fetchedResults]);

  const saveMutation = useMutation({
    mutationFn: (results: GradingResult[]) => api.grading.saveResults(results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading-results', exerciseId] });
      toast({
        title: 'Αποθηκεύτηκαν τα αποτελέσματα',
        description: 'Τα αποτελέσματα βαθμολόγησης αποθηκεύτηκαν επιτυχώς',
        status: 'success',
        duration: 3000,
      });
    },
    onError: () => {
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία αποθήκευσης αποτελεσμάτων',
        status: 'error',
        duration: 3000,
      });
    },
  });

  if (!exercise) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Φόρτωση...</Text>
      </Box>
    );
  }

  const groupedResults = submissions.map((submission) => {
    const submissionResults = results.filter((r) => r.submissionId === submission.id);
    const checkpointResults = checkpoints.map((checkpoint) => {
      const result = submissionResults.find((r) => r.checkpointId === checkpoint.id);
      return {
        checkpoint,
        result,
      };
    });
    return {
      submission,
      checkpointResults,
      totalMatched: checkpointResults.filter((cr) => cr.result?.matched).length,
      totalCheckpoints: checkpoints.length,
    };
  });

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <HStack spacing={4}>
          <Button
            leftIcon={<FiArrowLeft />}
            variant="ghost"
            onClick={() => navigate('/exercises')}
          >
            Πίσω
          </Button>
          <VStack align="start" spacing={0}>
            <Heading size="lg">{exercise.title}</Heading>
            <Text color="gray.600" fontSize="sm">
              Αποτελέσματα βαθμολόγησης και αναλυτικά στοιχεία
            </Text>
          </VStack>
        </HStack>
        {results.length > 0 && (
          <Button
            leftIcon={<FiSave />}
            colorScheme="green"
            onClick={() => saveMutation.mutate(results)}
            isLoading={saveMutation.isPending}
          >
            Αποθήκευση Αποτελεσμάτων
          </Button>
        )}
      </HStack>

      <Card>
        <CardBody>
          {isLoading ? (
            <Text textAlign="center" py={8} color="gray.500">
              Φόρτωση αποτελεσμάτων...
            </Text>
          ) : submissions.length === 0 ? (
            <VStack py={12} spacing={4}>
              <Text fontSize="lg" color="gray.600">
                Δεν υπάρχουν υποβολές ακόμα
              </Text>
              <Button
                colorScheme="brand"
                onClick={() => navigate(`/exercises/${exerciseId}/submissions`)}
              >
                Ανέβασμα Υποβολών
              </Button>
            </VStack>
          ) : (
            <Tabs>
              <TabList>
                <Tab>Επισκόπηση</Tab>
                <Tab>Αναλυτικά Αποτελέσματα</Tab>
              </TabList>

              <TabPanels>
                {/* Overview Tab */}
                <TabPanel>
                  <Box overflowX="auto">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Φοιτητής</Th>
                          <Th>Βαθμός</Th>
                          <Th>Ποσοστό</Th>
                          <Th>Κατάσταση</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {groupedResults.map(({ submission, totalMatched, totalCheckpoints }) => {
                          const percentage =
                            totalCheckpoints > 0
                              ? Math.round((totalMatched / totalCheckpoints) * 100)
                              : 0;
                          return (
                            <Tr key={submission.id}>
                              <Td fontWeight="medium">
                                {submission.student.lastName} {submission.student.firstName}
                                <Text as="span" fontSize="xs" color="gray.500" ml={1}>
                                  ({submission.student.studentIdentifier})
                                </Text>
                              </Td>
                              <Td>
                                {totalMatched} / {totalCheckpoints}
                              </Td>
                              <Td>
                                <Badge
                                  colorScheme={
                                    percentage >= 80
                                      ? 'green'
                                      : percentage >= 60
                                        ? 'yellow'
                                        : 'red'
                                  }
                                  fontSize="md"
                                  px={2}
                                >
                                  {percentage}%
                                </Badge>
                              </Td>
                              <Td>
                                {percentage >= 60 ? (
                                  <Badge colorScheme="green">Επιτυχία</Badge>
                                ) : (
                                  <Badge colorScheme="red">Αποτυχία</Badge>
                                )}
                              </Td>
                            </Tr>
                          );
                        })}
                      </Tbody>
                    </Table>
                  </Box>
                </TabPanel>

                {/* Detailed Results Tab */}
                <TabPanel>
                  <Accordion allowMultiple>
                    {groupedResults.map(({ submission, checkpointResults }) => (
                      <AccordionItem key={submission.id}>
                        <AccordionButton>
                          <Box flex="1" textAlign="left">
                            <HStack>
                              <Text fontWeight="bold">
                                {submission.student.lastName} {submission.student.firstName} ({submission.student.studentIdentifier})
                              </Text>
                              <Badge>
                                {checkpointResults.filter((cr) => cr.result?.matched).length} /{' '}
                                {checkpointResults.length}
                              </Badge>
                            </HStack>
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel>
                          <VStack align="stretch" spacing={3}>
                            {checkpointResults.map(({ checkpoint, result }, idx) => (
                              <Card key={checkpoint.id} variant="outline" size="sm">
                                <CardBody>
                                  <HStack justify="space-between" mb={2}>
                                    <HStack>
                                      <Badge colorScheme="purple">#{idx + 1}</Badge>
                                      <Text fontWeight="medium" fontSize="sm">
                                        {checkpoint.description}
                                      </Text>
                                    </HStack>
                                    {result?.matched ? (
                                      <Badge colorScheme="green" display="flex" alignItems="center">
                                        <FiCheck style={{ marginRight: '4px' }} /> Βρέθηκε
                                      </Badge>
                                    ) : (
                                      <Badge colorScheme="red" display="flex" alignItems="center">
                                        <FiX style={{ marginRight: '4px' }} /> Δεν Βρέθηκε
                                      </Badge>
                                    )}
                                  </HStack>

                                  {result?.matchedSnippets &&
                                    result.matchedSnippets.length > 0 && (
                                      <VStack align="stretch" spacing={2} mt={3}>
                                        <Text fontSize="xs" fontWeight="medium" color="gray.600">
                                          Βρέθηκε στη:
                                        </Text>
                                        {result.matchedSnippets.map((snippet, sIdx) => (
                                          <Box key={sIdx}>
                                            <Text fontSize="xs" color="gray.500" mb={1}>
                                              Γραμμή {snippet.line}:
                                            </Text>
                                            <Code
                                              display="block"
                                              p={2}
                                              fontSize="xs"
                                              whiteSpace="pre-wrap"
                                            >
                                              {snippet.snippet}
                                            </Code>
                                          </Box>
                                        ))}
                                      </VStack>
                                    )}
                                </CardBody>
                              </Card>
                            ))}
                          </VStack>
                        </AccordionPanel>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabPanel>
              </TabPanels>
            </Tabs>
          )}
        </CardBody>
      </Card>
    </Box>
  );
}
