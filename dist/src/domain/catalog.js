import { parseValue } from './domain.js';
export const MODEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
export const RELATIONS = ['many2one', 'one2many', 'many2many'];

export function cleanFields(raw) {
  const fields = Object.create(null);
  for (const [name, info] of Object.entries(raw || {})) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) || !info || typeof info.type !== 'string') continue;
    fields[name] = {
      name, label: String(info.string || name), type: info.type,
      relation: typeof info.relation === 'string' && MODEL_NAME.test(info.relation) ? info.relation : '',
      searchable: info.searchable !== false,
      help: typeof info.help === 'string' ? info.help : '',
      selection: Array.isArray(info.selection) ? info.selection.filter(item => Array.isArray(item) && ['string', 'number'].includes(typeof item[0])).map(([value, label]) => [value, String(label)]) : []
    };
  }
  return fields;
}

export function defaultType(info) {
  if (!info) return 'string';
  if (info.type === 'boolean') return 'boolean';
  if (info.type === 'integer' || RELATIONS.includes(info.type)) return 'integer';
  if (['float', 'monetary'].includes(info.type)) return 'float';
  if (['date', 'datetime'].includes(info.type)) return info.type;
  if (info.type === 'selection' && info.selection.length && typeof info.selection[0][0] === 'number') return 'integer';
  return 'string';
}

export class FieldCatalog {
  constructor(load) { this.load = load; this.model = ''; this.cache = new Map(); this.pending = new Map(); }
  async fields(model) {
    if (this.cache.has(model)) return this.cache.get(model);
    if (!this.pending.has(model)) this.pending.set(model, this.load(model).then(raw => { const fields = cleanFields(raw); this.cache.set(model, fields); return fields; }).finally(() => this.pending.delete(model)));
    return this.pending.get(model);
  }
  async parent(path) {
    const parts = path.split('.'); parts.pop();
    if (parts.length > 8) throw new Error('Use at most eight related-field levels.');
    let model = this.model;
    for (const part of parts) {
      const info = (await this.fields(model))[part];
      if (!info?.relation || !RELATIONS.includes(info.type)) throw new Error(`“${part}” is not a related-model field.`);
      model = info.relation;
    }
    return { model, fields: await this.fields(model) };
  }
  info(path) {
    let model = this.model;
    const parts = path.split('.');
    for (let index = 0; index < parts.length; index++) {
      const field = this.cache.get(model)?.[parts[index]];
      if (!field) return null;
      if (index === parts.length - 1) return field;
      if (!RELATIONS.includes(field.type)) return null;
      model = field.relation;
    }
    return null;
  }
}

export function modelErrors(tree, catalog) {
  const errors = [];
  if (!catalog?.model) return errors;
  function visit(node, path) {
    if (node.kind === 'group') return node.children.forEach((child, index) => visit(child, [...path, index]));
    if (!node.field.trim()) return;
    const info = catalog.info(node.field.trim());
    const fail = (message, part = 'field') => errors.push({ path: path.join('.'), part, message });
    if (!info) return fail('Choose a field from this model. Use Browse fields for related fields.');
    if (!info.searchable) return fail('Odoo marks this field as non-searchable. Choose a searchable field.');
    if (['in', 'not in'].includes(node.operator)) {
      let values;
      try { values = JSON.parse(node.value); } catch { return; }
      if (!Array.isArray(values)) return;
      const expected = defaultType(info);
      if (expected === 'integer' && values.some(value => value !== false && !Number.isSafeInteger(value))) fail('Use a list of integer IDs or values for this field.', 'value');
      if (expected === 'float' && values.some(value => value !== false && (typeof value !== 'number' || !Number.isFinite(value)))) fail('Use a list of numbers for this field.', 'value');
      if (expected === 'boolean' && values.some(value => typeof value !== 'boolean')) fail('Use a list of booleans for this field.', 'value');
      if (expected === 'string' && values.some(value => value !== false && typeof value !== 'string')) fail('Use a list of strings for this field.', 'value');
      if (['date', 'datetime'].includes(expected)) {
        try { for (const value of values) if (value !== false) parseValue({type: expected, value: String(value).replace(' ', 'T')}); }
        catch { fail('Use a list of valid date strings (UTC for datetime fields).', 'value'); }
      }
      if (info.type === 'selection' && info.selection.length && values.some(value => value !== false && !info.selection.some(([key]) => key === value))) fail('This list contains a value outside the selection choices.', 'value');
      return;
    }
    if (['child_of', 'parent_of'].includes(node.operator)) return;
    if (node.type === 'false' || (node.type === 'boolean' && node.value === 'false')) return;
    const expected = defaultType(info);
    if (expected === 'boolean' && node.type !== 'boolean') fail('This field needs a Boolean value.', 'type');
    if (expected === 'integer' && node.type !== 'integer') fail('This field needs an Integer value (record ID for relations).', 'type');
    if (expected === 'float' && !['integer', 'float'].includes(node.type)) fail('This field needs a numeric value.', 'type');
    if (['date', 'datetime'].includes(expected) && node.type !== expected) fail(`This field needs a ${expected} value.`, 'type');
    if (expected === 'string' && !['string', 'empty'].includes(node.type)) fail('This field needs a String value.', 'type');
    if (info.type === 'selection' && ['=', '!=', '=?'].includes(node.operator) && info.selection.length && !info.selection.some(([key]) => String(key) === node.value)) fail('Choose a value from this selection field.', 'value');
  }
  visit(tree, []);
  return errors;
}
