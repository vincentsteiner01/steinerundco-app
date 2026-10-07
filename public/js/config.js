// Öffentliche Angaben, die im Browser stehen dürfen.
// Der Publishable Key ist nur zusammen mit den Zugriffsregeln (RLS) sicher.
// Der service_role-Schlüssel und der Anthropic-Schlüssel gehören NIE hierher.
export const SUPABASE_URL = 'https://ekaqkfgvisdngsskzbai.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_m_GF3cePpZgLGP9FH6Cc5Q_Zz6TJCTy';

export const BUCKET = 'akten';
export const SIGNED_URL_SECONDS = 120;          // Laufzeit der Links zu Dateien
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // muss zum Limit des Buckets passen
