/**
 * @typedef {Object} ProviderToolDecl
 * @property {string} name
 * @property {string} description
 * @property {{ type: 'object', properties: Record<string, unknown>, required?: string[] }} parameters
 *
 * @typedef {Object} ProviderToolCall
 * @property {string} id
 * @property {string} name
 * @property {Record<string, unknown>} args
 *
 * @typedef {Object} ProviderRawToolCall
 * @property {string} id
 * @property {'function'} type
 * @property {{ name: string, arguments: string }} function
 *
 * @typedef {Object} ProviderChatMessage
 * @property {'system' | 'user' | 'assistant' | 'tool'} role
 * @property {string | null} content
 * @property {ProviderRawToolCall[]} [tool_calls]
 * @property {string} [tool_call_id]
 *
 * @typedef {Object} ProviderChatResult
 * @property {string} content
 * @property {ProviderToolCall[]} toolCalls
 * @property {ProviderChatMessage} assistantMessage
 *
 * @typedef {Object} ILlmProvider
 * @property {string} id
 * @property {string} name
 * @property {(prompt: string, systemInstruction?: string) => Promise<string>} generateText
 * @property {(messages: ProviderChatMessage[], tools?: ProviderToolDecl[]) => Promise<ProviderChatResult>} [chat]
 */

export const SUPPORTED_PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-2.5-flash' },
  { id: 'openrouter', name: 'OpenRouter', defaultModel: 'openrouter/free', defaultEndpoint: 'https://openrouter.ai/api/v1' },
  { id: 'nebius', name: 'Nebius Token Factory', defaultModel: 'MiniMaxAI/MiniMax-M3.1-Flash', defaultEndpoint: 'https://api.tokenfactory.nebius.com/v1' },
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  { id: 'ollama', name: 'Ollama (Local)', defaultModel: 'llama3.2', defaultEndpoint: 'http://localhost:11434' }
];

export async function parseApiError(response, providerName = 'AI Provider') {
  const status = response.status;
  if (status === 524) {
    return `${providerName} timed out (Error 524). Cloudflare or the AI host took too long to respond. Please try again.`;
  }
  if (status === 504) {
    return `${providerName} gateway timeout (Error 504). Please try again.`;
  }
  if (status === 502 || status === 503) {
    return `${providerName} service temporarily unavailable (Error ${status}). Please try again shortly.`;
  }
  if (status === 429) {
    return `${providerName} rate limit exceeded (Error 429). Please wait a moment or check your API quota.`;
  }
  if (status === 401 || status === 403) {
    return `${providerName} authentication failed (Error ${status}). Please verify your API key in Coach Settings.`;
  }

  let text = '';
  try {
    text = await response.text();
  } catch {
    return `${providerName} request failed with status ${status}.`;
  }

  try {
    const json = JSON.parse(text);
    if (json.error) {
      if (typeof json.error === 'string') return `${providerName} Error: ${json.error}`;
      if (json.error.message) return `${providerName} Error: ${json.error.message}`;
    }
    if (json.message) return `${providerName} Error: ${json.message}`;
  } catch {}

  if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('</')) {
    const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const cleanTitle = titleMatch[1].replace(/amritai\.org\s*\|\s*/i, '').trim();
      return `${providerName} Server Error (${status}): ${cleanTitle}`;
    }
    const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
    return `${providerName} Server Error (${status}): ${cleanText || 'An unexpected server error occurred.'}`;
  }

  return `${providerName} Error (${status}): ${text.slice(0, 200).trim()}`;
}
