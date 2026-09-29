import { describe, expect, it } from 'vitest';
import { buildGeminiSystemPrompt } from './promptBuilder';
import { SHOT_TYPES } from '@/types';
import { makeParams } from '../../tests/fixtures';

const shot = (id: string) => SHOT_TYPES.find((s) => s.id === id)!;

describe('buildGeminiSystemPrompt', () => {
  it('trata as fotos de referência como fonte absoluta de fidelidade', () => {
    const prompt = buildGeminiSystemPrompt(makeParams());
    expect(prompt).toContain('PIXEL-PERFECT GARMENT FIDELITY');
    expect(prompt).toContain('fonte ABSOLUTA da verdade');
  });

  it('inclui a instrução da tomada em maiúsculas', () => {
    const prompt = buildGeminiSystemPrompt(makeParams({ shotInstruction: 'Modelo sentada no banco' }));
    expect(prompt).toContain('"MODELO SENTADA NO BANCO"');
  });

  it('aplica o bloqueio de conformidade de marketplace na capa', () => {
    const prompt = buildGeminiSystemPrompt(
      makeParams({
        shotInstruction: shot('marketplace_cover').instruction,
        styling: { ...makeParams().styling, sunglasses: 'aviator', hat: 'panama_hat' },
      }),
    );
    expect(prompt).toContain('MARKETPLACE COMPLIANCE LOCK');
    expect(prompt).toContain('ABSOLUTELY NO SUNGLASSES');
    expect(prompt).toContain('ABSOLUTELY NO HAT');
    // Na capa, os acessórios escolhidos pelo usuário são ignorados.
    expect(prompt).not.toContain('Wear aviator sunglasses');
    expect(prompt).not.toContain('Wear a panama_hat');
  });

  it('respeita os acessórios escolhidos em tomadas que não são capa', () => {
    const prompt = buildGeminiSystemPrompt(
      makeParams({
        shotInstruction: shot('lifestyle_context').instruction,
        styling: { ...makeParams().styling, sunglasses: 'aviator', frameMaterial: 'gold_metal', hat: 'panama_hat' },
      }),
    );
    expect(prompt).not.toContain('MARKETPLACE COMPLIANCE LOCK');
    expect(prompt).toContain('Wear aviator sunglasses with gold_metal frames.');
    expect(prompt).toContain('Wear a panama_hat.');
  });

  it('usa o enquadramento macro (sem corpo inteiro) na tomada de textura', () => {
    const prompt = buildGeminiSystemPrompt(makeParams({ shotInstruction: shot('texture_macro').instruction }));
    expect(prompt).toContain('MACRO OVERRIDE');
    expect(prompt).not.toContain('FULL BODY SHOT');
  });

  it('usa enquadramento de corpo inteiro nas demais tomadas', () => {
    const prompt = buildGeminiSystemPrompt(makeParams({ shotInstruction: shot('back_view').instruction }));
    expect(prompt).toContain('FULL BODY SHOT');
    expect(prompt).not.toContain('MACRO OVERRIDE');
  });

  it.each(['shorts', 'skirt', 'pants'] as const)('completa o look com parte de cima neutra para %s', (category) => {
    const prompt = buildGeminiSystemPrompt(
      makeParams({ garment: { ...makeParams().garment, category } }),
    );
    expect(prompt).toContain('BOTTOMS DETECTED');
    expect(prompt).toContain('COMPLEMENTARY TOP');
  });

  it('completa o look com parte de baixo neutra para camisa/blusa', () => {
    const prompt = buildGeminiSystemPrompt(
      makeParams({ garment: { ...makeParams().garment, category: 'shirt' } }),
    );
    expect(prompt).toContain('TOP DETECTED');
    expect(prompt).toContain('COMPLEMENTARY BOTTOMS');
  });

  it('não completa o look para conjuntos e vestidos', () => {
    for (const category of ['set', 'dress'] as const) {
      const prompt = buildGeminiSystemPrompt(makeParams({ garment: { ...makeParams().garment, category } }));
      expect(prompt).not.toContain('OUTFIT COMPLETION');
    }
  });

  it('ativa o modo unitário (um modelo) por padrão', () => {
    const prompt = buildGeminiSystemPrompt(makeParams());
    expect(prompt).toContain('UNITARY MODE - SINGLE MODEL');
  });

  it('descreve as cores de cada modelo no modo kit, respeitando a quantidade', () => {
    const prompt = buildGeminiSystemPrompt(
      makeParams({
        presentationMode: 'kit',
        kitConfig: {
          quantity: 2,
          variations: [
            { id: 'v1', url: null, label: 'Azul' },
            { id: 'v2', url: null, label: 'Verde' },
            { id: 'v3', url: null, label: 'Rosa' },
            { id: 'v4', url: null, label: 'Preto' },
          ],
        },
      }),
    );
    expect(prompt).toContain('KIT MODE - GROUP COMPOSITION (2 models)');
    expect(prompt).toContain('AZUL');
    expect(prompt).toContain('VERDE');
    expect(prompt).not.toContain('ROSA');
    expect(prompt).not.toContain('UNITARY MODE');
  });

  it('proíbe partes do corpo humano no modo manequim invisível', () => {
    const prompt = buildGeminiSystemPrompt(makeParams({ presentationMode: 'still' }));
    expect(prompt).toContain('Ghost Mannequin');
    expect(prompt).toContain('NO HUMAN BODY PARTS');
  });

  it('inclui o prompt adicional e o JSON de alta fidelidade quando informados', () => {
    const prompt = buildGeminiSystemPrompt(
      makeParams({ additionalPrompt: 'gola alta', highFidelityJson: '{"bolsos":"funcionais"}' }),
    );
    expect(prompt).toContain('"GOLA ALTA"');
    expect(prompt).toContain('{"bolsos":"funcionais"}');
  });

  it('omite os blocos opcionais quando não informados', () => {
    const prompt = buildGeminiSystemPrompt(makeParams());
    expect(prompt).not.toContain('USER REINFORCEMENT');
    expect(prompt).not.toContain('HIGH FIDELITY REINFORCEMENT');
  });

  it('adiciona o escopo específico para biotipos plus size', () => {
    const plus = buildGeminiSystemPrompt(
      makeParams({ modelId: { ...makeParams().modelId, bodyType: 'mid_size_44' } }),
    );
    const slim = buildGeminiSystemPrompt(
      makeParams({ modelId: { ...makeParams().modelId, bodyType: 'slim' } }),
    );
    expect(plus).toContain('PLUS SIZE SPECIFIC SCOPE');
    expect(slim).not.toContain('PLUS SIZE SPECIFIC SCOPE');
  });

  it('no modo de edição gera o prompt de retoque com protocolo de congelamento', () => {
    const prompt = buildGeminiSystemPrompt(makeParams({ shotInstruction: 'remover a bolsa' }), true);
    expect(prompt).toContain('HIGH-PRECISION IMAGE EDITING');
    expect(prompt).toContain('FREEZE PROTOCOL');
    expect(prompt).toContain('"REMOVER A BOLSA"');
    expect(prompt).not.toContain('STRICT PROFESSIONAL FASHION GUIDELINES');
  });
});

describe('SHOT_TYPES', () => {
  it('tem ids únicos e instruções para modelo e manequim', () => {
    const ids = SHOT_TYPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SHOT_TYPES) {
      expect(s.instruction.length).toBeGreaterThan(10);
      expect(s.stillInstruction.length).toBeGreaterThan(10);
    }
  });
});
