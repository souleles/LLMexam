import { useDeleteSchema } from '@/hooks/use-delete-schema';
import { useUploadSchema } from '@/hooks/use-upload-schema';
import { QueryKeys } from '@/lib/queryKeys';
import {
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  HStack,
  Heading,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { FiDatabase, FiEye, FiUpload, FiX } from 'react-icons/fi';

interface SchemaCardProps {
  exerciseId: string;
  schema?: string;
}

export function SchemaCard({ exerciseId, schema }: SchemaCardProps) {
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QueryKeys.Exercise, exerciseId] });
  };

  const uploadMutation = useUploadSchema({
    onSuccess: () => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      invalidate();
    },
  });

  const deleteMutation = useDeleteSchema({
    onSuccess: invalidate,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate({ exerciseId, file: selectedFile });
  };

  return (
    <Card h="full">
      <CardBody>
        <VStack align="start" spacing={4}>
          <HStack>
            <FiDatabase size={24} />
            <Heading size="md">Σχήμα Βάσης Δεδομένων</Heading>
          </HStack>
          <Text fontSize="sm" color="gray.400">
            Προαιρετικό αρχείο .txt με το σχήμα της βάσης. Θα χρησιμοποιηθεί κατά τη δημιουργία regex patterns.
          </Text>
          <Divider />

          {schema ? (
            <HStack w="full" justify="space-between">
              <Text fontSize="sm" color="gray.300">Σχήμα βάσης διαθέσιμο</Text>
              <HStack>
                <Button leftIcon={<FiEye />} size="sm" onClick={onOpen}>
                  Προβολή
                </Button>
                <IconButton
                  aria-label="Διαγραφή σχήματος"
                  icon={<FiX />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  isLoading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate({ exerciseId })}
                />
              </HStack>
            </HStack>
          ) : null}

          <HStack w="full">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              size="sm"
              onChange={handleFileChange}
            />
            <Button
              leftIcon={<FiUpload />}
              colorScheme="brand"
              size="sm"
              isDisabled={!selectedFile}
              isLoading={uploadMutation.isPending}
              onClick={handleUpload}
            >
              Ανέβασμα
            </Button>
          </HStack>
        </VStack>
      </CardBody>

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Σχήμα Βάσης Δεδομένων</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            <Box as="pre" whiteSpace="pre-wrap" fontFamily="mono" fontSize="sm">
              {schema}
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Card>
  );
}
