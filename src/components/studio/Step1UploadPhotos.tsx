import React from 'react';
import { Upload, Loader2, RefreshCw, User, Box, LayoutGrid, Lightbulb, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { PresentationMode, KitConfig } from '@/types';

interface Step1UploadPhotosProps {
  referenceImages: { front: string | null; back: string | null };
  presentationMode: PresentationMode;
  onSetPresentationMode: (mode: PresentationMode) => void;
  kitConfig: KitConfig;
  onSetKitConfig: React.Dispatch<React.SetStateAction<KitConfig>>;
  processingSlots: Record<string, boolean>;
  onFileUpload: (side: 'front' | 'back' | number) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  frontInputRef: React.RefObject<HTMLInputElement | null>;
  backInputRef: React.RefObject<HTMLInputElement | null>;
  variationInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onAdvanceToStep2: () => void;
  onOpenTipsModal: () => void;
}

export function Step1UploadPhotos({
  referenceImages,
  presentationMode,
  onSetPresentationMode,
  kitConfig,
  onSetKitConfig,
  processingSlots,
  onFileUpload,
  frontInputRef,
  backInputRef,
  variationInputRefs,
  onAdvanceToStep2,
  onOpenTipsModal,
}: Step1UploadPhotosProps) {
  const hasFront = Boolean(referenceImages.front);
  const isReady = hasFront;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header with Title & Tips CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">1. Envie as Fotos da Sua Peça</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Tire uma foto reta com o celular da frente e das costas da roupa.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenTipsModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-2xl text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Como tirar a foto com o celular?
        </button>
      </div>

      {/* Main Upload Cards (Front & Back) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
          Fotos da Peça Real
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* FRENTE */}
          {(['front', 'back'] as const).map((side) => {
            const isSlotProcessing = Boolean(processingSlots[side]);
            const currentImg = referenceImages[side];
            const isFront = side === 'front';

            return (
              <div key={side} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    {isFront ? 'Foto da Frente (Obrigatória)' : 'Foto das Costas (Recomendada)'}
                  </label>
                  {currentImg && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Carregada
                    </span>
                  )}
                </div>

                <div
                  onClick={() => {
                    if (!isSlotProcessing) {
                      (isFront ? frontInputRef : backInputRef).current?.click();
                    }
                  }}
                  className={`aspect-square sm:aspect-4/3 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 transition-all overflow-hidden relative ${
                    isSlotProcessing
                      ? 'border-indigo-400 bg-indigo-50/60 cursor-wait'
                      : currentImg
                      ? 'border-slate-200 bg-slate-50 cursor-pointer hover:border-indigo-400 group'
                      : isFront
                      ? 'border-indigo-300 bg-indigo-50/20 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/40'
                      : 'border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-400'
                  }`}
                >
                  {isSlotProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                      <span className="text-xs font-bold text-indigo-700 animate-pulse">
                        Otimizando e preparando imagem...
                      </span>
                    </div>
                  ) : currentImg ? (
                    <>
                      <img
                        src={currentImg}
                        alt={isFront ? 'Frente da Peça' : 'Costas da Peça'}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <RefreshCw className="w-4 h-4" /> Trocar Foto
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-center p-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isFront ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          {isFront ? 'Clique para enviar a Frente' : 'Clique para enviar as Costas'}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          JPG, PNG ou WebP (máx. 1600px)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <input
            type="file"
            ref={frontInputRef}
            accept="image/jpeg, image/png, image/webp"
            onChange={onFileUpload('front')}
            className="hidden"
            disabled={Boolean(processingSlots['front'])}
          />
          <input
            type="file"
            ref={backInputRef}
            accept="image/jpeg, image/png, image/webp"
            onChange={onFileUpload('back')}
            className="hidden"
            disabled={Boolean(processingSlots['back'])}
          />
        </div>
      </div>

      {/* Presentation Mode Selection (Model, Still, Kit) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
          Como você quer apresentar sua peça?
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onSetPresentationMode('model')}
            className={`p-5 rounded-2xl text-left border transition-all flex flex-col justify-between gap-3 ${
              presentationMode === 'model'
                ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-indigo-600 shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black block uppercase tracking-wider">Na Modelo Real</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Veste a peça em modelos brasileiras em poses profissionais e realistas.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSetPresentationMode('still')}
            className={`p-5 rounded-2xl text-left border transition-all flex flex-col justify-between gap-3 ${
              presentationMode === 'still'
                ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-indigo-600 shadow-sm">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black block uppercase tracking-wider">No Manequim (Still)</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Apresentação 3D invisível / fundo limpo neutro para catálogo de produto.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSetPresentationMode('kit')}
            className={`p-5 rounded-2xl text-left border transition-all flex flex-col justify-between gap-3 ${
              presentationMode === 'kit'
                ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-indigo-600 shadow-sm">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black block uppercase tracking-wider">Kit / Várias Cores</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Várias modelos juntas vestindo as diferentes cores do mesmo modelo.
              </p>
            </div>
          </button>
        </div>

        {/* Kit Specific Configurations */}
        {presentationMode === 'kit' && (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Quantas cores tem o seu kit?</span>
              <div className="flex gap-2">
                {([2, 3, 4] as const).map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => onSetKitConfig((prev) => ({ ...prev, quantity: qty }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      kitConfig.quantity === qty
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {qty} Cores
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {Array.from({ length: kitConfig.quantity }).map((_, idx) => {
                const isSlotProcessing = Boolean(processingSlots[`kit-${idx}`]);
                const variation = kitConfig.variations[idx];

                return (
                  <div key={idx} className="space-y-2">
                    <div
                      onClick={() => {
                        if (!isSlotProcessing) {
                          variationInputRefs.current[idx]?.click();
                        }
                      }}
                      className={`aspect-square border border-dashed rounded-xl flex flex-col items-center justify-center p-2 text-center transition-all relative overflow-hidden ${
                        isSlotProcessing
                          ? 'border-indigo-400 bg-indigo-50/60 cursor-wait'
                          : variation?.url
                          ? 'border-slate-200 bg-slate-50 cursor-pointer hover:border-indigo-400 group'
                          : 'border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-400'
                      }`}
                    >
                      {isSlotProcessing ? (
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      ) : variation?.url ? (
                        <>
                          <img src={variation.url} alt={variation.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <RefreshCw className="w-4 h-4" />
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-slate-400" />
                          <span className="text-[10px] text-slate-500 font-bold mt-1">Amostra {idx + 1}</span>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={(el) => {
                        variationInputRefs.current[idx] = el;
                      }}
                      accept="image/jpeg, image/png, image/webp"
                      onChange={onFileUpload(idx)}
                      className="hidden"
                      disabled={isSlotProcessing}
                    />
                    <input
                      type="text"
                      value={variation?.label || `Cor ${idx + 1}`}
                      onChange={(e) => {
                        const newVars = [...kitConfig.variations];
                        newVars[idx] = { ...newVars[idx], label: e.target.value };
                        onSetKitConfig((prev) => ({ ...prev, variations: newVars }));
                      }}
                      placeholder={`Nome da Cor ${idx + 1}`}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-center font-bold text-slate-700 outline-none focus:border-indigo-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer Button */}
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onAdvanceToStep2}
          disabled={!isReady}
          className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-lg ${
            isReady
              ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          <span>Avançar para Estilo do Ensaio</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
