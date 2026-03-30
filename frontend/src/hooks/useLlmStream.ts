import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface UseLlmStreamResult {
  buffer: string;
  streaming: boolean;
  sendMessage: (message: string) => void;
  error: string | null;
}

export function useLlmStream(exerciseId: string): UseLlmStreamResult {
  const [buffer, setBuffer] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    (message: string) => {
      setStreaming(true);
      setBuffer('');
      setError(null);

      const url = `${API_BASE_URL}/api/llm/chat?exercise_id=${exerciseId}&message=${encodeURIComponent(message)}`;
      const es = new EventSource(url);

      es.onmessage = async (e) => {
        if (e.data === '[DONE]') {
          es.close();
          setStreaming(false);
          return;
        }

        try {
          const parsed = JSON.parse(e.data);

          if (parsed.type === 'checkpoints' && Array.isArray(parsed.data)) {
            // Save to DB and refresh list
            try {
              await api.checkpoints.bulkReplace(exerciseId, parsed.data);
              queryClient.invalidateQueries({ queryKey: ['checkpoints', exerciseId] });
            } catch (saveErr) {
              console.error('Failed to save checkpoints:', saveErr);
            }

            // Format as readable list for the chat bubble
            const listText = parsed.data
              .map((cp: { order: number; description: string }, i: number) =>
                `${cp.order ?? i + 1}. ${cp.description}`
              )
              .join('\n');
            setBuffer((prev) => prev + (prev ? '\n\n' : '') + listText);
            return;
          }

          if (parsed.content) {
            setBuffer((prev) => prev + parsed.content);
          }
        } catch {
          // Plain text token
          setBuffer((prev) => prev + e.data);
        }
      };

      es.onerror = (err) => {
        console.error('SSE error:', err);
        es.close();
        setStreaming(false);
        setError('Connection error. Please try again.');
      };
    },
    [exerciseId]
  );

  return { buffer, streaming, sendMessage, error };
}
