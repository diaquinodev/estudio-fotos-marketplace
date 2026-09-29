import React from 'react';
import { X, Check, AlertTriangle, Lightbulb, Sun, Smartphone, Shirt } from 'lucide-react';

interface PhotoTipsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PhotoTipsModal({ isOpen, onClose }: PhotoTipsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Como Tirar a Foto Perfeita no Celular
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 mt-4 leading-relaxed">
          O resultado do seu catálogo com inteligência artificial depende diretamente da nitidez e do ângulo da foto original da peça.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {/* Certo */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wider">
              <Check className="w-4 h-4 text-emerald-600" />
              O Jeito Certo
            </div>
            <ul className="text-xs text-emerald-950 space-y-2">
              <li className="flex items-start gap-2">
                <Sun className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Luz Natural:</strong> Fotografe de frente para uma janela aberta durante o dia.</span>
              </li>
              <li className="flex items-start gap-2">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Celular Reto:</strong> Na altura do peito, na vertical, sem inclinar para baixo.</span>
              </li>
              <li className="flex items-start gap-2">
                <Shirt className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Peça Alinhada:</strong> Em um cabide simples ou esticada reta em fundo claro.</span>
              </li>
            </ul>
          </div>

          {/* Errado */}
          <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Evite Fazer
            </div>
            <ul className="text-xs text-rose-950 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold shrink-0">✕</span>
                <span><strong>Luz Amarelada / Flash:</strong> Altera a cor real do tecido.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold shrink-0">✕</span>
                <span><strong>Ângulo de Cima:</strong> Deforma a proporção da calça ou vestido.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold shrink-0">✕</span>
                <span><strong>Fundo Bagunçado:</strong> Use sempre parede branca, lisa ou fundo neutro.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
          >
            Entendi, voltar para o envio
          </button>
        </div>
      </div>
    </div>
  );
}
