import { parseApiError } from './types';

export class OpenAICompatibleProvider {
  constructor(profile, config = {}) {
    this.id = profile.id;
    this.name = profile.name;
    this.label = profile.label || profile.name;
    this.apiKey = (config.apiKey || '').trim();
    this.model = config.model?.trim() || profile.defaultModel;
    const rawEndpoint = config.endpoint?.trim() || profile.defaultEndpoint || 'https://api.openai.com/v1';
    const clean = rawEndpoint.replace(/\/+$/, '');
    if (clean.endsWith('/chat/completions')) {
      this.endpoint = clean;
    } else if (clean.endsWith('/v1')) {
      this.endpoint = `${clean}/chat/completions`;
    } else {
      this.endpoint = `${clean}/v1/chat/completions`;
    }
  }

  async executePost(targetUrl, headers, body) {
    if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) {
      return fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const proxyRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          headers,
          body
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (proxyRes.status < 500 && proxyRes.status !== 404) {
        return proxyRes;
      }
    } catch {
      // Fallback to direct fetch
    }

    return fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  }

  async generateText(prompt, systemInstruction) {
    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });
    const result = await this.chat(messages);
    return result.content;
  }

  async chat(messages, tools) {
    if (!this.apiKey && this.id !== 'ollama') {
      throw new Error(`${this.label} API key is required. Please set it in Coach Settings.`);
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    if (this.id === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://satranj.app';
      headers['X-Title'] = 'Satranj Chess';
    }

    const formattedMessages = messages.map((m) => {
      const msg = {
        role: m.role,
        content: m.content
      };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      if (m.reasoning_details !== undefined) msg.reasoning_details = m.reasoning_details;
      return msg;
    });

    const payload = {
      model: this.model,
      messages: formattedMessages
    };

    if (this.id === 'openrouter') {
      payload.reasoning = { enabled: true };
    }

    if (tools && tools.length > 0) {
      payload.tools = tools.map((t) => ({ type: 'function', function: t }));
    }

    const response = await this.executePost(this.endpoint, headers, payload);

    if (!response.ok) {
      const errMsg = await parseApiError(response, this.label || this.name);
      throw new Error(errMsg);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message || {};

    const toolCalls = [];
    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        if (tc?.function) {
          let args = {};
          try {
            args = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments || {};
          } catch {
            args = {};
          }
          toolCalls.push({
            id: tc.id || `call_${Date.now()}`,
            name: tc.function.name,
            args
          });
        }
      }
    }

    const assistantMessage = {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.tool_calls
    };
    if (message.reasoning_details !== undefined) {
      assistantMessage.reasoning_details = message.reasoning_details;
    }

    return {
      content: message.content || '',
      toolCalls,
      assistantMessage
    };
  }
}
