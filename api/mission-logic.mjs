/**
 * Shared AI mission proxy — used by Netlify Functions, Cloudflare Workers, etc.
 * Keys come from env / Worker bindings only (never the static site).
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function callAnthropic(env, { system, prompt }) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key || !String(key).trim()) {
    throw new Error('ANTHROPIC_API_KEY is not configured on the server');
  }
  const model = env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': String(key).trim(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.error?.message || data.message || `Anthropic HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text =
    data.content?.map((b) => (b.type === 'text' ? b.text : '')).join('') || '';
  return { text, provider: 'anthropic', model };
}

async function callMoonshot(env, { system, prompt }) {
  const key = env.MOONSHOT_API_KEY;
  if (!key || !String(key).trim()) {
    throw new Error('MOONSHOT_API_KEY is not configured on the server');
  }

  const base = (
    env.MOONSHOT_API_BASE || 'https://api.moonshot.cn/v1'
  ).replace(/\/$/, '');
  const model = env.MOONSHOT_MODEL || 'moonshot-v1-8k';

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${String(key).trim()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.error?.message || data.message || `Moonshot HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text = data.choices?.[0]?.message?.content || '';
  return { text, provider: 'moonshot', model };
}

export function keysStatus(env) {
  const hasAnthropic = !!(env.ANTHROPIC_API_KEY && String(env.ANTHROPIC_API_KEY).trim());
  const hasMoonshot = !!(env.MOONSHOT_API_KEY && String(env.MOONSHOT_API_KEY).trim());
  return { anthropicConfigured: hasAnthropic, moonshotConfigured: hasMoonshot };
}

/**
 * Core routing — env may be process.env (Netlify) or Worker env bindings.
 */
export async function dispatchMission(env, body) {
  const modelChoice = body.modelChoice || 'auto';
  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  const system =
    typeof body.system === 'string'
      ? body.system
      : 'You are a helpful assistant for the YABBAI Solana project.';

  if (!prompt.trim()) {
    const err = new Error('Missing prompt');
    err.statusCode = 400;
    throw err;
  }

  const { anthropicConfigured: hasAnthropic, moonshotConfigured: hasMoonshot } =
    keysStatus(env);

  if (modelChoice === 'claude') {
    return await callAnthropic(env, { system, prompt });
  }

  if (modelChoice === 'kimi') {
    return await callMoonshot(env, { system, prompt });
  }

  if (hasAnthropic) {
    try {
      const out = await callAnthropic(env, { system, prompt });
      return { ...out, route: 'anthropic' };
    } catch (e) {
      if (hasMoonshot) {
        const out = await callMoonshot(env, { system, prompt });
        return {
          ...out,
          route: 'moonshot',
          fallbackNote: `Anthropic failed: ${e.message}`,
        };
      }
      throw e;
    }
  }

  if (hasMoonshot) {
    const out = await callMoonshot(env, { system, prompt });
    return { ...out, route: 'moonshot' };
  }

  const err = new Error(
    'No AI provider configured. Set ANTHROPIC_API_KEY and/or MOONSHOT_API_KEY on your API worker/host.'
  );
  err.statusCode = 503;
  throw err;
}

/** Netlify Functions adapter */
export async function handleNetlify(env, event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    const k = keysStatus(env);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ...k }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  try {
    const out = await dispatchMission(env, body);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(out),
    };
  } catch (err) {
    const code = err.statusCode || 502;
    return {
      statusCode: code >= 400 && code < 600 ? code : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'AI request failed' }),
    };
  }
}

/** Cloudflare Workers / Fetch adapter */
export async function handleFetch(env, request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const k = keysStatus(env);
    return new Response(JSON.stringify({ ok: true, ...k }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const out = await dispatchMission(env, body);
    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const code = err.statusCode || 502;
    const status = code >= 400 && code < 600 ? code : 502;
    return new Response(
      JSON.stringify({ error: err.message || 'AI request failed' }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
