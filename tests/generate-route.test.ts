import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeParams } from './fixtures';

const { rpc, openRouterFetch, upload, insertRow, authGetUser } = vi.hoisted(() => ({
  rpc: vi.fn(),
  openRouterFetch: vi.fn(),
  upload: vi.fn(),
  insertRow: vi.fn(),
  authGetUser: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: authGetUser },
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc,
    storage: { from: () => ({ upload, remove: vi.fn() }) },
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        insertRow(row);
        return { select: () => ({ single: async () => ({ data: { id: row.id }, error: null }) }) };
      },
    }),
  }),
}));

import { POST } from '@/app/api/generate/route';

const GENERATED_BASE64 = 'iVBORw0KGgo=';

function imageResponse(
  payload: Record<string, unknown> = {
    data: [{ b64_json: GENERATED_BASE64, media_type: 'image/png' }],
    usage: { cost: 0.17 },
  },
  status = 200,
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function lastOpenRouterRequest(): { url: string; init: RequestInit; body: Record<string, unknown> } {
  const [url, init] = openRouterFetch.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) as Record<string, unknown> };
}

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
  vi.unstubAllGlobals();
  vi.stubGlobal('fetch', openRouterFetch);
  vi.stubEnv('OPENROUTER_API_KEY', 'chave-de-teste');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-de-teste');
  authGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@exemplo.com.br' } }, error: null });
  mockRpc();
  openRouterFetch.mockImplementation(async () => imageResponse());
  upload.mockResolvedValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('POST /api/generate — reserva antes, estorno em falha', () => {
  it('exige sessão antes de reservar crédito ou chamar o provedor', async () => {
    authGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(calls('reserve_credit')).toHaveLength(0);
    expect(openRouterFetch).not.toHaveBeenCalled();
  });

  it('sucesso: reserva antes de gerar, confirma depois e devolve o saldo restante', async () => {
    const order: string[] = [];
    rpc.mockImplementation(async (fn: string) => {
      order.push(fn);
      if (fn === 'reserve_credit') return { data: [{ out_status: 'ok', out_reservation_id: 'res-1', out_remaining: 4 }], error: null };
      return { data: true, error: null };
    });
    openRouterFetch.mockImplementation(async () => {
      order.push('openrouter');
      return imageResponse();
    });

    const res = await POST(makeRequest());
    const body = await res.json();
    const request = lastOpenRouterRequest();

    expect(res.status).toBe(200);
    expect(body.url).toMatch(/^data:image\/png;base64,/);
    expect(body.remainingCredits).toBe(4);
    expect(body.provider).toBe('openrouter');
    expect(body.model).toBe('openai/gpt-image-2.5-sunburst');
    expect(body.costUsd).toBe(0.17);
    expect(request.url).toBe('https://openrouter.ai/api/v1/images');
    expect(request.body).toMatchObject({
      model: 'openai/gpt-image-2.5-sunburst',
      n: 1,
      aspect_ratio: '1:1',
      quality: 'max',
      background: 'opaque',
      user: 'user-1',
    });
    expect(request.body.input_references).toEqual([
      { type: 'image_url', image_url: { url: expect.stringMatching(/^data:image\/(png|jpeg|webp);base64,/) } },
    ]);
    expect(order).toEqual(['reserve_credit', 'openrouter', 'commit_reservation']);
  });

  it('permite configurar timeout, qualidade e compressão suportada no servidor', async () => {
    vi.stubEnv('OPENROUTER_REQUEST_TIMEOUT_MS', '45000');
    vi.stubEnv('OPENROUTER_IMAGE_QUALITY', 'medium');
    vi.stubEnv('OPENROUTER_OUTPUT_COMPRESSION', '70');
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

    const res = await POST(makeRequest());
    const body = await res.json();
    const reqBody = lastOpenRouterRequest().body;

    expect(res.status).toBe(200);
    expect(body.model).toBe('openai/gpt-image-2.5-sunburst');
    expect(reqBody.model).toBe('openai/gpt-image-2.5-sunburst');
    expect(reqBody.quality).toBe('medium');
    expect(reqBody.output_format).toBeUndefined();
    expect(reqBody.output_compression).toBe(70);
    expect(timeoutSpy).toHaveBeenCalledWith(45_000);
  });

  it('rejeita configuração ausente, modelo inválido, timeout ou qualidade inválida antes de reservar crédito', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    expect((await POST(makeRequest())).status).toBe(500);

    vi.stubEnv('OPENROUTER_API_KEY', 'chave-de-teste');
    vi.stubEnv('OPENROUTER_IMAGE_MODEL', 'modelo-sem-provedor');
    expect((await POST(makeRequest())).status).toBe(500);

    vi.stubEnv('OPENROUTER_IMAGE_MODEL', 'openai/gpt-image-2.5-sunburst');
    vi.stubEnv('OPENROUTER_REQUEST_TIMEOUT_MS', '9999');
    expect((await POST(makeRequest())).status).toBe(500);

    vi.stubEnv('OPENROUTER_REQUEST_TIMEOUT_MS', '180000');
    vi.stubEnv('OPENROUTER_IMAGE_QUALITY', 'ultra_super');
    expect((await POST(makeRequest())).status).toBe(500);

    vi.stubEnv('OPENROUTER_IMAGE_QUALITY', 'high');
    vi.stubEnv('OPENROUTER_IMAGE_MODEL', 'google/gemini-3-pro-image');
    expect((await POST(makeRequest())).status).toBe(500);

    vi.stubEnv('OPENROUTER_IMAGE_MODEL', 'openai/gpt-image-2.5-sunburst');
    vi.stubEnv('OPENROUTER_OUTPUT_COMPRESSION', '150');
    expect((await POST(makeRequest())).status).toBe(500);

    expect(calls('reserve_credit')).toHaveLength(0);
    expect(openRouterFetch).not.toHaveBeenCalled();
  });

  it('sucesso: persiste a imagem no Storage e registra em generations com telemetria', async () => {
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.persisted).toBe(true);
    expect(body.generationId).toEqual(expect.any(String));
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^user-1\/.+\.png$/), expect.any(Uint8Array), expect.objectContaining({ contentType: 'image/png' }));
    expect(insertRow).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      kind: 'generate',
      cost_usd: 0.17,
      provider: 'openrouter',
      model: 'openai/gpt-image-2.5-sunburst',
    }));
  });

  it('falha ao persistir não perde a imagem nem cobra de novo: entrega com persisted=false', async () => {
    upload.mockResolvedValue({ error: { message: 'bucket indisponível' } });
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.persisted).toBe(false);
    expect(body.url).toMatch(/^data:image\/png/);
    expect(calls('commit_reservation')).toHaveLength(1);
    expect(calls('refund_reservation')).toHaveLength(0);
  });

  it('erro 429 da OpenRouter: sem imagem substituta, com estorno e logs sanitizados', async () => {
    openRouterFetch.mockImplementation(async () => imageResponse({
      error: { code: 'rate_limit_exceeded', message: 'chave-de-teste iVBORw0KGgo' },
    }, 429));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.url).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('unsplash');
    expect(calls('refund_reservation')).toHaveLength(1);
    expect(calls('commit_reservation')).toHaveLength(0);
    expect(openRouterFetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('chave-de-teste');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('iVBORw0KGgo');
  });

  it('timeout da OpenRouter: responde 504 e estorna a reserva', async () => {
    openRouterFetch.mockRejectedValue(Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }));

    const res = await POST(makeRequest());

    expect(res.status).toBe(504);
    expect(calls('refund_reservation')).toHaveLength(1);
    expect(calls('commit_reservation')).toHaveLength(0);
    expect(lastOpenRouterRequest().init.signal).toEqual(expect.any(AbortSignal));
  });

  it('resposta sem imagem: 502 e estorno', async () => {
    openRouterFetch.mockImplementation(async () => imageResponse({ data: [] }));

    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
    expect(calls('refund_reservation')).toHaveLength(1);
    expect(calls('commit_reservation')).toHaveLength(0);
  });

  it('resposta sem MIME identificável: 502 e estorno', async () => {
    openRouterFetch.mockImplementation(async () => imageResponse({ data: [{ b64_json: GENERATED_BASE64 }] }));

    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
    expect(calls('refund_reservation')).toHaveLength(1);
  });

  it('saldo esgotado na OpenRouter (402): responde erro indisponível e estorna a reserva', async () => {
    openRouterFetch.mockImplementation(async () => imageResponse({ error: { code: 'insufficient_quota', message: 'Payment Required' } }, 402));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toContain('temporariamente indisponível');
    expect(calls('refund_reservation')).toHaveLength(1);
  });

  it('bloqueio de segurança: 422 e estorno', async () => {
    openRouterFetch.mockImplementation(async () => imageResponse({ error: { code: 'content_policy_violation' } }, 422));

    const res = await POST(makeRequest());

    expect(res.status).toBe(422);
    expect(calls('refund_reservation')).toHaveLength(1);
  });

  it('sem saldo: 403 INSUFFICIENT_CREDITS e o provedor nem é chamado', async () => {
    mockRpc({ out_status: 'insufficient', out_reservation_id: null, out_remaining: 0 });
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('INSUFFICIENT_CREDITS');
    expect(openRouterFetch).not.toHaveBeenCalled();
  });

  it('limite por minuto: 429 RATE_LIMITED e o provedor nem é chamado', async () => {
    mockRpc({ out_status: 'rate_limited', out_reservation_id: null, out_remaining: 3 });
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('RATE_LIMITED');
    expect(openRouterFetch).not.toHaveBeenCalled();
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
    const target = 'data:image/png;base64,iVBORw0KGgo=';
    const res = await POST(editRequest({ mode: 'edit', base64TargetImage: target, editInstruction: 'remover a bolsa' }));

    expect(res.status).toBe(200);
    const request = lastOpenRouterRequest().body;
    expect(request.prompt).toEqual(expect.stringContaining('REMOVER A BOLSA'));
    expect(request.input_references).toEqual([{ type: 'image_url', image_url: { url: target } }]);
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
  it('só funciona com a flag explícita, não chama a OpenRouter e nunca mexe em créditos', async () => {
    vi.stubEnv('MOCK_GENERATION', 'true');
    vi.stubEnv('NODE_ENV', 'development');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mock).toBe(true);
    expect(body.url).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(openRouterFetch).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('é ignorado em produção e segue para o provedor real', async () => {
    vi.stubEnv('MOCK_GENERATION', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    openRouterFetch.mockRejectedValue(new Error('fetch failed'));
    const res = await POST(makeRequest());

    expect(openRouterFetch).toHaveBeenCalled();
    expect(res.status).toBe(504);
    expect(calls('refund_reservation')).toHaveLength(1);
  });
});
