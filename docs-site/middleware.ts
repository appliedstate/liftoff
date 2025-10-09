import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Basic Auth fallback (optional)
  if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS) {
    const basicAuth = request.headers.get('authorization')
    const url = request.nextUrl

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1]
      const [user, pwd] = atob(authValue).split(':')

      if (user === process.env.BASIC_AUTH_USER && pwd === process.env.BASIC_AUTH_PASS) {
        return response
      }
    }

    url.pathname = '/api/basic-auth'
    return NextResponse.rewrite(url)
  }

  // Supabase Auth
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Allow unauthenticated access to login and static files
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/_next') &&
    !request.nextUrl.pathname.startsWith('/api/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Check email whitelist/domain if authenticated
  if (user) {
    const allowedEmails = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim()) || []
    const allowedDomain = process.env.ALLOWED_DOMAIN

    const isAllowed =
      allowedEmails.includes(user.email || '') ||
      (allowedDomain && user.email?.endsWith(`@${allowedDomain}`))

    if (!isAllowed && allowedEmails.length > 0) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

