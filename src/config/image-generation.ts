export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 120_000;

const MODEL_NAME_PATTERN = /^gemini-[a-z0-9][a-z0-9._-]{2,120}$/i;
const MIN_REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_TIMEOUT_MS = 300_000;

export interface ImageProviderConfig {
  provider: 'gemini';
  model: string;
  apiKey: string;
  aspectRatio: '1:1';
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
    public readonly code: 'MISSING_API_KEY' | 'INVALID_MODEL' | 'INVALID_TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'ImageProviderConfigError';
  }
}

export function getImageProviderConfig(env: NodeJS.ProcessEnv = process.env): ImageProviderConfig {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ImageProviderConfigError(
      'MISSING_API_KEY',
      'Configuração do servidor incompleta: GEMINI_API_KEY não definida.',
    );
  }

  const model = env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  if (!MODEL_NAME_PATTERN.test(model)) {
    throw new ImageProviderConfigError(
      'INVALID_MODEL',
      'Configuração do servidor incompleta: GEMINI_IMAGE_MODEL inválido.',
    );
  }

  const rawTimeout = env.GEMINI_REQUEST_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_REQUEST_TIMEOUT_MS || timeoutMs > MAX_REQUEST_TIMEOUT_MS) {
    throw new ImageProviderConfigError(
      'INVALID_TIMEOUT',
      'Configuração do servidor incompleta: GEMINI_REQUEST_TIMEOUT_MS deve estar entre 10000 e 300000.',
    );
  }

  return { provider: 'gemini', model, apiKey, aspectRatio: '1:1', timeoutMs };
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
