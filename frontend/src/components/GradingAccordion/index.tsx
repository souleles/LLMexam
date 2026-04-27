import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Code,
  Divider,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiCheck, FiX } from 'react-icons/fi';

export interface SnippetMatch {
  file?: string;
  line: number;
  snippet: string;
}

export interface CheckpointAccordionItem {
  checkpointId: string;
  checkpointDescription: string;
  regexMatched?: boolean;
  regexSnippets?: SnippetMatch[];
  llmMatched?: boolean;
  llmSnippets?: SnippetMatch[];
}

interface GradingAccordionProps {
  items: CheckpointAccordionItem[];
}

function SnippetList({ snippets, colorScheme }: { snippets: SnippetMatch[]; colorScheme?: string }) {
  return (
    <VStack align="stretch" spacing={2}>
      <Text fontWeight="medium" fontSize="sm">Βρέθηκε στις γραμμές:</Text>
      {snippets.map((s, idx) => (
        <Box key={idx}>
          <Text fontSize="sm" color="gray.400" mb={1}>
            {s.file ? `${s.file} — Γραμμή ${s.line}` : `Γραμμή ${s.line}`}:
          </Text>
          <Code
            p={2}
            borderRadius="md"
            display="block"
            borderLeftWidth={colorScheme ? '3px' : undefined}
            borderLeftColor={colorScheme ? `${colorScheme}.400` : undefined}
          >
            {s.snippet}
          </Code>
        </Box>
      ))}
    </VStack>
  );
}

export function GradingAccordion({ items }: GradingAccordionProps) {
  return (
    <Accordion allowMultiple>
      {items.map((item, index) => {
        const overallMatched = item.regexMatched || item.llmMatched;
        const hasRegex = item.regexMatched !== undefined;
        const hasLlm = item.llmMatched !== undefined;

        return (
          <AccordionItem key={item.checkpointId}>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack>
                    {overallMatched ? <FiCheck color="green" /> : <FiX color="red" />}
                    <Text fontWeight="medium">
                      Checkpoint {index + 1}: {item.checkpointDescription}
                    </Text>
                  </HStack>
                </Box>
                <HStack mr={2} spacing={1}>
                  {hasRegex && (
                    <Badge colorScheme={item.regexMatched ? 'green' : 'red'} fontSize="xs">
                      Regex: {item.regexMatched ? 'ΠΕΤΥΧΕ' : 'ΑΠΕΤΥΧΕ'}
                    </Badge>
                  )}
                  {hasLlm && (
                    <Badge colorScheme={item.llmMatched ? 'green' : 'red'} fontSize="xs">
                      LLM: {item.llmMatched ? 'ΠΕΤΥΧΕ' : 'ΑΠΕΤΥΧΕ'}
                    </Badge>
                  )}
                </HStack>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <VStack align="stretch" spacing={3} divider={hasRegex && hasLlm ? <Divider /> : undefined}>
                {hasRegex && (
                  <Box>
                    <Badge colorScheme="brand" mb={2}>Regex Patterns</Badge>
                    {item.regexMatched && item.regexSnippets && item.regexSnippets.length > 0 ? (
                      <SnippetList snippets={item.regexSnippets} />
                    ) : (
                      <Text color="gray.500" fontSize="sm">
                        Δεν βρέθηκαν αποτελέσματα για αυτό το checkpoint
                      </Text>
                    )}
                  </Box>
                )}
                {hasLlm && (
                  <Box>
                    <Badge colorScheme="purple" mb={2}>LLM</Badge>
                    {item.llmMatched && item.llmSnippets && item.llmSnippets.length > 0 ? (
                      <SnippetList snippets={item.llmSnippets} colorScheme="purple" />
                    ) : (
                      <Text color="gray.500" fontSize="sm">
                        Δεν βρέθηκαν αποτελέσματα για αυτό το checkpoint
                      </Text>
                    )}
                  </Box>
                )}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
