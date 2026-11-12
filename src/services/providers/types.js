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
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  { id: 'ollama', name: 'Ollama (Local)', defaultModel: 'llama3.2', defaultEndpoint: 'http://localhost:11434' }
];
