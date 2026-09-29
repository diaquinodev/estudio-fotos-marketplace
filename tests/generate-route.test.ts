import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeParams } from './fixtures';

// --- Mocks -----------------------------------------------------------------
const { rpc, generateContent } = vi.hoisted(() => ({ rpc: vi.fn(), generateContent: vi.fn() }));

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'a@exemplo.com.br' } }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { credits: 5 }, error: null }) }) }),
      upsert: () => ({ select: () => ({ maybeSingle: async () => ({ data: { credits: 5 }, error: null }) }) }),
    }),
    rpc,
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { credits: 5 }, error: null }) }) }),
    }),
  }),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { POST } from '@/app/api/generate/route';

function makeRequest() {
  return new NextRequest('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(makeParams()),
  });
}

const creditCalls = () => rpc.mock.calls.filter(([name]) => name === 'decrement_credit');

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('GEMINI_API_KEY', 'chave-de-teste');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
  rpc.mockResolvedValue({ data: 4, error: null });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/generate — falhas do Gemini não geram imagem falsa nem débito', () => {
  it('erro 429 do Gemini retorna erro claro, sem imagem substituta e sem debitar', async () => {
    generateContent.mockRejectedValue(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }));
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/alta demanda/i);
    expect(body.url).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('unsplash');
    expect(creditCalls()).toHaveLength(0);
  });

  it('resposta sem imagem retorna 502 e não debita', async () => {
    generateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'sem imagem' }] } }], text: 'sem imagem' });
    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
    expect(creditCalls()).toHaveLength(0);
  });

  it('bloqueio de segurança retorna 422 e não debita', async () => {
    generateContent.mockResolvedValue({ candidates: [{ finishReason: 'SAFETY' }] });
    const res = await POST(makeRequest());

    expect(res.status).toBe(422);
    expect(creditCalls()).toHaveLength(0);
  });
});

describe('POST /api/generate — modo simulado', () => {
  it('só funciona com a flag explícita, não chama o Gemini e nunca debita', async () => {
    vi.stubEnv('MOCK_GENERATION', 'true');
    vi.stubEnv('NODE_ENV', 'development');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mock).toBe(true);
    expect(body.url).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(generateContent).not.toHaveBeenCalled();
    expect(creditCalls()).toHaveLength(0);
  });

  it('é ignorado em produção (segue para o Gemini real)', async () => {
    vi.stubEnv('MOCK_GENERATION', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    generateContent.mockRejectedValue(new Error('fetch failed'));
    const res = await POST(makeRequest());

    expect(generateContent).toHaveBeenCalled();
    expect(res.status).toBe(504);
  });
});
