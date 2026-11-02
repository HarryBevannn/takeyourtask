import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

// Placeholder values keep the build working before .env.local exists;
// pages show a setup notice instead of calling Supabase in that case.
export const supabase = createClient(url || "http://localhost:54321", key || "not-configured");
