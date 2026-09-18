import { FieldCatalog, MODEL_NAME } from '../domain/catalog.js';

const $ = selector => document.querySelector(selector);
function textElement(tag, text, className) { const element = document.createElement(tag); element.textContent = text; if (className) element.className = className; return element; }

export function setupModels({ savedContext, onSelect, onManual, onBusy, onReset }) {
  let session = null, catalog = null, selected = '', listOffset = 0, query = '', generation = 0, modelGeneration = 0, connectionGeneration = 0, searchTimer;
  async function request(operation, args = {}) {
    const response = await browser.runtime.sendMessage({ type: 'odoo-metadata', operation, database: session?.database, ...args });
    if (!response?.ok) throw new Error(response?.error || 'Unable to contact Odoo. Reopen the wizard from your Odoo tab.');
    return response.data;
  }
  function status(message, error = false) { $('#model-status').textContent = message; $('#model-status').classList.toggle('error-text', error); }
  async function listModels(reset = true) {
    if (!session) return;
    const token = ++generation;
    if (reset) { listOffset = 0; $('#model-options').replaceChildren(); }
    $('#more-models').disabled = true;
    try {
      const rows = await request('models', { query, offset: listOffset });
      if (token !== generation) return;
      for (const row of rows) { const option = document.createElement('option'); option.value = row.model; option.label = row.name; $('#model-options').append(option); }
      listOffset += rows.length;
      $('#more-models').hidden = rows.length < 500;
      $('#model-list-status').textContent = `${listOffset} models ${query ? 'matching your search' : 'loaded'}. Search by label or technical name.`;
    } catch (error) {
      if (token === generation) $('#model-list-status').textContent = error.message + ' You can still enter a known technical model name and choose Load fields.';
    } finally { if (token === generation) $('#more-models').disabled = false; }
  }
  async function choose(model, restore = false) {
    if (!session) return status('Connect from a logged-in Odoo tab first.', true);
    if (!MODEL_NAME.test(model) || model.length > 128) return status('Choose a model or enter its technical name, for example sale.order.', true);
    const token = ++modelGeneration;
    const candidate = catalog || new FieldCatalog(name => request('fields', { model: name }));
    $('#load-model').disabled = true; $('#model-input').disabled = true; onBusy(true); status(`Loading all fields of ${model}…`);
    try {
      const fields = await candidate.fields(model);
      if (token !== modelGeneration) return;
      const same = selected === model; candidate.model = model; catalog = candidate; selected = model;
      $('#model-input').value = model;
      const modelContext = { origin: session.origin, database: session.database, model };
      savedContext = modelContext;
      await onSelect(catalog, modelContext, restore || same);
      if (token !== modelGeneration) return;
      status(`${model} · ${Object.keys(fields).length} fields loaded, including custom fields. Non-searchable fields are marked.`);
      $('#selected-model').textContent = `${model} · ${Object.keys(fields).length} fields`;
      $('#model-settings').hidden = true; $('#change-model').hidden = false; $('#change-model').setAttribute('aria-expanded', 'false');
      $('#connection-badge').textContent = `${session.origin} · ${session.version || 'Odoo'}`;
    } catch (error) {
      if (token === modelGeneration) { status(error.message, true); $('#model-input').value = selected; }
    } finally { if (token === modelGeneration) { $('#load-model').disabled = false; $('#model-input').disabled = false; onBusy(false); } }
  }
  async function connect() {
    const connection = ++connectionGeneration;
    $('#model-settings').hidden = false; $('#change-model').setAttribute('aria-expanded', 'true');
    clearTimeout(searchTimer);
    ++generation; ++modelGeneration; catalog = null; session = null; selected = ''; onReset();
    $('#connect').disabled = true; $('#load-model').disabled = true; $('#model-input').disabled = true; onBusy(true);
    status('Connecting to your selected Odoo tab…');
    try {
      const info = await request('session');
      if (connection !== connectionGeneration) return;
      session = info;
      $('#connection-badge').textContent = `${session.origin} · ${session.version || 'Odoo'}`;
      status('Connected. Choose a model to load its fields.');
      query = ''; await listModels();
      if (connection !== connectionGeneration) return;
      if (savedContext?.origin === session.origin && savedContext?.database === session.database && MODEL_NAME.test(savedContext.model || '')) await choose(savedContext.model, true);
    } catch (error) { if (connection === connectionGeneration) { status(error.message, true); $('#connection-badge').textContent = 'Not connected'; } }
    finally { if (connection === connectionGeneration) { $('#connect').disabled = false; $('#model-input').disabled = !session; $('#load-model').disabled = !session; onBusy(false); } }
  }
  $('#change-model').addEventListener('click', () => { $('#model-settings').hidden = !$('#model-settings').hidden; $('#change-model').setAttribute('aria-expanded', String(!$('#model-settings').hidden)); if (!$('#model-settings').hidden) $('#model-input').focus(); });
  $('#connect').addEventListener('click', connect);
  $('#load-model').addEventListener('click', () => choose($('#model-input').value.trim()));
  $('#model-input').addEventListener('change', () => { const value = $('#model-input').value.trim(); if (value !== selected && [...$('#model-options').options].some(option => option.value === value)) choose(value); });
  $('#model-input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); choose($('#model-input').value.trim()); } });
  $('#model-input').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { query = $('#model-input').value.trim(); listModels(); }, 350); });
  $('#more-models').addEventListener('click', () => listModels(false));
  $('#manual').addEventListener('click', () => { ++connectionGeneration; ++generation; ++modelGeneration; clearTimeout(searchTimer); savedContext = null; onBusy(false); catalog = null; selected = ''; $('#connect').disabled = false; $('#load-model').disabled = !session; $('#model-input').disabled = !session; onManual(); $('#selected-model').textContent = 'Manual fields'; status('Manual mode: enter any technical field name. No model metadata validation.'); });
  const source = new URL(location.href).searchParams;
  if (source.has('sourceTab')) connect();
  else status('Open your logged-in Odoo tab, then click the extension icon. You can also use manual fields.');
  return { connect };
}

/** Search all returned fields, or drill into any relational model. */
export function setupFieldBrowser() {
  const dialog = $('#field-dialog');
  let catalog, prefix = '', choose, fields = {}, token = 0, returnFocus;
  function render() {
    const search = $('#field-search').value.toLocaleLowerCase();
    $('#field-list').replaceChildren();
    const matches = Object.values(fields).filter(field => `${field.label} ${field.name} ${field.type}`.toLocaleLowerCase().includes(search)).sort((a, b) => a.label.localeCompare(b.label));
    for (const info of matches) {
      const row = textElement('div', '', 'field-choice');
      const fieldPath = prefix + info.name;
      const relational = Boolean(info.relation) && ['many2one', 'one2many', 'many2many'].includes(info.type);
      const canBrowse = relational && prefix.split('.').length <= 8;
      const pick = textElement('button', '', 'field-pick'); pick.type = 'button'; pick.disabled = !canBrowse && !info.searchable;
      pick.append(textElement('strong', info.label + (canBrowse ? ' →' : '')), textElement('small', `${fieldPath} · ${info.type}${info.searchable ? '' : ' · not searchable'}`));
      if (canBrowse) {
        pick.append(textElement('small', `Open child fields of ${info.relation}`));
        pick.setAttribute('aria-label', `Browse child fields of ${fieldPath}`);
        pick.addEventListener('click', () => load(fieldPath + '.'));
      } else pick.addEventListener('click', () => { dialog.close(); choose(fieldPath, info); });
      row.append(pick);
      if (relational) {
        const ids = textElement('button', 'Use record IDs', 'text-button'); ids.type = 'button'; ids.disabled = !info.searchable;
        ids.setAttribute('aria-label', `Use ${fieldPath} as record IDs`);
        ids.addEventListener('click', () => { dialog.close(); choose(fieldPath, info); }); row.append(ids);
      }
      $('#field-list').append(row);
    }
    if (!matches.length) $('#field-list').append(textElement('p', 'No fields match your search.'));
    $('#field-count').textContent = `${matches.length} of ${Object.keys(fields).length} fields`;
  }
  async function load(next) {
    const current = ++token; $('#field-list').replaceChildren(textElement('p', 'Loading fields…'));
    try {
      const parent = await catalog.parent(next);
      if (current !== token || !dialog.open) return;
      prefix = next; fields = parent.fields; $('#field-search').value = '';
      $('#field-path').replaceChildren();
      const addCrumb = (text, target) => {
        const crumb = textElement('button', text, 'text-button'); crumb.type = 'button';
        crumb.addEventListener('click', () => load(target)); $('#field-path').append(crumb);
      };
      addCrumb(catalog.model, '');
      const parts = prefix.split('.').filter(Boolean);
      parts.forEach((part, index) => { $('#field-path').append(textElement('span', ' → ')); addCrumb(part, parts.slice(0, index + 1).join('.') + '.'); });
      $('#field-dialog-title').textContent = prefix ? `Child fields · ${parent.model}` : 'Choose a field';
      $('#field-parent').disabled = !prefix; render(); $('#field-search').focus();
    } catch (error) {
      if (current === token && dialog.open) {
        const home = textElement('button', 'Back to model fields', 'secondary'); home.type = 'button'; home.addEventListener('click', () => load(''));
        $('#field-list').replaceChildren(textElement('p', error.message, 'error-text'), home);
      }
    }
  }
  $('#field-search').addEventListener('input', render);
  $('#field-parent').addEventListener('click', () => { const parts = prefix.split('.'); parts.splice(-2); load(parts.length ? parts.join('.') + '.' : ''); });
  $('#field-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { ++token; returnFocus?.focus(); });
  return (source, onChoose, trigger, initialPath = '') => { catalog = source; choose = onChoose; returnFocus = trigger; prefix = ''; fields = {}; $('#field-path').replaceChildren(); $('#field-count').textContent = ''; $('#field-parent').disabled = true; dialog.showModal(); load(initialPath); };
}
