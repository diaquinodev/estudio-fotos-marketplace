import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { User, Zap } from 'lucide-react';
import { CONTACT_EMAIL } from '@/config/brand';

export const metadata = {
  title: 'Conta e Cota',
  description: 'Informações da conta e da cota de créditos de geração.',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, email')
    .eq('id', user.id)
    .maybeSingle();

  const credits = profile?.credits ?? 0;
  const email = user.email ?? profile?.email ?? '—';

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 ml-64 flex flex-col">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Conta e Cota</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              A cota de créditos é definida por um administrador.
            </p>
          </div>
        </header>

        <div className="flex-1 p-8 space-y-6 max-w-3xl w-full">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
              <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <User className="w-4 h-4 text-amber-500" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">Conta &amp; Cota</h2>
                <p className="text-xs text-slate-500">Informações da sua conta e créditos de geração.</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">E-mail da Conta</p>
                  <p className="text-sm font-semibold text-slate-900">{email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 py-3">
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Créditos disponíveis</p>
                  <p className="text-sm font-bold text-slate-900">
                    {credits}{' '}
                    <span className="font-medium text-slate-500">
                      {credits === 1 ? 'crédito' : 'créditos'} (1 crédito = 1 imagem gerada)
                    </span>
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Para aumentar a cota, fale com o administrador ({CONTACT_EMAIL}).
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
