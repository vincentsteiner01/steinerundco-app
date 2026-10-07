// Anmeldung per Magic Link. Alternativ den Code aus derselben Mail eingeben –
// praktisch, wenn die Mail auf einem anderen Gerät geöffnet wird.
import { requestLogin, verifyCode } from '../api.js';
import { h, errorText } from '../ui.js';

const EMAIL_KEY = 'akten.email';

function rememberedEmail() {
  try { return localStorage.getItem(EMAIL_KEY) || ''; } catch { return ''; }
}

function rememberEmail(email) {
  try { localStorage.setItem(EMAIL_KEY, email); } catch { /* privates Fenster: egal */ }
}

export function renderLogin({ linkError } = {}) {
  const card = h('div', { class: 'login-card' });
  const root = h('div', { class: 'login' }, card);

  // replaceChildren würde null als Text „null“ anzeigen, daher leere Teile vorher entfernen.
  const fill = (...parts) => card.replaceChildren(...parts.filter(Boolean));

  function notice(text, isError = false) {
    return text ? h('p', { class: `notice${isError ? ' notice-error' : ''}`, role: isError ? 'alert' : null }, text) : null;
  }

  function stepEmail(message, isError, typed) {
    const input = h('input', {
      class: 'input', type: 'email', name: 'email', required: true,
      autocomplete: 'email', inputmode: 'email', placeholder: 'name@steinerundco.de',
      value: typed ?? rememberedEmail(),
    });
    const button = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Anmeldelink anfordern');
    const form = h('form', { class: 'form', novalidate: true },
      h('label', { class: 'field' }, h('span', {}, 'E-Mail-Adresse'), input),
      button,
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = input.value.trim().toLowerCase();
      if (!input.checkValidity() || !email) {
        stepEmail('Bitte gib eine gültige E-Mail-Adresse ein.', true, input.value);
        return;
      }
      button.disabled = true;
      button.textContent = 'Wird gesendet …';
      try {
        await requestLogin(email);
        rememberEmail(email);
        stepCode(email);
      } catch (err) {
        stepEmail(errorText(err), true, email);
      }
    });

    fill(
      h('h1', { class: 'login-brand' }, 'Akten'),
      h('p', { class: 'login-intro' }, 'Das Aktendashboard von Steiner & Co. Melde dich mit deiner E-Mail-Adresse an, du bekommst einen Anmeldelink.'),
      notice(message, isError),
      form,
    );
    input.focus();
  }

  function stepCode(email, message, isError) {
    const input = h('input', {
      class: 'input input-code', name: 'code', required: true, inputmode: 'numeric',
      autocomplete: 'one-time-code', pattern: '[0-9]{6,10}', maxlength: '10', placeholder: '••••••',
    });
    const button = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Mit Code anmelden');
    const form = h('form', { class: 'form' },
      h('label', { class: 'field' }, h('span', {}, 'Code aus der Mail'), input),
      button,
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = input.value.replace(/\D/g, '');
      if (code.length < 6) {
        stepCode(email, 'Der Code hat mindestens 6 Ziffern.', true);
        return;
      }
      button.disabled = true;
      button.textContent = 'Prüfe …';
      try {
        await verifyCode(email, code);
        // Weiter geht es über onAuthStateChange in app.js.
      } catch (err) {
        stepCode(email, errorText(err), true);
      }
    });

    fill(
      h('h1', { class: 'login-brand' }, 'Akten'),
      h('p', { class: 'login-intro' },
        'Wir haben dir eine Mail an ', h('strong', {}, email), ' geschickt. ',
        'Klick auf den Link darin. Liest du die Mail auf einem anderen Gerät, gib hier den Code aus der Mail ein.'),
      notice(message, isError),
      form,
      h('p', {},
        h('button', { class: 'link-btn', type: 'button', onclick: () => stepEmail() }, 'Andere Adresse verwenden'),
      ),
    );
    input.focus();
  }

  stepEmail(linkError, !!linkError);
  return root;
}
