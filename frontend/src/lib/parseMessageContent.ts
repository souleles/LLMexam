export type ContentItem = { title: string; description: string };
export type ContentBlock = { title: string; content: ContentItem[] };
export type ParsedContent = ContentBlock[] | string;

/**
 * Converts a raw stored/streamed SSE message into a structured or plain-text representation.
 *
 * - checkpoints payload → ContentBlock[] (title only, no inner content)
 * - patterns payload    → ContentBlock[] (title + Pattern / Περιγραφή Pattern items)
 * - plain text tokens   → string
 */
export function parseMessageContent(raw: string): ParsedContent {
  const chunks = raw
    .split(/\n\n/)
    .map((c) => c.replace(/^data:\s*/, '').trim())
    .filter((c) => c && c !== '[DONE]');

  const textParts: string[] = [];
  let blocks: ContentBlock[] | null = null;

  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk);

      if (parsed.type === 'checkpoints' && Array.isArray(parsed.data)) {
        blocks = (parsed.data as { order: number; description: string }[]).map((cp, i) => ({
          title: cp.description,
          content: [],
        }));
        continue;
      }

      if (parsed.type === 'patterns' && Array.isArray(parsed.data)) {
        blocks = (parsed.data as { order: number; description: string; pattern: string; patternDescription: string }[])
        .map((p) => ({
            title: p.description,
            content: [
              { title: 'Pattern', description: p.pattern },
              { title: 'Περιγραφή Pattern', description: p.patternDescription ?? '' },
            ]
          })
        );
        continue;
      }

      const token = parsed.content ?? parsed.choices?.[0]?.delta?.content;
      if (token) textParts.push(token);
    } catch {
      textParts.push(chunk);
    }
  }

  if (blocks) return blocks;
  return textParts.join('\n\n');
}
