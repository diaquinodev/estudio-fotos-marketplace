import { describe, expect, it, vi } from 'vitest';
import { persistGeneration, type StorageClient } from './persistence';
import { SHOT_TYPES } from '@/types';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function fakeClient(opts: { uploadError?: string; insertError?: string } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: opts.uploadError ? { message: opts.uploadError } : null });
  const remove = vi.fn().mockResolvedValue({});
  const insert = vi.fn((row: Record<string, unknown>) => ({
    select: () => ({
      single: async () => (opts.insertError ? { data: null, error: { message: opts.insertError } } : { data: { id: row.id as string }, error: null }),
    }),
  }));
  const client: StorageClient = {
    storage: { from: () => ({ upload, remove }) },
    from: () => ({ insert }),
  };
  return { client, upload, remove, insert };
}

describe('persistGeneration', () => {
  it('grava o arquivo em <user>/<id>.png e registra a linha em generations', async () => {
    const { client, upload, insert } = fakeClient();
    const shot = SHOT_TYPES.find((s) => s.id === 'back_view')!;
    const r = await persistGeneration(client, { userId: 'u1', dataUrl: PNG, kind: 'generate', instruction: shot.instruction }, () => 'gen-1');

    expect(r).toEqual({ ok: true, generationId: 'gen-1', storagePath: 'u1/gen-1.png' });
    expect(upload).toHaveBeenCalledWith('u1/gen-1.png', expect.any(Uint8Array), { contentType: 'image/png', upsert: false });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'gen-1', user_id: 'u1', kind: 'generate', shot_type: 'back_view', storage_path: 'u1/gen-1.png', mime_type: 'image/png' }),
    );
  });

  it('registra retoques como kind=edit', async () => {
    const { client, insert } = fakeClient();
    await persistGeneration(client, { userId: 'u1', dataUrl: PNG, kind: 'edit', instruction: 'remover a bolsa' }, () => 'e1');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'edit', shot_type: 'edit', prompt: 'remover a bolsa' }));
  });

  it('rejeita Data URL inválida sem tocar no Storage', async () => {
    const { client, upload } = fakeClient();
    const r = await persistGeneration(client, { userId: 'u1', dataUrl: 'https://x/y.png', kind: 'generate' });
    expect(r.ok).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it('falha no upload não cria registro', async () => {
    const { client, insert } = fakeClient({ uploadError: 'sem espaço' });
    const r = await persistGeneration(client, { userId: 'u1', dataUrl: PNG, kind: 'generate' });
    expect(r).toEqual({ ok: false, error: 'Upload falhou: sem espaço' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('grava dados opcionais de telemetria (cost_usd, provider, model)', async () => {
    const { client, insert } = fakeClient();
    await persistGeneration(
      client,
      {
        userId: 'u1',
        dataUrl: PNG,
        kind: 'generate',
        costUsd: 0.05,
        provider: 'openrouter',
        model: 'openai/gpt-image-2.5-sunburst',
      },
      () => 'g3',
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cost_usd: 0.05,
        provider: 'openrouter',
        model: 'openai/gpt-image-2.5-sunburst',
      }),
    );
  });

  it('falha no INSERT com telemetria remove o arquivo sem ocultar o erro', async () => {
    const { client, insert, remove } = fakeClient({ insertError: 'column "cost_usd" does not exist' });
    const r = await persistGeneration(client, { userId: 'u1', dataUrl: PNG, kind: 'generate', costUsd: 0.05 }, () => 'g4');

    expect(r.ok).toBe(false);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(['u1/g4.png']);
  });
});
