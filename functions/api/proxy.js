/**
 * Cloudflare Pages Function: /api/proxy
 * Handles external AI API requests (Gemini, OpenAI, Ollama Cloud)
 * when deployed on Cloudflare Pages without CORS limitations.
 */

const ALLOWED_TARGET_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'openai.com',
  'ollama.com',
  'api.mistral.ai',
  'router.requesty.ai',
  'api.tokenfactory.nebius.com',
  'openrouter.ai'
]);

function isAllowedTarget(targetUrl) {
  try {
    const url = new URL(targetUrl);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      (ALLOWED_TARGET_HOSTS.has(host) ||
        [...ALLOWED_TARGET_HOSTS].some((allowed) => host.endsWith('.' + allowed)))
    );
  } catch {
    return false;
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, HTTP-Referer, X-Title',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function onRequestPost(context) {
  try {
    const { targetUrl, body, headers, method: reqMethod } = await context.request.json();

    if (!targetUrl || typeof targetUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid targetUrl' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!isAllowedTarget(targetUrl)) {
      return new Response(
        JSON.stringify({
          error: `Blocked: target host is not on the proxy allow-list (allowed: ${[...ALLOWED_TARGET_HOSTS].join(', ')})`
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const forwardHeaders = {
      'Content-Type': 'application/json'
    };
    if (headers && typeof headers.Authorization === 'string' && headers.Authorization) {
      forwardHeaders.Authorization = headers.Authorization;
    }
    if (headers && typeof headers['HTTP-Referer'] === 'string' && headers['HTTP-Referer']) {
      forwardHeaders['HTTP-Referer'] = headers['HTTP-Referer'];
    }
    if (headers && typeof headers['X-Title'] === 'string' && headers['X-Title']) {
      forwardHeaders['X-Title'] = headers['X-Title'];
    }

    const method = typeof reqMethod === 'string' && reqMethod ? reqMethod.toUpperCase() : 'POST';
    const fetchOptions = {
      method,
      headers: forwardHeaders
    };

    if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    fetchOptions.signal = controller.signal;

    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutId);
    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'Upstream AI provider request timed out after 25s'
          : err?.message || 'Cloudflare proxy error'
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}
