import React, { useState } from 'react';
import { 
  ArrowLeft, Sparkles, Layers, UserCheck, 
  ChevronDown, ChevronUp, Palette, Sun, Check
} from 'lucide-react';
import type { 
  ModelIdentity, 
  EnvironmentConfig, 
  FabricSpec, 
  GarmentSpec, 
  ImageQuantity, 
  PresentationMode 
} from '@/types';

interface Step2StylingConfigProps {
  referenceImages: { front: string | null; back: string | null };
  presentationMode: PresentationMode;
  modelConfig: ModelIdentity;
  onSetModelConfig: React.Dispatch<React.SetStateAction<ModelIdentity>>;
  fabricConfig: FabricSpec;
  onSetFabricConfig: React.Dispatch<React.SetStateAction<FabricSpec>>;
  garmentConfig: GarmentSpec;
  onSetGarmentConfig: React.Dispatch<React.SetStateAction<GarmentSpec>>;
  envConfig: EnvironmentConfig;
  onSetEnvConfig: React.Dispatch<React.SetStateAction<EnvironmentConfig>>;
  imageQuantity: ImageQuantity;
  onSetImageQuantity: (qty: ImageQuantity) => void;
  additionalPrompt: string;
  onSetAdditionalPrompt: (val: string) => void;
  highFidelityJson: string;
  onSetHighFidelityJson: (val: string) => void;
  userCredits: number | null;
  onStartGeneration: () => void;
  onBackToStep1: () => void;
}

const ENV_OPTIONS: { label: string; description: string; category: string; sub_environment: string; editorial_treatment: string; icon: string }[] = [
  {
    label: 'Praia & Sol (Verão)',
    description: 'Areia clara, sol natural de alta moda e clima leve.',
    category: 'editorial_summer_beach',
    sub_environment: 'sunny_white_sand_beach',
    editorial_treatment: 'high_fashion_editorial_sunlight',
    icon: '🏖️'
  },
  {
    label: 'Bangalô Tropical (Resort Chic)',
    description: 'Madeira nobre, plantas tropicais e sombras suaves.',
    category: 'ambient_resort',
    sub_environment: 'luxury_tropical_bungalow',
    editorial_treatment: 'natural_organic_textures_and_shadows',
    icon: '🌴'
  },
  {
    label: 'Urbano & Cidade (Casual Elegante)',
    description: 'Arquitetura moderna sofisticada e luz do dia limpa.',
    category: 'urban_chic',
    sub_environment: 'sophisticated_city_architecture',
    editorial_treatment: 'clean_urban_daylight_tones',
    icon: '🏙️'
  },
  {
    label: 'Espaço Minimalista (Clean)',
    description: 'Paredes neutras, vasos discretos e luz difusa.',
    category: 'modern_pastel_decor',
    sub_environment: 'neutral_room_soft_pastel_walls_with_minimalist_frames_and_vases',
    editorial_treatment: 'soft_diffused_daylight_fashion',
    icon: '🏛️'
  },
  {
    label: 'Estúdio Branco (Marketplace)',
    description: 'Fundo infinito neutro comercial com iluminação de softbox.',
    category: 'commercial_ecommerce',
    sub_environment: 'professional_neutral_studio',
    editorial_treatment: 'high_fidelity_commercial_softbox',
    icon: '⚪'
  }
];

const BODY_OPTIONS: { id: ModelIdentity['bodyType']; label: string; subtitle: string }[] = [
  { id: 'slim', label: 'Magra', subtitle: 'Manequim 36 / 38' },
  { id: 'athletic', label: 'Atlética', subtitle: 'Manequim 38 / 40' },
  { id: 'curvy_light', label: 'Curvilínea', subtitle: 'Manequim 40 / 42' },
  { id: 'mid_size_44', label: 'Mid-Size 44', subtitle: 'Curvas Reais Brasileiras' }
];

const SKIN_OPTIONS: { id: ModelIdentity['skinTone']; label: string; colorHex: string }[] = [
  { id: 'light', label: 'Pele Clara', colorHex: '#FCE0D2' },
  { id: 'golden_tan', label: 'Morena Clara / Dourada', colorHex: '#E5A672' },
  { id: 'medium', label: 'Pele Morena', colorHex: '#B57448' },
  { id: 'dark', label: 'Pele Negra', colorHex: '#6F4125' },
  { id: 'deep_brown', label: 'Negra Retinta', colorHex: '#412211' }
];

const HAIR_COLOR_OPTIONS: { id: ModelIdentity['hairColor']; label: string }[] = [
  { id: 'illuminated_brunette', label: 'Morena Iluminada' },
  { id: 'brunette', label: 'Castanho Escuro' },
  { id: 'caramel', label: 'Castanho Caramelo' },
  { id: 'honey_blonde', label: 'Loiro Mel' },
  { id: 'blonde', label: 'Loiro Dourado' },
  { id: 'black', label: 'Preto Clássico' },
  { id: 'red', label: 'Ruivo Natural' }
];

const FABRIC_OPTIONS: { id: FabricSpec['material']; label: string; desc: string }[] = [
  { id: 'linen', label: 'Linho Nobre', desc: 'Textura refinada, caimento estruturado' },
  { id: 'viscose', label: 'Viscose Fluida', desc: 'Caimento leve, esvoaçante e macio' },
  { id: 'cotton', label: 'Algodão Pobre', desc: 'Respirável, encorpado e limpo' },
  { id: 'polyester', label: 'Tecido Plano / Alfaiataria', desc: 'Toque liso e caimento alinhado' },
  { id: 'denim', label: 'Jeans Autêntico', desc: 'Estruturado com costuras marcadas' },
  { id: 'knit', label: 'Tricô / Malha Nobre', desc: 'Textura canelada suave' }
];

const GARMENT_OPTIONS: { id: GarmentSpec['category']; label: string }[] = [
  { id: 'set', label: 'Conjunto (Top + Parte de Baixo)' },
  { id: 'dress', label: 'Vestido' },
  { id: 'shirt', label: 'Camisa / Blusa' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'pants', label: 'Calça' },
  { id: 'skirt', label: 'Saia' }
];

export function Step2StylingConfig({
  referenceImages,
  presentationMode,
  modelConfig,
  onSetModelConfig,
  fabricConfig,
  onSetFabricConfig,
  garmentConfig,
  onSetGarmentConfig,
  envConfig,
  onSetEnvConfig,
  imageQuantity,
  onSetImageQuantity,
  additionalPrompt,
  onSetAdditionalPrompt,
  highFidelityJson,
  onSetHighFidelityJson,
  userCredits,
  onStartGeneration,
  onBackToStep1,
}: Step2StylingConfigProps) {
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);

  const hasCredits = (userCredits ?? 0) > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Navigation & Garment Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <button
          type="button"
          onClick={onBackToStep1}
          className="inline-flex items-center gap-2 text-xs font-black text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar e trocar fotos da peça
        </button>

        {/* Garment Preview Thumbnail Badge */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2">
          <div className="flex -space-x-2">
            {referenceImages.front && (
              <img src={referenceImages.front} alt="Frente" className="w-8 h-8 rounded-lg object-cover border border-white shadow-sm" />
            )}
            {referenceImages.back && (
              <img src={referenceImages.back} alt="Costas" className="w-8 h-8 rounded-lg object-cover border border-white shadow-sm" />
            )}
          </div>
          <span className="text-xs font-bold text-slate-700">
            {presentationMode === 'model' ? 'Ensaio na Modelo' : presentationMode === 'still' ? 'Ensaio Manequim Still' : 'Ensaio de Kit'}
          </span>
        </div>
      </div>

      {/* 1. SELEÇÃO DA MODELO BRASILEIRA (Somente se presentationMode !== 'still') */}
      {presentationMode !== 'still' && (
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              1. Escolha a Modelo Brasileira
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">Biotipos e tons naturais</span>
          </div>

          {/* Biotipos */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 block">Biotipo / Manequim</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BODY_OPTIONS.map((opt) => {
                const isSelected = modelConfig.bodyType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSetModelConfig((prev) => ({ ...prev, bodyType: opt.id }))}
                    className={`p-4 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className={`text-xs font-black block ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {opt.label}
                    </span>
                    <span className={`text-[11px] mt-0.5 block ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {opt.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tom de Pele */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-700 block">Tom de Pele</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {SKIN_OPTIONS.map((skin) => {
                const isSelected = modelConfig.skinTone === skin.id;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => onSetModelConfig((prev) => ({ ...prev, skinTone: skin.id }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-50/50 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950 font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-inner"
                      style={{ backgroundColor: skin.colorHex }}
                    />
                    <span className="text-xs truncate">{skin.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cabelo */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-700 block">Cor e Efeito do Cabelo</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {HAIR_COLOR_OPTIONS.map((hair) => {
                const isSelected = modelConfig.hairColor === hair.id;
                return (
                  <button
                    key={hair.id}
                    type="button"
                    onClick={() => onSetModelConfig((prev) => ({ ...prev, hairColor: hair.id }))}
                    className={`px-3 py-2 rounded-xl text-xs text-left border transition-all truncate ${
                      isSelected
                        ? 'bg-slate-900 text-white font-bold border-slate-900'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {hair.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 2. ESCOLHA DO CENÁRIO EDITORIAL */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            2. Onde a foto será ambientada?
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">Iluminação e clima da foto</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          {ENV_OPTIONS.map((env) => {
            const isSelected = envConfig.category === env.category;
            return (
              <button
                key={env.category}
                type="button"
                onClick={() =>
                  onSetEnvConfig({
                    label: env.label,
                    category: env.category,
                    sub_environment: env.sub_environment,
                    editorial_treatment: env.editorial_treatment,
                  })
                }
                className={`p-5 rounded-2xl text-left border transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{env.icon}</span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-black block text-slate-900">{env.label}</span>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{env.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. TIPO DE PEÇA E TECIDO TÁTIL */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Palette className="w-4 h-4 text-indigo-600" />
          3. Tecido e Tipo da Peça
        </h3>

        {/* Categoria */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">Tipo da Peça</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {GARMENT_OPTIONS.map((cat) => {
              const isSelected = garmentConfig.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSetGarmentConfig((prev) => ({ ...prev, category: cat.id }))}
                  className={`p-3 rounded-xl text-xs font-bold text-left border transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tecido Tátil */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-slate-700 block">Tecido da Peça</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FABRIC_OPTIONS.map((fab) => {
              const isSelected = fabricConfig.material === fab.id;
              return (
                <button
                  key={fab.id}
                  type="button"
                  onClick={() => onSetFabricConfig((prev) => ({ ...prev, material: fab.id }))}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-black block text-slate-900">{fab.label}</span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">{fab.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Observações da Peça (Campo Humano) */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-slate-700 block">
            Observações Especiais da Peça (Opcional)
          </label>
          <textarea
            value={additionalPrompt}
            onChange={(e) => onSetAdditionalPrompt(e.target.value)}
            placeholder="Ex: Acompanha cinto de amarração na cintura, botões dourados frontais, manter textura bem aparente..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-900 outline-none focus:border-indigo-500 transition-colors h-24 resize-none"
          />
        </div>

        {/* Recolhível: Ficha Técnica Detalhada (Avançado) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvancedJson(!showAdvancedJson)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            {showAdvancedJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Ficha Técnica Avançada (JSON Opcional)
          </button>

          {showAdvancedJson && (
            <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-in fade-in">
              <span className="text-[11px] text-slate-500 block">
                Insira especificações técnicas em JSON caso precise travar regras muito específicas:
              </span>
              <textarea
                value={highFidelityJson}
                onChange={(e) => onSetHighFidelityJson(e.target.value)}
                placeholder='{ "gola": "alta", "bolsos": "funcionais" }'
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500 h-20 resize-none"
              />
            </div>
          )}
        </div>
      </section>

      {/* 4. QUANTIDADE DE FOTOS E BOTÃO DE DISPARO COM TRANSPARÊNCIA DE SALDO */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            4. Quantas Fotos Você Deseja Criar?
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Cada foto gerada consome 1 crédito da sua cota.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {[
            { qty: 1, title: '1 Foto (Teste)', desc: 'Capa principal frontal para teste rápido' },
            { qty: 3, title: '3 Fotos (Essencial)', desc: 'Frente, costas e detalhe de textura' },
            { qty: 10, title: '10 Fotos (Catálogo Completo)', desc: 'Todas as variações de ângulos, poses e lifestyle' },
          ].map((item) => {
            const isSelected = imageQuantity === item.qty;
            return (
              <button
                key={item.qty}
                type="button"
                onClick={() => onSetImageQuantity(item.qty as ImageQuantity)}
                className={`p-5 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {item.title}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className={`text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  {item.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Botão de Ação com Transparência de Créditos */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              Sua Cota Atual
            </span>
            <span className="text-sm font-black text-slate-900">
              {userCredits !== null ? userCredits : '...'} créditos disponíveis
            </span>
          </div>

          {hasCredits ? (
            <button
              type="button"
              onClick={onStartGeneration}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>
                Gerar {imageQuantity} {imageQuantity === 1 ? 'foto' : 'fotos'} • 1 crédito cada
              </span>
            </button>
          ) : (
            <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 max-w-xs">
              Sua cota de créditos acabou. Solicite mais créditos ao administrador.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
