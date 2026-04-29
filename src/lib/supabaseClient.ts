import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wpzfbpvtxrfyejoqjecu.supabase.co';
// Usar una clave dummy temporal para evitar fallos de build en Vercel durante el pre-rendering si la variable aún no existe.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key-to-allow-build-to-pass-until-configured';

export const supabase = createClient(supabaseUrl, supabaseKey);
