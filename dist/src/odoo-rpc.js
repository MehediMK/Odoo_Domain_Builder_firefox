/* Injected only into the Odoo tab selected by a toolbar click. No DOM scraping,
 * credentials or record writes. Record reads require an explicit preview request. Keep this function self-contained.
 * Firefox requires structured-cloneable injection results, so every return ships as a JSON string and the background parses it. */
async function readOdooMetadata(request) {
  const namePattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
  if (location.origin !== request.origin) return JSON.stringify({ ok: false, error: 'The source tab changed. Open Odoo and click the extension again.' });
  async function rpc(path, params) {
    const response = await fetch(path, {
      method: 'POST', credentials: 'same-origin', redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params, id: 1 }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Odoo returned HTTP ${response.status}. Check your login and server access.`);
    let data;
    try { data = await response.json(); } catch { throw new Error('This page did not return an Odoo response. Open the logged-in Odoo backend and try again.'); }
    if (data.error) {
      const type = String(data.error.data?.name || '');
      if (/SessionExpired|AccessDenied/.test(type)) throw new Error('Your Odoo session expired. Log in to Odoo and reconnect.');
      if (/AccessError/.test(type)) throw new Error('Your Odoo account cannot read the requested data. Check model, record and field access with your administrator.');
      throw new Error('Odoo could not load the requested data. Check the domain, model, field access and server configuration.');
    }
    if (!Object.hasOwn(data, 'result')) throw new Error('Unexpected Odoo response.');
    return data.result;
  }
  try {
    const session = await rpc('/web/session/get_session_info', {});
    if (!session?.uid || !session.db) throw new Error('Log in to the Odoo backend in the source tab first.');
    if (request.database && request.database !== session.db) throw new Error('The Odoo database changed. Reconnect before loading data.');
    if (request.operation === 'session') return JSON.stringify({ ok: true, data: { origin: location.origin, database: String(session.db), version: String(session.server_version || '') } });
    const context = session.user_context && typeof session.user_context === 'object' ? session.user_context : {};
    if (request.operation === 'models') {
      const query = String(request.query || '').slice(0, 100);
      const offset = Number.isSafeInteger(request.offset) && request.offset >= 0 ? request.offset : 0;
      const domain = query ? ['|', ['model', 'ilike', query], ['name', 'ilike', query]] : [];
      const rows = await rpc('/web/dataset/call_kw', { model: 'ir.model', method: 'search_read', args: [domain], kwargs: { fields: ['model', 'name'], order: 'model,id', offset, limit: 500, context } });
      if (!Array.isArray(rows)) throw new Error('Odoo returned an invalid model list.');
      return JSON.stringify({ ok: true, data: rows.filter(row => typeof row.model === 'string' && namePattern.test(row.model)).map(row => ({ model: row.model, name: String(row.name || row.model) })) });
    }
    if (request.operation === 'record-options') {
      if (!request.database || typeof request.model !== 'string' || request.model.length > 128 || !namePattern.test(request.model)) throw new Error('Choose a connected related model first.');
      if (!Number.isSafeInteger(request.offset) || request.offset < 0) throw new Error('Invalid record search offset.');
      const query = String(request.query || '').trim().slice(0, 100);
      const domain = query ? [['display_name', 'ilike', query]] : [];
      const rows = await rpc('/web/dataset/call_kw', { model: request.model, method: 'search_read', args: [domain], kwargs: { fields: ['id', 'display_name'], order: 'id', offset: request.offset, limit: 51, context } });
      if (!Array.isArray(rows) || rows.some(row => !row || !Number.isSafeInteger(row.id) || row.id <= 0)) throw new Error('Odoo returned invalid record choices.');
      return JSON.stringify({ ok: true, data: { rows: rows.slice(0, 50).map(row => ({ id: row.id, name: String(row.display_name || row.id) })), hasMore: rows.length > 50 } });
    }
    if (request.operation === 'records') {
      const operators = ['=', '!=', '>', '<', '>=', '<=', 'in', 'not in', 'ilike', 'not ilike', 'like', 'not like', 'child_of', 'parent_of', '=?', '=like', '=ilike'];
      const scalar = value => typeof value === 'boolean' || (typeof value === 'string' && value.length <= 10000) || (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)));
      const validValue = value => scalar(value) || (Array.isArray(value) && value.length <= 1000 && value.every(scalar));
      if (!request.database || typeof request.model !== 'string' || request.model.length > 128 || !namePattern.test(request.model)) throw new Error('Choose a connected Odoo model first.');
      if (!Array.isArray(request.domain) || request.domain.length > 400 || request.domain.some(token => !['&', '|', '!'].includes(token) && !(Array.isArray(token) && token.length === 3 && typeof token[0] === 'string' && token[0].length <= 256 && namePattern.test(token[0]) && operators.includes(token[1]) && validValue(token[2])))) throw new Error('Invalid record preview domain.');
      let operands = 0;
      for (const token of [...request.domain].reverse()) {
        if (Array.isArray(token)) operands++;
        else { const arity = token === '!' ? 1 : 2; if (operands < arity) throw new Error('Invalid record preview domain.'); operands -= arity - 1; }
      }
      if (!Array.isArray(request.fields) || !request.fields.length || request.fields.length > 12 || request.fields.some(field => typeof field !== 'string' || field.length > 256 || field.split('.').length > 9 || !namePattern.test(field))) throw new Error('Invalid preview fields.');
      if (!Number.isSafeInteger(request.offset) || request.offset < 0) throw new Error('Invalid preview offset.');
      const rows = await rpc('/web/dataset/call_kw', { model: request.model, method: 'search_read', args: [request.domain], kwargs: { fields: [...new Set(request.fields.map(field => field.split('.')[0]))], order: 'id', offset: request.offset, limit: 51, context } });
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || !Number.isSafeInteger(row.id))) throw new Error('Odoo returned invalid records.');
      const page = rows.slice(0, 50);
      // Resolve relation paths in batches, retaining the main model's row order.
      const schemaCache = new Map();
      const schema = async model => {
        if (!schemaCache.has(model)) {
          const fields = await rpc('/web/dataset/call_kw', { model, method: 'fields_get', args: [], kwargs: { attributes: ['type', 'relation'], context } });
          if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('Odoo returned invalid related field metadata.');
          schemaCache.set(model, fields);
        }
        return schemaCache.get(model);
      };
      const relationIds = (value, type) => {
        if (type === 'many2one') return Array.isArray(value) && Number.isSafeInteger(value[0]) ? [value[0]] : [];
        return Array.isArray(value) ? value.filter(id => Number.isSafeInteger(id) && id > 0) : [];
      };
      let relatedCount = 0, expandedValues = 0;
      // Firefox Xray forbids adding properties to fetched (page-realm) row objects, so relation values
      // are collected in a bundle per records-array and merged into fresh objects before returning.
      const bundles = new Map();
      const bundleFor = recordsArray => {
        let map = bundles.get(recordsArray);
        if (!map) { map = new Map(); bundles.set(recordsArray, map); }
        return map;
      };
      async function expand(model, records, paths) {
        const groups = new Map();
        for (const path of paths) {
          if (!path.includes('.')) continue;
          const [field, ...tail] = path.split('.');
          if (!groups.has(field)) groups.set(field, new Set());
          groups.get(field).add(tail.join('.'));
        }
        if (!groups.size || !records.length) return;
        const fields = await schema(model);
        for (const [field, tails] of groups) {
          const info = fields[field];
          if (!info || !['many2one', 'one2many', 'many2many'].includes(info.type) || typeof info.relation !== 'string' || !namePattern.test(info.relation)) throw new Error(`Cannot browse related field ${field}.`);
          const ids = [...new Set(records.flatMap(record => relationIds(record[field], info.type)))];
          relatedCount += ids.length;
          if (ids.length > 1000 || relatedCount > 5000) throw new Error('Too many related records for this preview. Narrow your domain or select fewer related columns.');
          let related = [];
          if (ids.length) {
            related = await rpc('/web/dataset/call_kw', { model: info.relation, method: 'search_read', args: [[['id', 'in', ids]]], kwargs: { fields: [...new Set([...tails].map(path => path.split('.')[0]))], limit: 1000, order: 'id', context: { ...context, active_test: false } } });
            if (!Array.isArray(related) || related.some(record => !record || !Number.isSafeInteger(record.id))) throw new Error('Odoo returned invalid related records.');
            await expand(info.relation, related, [...tails]);
          }
          const byId = new Map(related.map(record => [record.id, record]));
          const relatedBundles = bundles.get(related);
          const rowBundles = bundleFor(records);
          for (const record of records) {
            if (!rowBundles.has(record.id)) rowBundles.set(record.id, {});
            const rowExtra = rowBundles.get(record.id);
            for (const tail of tails) {
              const values = [];
              for (const id of relationIds(record[field], info.type)) {
                const relatedRecord = byId.get(id);
                if (!relatedRecord) continue;
                const additions = tail.includes('.') ? relatedBundles?.get(relatedRecord.id)?.[tail]?.values || [] : [relatedRecord[tail] ?? false];
                expandedValues += additions.length;
                if (values.length + additions.length > 1000 || expandedValues > 50000) throw new Error('Too many related values to display. Narrow your domain or select fewer related columns.');
                values.push(...additions);
              }
              rowExtra[field + '.' + tail] = { values };
            }
          }
        }
      }
      await expand(request.model, page, request.fields);
      const rowBundles = bundles.get(page) || new Map();
      const enriched = page.map(row => {
        const extra = rowBundles.get(row.id);
        return extra ? Object.assign({}, row, extra) : row;
      });
      return JSON.stringify({ ok: true, data: { rows: enriched, hasMore: rows.length > 50 } });
    }
    if (request.operation === 'fields' && typeof request.model === 'string' && request.model.length <= 128 && namePattern.test(request.model)) {
      const fields = await rpc('/web/dataset/call_kw', { model: request.model, method: 'fields_get', args: [], kwargs: { attributes: ['string', 'type', 'relation', 'selection', 'searchable', 'store', 'help'], context } });
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('Odoo returned invalid field metadata.');
      return JSON.stringify({ ok: true, data: fields });
    }
    throw new Error('Unsupported metadata request.');
  } catch (error) {
    return JSON.stringify({ ok: false, error: error.name === 'TimeoutError' ? 'Odoo took too long to respond. Try again.' : error.name === 'TypeError' ? 'Could not reach Odoo. Check the source tab, your connection and login.' : error.message });
  }
}
