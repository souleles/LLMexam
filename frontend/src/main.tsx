import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, localStorageManager } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '@/theme';
import App from './App';
import { AuthProvider } from './contexts/use-auth';

// Force dark mode regardless of localStorage
const forceDarkManager = {
  ...localStorageManager,
  get: () => 'dark' as const,
  set: () => {},
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={theme} colorModeManager={forceDarkManager}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ChakraProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
