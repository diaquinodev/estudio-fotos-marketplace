'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  Maximize2, 
  X, 
  Calendar, 
  Filter, 
  ArrowRight,
  Search,
  Tag,
  RefreshCw
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { createClient } from '@/utils/supabase/client';
import { SHOT_TYPES } from '@/types';

interface GalleryItem {
  id: string;
  url: string;
  type: string;
  label: string;
  created_at: string;
  instruction?: string;
}

interface GenerationRow {
  id: string;
  kind: 'generate' | 'edit';
  shot_type: string | null;
  prompt: string | null;
  storage_path: string;
  created_at: string;
}

const BADGE_STYLES = [
  { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
  { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
];

const NEUTRAL_BADGE = { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700' };

/** Rótulo e cor por tipo de tomada (ids de SHOT_TYPES) + retoque. */
const SHOT_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  ...Object.fromEntries(
    SHOT_TYPES.map((shot, idx) => [
      shot.id,
      { label: shot.label.replace(/^\d+\.\s*/, ''), ...BADGE_STYLES[idx % BADGE_STYLES.length] },
    ]),
  ),
  edit: { label: 'Retoque', ...NEUTRAL_BADGE },
  custom: { label: 'Personalizada', ...NEUTRAL_BADGE },
};

const FILTERS = [
  { id: 'all', label: 'Todas as fotos' },
  ...SHOT_TYPES.slice(0, 4).map((shot) => ({ id: shot.id, label: SHOT_BADGES[shot.id].label })),
  { id: 'edit', label: 'Retoques' },
];

const SIGNED_URL_TTL_SECONDS = 3600;

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeLightbox, setActiveLightbox] = useState<GalleryItem | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchGalleryItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setItems([]);
        return;
      }

      const { data: rows, error } = await supabase
        .from('generations')
        .select('id, kind, shot_type, prompt, storage_path, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200)
        .returns<GenerationRow[]>();
      if (error) throw new Error(error.message);

      const generations = rows ?? [];
      const { data: signed, error: signError } = await supabase.storage
        .from('generations')
        .createSignedUrls(
          generations.map((row) => row.storage_path),
          SIGNED_URL_TTL_SECONDS,
        );
      if (signError) throw new Error(signError.message);

      const urlByPath = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]));
      setItems(
        generations.flatMap((row) => {
          const url = urlByPath.get(row.storage_path);
          if (!url) return [];
          const type = row.shot_type ?? 'custom';
          return [
            {
              id: row.id,
              url,
              type,
              label: SHOT_BADGES[type]?.label ?? 'Foto gerada',
              created_at: new Date(row.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
              instruction: row.prompt ?? undefined,
            },
          ];
        }),
      );
    } catch (err) {
      console.error('Erro ao carregar galeria:', err instanceof Error ? err.message : err);
      setLoadError('Não foi possível carregar a galeria. Tente atualizar em instantes.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial dos dados da galeria
    void fetchGalleryItems();
  }, [fetchGalleryItems]);

  const handleDownload = async (item: GalleryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `estudio-${item.type}-${item.id.slice(0, 6)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(item.url, '_blank');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesFilter = selectedFilter === 'all' || item.type === selectedFilter;
    const matchesSearch = searchQuery === '' || 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Minha Galeria</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
                {items.length} {items.length === 1 ? 'foto' : 'fotos'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Fotos geradas e retoques salvos na sua conta.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchGalleryItems}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              title="Atualizar galeria"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Novo Ensaio</span>
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-8 space-y-6 max-w-7xl w-full">
          
          {/* Controls Bar: Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <Filter className="w-4 h-4 text-slate-400 shrink-0 ml-1 mr-1" />
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedFilter === f.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar foto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-slate-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {loadError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl px-5 py-3">{loadError}</div>
          )}

          {/* Empty State */}
          {!loading && filteredItems.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-12 shadow-sm space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto">
                <ImageIcon className="w-8 h-8 text-indigo-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {searchQuery || selectedFilter !== 'all' ? 'Nenhuma foto encontrada' : 'Nenhum ensaio gerado ainda'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  {searchQuery || selectedFilter !== 'all'
                    ? 'Tente ajustar os filtros de busca para encontrar o que procura.'
                    : 'As fotos geradas no estúdio ficam salvas aqui.'
                  }
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/10"
              >
                <Sparkles className="w-4 h-4" />
                <span>Criar Primeiro Ensaio</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Gallery Grid */}
          {!loading && filteredItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredItems.map(item => {
                const badge = SHOT_BADGES[item.type] || {
                  label: item.label,
                  bg: 'bg-slate-100 border-slate-200',
                  text: 'text-slate-700'
                };

                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveLightbox(item)}
                    className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col"
                  >
                    {/* Image Container */}
                    <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                      <img
                        src={item.url}
                        alt={badge.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 p-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLightbox(item);
                          }}
                          className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center hover:bg-white hover:scale-110 transition-all shadow-lg"
                          title="Ampliar visualização"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDownload(item, e)}
                          className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 hover:scale-110 transition-all shadow-lg"
                          title="Baixar imagem em alta resolução"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Badge Floating */}
                      <div className="absolute top-3 left-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border backdrop-blur-md shadow-xs ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="p-4 flex items-center justify-between border-t border-slate-100 bg-white">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{item.created_at}</span>
                      </div>

                      <button
                        onClick={(e) => handleDownload(item, e)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Baixar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {/* Lightbox Modal */}
      {activeLightbox && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setActiveLightbox(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Image */}
            <div className="flex-1 bg-slate-900 flex items-center justify-center relative min-h-[300px] md:min-h-[500px]">
              <img
                src={activeLightbox.url}
                alt={activeLightbox.label}
                className="max-h-[80vh] w-auto object-contain"
              />
            </div>

            {/* Details Panel */}
            <div className="w-full md:w-80 p-6 flex flex-col justify-between bg-white border-t md:border-t-0 md:border-l border-slate-200">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Detalhes da Foto</span>
                  <button
                    onClick={() => setActiveLightbox(null)}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-500" />
                    <span className="font-bold text-sm text-slate-900">{activeLightbox.label}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Gerada em {activeLightbox.created_at}</span>
                  </div>

                  {activeLightbox.instruction && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Instrução Editorial</span>
                      <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed font-mono">
                        {activeLightbox.instruction}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-3">
                <button
                  onClick={() => handleDownload(activeLightbox)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Imagem em Alta Definição</span>
                </button>
                <p className="text-[10px] text-center text-slate-400">
                  Arquivo original salvo no Storage
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
