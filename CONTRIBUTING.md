# Contributing

Thanks for contributing to Odoo Domain Builder. The repo contains two independently packaged variants that must stay behaviorally identical: `chrome/` (service worker) and `firefox/` (event-page background). The one functional code difference is sanctioned and documented: the injected `readOdooMetadata` returns a JSON string in Firefox to avoid Xray-wrapper errors.

## Ground rules

- **No permanent host permissions.** Features must work with `activeTab` + `scripting` only.
- **Read-only.** The extension must never write, modify, or delete Odoo business records.
- **Keep it self-contained.** The injected `src/odoo-rpc.js` function cannot use `import`, module globals, or browser APIs; it runs in the tab's isolated world.
- **Keep both variants in sync.** When you change behavior, apply the same change to `chrome/src` and `firefox/src`. When you change the injected function, mirror the Firefox JSON-string transport in `firefox/src/odoo-rpc.js` and keep the Chrome version returning a plain object.
- **No new runtime dependencies.** Dev tooling lives in each variant's `package.json`; the built packages ship no node modules.

## Development workflow

```bash
cd chrome            # and repeat in firefox/
npm install          # dev tooling
npm run build        # lints/validates manifest, regenerates dist/
npm run check:records
npm run package      # creates the uploadable ZIP
```

Before opening a pull request:

1. Run `npm run build` and `npm run check:records` in **both** `chrome/` and `firefox/`.
2. Add a CHANGELOG entry under a new version heading in both `CHANGELOG.md` files.
3. If the change is user-visible, update both READMEs and the docs website under `chrome/docs/`.
4. If you change permission behavior, update the disclosure text in both `PRIVACY.md` and `PERMISSIONS.md`.

## Testing

`npm run check:records` exercises `src/domain/domain.js` (typed/prefix domains, precision, groups) and `src/odoo-rpc.js` (bounded pagination, rejected requests, related-column expansion, access/session errors) with a mocked fetch — no live Odoo required. Manual, live-Odoo review remains the publisher's step.

## Reporting issues

Open an issue with the variant (Chrome/Firefox), your versions, and the exact steps. For security issues, use [SECURITY.md](SECURITY.md) instead.

## Committing

- Keep commits small and focused; write messages in the style of the existing history.
- Do not commit `dist/`, `*.zip`, or `node_modules` (see `.gitignore`).