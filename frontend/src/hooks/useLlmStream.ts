import { useCallback, useState } from 'react';
import { Checkpoint } from '@/lib/api';
import { parseMessageContent } from '@/lib/parseMessageContent';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type PendingCheckpoint = Pick<Checkpoint, 'order' | 'description' | 'pattern' | 'caseSensitive' | 'patternDescription'>;
type PendingPattern = { order: number; pattern: string; description: string; patternDescription: string };

interface UseLlmStreamResult {
  buffer: string;
  streaming: boolean;
  sendMessage: (message: string) => void;
  error: string | null;
  pendingCheckpoints: PendingCheckpoint[];
  clearPendingCheckpoints: () => void;
  pendingPatterns: PendingPattern[];
  clearPendingPatterns: () => void;
}

export function useLlmStream(exerciseId: string, mode: 'checkpoints' | 'patterns' = 'checkpoints'): UseLlmStreamResult {
  const [buffer, setBuffer] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCheckpoints, setPendingCheckpoints] = useState<PendingCheckpoint[]>([]);
  const [pendingPatterns, setPendingPatterns] = useState<PendingPattern[]>([]);

  const clearPendingCheckpoints = useCallback(() => setPendingCheckpoints([]), []);
  const clearPendingPatterns = useCallback(() => setPendingPatterns([]), []);

  const sendMessage = useCallback(
    (message: string) => {
      setStreaming(true);
      setBuffer('');
      setError(null);
      setPendingCheckpoints([]);
      setPendingPatterns([]);

      const endpoint = mode === 'patterns' ? 'chat-patterns' : 'chat';
      const url = `${API_BASE_URL}/api/llm/${endpoint}?exercise_id=${exerciseId}&message=${encodeURIComponent(message)}`;
      const es = new EventSource(url);

      es.onmessage = (e: MessageEvent) => {
        const chunks = (e.data as string)
          .split(/\n\n/)
          .map((chunk: string) => chunk.replace(/^data:\s*/, '').trim())
          .filter(Boolean);

        const isDone = chunks.includes('[DONE]');

        for (const raw of chunks) {
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'checkpoints' && Array.isArray(parsed.data)) {
              setPendingCheckpoints(parsed.data as PendingCheckpoint[]);
            } else if (parsed.type === 'patterns' && Array.isArray(parsed.data)) {
              setPendingPatterns(parsed.data as PendingPattern[]);
            }
          } catch { /* not JSON */ }
        }

        const parsed = parseMessageContent(e.data as string);
        if (typeof parsed === 'string' && parsed) {
          setBuffer((prev) => prev + (prev ? '\n\n' : '') + parsed);
        }

        if (isDone) {
          es.close();
          setStreaming(false);
        }
      };

      es.onerror = (err) => {
        console.error('SSE error:', err);
        es.close();
        setStreaming(false);
        setError('Connection error. Please try again.');
      };
    },
    [exerciseId, mode]
  );

  return { buffer, streaming, sendMessage, error, pendingCheckpoints, clearPendingCheckpoints, pendingPatterns, clearPendingPatterns };
}
