let opening;

async function openWizard(tab) {
  if (opening) return opening;
  opening = (async () => {
    const base = browser.runtime.getURL('src/popup/index.html');
    const url = new URL(base);
    if (Number.isInteger(tab?.id) && /^https?:\/\//.test(tab.url || '')) {
      url.searchParams.set('sourceTab', String(tab.id));
      url.searchParams.set('origin', new URL(tab.url).origin);
    }
    const contexts = await browser.runtime.getContexts({ contextTypes: ['TAB'] });
    const existing = contexts.find(context => context.documentUrl?.split('?')[0] === base && context.windowId >= 0);
    if (existing) {
      try {
        if (tab?.id && existing.documentUrl !== url.href) await browser.tabs.update(existing.tabId, { url: url.href });
        const window = await browser.windows.get(existing.windowId);
        await browser.windows.update(existing.windowId, { focused: true, ...(window.state === 'minimized' ? { state: 'normal' } : {}) });
        return;
      } catch { /* Window closed during the toolbar action. */ }
    }
    await browser.windows.create({ url: url.href, type: 'popup', width: 900, height: 820, focused: true });
  })();
  try { await opening; } finally { opening = undefined; }
}

browser.action.onClicked.addListener(tab => {
  openWizard(tab).catch(error => console.error('Could not open the domain wizard:', error));
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'odoo-metadata') return;
  return (async () => {
    const base = browser.runtime.getURL('src/popup/index.html');
    if (sender.id !== browser.runtime.id || sender.url?.split('?')[0] !== base) throw new Error('Untrusted metadata request.');
    const source = new URL(sender.url);
    const tabId = Number(source.searchParams.get('sourceTab'));
    const origin = source.searchParams.get('origin');
    if (!source.searchParams.has('sourceTab') || !Number.isInteger(tabId) || !origin || !/^https?:\/\//.test(origin)) throw new Error('Open your logged-in Odoo tab and click the extension icon to connect.');
    if (!['session', 'models', 'fields', 'records', 'record-options'].includes(message.operation)) throw new Error('Unsupported metadata request.');
    const tab = await browser.tabs.get(tabId);
    if (!tab.url || new URL(tab.url).origin !== origin) throw new Error('The source tab changed or access expired. Click the extension icon in your Odoo tab again.');
    const request = { operation: message.operation, origin, database: String(message.database || ''), model: String(message.model || ''), query: String(message.query || '').slice(0, 100), offset: message.offset, domain: message.domain, fields: message.fields };
    const results = await browser.scripting.executeScript({ target: { tabId }, world: 'ISOLATED', func: readOdooMetadata, args: [request] });
    const raw = results[0]?.result;
    if (typeof raw === 'string') {
      try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') return parsed; } catch { /* Fall through to the reconnect message below. */ }
    }
    if (raw && typeof raw === 'object') return raw;
    return { ok: false, error: 'Odoo did not respond. Reconnect from the source tab.' };
  })().catch(error => ({ ok: false, error: /Cannot access|No tab|Missing host|No frame/.test(error.message) ? 'Odoo tab access is unavailable. Open Odoo and click the extension icon again.' : error.message }));
});