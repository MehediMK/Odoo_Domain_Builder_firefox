export const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'in', 'not in', 'ilike', 'not ilike', 'like', 'not like', 'child_of', 'parent_of', '=?', '=like', '=ilike'];
export const TYPES = ['string', 'boolean', 'integer', 'float', 'false', 'list', 'date', 'datetime', 'empty'];
export const MAX_DEPTH = 5;
export const MAX_CONDITIONS = 100;
export const condition = (field = '', operator = '=', type = 'string', value = '') => ({ kind: 'condition', field, operator, type, value });
export const group = (logic = 'AND', children = [], not = false) => ({ kind: 'group', logic, children, not });

export const EXAMPLES = [
  { name: 'Draft records', detail: 'state = draft', tree: group('AND', [condition('state', '=', 'string', 'draft')]) },
  { name: 'Active records', detail: 'active = True', tree: group('AND', [condition('active', '=', 'boolean', 'true')]) },
  { name: 'One company', detail: 'company_id = 1', tree: group('AND', [condition('company_id', '=', 'integer', '1')]) },
  { name: 'Search by name', detail: 'name ilike odoo', tree: group('AND', [condition('name', 'ilike', 'string', 'odoo')]) },
  { name: 'Multiple states', detail: 'state in [draft, sent]', tree: group('AND', [condition('state', 'in', 'list', '["draft", "sent"]')]) },
  { name: 'Combine conditions', detail: 'Draft · active · company 1', tree: group('AND', [condition('state', '=', 'string', 'draft'), condition('active', '=', 'boolean', 'true'), condition('company_id', '=', 'integer', '1')]) }
];

export function quote(value) {
  return "'" + value.replace(/[\\'\x00-\x1f\x7f-\x9f\u2028\u2029\ud800-\udfff]/gu, char => {
    if (char === "'") return "\\'";
    if (char === '\\') return '\\\\';
    const code = char.charCodeAt(0);
    return code < 256 ? '\\x' + code.toString(16).padStart(2, '0') : '\\u' + code.toString(16).padStart(4, '0');
  }) + "'";
}

export function parseValue(node) {
  const raw = node.value;
  if (!TYPES.includes(node.type)) throw new Error('Please select a value type.');
  if (typeof raw !== 'string' || raw.length > 10000) throw new Error('Values must contain at most 10,000 characters.');
  switch (node.type) {
    case 'string':
      if (!raw.length) throw new Error('Please enter a value. Use False / unset for an unset field.');
      return quote(raw);
    case 'empty': return quote('');
    case 'date':
    case 'datetime': {
      const isDate = node.type === 'date';
      const pattern = isDate ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
      if (!pattern.test(raw)) throw new Error(isDate ? 'Choose a valid date.' : 'Choose a valid UTC date and time.');
      const normalized = isDate ? raw + 'T00:00:00' : raw.length === 16 ? raw + ':00' : raw;
      const date = new Date(normalized + 'Z');
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== normalized) throw new Error('This date or time is not valid.');
      return quote(isDate ? raw : normalized.replace('T', ' '));
    }
    case 'boolean':
      if (!['true', 'false'].includes(raw)) throw new Error('Please select True or False.');
      return raw === 'true' ? 'True' : 'False';
    case 'false': return 'False';
    case 'integer':
      if (!/^[+-]?\d+$/.test(raw.trim())) throw new Error('Enter a whole number, for example 10.');
      return BigInt(raw.trim()).toString();
    case 'float': {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()) || !Number.isFinite(Number(raw))) throw new Error('Enter a finite decimal number, for example 10.5.');
      const value = String(Number(raw));
      return /[.e]/i.test(value) ? value : value + '.0';
    }
    case 'list': {
      let values;
      try { values = JSON.parse(raw); } catch { throw new Error('Enter a JSON list, for example ["draft", "sent"] or [1, 2].'); }
      if (!Array.isArray(values) || values.length > 1000 || values.some(v => !['string', 'number', 'boolean'].includes(typeof v) || (typeof v === 'number' && (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v)))))) throw new Error('Use a flat list of strings, booleans, or safe numbers (up to 1,000 items).');
      return '[' + values.map(v => typeof v === 'string' ? quote(v) : typeof v === 'boolean' ? (v ? 'True' : 'False') : String(v)).join(', ') + ']';
    }
  }
}

/** Compile a bounded tree into Odoo prefix tokens. Root AND uses implicit conjunction. */
export function compile(tree, formatted = false) {
  const errors = [];
  let count = 0;
  function visit(node, path, depth, root = false) {
    const fail = (message, part = '') => { errors.push({ path: path.join('.'), part, message }); return []; };
    if (!node || typeof node !== 'object') return fail('This domain contains an invalid condition.');
    if (depth > MAX_DEPTH) return fail(`Use at most ${MAX_DEPTH} nested group levels.`);
    if (node.kind === 'condition') {
      count++;
      if (count > MAX_CONDITIONS) return fail(`Use at most ${MAX_CONDITIONS} conditions.`);
      if (typeof node.field !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(node.field.trim()) || node.field.length > 256) fail('Please enter a field name, such as state or partner_id.name.', 'field');
      if (!OPERATORS.includes(node.operator)) fail('Please select a supported operator.', 'operator');
      if (['in', 'not in'].includes(node.operator) && node.type !== 'list') fail('The in and not in operators require a List value.', 'type');
      if (['ilike', 'not ilike', 'like', 'not like', '=like', '=ilike'].includes(node.operator) && node.type !== 'string') fail('Text matching operators require a String value.', 'type');
      if (['child_of', 'parent_of'].includes(node.operator) && !['integer', 'list'].includes(node.type)) fail('Hierarchy operators require an Integer ID or a List of IDs.', 'type');
      let value;
      try {
        value = parseValue(node);
        if (['child_of', 'parent_of'].includes(node.operator) && node.type === 'list' && JSON.parse(node.value).some(v => !Number.isSafeInteger(v))) fail('Hierarchy lists must contain integer IDs.', 'value');
      } catch (error) { fail(error.message, 'value'); }
      return [`(${quote(String(node.field).trim())}, ${quote(String(node.operator))}, ${value})`];
    }
    if (node.kind !== 'group' || !['AND', 'OR'].includes(node.logic) || typeof node.not !== 'boolean' || !Array.isArray(node.children)) return fail('This domain contains an invalid logical structure.');
    if (!node.children.length) {
      if (root && !node.not) return [];
      return fail('Add a condition to this empty group or remove it.');
    }
    if (node.children.length > MAX_CONDITIONS) return fail(`Use at most ${MAX_CONDITIONS} conditions.`);
    const children = node.children.flatMap((child, index) => visit(child, [...path, index], depth + (child?.kind === 'group' ? 1 : 0)));
    const prefix = root && node.logic === 'AND' && !node.not ? [] : Array(node.children.length - 1).fill(quote(node.logic === 'AND' ? '&' : '|'));
    return [...(node.not ? [quote('!')] : []), ...prefix, ...children];
  }
  const tokens = visit(tree, [], 0, true);
  return { errors, count, code: errors.length ? '' : formatted && tokens.length ? '[\n  ' + tokens.join(',\n  ') + '\n]' : '[' + tokens.join(', ') + ']' };
}

/** Convert validated literal values directly to RPC data, never evaluate Python output. */
export function toRpcDomain(tree) {
  const { errors } = compile(tree);
  if (errors.length) throw new Error(errors[0].message);
  function visit(node, root = false) {
    if (node.kind === 'condition') {
      let value = node.value;
      if (node.type === 'empty') value = '';
      else if (node.type === 'false') value = false;
      else if (node.type === 'boolean') value = value === 'true';
      else if (node.type === 'list') value = JSON.parse(value);
      else if (['integer', 'float'].includes(node.type)) {
        value = Number(value);
        if (node.type === 'integer' && !Number.isSafeInteger(value)) throw new Error('Load data requires integers within the safe numeric range.');
      } else if (node.type === 'datetime') value = (value.length === 16 ? value + ':00' : value).replace('T', ' ');
      return [[node.field.trim(), node.operator, value]];
    }
    const prefix = root && node.logic === 'AND' && !node.not ? [] : Array(Math.max(0, node.children.length - 1)).fill(node.logic === 'AND' ? '&' : '|');
    return [...(node.not ? ['!'] : []), ...prefix, ...node.children.flatMap(child => visit(child))];
  }
  return visit(tree, true);
}
