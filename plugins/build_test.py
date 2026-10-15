import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from build import build, FILES

class PackageTest(unittest.TestCase):
    def test_installable_packages_share_skill_transport_and_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            build(root, '0.1.123')
            for suffix in ['zip', 'mcpb']:
                with zipfile.ZipFile(root / f'fos-project-0.1.123.{suffix}') as z:
                    self.assertEqual(set(z.namelist()), set(FILES))
                    for manifest in ['plugin.json', 'manifest.json', 'gemini-extension.json', '.claude-plugin/plugin.json']:
                        self.assertEqual(json.loads(z.read(manifest))['version'], '0.1.123')
                    self.assertIn('fos_read', z.read('skills/work-on-fos-project/SKILL.md').decode())
            self.assertTrue((root / 'marketplace/.agents/plugins/marketplace.json').is_file())
            self.assertEqual(len((root / 'SHA256SUMS').read_text().splitlines()), 3)
            with self.assertRaises(ValueError):
                build(root, '0.1.123')

if __name__ == '__main__':
    unittest.main()
