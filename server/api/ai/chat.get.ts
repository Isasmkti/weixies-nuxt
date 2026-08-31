import { resolveAiChatIdentity } from '~/server/utils/ai-chat-auth';
import { setAiChatResponseHeaders } from '~/server/utils/ai-chat-security';
import {
  findOwnedAiConversation,
  getAiConversationHistory,
  toPublicAiConversation,
} from '~/server/utils/ai-chat-store';
import { enforceRateLimit } from '~/server/utils/rate-limit';

export default defineEventHandler(async (event) => {
  setAiChatResponseHeaders(event);
  const identity = await resolveAiChatIdentity(event);

  // Merely opening the widget must not create a guest identifier or database
  // row. The first POST establishes the session instead.
  if (!identity) return { conversation: null, messages: [] };

  await enforceRateLimit(`ai-chat:history:${identity.rateLimitId}`, 60, 60);
  const conversation = await findOwnedAiConversation(identity);
  if (!conversation) return { conversation: null, messages: [] };

  const messages = await getAiConversationHistory(identity, conversation);
  return {
    conversation: toPublicAiConversation(conversation),
    messages,
  };
});
