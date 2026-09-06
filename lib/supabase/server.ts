import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookies can be read but not set
          }
        },
      },
    }
  )
}

// Cookieless anon client for PUBLIC reads in Server Components. The auth client
// above calls cookies(), which opts a route out of static generation and
// silently disables `export const revalidate` (the page renders dynamically on
// every request, uncached). Public pages that read only published data should use
// this client instead so `revalidate` takes effect and the CDN can cache them.
// Anon key + RLS — same access level an unauthenticated visitor already has.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
