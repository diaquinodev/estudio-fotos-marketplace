import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeParams } from './fixtures';

// --- Mocks -----------------------------------------------------------------
const { rpc, generateContent } = vi.hoisted(() => ({ rpc: vi.fn(), generateContent: vi.fn() }));

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'a@exemplo.com.br' } }, error: null }) },
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc }),
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

const calls = (name: string) => rpc.mock.calls.filter(([fn]) => fn === name);

function mockRpc(reserve: { out_status: string; out_reservation_id: string | null; out_remaining: number } = {
  out_status: 'ok',
  out_reservation_id: 'res-1',
  out_remaining: 4,
}) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'reserve_credit') return { data: [reserve], error: null };
    if (fn === 'commit_reservation') return { data: true, error: null };
    if (fn === 'refund_reservation') return { data: 5, error: null };
    throw new Error(`rpc inesperada ${fn}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('GEMINI_API_KEY', 'chave-de-teste');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-de-teste');
  mockRpc();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const PNG = { inlineData: { data: 'iVBORw0KGgo=', mimeType: 'image/png' } };

describe('POST /api/generate — reserva antes, estorno em falha', () => {
  it('sucesso: reserva antes de gerar, confirma depois e devolve o saldo restante', async () => {
    const order: string[] = [];
    rpc.mockImplementation(async (fn: string) => {
      order.push(fn);
      if (fn === 'reserve_credit') return { data: [{ out_status: 'ok', out_reservation_id: 'res-1', out_remaining: 4 }], error: null };
      return { data: true, error: null };
    });
    generateContent.mockImplementation(async () => {
      order.push('gemini');
      return { candidates: [{ content: { parts: [PNG] } }] };
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toMatch(/^data:image\/png;base64,/);
    expect(body.remainingCredits).toBe(4);
    expect(order).toEqual(['reserve_credit', 'gemini', 'commit_reservation']);
  });

  it('erro 429 do Gemini: sem imagem substituta, com estorno', async () => {
    generateContent.mockRejectedValue(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }));
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.url).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('unsplash');
    expect(calls('refund_reservation')).toHaveLength(1);
    expect(calls('commit_reservation')).toHaveLength(0);
  });

  it('resposta sem imagem: 502 e estorno', async () => {
    generateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'sem imagem' }] } }], text: 'sem imagem' });
    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
    expect(calls('refund_reservation')).toHaveLength(1);
    expect(calls('commit_reservation')).toHaveLength(0);
  });

  it('bloqueio de segurança: 422 e estorno', async () => {
    generateContent.mockResolvedValue({ candidates: [{ finishReason: 'SAFETY' }] });
    const res = await POST(makeRequest());

    expect(res.status).toBe(422);
    expect(calls('refund_reservation')).toHaveLength(1);
  });

  it('sem saldo: 403 INSUFFICIENT_CREDITS e o Gemini nem é chamado', async () => {
    mockRpc({ out_status: 'insufficient', out_reservation_id: null, out_remaining: 0 });
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('INSUFFICIENT_CREDITS');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('limite por minuto: 429 RATE_LIMITED e o Gemini nem é chamado', async () => {
    mockRpc({ out_status: 'rate_limited', out_reservation_id: null, out_remaining: 3 });
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('RATE_LIMITED');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rejeita foto de referência que não seja uma imagem em Data URL', async () => {
    const req = new NextRequest('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeParams({ base64Images: { front: 'https://exemplo.com/foto.png' } })),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(calls('reserve_credit')).toHaveLength(0);
  });
});

describe('POST /api/generate — retoque', () => {
  const editRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('aceita mode=edit com a imagem alvo e a instrução, reserva e confirma o crédito', async () => {
    generateContent.mockResolvedValue({ candidates: [{ content: { parts: [PNG] } }] });
    const res = await POST(editRequest({ mode: 'edit', base64TargetImage: 'data:image/png;base64,iVBORw0KGgo=', editInstruction: 'remover a bolsa' }));

    expect(res.status).toBe(200);
    const sent = generateContent.mock.calls[0][0].contents.parts;
    expect(sent[0].text).toContain('REMOVER A BOLSA');
    expect(sent[1].inlineData.mimeType).toBe('image/png');
    expect(calls('commit_reservation')).toHaveLength(1);
  });

  it('rejeita retoque sem instrução ou com imagem inválida, sem reservar crédito', async () => {
    const semInstrucao = await POST(editRequest({ mode: 'edit', base64TargetImage: 'data:image/png;base64,iVBORw0KGgo=', editInstruction: '  ' }));
    const semImagem = await POST(editRequest({ mode: 'edit', base64TargetImage: 'nao-e-imagem', editInstruction: 'x' }));
    expect(semInstrucao.status).toBe(400);
    expect(semImagem.status).toBe(400);
    expect(calls('reserve_credit')).toHaveLength(0);
  });
});

describe('POST /api/generate — modo simulado', () => {
  it('só funciona com a flag explícita, não chama o Gemini e nunca mexe em créditos', async () => {
    vi.stubEnv('MOCK_GENERATION', 'true');
    vi.stubEnv('NODE_ENV', 'development');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mock).toBe(true);
    expect(body.url).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(generateContent).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('é ignorado em produção (segue para o Gemini real)', async () => {
    vi.stubEnv('MOCK_GENERATION', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    generateContent.mockRejectedValue(new Error('fetch failed'));
    const res = await POST(makeRequest());

    expect(generateContent).toHaveBeenCalled();
    expect(res.status).toBe(504);
    expect(calls('refund_reservation')).toHaveLength(1);
  });
});
