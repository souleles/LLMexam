import { useAuthContext } from '@/contexts/use-auth';
import { httpClient } from '@/lib/httpClient';
import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  FormControl,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  useToast,
  VStack
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { FiEye, FiEyeOff, FiLogIn } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const useLogin = () => useMutation({
  mutationFn: async ({ username, password }: { username: string; password: string }) => {
    const response = await httpClient.post('/api/auth/login', { username, password });
    return response.data;
  },
});

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const { mutateAsync: login, isPending: isLoggingIn } = useLogin();
  const { login: contextLogin } = useAuthContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await login({ username, password });
      contextLogin(response);
      toast({
        title: 'Επιτυχής σύνδεση',
        description: 'Καλώς ήρθατε!',
        status: 'success',
        duration: 3000,
      });
      navigate('/exercises');
    } catch (error) {
      toast({
        title: 'Σφάλμα σύνδεσης',
        description: 'Λάθος όνομα χρήστη ή κωδικός',
        status: 'error',
        duration: 5000,
      });
    }
  };

  return (
    <Box
      minH="100vh"
      bgGradient="linear(to-br, brand.50, brand.100)"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Container maxW="md">
        <Card boxShadow="2xl" borderRadius="2xl" overflow="hidden">
          <CardBody p={8}>
            <VStack spacing={6} align="stretch">
              {/* Logo/Header */}
              <VStack spacing={2}>
                <Box
                  bg="brand.500"
                  p={4}
                  borderRadius="full"
                  boxShadow="lg"
                >
                  <FiLogIn size={32} color="white" />
                </Box>
                <Heading size="xl" textAlign="center" color="brand.700">
                  LLM Exam Checker
                </Heading>
                <Text color="gray.600" textAlign="center">
                  Σύνδεση στο σύστημα βαθμολόγησης
                </Text>
              </VStack>

              {/* Login Form */}
              <form onSubmit={handleSubmit}>
                <VStack spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Όνομα Χρήστη</FormLabel>
                    <Input
                      type="text"
                      placeholder="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      size="lg"
                      focusBorderColor="brand.500"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Κωδικός Πρόσβασης</FormLabel>
                    <InputGroup size="lg">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        focusBorderColor="brand.500"
                      />
                      <InputRightElement>
                        <IconButton
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          icon={showPassword ? <FiEyeOff /> : <FiEye />}
                          variant="ghost"
                          onClick={() => setShowPassword(!showPassword)}
                          size="sm"
                        />
                      </InputRightElement>
                    </InputGroup>
                  </FormControl>

                  <Button
                    type="submit"
                    colorScheme="brand"
                    size="lg"
                    width="full"
                    isLoading={isLoggingIn}
                    loadingText="Σύνδεση..."
                    leftIcon={<FiLogIn />}
                    mt={2}
                  >
                    Σύνδεση
                  </Button>
                </VStack>
              </form>

              {/* Footer */}
              <Text fontSize="sm" color="gray.500" textAlign="center">
                Για βοήθεια επικοινωνήστε με τον διαχειριστή
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </Container>
    </Box>
  );
}
