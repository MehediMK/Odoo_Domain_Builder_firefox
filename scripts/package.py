from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'dist/manifest.json').read_text())['version']
target = root / f'odoo-domain-builder-v{version}.zip'
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for file in sorted((root / 'dist').rglob('*')):
        if file.is_file(): archive.write(file, file.relative_to(root / 'dist'))
with ZipFile(target) as archive:
    assert 'manifest.json' in archive.namelist()
    assert archive.testzip() is None
print(f'Created {target.name} ({target.stat().st_size:,} bytes); manifest at ZIP root.')
