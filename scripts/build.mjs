import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3 || manifest.name !== 'Odoo Domain Builder' || manifest.description.length > 132 || JSON.stringify([...manifest.permissions].sort()) !== JSON.stringify(['activeTab','scripting']) || manifest.host_permissions?.length || manifest.background?.service_worker || manifest.minimum_chrome_version) throw Error('Manifest validation failed.');
const scripts = manifest.background?.scripts;
if (!Array.isArray(scripts) || scripts.length < 2 || scripts[0] !== 'src/odoo-rpc.js' || scripts.at(-1) !== 'src/background.js') throw Error('Firefox manifest must declare event-page background scripts (odoo-rpc.js before background.js).');
const gecko = manifest.browser_specific_settings?.gecko;
if (!gecko?.id || typeof gecko.id !== 'string' || !gecko.id.includes('@') || typeof gecko.strict_min_version !== 'string') throw Error('Firefox manifest must define browser_specific_settings.gecko.id and strict_min_version.');
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(path.join(root, 'dist'), { recursive: true });
for (const name of ['manifest.json', 'src', 'icons']) await cp(path.join(root, name), path.join(root, 'dist', name), { recursive: true });
for (const name of Object.values(manifest.icons)) if (!(await stat(path.join(root, 'dist', name))).size) throw Error('Missing icon.');
const files = [];
async function walk(dir) { for (const entry of await readdir(path.join(root, 'dist', dir), { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) await walk(file); else files.push(file); } }
await walk('');
for (const file of files.filter(file => /\.(js|html)$/.test(file))) {
  const content = await readFile(path.join(root, 'dist', file), 'utf8');
  if (/\beval\s*\(|new\s+Function\s*\(|\.innerHTML\s*=|XMLHttpRequest/.test(content)) throw Error(`Unsafe or remote code in ${file}`);
  if (/\bfetch\s*\(/.test(content) && file !== 'src/odoo-rpc.js') throw Error(`Unexpected network code in ${file}`);
}
console.log(`Production build passed: ${files.length} files; activeTab + scripting only; no host permissions or remote code; gecko id ${gecko.id}.`);
console.log(files.join('\n'));