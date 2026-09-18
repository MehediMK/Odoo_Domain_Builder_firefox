const $ = selector => document.querySelector(selector);
function element(tag, text, className) {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text;
  if (className) node.className = className; return node;
}

export function setupRecordPicker() {
  const dialog = $('#record-picker');
  let options, selected = new Map(), rows = [], offset = 0, hasMore = false, token = 0, timer;
  function selection() {
    $('#record-picker-selected').replaceChildren();
    for (const [id, name] of selected) {
      const remove = element('button', `${name} · ID ${id} ×`, 'secondary'); remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${name}`);
      remove.addEventListener('click', () => { selected.delete(id); render(); });
      $('#record-picker-selected').append(remove);
    }
    $('#record-picker-apply').textContent = `Use selected (${selected.size})`;
    $('#record-picker-apply').disabled = !selected.size;
  }
  function render() {
    selection(); const list = $('#record-picker-results'); list.replaceChildren();
    for (const record of rows) {
      if (options.multiple) {
        const label = element('label', undefined, 'record-option');
        const input = element('input'); input.type = 'checkbox'; input.checked = selected.has(record.id);
        input.disabled = !input.checked && selected.size >= 1000;
        input.addEventListener('change', () => {
          if (input.checked) selected.set(record.id, record.name); else selected.delete(record.id);
          selection();
          list.querySelectorAll('input').forEach(checkbox => { checkbox.disabled = !checkbox.checked && selected.size >= 1000; });
        });
        label.append(input, element('span', `${record.name} · ID ${record.id}`)); list.append(label);
      } else {
        const pick = element('button', `${record.name} · ID ${record.id}`, 'record-option'); pick.type = 'button';
        pick.addEventListener('click', () => { const apply = options.onChoose; dialog.close(); apply([record]); }); list.append(pick);
      }
    }
  }
  async function search(more = false) {
    clearTimeout(timer); const current = ++token;
    if (!more) { rows = []; offset = 0; hasMore = false; render(); }
    $('#record-picker-more').hidden = true; $('#record-picker-retry').hidden = true;
    $('#record-picker-status').textContent = 'Loading records…'; $('#record-picker-status').classList.remove('error-text');
    try {
      const response = await browser.runtime.sendMessage({ type: 'odoo-metadata', operation: 'record-options', model: options.model, database: options.database, query: $('#record-picker-search').value.trim(), offset });
      if (current !== token || !dialog.open) return;
      if (!response?.ok) throw new Error(response?.error || 'Could not load records. Reconnect to Odoo and try again.');
      rows.push(...response.data.rows); offset += response.data.rows.length; hasMore = response.data.hasMore;
      // Resolve labels for already-selected IDs without changing their selection.
      for (const row of response.data.rows) if (selected.has(row.id)) selected.set(row.id, row.name);
      render(); $('#record-picker-status').textContent = rows.length ? `${rows.length} records shown${hasMore ? ' · More available' : ''}.` : 'No matching records.';
      $('#record-picker-more').hidden = !hasMore;
    } catch (error) {
      if (current === token && dialog.open) {
        $('#record-picker-status').textContent = error.message; $('#record-picker-status').classList.add('error-text');
        $('#record-picker-retry').hidden = false; $('#record-picker-more').hidden = !hasMore;
      }
    }
  }
  $('#record-picker-search').addEventListener('input', () => {
    ++token; clearTimeout(timer); rows = []; offset = 0; hasMore = false; render();
    $('#record-picker-more').hidden = true; $('#record-picker-retry').hidden = true;
    $('#record-picker-status').textContent = 'Searching…'; timer = setTimeout(() => search(), 300);
  });
  $('#record-picker-search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
  $('#record-picker-more').addEventListener('click', () => search(true));
  $('#record-picker-retry').addEventListener('click', () => search());
  $('#record-picker-close').addEventListener('click', () => dialog.close());
  $('#record-picker-apply').addEventListener('click', () => {
    if (!selected.size) return;
    const records = [...selected].map(([id, name]) => ({ id, name })), apply = options.onChoose;
    dialog.close(); apply(records);
  });
  dialog.addEventListener('close', () => { ++token; clearTimeout(timer); options?.trigger?.focus(); });
  const open = config => {
    options = config; selected = new Map();
    for (const id of config.ids) selected.set(id, `Record ${id}`);
    $('#record-picker-title').textContent = `Select ${config.label}`;
    $('#record-picker-model').textContent = `${config.model} · ${config.multiple ? 'Choose one or more records' : 'Click a record to use its ID'}`;
    $('#record-picker-search').value = ''; $('#record-picker-apply').hidden = !config.multiple;
    $('#record-picker-selected').hidden = !config.multiple;
    dialog.showModal(); $('#record-picker-search').focus(); search();
  };
  open.close = () => { if (dialog.open) dialog.close(); };
  return open;
}
