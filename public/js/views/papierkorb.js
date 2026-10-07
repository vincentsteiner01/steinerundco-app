// Papierkorb: wiederherstellen oder endgültig löschen (samt Datei).
import { listDocuments, restoreDocument, deleteForever } from '../api.js';
import { h, toast, errorText, confirmDialog, fmtDate } from '../ui.js';
import { docRow } from './liste.js';

export async function renderPapierkorb({ master }) {
  const docs = await listDocuments({ trash: true });
  const count = h('p', { class: 'page-sub' });
  const list = h('ul', { class: 'doc-list' });
  const empty = h('div', { class: 'panel empty' },
    h('p', { class: 'empty-title' }, 'Der Papierkorb ist leer'),
    h('p', {}, 'Gelöschte Dokumente landen erst einmal hier.'),
  );

  const updateCount = () => {
    const n = list.children.length;
    count.textContent = n === 1 ? '1 Dokument' : `${n} Dokumente`;
    empty.hidden = n > 0;
    list.hidden = n === 0;
  };

  for (const doc of docs) {
    const item = h('li', {});
    const restore = h('button', {
      class: 'btn btn-secondary', type: 'button',
      onclick: async () => {
        try {
          await restoreDocument(doc.id);
          item.remove();
          updateCount();
          toast(`„${doc.title}“ ist wieder da.`, 'ok');
        } catch (err) {
          toast(errorText(err), 'error');
        }
      },
    }, 'Wiederherstellen');

    const remove = h('button', {
      class: 'btn btn-danger', type: 'button',
      onclick: async () => {
        const ok = await confirmDialog({
          title: 'Endgültig löschen?',
          text: `„${doc.title}“ und die Datei werden gelöscht. Das lässt sich nicht rückgängig machen.`,
          confirm: 'Endgültig löschen',
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteForever(doc);
          item.remove();
          updateCount();
          toast('Endgültig gelöscht.', 'ok');
        } catch (err) {
          toast(errorText(err), 'error');
        }
      },
    }, 'Endgültig löschen');

    item.append(docRow(doc, master, {
      actions: [h('a', { class: 'btn btn-quiet', href: `#/dokument/${doc.id}` }, 'Ansehen'), restore, remove],
      extraMeta: `gelöscht am ${fmtDate(doc.deleted_at)}`,
    }));
    list.append(item);
  }

  updateCount();

  return h('div', {},
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', { class: 'page-title' }, h('span', { class: 'accent' }, 'Papierkorb')),
        count,
      ),
    ),
    list,
    empty,
  );
}
