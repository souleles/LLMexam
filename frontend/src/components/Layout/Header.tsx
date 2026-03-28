import { Box, Container, Flex, Heading, Button, HStack } from '@chakra-ui/react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { FiFileText, FiUpload } from 'react-icons/fi';

export function Header() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <Box bg="white" borderBottom="1px" borderColor="gray.200" py={4} shadow="sm">
      <Container maxW="container.xl">
        <Flex justify="space-between" align="center">
          <HStack spacing={8}>
            <Heading
              as={RouterLink}
              to="/exercises"
              size="lg"
              color="brand.600"
              cursor="pointer"
              _hover={{ color: 'brand.700' }}
            >
              ExamChecker
            </Heading>
            <HStack spacing={4}>
              <Button
                as={RouterLink}
                to="/exercises"
                variant={isActive('/exercises') && !isActive('/student-exercises') ? 'solid' : 'ghost'}
                colorScheme={isActive('/exercises') && !isActive('/student-exercises') ? 'brand' : 'gray'}
                leftIcon={<FiFileText />}
                size="sm"
              >
                Ασκήσεις
              </Button>
              <Button
                as={RouterLink}
                to="/student-exercises"
                variant={isActive('/student-exercises') ? 'solid' : 'ghost'}
                colorScheme={isActive('/student-exercises') ? 'brand' : 'gray'}
                leftIcon={<FiUpload />}
                size="sm"
              >
                Βαθμολόγηση Φοιτητών
              </Button>
            </HStack>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
