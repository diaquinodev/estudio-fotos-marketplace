import { ModelIdentity, EnvironmentConfig, FabricSpec, GarmentSpec, StylingConfig, ImageQuantity, PresentationMode, KitConfig } from "../types";
import { imageGenerationManager } from "./strategies";

export { imageGenerationManager };
export * from "./strategies";

/**
 * Delegated image generation using the active Strategy Pattern architecture
 */
export const generateProfessionalImage = async (
  base64Images: { front?: string; back?: string }, 
  shotInstruction: string,
  modelId: ModelIdentity,
  env: EnvironmentConfig,
  fabric: FabricSpec,
  garment: GarmentSpec,
  styling: StylingConfig,
  quantity: ImageQuantity,
  presentationMode: PresentationMode = 'model',
  kitConfig?: KitConfig,
  additionalPrompt?: string,
  highFidelityJson?: string,
  onProgress?: (status: string) => void
): Promise<string | null> => {
  return await imageGenerationManager.generateImage({
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
  }, onProgress);
};

/**
 * Delegated image editing using the active Strategy Pattern architecture
 */
export const editImage = async (
  base64TargetImage: string,
  editInstruction: string,
  modelId: ModelIdentity,
  env: EnvironmentConfig,
  fabric: FabricSpec,
  garment: GarmentSpec,
  styling: StylingConfig,
  quantity: ImageQuantity,
  presentationMode: PresentationMode = 'model',
  kitConfig?: KitConfig,
  additionalPrompt?: string,
  highFidelityJson?: string,
  onProgress?: (status: string) => void
): Promise<string | null> => {
  return await imageGenerationManager.editImage({
    base64TargetImage,
    editInstruction,
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
  }, onProgress);
};
