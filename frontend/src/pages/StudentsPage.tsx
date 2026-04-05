import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  HStack,
  Input,
  Skeleton,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
  IconButton,
} from '@chakra-ui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { FiUpload, FiEye } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

export function StudentsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: api.students.list,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.students.upload(file),
    onSuccess: (imported) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Επιτυχής εισαγωγή',
        description: `Εισήχθησαν ${imported.length} φοιτητές`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Σφάλμα εισαγωγής',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <Box>
        <HStack justify="space-between" mb={8}>
          <VStack align="start" spacing={1}>
            <Heading size="lg">Φοιτητές</Heading>
            <Text color="gray.600">Κατάλογος φοιτητών</Text>
          </VStack>
        </HStack>
        <Card>
          <CardBody>
            <Stack spacing={3}>
              <Skeleton height="40px" />
              <Skeleton height="40px" />
              <Skeleton height="40px" />
            </Stack>
          </CardBody>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={8}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Φοιτητές</Heading>
          <Text color="gray.600">
            {students.length > 0
              ? `${students.length} φοιτητές στον κατάλογο`
              : 'Εισάγετε φοιτητές από CSV ή Excel'}
          </Text>
        </VStack>
        <Box>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            display="none"
            onChange={handleFileChange}
          />
          <Button
            leftIcon={<FiUpload />}
            colorScheme="brand"
            onClick={() => fileInputRef.current?.click()}
            isLoading={uploadMutation.isPending}
            loadingText="Εισαγωγή..."
          >
            Εισαγωγή CSV / Excel
          </Button>
        </Box>
      </HStack>

      {students.length === 0 ? (
        <Card>
          <CardBody textAlign="center" py={12}>
            <VStack spacing={4}>
              <Text fontSize="lg" color="gray.600">
                Δεν υπάρχουν φοιτητές ακόμα
              </Text>
              <Text color="gray.500">
                Ανεβάστε ένα αρχείο CSV ή Excel με στήλες: AM, firstName, lastName, email
              </Text>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody p={0}>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>ΑΜ</Th>
                  <Th>Επωνυμο</Th>
                  <Th>Ονομα</Th>
                  <Th>Email</Th>
                  <Th>Εισαγωγη</Th>
                  <Th w="100px"></Th>
                </Tr>
              </Thead>
              <Tbody>
                {students.map((student) => (
                  <Tr key={student.id} _hover={{ bg: 'gray.50' }}>
                    <Td fontWeight="medium">{student.studentIdentifier}</Td>
                    <Td>{student.lastName}</Td>
                    <Td>{student.firstName}</Td>
                    <Td color="gray.600">{student.email ?? '—'}</Td>
                    <Td color="gray.600">
                      {new Date(student.createdAt).toLocaleDateString('el-GR')}
                    </Td>
                    <Td>
                      <IconButton
                        aria-label="Προβολή φοιτητή"
                        icon={<FiEye />}
                        size="sm"
                        variant="ghost"
                        colorScheme="blue"
                        onClick={() => navigate(`/students/${student.id}`)}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </Box>
  );
}
