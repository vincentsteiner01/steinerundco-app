// Kleine Bausteine für die Oberfläche: Elemente bauen, Meldungen, Rückfragen, Formatierung.

// Baut ein Element. Texte landen immer als Textknoten im DOM, nie als HTML –
// so kann kein Dokumentinhalt Code in die Seite schmuggeln.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style') for (const [prop, v] of Object.entries(value)) el.style.setProperty(prop, v);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'value') el.value = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function icon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

export const ICONS = {
  back: 'M15 18l-6-6 6-6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
};

// ---------------------------------------------------------------- Meldungen

export function toast(message, type = 'info') {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast toast-${type}` }, message);
  box.append(el);
  setTimeout(() => el.remove(), type === 'error' ? 8000 : 4000);
}

// Fehlermeldungen von Supabase in verständliches Deutsch übersetzen.
export function errorText(err) {
  const msg = String(err?.message || err || '');
  const code = err?.code || err?.error_code || '';
  if (/not authorized/i.test(msg) || code === 'email_address_not_authorized') {
    return 'An diese Adresse darf Supabase noch keine Mails schicken. Dafür muss der eigene Mailversand (SMTP) eingerichtet oder die Adresse ins Supabase-Team eingeladen sein.';
  }
  if (/signups not allowed|user not found/i.test(msg) || code === 'otp_disabled') {
    return 'Diese Adresse ist nicht freigeschaltet.';
  }
  // Supabase erlaubt pro Adresse nur eine Mail je Minute – die vorige ist dann schon unterwegs.
  const wait = msg.match(/after (\d+) seconds?/i);
  if (wait) {
    return `Wir haben dir gerade schon eine Mail geschickt – schau in dein Postfach, auch in den Spam-Ordner. Einen neuen Link kannst du in ${wait[1]} Sekunden anfordern.`;
  }
  if (/email rate limit/i.test(msg)) {
    return 'Für diese Stunde sind alle Anmeldemails verbraucht. Nutze den Link aus einer früheren Mail oder versuch es später noch einmal.';
  }
  if (/rate limit|too many/i.test(msg) || code === 'over_email_send_rate_limit') {
    return 'Zu viele Anfragen. Bitte warte ein paar Minuten und versuch es dann noch einmal.';
  }
  if (/token has expired|token is invalid|otp_expired|invalid otp/i.test(msg)) {
    return 'Der Code ist abgelaufen oder falsch. Fordere einen neuen an.';
  }
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) {
    return 'Die Datei ist zu groß (höchstens 25 MB).';
  }
  if (/mime type .* is not supported/i.test(msg)) {
    return 'Dieses Dateiformat wird nicht unterstützt. Erlaubt sind PDF, JPG und PNG.';
  }
  if (/failed to fetch|network/i.test(msg)) {
    return 'Keine Verbindung zum Server. Prüf deine Internetverbindung.';
  }
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'Dafür fehlt die Berechtigung.';
  }
  return msg || 'Etwas ist schiefgegangen.';
}

// Rückfrage mit eigenem Dialog. Liefert true, wenn bestätigt.
export function confirmDialog({ title, text, confirm = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog' },
      h('h2', { class: 'dialog-title' }, title),
      h('p', {}, text),
      h('form', { method: 'dialog', class: 'btn-row' },
        h('button', { class: 'btn btn-secondary', value: 'nein' }, 'Abbrechen'),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'ja' }, confirm),
      ),
    );
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ja');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

// ---------------------------------------------------------------- Formatierung

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function fmtDate(value) {
  if (!value) return '';
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return dateFormat.format(date);
}

export function fmtMoney(amount, currency = 'EUR') {
  if (amount == null) return '';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(amount);
}

export function fmtBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}

export const INTERVALS = ['einmalig', 'monatlich', 'quartalsweise', 'halbjährlich', 'jährlich'];
export const INTERVAL_SUFFIX = {
  einmalig: '',
  monatlich: ' / Monat',
  quartalsweise: ' / Quartal',
  halbjährlich: ' / Halbjahr',
  jährlich: ' / Jahr',
};
export const STATUSES = ['neu', 'geprüft', 'erledigt'];

export function fileKind(type) {
  if (type === 'application/pdf') return 'PDF';
  if (type?.startsWith('image/')) return 'Bild';
  return 'Datei';
}

// Kategorie-Farbe als CSS-Variable an ein Element hängen.
export function categoryProps(master, slug) {
  const cat = master.categories.find((c) => c.slug === slug);
  return { dataset: { cat: slug }, style: { '--cat': cat?.color || '#6b7280' } };
}

export function categoryLabel(master, slug) {
  return master.categories.find((c) => c.slug === slug)?.label || slug;
}

export function memberName(master, userId) {
  return master.members.find((m) => m.user_id === userId)?.display_name || 'unbekannt';
}

// "380,50" oder "1.234,56" → 1234.56; leer → null
export function parseAmount(text) {
  const raw = String(text || '').trim().replace(/\s|€/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : NaN;
}

export function formatAmountInput(amount) {
  if (amount == null) return '';
  return Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}
