import { motion } from 'framer-motion';
import { Box } from '@chakra-ui/react';

const MotionBox = motion(Box);

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <MotionBox
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' } as any}
    >
      {children}
    </MotionBox>
  );
}
