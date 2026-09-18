# Purpose and permissions — version 1.1.0 (Firefox)

Single purpose: visually build Odoo domain filters and inspect matching records using the user’s selected Odoo session.

## Requested permissions

- **activeTab:** temporary access to the Odoo tab where the user clicks the extension icon. Used for session verification, model/field metadata, user-requested record-name searches and matching-record previews.
- **scripting:** executes the add-on’s packaged read-only request function in that tab’s isolated world. Allowed operations are session verification, model listing, field metadata, record choices and previews. It does not scrape the page or write business records.

There are no permanent host, tabs, cookies, storage, history, webRequest or all-URLs permissions. Local Web Storage stores drafts/preferences without a storage permission. The native windows API opens and focuses the wizard without an additional permission.

The event-page background accepts messages only from the add-on’s wizard, checks the source tab/origin and allows only specific read operations. Requests remain on that origin, reject redirects and check the database session. The wizard’s CSP blocks direct network requests; all Odoo requests run in the selected tab.

## Firefox notes

- The add-on declares `browser_specific_settings.gecko.id` (placeholder). Set a unique ID before distribution; keep it stable across updates.
- Temporary development loading uses `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**. For AMO distribution, upload the ZIP from `npm run package` (or use `web-ext`).

## Disclosure text for publishing

All executable code is packaged; no remote code is loaded. Metadata, record search text, domain values and selected columns are sent only to the user’s chosen Odoo server using their existing session. Returned business data is used locally for requested features. No developer service receives it, no records are changed and there is no add-on tracking or analytics.

Draft values, selected record IDs and model/database/origin preferences are stored locally. Field catalogs, record names, result rows and selected preview columns remain in memory.