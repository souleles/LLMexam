import { ConversationMessage } from '@/lib/api';
import { ContentBlock } from '@/lib/parseMessageContent';

export type ChatMessage = Omit<ConversationMessage, 'content'> & { content: string | ContentBlock[] };
