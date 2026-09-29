import React, { useState } from 'react';
import { 
  ArrowLeft, Download, RefreshCw, Edit3, CheckCircle2, 
  Loader2, AlertCircle, Eye, Sparkles, X, Palette
} from 'lucide-react';
import { GenerationStep, type GeneratedImage } from '@/types';

interface Step3CatalogGalleryProps {
  step: GenerationStep;
  progressStatus: string;
  generatedImages: GeneratedImage[];
  onBackToStep2: () => void;
  onDownloadSingle: (img: GeneratedImage) => void;
  onDownloadAll: () => void;
  onRegenerateSingle: (idx: number) => void;
  onApplyEdit: (index: number, instruction: string) => Promise<void>;
  onResetSession: () => void;
}

export function Step3CatalogGallery({
  step,
  progressStatus,
  generatedImages,
  onBackToStep2,
  onDownloadSingle,
  onDownloadAll,
  onRegenerateSingle,
  onApplyEdit,
  onResetSession,
}: Step3CatalogGalleryProps) {
  const [zoomImage, setZoomImage] = useState<GeneratedImage | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const approvedImages = generatedImages.filter((img) => img.status === 'approved' && img.url);
  const isGenerating = step === GenerationStep.GENERATING;

  const handleOpenEdit = (idx: number) => {
    setEditingIndex(idx);
    setEditInstruction('');
  };

  const handleConfirmEdit = async () => {
    if (editingIndex === null || !editInstruction.trim()) return;
    try {
      setIsSubmittingEdit(true);
      await onApplyEdit(editingIndex, editInstruction.trim());
      setEditingIndex(null);
      setEditInstruction('');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <button
          type="button"
          onClick={onBackToStep2}
          className="inline-flex items-center gap-2 text-xs font-black text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Ajustar estilo ou configurações
        </button>

        <div className="flex items-center gap-3">
          {approvedImages.length > 0 && (
            <button
              type="button"
              onClick={onDownloadAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Baixar Todas ({approvedImages.length})
            </button>
          )}

          <button
            type="button"
            onClick={onResetSession}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-transparent hover:border-rose-100"
          >
            Novo Ensaio
          </button>
        </div>
      </div>

      {/* Live Generation Progress Banner */}
      {isGenerating && (
        <div className="bg-indigo-50 border border-indigo-200/80 rounded-3xl p-6 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-black text-indigo-950 uppercase tracking-wider block">
                Criando Seu Catálogo Comercial...
              </span>
              <p className="text-xs text-indigo-700 font-medium truncate mt-0.5">
                {progressStatus || 'Processando renderização em alta definição...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Photos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {generatedImages.map((img, idx) => {
          const isApproved = img.status === 'approved' && img.url;
          const isProcessing = img.status === 'processing';
          const isFailed = img.status === 'failed';

          return (
            <div
              key={img.id || idx}
              className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between transition-all hover:shadow-md group"
            >
              {/* Image Container */}
              <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <span className="text-xs font-bold text-slate-600 animate-pulse">
                      Fotografando e renderizando...
                    </span>
                  </div>
                ) : isFailed ? (
                  <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-rose-600">
                    <AlertCircle className="w-8 h-8" />
                    <span className="text-xs font-bold">Falha ao criar esta foto</span>
                    <button
                      type="button"
                      onClick={() => onRegenerateSingle(idx)}
                      className="mt-2 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                ) : isApproved ? (
                  <>
                    <img
                      src={img.url}
                      alt={img.type}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Hover Floating Actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                      <button
                        type="button"
                        onClick={() => setZoomImage(img)}
                        className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 active:scale-95 transition-transform shadow-lg cursor-pointer"
                        title="Ver em Tela Cheia"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadSingle(img)}
                        className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 active:scale-95 transition-transform shadow-lg cursor-pointer"
                        title="Baixar Foto"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(idx)}
                        className="p-3 bg-indigo-600 text-white rounded-full hover:scale-110 active:scale-95 transition-transform shadow-lg cursor-pointer"
                        title="Pedir Retoque"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRegenerateSingle(idx)}
                        className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 active:scale-95 transition-transform shadow-lg cursor-pointer"
                        title="Regerar Foto"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Card Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white">
                <div>
                  <span className="text-xs font-black text-slate-900 block truncate max-w-[200px]">
                    {img.type}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">1200 x 1200 px • 1:1 HD</span>
                </div>

                {isApproved && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pronta
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Fullscreen Zoom Preview */}
      {zoomImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black text-white rounded-full transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="aspect-square w-full">
              <img src={zoomImage.url} alt={zoomImage.type} className="w-full h-full object-contain" />
            </div>
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-white">
              <span className="text-xs font-bold">{zoomImage.type}</span>
              <button
                type="button"
                onClick={() => onDownloadSingle(zoomImage)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" /> Baixar Foto em Alta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Retoque Rápido na Foto (Substitui Inpainting) */}
      {editingIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <Palette className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">Pedir Retoque na Foto</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Descreva o ajuste que você quer fazer mantendo a roupa exatamente igual:
            </p>

            {/* Sugestões Rápidas de 1 Clique */}
            <div className="flex flex-wrap gap-2">
              {[
                'Clarear iluminação do rosto',
                'Suavizar pequenas dobras',
                'Mudar luz para fim de tarde',
                'Remover sombras fortes',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setEditInstruction(suggestion)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + {suggestion}
                </button>
              ))}
            </div>

            <textarea
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              placeholder="Ex: 'Deixar o fundo levemente mais desfocado', 'Ajustar o cabelo da modelo para trás'..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-900 outline-none focus:border-indigo-500 h-28 resize-none"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                disabled={isSubmittingEdit || !editInstruction.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                <span>{isSubmittingEdit ? 'Aplicando Retoque...' : 'Aplicar Retoque'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
