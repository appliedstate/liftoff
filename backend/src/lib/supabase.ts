import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// If Supabase env isn't configured, export a minimal shim so non-auth flows (e.g., token-based ingest) still work.
export const supabase: any = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : {
      auth: {
        async getUser() {
          return { data: { user: null }, error: { message: 'Supabase disabled (no env configured)' } }
        },
      },
    }