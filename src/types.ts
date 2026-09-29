
export enum GenerationStep {
  IDLE = 'IDLE',
  CONFIGURING = 'CONFIGURING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type ImageQuantity = 1 | 3 | 10;
export type PresentationMode = 'model' | 'still' | 'kit';
export type WizardStep = 1 | 2 | 3;

export interface KitVariation {
  id: string;
  url: string | null;
  label: string;
}

export interface KitConfig {
  quantity: 2 | 3 | 4;
  variations: KitVariation[];
}

export interface FabricSpec {
  material: 'linen' | 'viscose' | 'cotton' | 'polyester' | 'denim' | 'knit';
  weight: 'light' | 'medium' | 'heavy';
  texture: 'smooth' | 'textured' | 'rustic';
  shine: 'matte' | 'soft_sheen';
  drape: 'fluid' | 'structured';
  wrinkleBehavior: 'wrinkles_easily' | 'medium' | 'low';
}

export interface GarmentSpec {
  category: 'shirt' | 'shorts' | 'set' | 'dress' | 'pants' | 'skirt';
  pattern: 'solid' | 'vertical_stripes' | 'printed';
  fit: 'loose' | 'regular' | 'slim';
  waistband: 'elastic' | 'fixed';
  hasDrawstring: boolean;
  hasButtons: boolean;
  hasPockets: boolean;
}

export interface ModelIdentity {
  ageRange: string;
  bodyType: 'slim' | 'athletic' | 'curvy_light' | 'mid_size_44';
  skinTone: 'light' | 'medium' | 'dark' | 'golden_tan' | 'deep_brown';
  hairColor: 'blonde' | 'brunette' | 'black' | 'red' | 'honey_blonde' | 'caramel' | 'illuminated_brunette';
  hairLength: 'short' | 'medium' | 'long' | 'bob_cut' | 'pixie';
  hairTexture: 'straight' | 'wavy' | 'curly' | 'coily';
  hairStyle: 'loose' | 'ponytail' | 'beach_waves' | 'messy_bun' | 'curtain_bangs';
  tattoo: boolean;
}

export interface StylingConfig {
  vibe: 'elegant' | 'casual' | 'resort_chic' | 'relaxed' | 'urban_clean';
  intensity: 'minimal' | 'balanced' | 'fashion';
  bag: 'none' | 'straw_bag' | 'neutral_tote' | 'mini_bag';
  sunglasses: 'none' | 'cat_eye' | 'rectangular' | 'aviator' | 'oversized' | 'wayfarer' | 'round';
  frameMaterial: 'none' | 'black_acetate' | 'gold_metal' | 'silver_metal' | 'transparent' | 'tortoise';
  eyewear: 'none' | 'optical_glasses';
  scarf: 'none' | 'modern_scarf';
  hat: 'none' | 'bucket_hat' | 'large_straw_hat' | 'panama_hat' | 'boater_hat' | 'visor_straw';
  earrings: 'none' | 'small_hoops' | 'studs';
  necklace: 'none' | 'delicate_necklace';
  footwear: 'sneakers' | 'flat_sandals' | 'block_heel' | 'mule' | 'heels' | 'none';
}

export interface EnvironmentConfig {
  category: string;
  sub_environment: string;
  editorial_treatment: string;
  label?: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  type: string;
  instruction: string;
  status: 'approved' | 'processing' | 'failed';
}

export interface ShotType {
  id: string;
  label: string;
  instruction: string;
  stillInstruction: string;
}

export const SHOT_TYPES: ShotType[] = [
  { 
    id: 'marketplace_cover', 
    label: '1. Capa Marketplace (Frente)', 
    instruction: 'MARKETPLACE HERO SHOT: Pure white or neutral light seamless studio background. Model standing straight facing the camera. Full garment clearly visible. Maximum commercial appeal. MARKETPLACE COMPLIANCE: NO sunglasses, NO hat, NO bag. Jewelry limited to minimalist neutral studs only. Clean, distraction-free product presentation.',
    stillInstruction: 'MARKETPLACE HERO SHOT: Pure white background. Full frontal view of the garment. Clear and commercial. NO accessories visible.'
  },
  { 
    id: 'back_view', 
    label: '2. Costas & Caimento', 
    instruction: 'BACK VIEW: Model turned away from the camera, looking over the shoulder. Clear view of the back of the garment, emphasizing fit and tailoring. HAIR CLEARANCE MANDATE: Model\'s hair must be styled in a high bun, sleek updo, or draped entirely over the front shoulder to ensure the entire back cut, closure, straps, and silhouette remain 100% visible and unoccluded.',
    stillInstruction: 'BACK VIEW: Presentation of the back of the garment. Clean background. Full back silhouette unobstructed.'
  },
  { 
    id: 'texture_macro', 
    label: '3. Detalhe & Textura (Macro)', 
    instruction: 'EXTREME MACRO CLOSE-UP OVERRIDE: Focus solely on garment texture, stitching, weave, and fabric physics. Tight framing from chest to hem or seam level. Face and feet intentionally cropped out. Hands resting naturally with clean, neutral manicure. SUPPRESS full-body and head-to-toe rules for this shot.',
    stillInstruction: 'MACRO DETAIL: Extreme close-up on fabric texture, weave structure, hardware, and stitching quality. Fill the frame with textile detail.'
  },
  { 
    id: 'lifestyle_context', 
    label: '4. Contexto / Lifestyle', 
    instruction: 'LIFESTYLE SHOT: Model wearing the garment in a real-world scenario (walking, sitting, outdoor). Demonstrating movement, comfort, and real-world drape.',
    stillInstruction: 'LIFESTYLE SHOT: Garment placed in a realistic environment with natural lighting and shadows.'
  },
  { 
    id: 'action_movement', 
    label: '5. Movimento & Conforto', 
    instruction: 'DYNAMIC MOVEMENT: Model walking elegantly towards the camera. Fabric flowing naturally to show elasticity, drape, and comfort.',
    stillInstruction: 'DYNAMIC DISPLAY: Garment arranged creatively to imply movement or lightweight feel.'
  },
  { 
    id: 'indoor_elegance', 
    label: '6. Elegância Indoor', 
    instruction: 'INDOOR EDITORIAL: Model in a sophisticated indoor setting (cafe, elegant room, studio with props). Highlighting the versatility of the garment.',
    stillInstruction: 'INDOOR STILL LIFE: Garment artistically placed in a high-end indoor setting.'
  },
  { 
    id: 'golden_hour_desire', 
    label: '7. Diferencial (Desejo)', 
    instruction: 'GOLDEN HOUR EDITORIAL: Aspirational shot during sunset lighting. Warm tones building emotional connection and desire for the brand. TRUE COLOR PRESERVATION: Warm sunset atmosphere must illuminate the scene without altering or shifting the authentic color and tint of the original garment fabric. The garment\'s true hue must remain identifiable.',
    stillInstruction: 'GOLDEN HOUR: Premium lighting, warm aspirational glow enhancing the garment. TRUE COLOR PRESERVATION: Garment color must remain accurate despite warm atmospheric lighting.'
  },
  { 
    id: 'versatile_accessory', 
    label: '8. Despojada & Acessórios', 
    instruction: 'RELAXED LIFESTYLE SHOT: Model in a relaxed, comfortable posture, utilizing a stylish accessory (like a bag, hat, or sunglasses) to show the garment\'s versatility. Confident but at ease.',
    stillInstruction: 'ACCESSORY FOCUS: Garment styled closely with a premium accessory highlighting versatility.'
  },
  { 
    id: 'street_style', 
    label: '9. Moda de Rua Ambientada', 
    instruction: 'STREET STYLE AMBIENTATED: Spontaneous, paparazzi-style shot in an urban setting that perfectly complements the outfit\'s aesthetic. Realistic lighting and shadows matching the environment.',
    stillInstruction: 'STREET CONTEXT: Edgy presentation, realistic urban lighting.'
  },
  { 
    id: 'seated_studio', 
    label: '10. Caimento Sentada (Studio)', 
    instruction: 'SEATED POSE STUDIO: Model elegantly seated on a stool or chair in a professional studio setting. Focus heavily on how the garment drapes and fits while in a seated posture.',
    stillInstruction: 'SEATED DRAPE: Garment arranged conceptually to simulate a seated drape.'
  }
];

export type { ImageOptimizationOptions, OptimizedImageResult } from './utils/imageOptimizer';

