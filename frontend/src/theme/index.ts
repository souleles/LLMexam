import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  },
  colors: {
    brand: {
      50: '#E6F2FF',
      100: '#BAE0FF',
      200: '#8DCEFF',
      300: '#61BBFF',
      400: '#35A9FF',
      500: '#0896FF',
      600: '#0678CC',
      700: '#055A99',
      800: '#033C66',
      900: '#021E33',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
  },
});
