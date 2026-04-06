/**
 * Converts a raw stored/streamed message content string into display text.
 *
 * Handles:
 *  - Multiple "data: ..." lines embedded in one string (backend forwarding raw SSE)
 *  - Checkpoint JSON payloads  → numbered list text
 *  - OpenAI delta tokens       → plain text
 *  - Plain text tokens         → returned as-is
 */
export function parseMessageContent(raw: string): string {
  const chunks = raw
    .split(/\n\n/)
    .map((c) => c.replace(/^data:\s*/, '').trim())
    .filter((c) => c && c !== '[DONE]');

  const parts: string[] = [];

  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk);

      if (parsed.type === 'checkpoints' && Array.isArray(parsed.data)) {
        const listText = (parsed.data as { order: number; description: string }[])
          .map((cp, i) => `${cp.order ?? i + 1}. ${cp.description}`)
          .join('\n');
        parts.push(listText);
        continue;
      }

      if (parsed.type === 'patterns' && Array.isArray(parsed.data)) {
        const listText = (parsed.data as { order: number; description: string; pattern: string, patternDescription: string }[])
          .map((p, i) => `${p.order ?? i + 1}. ${p.description}\nPattern: ${p.pattern}\nΠεριγραφή Pattern: ${p.patternDescription}`)
          .join('\n');
        parts.push(listText);
        continue;
      }

      const token = parsed.content ?? parsed.choices?.[0]?.delta?.content;
      if (token) parts.push(token);
    } catch {
      parts.push(chunk);
    }
  }

  return parts.join('\n\n');
}
