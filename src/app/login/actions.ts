'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('Por favor, informe e-mail e senha.')}`)
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('Falha no login (código: %s)', error.code ?? 'desconhecido')
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('Por favor, informe e-mail e senha para cadastro.')}`)
  }

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    console.error('Falha no cadastro (código: %s)', error.code ?? 'desconhecido')
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')

  // Se a confirmação de e-mail estiver desativada no Supabase, a sessão é retornada imediatamente
  if (data?.session) {
    redirect('/')
  } else {
    // Caso contrário, informa o usuário para checar a caixa de entrada
    redirect(`/login?message=check_email`)
  }
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host')
  const proto = headersList.get('x-forwarded-proto') || 'https'
  const origin = `${proto}://${host}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error('Falha no login com Google (código: %s)', error.code ?? 'desconhecido')
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data?.url) {
    redirect(data.url)
  }
}
