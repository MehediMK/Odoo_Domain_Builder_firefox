const KEY = 'odoo-domain-builder-v1';
export function readDraft() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function saveDraft(tree, theme, formatted, modelContext = null) {
  try { localStorage.setItem(KEY, JSON.stringify({ tree, theme, formatted, modelContext })); return true; } catch { return false; }
}
export function clearDraft() {
  try { localStorage.removeItem(KEY); return true; } catch { return false; }
}
