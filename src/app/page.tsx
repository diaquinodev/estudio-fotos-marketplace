'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { generateProfessionalImage, editImage } from '@/services/geminiService';
import { saveState, loadState, deleteDB } from '@/services/storage';
import { 
  GenerationStep, 
  SHOT_TYPES, 
  GeneratedImage, 
  ModelIdentity, 
  EnvironmentConfig, 
  FabricSpec, 
  GarmentSpec, 
  StylingConfig, 
  ImageQuantity, 
  PresentationMode, 
  KitConfig,
  WizardStep 
} from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { createClient } from '@/utils/supabase/client';
import { optimizeImageFile } from '@/utils/imageOptimizer';

import { StudioWizardNav } from '@/components/studio/StudioWizardNav';
import { Step1UploadPhotos } from '@/components/studio/Step1UploadPhotos';
import { Step2StylingConfig } from '@/components/studio/Step2StylingConfig';
import { Step3CatalogGallery } from '@/components/studio/Step3CatalogGallery';
import { PhotoTipsModal } from '@/components/studio/PhotoTipsModal';

const ENV_PRESETS: EnvironmentConfig[] = [
  { 
    label: 'Praia & Sol (Verão)', 
    category: 'editorial_summer_beach', 
    sub_environment: 'sunny_white_sand_beach', 
    editorial_treatment: 'high_fashion_editorial_sunlight' 
  },
  { 
    label: 'Bangalô Tropical (Resort Chic)', 
    category: 'ambient_resort', 
    sub_environment: 'luxury_tropical_bungalow', 
    editorial_treatment: 'natural_organic_textures_and_shadows' 
  },
  { 
    label: 'Urbano & Cidade (Casual Elegante)', 
    category: 'urban_chic', 
    sub_environment: 'sophisticated_city_architecture', 
    editorial_treatment: 'clean_urban_daylight_tones' 
  },
  { 
    label: 'Espaço Minimalista (Clean)', 
    category: 'modern_pastel_decor', 
    sub_environment: 'neutral_room_soft_pastel_walls_with_minimalist_frames_and_vases', 
    editorial_treatment: 'soft_diffused_daylight_fashion' 
  },
  { 
    label: 'Estúdio Branco (Marketplace)', 
    category: 'commercial_ecommerce', 
    sub_environment: 'professional_neutral_studio', 
    editorial_treatment: 'high_fidelity_commercial_softbox' 
  },
];

export default function App() {
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);

  const [presentationMode, setPresentationMode] = useState<PresentationMode>('model');
  const [referenceImages, setReferenceImages] = useState<{ front: string | null; back: string | null }>({
    front: null,
    back: null
  });
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageQuantity, setImageQuantity] = useState<ImageQuantity>(1);
  const [isValidationCompleted, setIsValidationCompleted] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(true);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [processingSlots, setProcessingSlots] = useState<Record<string, boolean>>({});
  
  const supabase = useMemo(() => createClient(), []);

  const refreshCredits = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .maybeSingle();
    setUserCredits(profile?.credits ?? 0);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial do saldo
    void refreshCredits();
  }, [refreshCredits]);

  const [modelConfig, setModelConfig] = useState<ModelIdentity>({
    ageRange: '24',
    bodyType: 'athletic',
    skinTone: 'golden_tan',
    hairColor: 'illuminated_brunette',
    hairLength: 'long',
    hairTexture: 'wavy',
    hairStyle: 'beach_waves',
    tattoo: false
  });

  const [fabricConfig, setFabricConfig] = useState<FabricSpec>({
    material: 'linen',
    weight: 'medium',
    texture: 'textured',
    shine: 'matte',
    drape: 'structured',
    wrinkleBehavior: 'medium'
  });

  const [garmentConfig, setGarmentConfig] = useState<GarmentSpec>({
    category: 'set',
    pattern: 'solid',
    fit: 'regular',
    waistband: 'fixed',
    hasDrawstring: true,
    hasButtons: true,
    hasPockets: false
  });

  const [stylingConfig, setStylingConfig] = useState<StylingConfig>({
    vibe: 'resort_chic',
    intensity: 'balanced',
    bag: 'none',
    sunglasses: 'none',
    frameMaterial: 'none',
    eyewear: 'none',
    scarf: 'none',
    hat: 'none',
    earrings: 'small_hoops',
    necklace: 'none',
    footwear: 'flat_sandals'
  });

  const [envConfig, setEnvConfig] = useState<EnvironmentConfig>(ENV_PRESETS[0]);
  const [additionalPrompt, setAdditionalPrompt] = useState<string>('');
  const [highFidelityJson, setHighFidelityJson] = useState<string>('');

  const [kitConfig, setKitConfig] = useState<KitConfig>({
    quantity: 2,
    variations: [
      { id: 'v1', url: null, label: 'Cor 1' },
      { id: 'v2', url: null, label: 'Cor 2' },
      { id: 'v3', url: null, label: 'Cor 3' },
      { id: 'v4', url: null, label: 'Cor 4' }
    ]
  });

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const variationInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const registerVariationInput = useCallback((idx: number, el: HTMLInputElement | null) => {
    variationInputRefs.current[idx] = el;
  }, []);
  const openVariationPicker = useCallback((idx: number) => {
    variationInputRefs.current[idx]?.click();
  }, []);

  const restoreSession = async () => {
    try {
      const savedState = await Promise.race([
        loadState(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout loading state")), 5000))
      ]);

      if (savedState) {
        if (savedState.step) setStep(savedState.step);
        if (savedState.wizardStep) setWizardStep(savedState.wizardStep);
        if (savedState.presentationMode) setPresentationMode(savedState.presentationMode);
        if (savedState.referenceImages) setReferenceImages(savedState.referenceImages);
        
        if (savedState.generatedImages) {
          const fixedImages = savedState.generatedImages.map((img: GeneratedImage) => ({
            ...img,
            status: img.status === 'processing' ? 'failed' : img.status
          }));
          setGeneratedImages(fixedImages);
        }
        
        if (savedState.imageQuantity) setImageQuantity(savedState.imageQuantity);
        if (savedState.isValidationCompleted !== undefined) setIsValidationCompleted(savedState.isValidationCompleted);
        if (savedState.modelConfig) setModelConfig(savedState.modelConfig);
        if (savedState.fabricConfig) setFabricConfig(savedState.fabricConfig);
        if (savedState.garmentConfig) setGarmentConfig(savedState.garmentConfig);
        if (savedState.stylingConfig) setStylingConfig(savedState.stylingConfig);
        if (savedState.envConfig) {
          if (savedState.envConfig.category) {
            setEnvConfig(savedState.envConfig);
          } else {
            setEnvConfig(ENV_PRESETS[0]);
          }
        }
        if (savedState.additionalPrompt) setAdditionalPrompt(savedState.additionalPrompt);
        if (savedState.highFidelityJson) setHighFidelityJson(savedState.highFidelityJson);
        if (savedState.kitConfig) setKitConfig(savedState.kitConfig);
      }
    } catch (e) {
      console.error("Falha ao restaurar sessão:", e);
    } finally {
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura a sessão salva no IndexedDB ao montar
    void restoreSession();
  }, []);

  // Auto-save effect with debounce
  useEffect(() => {
    if (!isRestoring && (referenceImages.front || referenceImages.back)) {
      const timer = setTimeout(() => {
        const stateToSave = {
          step,
          wizardStep,
          presentationMode,
          referenceImages,
          generatedImages,
          imageQuantity,
          isValidationCompleted,
          modelConfig,
          fabricConfig,
          garmentConfig,
          stylingConfig,
          envConfig,
          additionalPrompt,
          highFidelityJson,
          kitConfig
        };
        saveState(stateToSave);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [
    isRestoring,
    step,
    wizardStep,
    presentationMode,
    referenceImages,
    generatedImages,
    imageQuantity,
    isValidationCompleted,
    modelConfig,
    fabricConfig,
    garmentConfig,
    stylingConfig,
    envConfig,
    additionalPrompt,
    highFidelityJson,
    kitConfig
  ]);

  const confirmResetSession = async () => {
    setShowResetModal(false);
    setIsRestoring(true);
    try {
      await deleteDB();
      localStorage.clear();
      sessionStorage.clear();
      window.history.replaceState({}, document.title, window.location.pathname);
      
      setStep(GenerationStep.IDLE);
      setWizardStep(1);
      setReferenceImages({ front: null, back: null });
      setGeneratedImages([]);
      setIsValidationCompleted(false);
      setModelConfig({ 
        ageRange: '24',
        bodyType: 'athletic', 
        skinTone: 'golden_tan', 
        hairColor: 'illuminated_brunette', 
        hairTexture: 'wavy', 
        hairStyle: 'beach_waves',
        hairLength: 'long', 
        tattoo: false 
      });
      setFabricConfig({ material: 'linen', weight: 'medium', texture: 'textured', shine: 'matte', drape: 'structured', wrinkleBehavior: 'medium' });
      setGarmentConfig({ category: 'set', pattern: 'solid', fit: 'regular', waistband: 'fixed', hasDrawstring: true, hasButtons: true, hasPockets: false });
      setStylingConfig({ vibe: 'resort_chic', intensity: 'balanced', bag: 'none', sunglasses: 'none', frameMaterial: 'none', eyewear: 'none', scarf: 'none', hat: 'none', earrings: 'small_hoops', necklace: 'none', footwear: 'flat_sandals' });
      setEnvConfig(ENV_PRESETS[0]);
      setAdditionalPrompt('');
      setHighFidelityJson('');
      setKitConfig({ quantity: 2, variations: [{ id: 'v1', url: null, label: 'Cor 1' }, { id: 'v2', url: null, label: 'Cor 2' }, { id: 'v3', url: null, label: 'Cor 3' }, { id: 'v4', url: null, label: 'Cor 4' }] });
    } catch (e) {
      console.error("Erro durante reset:", e);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleFileUpload = (side: 'front' | 'back' | number) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const slotKey = typeof side === 'number' ? `kit-${side}` : side;

    event.target.value = '';

    if (!file) return;

    try {
      setProcessingSlots(prev => ({ ...prev, [slotKey]: true }));
      setError(null);

      const optimized = await optimizeImageFile(file, {
        maxDimension: 1600,
        quality: 0.85,
        format: 'image/webp'
      });

      if (typeof side === 'number') {
        setKitConfig(prev => {
          const newVariations = [...prev.variations];
          newVariations[side] = { ...newVariations[side], url: optimized.dataUrl };
          return { ...prev, variations: newVariations };
        });
      } else {
        setReferenceImages(prev => ({ ...prev, [side]: optimized.dataUrl }));
        // Permanece no Passo 1: O avanço ocorre apenas por clique intencional do lojista
      }
    } catch (err: unknown) {
      console.error('Erro ao otimizar imagem:', err);
      const message = err instanceof Error 
        ? err.message 
        : 'Não foi possível carregar a imagem. Certifique-se de que é um formato suportado (JPG, PNG ou WebP).';
      setError(message);
    } finally {
      setProcessingSlots(prev => ({ ...prev, [slotKey]: false }));
    }
  };

  const startGeneration = async (isResumingToFull: boolean = false) => {
    if (!referenceImages.front && !referenceImages.back) return;

    setStep(GenerationStep.GENERATING);
    setWizardStep(3); // Avança para a etapa do Catálogo para acompanhar ao vivo
    setError(null);
    setProgressStatus('Iniciando o estúdio fotográfico...');
    
    const targetQty = isResumingToFull ? 10 : imageQuantity;
    const startIndex = isResumingToFull ? generatedImages.length : 0;
    
    const shotsToGenerate = isResumingToFull 
      ? SHOT_TYPES.slice(generatedImages.length) 
      : SHOT_TYPES.slice(0, targetQty);

    const placeholders: GeneratedImage[] = shotsToGenerate.map(shot => ({
      id: Math.random().toString(36).substr(2, 9),
      url: '',
      type: shot.label,
      instruction: presentationMode === 'still' ? shot.stillInstruction : shot.instruction,
      status: 'processing',
    }));

    if (isResumingToFull) {
      setGeneratedImages(prev => [...prev, ...placeholders]);
    } else {
      setGeneratedImages(placeholders);
    }

    const executeShot = async (shot: typeof SHOT_TYPES[0], index: number) => {
       const globalIndex = startIndex + index;
       let instruction = presentationMode === 'still' ? shot.stillInstruction : shot.instruction;

       if (presentationMode === 'kit') {
          if (index === 0) {
            instruction = "GROUP LINEUP: Models standing side-by-side facing forward. Professional presentation. Full outfit clearly visible.";
          } else if (index === 1) {
            instruction = "GROUP INTERACTION: Models interacting, laughing, chatting. Relaxed and dynamic poses.";
          } else if (index === 2) {
            instruction = "LIFESTYLE CONTEXT: Models walking in a realistic daily life setting.";
          } else {
            instruction = "GROUP SHOT: Creative composition with high fashion appeal.";
          }
       }
       
       try {
        setProgressStatus(`Renderizando: ${shot.label}...`);
        
        const resultUrl = await generateProfessionalImage(
          { front: referenceImages.front || undefined, back: referenceImages.back || undefined }, 
          instruction, modelConfig, envConfig, fabricConfig, garmentConfig, stylingConfig, targetQty, presentationMode,
          kitConfig,
          additionalPrompt,
          highFidelityJson,
          (statusMsg) => setProgressStatus(`[${shot.label}] ${statusMsg}`)
        );

        if (resultUrl) {
          setGeneratedImages(prev => {
            const next = [...prev];
            if (next[globalIndex]) {
                next[globalIndex] = { ...next[globalIndex], url: resultUrl, status: 'approved' };
            }
            return next;
          });
        } else {
          setGeneratedImages(prev => {
            const next = [...prev];
            if (next[globalIndex]) {
              next[globalIndex] = { ...next[globalIndex], status: 'failed' };
            }
            return next;
          });
        }
       } catch (err: unknown) {
         setGeneratedImages(prev => {
          const next = [...prev];
          if (next[globalIndex]) {
            next[globalIndex] = { ...next[globalIndex], status: 'failed' };
          }
          return next;
        });
        const msg = err instanceof Error ? err.message : "Falha na geração.";
        setError(msg);
       }
    };

    for (let i = 0; i < shotsToGenerate.length; i++) {
      await executeShot(shotsToGenerate[i], i);
    }
    
    setGeneratedImages(prev => prev.map(img => 
      img.status === 'processing' ? { ...img, status: 'failed' } : img
    ));

    if (targetQty < 10) setIsValidationCompleted(true);
    setProgressStatus('');
    void refreshCredits();
    setStep(GenerationStep.COMPLETED);
  };

  const regenerateSingle = async (index: number) => {
    if (!referenceImages.front && !referenceImages.back) return;
    const shot = SHOT_TYPES[index] || SHOT_TYPES[0];
    const instruction = presentationMode === 'still' ? shot.stillInstruction : shot.instruction;

    setGeneratedImages(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: 'processing' };
      return copy;
    });

    try {
      setProgressStatus(`Recriando ${shot.label}...`);
      const resultUrl = await generateProfessionalImage(
        { front: referenceImages.front || undefined, back: referenceImages.back || undefined }, 
        instruction, modelConfig, envConfig, fabricConfig, garmentConfig, stylingConfig, imageQuantity, presentationMode,
        kitConfig,
        additionalPrompt,
        highFidelityJson,
        (msg) => setProgressStatus(msg)
      );

      if (resultUrl) {
        setGeneratedImages(prev => {
          const copy = [...prev];
          copy[index] = { ...copy[index], url: resultUrl, status: 'approved' };
          return copy;
        });
      } else {
        setGeneratedImages(prev => {
          const copy = [...prev];
          copy[index] = { ...copy[index], status: 'failed' };
          return copy;
        });
        setError("A foto regerada retornou vazia.");
      }
    } catch (err: unknown) {
       setGeneratedImages(prev => {
          const copy = [...prev];
          copy[index] = { ...copy[index], status: 'failed' };
          return copy;
       });
       const msg = err instanceof Error ? err.message : "Falha ao recriar foto.";
       setError(msg);
    } finally {
      setProgressStatus('');
      void refreshCredits();
    }
  };

  const handleApplyEdit = async (index: number, instruction: string) => {
    const targetImage = generatedImages[index];
    if (!targetImage?.url || !instruction) return;

    setGeneratedImages(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: 'processing' };
      return copy;
    });

    try {
      setProgressStatus('Aplicando retoque na foto...');
      const resultUrl = await editImage(
        targetImage.url, 
        instruction, 
        modelConfig, 
        envConfig, 
        fabricConfig, 
        garmentConfig, 
        stylingConfig, 
        imageQuantity, 
        presentationMode,
        kitConfig,
        additionalPrompt,
        highFidelityJson,
        (msg) => setProgressStatus(msg)
      );

      if (resultUrl) {
        setGeneratedImages(prev => {
          const copy = [...prev];
          copy[index] = { ...copy[index], url: resultUrl, status: 'approved' };
          return copy;
        });
      } else {
        setGeneratedImages(prev => {
          const copy = [...prev];
          copy[index] = { ...copy[index], status: 'failed' };
          return copy;
        });
        setError("A imagem com retoque não pôde ser gerada.");
      }
    } catch (err: unknown) {
      setGeneratedImages(prev => {
        const copy = [...prev];
        copy[index] = { ...copy[index], status: 'failed' };
        return copy;
      });
      const msg = err instanceof Error ? err.message : "Falha ao aplicar retoque.";
      setError(msg);
    } finally {
      setProgressStatus('');
      void refreshCredits();
    }
  };

  const downloadSingle = (img: GeneratedImage) => {
    if (img.status === 'approved' && img.url) {
      const link = document.createElement('a');
      link.href = img.url;
      link.download = `catalogo-moda-${img.id || 'foto'}.png`;
      link.click();
    }
  };

  const downloadAll = () => {
    generatedImages.forEach((img) => {
      if (img.status === 'approved' && img.url) {
        downloadSingle(img);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 antialiased font-['Inter'] flex">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Topbar credits={userCredits} />

        {/* Global Error Banner */}
        {error && (
          <div className="bg-rose-50 border-b border-rose-200 px-8 py-3.5 flex items-center justify-between text-rose-800 text-xs font-bold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-600 hover:text-rose-800 underline uppercase text-[10px]"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Main Content Wizard Container */}
        <main className="max-w-5xl mx-auto w-full p-6 sm:p-10 flex-1">
          {/* Stepper Wizard Navigation Bar */}
          <StudioWizardNav
            currentStep={wizardStep}
            onStepClick={(targetStep) => setWizardStep(targetStep)}
            canNavigateToStep2={Boolean(referenceImages.front)}
            canNavigateToStep3={generatedImages.length > 0 || step === GenerationStep.GENERATING}
          />

          {/* PASSO 1: SUAS FOTOS */}
          {wizardStep === 1 && (
            <Step1UploadPhotos
              referenceImages={referenceImages}
              presentationMode={presentationMode}
              onSetPresentationMode={setPresentationMode}
              kitConfig={kitConfig}
              onSetKitConfig={setKitConfig}
              processingSlots={processingSlots}
              onFileUpload={handleFileUpload}
              frontInputRef={frontInputRef}
              backInputRef={backInputRef}
              registerVariationInput={registerVariationInput}
              openVariationPicker={openVariationPicker}
              onAdvanceToStep2={() => setWizardStep(2)}
              onOpenTipsModal={() => setIsTipsModalOpen(true)}
            />
          )}

          {/* PASSO 2: ESTILO DO ENSAIO */}
          {wizardStep === 2 && (
            <Step2StylingConfig
              referenceImages={referenceImages}
              presentationMode={presentationMode}
              modelConfig={modelConfig}
              onSetModelConfig={setModelConfig}
              fabricConfig={fabricConfig}
              onSetFabricConfig={setFabricConfig}
              garmentConfig={garmentConfig}
              onSetGarmentConfig={setGarmentConfig}
              envConfig={envConfig}
              onSetEnvConfig={setEnvConfig}
              imageQuantity={imageQuantity}
              onSetImageQuantity={setImageQuantity}
              additionalPrompt={additionalPrompt}
              onSetAdditionalPrompt={setAdditionalPrompt}
              highFidelityJson={highFidelityJson}
              onSetHighFidelityJson={setHighFidelityJson}
              userCredits={userCredits}
              onStartGeneration={() => startGeneration(false)}
              onBackToStep1={() => setWizardStep(1)}
            />
          )}

          {/* PASSO 3: SEU CATÁLOGO */}
          {wizardStep === 3 && (
            <Step3CatalogGallery
              step={step}
              progressStatus={progressStatus}
              generatedImages={generatedImages}
              onBackToStep2={() => setWizardStep(2)}
              onDownloadSingle={downloadSingle}
              onDownloadAll={downloadAll}
              onRegenerateSingle={regenerateSingle}
              onApplyEdit={handleApplyEdit}
              onResetSession={() => setShowResetModal(true)}
            />
          )}
        </main>
      </div>

      {/* Modal: Dicas de Fotografia com o Celular */}
      <PhotoTipsModal
        isOpen={isTipsModalOpen}
        onClose={() => setIsTipsModalOpen(false)}
      />

      {/* Modal: Confirmar Limpeza de Sessão */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-black text-slate-900">Iniciar Novo Ensaio?</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Tem certeza que deseja limpar as fotos atuais? As imagens geradas serão descartadas da tela atual.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmResetSession}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Sim, Limpar e Recomeçar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
