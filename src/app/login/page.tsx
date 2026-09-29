import Link from 'next/link'
import { login, signup, signInWithGoogle } from './actions'
import { APP_NAME } from '@/config/brand'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const rawError = params?.error;
  const rawMessage = params?.message;

  const error = rawError ? decodeURIComponent(rawError) : null;
  const message = rawMessage === 'check_email'
    ? 'Cadastro realizado com sucesso! Por favor, verifique sua caixa de e-mail para confirmar o cadastro.'
    : rawMessage ? decodeURIComponent(rawMessage) : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-inter">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-slate-500 mt-2">Faça login para acessar o estúdio.</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold text-center leading-relaxed">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold text-center leading-relaxed">
            {message}
          </div>
        )}

        <form className="space-y-6">
          {/* Google Button */}
          <button 
            formAction={signInWithGoogle}
            className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-3 shadow-sm cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com o Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500 text-[10px] uppercase tracking-widest font-bold">ou use seu e-mail</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Email</label>
              <input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="seu@email.com"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Senha</label>
              <input 
                id="password" 
                name="password" 
                type="password"
                placeholder="••••••••"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button 
              formAction={login}
              className="flex-1 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:-translate-y-0.5 transition-transform shadow-lg shadow-blue-500/30 cursor-pointer"
            >
              Entrar
            </button>
            <button 
              formAction={signup}
              className="flex-1 py-3.5 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:border-slate-300 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cadastrar
            </button>
          </div>
        </form>

        {/* Footer Legal Links */}
        <div className="mt-8 text-center text-xs text-slate-400 space-x-3 border-t border-slate-100 pt-6">
          <Link href="/privacy" className="hover:text-slate-600 transition-colors underline">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  )
}
