// Hochladen in zwei Schritten: Datei oder Fotos wählen → Angaben prüfen und speichern.
// Ab Phase 2 kommt dazwischen die Analyse durch Claude.
import { createDocument } from '../api.js';
import { MAX_FILE_BYTES } from '../config.js';
import { prepareSingleImage, imagesToPdf } from '../bilder.js';
import { field, textInput, categoryFields, emptyToNull } from '../felder.js';
import { h, icon, ICONS, toast, errorText, fmtBytes, fmtDate } from '../ui.js';

const PDF = 'application/pdf';
const IMAGE_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024; // Fotos werden vor dem Hochladen verkleinert

export function renderUpload({ master }) {
  const state = { pdf: null, images: [] }; // images: [{ file, url }]
  const previewUrls = [];                   // Vorschau-Links für PDFs, werden beim Verlassen freigegeben
  const root = h('div', {});

  const now = new Date();
  const isoToday = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, '0')).join('-');

  // Unsichtbare Dateifelder: eins öffnet direkt die Kamera, eins die Dateiauswahl.
  const cameraInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const fileInput = h('input', {
    type: 'file', multiple: true, hidden: true,
    accept: 'application/pdf,image/jpeg,image/png,image/webp',
  });
  for (const input of [cameraInput, fileInput]) {
    input.addEventListener('change', () => {
      addFiles([...input.files]);
      input.value = '';
    });
  }

  function addFiles(files) {
    if (!files.length) return;
    const pdfs = files.filter((f) => f.type === PDF);
    const images = files.filter((f) => IMAGE_TYPES.test(f.type));
    const other = files.length - pdfs.length - images.length;

    if (other) return toast('Erlaubt sind PDF, JPG und PNG.', 'error');
    if (pdfs.length && (images.length || state.images.length || pdfs.length > 1 || state.pdf)) {
      return toast('Bitte ein PDF für sich hochladen, nicht zusammen mit Fotos oder weiteren PDFs.', 'error');
    }
    if (images.length && state.pdf) return toast('Erst das PDF entfernen, dann Fotos hinzufügen.', 'error');
    if (pdfs.some((f) => f.size > MAX_FILE_BYTES)) return toast('Das PDF ist größer als 25 MB.', 'error');
    if (images.some((f) => f.size > MAX_IMAGE_BYTES)) return toast('Ein Foto ist größer als 40 MB.', 'error');

    if (pdfs.length) state.pdf = pdfs[0];
    for (const file of images) state.images.push({ file, url: URL.createObjectURL(file) });
    stepPick();
  }

  function reset() {
    state.images.forEach((img) => URL.revokeObjectURL(img.url));
    state.pdf = null;
    state.images = [];
    stepPick();
  }

  function steps(current) {
    return h('ol', { class: 'steps' },
      ['Datei', 'Angaben'].map((label, i) =>
        h('li', { 'aria-current': i + 1 === current ? 'step' : null }, h('span', {}, String(i + 1)), label)),
    );
  }

  // ------------------------------------------------------------ Schritt 1
  function stepPick() {
    const hasFiles = state.pdf || state.images.length;
    let body;

    if (!hasFiles) {
      const dropzone = h('div', { class: 'dropzone', role: 'button', tabindex: '0' },
        icon(ICONS.upload),
        h('p', { class: 'dropzone-title' },
          h('span', { class: 'dropzone-drag' }, 'Datei hierher ziehen oder '), 'Datei auswählen'),
        h('p', { class: 'muted' }, 'PDF, JPG oder PNG · mehrere Fotos werden ein Dokument'),
      );
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
      });
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-over'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-over');
        addFiles([...e.dataTransfer.files]);
      });

      body = h('div', { class: 'pick' },
        h('button', { class: 'btn btn-primary btn-block camera-btn', type: 'button', onclick: () => cameraInput.click() },
          icon(ICONS.camera), 'Brief fotografieren'),
        dropzone,
      );
    } else if (state.pdf) {
      body = h('div', { class: 'pick' },
        h('div', { class: 'file-card' },
          icon(ICONS.file),
          h('div', {},
            h('p', { class: 'file-card-name' }, state.pdf.name),
            h('p', { class: 'muted' }, `PDF · ${fmtBytes(state.pdf.size)}`),
          ),
        ),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: stepDetails }, 'Weiter'),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: reset }, 'Andere Datei'),
        ),
      );
    } else {
      const addPage = h('li', {},
        h('button', { class: 'page-add', type: 'button', onclick: () => pickMorePages() },
          icon(ICONS.plus), 'Seite hinzufügen'),
      );
      body = h('div', { class: 'pick' },
        h('p', { class: 'muted' },
          state.images.length === 1
            ? 'Hat der Brief mehrere Seiten? Dann fotografier die nächste Seite dazu.'
            : `${state.images.length} Seiten werden zu einem PDF zusammengefügt.`),
        h('ul', { class: 'pages' },
          state.images.map((img, i) => h('li', {},
            h('figure', { class: 'page-thumb' },
              h('img', { src: img.url, alt: `Seite ${i + 1}` }),
              h('figcaption', {}, `Seite ${i + 1}`),
              h('button', {
                class: 'page-remove', type: 'button', 'aria-label': `Seite ${i + 1} entfernen`,
                onclick: () => removePage(i),
              }, icon(ICONS.close)),
            ),
          )),
          addPage,
        ),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: stepDetails }, 'Weiter'),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: reset }, 'Verwerfen'),
        ),
      );
    }

    root.replaceChildren(
      h('div', { class: 'page-head' },
        h('div', {},
          h('h1', { class: 'page-title' }, 'Dokument ', h('span', { class: 'accent' }, 'hochladen')),
        ),
      ),
      steps(1),
      body,
      cameraInput,
      fileInput,
    );
  }

  function pickMorePages() {
    // Am Handy direkt die Kamera, am Rechner die Dateiauswahl.
    if (matchMedia('(pointer: coarse)').matches) cameraInput.click();
    else fileInput.click();
  }

  function removePage(index) {
    const [removed] = state.images.splice(index, 1);
    URL.revokeObjectURL(removed.url);
    stepPick();
  }

  // ------------------------------------------------------------ Schritt 2
  function stepDetails() {
    const defaultTitle = state.pdf
      ? state.pdf.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim()
      : `Scan vom ${fmtDate(isoToday)}`;

    const titleInput = textInput('title', defaultTitle, { required: true, maxlength: '200' });
    const saveButton = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Speichern');
    const progress = h('p', { class: 'progress-note', hidden: true }, h('span', { class: 'spinner' }), h('span', {}));

    const form = h('form', { class: 'form panel' },
      h('div', { class: 'fieldset' },
        field('Titel', titleInput),
        h('div', { class: 'grid-2' }, categoryFields(master, { category: 'sonstiges', subcategory: '' })),
        field('Absender', textInput('sender', '', { placeholder: 'z. B. Finanzamt Hamburg-Nord', autocomplete: 'off' })),
        h('div', { class: 'grid-2' },
          field('Datum des Schreibens', h('input', { class: 'input', type: 'date', name: 'document_date' })),
          field('Aktenzeichen', textInput('reference', '', { placeholder: 'Steuernummer, Kundennummer …', autocomplete: 'off' })),
        ),
      ),
      h('p', { class: 'field-hint' }, 'Weitere Felder wie Betrag, Fälligkeit und Notizen füllst du danach in der Detailansicht aus.'),
      progress,
      h('div', { class: 'form-actions' },
        saveButton,
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: stepPick }, 'Zurück'),
      ),
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const title = String(data.get('title')).trim();
      if (!title) {
        titleInput.focus();
        return toast('Bitte gib einen Titel ein.', 'error');
      }
      saveButton.disabled = true;
      progress.hidden = false;
      const setProgress = (text) => { progress.lastChild.textContent = text; };

      try {
        setProgress(state.pdf ? 'Bereite vor …' : 'Bereite Fotos vor …');
        const { blob, fileName } = await prepareFile();
        if (blob.size > MAX_FILE_BYTES) throw new Error('Die Datei ist zu groß (höchstens 25 MB).');

        setProgress(`Lade hoch (${fmtBytes(blob.size)}) …`);
        const doc = await createDocument(blob, fileName, {
          title,
          category: data.get('category'),
          subcategory: emptyToNull(data.get('subcategory')),
          sender: emptyToNull(data.get('sender')),
          document_date: emptyToNull(data.get('document_date')),
          reference: emptyToNull(data.get('reference')),
        });

        state.images.forEach((img) => URL.revokeObjectURL(img.url));
        state.images = [];
        toast('Gespeichert.', 'ok');
        location.hash = `#/dokument/${doc.id}`;
      } catch (err) {
        toast(errorText(err), 'error');
        saveButton.disabled = false;
        progress.hidden = true;
      }
    });

    root.replaceChildren(
      h('div', { class: 'page-head' },
        h('div', {},
          h('h1', { class: 'page-title' }, 'Dokument ', h('span', { class: 'accent' }, 'hochladen')),
        ),
      ),
      steps(2),
      h('div', { class: 'split split-upload' }, form, uploadPreview()),
    );
    titleInput.focus();
  }

  function uploadPreview() {
    if (state.pdf) {
      const url = URL.createObjectURL(state.pdf);
      previewUrls.push(url);
      return h('div', { class: 'preview' },
        h('div', { class: 'preview-frame' }, h('iframe', { src: url, title: 'Vorschau' })));
    }
    return h('div', { class: 'preview' },
      h('div', { class: 'preview-frame is-image' }, h('img', { src: state.images[0].url, alt: 'Vorschau Seite 1' })),
      state.images.length > 1 ? h('p', { class: 'muted' }, `+ ${state.images.length - 1} weitere Seite(n)`) : null,
    );
  }

  async function prepareFile() {
    if (state.pdf) return { blob: state.pdf, fileName: state.pdf.name };

    const stamp = isoToday;
    const files = state.images.map((img) => img.file);
    if (files.length === 1) {
      const prepared = await prepareSingleImage(files[0]);
      const base = files[0].name.replace(/\.[^.]+$/, '');
      const name = !base || /^image$/i.test(base) ? `scan-${stamp}` : base;
      return { blob: prepared.blob, fileName: `${name}.${prepared.ext}` };
    }
    return { blob: await imagesToPdf(files), fileName: `scan-${stamp}.pdf` };
  }

  stepPick();
  root.cleanup = () => {
    state.images.forEach((img) => URL.revokeObjectURL(img.url));
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
  };
  return root;
}
