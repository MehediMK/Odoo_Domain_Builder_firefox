# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report them privately to the maintainers at **khanmehedi@mirinfosys.com** with the subject prefix `[security]`. You can expect an acknowledgement within 72 hours.

Include:

- The variant and exact version (e.g. Chrome 1.2.0, Firefox 1.2.0).
- Steps to reproduce, with the minimum detail needed.
- Impact and any proposed remediation if you have one.

## Scope

The extension:

- Uses only `activeTab` and `scripting` permissions; there are no permanent host permissions.
- Never reads cookies or asks for credentials; it reuses the selected tab's Odoo session.
- Only performs read operations (session verification, model/field metadata, record-name search, matching-record previews) and never modifies business records.
- Runs no remote code; all executable code is packaged with the add-on.
- Communicates only with the user's chosen Odoo server. There is no developer-operated data service, analytics, or telemetry.

## Reporting standard

Vulnerabilities in the extension code, a suspicious build/package step, or a data-handling concern in the docs website are all in scope. Issues that depend on the user's own Odoo server configuration (e.g. access rights granting access to data) are out of scope; Odoo access rights apply.

## Safe handling of reports

- Do not include real customer data, credentials, or full record payloads in a report.
- If you can reproduce with demo data instead, prefer that.

## Preferred fix flow

1. Maintainer acknowledges and triages the report.
2. A fix lands in `chrome/src` and `firefox/src` together (both variants stay behaviorally identical).
3. The fix is documented in both `CHANGELOG.md` files; a new release is packaged with `npm run package` for each variant.

Thank you for keeping this extension safe.