// Detailansicht: links die Vorschau, rechts alle Felder zum Bearbeiten.
import { getDocument, updateDocument, moveToTrash, restoreDocument, signedUrl } from '../api.js';
import { field, textInput, textArea, selectInput, categoryFields, emptyToNull } from '../felder.js';
import {
  h, icon, ICONS, toast, errorText, confirmDialog, fmtDate, fmtBytes, fileKind,
  parseAmount, formatAmountInput, INTERVALS, STATUSES, memberName,
} from '../ui.js';

export async function renderDokument({ params: [id], master }) {
  const doc = await getDocument(id);
  if (!doc) {
    return h('div', { class: 'panel empty' },
      h('p', { class: 'empty-title' }, 'Dokument nicht gefunden'),
      h('a', { class: 'btn btn-secondary', href: '#/' }, 'Zur Übersicht'),
    );
  }

  const titleEl = h('h1', { class: 'page-title' }, doc.title);
  const preview = await renderPreview(doc);

  return h('div', {},
    h('a', { class: 'back-link', href: doc.deleted_at ? '#/papierkorb' : '#/' },
      icon(ICONS.back), doc.deleted_at ? 'Papierkorb' : 'Alle Akten'),
    h('div', { class: 'page-head' },
      h('div', {},
        titleEl,
        h('p', { class: 'page-sub' },
          `${fileKind(doc.file_type)} · ${fmtBytes(doc.file_size)} · hochgeladen am ${fmtDate(doc.created_at)} von ${memberName(master, doc.owner)}`),
      ),
    ),
    doc.deleted_at ? trashNotice(doc) : null,
    h('div', { class: 'split' }, preview, renderForm(doc, master, titleEl)),
  );
}

function trashNotice(doc) {
  return h('div', { class: 'notice' },
    `Dieses Dokument liegt seit ${fmtDate(doc.deleted_at)} im Papierkorb. `,
    h('button', {
      class: 'link-btn', type: 'button',
      onclick: async () => {
        try {
          await restoreDocument(doc.id);
          toast('Wiederhergestellt.', 'ok');
          location.hash = `#/dokument/${doc.id}`;
          dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (err) {
          toast(errorText(err), 'error');
        }
      },
    }, 'Wiederherstellen'),
  );
}

async function renderPreview(doc) {
  let frame;
  try {
    const url = await signedUrl(doc.file_path);
    if (doc.file_type === 'application/pdf') {
      frame = h('div', { class: 'preview-frame' }, h('iframe', { src: url, title: `Vorschau: ${doc.title}` }));
    } else if (doc.file_type?.startsWith('image/')) {
      frame = h('div', { class: 'preview-frame is-image' }, h('img', { src: url, alt: doc.title }));
    } else {
      frame = h('div', { class: 'preview-frame' }, h('p', { class: 'preview-empty' }, 'Für dieses Format gibt es keine Vorschau.'));
    }
  } catch (err) {
    frame = h('div', { class: 'preview-frame' }, h('p', { class: 'preview-empty' }, `Vorschau nicht verfügbar: ${errorText(err)}`));
  }

  return h('div', { class: 'preview' },
    frame,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => openFile(doc) }, 'Original öffnen'),
      h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => openFile(doc, doc.file_name) }, 'Herunterladen'),
    ),
  );
}

// Link erst beim Klick erzeugen, damit er frisch ist. Das Fenster wird sofort geöffnet,
// sonst blockiert Safari es als Pop-up, weil zwischen Klick und Öffnen gewartet wird.
async function openFile(doc, downloadName) {
  const win = window.open('', '_blank');
  try {
    const url = await signedUrl(doc.file_path, downloadName);
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else {
      location.href = url;
    }
  } catch (err) {
    win?.close();
    toast(errorText(err), 'error');
  }
}

function renderForm(doc, master, titleEl) {
  const saveButton = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Speichern');

  const form = h('form', { class: 'form panel', novalidate: true },
    h('fieldset', { class: 'fieldset' },
      h('legend', { class: 'label' }, 'Einordnung'),
      field('Titel', textInput('title', doc.title, { required: true, maxlength: '200' })),
      h('div', { class: 'grid-2' }, categoryFields(master, doc)),
      h('div', { class: 'grid-2' },
        field('Status', selectInput('status', STATUSES.map((s) => ({ value: s, label: s })), doc.status)),
        h('label', { class: 'check' },
          h('input', { type: 'checkbox', name: 'flagged', checked: doc.flagged }),
          h('span', {}, 'Markiert (wichtig)'),
        ),
      ),
    ),

    h('fieldset', { class: 'fieldset' },
      h('legend', { class: 'label' }, 'Schreiben'),
      field('Absender', textInput('sender', doc.sender, { autocomplete: 'off' })),
      h('div', { class: 'grid-2' },
        field('Datum des Schreibens', h('input', { class: 'input', type: 'date', name: 'document_date', value: doc.document_date ?? '' })),
        field('Aktenzeichen', textInput('reference', doc.reference, { autocomplete: 'off' })),
      ),
      field('Zusammenfassung', textArea('summary', doc.summary, { rows: '3' })),
      field('Schlagwörter', textInput('tags', doc.tags.join(', '), { autocomplete: 'off' }), 'Mit Komma trennen, z. B. Grundsteuer, 2026'),
    ),

    h('fieldset', { class: 'fieldset' },
      h('legend', { class: 'label' }, 'Kosten und Fristen'),
      h('div', { class: 'grid-2' },
        field('Betrag', textInput('amount', formatAmountInput(doc.amount), { inputmode: 'decimal', placeholder: '0,00', autocomplete: 'off' })),
        field('Intervall', selectInput('cost_interval',
          [{ value: '', label: '–' }, ...INTERVALS.map((i) => ({ value: i, label: i }))], doc.cost_interval ?? '')),
      ),
      h('div', { class: 'grid-2' },
        field('Fällig am', h('input', { class: 'input', type: 'date', name: 'due_date', value: doc.due_date ?? '' })),
        field('Läuft bis', h('input', { class: 'input', type: 'date', name: 'end_date', value: doc.end_date ?? '' })),
      ),
      h('div', { class: 'grid-2' },
        field('Abrechnungstag', h('input', {
          class: 'input', type: 'number', name: 'billing_day', min: '1', max: '31', inputmode: 'numeric',
          value: doc.billing_day ?? '',
        }), 'Tag im Monat, 1–31'),
        field('Währung', selectInput('currency',
          ['EUR', 'USD', 'CHF', 'GBP'].map((c) => ({ value: c, label: c })), doc.currency || 'EUR')),
      ),
    ),

    h('fieldset', { class: 'fieldset' },
      h('legend', { class: 'label' }, 'Notizen'),
      field('Eigene Notizen', textArea('notes', doc.notes, { rows: '4' })),
    ),

    h('dl', { class: 'meta-list' },
      h('dt', {}, 'Datei'), h('dd', {}, doc.file_name),
      h('dt', {}, 'Geändert'), h('dd', {}, fmtDate(doc.updated_at)),
      doc.ai_confidence != null ? [h('dt', {}, 'KI-Sicherheit'), h('dd', {}, `${Math.round(doc.ai_confidence * 100)} %`)] : null,
      doc.ai_model ? [h('dt', {}, 'Analysiert mit'), h('dd', {}, doc.ai_model)] : null,
    ),

    doc.fulltext
      ? h('details', { class: 'details-toggle' },
        h('summary', {}, 'Volltext anzeigen'),
        h('pre', { class: 'fulltext' }, doc.fulltext))
      : null,

    h('div', { class: 'form-actions' },
      saveButton,
      doc.deleted_at ? null : h('button', {
        class: 'btn btn-danger', type: 'button',
        onclick: async () => {
          const ok = await confirmDialog({
            title: 'In den Papierkorb legen?',
            text: `„${doc.title}“ verschwindet aus der Übersicht. Du kannst es im Papierkorb wiederherstellen.`,
            confirm: 'In den Papierkorb',
            danger: true,
          });
          if (!ok) return;
          try {
            await moveToTrash(doc.id);
            toast('In den Papierkorb gelegt.', 'ok');
            location.hash = '#/';
          } catch (err) {
            toast(errorText(err), 'error');
          }
        },
      }, 'In den Papierkorb'),
    ),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);

    const title = String(data.get('title')).trim();
    if (!title) return toast('Der Titel darf nicht leer sein.', 'error');

    const amount = parseAmount(data.get('amount'));
    if (Number.isNaN(amount)) return toast('Bitte den Betrag als Zahl eingeben, z. B. 380,50.', 'error');

    const billingDay = emptyToNull(data.get('billing_day'));
    if (billingDay && !(Number(billingDay) >= 1 && Number(billingDay) <= 31)) {
      return toast('Der Abrechnungstag muss zwischen 1 und 31 liegen.', 'error');
    }

    const fields = {
      title,
      category: data.get('category'),
      subcategory: emptyToNull(data.get('subcategory')),
      status: data.get('status'),
      flagged: data.get('flagged') === 'on',
      sender: emptyToNull(data.get('sender')),
      document_date: emptyToNull(data.get('document_date')),
      reference: emptyToNull(data.get('reference')),
      summary: emptyToNull(data.get('summary')),
      tags: String(data.get('tags')).split(',').map((t) => t.trim()).filter(Boolean),
      amount,
      currency: data.get('currency') || 'EUR',
      cost_interval: emptyToNull(data.get('cost_interval')),
      due_date: emptyToNull(data.get('due_date')),
      end_date: emptyToNull(data.get('end_date')),
      billing_day: billingDay ? Number(billingDay) : null,
      notes: emptyToNull(data.get('notes')),
    };

    saveButton.disabled = true;
    saveButton.textContent = 'Speichert …';
    try {
      const saved = await updateDocument(doc.id, fields);
      Object.assign(doc, saved);
      titleEl.textContent = saved.title;
      toast('Gespeichert.', 'ok');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Speichern';
    }
  });

  return form;
}
