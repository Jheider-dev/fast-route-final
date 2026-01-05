import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// En lugar de lanzar un error que rompe el compilador, 
// validamos preventivamente o enviamos un warning.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Advertencia: Faltan variables de entorno de Supabase.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);