# Privacy Policy — Odoo Domain Builder (Firefox)

Effective date: September 18, 2026 · Version 1.1.0

## Scope

This policy covers the Odoo Domain Builder Firefox add-on (Manifest V3). The add-on has no developer-operated data service, user accounts, advertising, analytics or telemetry.

## Connection and metadata

Clicking the extension icon grants temporary access to the selected Odoo tab. The add-on makes same-origin requests using that tab’s existing authenticated session. It does not ask for a password or API key, read cookie values, or save credentials.

Session information confirms login and database context. The wizard receives the server origin, database and Odoo version. Model listing reads model names and labels from ir.model; fields_get reads field definitions, including labels, types, relations, selection options and searchable flags. Related-field browsing requests metadata from the corresponding models.

## Record searches and previews

Opening Select record or Select records reads IDs and display names from the related model. Typing in that picker sends your search text to your selected Odoo server. Results are paginated, with up to 50 choices displayed at a time. The chosen IDs become condition values in your domain.

Clicking Load data or Load more sends the generated domain, condition values and selected columns to that Odoo server through read-only search_read requests. Each page displays up to 50 main-model rows, requesting one extra to identify whether more results are available. Related columns can trigger additional read-only requests for related records. The add-on never creates, updates or deletes business records.

All these requests follow your Odoo account’s access rights, field access and record rules. Your server’s normal request logging applies. No search, domain or record data is sent to the developer or an add-on-operated third-party service.

## Firefox data consent

The manifest declares `searchTerms` and `websiteContent` as required data permissions for the search text, domain filters and request content sent to your selected Odoo server. Firefox 140 or newer shows these declarations during installation. The destination remains your selected Odoo server; the add-on has no analytics or developer-operated collection endpoint.

## Local storage and memory

The current domain draft (including entered values and selected record IDs), model, Odoo origin/database and theme/format preferences are saved in the add-on’s local Web Storage. This data is not synchronized by the add-on.

Field catalogs, search result names, selected preview columns and loaded result rows are held in memory. Closing the wizard discards them. Changing the domain, model or columns clears previous preview results. Clear all resets the domain; context/preferences may remain. Removing the add-on removes its local storage.

## Permissions and clipboard

activeTab provides temporary access to the tab where you invoke the add-on. scripting runs packaged read-only request code in that tab’s isolated world. There are no permanent host permissions, automatic content scripts or remote executable code. The add-on does not inspect unrelated pages or browsing history.

Copy Domain writes the expression to the clipboard after you click it. The add-on does not read your clipboard. Any operating-system clipboard synchronization is controlled separately.

Manual mode works offline. An already-sent read-only request may finish after switching modes, but obsolete results are not applied.

## Contact and changes

Add-on data is not sold, used for unrelated purposes or used for lending/credit decisions. Material changes will be reflected in this policy.