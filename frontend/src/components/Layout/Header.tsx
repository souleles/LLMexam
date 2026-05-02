import { useAuthContext } from '@/contexts/use-auth';
import { Avatar, Box, Button, Container, Flex, Heading, HStack, IconButton, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Text, useToast } from '@chakra-ui/react';
import { FiChevronDown, FiFileText, FiLogOut, FiUpload, FiUsers } from 'react-icons/fi';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

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
    <Box bg="gray.800" borderBottom="1px" borderColor="gray.700" py={4}>
      <Container maxW="container.xl">
        <Flex justify="space-between" align="center">
          <HStack spacing={8}>
            <Heading
              as={RouterLink}
              to="/exercises"
              size="lg"
              color="brand.400"
              cursor="pointer"
              _hover={{ color: 'brand.300' }}
            >
              ExamGrader
            </Heading>
            <HStack spacing={1}>
              {[
                { to: '/students', label: 'Φοιτητές', icon: <FiUsers />, active: isActive('/students') && !isActive('/student-exercises') },
                { to: '/exercises', label: 'Ασκήσεις', icon: <FiFileText />, active: isActive('/exercises') && !isActive('/student-exercises') },
                { to: '/student-exercises', label: 'Βαθμολόγηση Φοιτητών', icon: <FiUpload />, active: isActive('/student-exercises') },
              ].map(({ to, label, icon, active }) => (
                <Button
                  key={to}
                  as={RouterLink}
                  to={to}
                  variant={active ? 'solid' : 'ghost'}
                  colorScheme={active ? 'brand' : undefined}
                  color={active ? undefined : 'whiteAlpha.900'}
                  leftIcon={icon}
                  size="sm"
                  _hover={{ bg: active ? undefined : 'whiteAlpha.200' }}
                >
                  {label}
                </Button>
              ))}
              {/* <Button
                as={RouterLink}
                to="/student-exercises"
                variant={isActive('/student-exercises') ? 'solid' : 'ghost'}
                colorScheme={isActive('/student-exercises') ? 'brand' : 'gray'}
                leftIcon={<FiBarChart />}
                size="sm"
              >
                Στατιστικά
              </Button> */}
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
              _hover={{ bg: 'gray.700' }}
              _active={{ bg: 'gray.600' }}
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
                color="red.400"
                _hover={{ bg: 'red.900' }}
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
