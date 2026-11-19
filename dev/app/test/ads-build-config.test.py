import json
import os
import pathlib
import plistlib
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

APP = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = APP / 'scripts/ads-build-config.py'
APP_ID = 'ca-app-pub-1234567890123456~1234567890'
UNIT_ID = 'ca-app-pub-1234567890123456/1234567890'


class AdsBuildConfigTest(unittest.TestCase):
    def clean_environment(self, **values):
        env = os.environ.copy()
        for key in ['HL_ADS_ONLY', 'HL_ADS_DEMO', 'HL_NO_ADS', 'HL_ADMOB_PLATFORM', 'HL_ADMOB_APP_ID', 'HL_ADMOB_INTERSTITIAL_ID']:
            env.pop(key, None)
        env.update(values)
        return env

    def run_config(self, **values):
        return subprocess.run([sys.executable, str(SCRIPT)], env=self.clean_environment(**values), text=True, capture_output=True)

    def test_default_is_no_ads(self):
        result = self.run_config()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {'ADS_ENABLED': False})

    def test_native_ios_disables_optional_gameplay_telemetry(self):
        for platform in ('ios', 'android'):
            config = json.loads(self.run_config(HL_ADMOB_PLATFORM=platform).stdout)
            self.assertEqual(config.get('DISABLE_GAMEPLAY_TELEMETRY', False), platform == 'ios')

    def test_production_requires_matching_non_demo_ids(self):
        good = {'HL_ADS_ONLY': '1', 'HL_ADMOB_PLATFORM': 'ios',
                'HL_ADMOB_APP_ID': 'ca-app-pub-1234567890123456~1234567890',
                'HL_ADMOB_INTERSTITIAL_ID': 'ca-app-pub-1234567890123456/1234567890'}
        result = self.run_config(**good)
        self.assertEqual(result.returncode, 0, result.stderr)
        config = json.loads(result.stdout)
        self.assertTrue(config['ADS_ENABLED'])
        self.assertTrue(config['DISABLE_GAMEPLAY_TELEMETRY'])
        self.assertNotIn('PURCHASES_ENABLED', config)
        self.assertFalse(config['TEST_MODE'])
        self.assertEqual(config['REAL_IDS']['ios']['interstitial'], good['HL_ADMOB_INTERSTITIAL_ID'])
        android = self.run_config(**(good | {'HL_ADMOB_PLATFORM': 'android'}))
        self.assertEqual(android.returncode, 0, android.stderr)
        self.assertNotIn('DISABLE_GAMEPLAY_TELEMETRY', json.loads(android.stdout))
        self.assertEqual(json.loads(android.stdout)['REAL_IDS']['android']['interstitial'], good['HL_ADMOB_INTERSTITIAL_ID'])
        for updates in ({'HL_ADMOB_APP_ID': ''}, {'HL_ADMOB_INTERSTITIAL_ID': ''},
                        {'HL_ADMOB_PLATFORM': 'other'}, {'HL_NO_ADS': '1'},
                        {'HL_ADMOB_INTERSTITIAL_ID': 'ca-app-pub-3940256099942544/4411468910'},
                        {'HL_ADMOB_APP_ID': 'ca-app-pub-3940256099942544~1458002511',
                         'HL_ADMOB_INTERSTITIAL_ID': 'ca-app-pub-3940256099942544/4411468910'},
                        {'HL_ADMOB_APP_ID': 'ca-app-pub-9999999999999999~1234567890'}):
            self.assertNotEqual(self.run_config(**(good | updates)).returncode, 0, updates)

    def test_demo_uses_demo_units_with_or_without_a_real_app_id(self):
        for platform in ('ios', 'android'):
            args = {'HL_ADS_DEMO': '1', 'HL_ADMOB_PLATFORM': platform}
            for app_id in ('', APP_ID):
                result = self.run_config(**args, HL_ADMOB_APP_ID=app_id)
                self.assertEqual(result.returncode, 0, result.stderr)
                expected = {'ADS_ENABLED': True, 'TEST_MODE': True}
                if platform == 'ios':
                    expected['DISABLE_GAMEPLAY_TELEMETRY'] = True
                self.assertEqual(json.loads(result.stdout), expected)
            for conflict in ({'HL_NO_ADS': '1'}, {'HL_ADS_ONLY': '1'},
                             {'HL_ADMOB_APP_ID': 'unexpected'}, {'HL_ADMOB_APP_ID': UNIT_ID},
                             {'HL_ADMOB_APP_ID': APP_ID, 'HL_ADMOB_INTERSTITIAL_ID': UNIT_ID}):
                self.assertNotEqual(self.run_config(**(args | conflict)).returncode, 0)
        self.assertNotEqual(self.run_config(HL_ADS_DEMO='1', HL_ADMOB_PLATFORM='other').returncode, 0)

    def test_native_demo_app_id_matches_its_platform_configuration(self):
        for platform, sample in (('ios', 'ca-app-pub-3940256099942544~1458002511'),
                                 ('android', 'ca-app-pub-3940256099942544~3347511713')):
            with self.subTest(platform=platform), tempfile.TemporaryDirectory(prefix='high-and-low-demo-') as tmp:
                app = pathlib.Path(tmp)
                script = app / 'scripts/configure-native.mjs'
                script.parent.mkdir()
                shutil.copyfile(APP / 'scripts/configure-native.mjs', script)
                if platform == 'ios':
                    plugin = pathlib.Path('node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/AdMobPlugin.swift')
                    (app / plugin).parent.mkdir(parents=True)
                    shutil.copyfile(APP / plugin, app / plugin)
                plist = app / 'ios/App/App/Info.plist'
                plist.parent.mkdir(parents=True)
                plist.write_bytes(plistlib.dumps({'CFBundleDisplayName': 'High & Low'}))
                manifest = app / 'android/app/src/main/AndroidManifest.xml'
                manifest.parent.mkdir(parents=True)
                manifest.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application><activity android:name=".MainActivity" /></application></manifest>')
                strings = manifest.parent / 'res/values/strings.xml'
                strings.parent.mkdir(parents=True)
                strings.write_text('<resources></resources>')
                env = self.clean_environment(HL_ADS_DEMO='1', HL_ADMOB_PLATFORM=platform)
                command = ['node', str(script)]
                def selected_app_id():
                    if platform == 'ios':
                        return plistlib.loads(plist.read_bytes())['GADApplicationIdentifier']
                    return ET.parse(strings).find('./string[@name="admob_app_id"]').text

                result = subprocess.run(command, env=env, text=True, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(selected_app_id(), sample)
                env['HL_ADMOB_APP_ID'] = APP_ID
                matching = [f'--{platform}-app-id', APP_ID]
                result = subprocess.run(command + matching, env=env, text=True, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(selected_app_id(), APP_ID)
                wrong_platform = 'ios' if platform == 'android' else 'android'
                result = subprocess.run(command + [f'--{wrong_platform}-app-id', APP_ID], env=env, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                result = subprocess.run(command + matching, env=env | {'HL_ADMOB_INTERSTITIAL_ID': UNIT_ID}, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
