import { ModelIdentity, EnvironmentConfig, FabricSpec, GarmentSpec, StylingConfig, ImageQuantity, PresentationMode, KitConfig } from '../../types';

export interface ImageGenerationParams {
  base64Images: { front?: string; back?: string };
  shotInstruction: string;
  modelId: ModelIdentity;
  env: EnvironmentConfig;
  fabric: FabricSpec;
  garment: GarmentSpec;
  styling: StylingConfig;
  quantity: ImageQuantity;
  presentationMode?: PresentationMode;
  kitConfig?: KitConfig;
  additionalPrompt?: string;
  highFidelityJson?: string;
}

export interface ImageEditParams {
  base64TargetImage: string;
  editInstruction: string;
  modelId: ModelIdentity;
  env: EnvironmentConfig;
  fabric: FabricSpec;
  garment: GarmentSpec;
  styling: StylingConfig;
  quantity: ImageQuantity;
  presentationMode?: PresentationMode;
  kitConfig?: KitConfig;
  additionalPrompt?: string;
  highFidelityJson?: string;
}

export interface StrategyInfo {
  id: string;
  name: string;
  badge: string;
  description: string;
  isFree: boolean;
  requiresApiKey: boolean;
  speed: 'ultra-fast' | 'fast' | 'standard';
  quality: 'high' | 'ultra' | 'commercial';
}

export interface ImageGenerationStrategy {
  readonly info: StrategyInfo;
  generateImage(params: ImageGenerationParams, onProgress?: (status: string) => void): Promise<string>;
  editImage(params: ImageEditParams, onProgress?: (status: string) => void): Promise<string>;
  isAvailable(): boolean;
}
