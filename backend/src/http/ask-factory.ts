import { LlmAskAssistant, RuleBasedAskAssistant, type AskAssistant } from '../domain/ask';

export function createAskAssistant(): AskAssistant {
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (apiKey) {
    return new LlmAskAssistant({
      apiKey,
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
    });
  }
  return new RuleBasedAskAssistant();
}
