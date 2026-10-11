import type { ModelIdentity } from '@/types';

export type ContractSource = 'seller' | 'vision' | 'inferred';
export type ReferenceView = 'front' | 'back' | 'detail';
export type GarmentCategory = 'cropped' | 'top' | 'shirt' | 'shorts' | 'pants' | 'skirt' | 'dress' | 'set';
export type GarmentFocalPiece = 'upper' | 'lower' | 'full_set' | 'dress';
export type StudioId = 'model' | 'still' | 'kit';
export type PhotoPackage = 'test' | 'three' | 'five' | 'ten' | 'kit';

export interface GarmentField<T> {
  value: T;
  source: ContractSource;
  confidence: number;
  confirmed: boolean;
}

export interface ReferenceAsset {
  id: string;
  view: ReferenceView;
  dataUrl?: string;
  storagePath?: string;
  verified: boolean;
}

export interface SupportingLookSpec {
  role: 'neutral_bottom' | 'neutral_top' | 'none';
  description: string;
  dominance: 'subordinate';
}

export interface GarmentTruthV1 {
  schemaVersion: 1;
  id: string;
  category: GarmentCategory;
  focalPiece: GarmentFocalPiece;
  references: ReferenceAsset[];
  fields: {
    color: GarmentField<string>;
    pattern: GarmentField<string>;
    material: GarmentField<string>;
    silhouette: GarmentField<string>;
    details: GarmentField<string[]>;
  };
  verifiedViews: Array<'front' | 'back'>;
  supportingLook: SupportingLookSpec;
}

export interface ModelIdentityLock {
  schemaVersion: 1;
  id: string;
  version: number;
  identity: ModelIdentity;
  referenceAssetId?: string;
  approved: boolean;
  approvedAt?: string;
}

export interface SceneSpec {
  studio: StudioId;
  background: string;
  framing: 'square_1200' | 'full_body' | 'three_quarter' | 'close' | 'macro';
  lighting: string;
  pose: string;
}

export interface ShotSpec {
  id: string;
  purpose: 'test' | 'marketplace_cover' | 'side_view' | 'back_view' | 'detail' | 'movement' | 'kit_cover' | 'kit_close' | 'kit_overlay';
  subject: 'model_wearing_garment' | 'garment_only' | 'kit_items';
  view: 'front' | 'side' | 'back' | 'close' | 'creative';
  requiresBackReference: boolean;
  scene: SceneSpec;
  exactReferenceIds?: string[];
}

export interface ShotPlan {
  schemaVersion: 1;
  id: string;
  studio: StudioId;
  package: PhotoPackage;
  quantity: number;
  shots: ShotSpec[];
  modelIdentityLockId?: string;
}

const modelShots: ShotSpec[] = [
  {
    id: 'model-test-front',
    purpose: 'test',
    subject: 'model_wearing_garment',
    view: 'front',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'neutral marketplace studio', framing: 'full_body', lighting: 'soft commercial light', pose: 'front-facing neutral stance' },
  },
  {
    id: 'model-cover-front',
    purpose: 'marketplace_cover',
    subject: 'model_wearing_garment',
    view: 'front',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'neutral marketplace studio', framing: 'full_body', lighting: 'soft commercial light', pose: 'front-facing commercial stance' },
  },
  {
    id: 'model-side-fit',
    purpose: 'side_view',
    subject: 'model_wearing_garment',
    view: 'side',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'neutral marketplace studio', framing: 'full_body', lighting: 'soft commercial light', pose: 'controlled side profile' },
  },
  {
    id: 'model-back-fit',
    purpose: 'back_view',
    subject: 'model_wearing_garment',
    view: 'back',
    requiresBackReference: true,
    scene: { studio: 'model', background: 'neutral marketplace studio', framing: 'full_body', lighting: 'soft commercial light', pose: 'back-facing controlled stance' },
  },
  {
    id: 'model-detail',
    purpose: 'detail',
    subject: 'model_wearing_garment',
    view: 'close',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'neutral marketplace studio', framing: 'close', lighting: 'soft detail light', pose: 'still pose with garment unobstructed' },
  },
  {
    id: 'model-movement',
    purpose: 'movement',
    subject: 'model_wearing_garment',
    view: 'creative',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'controlled editorial environment', framing: 'three_quarter', lighting: 'soft editorial light', pose: 'single controlled movement' },
  },
  {
    id: 'model-front-detail',
    purpose: 'detail',
    subject: 'model_wearing_garment',
    view: 'front',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'neutral marketplace studio', framing: 'three_quarter', lighting: 'soft commercial light', pose: 'front three-quarter pose' },
  },
  {
    id: 'model-side-movement',
    purpose: 'movement',
    subject: 'model_wearing_garment',
    view: 'side',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'controlled editorial environment', framing: 'three_quarter', lighting: 'soft editorial light', pose: 'single controlled walking pose' },
  },
  {
    id: 'model-close-front',
    purpose: 'detail',
    subject: 'model_wearing_garment',
    view: 'close',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'neutral marketplace studio', framing: 'close', lighting: 'soft detail light', pose: 'front close-up with details visible' },
  },
  {
    id: 'model-editorial',
    purpose: 'movement',
    subject: 'model_wearing_garment',
    view: 'creative',
    requiresBackReference: false,
    scene: { studio: 'model', background: 'controlled editorial environment', framing: 'three_quarter', lighting: 'soft editorial light', pose: 'single fashion editorial pose' },
  },
];

const stillShots: ShotSpec[] = [
  'hero',
  'close',
  'detail',
  'shape',
  'marketplace',
].map((purpose, index) => ({
  id: `still-${purpose}-front`,
  purpose: purpose === 'hero' || purpose === 'marketplace' ? 'marketplace_cover' : 'detail',
  subject: 'garment_only',
  view: 'front',
  requiresBackReference: false,
  scene: {
    studio: 'still',
    background: 'neutral marketplace studio',
    framing: purpose === 'detail' || purpose === 'close' ? 'close' : 'square_1200',
    lighting: 'soft product light',
    pose: index === 0 ? 'frontal ghost mannequin silhouette' : `frontal ghost mannequin variation ${index + 1}`,
  },
}));

export function supportingLookFor(category: GarmentCategory): SupportingLookSpec {
  if (category === 'cropped' || category === 'top' || category === 'shirt') {
    return { role: 'neutral_bottom', description: 'parte de baixo lisa, neutra e visualmente subordinada', dominance: 'subordinate' };
  }
  if (category === 'shorts' || category === 'pants' || category === 'skirt') {
    return { role: 'neutral_top', description: 'blusa lisa, neutra e visualmente subordinada', dominance: 'subordinate' };
  }
  return { role: 'none', description: 'a peça principal deve ser apresentada como uma unidade', dominance: 'subordinate' };
}

export function buildModelShotPlan(quantity: 1 | 3 | 5 | 10, modelIdentityLockId: string): ShotPlan {
  return {
    schemaVersion: 1,
    id: `model-${quantity}`,
    studio: 'model',
    package: quantity === 1 ? 'test' : quantity === 3 ? 'three' : quantity === 5 ? 'five' : 'ten',
    quantity,
    shots: modelShots.slice(0, quantity),
    modelIdentityLockId,
  };
}

export function buildStillShotPlan(quantity: 1 | 3 | 5 | 10): ShotPlan {
  return {
    schemaVersion: 1,
    id: `still-${quantity}`,
    studio: 'still',
    package: quantity === 1 ? 'test' : quantity === 3 ? 'three' : quantity === 5 ? 'five' : 'ten',
    quantity,
    shots: stillShots.slice(0, quantity),
  };
}

export function buildKitShotPlan(composition: 'kit_cover' | 'kit_close' | 'kit_overlay', referenceIds: string[]): ShotPlan {
  const purpose = composition === 'kit_cover' ? 'kit_cover' : composition === 'kit_close' ? 'kit_close' : 'kit_overlay';
  return {
    schemaVersion: 1,
    id: `kit-${composition}`,
    studio: 'kit',
    package: 'kit',
    quantity: 1,
    shots: [{
      id: `kit-${composition}`,
      purpose,
      subject: 'kit_items',
      view: composition === 'kit_overlay' ? 'creative' : 'front',
      requiresBackReference: false,
      scene: {
        studio: 'kit',
        background: 'neutral marketplace studio',
        framing: composition === 'kit_close' ? 'close' : 'square_1200',
        lighting: 'soft product light',
        pose: composition === 'kit_overlay' ? 'flat lay or controlled overlap' : 'all items visible and separated',
      },
      exactReferenceIds: [...referenceIds],
    }],
  };
}

export function validateGarmentTruth(truth: GarmentTruthV1): string[] {
  const errors: string[] = [];
  const referenceViews = new Set(truth.references.filter((reference) => reference.verified).map((reference) => reference.view));
  if (truth.schemaVersion !== 1) errors.push('schemaVersion inválido.');
  if (!truth.id.trim()) errors.push('GarmentTruth precisa de um id.');
  if (!referenceViews.has('front')) errors.push('A peça precisa de uma referência frontal verificada.');
  if (truth.verifiedViews.includes('back') && !referenceViews.has('back')) errors.push('Costas não podem ser confirmadas sem referência traseira verificada.');
  if (truth.category === 'set' && truth.focalPiece !== 'full_set') errors.push('Conjunto deve ser tratado como uma unidade.');
  const expectedLook = supportingLookFor(truth.category);
  if (truth.supportingLook.role !== expectedLook.role) errors.push('A composição complementar não corresponde à categoria da peça.');
  for (const field of Object.values(truth.fields)) {
    if (field.confidence < 0 || field.confidence > 1) errors.push('Confiança dos campos deve estar entre 0 e 1.');
  }
  return errors;
}

export function validateModelIdentityLock(lock: ModelIdentityLock): string[] {
  const errors: string[] = [];
  if (lock.schemaVersion !== 1) errors.push('schemaVersion inválido.');
  if (!lock.id.trim()) errors.push('ModelIdentityLock precisa de um id.');
  if (!Number.isInteger(lock.version) || lock.version < 1) errors.push('Versão da identidade inválida.');
  if (!lock.approved) errors.push('A identidade da modelo precisa estar aprovada antes da geração.');
  if (lock.approved && !lock.approvedAt) errors.push('Identidade aprovada precisa de approvedAt.');
  return errors;
}

export function validateShotPlan(plan: ShotPlan, truth?: GarmentTruthV1, lock?: ModelIdentityLock): string[] {
  const errors: string[] = [];
  if (plan.schemaVersion !== 1) errors.push('schemaVersion inválido.');
  if (plan.quantity !== plan.shots.length) errors.push('Quantidade do plano não corresponde às tomadas.');
  if (plan.studio === 'model' && (!lock || validateModelIdentityLock(lock).length > 0)) errors.push('Plano de modelo exige identidade aprovada.');
  for (const shot of plan.shots) {
    if (shot.scene.studio !== plan.studio) errors.push(`Tomada ${shot.id} pertence a outro estúdio.`);
    if (plan.studio === 'still' && (shot.subject !== 'garment_only' || shot.view !== 'front' || shot.requiresBackReference)) {
      errors.push('Still deve ser frontal, isolado e sem dependência de costas.');
    }
    if (shot.requiresBackReference && !truth?.verifiedViews.includes('back')) errors.push(`Tomada ${shot.id} exige costas verificadas.`);
    if (plan.studio === 'kit' && (!shot.exactReferenceIds || shot.exactReferenceIds.length < 2)) errors.push('Kit precisa listar exatamente as referências que compõem a imagem.');
  }
  return errors;
}
