import { NextRequest, NextResponse } from 'next/server';
import {
  describeProviderFailure,
  getImageProviderConfig,
  ImageProviderConfigError,
  type ProviderGenerationResult,
} from '@/config/image-generation';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCreditReservation } from '@/lib/credits';
import { persistGeneration } from '@/lib/persistence';
import {
  GenerationError,
  classifyImageProviderError,
  MAX_ADDITIONAL_PROMPT_CHARS,
  MAX_FIDELITY_JSON_CHARS,
  MAX_GENERATION_REQUEST_BYTES,
  MAX_REFERENCE_IMAGES,
  MAX_SHOT_INSTRUCTION_CHARS,
  MAX_TOTAL_REFERENCE_DATA_URL_CHARS,
  parseImageDataUrl,
} from '@/lib/generation';
import { generateOpenRouterImage } from '@/lib/openrouter-image';
import { buildEditPrompt, buildGeminiSystemPrompt } from '@/services/promptBuilder';
import type {
  ModelIdentity,
  EnvironmentConfig,
  FabricSpec,
  GarmentSpec,
  StylingConfig,
  ImageQuantity,
  PresentationMode,
  KitConfig,
} from '@/types';

/** Retoque de uma imagem já gerada (o cliente envia mode: 'edit'). */
export interface EditApiRequest {
  mode: 'edit';
  base64TargetImage: string;
  editInstruction: string;
  additionalPrompt?: string;
}

export interface GenerateApiRequest {
  mode?: 'generate';
  base64Images: {
    front?: string;
    back?: string;
  };
  shotInstruction: string;
  modelId: ModelIdentity;
  env: EnvironmentConfig;
  fabric: FabricSpec;
  garment: GarmentSpec;
  styling: StylingConfig;
  quantity?: ImageQuantity;
  presentationMode?: PresentationMode;
  kitConfig?: KitConfig;
  additionalPrompt?: string;
  highFidelityJson?: string;
}

/**
 * Modo simulado, SOMENTE para desenvolvimento local: exige MOCK_GENERATION=true e NODE_ENV diferente de
 * "production". Nunca debita créditos e devolve um placeholder gerado localmente (sem imagens externas).
 */
function isMockEnabled(): boolean {
  return process.env.MOCK_GENERATION?.trim() === 'true' && process.env.NODE_ENV !== 'production';
}

function buildMockPlaceholder(): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">' +
    '<rect width="1200" height="1200" fill="#e2e8f0"/>' +
    '<text x="600" y="590" font-family="sans-serif" font-size="44" text-anchor="middle" fill="#334155">IMAGEM SIMULADA</text>' +
    '<text x="600" y="650" font-family="sans-serif" font-size="30" text-anchor="middle" fill="#64748b">MOCK_GENERATION (somente desenvolvimento)</text>' +
    '</svg>';
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function buildReferenceImages(body: GenerateApiRequest): string[] {
  const references = [body.base64Images.front, body.base64Images.back].filter(
    (dataUrl): dataUrl is string => Boolean(dataUrl && parseImageDataUrl(dataUrl)),
  );

  if (body.presentationMode === 'kit' && body.kitConfig?.variations) {
    for (const variation of body.kitConfig.variations.slice(0, body.kitConfig.quantity || 2)) {
      if (variation.url && parseImageDataUrl(variation.url)) references.push(variation.url);
    }
  }
  return references;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateOptionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    return `${label} inválido (máximo de ${maxLength} caracteres).`;
  }
  return null;
}

function collectReferenceImages(body: Record<string, unknown>): string[] {
  const base64Images = isRecord(body.base64Images) ? body.base64Images : {};
  const references = [base64Images.front, base64Images.back].filter(
    (value): value is string => typeof value === 'string',
  );
  const kitConfig = isRecord(body.kitConfig) ? body.kitConfig : null;
  const variations = Array.isArray(kitConfig?.variations) ? kitConfig.variations : [];
  for (const variation of variations) {
    if (isRecord(variation) && typeof variation.url === 'string') references.push(variation.url);
  }
  return references;
}

function validateGeneratePayload(body: Record<string, unknown>): string | null {
  if (body.mode !== undefined && body.mode !== 'generate') return 'Modo de geração inválido.';
  if (!isRecord(body.base64Images)) return 'Informe as imagens de referência da peça.';
  const base64Images = body.base64Images;
  if (['front', 'back'].some((field) => {
    const value = base64Images[field];
    return value !== undefined && value !== null && typeof value !== 'string';
  })) {
    return 'Foto de referência inválida.';
  }
  if (typeof base64Images.front !== 'string' && typeof base64Images.back !== 'string') {
    return 'É obrigatório fornecer ao menos uma foto de referência da peça (frente ou costas).';
  }

  const references = collectReferenceImages(body);
  if (references.length > MAX_REFERENCE_IMAGES) {
    return `A geração aceita no máximo ${MAX_REFERENCE_IMAGES} imagens de referência.`;
  }
  if (references.some((reference) => !parseImageDataUrl(reference))) {
    return 'Foto de referência inválida (use JPG, PNG ou WebP de até ~10 MB).';
  }
  if (references.reduce((total, reference) => total + reference.length, 0) > MAX_TOTAL_REFERENCE_DATA_URL_CHARS) {
    return 'O conjunto de imagens de referência é grande demais. Reduza ou otimize as fotos.';
  }

  if (typeof body.shotInstruction !== 'string' || !body.shotInstruction.trim() || body.shotInstruction.length > MAX_SHOT_INSTRUCTION_CHARS) {
    return `A instrução da tomada é obrigatória e deve ter até ${MAX_SHOT_INSTRUCTION_CHARS} caracteres.`;
  }
  for (const [field, label] of [
    ['modelId', 'modelo'],
    ['env', 'ambiente'],
    ['fabric', 'tecido'],
    ['garment', 'peça'],
    ['styling', 'styling'],
  ] as const) {
    if (!isRecord(body[field])) return `Configuração de ${label} inválida.`;
  }

  if (body.quantity !== undefined && ![1, 3, 10].includes(body.quantity as number)) {
    return 'Quantidade de imagens inválida.';
  }
  if (body.presentationMode !== undefined && !['model', 'still', 'kit'].includes(body.presentationMode as string)) {
    return 'Modo de apresentação inválido.';
  }

  const optionalTextErrors = [
    validateOptionalText(body.additionalPrompt, 'Prompt adicional', MAX_ADDITIONAL_PROMPT_CHARS),
    validateOptionalText(body.highFidelityJson, 'JSON de alta fidelidade', MAX_FIDELITY_JSON_CHARS),
  ];
  const textError = optionalTextErrors.find(Boolean);
  if (textError) return textError;

  if (body.kitConfig !== undefined) {
    if (!isRecord(body.kitConfig) || ![2, 3, 4].includes(body.kitConfig.quantity as number)) {
      return 'Configuração do kit inválida.';
    }
    if (!Array.isArray(body.kitConfig.variations) || body.kitConfig.variations.length > 4) {
      return 'O kit deve possuir entre 1 e 4 variações.';
    }
    for (const variation of body.kitConfig.variations) {
      if (!isRecord(variation) || typeof variation.id !== 'string' || typeof variation.label !== 'string' || variation.label.length > 100) {
        return 'Variação de kit inválida.';
      }
      if (variation.url !== null && variation.url !== undefined && (typeof variation.url !== 'string' || !parseImageDataUrl(variation.url))) {
        return 'Imagem de variação do kit inválida.';
      }
    }
  }
  return null;
}

function validateEditPayload(body: Record<string, unknown>): string | null {
  if (!parseImageDataUrl(body.base64TargetImage)) {
    return 'Imagem para retoque inválida (use JPG, PNG ou WebP de até ~10 MB).';
  }
  if (typeof body.editInstruction !== 'string' || !body.editInstruction.trim() || body.editInstruction.length > MAX_ADDITIONAL_PROMPT_CHARS) {
    return `Informe a instrução de retoque (até ${MAX_ADDITIONAL_PROMPT_CHARS} caracteres).`;
  }
  return validateOptionalText(body.additionalPrompt, 'Prompt adicional', MAX_ADDITIONAL_PROMPT_CHARS);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação (em desenvolvimento ou modo simulado, aceita usuário de teste local)
    let user: { id: string; email?: string } | null = null;
    try {
      const serverSupabase = await createSupabaseServerClient();
      const {
        data: { user: authUser },
        error: authError,
      } = await serverSupabase.auth.getUser();
      if (!authError && authUser) {
        user = authUser;
      }
    } catch {
      // Ignora erro de Supabase em ambiente local/sem sessão
    }

    // 2. Validação do payload
    const contentLength = req.headers.get('content-length');
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_GENERATION_REQUEST_BYTES)) {
      return NextResponse.json({ error: 'Requisição grande demais.' }, { status: 413 });
    }

    let raw: GenerateApiRequest | EditApiRequest;
    try {
      const requestText = await req.text();
      if (new TextEncoder().encode(requestText).byteLength > MAX_GENERATION_REQUEST_BYTES) {
        return NextResponse.json({ error: 'Requisição grande demais.' }, { status: 413 });
      }
      const parsed: unknown = JSON.parse(requestText);
      if (!isRecord(parsed)) return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
      raw = parsed as unknown as GenerateApiRequest | EditApiRequest;
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

    let promptText: string;
    let referenceImages: string[];
    let kind: 'generate' | 'edit' = 'generate';
    let instruction: string | undefined;

    if (raw.mode === 'edit') {
      const validationError = validateEditPayload(raw as unknown as Record<string, unknown>);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
      const editInstruction = raw.editInstruction.trim();
      kind = 'edit';
      instruction = editInstruction;
      promptText = buildEditPrompt(editInstruction, raw.additionalPrompt);
      referenceImages = [raw.base64TargetImage];
    } else {
      const body = raw as GenerateApiRequest;
      const validationError = validateGeneratePayload(body as unknown as Record<string, unknown>);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
      instruction = body.shotInstruction;
      promptText = buildGeminiSystemPrompt({ ...body, quantity: body.quantity ?? 1 });
      referenceImages = buildReferenceImages(body);
    }

    // 3. Modo simulado (apenas desenvolvimento, flag explícita). Não debita créditos.
    if (isMockEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const placeholder = buildMockPlaceholder();
      return NextResponse.json({ success: true, mock: true, url: placeholder, imageUrl: placeholder });
    }

    if (!user) {
      return NextResponse.json({ error: 'Sessão não autorizada ou expirada. Faça login novamente.' }, { status: 401 });
    }

    // 4. Configuração da OpenRouter (somente servidor)
    let providerConfig;
    try {
      providerConfig = getImageProviderConfig();
    } catch (error) {
      if (error instanceof ImageProviderConfigError) {
        console.error('Configuração inválida do provedor de imagem:', { provider: 'openrouter', code: error.code });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      throw error;
    }

    const providerResult: ProviderGenerationResult = {
      provider: providerConfig.provider,
      model: providerConfig.model,
    };
    const admin = getSupabaseAdmin();

    // 5. Reserva atômica do crédito ANTES de gerar; estorno automático se a geração falhar.
    const result = await withCreditReservation(
      admin,
      user.id,
      async () => {
        let image;
        try {
          image = await generateOpenRouterImage(providerConfig, {
            prompt: promptText,
            references: referenceImages,
          });
        } catch (err) {
          console.error('Falha no provedor de imagem:', describeProviderFailure(err, providerConfig));
          throw classifyImageProviderError(err);
        }

        // Persiste no Storage + tabela generations. Se falhar, a imagem ainda é entregue (o crédito foi
        // consumido por uma geração válida) e o cliente é avisado com persisted:false.
        const saved = await persistGeneration(admin, {
          userId: user.id,
          dataUrl: image.dataUrl,
          kind,
          instruction,
          costUsd: image.costUsd,
          provider: providerResult.provider,
          model: providerResult.model,
        });
        if (!saved.ok) console.error('Falha ao persistir a imagem gerada:', saved.error);
        return { dataUrl: image.dataUrl, generationId: saved.ok ? saved.generationId : null, costUsd: image.costUsd };
      },
      { onRefundError: (err) => console.error('Falha ao liquidar reserva de crédito:', err instanceof Error ? err.message : err) },
    );

    if (!result.ok) {
      if (result.reason === 'rate_limited') {
        return NextResponse.json(
          { error: 'RATE_LIMITED', message: 'Muitas gerações em pouco tempo. Aguarde um minuto e tente novamente.' },
          { status: 429 },
        );
      }
      if (result.reason === 'no_profile') {
        return NextResponse.json({ error: 'Perfil não encontrado. Peça a um administrador para liberar o seu acesso.' }, { status: 403 });
      }
      return NextResponse.json(
        { error: 'INSUFFICIENT_CREDITS', message: 'Sua cota de créditos acabou. Solicite mais créditos ao administrador.' },
        { status: 403 },
      );
    }

    console.info('Geração de imagem concluída:', {
      provider: providerResult.provider,
      model: providerResult.model,
      persisted: result.value.generationId !== null,
      costUsd: result.value.costUsd,
    });

    return NextResponse.json({
      success: true,
      url: result.value.dataUrl,
      imageUrl: result.value.dataUrl,
      generationId: result.value.generationId,
      persisted: result.value.generationId !== null,
      remainingCredits: result.remaining,
      provider: providerResult.provider,
      model: providerResult.model,
      costUsd: result.value.costUsd,
    });
  } catch (error: unknown) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Erro na rota /api/generate:', error instanceof Error ? error.message : 'erro desconhecido');
    return NextResponse.json({ error: 'Ocorreu um erro ao processar a imagem no servidor. Nenhum crédito foi descontado.' }, { status: 500 });
  }
}
