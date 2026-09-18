import { OPERATORS, TYPES, MAX_DEPTH, MAX_CONDITIONS, EXAMPLES, condition, group, compile, toRpcDomain } from '../domain/domain.js';
import { defaultType, modelErrors, MODEL_NAME } from '../domain/catalog.js';
import { setupModels, setupFieldBrowser } from './models.js';
import { setupRecordPicker } from './record-picker.js';
import { readDraft, saveDraft, clearDraft } from '../utils/storage.js';

const $ = selector => document.querySelector(selector);
const stored = readDraft();
// Restored data is untrusted. Bound traversal before rendering even an incomplete draft.
function safeTree(node, depth = 0, budget = { n: 0 }) {
  if (!node || depth > MAX_DEPTH || ++budget.n > 201) return false;
  if (node.kind === 'condition') return ['field', 'operator', 'type', 'value'].every(key => typeof node[key] === 'string' && node[key].length <= 10000);
  return node.kind === 'group' && ['AND', 'OR'].includes(node.logic) && typeof node.not === 'boolean' && Array.isArray(node.children) && node.children.length <= 100 && node.children.every(child => safeTree(child, depth + (child?.kind === 'group' ? 1 : 0), budget));
}
let currentCatalog = null;
let modelContext = stored?.modelContext || null;
let modelRequired = new URL(location.href).searchParams.has('sourceTab');
let busy = false;
const browseFields = setupFieldBrowser();
const pickRecords = setupRecordPicker();
const selectedRecordLabels = new WeakMap();
let tree = stored?.tree?.kind === 'group' && safeTree(stored.tree) ? stored.tree : group('AND', [condition()]);
let theme = stored?.theme === 'dark' ? 'dark' : 'light';
let formatted = stored?.formatted === true;
let result;
let timer;
let storageWarning = false;
let selectedPreviewFields = [], previewFieldCatalog = null, previewFieldModel = '', previewFieldPrefix = '', previewBrowseToken = 0;
let previewKey = '', previewToken = 0, previewLoading = false, previewRows = [], previewFields = [], previewHasMore = false;
const typeNames = { string: 'String', boolean: 'Boolean', integer: 'Integer', float: 'Float', false: 'False / unset', list: 'List (JSON)', date: 'Date', datetime: 'Date/time (UTC)', empty: 'Empty string' };
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function announce(message) { $('#status').textContent = message; clearTimeout(timer); timer = setTimeout(() => { $('#status').textContent = ''; }, 5000); }
function persist() { if (!saveDraft(tree, theme, formatted, modelContext) && !storageWarning) { storageWarning = true; announce('Local saving is unavailable. Copy your domain before closing.'); } }
function button(text, className, action, title) { const node = el('button', className, text); node.type = 'button'; if (title) node.title = title; node.addEventListener('click', action); return node; }
function select(values, value, label, onChange) { const node = el('select'); for (const item of values) { const [v, text] = Array.isArray(item) ? item : [item, item]; const option = el('option', '', text); option.value = v; node.append(option); } node.value = value; node.setAttribute('aria-label', label); node.addEventListener('change', () => onChange(node.value)); return node; }
function field(label, control, id, part) { const wrapper = el('label', 'field'); wrapper.append(el('span', 'field-label', label), control); control.id = id + '-' + part; control.dataset.path = id; control.dataset.part = part; control.setAttribute('aria-describedby', id + '-error'); return wrapper; }
function focusField(path) { document.getElementById('n' + path.join('-') + '-field')?.focus(); }
function update() {
  $('#review-model').textContent = modelContext?.model ? 'Model: ' + modelContext.model : 'Manual fields';
  result = compile(tree, formatted);
  result.errors.push(...modelErrors(tree, currentCatalog));
  if (busy || (modelRequired && !currentCatalog)) result.errors.unshift({ path: '', part: '', message: busy ? 'Loading model metadata…' : 'Choose an Odoo model above, or switch to manual fields.' });
  $('#builder').inert = busy || (modelRequired && !currentCatalog);
  if (result.errors.length) result.code = '';
  $('#output').textContent = result.errors.length ? 'Complete the highlighted conditions to generate a domain.' : result.code;
  $('#copy').disabled = Boolean(result.errors.length);
  syncPreview();
  $('#next').disabled = Boolean(result.errors.length);
  $('#step-review').disabled = Boolean(result.errors.length);
  $('#validity').textContent = result.errors.length ? 'Needs attention' : 'Valid syntax';
  $('#validity').classList.toggle('invalid', Boolean(result.errors.length));
  $('#summary').textContent = result.count ? `${result.count} condition${result.count === 1 ? '' : 's'} · ${result.errors.length ? 'Check inputs' : 'Ready to copy'}` : 'Empty domain · Matches all records';
  $('#format').setAttribute('aria-pressed', String(formatted));
  $('#format').textContent = formatted ? 'Compact' : 'Format';
  document.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
  document.querySelectorAll('.inline-error').forEach(node => { node.textContent = ''; });
  for (const error of result.errors) {
    const id = 'n' + error.path.replaceAll('.', '-');
    const control = document.getElementById(id + '-' + error.part);
    control?.setAttribute('aria-invalid', 'true');
    const display = document.getElementById(id + '-error');
    if (display && !display.textContent) display.textContent = error.message;
  }
  $('#errors').textContent = result.errors.length ? `${result.errors.length} issue${result.errors.length === 1 ? '' : 's'} to fix. ${result.errors[0].message}` : '';
  document.querySelectorAll('[data-add]').forEach(node => { node.disabled = result.count >= MAX_CONDITIONS; });
  persist();
}
function renderCondition(node, path, parent) {
  const id = 'n' + path.join('-');
  const card = el('div', 'condition');
  const row = el('div', 'condition-grid');
  const info = currentCatalog?.info(node.field.trim());
  const input = el('input'); input.value = node.field; input.placeholder = currentCatalog ? 'Choose a field…' : 'e.g. partner_id.name'; input.maxLength = 256; input.autocomplete = 'off'; input.spellcheck = false;
  const suggestions = el('datalist'); suggestions.id = id + '-fields';
  if (currentCatalog) {
    for (const metadata of Object.values(currentCatalog.cache.get(currentCatalog.model) || {})) { const option = el('option', '', `${metadata.label} · ${metadata.type}`); option.value = metadata.name; suggestions.append(option); }
    input.setAttribute('list', suggestions.id);
  } else input.setAttribute('list', 'fields');
  input.addEventListener('input', () => { node.field = input.value; update(); });
  async function useField(name, metadata) {
    node.field = name;
    if (metadata) { node.type = defaultType(metadata); node.operator = '='; node.value = node.type === 'boolean' ? 'true' : ''; }
    render(); document.getElementById(id + '-value')?.focus();
  }
  input.addEventListener('change', async () => {
    if (!currentCatalog) return;
    const chosen = input.value.trim();
    const catalog = currentCatalog, selectedModel = currentCatalog.model;
    try { await catalog.parent(chosen); if (catalog === currentCatalog && catalog.model === selectedModel && node.field.trim() === chosen) useField(chosen, catalog.info(chosen)); }
    catch (error) { announce(error.message); }
  });
  const fieldWrapper = field('Field', input, id, 'field');
  if (currentCatalog) {
    const browse = button('Browse fields', 'browse-button', () => {
      const parts = node.field.trim().split('.'); parts.pop();
      browseFields(currentCatalog, useField, browse, parts.length ? parts.join('.') + '.' : '');
    });
    fieldWrapper.append(browse);
    if (info?.relation && ['many2one', 'one2many', 'many2many'].includes(info.type) && node.field.trim().split('.').length <= 8) {
      const child = button('Child fields →', 'browse-button', () => browseFields(currentCatalog, useField, child, node.field.trim() + '.'), `Browse fields of ${info.relation}`);
      fieldWrapper.append(child);
    }
  }
  row.append(fieldWrapper); card.append(suggestions);
  const supportedOperators = info && !['char', 'text', 'html', 'selection'].includes(info.type) ? OPERATORS.filter(op => !['ilike', 'not ilike', 'like', 'not like', '=like', '=ilike'].includes(op)) : OPERATORS;
  const operator = select([...new Set([...supportedOperators, node.operator])], node.operator, 'Operator', value => {
    node.operator = value;
    if (!['in', 'not in'].includes(value) && node.type === 'list' && info) { node.type = defaultType(info); node.value = node.type === 'boolean' ? 'true' : ''; }
    if (['in', 'not in'].includes(value) && node.type !== 'list') { node.type = 'list'; node.value = ''; }
    if (['like', 'not like', 'ilike', 'not ilike', '=like', '=ilike'].includes(value) && node.type !== 'string') { node.type = 'string'; node.value = ''; }
    if (['child_of', 'parent_of'].includes(value) && !['integer', 'list'].includes(node.type)) { node.type = 'integer'; node.value = ''; }
    render(); document.getElementById(id + '-operator')?.focus();
  });
  row.append(field('Operator', operator, id, 'operator'));
  row.append(field('Value type', select(TYPES.map(type => [type, typeNames[type]]), node.type, 'Value type', value => { node.type = value; node.value = value === 'boolean' ? 'true' : ''; render(); document.getElementById(id + '-type')?.focus(); }), id, 'type'));
  let value;
  if (info?.type === 'selection' && info.selection.length && ['=', '!=', '=?'].includes(node.operator) && ['string', 'integer'].includes(node.type)) {
    value = select([['', 'Choose a value…'], ...info.selection.map(([key, label]) => [String(key), `${label} (${key})`])], node.value, 'Value', raw => { node.value = raw; update(); });
  } else if (node.type === 'boolean') value = select([['true', 'True'], ['false', 'False']], node.value, 'Value', raw => { node.value = raw; update(); });
  else {
    value = el('input'); value.value = node.type === 'false' ? 'False' : node.value; value.disabled = ['false', 'empty'].includes(node.type);
    if (node.type === 'empty') value.value = "''";
    if (node.type === 'date') value.type = 'date';
    if (node.type === 'datetime') { value.type = 'datetime-local'; value.step = '1'; } value.maxLength = 10000; value.spellcheck = false;
    value.placeholder = { string: 'e.g. draft', integer: 'e.g. 10', float: 'e.g. 10.5', list: '["draft", "sent"]' }[node.type] || '';
    value.addEventListener('input', () => { node.value = value.value; update(); });
  }
  const valueWrapper = field(node.type === 'datetime' ? 'Value (UTC)' : 'Value', value, id, 'value');
  if (info?.relation && ['many2one', 'one2many', 'many2many'].includes(info.type) && ['integer', 'list'].includes(node.type)) {
    const selectedLabel = el('span', 'selected-record-label');
    const savedLabel = selectedRecordLabels.get(node);
    if (savedLabel?.field === node.field && savedLabel.value === node.value) selectedLabel.textContent = savedLabel.text;
    value.addEventListener('input', () => { selectedRecordLabels.delete(node); selectedLabel.textContent = ''; });
    const pick = button(node.type === 'list' ? 'Select records…' : 'Select record…', 'browse-button', () => {
      const catalog = currentCatalog, context = modelContext, fieldName = node.field, valueType = node.type;
      if (!catalog || !context || busy || catalog.info(node.field.trim())?.relation !== info.relation) return;
      let ids = [];
      try { ids = valueType === 'list' ? JSON.parse(node.value || '[]') : [Number(node.value)]; } catch { /* Replace invalid manual input with a selection. */ }
      if (!Array.isArray(ids)) ids = [];
      ids = [...new Set(ids.filter(item => Number.isSafeInteger(item) && item > 0))].slice(0, 1000);
      pickRecords({ model: info.relation, database: context.database, label: info.label, multiple: valueType === 'list', ids, trigger: pick,
        onChoose(records) {
          if (catalog !== currentCatalog || context !== modelContext || node.field !== fieldName || node.type !== valueType || !parent.children.includes(node)) return;
          node.value = valueType === 'list' ? JSON.stringify(records.map(record => record.id)) : String(records[0].id);
          selectedRecordLabels.set(node, { field: node.field, value: node.value, text: records.map(record => record.name).join(', ') });
          render(); document.getElementById(id + '-value')?.focus();
        }
      });
    }, `Search ${info.relation} by name`);
    valueWrapper.append(pick, selectedLabel);
  }
  row.append(valueWrapper);
  const remove = button('×', 'remove-button', () => { parent.children.splice(path.at(-1), 1); render(); document.getElementById('n' + path.slice(0, -1).join('-') + '-add')?.focus(); }, 'Remove condition'); remove.setAttribute('aria-label', 'Remove condition');
  row.append(remove); card.append(row);
  if (node.field.includes('.') && currentCatalog) card.append(el('p', 'field-description', `${currentCatalog.model} → ${node.field.trim().split('.').join(' → ')}`));
  if (info) card.append(el('p', 'field-description', `${info.label} · ${info.type}${info.relation ? ' → ' + info.relation + ' · select records by name or enter IDs' : ''}${info.searchable ? '' : ' · not searchable'}`));
  const error = el('p', 'inline-error'); error.id = id + '-error'; card.append(error);
  return card;
}
function renderGroup(node, path = [], depth = 0, parent = null) {
  const id = 'n' + path.join('-');
  const section = el('div', depth ? 'group nested' : 'group');
  const toolbar = el('div', 'group-toolbar');
  const logic = select([['AND', 'AND · Match all'], ['OR', 'OR · Match any']], node.logic, depth ? 'Nested group logic' : 'Group logic', value => { node.logic = value; render(); document.getElementById(id + '-logic')?.focus(); }); logic.id = id + '-logic'; toolbar.append(logic);
  const not = button('NOT', 'not-button', () => { node.not = !node.not; render(); document.getElementById(id + '-not')?.focus(); }, 'Negate this entire group'); not.id = id + '-not'; not.setAttribute('aria-pressed', String(node.not)); toolbar.append(not);
  toolbar.append(el('span', 'group-caption', depth ? `Group ${depth}` : 'Combine your conditions'));
  if (parent) { const remove = button('×', 'remove-button', () => { parent.children.splice(path.at(-1), 1); render(); document.getElementById('n' + path.slice(0, -1).join('-') + '-add')?.focus(); }, 'Remove group'); remove.setAttribute('aria-label', 'Remove group'); toolbar.append(remove); }
  section.append(toolbar);
  node.children.forEach((child, index) => {
    if (index) section.append(el('div', 'join-label', node.logic));
    section.append(child.kind === 'group' ? renderGroup(child, [...path, index], depth + 1, node) : renderCondition(child, [...path, index], node));
  });
  if (!node.children.length) section.append(el('p', 'empty-state', depth ? 'Add a condition to define this group.' : 'Start with a condition or choose an example below.'));
  const error = el('p', 'inline-error'); error.id = id + '-error'; section.append(error);
  const actions = el('div', 'builder-actions');
  const add = button('+ Add Condition', 'secondary', () => { node.children.push(condition()); render(); focusField([...path, node.children.length - 1]); }); add.id = id + '-add'; add.dataset.add = 'condition'; actions.append(add);
  if (depth < MAX_DEPTH) { const addGroup = button('+ Add Group', 'text-button', () => { node.children.push(group('OR', [condition()])); render(); focusField([...path, node.children.length - 1, 0]); }, 'Add a nested AND / OR group'); addGroup.dataset.add = 'group'; actions.append(addGroup); }
  section.append(actions); return section;
}
function render() { $('#builder').replaceChildren(renderGroup(tree)); update(); }
function applyTheme() { document.documentElement.dataset.theme = theme; $('#theme').title = `Theme: ${theme}. Click to change.`; $('#theme').setAttribute('aria-label', `Theme: ${theme}. Change theme`); }
$('#theme').addEventListener('click', () => { theme = theme === 'light' ? 'dark' : 'light'; applyTheme(); persist(); announce(`Theme: ${theme}`); });
$('#format').addEventListener('click', () => { formatted = !formatted; update(); });
$('#copy').addEventListener('click', async () => {
  if (result.errors.length) return;
  try { await navigator.clipboard.writeText(result.code); announce('Copied! Domain is on your clipboard.'); }
  catch { const range = document.createRange(); range.selectNodeContents($('#output')); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); $('#output').focus(); announce('Clipboard unavailable. Domain selected; press Ctrl+C or ⌘C to copy.'); }
});
$('#clear').addEventListener('click', () => { tree = group(); clearDraft(); render(); showStep('build'); $('#n-add').focus(); announce('Domain cleared.'); });
for (const example of EXAMPLES) { const item = button('', 'example', () => { tree = structuredClone(example.tree); render(); announce(`${example.name} loaded.`); }); item.dataset.example = String(EXAMPLES.indexOf(example)); item.append(el('strong', '', example.name), el('code', '', example.detail)); $('#example-list').append(item); }
for (const operator of OPERATORS) $('#operator-list').append(el('code', '', operator));
let step = 'build';
function showStep(next) {
  if (next === 'review' && result.errors.length) return;
  step = next;
  const review = next === 'review';
  $('#build-step').hidden = review;
  $('#review-step').hidden = !review;
  $('#back').hidden = !review;
  $('#done').hidden = !review;
  $('#next').hidden = review;
  $('#step-build').toggleAttribute('aria-current', !review);
  $('#step-review').toggleAttribute('aria-current', review);
  (review ? $('#step-review') : $('#step-build')).setAttribute('aria-current', 'step');
  $('.wizard-content').scrollTop = 0;
  (review ? $('#output') : $('#step-build')).focus();
}
$('#step-build').addEventListener('click', () => showStep('build'));
$('#step-review').addEventListener('click', () => showStep('review'));
$('#next').addEventListener('click', () => showStep('review'));
$('#back').addEventListener('click', () => showStep('build'));
function closeWizard() { persist(); window.close(); }
$('#close').addEventListener('click', closeWizard);
$('#done').addEventListener('click', closeWizard);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && event.target === document.body) closeWizard(); });
applyTheme(); render();
setupModels({
  savedContext: stored?.modelContext,
  onBusy(value) { busy = value; if (value) pickRecords.close(); update(); },
  onReset() { currentCatalog = null; modelContext = null; modelRequired = true; },
  async onSelect(catalog, context, restore) {
    currentCatalog = catalog; modelContext = context; modelRequired = true;
    if (!restore) tree = group('AND', [condition()]);
    else {
      const fields = [];
      const visit = node => node.kind === 'group' ? node.children.forEach(visit) : fields.push(node.field);
      visit(tree);
      await Promise.allSettled(fields.filter(Boolean).map(name => catalog.parent(name)));
    }
    if (currentCatalog !== catalog) return;
    for (const item of document.querySelectorAll('[data-example]')) {
      const example = EXAMPLES[Number(item.dataset.example)];
      item.hidden = example.tree.children.some(node => !catalog.info(node.field));
    }
    showStep('build'); render();
  },
  onManual() { currentCatalog = null; modelContext = null; modelRequired = false; document.querySelectorAll('[data-example]').forEach(item => { item.hidden = false; }); render(); }
});

function syncPreview() {
  syncPreviewFields();
  const key = JSON.stringify([tree, modelContext, busy, Boolean(currentCatalog), result.errors, selectedPreviewFields]);
  if (key !== previewKey) {
    previewKey = key; ++previewToken; previewLoading = false; previewRows = []; previewHasMore = false;
    $('#record-preview').hidden = true; $('#records-table').replaceChildren(); $('#records-status').textContent = '';
    $('#load-more-records').hidden = true;
  }
  $('#load-data').disabled = previewLoading || busy || !currentCatalog || !modelContext || !selectedPreviewFields.length || Boolean(result.errors.length);
  $('#load-data').textContent = previewLoading ? 'Loading…' : 'Load data';
  $('#load-data-hint').textContent = currentCatalog ? (selectedPreviewFields.length ? 'Choose your columns above, then load matching records, 50 at a time.' : 'Select at least one field above to load data.') : 'Connect to Odoo and choose a model to load matching records.';
  $('#load-more-records').disabled = previewLoading;
}
function recordFormUrl(recordId) {
  if (!Number.isSafeInteger(recordId) || recordId <= 0 || !MODEL_NAME.test(modelContext?.model || '')) return '';
  try {
    const sourceOrigin = new URL(location.href).searchParams.get('origin');
    const origin = new URL(modelContext.origin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== sourceOrigin) return '';
    const url = new URL('/web', origin.origin);
    if (modelContext.database) url.searchParams.set('db', modelContext.database);
    url.hash = new URLSearchParams({ id: String(recordId), model: modelContext.model, view_type: 'form' }).toString();
    return url.href;
  } catch { return ''; }
}
function renderRecords() {
  const table = el('table');
  const caption = el('caption', '', `${modelContext.model} · ${previewRows.length} records loaded`); table.append(caption);
  const head = el('thead'), headings = el('tr');
  const openHeading = el('th', '', 'Open'); openHeading.scope = 'col'; headings.append(openHeading);
  for (const name of previewFields) { const th = el('th', '', name.includes('.') ? name : currentCatalog.info(name)?.label || name); th.title = name; th.scope = 'col'; headings.append(th); }
  head.append(headings); table.append(head);
  const body = el('tbody');
  for (const row of previewRows) {
    const tr = el('tr');
    const action = el('td', 'record-open-cell');
    const href = recordFormUrl(row.id);
    if (href) {
      const link = el('a', 'record-open-link', 'Open in Odoo ↗');
      link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.title = `Open ${modelContext.model} #${row.id} in a new tab`;
      link.setAttribute('aria-label', link.title);
      action.append(link);
    } else action.textContent = 'Unavailable';
    tr.append(action);
    for (const name of previewFields) {
      const value = row[name], info = currentCatalog.info(name);
      const format = item => {
        if (item === null || item === undefined || item === false) return info?.type === 'boolean' ? 'False' : '—';
        if (info?.type === 'selection') return String(info.selection.find(([key]) => key === item)?.[1] ?? item);
        if (Array.isArray(item)) return info?.type === 'many2one' ? String(item[1] ?? item[0]) : item.join(', ');
        return typeof item === 'object' ? JSON.stringify(item) : String(item);
      };
      const text = name.includes('.') && Array.isArray(value?.values) ? (value.values.map(format).join('; ') || '—') : format(value);
      tr.append(el('td', '', text));
    }
    body.append(tr);
  }
  table.append(body); $('#records-table').replaceChildren(table);
}
async function loadRecords(more = false) {
  if (previewLoading || busy || !currentCatalog || !modelContext || !selectedPreviewFields.length || result.errors.length || (more && !previewHasMore)) return;
  const token = ++previewToken;
  previewLoading = true; syncPreview(); $('#record-preview').hidden = false;
  $('#records-status').classList.remove('error-text'); $('#records-status').textContent = 'Loading matching records…';
  try {
    const domain = toRpcDomain(tree);
    if (!more) {
      previewRows = []; previewHasMore = false; $('#records-table').replaceChildren(); $('#load-more-records').hidden = true;
      previewFields = [...selectedPreviewFields];
    }
    const response = await browser.runtime.sendMessage({ type: 'odoo-metadata', operation: 'records', database: modelContext.database, model: modelContext.model, domain, fields: previewFields, offset: previewRows.length });
    if (token !== previewToken) return;
    if (!response?.ok) throw new Error(response?.error || 'Unable to load records. Reconnect from your Odoo tab and try again.');
    previewRows.push(...response.data.rows); previewHasMore = response.data.hasMore;
    if (previewRows.length) renderRecords();
    $('#records-status').textContent = previewRows.length ? `${previewRows.length} records loaded${previewHasMore ? ' · More available' : ' · All matching records loaded'}.` : 'No records match this domain for your account.';
    $('#load-more-records').hidden = !previewHasMore;
  } catch (error) {
    if (token === previewToken) { $('#records-status').textContent = error.message; $('#records-status').classList.add('error-text'); }
  } finally { if (token === previewToken) { previewLoading = false; syncPreview(); } }
}
$('#load-data').addEventListener('click', () => loadRecords());
$('#load-more-records').addEventListener('click', () => loadRecords(true));

function syncPreviewFields() {
  $('#preview-field-picker').hidden = !currentCatalog || busy;
  if (previewFieldCatalog === currentCatalog && previewFieldModel === (currentCatalog?.model || '')) return;
  previewFieldCatalog = currentCatalog;
  previewFieldModel = currentCatalog?.model || '';
  previewFieldPrefix = ''; ++previewBrowseToken;
  selectedPreviewFields = [];
  $('#preview-field-search').value = '';
  if (currentCatalog) {
    const fields = new Set(['id']);
    if (currentCatalog.info('display_name')) fields.add('display_name');
    const visit = node => {
      if (node.kind === 'group') return node.children.forEach(visit);
      const name = node.field.trim().split('.')[0];
      const info = currentCatalog.info(name);
      if (info && info.type !== 'binary') fields.add(name);
    };
    visit(tree);
    selectedPreviewFields = [...fields].slice(0, 12);
  }
  renderPreviewFields();
}
function renderSelectedPreviewFields() {
  $('#preview-field-count').textContent = `${selectedPreviewFields.length} / 12 selected`;
  const selected = $('#preview-selected-fields'); selected.replaceChildren();
  for (const name of selectedPreviewFields) {
    const remove = button(`${name} ×`, 'secondary', () => {
      selectedPreviewFields = selectedPreviewFields.filter(field => field !== name);
      syncPreview(); renderPreviewFields();
    }, `Remove ${name}`);
    remove.setAttribute('aria-label', `Remove ${name}`); selected.append(remove);
  }
}
function previewParentModel() {
  if (!previewFieldPrefix) return currentCatalog?.model;
  return currentCatalog?.info(previewFieldPrefix.slice(0, -1))?.relation;
}
function renderPreviewFields() {
  const container = $('#preview-field-options'); container.replaceChildren();
  renderSelectedPreviewFields();
  $('#preview-field-parent').disabled = !previewFieldPrefix;
  $('#preview-field-path').textContent = currentCatalog ? `${currentCatalog.model}${previewFieldPrefix ? ' → ' + previewFieldPrefix.slice(0, -1) : ''}` : '';
  if (!currentCatalog) return;
  const fields = { id: { name: 'id', label: 'ID', type: 'integer' }, ...currentCatalog.cache.get(previewParentModel()) };
  const query = $('#preview-field-search').value.trim().toLocaleLowerCase();
  const matches = Object.values(fields).filter(info => info.type !== 'binary' && `${info.label} ${info.name}`.toLocaleLowerCase().includes(query)).sort((a, b) => a.label.localeCompare(b.label));
  for (const info of matches) {
    const path = previewFieldPrefix + info.name;
    const row = el('div', 'preview-field-row');
    const label = el('label', 'preview-field-option'), input = el('input');
    input.type = 'checkbox'; input.value = path;
    input.checked = selectedPreviewFields.includes(path);
    input.disabled = !input.checked && selectedPreviewFields.length >= 12;
    input.addEventListener('change', () => {
      if (input.checked) { if (selectedPreviewFields.length < 12) selectedPreviewFields.push(path); }
      else selectedPreviewFields = selectedPreviewFields.filter(name => name !== path);
      syncPreview(); renderSelectedPreviewFields();
      container.querySelectorAll('input').forEach(checkbox => {
        checkbox.checked = selectedPreviewFields.includes(checkbox.value);
        checkbox.disabled = !checkbox.checked && selectedPreviewFields.length >= 12;
      });
    });
    const text = el('span'); text.append(el('strong', '', info.label), el('small', '', path));
    label.append(input, text); row.append(label);
    if (info.relation && ['many2one', 'one2many', 'many2many'].includes(info.type) && path.split('.').length <= 8) {
      row.append(button('Related fields →', 'text-button', () => browsePreviewFields(path + '.'), `Browse ${info.relation}`));
    }
    container.append(row);
  }
  if (!matches.length) container.append(el('p', 'model-hint', 'No fields match your search.'));
}
async function browsePreviewFields(prefix) {
  const catalog = currentCatalog, model = catalog?.model, token = ++previewBrowseToken;
  if (!catalog) return;
  $('#preview-field-options').replaceChildren(el('p', 'model-hint', 'Loading related fields…'));
  try {
    await catalog.parent(prefix);
    if (token !== previewBrowseToken || currentCatalog !== catalog || catalog.model !== model) return;
    previewFieldPrefix = prefix; $('#preview-field-search').value = ''; renderPreviewFields();
  } catch (error) {
    if (token === previewBrowseToken) {
      renderPreviewFields(); $('#preview-field-options').prepend(el('p', 'error-text', error.message));
    }
  }
}
$('#preview-field-parent').addEventListener('click', () => {
  const parts = previewFieldPrefix.split('.'); parts.splice(-2);
  browsePreviewFields(parts.length ? parts.join('.') + '.' : '');
});
$('#preview-field-search').addEventListener('input', () => { ++previewBrowseToken; renderPreviewFields(); });
