import { useCallback, useState } from 'react';
import { Checkpoint } from '@/lib/api';
import { parseMessageContent } from '@/lib/parseMessageContent';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type PendingCheckpoint = Pick<Checkpoint, 'order' | 'description' | 'pattern' | 'caseSensitive'>;

interface UseLlmStreamResult {
  buffer: string;
  streaming: boolean;
  sendMessage: (message: string) => void;
  error: string | null;
  pendingCheckpoints: PendingCheckpoint[];
  clearPendingCheckpoints: () => void;
}

export function useLlmStream(exerciseId: string): UseLlmStreamResult {
  const [buffer, setBuffer] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCheckpoints, setPendingCheckpoints] = useState<PendingCheckpoint[]>([]);

  const clearPendingCheckpoints = useCallback(() => setPendingCheckpoints([]), []);

  const sendMessage = useCallback(
    (message: string) => {
      setStreaming(true);
      setBuffer('');
      setError(null);
      setPendingCheckpoints([]);

      const url = `${API_BASE_URL}/api/llm/chat?exercise_id=${exerciseId}&message=${encodeURIComponent(message)}`;
      const es = new EventSource(url);

      es.onmessage = (e: MessageEvent) => {

        const chunks = (e.data as string)
          .split(/\n\n/)
          .map((chunk: string) => chunk.replace(/^data:\s*/, '').trim())
          .filter(Boolean);

        const isDone = chunks.includes('[DONE]');

        // Collect checkpoints into pending state — saving only happens on user approval
        for (const raw of chunks) {
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'checkpoints' && Array.isArray(parsed.data)) {
              setPendingCheckpoints(parsed.data as PendingCheckpoint[]);
            }
          } catch { /* not JSON */ }
        }

        const text = parseMessageContent(e.data as string);
        if (text) setBuffer((prev) => prev + (prev ? '\n\n' : '') + text);

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
    [exerciseId]
  );

  return { buffer, streaming, sendMessage, error, pendingCheckpoints, clearPendingCheckpoints };
}
