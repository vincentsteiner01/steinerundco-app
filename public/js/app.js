// Einstieg: Anmeldung prüfen, Ansichten per Hash-Routing anzeigen.
import { sb, initialHash, loadMasterData, logout } from './api.js';
import { h, errorText } from './ui.js';
import { renderLogin } from './views/login.js';
import { renderListe } from './views/liste.js';
import { renderUpload } from './views/upload.js';
import { renderDokument } from './views/dokument.js';
import { renderPapierkorb } from './views/papierkorb.js';

const routes = [
  { pattern: /^#\/?$/, nav: 'liste', view: renderListe },
  { pattern: /^#\/neu$/, nav: 'neu', view: renderUpload },
  { pattern: /^#\/dokument\/([0-9a-f-]{36})$/, nav: 'liste', view: renderDokument },
  { pattern: /^#\/papierkorb$/, nav: 'papierkorb', view: renderPapierkorb },
];

const main = document.getElementById('inhalt');
const topbar = document.getElementById('topbar');

let session = null;
let renderCount = 0;   // verhindert, dass eine langsame alte Ansicht eine neuere überschreibt
let cleanup = null;    // Aufräumfunktion der aktuellen Ansicht (z. B. Vorschaubilder freigeben)
let linkError = null;  // Fehler aus dem Magic Link, wird einmal angezeigt

// Fehler aus dem Magic Link, z. B. #error=access_denied&error_code=otp_expired
function readLinkError(hash) {
  if (!hash.includes('error=')) return null;
  const params = new URLSearchParams(hash.replace(/^#\/?/, ''));
  if (params.get('error_code') === 'otp_expired') {
    return 'Der Anmeldelink ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.';
  }
  return params.get('error_description') || 'Die Anmeldung hat nicht geklappt.';
}

function setChrome(visible) {
  topbar.hidden = !visible;
  document.body.classList.toggle('ohne-navigation', !visible);
}

function setActiveNav(name) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function show(node) {
  cleanup?.();
  cleanup = node.cleanup || null;
  main.replaceChildren(node);
  window.scrollTo(0, 0);
}

async function route() {
  const current = ++renderCount;

  if (!session) {
    setChrome(false);
    show(renderLogin({ linkError }));
    linkError = null;
    return;
  }

  const hash = location.hash || '#/';
  const match = routes.find((r) => r.pattern.test(hash));
  if (!match) {
    location.replace('#/');
    return;
  }

  setChrome(true);
  setActiveNav(match.nav);
  main.replaceChildren(h('p', { class: 'loading' }, 'Lädt …'));

  try {
    const master = await loadMasterData();
    if (current !== renderCount) return;

    // Angemeldet, aber nicht in der Mitgliederliste: Daten sind gesperrt.
    const me = master.members.find((m) => m.user_id === session.user.id);
    if (!me) {
      setChrome(false);
      show(noAccess(session.user.email));
      return;
    }
    document.getElementById('user-name').textContent = me.display_name;

    const params = hash.match(match.pattern).slice(1);
    const node = await match.view({ params, master, session });
    if (current !== renderCount) return;
    show(node);
  } catch (err) {
    if (current !== renderCount) return;
    show(h('div', { class: 'panel error-panel' },
      h('p', { class: 'empty-title' }, 'Das hat nicht geklappt.'),
      h('p', { class: 'muted' }, errorText(err)),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: route }, 'Noch einmal versuchen'),
    ));
  }
}

function noAccess(email) {
  return h('div', { class: 'login' },
    h('div', { class: 'login-card' },
      h('p', { class: 'login-brand' }, 'Akten'),
      h('p', { class: 'login-intro' },
        `Du bist als ${email} angemeldet, aber dieses Konto ist für das Aktendashboard nicht freigeschaltet.`),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: logout }, 'Abmelden'),
    ),
  );
}

async function start() {
  linkError = readLinkError(initialHash);
  const { data } = await sb.auth.getSession();
  session = data.session;

  // Reste des Magic Links (Token oder Fehler) aus der Adresszeile entfernen.
  if (/access_token=|error=/.test(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search + '#/');
  }

  sb.auth.onAuthStateChange((event, newSession) => {
    const wasSignedIn = !!session;
    session = newSession;
    // Laut Supabase-Doku keine weiteren Aufrufe direkt im Callback, daher per setTimeout.
    if (wasSignedIn !== !!newSession) setTimeout(route, 0);
  });

  document.getElementById('abmelden').addEventListener('click', logout);
  window.addEventListener('hashchange', route);
  route();
}

start();
