import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { APP_NAME, COMPANY_NAME, CONTACT_EMAIL } from '@/config/brand';

export const metadata = {
  title: `Aviso de Privacidade — ${APP_NAME}`,
  description: 'Aviso de privacidade da ferramenta interna de geração de fotos de produto.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-inter">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </Link>
          <span className="font-black text-slate-900 text-sm tracking-tight">{APP_NAME}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Aviso de Privacidade</h1>
        <p className="text-xs text-slate-500">
          Modelo de exemplo para uma ferramenta interna. Revise com o responsável jurídico da sua empresa antes de usar em produção.
        </p>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 space-y-6 text-sm leading-relaxed text-slate-600">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Uso da ferramenta</h2>
            <p>
              Esta é uma ferramenta interna de {COMPANY_NAME} (marca fictícia de exemplo) para gerar fotos de produto para marketplaces.
              O acesso é restrito a usuários autorizados pela empresa.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Dados tratados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>E-mail e credenciais de acesso (gerenciados pelo Supabase Auth; ou conta Google, se o login social estiver habilitado).</li>
              <li>Fotos de referência das peças enviadas e imagens geradas, associadas ao usuário que as criou.</li>
              <li>Parâmetros de cada geração (tipo de tomada, cenário, instruções) e o saldo de créditos da cota.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Operadores</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase:</strong> autenticação, banco de dados e armazenamento das imagens.</li>
              <li><strong>Google (Gemini API):</strong> recebe as fotos de referência e o prompt para gerar as imagens.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Contato</h2>
            <p>
              Dúvidas ou pedidos sobre dados pessoais:{' '}
              <span className="font-mono text-indigo-600 font-bold">{CONTACT_EMAIL}</span> (endereço de exemplo).
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
