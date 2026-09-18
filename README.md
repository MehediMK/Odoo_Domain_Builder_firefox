# Odoo Domain Builder 1.2.0 (Firefox)

Firefox port of the Odoo Domain Builder extension. Build Odoo domains with real model metadata, navigate child fields, select related records by name, and preview matching data in a read-only table.

The source is adapted from the [Chrome release](../chrome) for Firefox Manifest V3: an event-page background (`background.scripts`) instead of a service worker, the promise-based `browser.*` namespace, and a Gecko `browser_specific_settings` block. Behavior, UI and the read-only request function are identical.

## Install or update (local)

1. Open `about:debugging#/runtime/this-firefox` in Firefox (Developer-focused installation; temporary).
2. Click **Load Temporary Add-on** and select `dist/manifest.json` (build first, see below).
3. Log in to your Odoo backend and click the extension icon while that tab is active.
4. Search for a model, such as `purchase.order`, and click **Load fields**.
5. Click **Browse fields**. Select a normal field, or click a relation to open its child fields. Breadcrumbs return to parent models; **Use record IDs** selects a relation itself.
6. Choose the operator and value. For a relational field, **Select record…** searches by name and inserts its ID. List values have **Select records…** for multiple IDs.
7. Add conditions or AND / OR / NOT groups, then open **Review domain →**.
8. **Copy Domain** copies the expression. **Choose fields** selects up to 12 columns, including related fields. **Load data** shows matching records; **Load more** adds the next 50.

Firefox 140 or newer is required for the built-in data collection consent prompt. Reload the add-on at `about:debugging` after updating its files.

## Child fields and record selection

For `purchase.order`, open **Order Lines → Product → Name** to select `order_line.product_id.name`, or choose **Order Lines → Quantity** for `order_line.product_qty`. Complete dotted paths can also be typed directly.

```python
[('order_line.product_id.name', 'ilike', 'Chair')]
[('order_line.product_qty', '>', 10.0)]
[('order_line.product_id', '=', 42)]
[('order_line.product_id', 'in', [42, 57])]
```

The final two examples use illustrative product IDs. Select the actual products from your own Odoo server. Product names stay visible in the current editor session; the generated domain and saved draft use IDs.

Domains filter the selected main model. Separate conditions on a one-to-many path can match different child records; an AND group does not require the same order line to satisfy both conditions. `any` / `not any` subdomains are not implemented.

## Record previews

Each row includes **Open in Odoo**, which opens that main-model record’s form view in a new tab on the same Odoo server and database. It works even when ID is not a selected column. Odoo’s usual login and access rights apply.

**Choose fields** searches root-model columns. Use **Related fields →** to browse child-model columns and **Parent model** to return. Selected columns remain visible as removable chips. The table can show paths such as `order_line.product_id.name` alongside the purchase order reference and vendor.

Previews display 50 main-model rows per page, ordered by ID. Multiple related values appear separated by semicolons. Related columns display accessible related records, not just the child records that satisfied the domain. Binary columns are excluded. Changing the domain, model or selected columns clears the previous preview. Column selections and preview results are held in memory, not saved between sessions.

## Models, values and limits

- Model search includes custom models; **Load more models** retrieves additional pages. If `ir.model` is restricted, enter a known technical model name directly.
- Field metadata includes custom/inherited fields exposed to your account. Non-searchable fields cannot be selected as filter leaves.
- Relations support many2one, one2many and many2many paths, up to eight levels.
- 17 operators, 100 conditions and five nested logical group levels; an empty root domain `[]` matches all records allowed by Odoo.
- Type-aware selection, boolean, integer, decimal, date and UTC datetime values. List inputs use JSON; output uses Python literals.
- Up to 12 preview columns. Record searches show 50 choices per page; lists support up to 1,000 IDs.
- Large related previews stop with an explanation rather than silently truncate: 1,000 related IDs per branch, 5,000 across a page, 1,000 values per cell and 50,000 expanded values across the request.
- Arbitrary Python/context expressions, custom operators, record modification, independent multi-model result sets and automatic page-model detection are not implemented.

Local validation checks syntax, values and available metadata. Odoo handles actual matching and access rights. Custom server behavior may require adaptation; universal version compatibility is not claimed.

## Privacy and permissions

The extension uses **activeTab** and **scripting**, with no permanent host permissions. It reuses the selected tab’s authenticated session without reading cookies or asking for credentials.

Metadata requests, record-name searches and previews go only to your selected Odoo server. **Select record…** sends search text; **Load data** sends the domain and condition values. Odoo access rights apply. The extension never changes business records and has no developer-operated data service or analytics.

Drafts, selected model/database/origin and theme preferences are saved locally. Result rows, search result names and field catalogs remain in memory. **Use manual fields instead** builds domains offline. See [Privacy](PRIVACY.md) and [Permissions](PERMISSIONS.md).

The Firefox manifest declares required `searchTerms` and `websiteContent` data permissions for search text, domain filters and request content sent to your selected Odoo server. Firefox displays these declarations during installation. They do not enable analytics or transmission to the developer.

## Firefox port details

- `manifest.json` uses an **event-page** background (`"background": { "scripts": ["src/odoo-rpc.js", "src/background.js"] }`); Firefox does not run service workers. The `importScripts` call is replaced by script order in the event page.
- All extension APIs use the promise-based `browser.*` namespace (Firefox-native). `runtime.getContexts({ contextTypes: ['TAB'] })` and `scripting.executeScript({ world: 'ISOLATED' })` are supported on Firefox 128+.
- `browser_specific_settings.gecko.id` is a placeholder (`odoo-domain-builder@example.com`). Change it to a unique ID before distributing; keep it stable across updates so user data persists.
- The injected `src/odoo-rpc.js` returns its result as a **JSON string** and `src/background.js` parses it. Firefox requires `scripting.executeScript` `func` results to be structured-cloneable (Chrome JSON-serializes them); returning a string avoids Firefox's Xray-wrapper errors when objects cross out of the isolated world.

## Release files

- `dist/`: unpacked add-on containing the manifest, runtime code and icons only.
- `odoo-domain-builder-v<version>.zip`: uploadable package (created by `npm run package`), using the version in `manifest.json`, with `manifest.json` at its root.
- `src/`: source of the add-on; `scripts/`: build and validation helpers.

For future builds, Node.js 22+ and Python 3 are required; there are no runtime npm dependencies. `npm run build` regenerates `dist/`; `npm run package` creates a versioned ZIP. `npm run check:records` runs the offline domain/record-preview tests.

### Upload to Mozilla Add-ons

1. Run `npm run package` from this directory.
2. Upload the ZIP printed by that command directly to Mozilla Add-ons. Do not compress the project folder or wrap the generated ZIP in another archive.
3. If Mozilla reports `manifest.json was not found`, inspect the archive with `unzip -l odoo-domain-builder-v<version>.zip`. It must contain `manifest.json`, `src/` and `icons/` directly at the root, without a containing `dist/` or `odoo-domain-builder-v<version>/` folder. Run `npm run package` again and upload the regenerated ZIP.

See Mozilla's [packaging instructions](https://extensionworkshop.com/documentation/publish/package-your-extension/).

Independent tool; not affiliated with or endorsed by Odoo S.A.