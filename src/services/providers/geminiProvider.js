export class GeminiProvider {
  constructor(apiKey, model = 'gemini-2.5-flash') {
    this.id = 'gemini';
    this.name = 'Google Gemini';
    this.apiKey = (apiKey || '').trim();
    this.model = (model || 'gemini-2.5-flash').trim();
  }

  async executePost(targetUrl, body) {
    try {
      const proxyRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          headers: { 'Content-Type': 'application/json' },
          body
        })
      });
      if (proxyRes.status !== 404 && proxyRes.status !== 502) {
        return proxyRes;
      }
    } catch {
      // Fallback to direct fetch
    }

    return fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async generateText(prompt, systemInstruction) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required. Please set it in Coach Settings.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await this.executePost(url, body);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  }

  async chat(messages, tools) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required. Please set it in Coach Settings.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const contents = [];
    let systemInstruction = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content || '';
      } else if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content || '' }] });
      } else if (msg.role === 'assistant') {
        const parts = [];
        if (msg.content) parts.push({ text: msg.content });
        if (Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            let args = {};
            try {
              args = typeof tc.function?.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : tc.function?.arguments || {};
            } catch {
              args = {};
            }
            parts.push({
              functionCall: {
                name: tc.function?.name,
                args
              }
            });
          }
        }
        contents.push({ role: 'model', parts });
      } else if (msg.role === 'tool') {
        let responseObj = {};
        try {
          responseObj = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content || {};
        } catch {
          responseObj = { output: msg.content };
        }
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: msg.tool_call_id || 'tool_response',
              response: responseObj
            }
          }]
        });
      }
    }

    const body = { contents };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (tools && tools.length > 0) {
      body.tools = [{
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      }];
    }

    const response = await this.executePost(url, body);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content;
    const parts = candidate?.parts || [];

    let textContent = '';
    const toolCalls = [];
    const rawToolCalls = [];

    for (const part of parts) {
      if (part.text) {
        textContent += part.text;
      }
      if (part.functionCall) {
        const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        toolCalls.push({
          id: callId,
          name: part.functionCall.name,
          args: part.functionCall.args || {}
        });
        rawToolCalls.push({
          id: callId,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {})
          }
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      assistantMessage: {
        role: 'assistant',
        content: textContent || null,
        tool_calls: rawToolCalls.length > 0 ? rawToolCalls : undefined
      }
    };
  }
}
