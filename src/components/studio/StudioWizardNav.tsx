import React from 'react';
import { Camera, Sparkles, Images, CheckCircle2, ChevronRight } from 'lucide-react';
import type { WizardStep } from '@/types';

interface StudioWizardNavProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
  canNavigateToStep2: boolean;
  canNavigateToStep3: boolean;
}

export function StudioWizardNav({
  currentStep,
  onStepClick,
  canNavigateToStep2,
  canNavigateToStep3,
}: StudioWizardNavProps) {
  const steps: { number: WizardStep; title: string; subtitle: string; icon: React.ReactNode; canAccess: boolean }[] = [
    {
      number: 1,
      title: '1. Suas Fotos',
      subtitle: 'Envie as fotos da peça',
      icon: <Camera className="w-4 h-4" />,
      canAccess: true,
    },
    {
      number: 2,
      title: '2. Estilo do Ensaio',
      subtitle: 'Modelo, cenário e tecido',
      icon: <Sparkles className="w-4 h-4" />,
      canAccess: canNavigateToStep2,
    },
    {
      number: 3,
      title: '3. Seu Catálogo',
      subtitle: 'Fotos prontas em alta resolução',
      icon: <Images className="w-4 h-4" />,
      canAccess: canNavigateToStep3,
    },
  ];

  return (
    <nav className="w-full bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm mb-8" aria-label="Etapas do Ensaio">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((step, index) => {
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;
          const isClickable = step.canAccess && !isActive;

          return (
            <button
              key={step.number}
              type="button"
              onClick={() => isClickable && onStepClick(step.number)}
              disabled={!step.canAccess}
              className={`flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200 relative ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                  : isCompleted
                  ? 'bg-emerald-50 text-emerald-950 border border-emerald-200/70 hover:bg-emerald-100/60 cursor-pointer'
                  : step.canAccess
                  ? 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 cursor-pointer'
                  : 'bg-slate-50/50 text-slate-400 border border-slate-100 cursor-not-allowed opacity-60'
              }`}
            >
              {/* Step indicator circle */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black transition-colors ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : isCompleted
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
              </div>

              {/* Text metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <ChevronRight className={`w-3.5 h-3.5 hidden md:block shrink-0 ${isActive ? 'text-slate-400' : 'text-slate-300'}`} />
                  )}
                </div>
                <p className={`text-[11px] truncate ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                  {step.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
