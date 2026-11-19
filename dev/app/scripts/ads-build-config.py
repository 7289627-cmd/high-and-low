"""Emit the native bridge configuration; fail closed for incomplete ad builds."""
import json
import os
import re
import sys

ads = os.environ.get('HL_ADS_ONLY') == '1'
demo = os.environ.get('HL_ADS_DEMO') == '1'
platform = os.environ.get('HL_ADMOB_PLATFORM', '')
config = {'ADS_ENABLED': ads or demo}
if platform == 'ios':
    config['DISABLE_GAMEPLAY_TELEMETRY'] = True
if ads or demo:
    app_id = os.environ.get('HL_ADMOB_APP_ID', '')
    unit_id = os.environ.get('HL_ADMOB_INTERSTITIAL_ID', '')
    if os.environ.get('HL_NO_ADS') == '1' or (ads and demo) or platform not in ('ios', 'android'):
        sys.exit('Choose exactly one ads mode and a valid target platform.')
    app = re.fullmatch(r'ca-app-pub-(\d{16})~\d{10}', app_id)
    if demo:
        if unit_id or (app_id and not app):
            sys.exit('Demo builds accept an optional AdMob app ID and cannot include an interstitial ID.')
        config.update(TEST_MODE=True)
    else:
        unit = re.fullmatch(r'ca-app-pub-(\d{16})/\d{10}', unit_id)
        if (not app or not unit or app.group(1) != unit.group(1)
                or app.group(1) == '3940256099942544'):
            sys.exit('Ads-only build requires a platform and matching non-demo AdMob app and interstitial IDs.')
        config.update(TEST_MODE=False, REAL_IDS={platform: {'interstitial': unit_id}})
print(json.dumps(config, separators=(',', ':')))
