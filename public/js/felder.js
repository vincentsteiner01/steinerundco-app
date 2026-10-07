// Formularbausteine, die Hochladen und Detailansicht gemeinsam nutzen.
import { h } from './ui.js';

export function field(label, control, hint) {
  return h('label', { class: 'field' },
    h('span', {}, label),
    control,
    hint ? h('span', { class: 'field-hint' }, hint) : null,
  );
}

export function textInput(name, value, attrs = {}) {
  return h('input', { class: 'input', type: 'text', name, value: value ?? '', ...attrs });
}

export function textArea(name, value, attrs = {}) {
  return h('textarea', { class: 'textarea', name, value: value ?? '', ...attrs });
}

export function selectInput(name, options, selected, attrs = {}) {
  return h('select', { class: 'select', name, ...attrs },
    options.map((o) => h('option', { value: o.value, selected: o.value === (selected ?? '') }, o.label)),
  );
}

// Kategorie und Unterkategorie, die Unterkategorien folgen der gewählten Kategorie.
export function categoryFields(master, { category, subcategory }) {
  const categorySelect = selectInput(
    'category',
    master.categories.filter((c) => c.for_documents).map((c) => ({ value: c.slug, label: c.label })),
    category,
    { required: true },
  );
  const subSelect = h('select', { class: 'select', name: 'subcategory' });

  const fillSubcategories = (slug, selected) => {
    const subs = master.subcategories.filter((s) => s.category === slug);
    const options = [{ value: '', label: '– keine –' }, ...subs.map((s) => ({ value: s.label, label: s.label }))];
    // Ein Wert, den es in der Liste nicht (mehr) gibt, bleibt trotzdem auswählbar.
    if (selected && !subs.some((s) => s.label === selected)) options.push({ value: selected, label: selected });
    subSelect.replaceChildren(...options.map((o) =>
      h('option', { value: o.value, selected: o.value === (selected || '') }, o.label)));
  };

  fillSubcategories(category, subcategory);
  categorySelect.addEventListener('change', () => fillSubcategories(categorySelect.value, ''));

  return [field('Kategorie', categorySelect), field('Unterkategorie', subSelect)];
}

export function emptyToNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
