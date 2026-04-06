import { ContentBlock } from '@/lib/parseMessageContent';
import { Box, ListItem, OrderedList, Text, VStack } from '@chakra-ui/react';

interface MessageContentProps {
  content: string | ContentBlock[];
}

export function MessageContent({ content }: MessageContentProps) {
  if (Array.isArray(content)) {
    return (
      <OrderedList spacing={3} pl={2}>
        {content.map((block, i) => (
          <ListItem key={i}>
            <Text fontWeight="semibold" fontSize="sm">{block.title}</Text>
            {block.content.map((item, j) => (
              <Box key={j} mt={1} ml={2}>
                <Text as="span" fontSize="xs" textDecoration="underline" color="gray.300">
                  {item.title}
                </Text>
                <Text
                  fontSize="xs"
                  color="gray.400"
                  mt={0.5}
                  fontFamily={item.title === 'Pattern' ? 'mono' : undefined}
                >
                  {item.description}
                </Text>
              </Box>
            ))}
          </ListItem>
        ))}
      </OrderedList>
    );
  }

  const lines = content.split('\n');
  const hasNumbered = lines.some((l) => /^\d+\.\s/.test(l.trim()));

  if (!hasNumbered) {
    return <Text whiteSpace="pre-wrap" fontSize="sm">{content}</Text>;
  }

  const segments: Array<{ type: 'text'; value: string } | { type: 'list'; items: string[] }> = [];
  let textAccum: string[] = [];
  let listAccum: string[] = [];

  const flushText = () => {
    const t = textAccum.join('\n').trim();
    if (t) segments.push({ type: 'text', value: t });
    textAccum = [];
  };
  const flushList = () => {
    if (listAccum.length) segments.push({ type: 'list', items: [...listAccum] });
    listAccum = [];
  };

  for (const line of lines) {
    if (/^\d+\.\s/.test(line.trim())) {
      flushText();
      listAccum.push(line);
    } else {
      flushList();
      textAccum.push(line);
    }
  }
  flushText();
  flushList();

  let listCounter = 0;
  return (
    <VStack align="start" spacing={2}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <Text key={i} whiteSpace="pre-wrap" fontSize="sm">{seg.value}</Text>;
        }
        const start = listCounter + 1;
        listCounter += seg.items.length;
        return (
          <OrderedList key={i} spacing={1} pl={4} start={start}>
            {seg.items.map((item, j) => {
              const match = item.match(/^\d+\.\s+(.+)/);
              return (
                <ListItem key={j}>
                  <Text fontSize="sm" whiteSpace="pre-wrap">{match ? match[1] : item}</Text>
                </ListItem>
              );
            })}
          </OrderedList>
        );
      })}
    </VStack>
  );
}
