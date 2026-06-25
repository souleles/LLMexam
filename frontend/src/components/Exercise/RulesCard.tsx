import { useGetRules } from '@/hooks/use-get-rules';
import { useReplaceRules } from '@/hooks/use-replace-rules';
import { QueryKeys } from '@/lib/queryKeys';
import {
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Heading,
  HStack,
  IconButton,
  Input,
  List,
  ListItem,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { FiList, FiPlus, FiX } from 'react-icons/fi';

interface RulesCardProps {
  exerciseId: string;
}

export function RulesCard({ exerciseId }: RulesCardProps) {
  const queryClient = useQueryClient();
  const { data: savedRules = [], isSuccess: rulesLoaded } = useGetRules(exerciseId);
  const replaceMutation = useReplaceRules({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Rules, exerciseId] });
    },
  });

  const [rules, setRules] = useState<string[]>([]);
  const [newRuleText, setNewRuleText] = useState('');
  const seeded = useRef(false);

  useEffect(() => {
    if (!seeded.current && rulesLoaded) {
      setRules(savedRules.map((r) => r.content));
      seeded.current = true;
    }
  }, [rulesLoaded, savedRules]);

  const savedContents = savedRules.map((r) => r.content);
  const isDirty = JSON.stringify(rules) !== JSON.stringify(savedContents);

  const handleAdd = () => {
    const trimmed = newRuleText.trim();
    if (!trimmed) return;
    setRules((prev) => [...prev, trimmed]);
    setNewRuleText('');
  };

  const handleDelete = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string) => {
    setRules((prev) => prev.map((r, i) => (i === index ? value : r)));
  };

  const handleSave = () => {
    replaceMutation.mutate({ exerciseId, rules });
  };

  return (
    <Card h="full">
      <CardBody>
        <VStack align="start" spacing={4}>
          <HStack>
            <FiList size={24} />
            <Heading size="md">Προσθήκη κανόνων</Heading>
          </HStack>
          <Text fontSize="sm" color="gray.400">
            Αυτοί οι κανόνες θα χρησιμοποιηθούν για την δημιουργία checkpoint και regex.
          </Text>
          <Divider />
          <Box w="full" overflowY="auto" maxH="300px">
            <List spacing={2} w="full" marginBottom='2'>
              {rules.map((rule, index) => (
                <ListItem key={index}>
                  <HStack>
                    <Input
                      value={rule}
                      onChange={(e) => handleChange(index, e.target.value)}
                    />
                    <IconButton
                      aria-label="Διαγραφή κανόνα"
                      icon={<FiX />}
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(index)}
                    />
                  </HStack>
                </ListItem>
              ))}
            </List>
            <HStack w="full">
              <Input
                placeholder="Νέος κανόνας..."
                value={newRuleText}
                size='sm'
                onChange={(e) => setNewRuleText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <IconButton
                aria-label="Προσθήκη κανόνα"
                icon={<FiPlus />}
                colorScheme="brand"
                onClick={handleAdd}
                size='sm'
              />
            </HStack>
          </Box>
          <Box w="full" textAlign="right">
            <Button
              colorScheme="brand"
              isDisabled={!isDirty}
              isLoading={replaceMutation.isPending}
              onClick={handleSave}
              size='sm'
            >
              Αποθήκευση
            </Button>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}
