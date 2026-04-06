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
import { motion } from 'framer-motion';
import { useState } from 'react';
import { FiEye, FiEyeOff, FiLogIn } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const MotionBox = motion(Box);
const MotionCard = motion(Card);

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
      bgImage="url('https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80')"
      bgSize="cover"
      bgPosition="center"
      bgRepeat="no-repeat"
      position="relative"
      display="flex"
      alignItems="center"
      justifyContent="center"
      _before={{
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bg: 'blackAlpha.500',
        zIndex: 0,
      }}
    >
      <Box position="relative" zIndex={1} w="full">
        <Container maxW="md">
          <MotionCard
            boxShadow="dark-lg"
            borderRadius="2xl"
            overflow="hidden"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' } as any}
          >
            <CardBody p={8}>
              <VStack spacing={6} align="stretch">
                {/* Logo/Header */}
                <MotionBox
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' } as any}
                >
                  <VStack spacing={2}>
                    <Box
                      bg="brand.500"
                      p={4}
                      borderRadius="full"
                      boxShadow="0 0 24px rgba(8,150,255,0.4)"
                    >
                      <FiLogIn size={32} color="white" />
                    </Box>
                    <Heading size="xl" textAlign="center" color="brand.300">
                      LLM Exam Checker
                    </Heading>
                    <Text color="gray.400" textAlign="center">
                      Σύνδεση στο σύστημα βαθμολόγησης
                    </Text>
                  </VStack>
                </MotionBox>

                {/* Login Form */}
                <form onSubmit={handleSubmit}>
                  <VStack spacing={4}>
                    <MotionBox
                      w="full"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25, duration: 0.35 } as any}
                    >
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
                    </MotionBox>

                    <MotionBox
                      w="full"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35, duration: 0.35 } as any}
                    >
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
                    </MotionBox>

                    <MotionBox
                      w="full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.45, duration: 0.4 } as any}
                    >
                      <Button
                        type="submit"
                        colorScheme="brand"
                        size="lg"
                        width="full"
                        isLoading={isLoggingIn}
                        loadingText="Σύνδεση..."
                        leftIcon={<FiLogIn />}
                        mt={2}
                        boxShadow="0 0 16px rgba(8,150,255,0.3)"
                        _hover={{ boxShadow: '0 0 24px rgba(8,150,255,0.5)' }}
                      >
                        Σύνδεση
                      </Button>
                    </MotionBox>
                  </VStack>
                </form>

                {/* Footer */}
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Για βοήθεια επικοινωνήστε με τον διαχειριστή
                </Text>
              </VStack>
            </CardBody>
          </MotionCard>
        </Container>
      </Box>
    </Box>
  );
}
