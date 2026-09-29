/** Corpo (parcial) das respostas de /api/generate. */
interface ServerResponse {
  url?: string;
  error?: string;
  message?: string;
  remainingCredits?: number;
  persisted?: boolean;
  mock?: boolean;
}

import { ImageGenerationStrategy, StrategyInfo, ImageGenerationParams, ImageEditParams } from './types';

export class GeminiStrategy implements ImageGenerationStrategy {
  readonly info: StrategyInfo = {
    id: 'gemini',
    name: 'Gemini 2.5 Flash (Backend API)',
    badge: 'GEMINI • SECURE API',
    description: 'Geração delegada para o servidor. Requer saldo (créditos) na conta.',
    isFree: false,
    requiresApiKey: false,
    speed: 'fast',
    quality: 'ultra',
  };

  isAvailable(): boolean { 
    return true; // Autenticação cuidada pelo servidor 
  }

  async generateImage(params: ImageGenerationParams, onProgress?: (s: string) => void): Promise<string> {
    onProgress?.('Enviando requisição segura para o servidor (Verificando Saldo)...');
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    let data: ServerResponse = {};
    try {
      data = (await response.json()) as ServerResponse;
    } catch {
      // Fallback para respostas que não sejam JSON
    }

    if (!response.ok) {
      if (data.error === 'INSUFFICIENT_CREDITS') {
        throw new Error('Você não tem saldo suficiente. Adquira mais créditos!');
      } else if (response.status === 401) {
        throw new Error('Sessão expirada ou não autenticada. Por favor, faça login novamente.');
      } else if (response.status === 404) {
        throw new Error('A rota de geração do servidor (/api/generate) não foi encontrada.');
      }
      throw new Error(data.error || `Erro ao processar imagem no servidor (${response.status}).`);
    }

    if (!data.url) {
      throw new Error('Resultado vazio recebido do servidor.');
    }

    onProgress?.(`Imagem recebida! Novo saldo: ${data.remainingCredits} créditos`);
    return data.url;
  }

  async editImage(params: ImageEditParams, onProgress?: (s: string) => void): Promise<string> {
    onProgress?.('Enviando edição para o servidor...');
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        mode: 'edit',
        base64TargetImage: params.base64TargetImage,
        editInstruction: params.editInstruction,
        additionalPrompt: params.additionalPrompt,
      }),
    });

    let data: ServerResponse = {};
    try {
      data = (await response.json()) as ServerResponse;
    } catch {
      // Fallback para respostas que não sejam JSON
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
      throw new Error(data.error || `Erro ao editar imagem no servidor (${response.status}).`);
    }

    if (!data.url) {
      throw new Error('Resultado vazio recebido do servidor.');
    }

    return data.url;
  }
}
