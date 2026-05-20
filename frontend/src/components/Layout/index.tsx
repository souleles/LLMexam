import { Outlet } from 'react-router-dom';
import { Box, Container } from '@chakra-ui/react';
import { useMemo } from 'react';
import { Header } from './Header';

function VoidBackground() {
  const glows = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        left: `${(Math.random() * 80 + 10).toFixed(1)}%`,
        top: `${(Math.random() * 80 + 10).toFixed(1)}%`,
        size: Math.floor(Math.random() * 220 + 280),
        duration: (Math.random() * 18 + 24).toFixed(1),
        delay: `${-(Math.random() * 36).toFixed(1)}s`,
        dx: (Math.random() * 50 - 25).toFixed(0),
        dy: (Math.random() * 50 - 25).toFixed(0),
      })),
    []
  );


  return (
    <>
      <style>{`
        @keyframes glowDrift {
          0%   { opacity: 0;            transform: translate(0, 0) scale(0.85); }
          30%  { opacity: var(--go); }
          50%  { transform: translate(var(--dx), var(--dy)) scale(1.08); }
          70%  { opacity: var(--go); }
          100% { opacity: 0;            transform: translate(0, 0) scale(0.85); }
        }
      `}</style>
      <Box position="fixed" inset={0} zIndex={0} pointerEvents="none" overflow="hidden" aria-hidden="true">
        {/* Fixed accent blob — top-left, bleeds below navbar */}
        <Box
          position="absolute"
          left="-80px"
          top="-60px"
          w="520px"
          h="420px"
          borderRadius="50%"
          pointerEvents="none"
          style={{
            background:
              'radial-gradient(circle at 35% 35%, rgba(8,150,255,0.13) 0%, rgba(8,150,255,0.05) 40%, transparent 70%)',
          }}
        />
        {glows.map((g) => (
          <Box
            key={g.id}
            position="absolute"
            left={g.left}
            top={g.top}
            w={`${g.size}px`}
            h={`${g.size}px`}
            borderRadius="50%"
            style={
              {
                '--go': '1',
                '--dx': `${g.dx}px`,
                '--dy': `${g.dy}px`,
                background:
                  'radial-gradient(circle at center, rgba(8,150,255,0.09) 0%, rgba(8,150,255,0.03) 45%, transparent 70%)',
                transform: 'translate(-50%, -50%)',
                animation: `glowDrift ${g.duration}s ease-in-out ${g.delay} infinite`,
              } as React.CSSProperties
            }
          />
        ))}
      </Box>
    </>
  );
}

export function Layout() {
  return (
    <Box minH="100vh" bg="gray.900" position="relative">
      <VoidBackground />
      <Box position="relative" zIndex={1}>
        <Header />
        <Container maxW="container.xl" py={8}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
