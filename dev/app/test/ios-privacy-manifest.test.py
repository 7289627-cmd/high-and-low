import json
import os
import pathlib
import plistlib
import shutil
import subprocess
import tarfile
import tempfile
import unittest

APP = pathlib.Path(__file__).resolve().parents[1]
PROJECT = 'App/App.xcodeproj/project.pbxproj'
INFO = 'App/App/Info.plist'
MANIFEST = 'App/App/PrivacyInfo.xcprivacy'


class IosPrivacyManifestTest(unittest.TestCase):
    def test_pinned_xcode_template_bundles_the_app_preferences_reason(self):
        with tempfile.TemporaryDirectory(prefix='high-and-low-ios-manifest-') as tmp:
            app = pathlib.Path(tmp)
            script = app / 'scripts/configure-native.mjs'
            script.parent.mkdir()
            shutil.copyfile(APP / 'scripts/configure-native.mjs', script)
            manifest_source = APP / 'native/PrivacyInfo.xcprivacy'
            if manifest_source.exists():
                (app / 'native').mkdir()
                shutil.copyfile(manifest_source, app / 'native/PrivacyInfo.xcprivacy')
            template = APP / 'node_modules/@capacitor/cli/assets/ios-spm-template.tar.gz'
            with tarfile.open(template) as archive:
                for name in (PROJECT, INFO):
                    path = app / 'ios' / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(archive.extractfile(name).read())
            env = os.environ.copy()
            for key in ('HL_NO_ADS', 'HL_ADS_ONLY', 'HL_ADS_DEMO', 'HL_ADMOB_PLATFORM', 'HL_ADMOB_APP_ID'):
                env.pop(key, None)
            env['NODE_PATH'] = str(APP / 'node_modules')
            configure = ['node', str(script)]
            subprocess.run(configure, env=env, capture_output=True, text=True, check=True)

            bundle_manifest = app / 'ios' / MANIFEST
            self.assertTrue(bundle_manifest.is_file(), 'generated App target is missing PrivacyInfo.xcprivacy')
            self.assertEqual(plistlib.loads(bundle_manifest.read_bytes()), {
                'NSPrivacyAccessedAPITypes': [{
                    'NSPrivacyAccessedAPIType': 'NSPrivacyAccessedAPICategoryUserDefaults',
                    'NSPrivacyAccessedAPITypeReasons': ['CA92.1'],
                }],
            })

            project_path = app / 'ios' / PROJECT
            check_resources = """
const project = require('xcode').project(process.argv[1]).parseSync();
const target = project.getFirstTarget();
const group = project.getPBXGroupByKey(project.findPBXGroupKey({ path: 'App' }));
const files = project.pbxBuildFileSection();
const refs = project.pbxFileReferenceSection();
const resources = project.pbxResourcesBuildPhaseObj(target.uuid).files.map(file => files[file.value].fileRef);
console.log(JSON.stringify(group.children.map(file => file.value)
  .filter(ref => resources.includes(ref)).map(ref => refs[ref]?.path?.replace(/^"|"$/g, ''))));
"""
            result = subprocess.run(['node', '-e', check_resources, str(project_path)],
                                    env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout).count('PrivacyInfo.xcprivacy'), 1)

            project_before = project_path.read_bytes()
            manifest_before = bundle_manifest.read_bytes()
            subprocess.run(configure, env=env, capture_output=True, text=True, check=True)
            self.assertEqual(project_path.read_bytes(), project_before)
            self.assertEqual(bundle_manifest.read_bytes(), manifest_before)


if __name__ == '__main__':
    unittest.main()
