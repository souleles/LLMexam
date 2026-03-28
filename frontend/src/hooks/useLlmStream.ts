import { useState, useCallback, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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

      const url = `${API_BASE_URL}/api/llm/chat?exercise_id=${exerciseId}&message=${encodeURIComponent(
        message
      )}`;
      const es = new EventSource(url);

      es.onmessage = (e) => {
        if (e.data === '[DONE]') {
          es.close();
          setStreaming(false);
          return;
        }
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.content) {
            setBuffer((prev) => prev + parsed.content);
          }
        } catch {
          // Assume plain text
          setBuffer((prev) => prev + e.data);
        }
      };

      es.onerror = (err) => {
        console.error('SSE error:', err);
        es.close();
        setStreaming(false);
        setError('Connection error. Please try again.');
      };

      // Cleanup on unmount
      return () => {
        es.close();
        setStreaming(false);
      };
    },
    [exerciseId]
  );

  return { buffer, streaming, sendMessage, error };
}
