import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCreditReservation } from '@/lib/credits';
import {
  GenerationError,
  classifyGeminiError,
  extractGeneratedImage,
  parseImageDataUrl,
} from '@/lib/generation';
import { buildGeminiSystemPrompt } from '@/services/promptBuilder';
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

const GEMINI_MODEL = 'gemini-2.5-flash-image';

export interface GenerateApiRequest {
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

type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

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

/** Repete a chamada em erros transitórios do Gemini (429/503), com backoff exponencial. */
async function executeWithRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 1200): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { status?: number } | null)?.status;
      const message = err instanceof Error ? err.message : String(err);
      const isTransient = status === 429 || status === 503 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED');
      if (!isTransient || attempt >= retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
}

function buildParts(body: GenerateApiRequest, promptText: string): ContentPart[] {
  const parts: ContentPart[] = [{ text: promptText }];

  for (const dataUrl of [body.base64Images.front, body.base64Images.back]) {
    const parsed = dataUrl ? parseImageDataUrl(dataUrl) : null;
    if (parsed) parts.push({ inlineData: parsed });
  }

  if (body.presentationMode === 'kit' && body.kitConfig?.variations) {
    for (const variation of body.kitConfig.variations.slice(0, body.kitConfig.quantity || 2)) {
      const parsed = variation.url ? parseImageDataUrl(variation.url) : null;
      if (parsed) parts.push({ inlineData: parsed });
    }
  }
  return parts;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação
    const serverSupabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão não autorizada ou expirada. Faça login novamente.' }, { status: 401 });
    }

    // 2. Validação do payload
    let body: GenerateApiRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

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

    // 3. Modo simulado (apenas desenvolvimento, flag explícita). Não debita créditos.
    if (isMockEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const placeholder = buildMockPlaceholder();
      return NextResponse.json({ success: true, mock: true, url: placeholder, imageUrl: placeholder });
    }

    // 4. Chave do Gemini (somente servidor)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta: GEMINI_API_KEY não definida.' }, { status: 500 });
    }

    const promptText = buildGeminiSystemPrompt({ ...body, base64Images: body.base64Images, quantity: body.quantity ?? 1 });
    const parts = buildParts(body, promptText);
    const ai = new GoogleGenAI({ apiKey });
    const admin = getSupabaseAdmin();

    // 5. Reserva atômica do crédito ANTES de gerar; estorno automático se a geração falhar.
    const result = await withCreditReservation(
      admin,
      user.id,
      async () => {
        let response;
        try {
          response = await executeWithRetry(() =>
            ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: { parts },
              config: { imageConfig: { aspectRatio: '1:1' } },
            }),
          );
        } catch (err) {
          throw classifyGeminiError(err);
        }

        const image = extractGeneratedImage(response);
        if (image.kind === 'blocked') {
          throw new GenerationError(422, 'A geração foi bloqueada pelas políticas de segurança da IA. Ajuste os detalhes da peça. O crédito foi devolvido.');
        }
        if (image.kind === 'empty') {
          throw new GenerationError(502, 'O modelo respondeu, mas não retornou uma imagem. O crédito foi devolvido.');
        }
        return image.dataUrl;
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

    return NextResponse.json({
      success: true,
      url: result.value,
      imageUrl: result.value,
      remainingCredits: result.remaining,
    });
  } catch (error: unknown) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Erro na rota /api/generate:', error instanceof Error ? error.message : 'erro desconhecido');
    return NextResponse.json({ error: 'Ocorreu um erro ao processar a imagem no servidor. Nenhum crédito foi descontado.' }, { status: 500 });
  }
}
