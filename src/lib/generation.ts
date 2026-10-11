import { SHOT_TYPES } from '@/types';

/** Limite de tamanho (em caracteres da Data URL) por imagem de entrada: ~10 MB de base64. */
export const MAX_IMAGE_DATA_URL_CHARS = 10_000_000;
export const MAX_GENERATION_REQUEST_BYTES = 32 * 1024 * 1024;
export const MAX_TOTAL_REFERENCE_DATA_URL_CHARS = 30_000_000;
export const MAX_REFERENCE_IMAGES = 6;
export const MAX_SHOT_INSTRUCTION_CHARS = 3_000;
export const MAX_ADDITIONAL_PROMPT_CHARS = 1_000;
export const MAX_FIDELITY_JSON_CHARS = 12_000;

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface ParsedDataUrl {
  mimeType: string;
  data: string;
}

/** Extrai mimeType e base64 de uma Data URL de imagem. Retorna null se inválida, de outro tipo ou grande demais. */
export function parseImageDataUrl(dataUrl: unknown): ParsedDataUrl | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) return null;
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !ALLOWED_MIME.has(match[1])) return null;
  return { mimeType: match[1], data: match[2] };
}

/** Erro de geração com status HTTP e mensagem seguros para o usuário. */
export class GenerationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export type ExtractedImage = { kind: 'image'; dataUrl: string; mimeType: string } | { kind: 'blocked' } | { kind: 'empty' };

interface ResponseLike {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  }>;
  text?: string;
}

/** Lê a imagem da resposta do Gemini (inlineData ou, como reserva, uma Data URL em texto). */
export function extractGeneratedImage(response: ResponseLike): ExtractedImage {
  const first = response.candidates?.[0];
  if (first?.finishReason === 'SAFETY') return { kind: 'blocked' };

  for (const part of first?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      return { kind: 'image', dataUrl: `data:${mimeType};base64,${part.inlineData.data}`, mimeType };
    }
  }

  const text = response.text?.trim();
  const parsed = text ? parseImageDataUrl(text) : null;
  if (text && parsed) return { kind: 'image', dataUrl: text, mimeType: parsed.mimeType };
  return { kind: 'empty' };
}

/** Converte falhas do provedor de imagem em status HTTP e mensagem segura (o crédito já é estornado). */
export function classifyImageProviderError(err: unknown): GenerationError {
  if (err instanceof GenerationError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const errorName = err instanceof Error ? err.name : '';
  const status = (err as { status?: number } | null)?.status;

  if (status === 402 || message.includes('402') || message.includes('Payment Required') || message.includes('insufficient_quota')) {
    return new GenerationError(503, 'O serviço de geração está temporariamente indisponível. Tente novamente mais tarde. O crédito foi devolvido.');
  }

  if (status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return new GenerationError(429, 'O serviço de IA está com alta demanda no momento. Aguarde alguns segundos e tente novamente. O crédito foi devolvido.');
  }
  if (status === 422 || message.includes('SAFETY') || message.includes('content_policy')) {
    return new GenerationError(422, 'Conteúdo bloqueado pelos filtros de segurança da IA. O crédito foi devolvido.');
  }
  if (errorName.includes('Timeout') || /ETIMEDOUT|timed out|timeout|fetch failed/i.test(message)) {
    return new GenerationError(504, 'Tempo limite esgotado ao contatar o serviço de IA. O crédito foi devolvido.');
  }
  return new GenerationError(500, 'Ocorreu um erro ao gerar a imagem no servidor. O crédito foi devolvido.');
}

/** Identifica o tipo de tomada (id de SHOT_TYPES) a partir da instrução enviada; 'custom' se não reconhecer. */
export function inferShotType(instruction: string | undefined): string {
  if (!instruction) return 'custom';
  const found = SHOT_TYPES.find((s) => s.instruction === instruction || s.stillInstruction === instruction);
  return found?.id ?? 'custom';
}

export function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}
