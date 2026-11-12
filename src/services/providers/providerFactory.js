import { GeminiProvider } from './geminiProvider';
import { OpenAICompatibleProvider } from './openAICompatibleProvider';

export function createLlmProvider(options = {}) {
  const provider = options.provider || 'gemini';

  switch (provider) {
    case 'nebius':
      return new OpenAICompatibleProvider(
        {
          id: 'nebius',
          name: 'Nebius Token Factory',
          defaultModel: 'MiniMaxAI/MiniMax-M3.1-Flash',
          defaultEndpoint: 'https://api.tokenfactory.nebius.com/v1'
        },
        {
          apiKey: options.apiKey,
          model: options.model || 'MiniMaxAI/MiniMax-M3.1-Flash',
          endpoint: options.endpoint || 'https://api.tokenfactory.nebius.com/v1'
        }
      );

    case 'openrouter':
      return new OpenAICompatibleProvider(
        {
          id: 'openrouter',
          name: 'OpenRouter',
          defaultModel: 'openrouter/free',
          defaultEndpoint: 'https://openrouter.ai/api/v1'
        },
        {
          apiKey: options.apiKey,
          model: options.model || 'openrouter/free',
          endpoint: options.endpoint || 'https://openrouter.ai/api/v1'
        }
      );

    case 'openai':
      return new OpenAICompatibleProvider(
        {
          id: 'openai',
          name: 'OpenAI',
          defaultModel: 'gpt-4o-mini',
          defaultEndpoint: 'https://api.openai.com'
        },
        {
          apiKey: options.apiKey,
          model: options.model || 'gpt-4o-mini',
          endpoint: options.endpoint
        }
      );

    case 'ollama':
      return new OpenAICompatibleProvider(
        {
          id: 'ollama',
          name: 'Ollama',
          defaultModel: 'llama3.2',
          defaultEndpoint: 'http://localhost:11434'
        },
        {
          apiKey: options.apiKey || 'ollama',
          model: options.model || 'llama3.2',
          endpoint: options.endpoint || 'http://localhost:11434'
        }
      );

    case 'gemini':
    default:
      return new GeminiProvider(options.apiKey, options.model || 'gemini-2.5-flash');
  }
}
