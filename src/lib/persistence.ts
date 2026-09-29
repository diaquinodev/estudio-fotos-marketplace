import { extensionForMime, inferShotType, parseImageDataUrl } from '@/lib/generation';

export const GENERATIONS_BUCKET = 'generations';

/** Subconjunto do cliente Supabase usado aqui (facilita testar com um fake). */
export interface StorageClient {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        options: { contentType: string; upsert: boolean },
      ): PromiseLike<{ error: { message: string } | null }>;
      remove(paths: string[]): PromiseLike<unknown>;
    };
  };
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
}

export interface PersistInput {
  userId: string;
  dataUrl: string;
  kind: 'generate' | 'edit';
  instruction?: string;
  prompt?: string;
}

export type PersistResult = { ok: true; generationId: string; storagePath: string } | { ok: false; error: string };

/**
 * Grava a imagem no bucket privado (pasta = id do usuário) e registra a linha em `generations`.
 * Se o INSERT falhar, remove o arquivo para não deixar órfãos. Nunca lança: devolve { ok:false }.
 */
export async function persistGeneration(client: StorageClient, input: PersistInput, newId: () => string = () => crypto.randomUUID()): Promise<PersistResult> {
  const parsed = parseImageDataUrl(input.dataUrl);
  if (!parsed) return { ok: false, error: 'Data URL da imagem inválida.' };

  const id = newId();
  const path = `${input.userId}/${id}.${extensionForMime(parsed.mimeType)}`;
  const bytes = Uint8Array.from(Buffer.from(parsed.data, 'base64'));

  try {
    const bucket = client.storage.from(GENERATIONS_BUCKET);
    const { error: uploadError } = await bucket.upload(path, bytes, { contentType: parsed.mimeType, upsert: false });
    if (uploadError) return { ok: false, error: `Upload falhou: ${uploadError.message}` };

    const { data, error: insertError } = await client
      .from('generations')
      .insert({
        id,
        user_id: input.userId,
        kind: input.kind,
        shot_type: input.kind === 'generate' ? inferShotType(input.instruction) : 'edit',
        prompt: input.prompt ?? input.instruction ?? null,
        storage_path: path,
        mime_type: parsed.mimeType,
      })
      .select('id')
      .single();

    if (insertError || !data) {
      await bucket.remove([path]);
      return { ok: false, error: `Registro falhou: ${insertError?.message ?? 'sem retorno'}` };
    }
    return { ok: true, generationId: data.id, storagePath: path };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'erro desconhecido' };
  }
}
