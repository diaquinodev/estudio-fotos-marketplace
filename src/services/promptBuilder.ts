import { ImageGenerationParams, ImageEditParams } from './strategies/types';

// Map Portuguese / internal enum values to descriptive English terms for Diffusion/FLUX models
const BODY_TYPE_MAP: Record<string, string> = {
  athletic: 'toned athletic build, natural proportional curves',
  slim: 'slender petite model build, elegant proportions',
  curvy_light: 'curvy silhouette with graceful feminine proportions',
  mid_size_44: 'confident Brazilian mid-size model, size 44, realistic elegant curves',
};

const SKIN_TONE_MAP: Record<string, string> = {
  golden_tan: 'glowing warm golden tanned skin, Brazilian sun-kissed complexion',
  light: 'fair porcelain skin with natural radiant glow',
  medium: 'smooth warm olive tan complexion',
  dark: 'rich glowing dark skin with natural highlights',
  deep_brown: 'luminous deep ebony brown skin with radiant highlights',
};

const HAIR_COLOR_MAP: Record<string, string> = {
  illuminated_brunette: 'rich chocolate brown hair with subtle honey balayage highlights',
  caramel: 'warm caramel highlighted brunette hair',
  honey_blonde: 'warm golden honey blonde hair with soft dimension',
  brunette: 'natural glossy dark brown hair',
  black: 'sleek lustrous jet black hair',
  blonde: 'radiant light blonde hair',
  red: 'vibrant natural auburn copper hair',
};

const HAIR_STYLE_MAP: Record<string, string> = {
  beach_waves: 'effortless textured beach waves with natural movement',
  loose: 'sleek smooth open hair falling naturally over shoulders',
  curtain_bangs: 'stylish layers with soft face-framing curtain bangs',
  ponytail: 'chic high ponytail with sleek finish',
  messy_bun: 'modern relaxed effortless updo bun',
};

const HAIR_TEXTURE_MAP: Record<string, string> = {
  straight: 'silky straight hair texture',
  wavy: 'naturally voluminous wavy hair',
  curly: 'defined bouncy curls with natural volume',
  coily: 'beautiful defined coily afro-textured hair',
};

const FABRIC_MAP: Record<string, string> = {
  linen: 'premium woven natural linen fabric with visible refined organic texture and slight artisanal weave',
  viscose: 'soft fluid viscose rayon fabric with elegant flowing drape',
  cotton: 'high-grade breathable crisp structured cotton weave',
  polyester: 'smooth tailored poly-blend fabric with clean drape',
  denim: 'authentic structured denim with subtle twill texture',
  knit: 'fine-gauge soft luxury knitted fabric with delicate texture',
};

const GARMENT_MAP: Record<string, string> = {
  set: 'two-piece matching coordinated fashion outfit (matching top and bottom set)',
  shirt: 'tailored fashion button-down shirt / blouse',
  shorts: 'tailored stylish high-waisted shorts with refined cut',
  dress: 'designer fashion dress with flattering silhouette and movement',
  pants: 'high-fashion tailored trousers with elegant silhouette',
  skirt: 'flattering feminine fashion skirt with graceful drape',
};

const HAT_MAP: Record<string, string> = {
  none: '',
  bucket_hat: 'wearing a modern trendy designer bucket hat',
  large_straw_hat: 'wearing a glamorous oversized wide-brim resort straw sun hat',
  panama_hat: 'wearing a classic elegant Panama fedora hat',
  boater_hat: 'wearing a stylish vintage boater straw hat with ribbon',
  visor_straw: 'wearing a chic braided straw visor',
};

const SUNGLASSES_MAP: Record<string, string> = {
  none: '',
  cat_eye: 'wearing trendy chic cat-eye designer sunglasses',
  rectangular: 'wearing sleek slim rectangular modern sunglasses',
  aviator: 'wearing classic luxury aviator sunglasses with tinted lenses',
  oversized: 'wearing bold oversized celebrity luxury sunglasses',
  wayfarer: 'wearing iconic timeless wayfarer style sunglasses',
  round: 'wearing retro aesthetic round sunglasses',
};

const FOOTWEAR_MAP: Record<string, string> = {
  sneakers: 'clean minimalist designer white sneakers',
  flat_sandals: 'elegant leather resort slide flat sandals',
  heels: 'sleek minimalist stiletto high heels',
  block_heel: 'chic mid block-heel open toe sandals',
  mule: 'contemporary pointed-toe leather mules',
  none: 'barefoot on warm floor',
};

/**
 * Builds a descriptive English prompt optimized for Flux/SDXL Diffusion models
 */
export const buildDiffusionPrompt = (params: ImageGenerationParams): string => {
  const {
    modelId,
    env,
    fabric,
    garment,
    styling,
    shotInstruction,
    presentationMode = 'model',
    kitConfig,
    additionalPrompt,
    highFidelityJson,
  } = params;

  // 1. Ghost Mannequin / Still Mode
  if (presentationMode === 'still') {
    return [
      `Professional 3D ghost mannequin commercial fashion product photography.`,
      `Product: ${GARMENT_MAP[garment.category] || garment.category}, crafted from ${FABRIC_MAP[fabric.material] || fabric.material}, with ${fabric.texture} surface finish.`,
      `Details: ${garment.pattern} pattern, ${garment.fit} fit silhouette, ${garment.hasButtons ? 'delicate front buttons' : ''}, ${garment.hasDrawstring ? 'adjustable matching drawstring' : ''}.`,
      `Setting: Crisp pure clean white studio e-commerce background, balanced softbox studio lighting, perfectly centered, no shadows, 8k resolution, crisp stitching details.`,
      `Shot directive: ${shotInstruction}.`,
      additionalPrompt ? `Special details: ${additionalPrompt}.` : '',
      highFidelityJson ? `Specifications: ${highFidelityJson}.` : '',
      `Masterpiece, high-end e-commerce product catalog, 1:1 square aspect ratio.`,
    ].filter(Boolean).join(' ');
  }

  // 2. Kit Mode (Multi-model group composition)
  if (presentationMode === 'kit' && kitConfig) {
    const qty = kitConfig.quantity || 3;
    const colors = kitConfig.variations.slice(0, qty).map((v, i) => `Model ${i + 1} in ${v.label}`).join(', ');
    return [
      `High-end commercial fashion group editorial photoshoot featuring ${qty} beautiful Brazilian female fashion models standing together in a coordinated lineup.`,
      `All models wearing the exact same design: ${GARMENT_MAP[garment.category] || garment.category} in ${FABRIC_MAP[fabric.material] || fabric.material}.`,
      `Color variations: ${colors}. Each model has a unique complementary hairstyle and dynamic confident pose.`,
      `Setting: ${env.label || 'Clean minimalist fashion studio'}, ${env.sub_environment || 'modern architectural background'}, soft high-fashion daylight.`,
      `Shot composition: ${shotInstruction}.`,
      `8k UHD, fashion magazine cover quality, award winning commercial photography, ultra-realistic skin and fabric physics, full body framing, 1:1 ratio.`,
    ].filter(Boolean).join(' ');
  }

  // 3. Single Model Mode (Primary)
  const bodyDesc = BODY_TYPE_MAP[modelId.bodyType] || 'toned proportional natural model build';
  const skinDesc = SKIN_TONE_MAP[modelId.skinTone] || 'warm sun-kissed skin tone';
  const hairColorDesc = HAIR_COLOR_MAP[modelId.hairColor] || 'glossy brunette hair';
  const hairStyleDesc = HAIR_STYLE_MAP[modelId.hairStyle] || 'natural loose hair';
  const hairTextureDesc = HAIR_TEXTURE_MAP[modelId.hairTexture] || 'natural wavy hair';
  const hairLength = modelId.hairLength ? `${modelId.hairLength} length` : 'medium length';

  const garmentDesc = `${garment.fit} fit ${GARMENT_MAP[garment.category] || garment.category} in ${garment.pattern} pattern`;
  const fabricDesc = FABRIC_MAP[fabric.material] || fabric.material;

  const accessories = [
    HAT_MAP[styling.hat],
    SUNGLASSES_MAP[styling.sunglasses],
    FOOTWEAR_MAP[styling.footwear] ? `wearing ${FOOTWEAR_MAP[styling.footwear]}` : '',
    styling.earrings !== 'none' ? 'subtle golden hoop earrings' : '',
  ].filter(Boolean).join(', ');

  const environmentSetting = `${env.label || 'Modern Aesthetic Fashion Setting'} (${env.sub_environment || 'minimalist architecture'}), ${env.editorial_treatment || 'soft diffused natural daylight'}`;

  const promptParts = [
    `Stunning 8k professional commercial fashion catalog photoshoot of a gorgeous Brazilian woman (24-30 years old),`,
    `with ${skinDesc}, ${bodyDesc}, and charismatic approachable friendly expression, genuine subtle smile, natural dewy makeup.`,
    `Hair: ${hairLength} ${hairColorDesc}, styled in ${hairStyleDesc}, ${hairTextureDesc}.`,
    `Outfit: Wearing a premium ${garmentDesc} made of ${fabricDesc} (${fabric.shine} finish, ${fabric.drape} drape).`,
    garment.hasButtons ? `Features functional front buttons.` : '',
    garment.hasDrawstring ? `Features matching adjustable waist drawstring.` : '',
    garment.hasPockets ? `Features tailored functional pockets.` : '',
    accessories ? `Styling: ${accessories}.` : '',
    `Location & Lighting: ${environmentSetting}.`,
    `Framing: ${shotInstruction}. Full body shot, model occupies 85% vertical frame, head to toe visible, uncropped composition, 1:1 square ratio.`,
    `Quality: Shot on Hasselblad 100mm f/2.8 lens, creamy bokeh background blur, hyperrealistic textile micro-textures, photorealistic natural lighting, zero plastic skin, magazine quality commercial e-commerce presentation.`,
    additionalPrompt ? `User specific directives: ${additionalPrompt}.` : '',
    highFidelityJson ? `Technical constraints: ${highFidelityJson}.` : '',
  ];

  return promptParts.filter(Boolean).join(' ');
};

/**
 * Builds an image edit / inpainting prompt
 */
export const buildDiffusionEditPrompt = (params: ImageEditParams): string => {
  const { editInstruction, base64TargetImage, additionalPrompt } = params;
  return [
    `High-precision photo retouching and seamless modification instruction: "${editInstruction}".`,
    `Keep 95% of original image unchanged, preserve exact identity, body proportions, clothing texture, lighting consistency and background colors.`,
    additionalPrompt ? `Additional context: ${additionalPrompt}.` : '',
    `Hyperrealistic, seamless photographic integration, 8k fashion photography fidelity.`,
  ].filter(Boolean).join(' ');
};

/**
 * Builds a structured system prompt for Gemini Multimodal Generation
 */
export const buildGeminiSystemPrompt = (
  params: ImageGenerationParams,
  isEdit: boolean = false
): string => {
  const {
    shotInstruction,
    modelId,
    env,
    fabric,
    garment,
    styling,
    quantity,
    presentationMode = 'model',
    kitConfig,
    additionalPrompt,
    highFidelityJson,
  } = params;

  const userReinforcement = additionalPrompt ? `
USER REINFORCEMENT / SPECIFIC DETAILS (HIGHEST PRIORITY):
"${additionalPrompt.toUpperCase()}"
- STRICTLY FOLLOW these specific details regarding fabric, accessories, or styling.
`.trim() : '';

  const highFidelityReinforcement = highFidelityJson ? `
HIGH FIDELITY REINFORCEMENT (JSON):
${highFidelityJson}
- READ AND APPLY these technical specifications before rendering.
`.trim() : '';

  // Detect shot-specific overrides from the instruction text
  const isMacroShot = shotInstruction.toUpperCase().includes('MACRO') || shotInstruction.toUpperCase().includes('CLOSE-UP OVERRIDE');
  const isMarketplaceHero = shotInstruction.toUpperCase().includes('MARKETPLACE HERO');

  const framingRules = isMacroShot
    ? `
CRITICAL COMPOSITION & FRAMING (MACRO OVERRIDE — 1:1 SQUARE):
RESOLUTION: Qualidade HD 1200x1200px.
FULL BLEED BACKGROUND: O fundo DEVE preencher todo o quadrado 1:1. ABSOLUTAMENTE SEM bordas brancas.
MACRO FRAMING: Enquadramento apertado do peito até a bainha ou nível de costura. Rosto e pés INTENCIONALMENTE fora do quadro. Mãos descansando naturalmente com manicure limpa e neutra.
THIS SHOT SUPPRESSES the full-body head-to-toe rule. Focus 100% on textile micro-details.
`.trim()
    : `
CRITICAL COMPOSITION & FRAMING (STRICT 1:1 SQUARE):
RESOLUTION: Qualidade HD 1200x1200px.
FULL BLEED BACKGROUND: O fundo DEVE preencher todo o quadrado 1:1. ABSOLUTAMENTE SEM bordas brancas.
FULL BODY SHOT: Mostre o modelo da cabeça aos pés.
NO CROPPING: O topo da cabeça e os pés DEVEM estar visíveis dentro do quadro.
SCALE: O modelo deve ocupar 85-90% da altura vertical.
`.trim();

  const baseRules = `
STRICT PROFESSIONAL FASHION GUIDELINES:
Este é um catálogo de moda comercial de alto padrão.
O modelo deve ser apresentado com dignidade e elegância.
Garanta que a roupa seja o foco primário com 100% de precisão técnica. A modelo deve vestir o produto naturalmente, destacando o caimento e o movimento da roupa.

${framingRules}

POSE & ATITUDE:
Poses relaxadas e naturais. Exemplos: caminhando, leve movimento, mão no bolso, ajeitando o cabelo, sorriso suave, postura natural.

PIXEL-PERFECT GARMENT FIDELITY:
IMAGEM 1 (FRENTE) e IMAGEM 2 (COSTA) são a fonte ABSOLUTA da verdade.
NÃO MUDE o design, corte, botões ou textura do tecido.
`.trim();

  const unitaryMode = `
UNITARY MODE - SINGLE MODEL:
Mostre APENAS UM modelo na imagem.
Sem grupos, sem múltiplas pessoas.
Foque na pose do modelo e no caimento da roupa.
`.trim();

  let kitMode = "";
  if (presentationMode === 'kit' && kitConfig) {
    const variationDescriptions = kitConfig.variations
      .slice(0, kitConfig.quantity)
      .map((v, i) => `Modelo ${i + 1}: Cor da Amostra ${i + 1} (${v.label.toUpperCase()})`)
      .join('. ');

    kitMode = `
KIT MODE - GROUP COMPOSITION (${kitConfig.quantity} models):
Mostre ${kitConfig.quantity} modelos juntos em uma composição de grupo profissional.
TODOS estão usando EXATAMENTE o mesmo design de roupa da Imagem 1 e 2.
CADA modelo veste uma COR DIFERENTE baseada nas amostras enviadas.
${variationDescriptions}.
GARANTA: Cada modelo deve ter um PENTEADO ÚNICO e DIFERENTE para diferenciá-los.
`.trim();
  }

  let plusSizeLogic = "";
  if (modelId.bodyType === 'mid_size_44' || modelId.bodyType === 'curvy_light') {
    plusSizeLogic = `
PLUS SIZE SPECIFIC SCOPE:
Vibe: Modelo ultra realista, confiante e elegante.
Body Details: Silhueta elegante, proporções sofisticadas, curvas realistas.
Pose: De pé com confiança, uma mão na cintura, postura profissional.
    `.trim();
  }

  const technicalSpecs = `
TECHNICAL SPECS:
Resolução 8k, fotorrealista, qualidade comercial high-end.
Foco nítido nos detalhes da roupa.
Sem membros ou rostos distorcidos.
Iluminação e sombras consistentes.
`.trim();

  let outfitCompletion = "";
  if (['shorts', 'skirt', 'pants'].includes(garment.category)) {
    outfitCompletion = `
CRITICAL OUTFIT COMPLETION (BOTTOMS DETECTED):
- MAIN PRODUCT: The ${garment.category} provided in the reference images — THIS IS THE HERO PIECE.
- COMPLEMENTARY TOP (AI-GENERATED): You MUST generate a NEUTRAL, MINIMALIST fitted top.
  Options (pick the most harmonious): fitted ribbed off-white crop top, black seamless ribbed tank, ecru linen blouse tucked in, or simple white cotton tee.
- RULE: The complementary top must NOT cover the waistband of the main product.
- RULE: The complementary top must NOT compete visually — neutral solid colors only (off-white, black, ecru, beige).
`.trim();
  } else if (['shirt'].includes(garment.category)) {
    outfitCompletion = `
CRITICAL OUTFIT COMPLETION (TOP DETECTED):
- MAIN PRODUCT: The top/blouse provided in the reference images — THIS IS THE HERO PIECE.
- COMPLEMENTARY BOTTOMS (AI-GENERATED): You MUST generate NEUTRAL, MINIMALIST bottoms.
  Options (pick the most harmonious): high-waisted ecru/linen straight-leg trousers, classic medium-wash slim jeans, tailored beige chinos, or a simple off-white midi skirt.
- RULE: Bottoms must NOT compete visually — neutral solid colors only (ecru, beige, light denim, off-white, black).
- RULE: Bottoms should complement the silhouette and vibe of the top without drawing attention.
`.trim();
  }

  const garmentString = `
GARMENT DETAILS:
- CATEGORY: ${garment.category.toUpperCase()}
- MATERIAL PHYSICS: ${fabric.material} (${fabric.weight}, ${fabric.drape} drape).
- SURFACE: ${fabric.texture} texture, ${fabric.shine} finish.
- CONSTRUCTION: ${garment.pattern} pattern, ${garment.fit} fit, ${garment.waistband} waistband.
`.trim();

  const environmentDirectives = `
ENVIRONMENT & LIGHTING CONTROL (MANDATORY):
- SETTING PRESET: ${env.label}
- CONTEXT: ${env.category?.replace(/_/g, ' ')} -> ${env.sub_environment?.replace(/_/g, ' ')}.
- LIGHTING TREATMENT: ${env.editorial_treatment?.replace(/_/g, ' ')}.
`.trim();

  // For Marketplace Hero shots, force clean styling — no distracting accessories
  const stylingDirectives = isMarketplaceHero
    ? `
STYLING MANIFESTO (MARKETPLACE COMPLIANCE LOCK):
- VIBE: COMMERCIAL CLEAN (minimal intensity)
- EYEWEAR: ABSOLUTELY NO SUNGLASSES.
- HEADWEAR: ABSOLUTELY NO HAT.
- BAG: ABSOLUTELY NO BAG.
- JEWELRY: Minimalist neutral studs only — no dangling, no bold, no colored jewelry.
- FOOTWEAR: ${styling.footwear !== 'none' ? `Wear ${styling.footwear}.` : 'Barefoot or Neutral.'}
- BACKGROUND: Pure white or neutral light seamless studio. No props.
`.trim()
    : `
STYLING MANIFESTO:
- VIBE: ${styling.vibe?.toUpperCase()} (${styling.intensity} intensity)
- EYEWEAR: ${styling.sunglasses !== 'none' ? `Wear ${styling.sunglasses} sunglasses with ${styling.frameMaterial} frames.` : 'NO SUNGLASSES.'}
- HEADWEAR: ${styling.hat !== 'none' ? `Wear a ${styling.hat}.` : 'NO HAT.'}
- FOOTWEAR: ${styling.footwear !== 'none' ? `Wear ${styling.footwear}.` : 'Barefoot or Neutral.'}
- JEWELRY: ${styling.earrings !== 'none' ? styling.earrings : 'Minimal/None'}.
`.trim();

  const identityLock = `
IDENTITY LOCK & ART DIRECTION:
- MODEL: Brazilian female model, around 24-30 years old, natural beauty, warm and friendly expression, genuine smile. Healthy glowing skin.
- SKIN TONE: ${modelId.skinTone.replace('_', ' ')}
- HAIR: Natural movement, Color: ${modelId.hairColor.replace('_', ' ')}, Length: ${modelId.hairLength}, Style: ${modelId.hairStyle}.
- VIBE: Modern Brazilian fashion style: stylish, effortless, casual chic.
- PHOTOGRAPHY: 85mm lens look, shallow depth of field, high quality fashion photography.
`.trim();

  let modeSpecific = presentationMode === 'kit' ? kitMode : unitaryMode;
  if (presentationMode === 'still') {
    modeSpecific = `TASK: Generate a Ghost Mannequin / Invisible Mannequin shot. STRICT RULES: NO HUMAN BODY PARTS. 3D Volumetric shape.`;
  }

  if (isEdit) {
    return `
TASK: HIGH-PRECISION IMAGE EDITING (INPAINTING).
ROLE: SENIOR PHOTO RETOUCHER.
USER INSTRUCTION: "${shotInstruction.toUpperCase()}"
1. FREEZE PROTOCOL: 95% of the image MUST remain PIXEL-PERFECT identical to the input.
2. TARGET ONLY: Modify ONLY the specific element mentioned.
${userReinforcement}
${technicalSpecs}
    `.trim();
  }

  return `
${baseRules}
${modeSpecific}
${plusSizeLogic}

USER SHOT INSTRUCTION:
"${shotInstruction.toUpperCase()}"

${garmentString}
${outfitCompletion}

MODEL IDENTITY & STYLING:
${identityLock}
${stylingDirectives}
${environmentDirectives}

${userReinforcement}
${highFidelityReinforcement}
${technicalSpecs}
  `.trim();
};

/**
 * Prompt de retoque: recebe apenas a instrução do usuário (a imagem alvo segue como anexo).
 * Mantém o restante da imagem intacto (protocolo de congelamento).
 */
export const buildEditPrompt = (editInstruction: string, additionalPrompt?: string): string =>
  `
TASK: HIGH-PRECISION IMAGE EDITING (INPAINTING).
ROLE: SENIOR PHOTO RETOUCHER.
USER INSTRUCTION: "${editInstruction.toUpperCase()}"
1. FREEZE PROTOCOL: 95% of the image MUST remain PIXEL-PERFECT identical to the input image.
2. TARGET ONLY: Modify ONLY the specific element mentioned. Keep the garment design, color, texture, the model identity and the background unchanged.
${additionalPrompt ? `ADDITIONAL CONTEXT: "${additionalPrompt.toUpperCase()}"` : ''}
Output a single photorealistic image with the same 1:1 framing.
`.trim();
