// api/lib/supabase.js
// Cliente Supabase para Vercel Serverless Functions (Node.js puro, sin Next.js).
// Usa el service role key para bypasear RLS desde el servidor.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,  // service_role — solo en servidor, nunca en frontend
);

export default supabase;
