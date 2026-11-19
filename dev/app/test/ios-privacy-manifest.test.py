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
                'NSPrivacyCollectedDataTypes': [{
                    'NSPrivacyCollectedDataType': 'NSPrivacyCollectedDataTypeGameplayContent',
                    'NSPrivacyCollectedDataTypeLinked': True,
                    'NSPrivacyCollectedDataTypeTracking': False,
                    'NSPrivacyCollectedDataTypePurposes': ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
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

    def test_pinned_ios_admob_disables_publisher_personalization_before_start(self):
        plugin = pathlib.Path('node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/AdMobPlugin.swift')
        app_id = 'ca-app-pub-1234567890123456~1234567890'
        with tempfile.TemporaryDirectory(prefix='high-and-low-ios-admob-') as tmp:
            app = pathlib.Path(tmp)
            script = app / 'scripts/configure-native.mjs'
            swift = app / plugin
            script.parent.mkdir()
            swift.parent.mkdir(parents=True)
            shutil.copyfile(APP / 'scripts/configure-native.mjs', script)
            shutil.copyfile(APP / plugin, swift)
            env = os.environ.copy()
            for key in ('HL_NO_ADS', 'HL_ADS_ONLY', 'HL_ADS_DEMO', 'HL_ADMOB_PLATFORM', 'HL_ADMOB_APP_ID'):
                env.pop(key, None)
            env.update(HL_ADS_ONLY='1', HL_ADMOB_PLATFORM='ios', HL_ADMOB_APP_ID=app_id)
            command = ['node', str(script), '--ios-app-id', app_id]
            subprocess.run(command, env=env, capture_output=True, text=True, check=True)
            configured = swift.read_text(encoding='utf-8')
            start = configured.index('MobileAds.shared.start')
            for setting in (
                'UserDefaults.standard.set(0, forKey: "gad_has_consent_for_cookies")',
                'setPublisherFirstPartyIDEnabled(false)',
                'publisherPrivacyPersonalizationState = .disabled',
            ):
                self.assertEqual(configured.count(setting), 1)
                self.assertLess(configured.index(setting), start)
            subprocess.run(command, env=env, capture_output=True, text=True, check=True)
            self.assertEqual(swift.read_text(encoding='utf-8'), configured)


if __name__ == '__main__':
    unittest.main()
