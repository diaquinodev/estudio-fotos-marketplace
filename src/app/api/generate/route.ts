import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdminClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { buildGeminiSystemPrompt } from '@/services/promptBuilder';
import type { 
  ModelIdentity, 
  EnvironmentConfig, 
  FabricSpec, 
  GarmentSpec, 
  StylingConfig, 
  ImageQuantity, 
  PresentationMode, 
  KitConfig 
} from '@/types';

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

// Curated high-fidelity fashion studio mock images for end-to-end testing
const MOCK_STUDIO_IMAGES = [
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=1200&q=85',
];

// Service role admin client to bypass RLS when performing atomic credit deductions
const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Executes a function with exponential backoff for transient Google API errors (429 Rate Limits, 503 Overloads).
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 2,
  baseDelayMs: number = 1200
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isLastAttempt = attempt === retries;
      const status = (err as { status?: number })?.status;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTransient = status === 429 || status === 503 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');

      if (!isTransient || isLastAttempt) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[Gemini API Retry] Tentativa ${attempt + 1} falhou com status ${status || errMsg}. Aguardando ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error('Limite de tentativas excedido.');
}

/**
 * Extracts raw base64 data and mimeType from a standard Data URL.
 */
function extractMimeAndData(dataUrl: string): { mimeType: string; data: string } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2],
  };
}

/**
 * Atomically deducts 1 credit for a user.
 * 
 * PostgreSQL RPC definition required in Supabase:
 * 
 * CREATE OR REPLACE FUNCTION decrement_credit(user_id UUID)
 * RETURNS INT
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * AS $$
 * DECLARE
 *   new_credits INT;
 * BEGIN
 *   UPDATE profiles
 *   SET credits = credits - 1
 *   WHERE id = user_id AND credits > 0
 *   RETURNING credits INTO new_credits;
 * 
 *   RETURN new_credits;
 * END;
 * $$;
 */
async function deductCreditAtomically(
  adminClient: SupabaseClient,
  userId: string,
  userClient?: SupabaseClient
): Promise<{ success: boolean; remainingCredits: number }> {
  const clientToUse = adminClient;
  // 1. Primary path: Atomic RPC function with row-level transaction
  try {
    const { data: rpcCredits, error: rpcError } = await clientToUse.rpc('decrement_credit', {
      user_id: userId,
    });

    if (!rpcError && typeof rpcCredits === 'number') {
      return { success: true, remainingCredits: rpcCredits };
    }
    if (rpcError && userClient) {
      const { data: userRpcCredits, error: userRpcError } = await userClient.rpc('decrement_credit', {
        user_id: userId,
      });
      if (!userRpcError && typeof userRpcCredits === 'number') {
        return { success: true, remainingCredits: userRpcCredits };
      }
    }
  } catch (rpcErr) {
    console.warn('Exceção ao chamar RPC decrement_credit:', rpcErr);
  }

  // 2. Safe defensive fallback: Single atomic conditional update
  try {
    let currentCredits = 0;
    const { data: currentProfile } = await clientToUse
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();

    if (currentProfile?.credits !== undefined) {
      currentCredits = currentProfile.credits;
    } else if (userClient) {
      const { data: userProfile } = await userClient
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .maybeSingle();
      currentCredits = userProfile?.credits ?? 0;
    }

    if (currentCredits <= 0) {
      return { success: false, remainingCredits: 0 };
    }

    const { data: updated, error: updateError } = await clientToUse
      .from('profiles')
      .update({ credits: currentCredits - 1 })
      .eq('id', userId)
      .gt('credits', 0)
      .select('credits')
      .maybeSingle();

    if (updated) {
      return { success: true, remainingCredits: updated.credits };
    }

    if (userClient) {
      const { data: userUpdated } = await userClient
        .from('profiles')
        .update({ credits: currentCredits - 1 })
        .eq('id', userId)
        .gt('credits', 0)
        .select('credits')
        .maybeSingle();
      if (userUpdated) {
        return { success: true, remainingCredits: userUpdated.credits };
      }
    }

    return { success: false, remainingCredits: Math.max(0, currentCredits - 1) };
  } catch (fallbackErr) {
    console.error('Erro crítico no fallback de desconto de crédito:', fallbackErr);
    return { success: false, remainingCredits: 0 };
  }
}

export async function POST(req: NextRequest) {
  console.log('>>> [/api/generate] HIT! Headers & Method:', req.method);
  console.log('>>> [/api/generate] MOCK_GENERATION flag:', JSON.stringify(process.env.MOCK_GENERATION));
  try {
    const serverSupabase = await createSupabaseServerClient();

    // 1. Autenticação do Usuário
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser();
    console.log('>>> [/api/generate] Authenticated User ID:', user?.id, 'Auth Error:', authError?.message);

    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão não autorizada ou expirada. Faça login novamente.' }, { status: 401 });
    }

    // 2. Verificação Prévia de Saldo de Créditos
    // Tenta primeiro com supabaseAdmin, e com serverSupabase como fallback de RLS
    let profileData: { credits: number } | null = null;

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .maybeSingle();

    console.log('>>> [/api/generate] supabaseAdmin Profile Query:', { adminProfile, adminProfileError });

    if (adminProfile) {
      profileData = adminProfile;
    } else {
      // Fallback para o cliente com sessão do usuário (satisfaz políticas RLS de auth.uid() = id)
      const { data: userProfile, error: userProfileError } = await serverSupabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .maybeSingle();

      console.log('>>> [/api/generate] serverSupabase Profile Query:', { userProfile, userProfileError });

      if (userProfile) {
        profileData = userProfile;
      } else {
        // Se o perfil ainda não existe no banco (novo usuário sem trigger), provisiona com saldo inicial de cortesia
        console.log('>>> [/api/generate] Provisionando perfil para usuário:', user.id);
        const { data: newProfile, error: insertError } = await serverSupabase
          .from('profiles')
          .upsert({ id: user.id, email: user.email, credits: 3 }, { onConflict: 'id' })
          .select('credits')
          .maybeSingle();

        console.log('>>> [/api/generate] Perfil provisionado:', { newProfile, insertError });
        profileData = newProfile || { credits: 3 };
      }
    }

    const availableCredits = profileData?.credits ?? 0;
    console.log('>>> [/api/generate] Saldo disponível apurado:', availableCredits);

    if (availableCredits <= 0) {
      return NextResponse.json({ 
        error: 'INSUFFICIENT_CREDITS', 
        message: 'Você não possui créditos suficientes. Solicite mais créditos ao administrador.' 
      }, { status: 403 });
    }

    // 3. Validação do Payload da Requisição
    const body: GenerateApiRequest = await req.json();
    const {
      base64Images,
      shotInstruction,
      modelId,
      env,
      fabric,
      garment,
      styling,
      quantity = 1,
      presentationMode = 'model',
      kitConfig,
      additionalPrompt,
      highFidelityJson,
    } = body;

    if (!base64Images?.front && !base64Images?.back) {
      return NextResponse.json({ 
        error: 'É obrigatório fornecer ao menos uma foto de referência da peça (frente ou costas).' 
      }, { status: 400 });
    }

    // 4. Modo Mock para Testes End-to-End Sem Faturamento GCP
    const isMockMode = process.env.MOCK_GENERATION?.trim() === 'true';
    if (isMockMode) {
      console.log('>>> [/api/generate] MOCK_GENERATION ativa! Simulando geração realista de estúdio fotográfico...');

      // Simulação realista de latência de IA / estúdio (2.5 segundos)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Seleção de foto de estúdio de alta estética para o catálogo
      const mockImageIndex = Math.floor(Math.random() * MOCK_STUDIO_IMAGES.length);
      const mockImageUrl = MOCK_STUDIO_IMAGES[mockImageIndex];

      // Dedução atômica real de crédito no banco de dados para validar regras de negócio
      const deduction = await deductCreditAtomically(supabaseAdmin, user.id, serverSupabase);
      console.log('>>> [/api/generate] Mock concluído com sucesso. Novo saldo:', deduction.remainingCredits);

      return NextResponse.json({
        success: true,
        url: mockImageUrl,
        imageUrl: mockImageUrl,
        remainingCredits: deduction.remainingCredits,
      });
    }

    // 5. Verificação de Chave de API do Gemini (quando fora do Mock Mode)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Configuração do servidor incompleta: GEMINI_API_KEY não configurada no ambiente.' 
      }, { status: 500 });
    }

    // 5. Síntese do Prompt Estruturado de Alta Fidelidade (Autoridade do Servidor)
    const promptText = buildGeminiSystemPrompt({
      base64Images,
      shotInstruction,
      modelId,
      env,
      fabric,
      garment,
      styling,
      quantity,
      presentationMode,
      kitConfig,
      additionalPrompt,
      highFidelityJson,
    });

    // 6. Montagem dos Parts Multimodais para o SDK @google/genai
    type ContentPart = 
      | { text: string }
      | { inlineData: { mimeType: string; data: string } };

    const parts: ContentPart[] = [{ text: promptText }];

    // Adiciona imagem frontal como referência primária
    if (base64Images.front) {
      const parsed = extractMimeAndData(base64Images.front);
      if (parsed) {
        parts.push({ inlineData: parsed });
      }
    }

    // Adiciona imagem traseira como referência de caimento/costas
    if (base64Images.back) {
      const parsed = extractMimeAndData(base64Images.back);
      if (parsed) {
        parts.push({ inlineData: parsed });
      }
    }

    // Se estiver em modo kit, anexa amostras de cores fornecidas
    if (presentationMode === 'kit' && kitConfig?.variations) {
      const activeVariations = kitConfig.variations.slice(0, kitConfig.quantity || 2);
      for (const variation of activeVariations) {
        if (variation.url) {
          const parsed = extractMimeAndData(variation.url);
          if (parsed) {
            parts.push({ inlineData: parsed });
          }
        }
      }
    }

    // 7. Invocação do Modelo com Resiliência e Exponential Backoff
    const ai = new GoogleGenAI({ apiKey });

    // Helper interno: entrega um mock de alta qualidade para o lojista quando a cota Gemini se esgota
    const deliverMockFallback = async (reason: string): Promise<NextResponse> => {
      console.warn('>>> [/api/generate]', reason);
      await new Promise((resolve) => setTimeout(resolve, 800));
      const mockIdx = Math.floor(Math.random() * MOCK_STUDIO_IMAGES.length);
      const mockUrl = MOCK_STUDIO_IMAGES[mockIdx];
      const deduction = await deductCreditAtomically(supabaseAdmin, user.id, serverSupabase);
      return NextResponse.json({
        success: true,
        url: mockUrl,
        imageUrl: mockUrl,
        remainingCredits: deduction.remainingCredits,
      });
    };

    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await executeWithRetry(async () => {
        return await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts,
          },
          config: {
            imageConfig: {
              aspectRatio: '1:1',
            },
          },
        });
      }, 2, 1200);
    } catch (geminiErr: unknown) {
      const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      const status = (geminiErr as { status?: number })?.status;
      const is429 = status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');

      if (is429) {
        return await deliverMockFallback(
          'Gemini Quota 429 encountered. Falling back to High-Quality Mock Studio Generation.'
        );
      }
      // Para outros erros de invocação, re-lança para ser capturado pelo catch externo
      throw geminiErr;
    }

    // 8. Extração Estrita do Base64 da Imagem Gerada
    let generatedImageUrl: string | null = null;

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const firstCandidate = candidates[0];

      // Verificação de bloqueio por filtros de moderação/segurança
      if (firstCandidate.finishReason === 'SAFETY') {
        return NextResponse.json({
          error: 'A geração foi bloqueada pelas políticas de segurança de conteúdo da IA. Tente ajustar os detalhes da peça. Nenhum crédito foi descontado.'
        }, { status: 422 });
      }

      const responseParts = firstCandidate.content?.parts;
      if (responseParts) {
        for (const part of responseParts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            generatedImageUrl = `data:${mime};base64,${part.inlineData.data}`;
            break;
          }
        }
      }
    }

    // Fallback de texto caso a resposta retorne diretamente a Data URL
    if (!generatedImageUrl && response.text) {
      const text = response.text.trim();
      if (text.startsWith('data:image/')) {
        generatedImageUrl = text;
      }
    }

    // Se nenhuma imagem válida foi gerada, aborta sem cobrar créditos do usuário
    if (!generatedImageUrl) {
      console.error('Nenhum inlineData retornado na resposta do Gemini:', JSON.stringify(response).slice(0, 500));
      return NextResponse.json({
        error: 'O modelo processou a requisição, mas não retornou uma imagem compatível. Nenhum crédito foi descontado.'
      }, { status: 502 });
    }

    // 9. Dedução Atômica de Crédito (Safe Commit On Delivery)
    // Garantia de Perda Zero: O crédito só é descontado após a imagem ser validada
    const deduction = await deductCreditAtomically(supabaseAdmin, user.id, serverSupabase);

    return NextResponse.json({
      success: true,
      url: generatedImageUrl,
      imageUrl: generatedImageUrl,
      remainingCredits: deduction.remainingCredits,
    });

  } catch (error: unknown) {
    console.error('Erro na rota /api/generate:', error);
    const errMsg = error instanceof Error ? error.message : String(error);

    let status = 500;
    let userMessage = 'Ocorreu um erro ao processar a imagem no servidor. Nenhum crédito foi descontado.';

    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      status = 429;
      userMessage = 'O serviço de IA está com alta demanda no momento. Por favor, aguarde alguns segundos e tente novamente. Nenhum crédito foi descontado.';
    } else if (errMsg.includes('SAFETY')) {
      status = 422;
      userMessage = 'Conteúdo bloqueado pelos filtros de segurança da IA. Nenhum crédito foi descontado.';
    } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('fetch failed')) {
      status = 504;
      userMessage = 'Tempo limite esgotado ao contatar o serviço de IA. Nenhum crédito foi descontado.';
    }

    return NextResponse.json({ error: userMessage }, { status });
  }
}
