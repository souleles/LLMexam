import { Outlet } from 'react-router-dom';
import { Box, Container } from '@chakra-ui/react';
import { Header } from './Header';

export function Layout() {
  return (
    <Box minH="100vh" bg="gray.50">
      <Header />
      <Container maxW="container.xl" py={8}>
        <Outlet />
      </Container>
    </Box>
  );
}
