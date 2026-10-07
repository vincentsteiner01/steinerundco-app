// Alle Zugriffe auf Supabase an einer Stelle.
import { SUPABASE_URL, SUPABASE_KEY, BUCKET, SIGNED_URL_SECONDS } from './config.js';

// Die Rücksprungadresse des Magic Links merken, bevor supabase-js sie aus der Adresszeile entfernt.
export const initialHash = location.hash;

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // implicit: Der Link funktioniert auch, wenn ihn die Mail-App in einem anderen Browser öffnet.
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------------------- Anmeldung

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function requestLogin(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // nur eingeladene Konten
      emailRedirectTo: location.origin + location.pathname,
    },
  });
  if (error) throw error;
}

export async function verifyCode(email, token) {
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function logout() {
  await sb.auth.signOut();
  masterData = null;
}

// ---------------------------------------------------------------- Stammdaten

let masterData = null;

// Kategorien, Unterkategorien und Mitglieder einmal laden und im Speicher halten.
export async function loadMasterData() {
  if (masterData) return masterData;
  const [categories, subcategories, members] = await Promise.all([
    sb.from('categories').select('slug,label,color,for_documents,sort_order').order('sort_order'),
    sb.from('subcategories').select('category,label,sort_order').order('sort_order'),
    sb.from('members').select('user_id,display_name,email'),
  ]);
  for (const result of [categories, subcategories, members]) {
    if (result.error) throw result.error;
  }
  masterData = {
    categories: categories.data,
    subcategories: subcategories.data,
    members: members.data,
  };
  return masterData;
}

// ---------------------------------------------------------------- Dokumente

const LIST_FIELDS = 'id,title,category,subcategory,sender,document_date,amount,currency,'
  + 'cost_interval,due_date,flagged,status,file_type,file_path,owner,created_at,deleted_at';

export async function listDocuments({ trash = false } = {}) {
  let query = sb.from('documents').select(LIST_FIELDS);
  query = trash
    ? query.not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    : query.is('deleted_at', null).order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getDocument(id) {
  const { data, error } = await sb.from('documents').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDocument(id, fields) {
  const { data, error } = await sb.from('documents').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export const moveToTrash = (id) => updateDocument(id, { deleted_at: new Date().toISOString() });
export const restoreDocument = (id) => updateDocument(id, { deleted_at: null });

// Erst die Datei, dann den Datensatz löschen. Scheitert die Datei, bleibt alles im Papierkorb.
export async function deleteForever(doc) {
  const { error: fileError } = await sb.storage.from(BUCKET).remove([doc.file_path]);
  if (fileError) throw fileError;
  const { error } = await sb.from('documents').delete().eq('id', doc.id);
  if (error) throw error;
}

// Datei hochladen, dann den Datensatz anlegen. Scheitert der Datensatz, wird die Datei wieder entfernt.
export async function createDocument(file, fileName, fields) {
  const id = crypto.randomUUID();
  const path = `${id}/${safeFileName(fileName)}`;
  const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await sb.from('documents').insert({
    id,
    file_path: path,
    file_name: fileName,
    file_type: file.type,
    file_size: file.size,
    ...fields,
  }).select().single();
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data;
}

// Kurzlebiger Link zur Datei. Mit download wird die Datei als Anhang ausgeliefert.
export async function signedUrl(path, download) {
  const { data, error } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

// Speicherpfade vertragen keine Umlaute und Sonderzeichen.
function safeFileName(name) {
  const umlauts = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
  const clean = base
    .replace(/[äöüÄÖÜß]/g, (c) => umlauts[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return (clean || 'dokument') + ext;
}
