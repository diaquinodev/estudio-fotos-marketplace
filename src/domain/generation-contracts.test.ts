import { describe, expect, it } from 'vitest';
import {
  buildKitShotPlan,
  buildModelShotPlan,
  buildStillShotPlan,
  supportingLookFor,
  validateGarmentTruth,
  validateModelIdentityLock,
  validateShotPlan,
  type GarmentTruthV1,
  type ModelIdentityLock,
} from './generation-contracts';

const garmentTruth: GarmentTruthV1 = {
  schemaVersion: 1,
  id: 'garment-1',
  category: 'cropped',
  focalPiece: 'upper',
  references: [{ id: 'front-1', view: 'front', verified: true }],
  fields: {
    color: { value: 'rosa claro', source: 'vision', confidence: 0.98, confirmed: true },
    pattern: { value: 'liso', source: 'vision', confidence: 0.98, confirmed: true },
    material: { value: 'malha', source: 'vision', confidence: 0.8, confirmed: true },
    silhouette: { value: 'cropped ajustado', source: 'vision', confidence: 0.95, confirmed: true },
    details: { value: ['alças finas'], source: 'vision', confidence: 0.95, confirmed: true },
  },
  verifiedViews: ['front'],
  supportingLook: supportingLookFor('cropped'),
};

const approvedLock: ModelIdentityLock = {
  schemaVersion: 1,
  id: 'model-lock-1',
  version: 1,
  identity: {
    ageRange: '24-30',
    bodyType: 'mid_size_44',
    skinTone: 'medium',
    hairColor: 'brunette',
    hairLength: 'medium',
    hairTexture: 'wavy',
    hairStyle: 'loose',
    tattoo: false,
  },
  approved: true,
  approvedAt: '2026-10-10T12:00:00.000Z',
};

describe('generation contracts', () => {
  it('mantém a peça de cima como foco e exige parte de baixo subordinada', () => {
    expect(supportingLookFor('cropped')).toMatchObject({ role: 'neutral_bottom', dominance: 'subordinate' });
    expect(supportingLookFor('pants')).toMatchObject({ role: 'neutral_top', dominance: 'subordinate' });
    expect(supportingLookFor('set')).toMatchObject({ role: 'none', dominance: 'subordinate' });
  });

  it('não confirma costas quando não existe referência traseira', () => {
    expect(validateGarmentTruth(garmentTruth)).toEqual([]);
    expect(validateGarmentTruth({ ...garmentTruth, verifiedViews: ['front', 'back'] })).toContain(
      'Costas não podem ser confirmadas sem referência traseira verificada.',
    );
  });

  it('exige aprovação explícita para congelar a identidade da modelo', () => {
    expect(validateModelIdentityLock(approvedLock)).toEqual([]);
    expect(validateModelIdentityLock({ ...approvedLock, approved: false, approvedAt: undefined })).toContain(
      'A identidade da modelo precisa estar aprovada antes da geração.',
    );
  });

  it('cria pacotes de modelo com 5 fotos e bloqueia costas não verificadas', () => {
    const plan = buildModelShotPlan(5, approvedLock.id);
    expect(plan.package).toBe('five');
    expect(plan.shots).toHaveLength(5);
    expect(validateShotPlan(plan, garmentTruth, approvedLock)).toContain('Tomada model-back-fit exige costas verificadas.');
  });

  it('mantém Still frontal, isolado e sem modelo', () => {
    const plan = buildStillShotPlan(5);
    expect(plan.shots).toHaveLength(5);
    expect(plan.shots.every((shot) => shot.subject === 'garment_only' && shot.view === 'front')).toBe(true);
    expect(validateShotPlan(plan, garmentTruth)).toEqual([]);
  });

  it('fixa a quantidade e as referências exatas do Kit', () => {
    const plan = buildKitShotPlan('kit_overlay', ['front-1', 'front-2', 'front-3']);
    expect(plan.quantity).toBe(1);
    expect(plan.shots[0].exactReferenceIds).toEqual(['front-1', 'front-2', 'front-3']);
    expect(validateShotPlan(plan, garmentTruth)).toEqual([]);
  });
});
