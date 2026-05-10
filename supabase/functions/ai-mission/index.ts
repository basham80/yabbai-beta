import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResp(status: number, obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAnthropic(key: string, model: string, system: string, prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const text = (data.content ?? [])
    .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text : ""))
    .join("");
  return { text, provider: "anthropic", model };
}

async function callNvidia(key: string, base: string, model: string, system: string, prompt: string) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.detail || `NVIDIA HTTP ${res.status}`);
  }
  return data.choices?.[0]?.message?.content ?? "";
}

async function callMoonshot(key: string, base: string, model: string, system: string, prompt: string) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Moonshot HTTP ${res.status}`);
  }
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method === "GET") {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
      const nvidiaKey = Deno.env.get("NVIDIA_API_KEY") ?? "";
      const moonshotKey = Deno.env.get("MOONSHOT_API_KEY") ?? "";
      return jsonResp(200, {
        ok: true,
        anthropicConfigured: !!anthropicKey.trim(),
        kimiNvidiaConfigured: !!nvidiaKey.trim(),
        moonshotConfigured: !!moonshotKey.trim(),
      });
    }

    if (req.method !== "POST") {
      return jsonResp(405, { error: "Method not allowed" });
    }

    let body: { prompt?: string; system?: string; modelChoice?: string; context?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResp(400, { error: "Invalid JSON body" });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return jsonResp(400, { error: "Missing prompt" });

    const system =
      typeof body.system === "string"
        ? body.system
        : "You are a helpful assistant for the YABBAI Solana ecosystem.";
    const modelChoice = body.modelChoice ?? "auto";

    const anthropicKey = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim();
    const anthropicModel = (Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5").trim();
    const nvidiaKey = (Deno.env.get("NVIDIA_API_KEY") ?? "").trim();
    const nvidiaBase = (Deno.env.get("NVIDIA_API_BASE") ?? "https://integrate.api.nvidia.com/v1").trim();
    const kimiModel = (Deno.env.get("NVIDIA_KIMI_MODEL") ?? "moonshotai/kimi-k2.6").trim();
    const deepseekModel = (Deno.env.get("NVIDIA_DEEPSEEK_MODEL") ?? "deepseek-ai/deepseek-v4-pro").trim();
    const moonshotKey = (Deno.env.get("MOONSHOT_API_KEY") ?? "").trim();
    const moonshotBase = (Deno.env.get("MOONSHOT_API_BASE") ?? "https://api.moonshot.cn/v1").trim();
    const moonshotModel = (Deno.env.get("MOONSHOT_MODEL") ?? "moonshot-v1-8k").trim();

    const hasAnthropic = !!anthropicKey;
    const hasNvidia = !!nvidiaKey;
    const hasMoonshot = !!moonshotKey;

    if (!hasAnthropic && !hasNvidia && !hasMoonshot) {
      return jsonResp(503, {
        error: "No AI provider configured. Set ANTHROPIC_API_KEY, NVIDIA_API_KEY, or MOONSHOT_API_KEY in Supabase secrets.",
      });
    }

    if (modelChoice === "claude" && hasAnthropic) {
      const out = await callAnthropic(anthropicKey, anthropicModel, system, prompt);
      return jsonResp(200, { ...out, route: "anthropic" });
    }

    if (modelChoice === "kimi" || modelChoice === "kimi-nvidia") {
      if (hasNvidia) {
        const text = await callNvidia(nvidiaKey, nvidiaBase, kimiModel, system, prompt);
        return jsonResp(200, { text, provider: "kimi-nvidia", model: kimiModel, route: "kimi-nvidia" });
      }
      if (hasMoonshot) {
        const text = await callMoonshot(moonshotKey, moonshotBase, moonshotModel, system, prompt);
        return jsonResp(200, { text, provider: "moonshot", model: moonshotModel, route: "moonshot" });
      }
    }

    if (modelChoice === "deepseek" || modelChoice === "deepseek-nvidia") {
      if (hasNvidia) {
        const text = await callNvidia(nvidiaKey, nvidiaBase, deepseekModel, system, prompt);
        return jsonResp(200, { text, provider: "deepseek-nvidia", model: deepseekModel, route: "deepseek-nvidia" });
      }
    }

    // Auto: Anthropic -> NVIDIA Kimi -> NVIDIA DeepSeek -> Moonshot
    if (hasAnthropic) {
      try {
        const out = await callAnthropic(anthropicKey, anthropicModel, system, prompt);
        return jsonResp(200, { ...out, route: "anthropic" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (hasNvidia) {
          try {
            const text = await callNvidia(nvidiaKey, nvidiaBase, kimiModel, system, prompt);
            return jsonResp(200, { text, provider: "kimi-nvidia", model: kimiModel, route: "kimi-nvidia", fallbackNote: `Anthropic failed: ${msg}` });
          } catch (e2) {
            const msg2 = e2 instanceof Error ? e2.message : String(e2);
            try {
              const text = await callNvidia(nvidiaKey, nvidiaBase, deepseekModel, system, prompt);
              return jsonResp(200, { text, provider: "deepseek-nvidia", model: deepseekModel, route: "deepseek-nvidia", fallbackNote: `Anthropic+Kimi failed: ${msg2}` });
            } catch (e3) {
              const msg3 = e3 instanceof Error ? e3.message : String(e3);
              if (hasMoonshot) {
                const text = await callMoonshot(moonshotKey, moonshotBase, moonshotModel, system, prompt);
                return jsonResp(200, { text, provider: "moonshot", model: moonshotModel, route: "moonshot", fallbackNote: `All NVIDIA failed: ${msg3}` });
              }
              throw e3;
            }
          }
        }
        if (hasMoonshot) {
          const text = await callMoonshot(moonshotKey, moonshotBase, moonshotModel, system, prompt);
          return jsonResp(200, { text, provider: "moonshot", model: moonshotModel, route: "moonshot", fallbackNote: `Anthropic failed: ${msg}` });
        }
        throw e;
      }
    }

    if (hasNvidia) {
      try {
        const text = await callNvidia(nvidiaKey, nvidiaBase, kimiModel, system, prompt);
        return jsonResp(200, { text, provider: "kimi-nvidia", model: kimiModel, route: "kimi-nvidia" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        try {
          const text = await callNvidia(nvidiaKey, nvidiaBase, deepseekModel, system, prompt);
          return jsonResp(200, { text, provider: "deepseek-nvidia", model: deepseekModel, route: "deepseek-nvidia", fallbackNote: `Kimi failed: ${msg}` });
        } catch (e2) {
          if (hasMoonshot) {
            const text = await callMoonshot(moonshotKey, moonshotBase, moonshotModel, system, prompt);
            return jsonResp(200, { text, provider: "moonshot", model: moonshotModel, route: "moonshot" });
          }
          throw e2;
        }
      }
    }

    if (hasMoonshot) {
      const text = await callMoonshot(moonshotKey, moonshotBase, moonshotModel, system, prompt);
      return jsonResp(200, { text, provider: "moonshot", model: moonshotModel, route: "moonshot" });
    }

    return jsonResp(503, { error: "No AI provider available" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResp(502, { error: msg || "AI request failed" });
  }
});
