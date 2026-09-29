import React from 'react';
import { Zap } from 'lucide-react';

interface TopbarProps {
  credits: number | null;
}

export function Topbar({ credits }: TopbarProps) {
  return (
    <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-40">
      <div>
        <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Estúdio Fotográfico Digital</h2>
        <p className="text-xs text-slate-500 font-medium hidden sm:block">
          Gere fotos de produto para marketplaces a partir da foto real da peça.
        </p>
      </div>

      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5">
        <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
        <span className="font-bold text-slate-700 text-xs sm:text-sm">
          {credits !== null ? credits : '...'}{' '}
          <span className="text-slate-400 font-medium text-xs hidden sm:inline">créditos na cota</span>
        </span>
      </div>
    </header>
  );
}
