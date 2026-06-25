import { useExplainLlmFailures } from '@/hooks/use-explain-llm-failures';
import { api, Submission } from '@/lib/api';
import {
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FiHelpCircle } from 'react-icons/fi';

interface ExplainLlmFailuresButtonProps {
  submissionId: string;
  hasFailedLlm: boolean;
  isDisabled?: boolean;
  onExplained?: (refreshedSubmission: Submission) => void;
}

export function ExplainLlmFailuresButton({
  submissionId,
  hasFailedLlm,
  isDisabled,
  onExplained,
}: ExplainLlmFailuresButtonProps) {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [explanations, setExplanations] = useState<
    Array<{ checkpointId: string; checkpointDescription: string; checkpointOrder: number; explanation: string }>
  >([]);

  const explainMutation = useExplainLlmFailures({
    onSuccess: async (data) => {
      setExplanations(data.explanations);
      if (onExplained) {
        onExplained(await api.submissions.get(submissionId));
      }
      onOpen();
    },
    onError: () => {
      toast({ title: 'Σφάλμα κατά την αιτιολόγηση', status: 'error', duration: 3000 });
    },
  });

  if (!hasFailedLlm) return null;

  return (
    <>
      <Button
        leftIcon={<FiHelpCircle />}
        size="sm"
        variant="outline"
        colorScheme="orange"
        onClick={() => explainMutation.mutate({ submissionId })}
        isLoading={explainMutation.isPending}
        isDisabled={isDisabled || explainMutation.isPending}
      >
        Αιτιολόγηση Αποτυχημένων LLM
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Αιτιολόγηση Αποτυχημένων LLM</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              {explanations.length === 0 ? (
                <Text fontSize="sm" color="gray.400">Δεν υπάρχουν αιτιολογήσεις προς εμφάνιση.</Text>
              ) : (
                explanations.map((e) => (
                  <Box key={e.checkpointId}>
                    <Text fontWeight="medium" fontSize="sm" mb={1}>
                      Checkpoint {e.checkpointOrder}: {e.checkpointDescription}
                    </Text>
                    <Text fontSize="sm" color="gray.300">{e.explanation}</Text>
                  </Box>
                ))
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>Κλείσιμο</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
