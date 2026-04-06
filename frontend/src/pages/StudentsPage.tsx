import { PageTransition } from '@/components/PageTransition';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';
import {
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Input,
  Td,
  Text,
  Tr,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { FiEye, FiUpload } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { StudentColumns } from '@/lib/columns';

export function StudentsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  };

  return (
    <PageTransition>
      <Box>
        <HStack justify="space-between" mb={8}>
          <VStack align="start" spacing={1}>
            <Heading size="lg">Φοιτητές</Heading>
            <Text color="gray.400">
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

        <DataTable
          columns={StudentColumns}
          data={students}
          isLoading={isLoading}
          emptyText="Δεν υπάρχουν φοιτητές ακόμα"
          emptySubtext="Ανεβάστε ένα αρχείο CSV ή Excel με στήλες: AM, firstName, lastName, email"
          renderRow={(student) => (
            <Tr key={student.id} _hover={{ bg: 'gray.700' }}>
              <Td fontWeight="medium">{student.studentIdentifier}</Td>
              <Td>{student.lastName}</Td>
              <Td>{student.firstName}</Td>
              <Td color="gray.400">{student.email ?? '—'}</Td>
              <Td color="gray.400">{new Date(student.createdAt).toLocaleDateString('el-GR')}</Td>
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
          )}
        />
      </Box>
    </PageTransition>
  );
}
