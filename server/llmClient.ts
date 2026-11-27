import type { AIProvider, AISettings } from './types.ts';

export const GAPGPT_DEFAULT_BASE_URL = 'https://api.gapgpt.app/v1';
export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * Normalizes an OpenAI-compatible base URL (including GapGPT domains).
 * - Uses provider-specific default if blank.
 * - Strips trailing slashes.
 * - Appends `/v1` when only a bare host (e.g. `https://api.gapgpt.app`) is entered.
 */
export function normalizeOpenAIBaseUrl(provider: AIProvider, rawUrl?: string): string {
  const fallback = provider === 'gapgpt' ? GAPGPT_DEFAULT_BASE_URL : OPENAI_DEFAULT_BASE_URL;
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return fallback;

  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname || parsed.pathname === '/') {
      return `${trimmed}/v1`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function resolveTranscriptionModel(settings: AISettings): string {
  const raw = (settings.transcriptionModel || '').trim();
  if (raw) return raw;
  return settings.provider === 'gapgpt' ? 'gapgpt/whisper-1' : 'whisper-1';
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Calls any OpenAI-compatible `/chat/completions` endpoint (GapGPT, OpenAI, AvalAI, OpenRouter).
 * Automatically falls back if a routed model (such as Claude via GapGPT) rejects `response_format: json_object`.
 */
export async function callOpenAICompatibleChat(
  settings: AISettings,
  params: {
    messages: ChatMessage[];
    temperature?: number;
    jsonMode?: boolean;
    maxTokens?: number;
  }
): Promise<string> {
  const baseUrl = normalizeOpenAIBaseUrl(settings.provider, settings.baseUrl);
  const model = (settings.llmModel || 'gpt-4o').trim();
  const endpoint = `${baseUrl}/chat/completions`;

  const makeRequest = async (useJsonFormat: boolean) => {
    const body: Record<string, unknown> = {
      model,
      temperature: params.temperature ?? 0.2,
      messages: params.messages,
    };
    if (useJsonFormat) {
      body.response_format = { type: 'json_object' };
    }
    if (params.maxTokens) {
      body.max_tokens = params.maxTokens;
    }

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  };

  let res = await makeRequest(Boolean(params.jsonMode));

  // Some non-OpenAI models routed through GapGPT (e.g. Claude / Gemini / DeepSeek)
  // reject `response_format: { type: 'json_object' }`. Retry cleanly without it.
  if (!res.ok && res.status === 400 && params.jsonMode) {
    const errBody = await res.text().catch(() => '');
    if (/response_format|json_object|unsupported/i.test(errBody)) {
      res = await makeRequest(false);
    } else {
      throw new Error(`API chat error (${res.status}): ${errBody.slice(0, 260)}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API chat error (${res.status}): ${errText.slice(0, 260)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content || '';
}

export interface AIConnectionTestResult {
  ok: boolean;
  provider: AIProvider;
  endpoint: string;
  models: string[];
  message: string;
}

/**
 * Tests connectivity and API key validity for GapGPT, OpenAI-compatible gateways, or Google Gemini.
 */
export async function testAIConnection(input: {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  geminiModel?: string;
  llmModel?: string;
}): Promise<AIConnectionTestResult> {
  const { provider, apiKey } = input;

  if (provider === 'demo') {
    return {
      ok: true,
      provider,
      endpoint: 'local',
      models: [],
      message: 'حالت استودیوی محلی فعال است و نیازی به اتصال اینترنتی ندارد.',
    };
  }

  if (!apiKey || !apiKey.trim()) {
    return {
      ok: false,
      provider,
      endpoint: '',
      models: [],
      message: 'لطفاً ابتدا کلید API خود را وارد کنید.',
    };
  }

  const providerLabel =
    provider === 'gapgpt' ? 'GapGPT' : provider === 'gemini' ? 'Google Gemini' : 'OpenAI-Compatible';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    if (provider === 'gemini') {
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
      const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey.trim())}`, {
        signal: controller.signal,
      });

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return {
          ok: false,
          provider,
          endpoint,
          models: [],
          message: 'کلید API گوگل جمنای نامعتبر است یا دسترسی لازم را ندارد.',
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          provider,
          endpoint,
          models: [],
          message: `خطا در پاسخ سرور Gemini (کد ${res.status}).`,
        };
      }

      const data = (await res.json()) as { models?: Array<{ name?: string }> };
      const models = (data.models || [])
        .map((m) => (m.name || '').replace(/^models\//, ''))
        .filter((name) => /gemini/i.test(name))
        .slice(0, 12);

      return {
        ok: true,
        provider,
        endpoint,
        models,
        message: `اتصال به Google Gemini با موفقیت برقرار شد${models.length ? ` (${models.length} مدل شناسایی شد)` : ''}.`,
      };
    }

    // GapGPT or OpenAI-compatible gateway
    const baseUrl = normalizeOpenAIBaseUrl(provider, input.baseUrl);
    const modelsUrl = `${baseUrl}/models`;

    const res = await fetch(modelsUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        provider,
        endpoint: baseUrl,
        models: [],
        message: `کلید API برای ${providerLabel} نامعتبر است یا اعتبار آن به پایان رسیده است (کد ${res.status}).`,
      };
    }

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        data?: Array<{ id?: string }>;
      };
      const allModels = (data.data || [])
        .map((m) => String(m.id || '').trim())
        .filter(Boolean);

      // Prioritize useful chat models for display
      const preferred = allModels.filter((id) =>
        /gpt-|claude|gemini|deepseek|o1|o3|o4|qwen|grok/i.test(id)
      );
      const models = (preferred.length > 0 ? preferred : allModels).slice(0, 16);

      return {
        ok: true,
        provider,
        endpoint: baseUrl,
        models,
        message: `اتصال به ${providerLabel} با موفقیت برقرار شد${allModels.length ? ` (${allModels.length} مدل در دسترس)` : ''}.`,
      };
    }

    // Fallback ping via tiny chat completion if gateway does not expose GET /models
    const pingRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: (input.llmModel || 'gpt-4o-mini').trim(),
        max_tokens: 4,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: controller.signal,
    });

    if (pingRes.ok) {
      return {
        ok: true,
        provider,
        endpoint: baseUrl,
        models: [],
        message: `اتصال به ${providerLabel} با مدل ${(input.llmModel || 'gpt-4o-mini').trim()} تایید شد.`,
      };
    }

    const errText = await pingRes.text().catch(() => '');
    return {
      ok: false,
      provider,
      endpoint: baseUrl,
      models: [],
      message: `سرور ${providerLabel} پاسخ خطا برگرداند (کد ${pingRes.status}): ${errText.slice(0, 140) || 'آدرس پایه یا مدل را بررسی کنید.'}`,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const isNetworkBlocked =
      /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|AbortError|aborted/i.test(rawMsg);
    return {
      ok: false,
      provider,
      endpoint: provider === 'gemini' ? 'generativelanguage.googleapis.com' : normalizeOpenAIBaseUrl(provider, input.baseUrl),
      models: [],
      message: isNetworkBlocked
        ? `سرور این محیط تست به اینترنت خارجی (${providerLabel}) دسترسی مستقیم ندارد. تنظیمات شما ذخیره می‌شود و روی سرور متصل به اینترنت بدون مشکل کار خواهد کرد.`
        : `خطا در ارتباط با ${providerLabel}: ${rawMsg.slice(0, 140)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
