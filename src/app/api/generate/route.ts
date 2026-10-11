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
    let raw: GenerateApiRequest | EditApiRequest;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

    let promptText: string;
    let referenceImages: string[];
    let kind: 'generate' | 'edit' = 'generate';
    let instruction: string | undefined;

    if (raw.mode === 'edit') {
      const target = parseImageDataUrl(raw.base64TargetImage);
      if (!target) {
        return NextResponse.json({ error: 'Imagem para retoque inválida (use JPG, PNG ou WebP de até ~10 MB).' }, { status: 400 });
      }
      const editInstruction = typeof raw.editInstruction === 'string' ? raw.editInstruction.trim() : '';
      if (!editInstruction || editInstruction.length > 1000) {
        return NextResponse.json({ error: 'Informe a instrução de retoque (até 1000 caracteres).' }, { status: 400 });
      }
      kind = 'edit';
      instruction = editInstruction;
      promptText = buildEditPrompt(editInstruction, raw.additionalPrompt);
      referenceImages = [raw.base64TargetImage];
    } else {
      const body = raw as GenerateApiRequest;
      const front = body.base64Images?.front;
      const back = body.base64Images?.back;
      if (!front && !back) {
        return NextResponse.json(
          { error: 'É obrigatório fornecer ao menos uma foto de referência da peça (frente ou costas).' },
          { status: 400 },
        );
      }
      if ((front && !parseImageDataUrl(front)) || (back && !parseImageDataUrl(back))) {
        return NextResponse.json({ error: 'Foto de referência inválida (use JPG, PNG ou WebP de até ~10 MB).' }, { status: 400 });
      }
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
            userId: user.id,
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
