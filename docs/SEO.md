# Docs publishing notes — 1.2.0 (root GitHub Pages site)

The static site is `index.html`; the companion privacy policy is `privacy.html`. Screenshots are mirrored in `assets/` and depict the actual interface with fictional demo data.

## Hosting setup

The public documentation URL is [https://mehedimk.github.io/Odoo_Domain_Builder/](https://mehedimk.github.io/Odoo_Domain_Builder/). Canonical, Open Graph, Twitter, structured-data images, sitemap.xml and robots.txt use this URL. Deploy the contents of this `docs/` folder at the GitHub Pages root:

- GitHub → repo → **Settings → Pages → Branch** → `main` → `/docs`.

Use [https://mehedimk.github.io/Odoo_Domain_Builder/privacy.html](https://mehedimk.github.io/Odoo_Domain_Builder/privacy.html) as the Add-ons for Firefox (AMO) privacy policy URL after deploying the page.

## Firefox-focused SEO

This page targets the Firefox add-on ("Odoo domain builder Firefox", "Odoo filter builder add-on"). Keep the title, description, keywords and Open Graph/Twitter copy aligned with that intent. Update them if the AMO listing wording changes.

The extension is published as a Firefox add-on (Manifest V3, event-page background, `browser.*` namespace, Firefox 128+) and a Chrome extension (Chrome 116+). The hero CTA links to [AMO](https://addons.mozilla.org/firefox/) while the add-on is pending review; swap in the direct listing URL once published. Stable Gecko ID must not change between updates (`firefox/manifest.json`).

## Content and assets

The page includes title/description metadata, social cards, SoftwareApplication and FAQPage structured data, accessible section headings, and descriptive screenshot alt text. Structured data does not guarantee a search feature or rich result. Keep version, screenshots, visible FAQ answers and structured FAQ answers synchronized when editing.

Keep the demo-data disclosure with the gallery. Five screenshots are 1280×800 PNGs; promos are 440×280 and 1400×560. Assets under `assets/` are copies of `firefox/icons/` and the Chrome store screenshot set.

Do not claim universal Odoo compatibility, server-side validation of every expression, arbitrary Python execution, record modification or official Odoo endorsement. Draft generation is local; record searches and requested previews communicate with the selected Odoo server.