#!/usr/bin/env python3
"""Build all client packages from one plugin; never copy workspace credentials."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import zipfile

SOURCE = Path(__file__).resolve().parent / 'fos-project'
FILES = ['README.md', 'plugin.json', 'mcp.json', '.claude-plugin/plugin.json', '.mcp.json',
         'gemini-extension.json', 'manifest.json', 'scripts/bridge.mjs',
         'scripts/connect.mjs', 'skills/work-on-fos-project/SKILL.md']


def build(output: Path, version: str):
    import re
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Release version must be major.minor.patch')
    output.mkdir(parents=True, exist_ok=True)
    stage = output / 'marketplace'
    if stage.exists():
        raise ValueError('Use a fresh output directory; refusing to overwrite a release')
    stage.mkdir()
    for name in FILES:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SOURCE / name, target)
        if name in ['plugin.json', '.claude-plugin/plugin.json', 'gemini-extension.json', 'manifest.json']:
            value = json.loads(target.read_text())
            value['version'] = version
            target.write_text(json.dumps(value, indent=2) + '\n')
    # Same root is both an installable Gemini extension and a repo marketplace.
    catalogs = {
        '.claude-plugin/marketplace.json': {'name': 'fosforescent', 'owner': {'name': 'Fosforescent'}, 'plugins': [{'name': 'fos-project', 'source': './', 'version': version, 'description': 'Work from a scoped Fos task tree'}]},
        '.agents/plugins/marketplace.json': {'name': 'fosforescent', 'plugins': [{'name': 'fos-project', 'source': {'source': 'local', 'path': './'}, 'policy': {'installation': 'AVAILABLE', 'authentication': 'ON_INSTALL'}, 'category': 'Productivity'}]},
    }
    for name, value in catalogs.items():
        target = stage / name; target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(value, indent=2) + '\n')
    # No credentials or application source enter these archives, even if present nearby.
    for suffix in ['zip', 'mcpb']:
        with zipfile.ZipFile(output / f'fos-project-{version}.{suffix}', 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in FILES:
                archive.write(stage / name, name)
    with tarfile.open(output / f'fos-project-{version}.tar.gz', 'w:gz') as archive:
        for name in FILES:
            archive.add(stage / name, arcname=name)
    artifacts = sorted(p for p in output.iterdir() if p.is_file())
    (output / 'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in artifacts))
    print(f'Built {version} in {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--version', default=json.loads((SOURCE / 'plugin.json').read_text())['version'])
    args = parser.parse_args()
    build(args.output, args.version)
