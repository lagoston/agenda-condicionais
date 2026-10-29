import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "./config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true },
});
