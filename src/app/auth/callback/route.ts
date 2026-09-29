import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Resolve base URL para redirecionamento compatível com Vercel e proxies
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const redirectBase = (isLocalEnv || !forwardedHost)
    ? origin
    : `${forwardedProto}://${forwardedHost}`

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`)
    }

    console.error('[AUTH DEBUG] Error exchanging code for session:', error.message, error)
    return NextResponse.redirect(`${redirectBase}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(
    `${redirectBase}/login?error=${encodeURIComponent('Código de autorização não encontrado.')}`
  )
}
