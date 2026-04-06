import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  },
  colors: {
    gray: {
      50: '#F7FAFC',
      100: '#EDF2F7',
      200: '#E2E8F0',
      300: '#CBD5E0',
      400: '#A0AEC0',
      500: '#718096',
      600: '#4A5568',
      700: '#2a3347',
      750: '#222b3d',
      800: '#1c2333',
      850: '#181e2e',
      900: '#141820',
    },
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
        bg: 'gray.900',
        color: 'gray.100',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'gray.800',
          borderColor: 'gray.700',
          boxShadow: 'none',
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            borderColor: 'gray.700',
            color: 'gray.400',
          },
          td: {
            borderColor: 'gray.700',
          },
        },
      },
    },
    Divider: {
      baseStyle: {
        borderColor: 'gray.700',
      },
    },
    Menu: {
      baseStyle: {
        list: {
          bg: 'gray.800',
          borderColor: 'gray.700',
        },
        item: {
          bg: 'gray.800',
          _hover: { bg: 'gray.700' },
          _focus: { bg: 'gray.700' },
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          bg: 'gray.800',
        },
      },
    },
    AlertDialog: {
      baseStyle: {
        dialog: {
          bg: 'gray.800',
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: 'gray.750',
            borderColor: 'gray.600',
            _hover: { borderColor: 'gray.500' },
            _focus: {
              borderColor: 'brand.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
            },
            _placeholder: { color: 'gray.500' },
          },
        },
      },
      defaultProps: {
        variant: 'outline',
      },
    },
    Textarea: {
      variants: {
        outline: {
          bg: 'gray.750',
          borderColor: 'gray.600',
          _hover: { borderColor: 'gray.500' },
          _placeholder: { color: 'gray.500' },
        },
      },
    },
    Accordion: {
      baseStyle: {
        button: {
          _hover: { bg: 'gray.700' },
        },
        panel: {
          bg: 'transparent',
        },
      },
    },
    Tabs: {
      variants: {
        enclosed: {
          tab: {
            _selected: {
              bg: 'gray.800',
              borderColor: 'gray.600',
              borderBottomColor: 'gray.800',
              color: 'white',
            },
            _hover: { bg: 'gray.700' },
            borderColor: 'gray.600',
            color: 'gray.400',
          },
          tablist: {
            borderColor: 'gray.600',
          },
          tabpanel: {
            bg: 'gray.800',
          },
        },
        line: {
          tab: {
            _selected: {
              color: 'brand.400',
              borderColor: 'brand.400',
            },
            color: 'gray.400',
          },
          tablist: {
            borderColor: 'gray.700',
          },
        },
      },
    },
    Badge: {
      baseStyle: {
        textTransform: 'none',
      },
    },
    Code: {
      baseStyle: {
        bg: 'gray.900',
        color: 'green.300',
      },
    },
    NumberInput: {
      variants: {
        outline: {
          field: {
            bg: 'gray.750',
            borderColor: 'gray.600',
          },
          stepper: {
            borderColor: 'gray.600',
          },
        },
      },
    },
    Skeleton: {
      baseStyle: {
        startColor: 'gray.700',
        endColor: 'gray.600',
      },
    },
  },
});
