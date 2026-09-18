# Firefox release checklist — Version 1.1.0

Use this checklist for Odoo Domain Builder submissions to Mozilla Add-ons (AMO). Unchecked items require verification for each submission; this is not a claim that store review or live-browser testing has passed.

## Version and manifest

- [ ] Confirm `manifest.json` and `package.json` both specify `1.1.0`.
- [ ] Confirm README, changelog, privacy and permissions documents, website copy, HTML metadata and structured data show the intended release version.
- [ ] Keep one changelog entry for this release, including its features and manifest changes.
- [ ] Confirm minimum Firefox version is `140.0` and public documentation says Firefox 140+.
- [ ] Confirm the Gecko add-on ID is unique before the first submission; preserve it for subsequent updates.
- [ ] Keep Firefox event-page `background.scripts` in the correct order: Odoo RPC script before background script.
- [ ] Confirm API permissions remain `activeTab` and `scripting`, with no permanent host permissions.
- [ ] Confirm `browser_specific_settings.gecko.data_collection_permissions.required` declares `searchTerms` and `websiteContent` for current Odoo requests. Reassess when data handling changes.

## Build and package

Run from this Firefox project directory with Node.js 22+ and Python 3. No npm dependency installation is needed for the current build.

```bash
npm run check:records
npm run package
unzip -l odoo-domain-builder-v1.1.0.zip
```

- [ ] Offline domain and record-preview checks pass.
- [ ] Production build and ZIP integrity checks pass.
- [ ] The ZIP contains `manifest.json` directly at its root, alongside `src/` and `icons/`.
- [ ] There is no enclosing project or `dist/` folder and no nested ZIP.
- [ ] Upload the generated ZIP directly; do not compress it again.
- [ ] Run Mozilla validation and resolve errors. The project build checks do not replace AMO validation.

## Manual Firefox testing

- [ ] Load `dist/manifest.json` through `about:debugging#/runtime/this-firefox` on Firefox 140+.
- [ ] Verify the installation data declarations using a signed installation when available.
- [ ] Confirm manual mode builds and copies domains without an Odoo connection.
- [ ] Connect from a logged-in Odoo backend tab; load models and fields, including accessible custom fields.
- [ ] Build typed conditions and AND/OR/NOT groups; browse related fields.
- [ ] Search related records by name and select one or multiple IDs.
- [ ] Preview matching records, choose related columns, load another page and open a record in Odoo.
- [ ] Confirm loading, empty results, expired sessions and access-denied errors are understandable.
- [ ] Confirm requests remain read-only and go only to the selected Odoo server.
- [ ] Verify draft restoration, clipboard copying and cleanup of stale preview results.

## Privacy and store listing

- [ ] Use the name **Odoo Domain Builder** and release version **1.1.0**.
- [ ] Put the main benefits within the first 250 characters of the description.
- [ ] Select **Web Development** and **Search Tools** categories.
- [ ] Select **MIT License**, matching `LICENSE`.
- [ ] Provide a privacy policy covering Odoo requests, session use, local storage, clipboard access and Firefox data declarations.
- [ ] Keep the store policy, `PRIVACY.md` and the hosted privacy page consistent about actual data handling. Distinguish website analytics, if any, from extension behavior.
- [ ] Upload accurate icons/screenshots and disclose fictional demo records.
- [ ] State Firefox 140+ and that connected features require an authenticated Odoo account with appropriate access.
- [ ] Include the independent-tool / no Odoo affiliation statement.

## Source code and reviewer notes

- [ ] For the current untransformed, readable runtime files, select **No** for generated/minified/bundled source. The build only validates, copies and ZIPs files.
- [ ] If future tooling transforms, bundles or minifies code, submit original source and reproducible build instructions under Mozilla's source-submission requirements.
- [ ] Explain that `npm run package` produces the upload ZIP from `manifest.json`, `src/` and `icons/`; specify Node.js 22+ and Python 3. ZIP timestamps may differ across builds.
- [ ] Explain manual mode and provide connected-feature testing steps.
- [ ] Provide reviewers with a suitable test Odoo instance and test credentials through private reviewer notes when needed; never put credentials in public documentation or the ZIP.
- [ ] Explain same-origin authenticated, read-only requests, local drafts, and the absence of extension analytics or developer-operated collection endpoints.

## Submission and follow-up

- [ ] Upload `odoo-domain-builder-v1.1.0.zip` and confirm AMO displays version 1.1.0.
- [ ] Resolve validation errors and review warnings before completing submission.
- [ ] Save the submission reference and respond to reviewer requests.
- [ ] After approval, replace placeholder AMO links on the documentation site with the actual listing URL.
- [ ] Test the signed release and verify the published description, privacy policy and version.

## Mozilla references

- [Packaging](https://extensionworkshop.com/documentation/publish/package-your-extension/)
- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [Add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
