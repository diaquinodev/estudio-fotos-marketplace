export const DEFAULT_OPENROUTER_IMAGE_MODEL = 'openai/gpt-image-2.5-sunburst';
export const DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS = 180_000;

const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}\/[a-z0-9][a-z0-9._-]{2,120}$/i;
const MIN_REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_TIMEOUT_MS = 300_000;

export type ImageQuality = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export const DEFAULT_OPENROUTER_IMAGE_QUALITY: ImageQuality = 'max';

const MODEL_CAPABILITIES = {
  'openai/gpt-image-2.5-sunburst': {
    qualities: new Set<ImageQuality>(['auto', 'low', 'medium', 'high', 'xhigh', 'max']),
    supportsOutputCompression: true,
  },
} as const;

export interface ImageProviderConfig {
  provider: 'openrouter';
  model: string;
  apiKey: string;
  endpoint: 'https://openrouter.ai/api/v1/images';
  aspectRatio: '1:1';
  background: 'opaque';
  quality: ImageQuality;
  outputCompression?: number;
  timeoutMs: number;
}

export interface ProviderGenerationResult {
  provider: ImageProviderConfig['provider'];
  model: string;
}

export interface ProviderFailure extends ProviderGenerationResult {
  errorName: string;
  code?: string | number;
  status?: number;
}

export class ImageProviderConfigError extends Error {
  constructor(
    public readonly code:
      | 'MISSING_API_KEY'
      | 'INVALID_MODEL'
      | 'INVALID_TIMEOUT'
      | 'INVALID_QUALITY'
      | 'INVALID_COMPRESSION',
    message: string,
  ) {
    super(message);
    this.name = 'ImageProviderConfigError';
  }
}

export function getImageProviderConfig(env: NodeJS.ProcessEnv = process.env): ImageProviderConfig {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new ImageProviderConfigError(
      'MISSING_API_KEY',
      'Configuração do servidor incompleta: OPENROUTER_API_KEY não definida.',
    );
  }

  const model = env.OPENROUTER_IMAGE_MODEL?.trim() || DEFAULT_OPENROUTER_IMAGE_MODEL;
  if (!MODEL_NAME_PATTERN.test(model) || !(model in MODEL_CAPABILITIES)) {
    throw new ImageProviderConfigError(
      'INVALID_MODEL',
      'Configuração do servidor incompleta: OPENROUTER_IMAGE_MODEL não possui capacidades cadastradas.',
    );
  }
  const capabilities = MODEL_CAPABILITIES[model as keyof typeof MODEL_CAPABILITIES];

  const rawTimeout = env.OPENROUTER_REQUEST_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_REQUEST_TIMEOUT_MS || timeoutMs > MAX_REQUEST_TIMEOUT_MS) {
    throw new ImageProviderConfigError(
      'INVALID_TIMEOUT',
      'Configuração do servidor incompleta: OPENROUTER_REQUEST_TIMEOUT_MS deve estar entre 10000 e 300000.',
    );
  }

  const rawQuality = env.OPENROUTER_IMAGE_QUALITY?.trim();
  let quality: ImageQuality = DEFAULT_OPENROUTER_IMAGE_QUALITY;
  if (rawQuality) {
    if (!capabilities.qualities.has(rawQuality as ImageQuality)) {
      throw new ImageProviderConfigError(
        'INVALID_QUALITY',
        'Configuração do servidor incompleta: OPENROUTER_IMAGE_QUALITY não é suportada pelo modelo selecionado.',
      );
    }
    quality = rawQuality as ImageQuality;
  }

  const rawCompression = env.OPENROUTER_OUTPUT_COMPRESSION?.trim();
  let outputCompression: number | undefined;
  if (rawCompression) {
    const parsed = Number(rawCompression);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
      throw new ImageProviderConfigError(
        'INVALID_COMPRESSION',
        'Configuração do servidor incompleta: OPENROUTER_OUTPUT_COMPRESSION deve ser um inteiro entre 0 e 100.',
      );
    }
    outputCompression = parsed;
  }

  if (outputCompression !== undefined && !capabilities.supportsOutputCompression) {
    throw new ImageProviderConfigError(
      'INVALID_COMPRESSION',
      'Configuração do servidor incompleta: OPENROUTER_OUTPUT_COMPRESSION não é suportada pelo modelo selecionado.',
    );
  }

  return {
    provider: 'openrouter',
    model,
    apiKey,
    endpoint: 'https://openrouter.ai/api/v1/images',
    aspectRatio: '1:1',
    background: 'opaque',
    quality,
    outputCompression,
    timeoutMs,
  };
}

export function describeProviderFailure(error: unknown, config: ImageProviderConfig): ProviderFailure {
  const details = error as { code?: unknown; status?: unknown } | null;
  const code = details?.code;
  const status = details?.status;
  return {
    provider: config.provider,
    model: config.model,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    ...(typeof status === 'number' ? { status } : {}),
  };
}
