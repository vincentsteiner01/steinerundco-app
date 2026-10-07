// Liste aller Dokumente, die neuesten zuerst.
import { listDocuments } from '../api.js';
import {
  h, icon, ICONS, fmtDate, fmtMoney, categoryProps, categoryLabel, INTERVAL_SUFFIX,
} from '../ui.js';

export async function renderListe({ master }) {
  const docs = await listDocuments();

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h1', { class: 'page-title' }, 'Alle ', h('span', { class: 'accent' }, 'Akten')),
      h('p', { class: 'page-sub' }, docs.length === 1 ? '1 Dokument' : `${docs.length} Dokumente`),
    ),
  );

  if (!docs.length) {
    return h('div', {},
      head,
      h('div', { class: 'panel empty' },
        h('p', { class: 'empty-title' }, 'Noch keine Akten'),
        h('p', {}, 'Fotografier den ersten Brief oder zieh ein PDF hierher.'),
        h('a', { class: 'btn btn-primary', href: '#/neu' }, icon(ICONS.plus), 'Dokument hochladen'),
      ),
    );
  }

  return h('div', {},
    head,
    h('ul', { class: 'doc-list' }, docs.map((doc) => h('li', {}, docRow(doc, master)))),
  );
}

export function docRow(doc, master, { href = `#/dokument/${doc.id}`, actions = null, extraMeta = null } = {}) {
  const metaParts = [
    doc.sender,
    doc.document_date ? `Schreiben vom ${fmtDate(doc.document_date)}` : `hochgeladen ${fmtDate(doc.created_at)}`,
    extraMeta,
  ].filter(Boolean);

  const content = [
    h('div', { class: 'doc-main' },
      h('p', { class: 'doc-title' },
        doc.flagged ? h('span', { class: 'flag', title: 'Markiert' }, '★') : null,
        doc.title,
      ),
      h('p', { class: 'doc-meta' }, metaParts.join(' · ')),
    ),
    h('div', { class: 'doc-side' },
      h('span', { class: 'chip', ...categoryProps(master, doc.category) },
        doc.subcategory || categoryLabel(master, doc.category)),
      doc.amount != null
        ? h('span', { class: 'doc-amount' }, fmtMoney(doc.amount, doc.currency) + (INTERVAL_SUFFIX[doc.cost_interval] || ''))
        : null,
      doc.status !== 'geprüft' ? h('span', { class: `status status-${doc.status}` }, doc.status) : null,
    ),
    actions ? h('div', { class: 'doc-row-actions' }, actions) : null,
  ];

  // Mit Aktionen (Papierkorb) ist die Zeile kein Link, damit Schaltflächen nicht in einem Link stecken.
  return actions
    ? h('div', { class: 'doc-row', ...categoryProps(master, doc.category) }, content)
    : h('a', { class: 'doc-row', href, ...categoryProps(master, doc.category) }, content);
}
