import type { ImageGenerationParams } from '@/services/strategies/types';

/** Parâmetros padrão (peça, modelo e cenário) usados nos testes. */
export function makeParams(overrides: Partial<ImageGenerationParams> = {}): ImageGenerationParams {
  return {
    base64Images: { front: 'data:image/webp;base64,AAAA' },
    shotInstruction: 'BACK VIEW: exemplo de instrução de tomada.',
    modelId: {
      ageRange: '24',
      bodyType: 'athletic',
      skinTone: 'golden_tan',
      hairColor: 'brunette',
      hairLength: 'long',
      hairTexture: 'wavy',
      hairStyle: 'loose',
      tattoo: false,
    },
    env: {
      label: 'Estúdio Branco (Marketplace)',
      category: 'commercial_ecommerce',
      sub_environment: 'professional_neutral_studio',
      editorial_treatment: 'high_fidelity_commercial_softbox',
    },
    fabric: {
      material: 'linen',
      weight: 'medium',
      texture: 'textured',
      shine: 'matte',
      drape: 'structured',
      wrinkleBehavior: 'medium',
    },
    garment: {
      category: 'set',
      pattern: 'solid',
      fit: 'regular',
      waistband: 'fixed',
      hasDrawstring: false,
      hasButtons: true,
      hasPockets: false,
    },
    styling: {
      vibe: 'casual',
      intensity: 'balanced',
      bag: 'none',
      sunglasses: 'none',
      frameMaterial: 'none',
      eyewear: 'none',
      scarf: 'none',
      hat: 'none',
      earrings: 'none',
      necklace: 'none',
      footwear: 'sneakers',
    },
    quantity: 1,
    presentationMode: 'model',
    ...overrides,
  };
}
