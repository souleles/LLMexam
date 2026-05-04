export type ContentItem = { title: string; description: string };
export type ContentBlock = { title: string; content: ContentItem[] };
export type ParsedSegment = ContentBlock[] | string;

/**
 * Converts a raw stored/streamed SSE message into an ordered list of segments.
 * Each segment is either a plain string or a structured ContentBlock[].
 * Most messages produce a single-element array; messages with both a text
 * summary and a checkpoints/patterns payload produce two elements.
 */
export function parseMessageContent(raw: string): ParsedSegment[] {
  const chunks = raw
    .split(/\n\n/)
    .map((c) => c.replace(/^data:\s*/, '').trim())
    .filter((c) => c && c !== '[DONE]');

  const segments: ParsedSegment[] = [];
  const textParts: string[] = [];

  const flushText = () => {
    const t = textParts.join('\n\n').trim();
    if (t) segments.push(t);
    textParts.length = 0;
  };

  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk);

      if (parsed.type === 'checkpoints' && Array.isArray(parsed.data)) {
        flushText();
        segments.push(
          (parsed.data as { order: number; description: string }[]).map(cp => ({
            title: cp.description,
            content: [],
          }))
        );
        continue;
      }

      if (parsed.type === 'patterns' && Array.isArray(parsed.data)) {
        flushText();
        segments.push(
          (parsed.data as { order: number; description: string; pattern: string; patternDescription: string; indicatorSolution?: string }[])
            .map(p => ({
              title: p.description,
              content: [
                { title: 'Pattern', description: p.pattern },
                { title: 'Περιγραφή Pattern', description: p.patternDescription ?? '' },
                ...(p.indicatorSolution ? [{ title: 'Ενδεικτική Λύση', description: p.indicatorSolution }] : []),
              ],
            }))
        );
        continue;
      }

      const token = parsed.content ?? parsed.choices?.[0]?.delta?.content;
      if (token) textParts.push(token);
    } catch {
      textParts.push(chunk);
    }
  }

  flushText();
  return segments;
}
