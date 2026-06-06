import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const fallbackUrl = "https://example.supabase.co";
const fallbackKey = "missing-supabase-key";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseAdminConfigured = Boolean(
  supabaseUrl && supabaseServiceKey,
);

export const supabase = createClient(
  supabaseUrl ?? fallbackUrl,
  supabaseAnonKey ?? fallbackKey,
);

export const supabaseAdmin = createClient(
  supabaseUrl ?? fallbackUrl,
  supabaseServiceKey ?? fallbackKey,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
