import { createClient } from '@supabase/supabase-js';

// Vite uses import.meta.env, NOT process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// This prevents the "Uncaught Error" white screen
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase keys are missing! Check your .env.local file.");
}

// We use an empty string fallback so the app still 'runs' (renders the UI) 
// instead of crashing completely.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);