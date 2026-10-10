import type { ImageProviderConfig } from '@/config/image-generation';
import { GenerationError } from '@/lib/generation';

interface OpenRouterImagePayload {
  data?: Array<{
    b64_json?: string;
    media_type?: string;
  }>;
  error?: {
    code?: string | number;
  };
  usage?: {
    cost?: number;
  };
}

export interface OpenRouterImageResult {
  dataUrl: string;
  mimeType: string;
  costUsd?: number;
}

export class OpenRouterImageApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string | number,
  ) {
    super(`OpenRouter image request failed with status ${status}`);
    this.name = 'OpenRouterImageApiError';
  }
}

function supportedMimeType(value: unknown): string | null {
  return value === 'image/jpeg' || value === 'image/webp' || value === 'image/png' ? value : null;
}

export async function generateOpenRouterImage(
  config: ImageProviderConfig,
  input: { prompt: string; references: string[]; userId: string },
): Promise<OpenRouterImageResult> {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/diaquinodev/estudio-fotos-marketplace',
      'X-Title': 'Estúdio de Fotos Marketplace',
    },
    body: JSON.stringify({
      model: config.model,
      prompt: input.prompt,
      input_references: input.references.map((url) => ({ type: 'image_url', image_url: { url } })),
      n: 1,
      aspect_ratio: config.aspectRatio,
      quality: config.quality,
      ...(config.outputCompression !== undefined ? { output_compression: config.outputCompression } : {}),
      background: config.background,
      user: input.userId,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  let payload: OpenRouterImagePayload = {};
  try {
    payload = (await response.json()) as OpenRouterImagePayload;
  } catch {
    if (response.ok) {
      throw new GenerationError(502, 'O provedor respondeu em um formato inválido. O crédito foi devolvido.');
    }
  }

  if (!response.ok) {
    throw new OpenRouterImageApiError(response.status, payload.error?.code);
  }

  const generated = payload.data?.[0];
  if (!generated?.b64_json) {
    throw new GenerationError(502, 'O modelo respondeu, mas não retornou uma imagem. O crédito foi devolvido.');
  }

  const mimeType = supportedMimeType(generated.media_type);
  if (!mimeType) {
    throw new GenerationError(502, 'O modelo retornou uma imagem sem formato identificável. O crédito foi devolvido.');
  }
  return {
    dataUrl: `data:${mimeType};base64,${generated.b64_json}`,
    mimeType,
    ...(typeof payload.usage?.cost === 'number' ? { costUsd: payload.usage.cost } : {}),
  };
}
