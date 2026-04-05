import { Box, Container, Flex, Heading, Button, HStack, Menu, MenuButton, MenuList, MenuItem, MenuDivider, Avatar, Text, IconButton, useToast } from '@chakra-ui/react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { FiBarChart, FiFileText, FiUpload, FiUsers, FiChevronDown, FiUser, FiLogOut } from 'react-icons/fi';
import { useAuthContext } from '@/contexts/use-auth';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useAuthContext();

  const isActive = (path: string) => location.pathname.includes(path);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Αποσύνδεση επιτυχής',
        status: 'success',
        duration: 2000,
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: 'Σφάλμα αποσύνδεσης',
        status: 'error',
        duration: 3000,
      });
    }
  };

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
                to="/students"
                variant={isActive('/students') && !isActive('/student-exercises') ? 'solid' : 'ghost'}
                colorScheme={isActive('/students') && !isActive('/student-exercises') ? 'brand' : 'gray'}
                leftIcon={<FiUsers />}
                size="sm"
              >
                Φοιτητές
              </Button>
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
              <Button
                as={RouterLink}
                to="/student-exercises"
                variant={isActive('/student-exercises') ? 'solid' : 'ghost'}
                colorScheme={isActive('/student-exercises') ? 'brand' : 'gray'}
                leftIcon={<FiBarChart />}
                size="sm"
              >
                Στατιστικά
              </Button>
            </HStack>
          </HStack>

          {/* User Menu */}
          <Menu>
            <MenuButton
              as={IconButton}
              icon={
                <HStack spacing={2}>
                  <Avatar
                    size="sm"
                    name={user?.username}
                    bg="brand.500"
                    color="white"
                  />
                  <FiChevronDown />
                </HStack>
              }
              variant="ghost"
              _hover={{ bg: 'gray.100' }}
              _active={{ bg: 'gray.200' }}
              aria-label="User menu"
            />
            <MenuList>
              {/* User Info Header */}
              <Box px={3} py={2}>
                <Text fontWeight="semibold" fontSize="sm">
                  {user?.username}
                </Text>
              </Box>

              <MenuDivider />

              <MenuItem
                icon={<FiLogOut />}
                onClick={handleLogout}
                color="red.500"
                _hover={{ bg: 'red.50' }}
              >
                Αποσύνδεση
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </Container>
    </Box>
  );
}
