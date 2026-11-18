"""Run on macOS after cap sync ios with a demo build. Argument: evidence directory."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import tempfile
import time


APP = Path(__file__).resolve().parents[1]
PROJECT = APP / 'ios/App'
UNIT = 'ca-app-pub-3940256099942544/4411468910'
PROBE = r"""
(() => {
  const cap = window.Capacitor;
  const native = cap.nativePromise.bind(cap);
  const events = [];
  const start = Date.now();
  let scheduled = false;
  function record(name, data = {}) {
    events.push({ms: Date.now() - start, name, data});
    native('Preferences', 'set', {key: 'sim-ad-trace', value: JSON.stringify(events)}).catch(() => {});
  }
  function fields(value) {
    const result = {};
    for (const k of ['adUnitId', 'status', 'canRequestAds', 'privacyOptionsRequirementStatus',
                     'isConsentFormAvailable', 'message', 'code'])
      if (value && value[k] !== undefined) result[k] = value[k];
    return result;
  }
  const demo = 'ca-app-pub-3940256099942544/4411468910';
  record('probe', {platform: cap.getPlatform(), admob: cap.PluginHeaders.some(p => p.name === 'AdMob')});
  for (const event of ['interstitialAdLoaded','interstitialAdFailedToLoad','interstitialAdShowed',
                       'interstitialAdFailedToShow','interstitialAdDismissed'])
    cap.nativeCallback('AdMob', 'addListener', {eventName: event}, data => record(event, fields(data)));
  cap.nativePromise = (plugin, method, options) => {
    if (plugin !== 'AdMob') return native(plugin, method, options);
    if (/^(prepare|showBanner)/.test(method) && !(method === 'prepareInterstitial' && options?.adId === demo)) {
      record('nonDemoRequestBlocked', {method});
      return Promise.reject(new Error('Simulator requires the iOS demo interstitial'));
    }
    record(method + '.call', method === 'prepareInterstitial' ? {adId: options.adId, isTesting: !!options.isTesting} : {});
    const pending = native(plugin, method, options);
    pending.then(data => {
      record(method + '.ok', fields(data));
      if (method === 'prepareInterstitial' && !scheduled) {
        scheduled = true;
        // Let the app commit the completed preload before simulating a valid results opportunity.
        setTimeout(async () => {
          record('opportunity', {visible: !document.hidden, online: navigator.onLine});
          try {
            const shown = await window.HLNative.showInterstitial(() => true);
            record('opportunity.returned', {shown});
          } catch (e) { record('opportunity.error', fields(e)); }
        }, 500);
      }
    }, error => record(method + '.error', fields(error)));
    return pending;
  };
})();
"""


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def sim(*args):
    return run('xcrun', 'simctl', *args)


@contextlib.contextmanager
def staged_probe():
    page = PROJECT / 'App/public/index.html'
    consent = APP / 'node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/Consent/ConsentExecutor.swift'
    page_original = page.read_bytes()
    consent_original = consent.read_bytes()
    html = page_original.decode()
    configs = re.findall(r'<script>window\.HL_NATIVE_CONFIG=(.*?)</script>', html)
    if len(configs) != 1 or json.loads(configs[0]) != {'ADS_ENABLED': True, 'TEST_MODE': True}:
        raise ValueError('The generated app must be built with the unmodified demo configuration.')
    marker = '<script src="hlnative.js"></script>'
    if html.count(marker) != 1:
        raise ValueError('Missing native bridge script marker')
    original = 'if error != nil {'
    swift = consent_original.decode()
    if swift.count(original) != 1:
        raise ValueError('The UMP plugin implementation changed; check the log instrumentation.')
    store_error = ('let diagnostic = error as NSError\n'
                   'UserDefaults.standard.set(["domain": diagnostic.domain, "code": diagnostic.code, '
                   '"message": diagnostic.localizedDescription] as [String: Any], forKey: "sim-ad-ump-error")')
    form_catch = '} catch {\n                        call.reject("Request consent info failed")'
    if swift.count(form_catch) != 1:
        raise ValueError('The UMP form error path changed.')
    try:
        page.write_text(html.replace(marker, '<script>' + PROBE + '</script>\n' + marker))
        swift = swift.replace(original, 'if let error = error {\n' + store_error)
        consent.write_text(swift.replace(form_catch, form_catch.replace('catch {', 'catch {\n' + store_error)))
        yield
    finally:
        page.write_bytes(page_original)
        consent.write_bytes(consent_original)


def create_device():
    devices = json.loads(sim('list', 'devices', 'available', '-j'))['devices']
    candidates = []
    for runtime, models in devices.items():
        match = re.search(r'SimRuntime\.iOS-([\d-]+)$', runtime)
        if not match:
            continue
        version = tuple(map(int, match[1].split('-')))
        for device in models:
            if version[0] >= 26 and device['name'].startswith('iPhone') and device.get('deviceTypeIdentifier'):
                candidates.append((version, device['name'], runtime, device['deviceTypeIdentifier']))
    if not candidates:
        raise RuntimeError('No available iPhone simulator with iOS 26 or newer')
    _, model, runtime, device_type = max(candidates)
    print(f'Creating fresh {model} with {runtime}', flush=True)
    return sim('create', 'High and Low AdMob QA', device_type, runtime)


def outcome(events, expired=False):
    by = {event['name']: event['data'] for event in events}
    if 'nonDemoRequestBlocked' in by:
        return 'non_demo_request_blocked'
    if 'probe' in by and not by['probe']['admob']:
        return 'admob_plugin_missing'
    if 'requestConsentInfo.error' in by or 'showConsentForm.error' in by:
        return 'ump_error'
    if 'initialize.error' in by:
        return 'initialization_error'
    for key in ('interstitialAdFailedToLoad', 'prepareInterstitial.error'):
        if key in by:
            error = by[key]
            if str(error.get('code')) == '1' or 'no fill' in str(error.get('message', '')).lower():
                return 'no_fill'
            return 'load_error'
    if 'prepareInterstitial.ok' in by and by['prepareInterstitial.ok'].get('adUnitId') != UNIT:
        return 'unexpected_native_ad_unit'
    if 'interstitialAdFailedToShow' in by or 'showInterstitial.error' in by:
        return 'presentation_error'
    if 'interstitialAdShowed' in by and 'prepareInterstitial.ok' in by and 'showInterstitial.call' in by:
        return 'native_shown'
    if 'opportunity.returned' in by or 'opportunity.error' in by:
        return 'native_ready_game_declined' if 'showInterstitial.call' not in by else 'show_without_delegate'
    if not expired:
        return None
    if 'showInterstitial.call' in by:
        return 'show_without_delegate'
    if 'prepareInterstitial.ok' in by:
        return 'native_ready'
    if 'prepareInterstitial.call' in by:
        return 'load_timeout'
    if 'showConsentForm.call' in by and 'showConsentForm.ok' not in by:
        return 'consent_form_pending'
    info = by.get('showConsentForm.ok', by.get('requestConsentInfo.ok', {}))
    if info.get('canRequestAds') is False:
        return 'consent_disallows_ads'
    return 'startup_timeout'


def error_category(message):
    value = str(message).lower()
    if re.search(r"(?:no|find|missing|publish|configure).{0,35}(?:form|message)|(?:form|message).{0,25}(?:found|published|configured)", value):
        return 'form_configuration'
    if re.search(r'publisher|misconfigur|application id|app id|account configur', value):
        return 'publisher_configuration'
    if re.search(r'network|offline|internet|timed? ?out|connect', value):
        return 'network'
    if 'no fill' in value or 'no ad to show' in value:
        return 'no_fill'
    return 'unspecified'


def safe_code(value):
    return str(value) if re.fullmatch(r'-?\d{1,5}', str(value)) else 'unknown'


def public_events(events):
    published = []
    for event in events:
        data = {}
        for key, value in event['data'].items():
            if key in ('adUnitId', 'adId'):
                data[key] = 'google_ios_demo' if value == UNIT else 'unexpected'
            elif key == 'message':
                data['errorCategory'] = error_category(value)
            elif key == 'code':
                data[key] = safe_code(value)
            elif isinstance(value, bool) or value in ('ios', 'NOT_REQUIRED', 'REQUIRED', 'OBTAINED', 'UNKNOWN'):
                data[key] = value
        published.append({'ms': event['ms'], 'name': event['name'], 'data': data})
    return published


def public_ump(error):
    if not error:
        return {}
    domain = str(error.get('domain', ''))
    if not re.fullmatch(r'[A-Za-z.-]{1,100}', domain):
        domain = 'unrecognized'
    return {'domain': domain, 'code': safe_code(error.get('code')), 'category': error_category(error.get('message'))}


def verify(udid, evidence, derived):
    sim('boot', udid)
    subprocess.run(['xcrun', 'simctl', 'bootstatus', udid, '-b'], check=True, timeout=360)
    target = ['-workspace', 'App.xcworkspace'] if (PROJECT / 'App.xcworkspace').is_dir() else ['-project', 'App.xcodeproj']
    build_path = Path(derived) / 'qa-build.log'
    with staged_probe(), build_path.open('w') as build_log:
        result = subprocess.run(['xcodebuild', *target, '-scheme', 'App', '-configuration', 'Release',
                                 '-sdk', 'iphonesimulator', '-destination', f'id={udid}', '-derivedDataPath', derived,
                                 'CODE_SIGNING_ALLOWED=NO', 'build'], cwd=PROJECT, stdout=build_log, stderr=subprocess.STDOUT)
    if result.returncode:
        for line in build_path.read_text(errors='replace').splitlines():
            if 'error:' in line.lower():
                print(re.sub(r'ca-app-pub-\d+[~/]\d+|\d{8,}', '[redacted]', line)[:280])
        result.check_returncode()
    bundle = Path(derived) / 'Build/Products/Release-iphonesimulator/App.app'
    info = plistlib.loads((bundle / 'Info.plist').read_bytes())
    app_id = info['CFBundleIdentifier']
    configured = os.environ.get('HL_ADMOB_APP_ID') or 'ca-app-pub-3940256099942544~1458002511'
    if not re.fullmatch(r'ca-app-pub-\d{16}~\d{10}', configured) or info.get('GADApplicationIdentifier') != configured:
        raise ValueError('Packaged AdMob app ID differs from requested demo configuration')
    if PROBE not in (bundle / 'public/index.html').read_text():
        raise RuntimeError('Simulator app lacks the diagnostic probe')
    sim('install', udid, str(bundle))
    data_dir = Path(sim('get_app_container', udid, app_id, 'data'))
    prefs = data_dir / f'Library/Preferences/{app_id}.plist'
    sim('launch', udid, app_id)
    deadline = time.monotonic() + 110
    events = []
    ump = {}
    while True:
        try:
            stored = plistlib.loads(prefs.read_bytes())
            ump = public_ump(stored.get('sim-ad-ump-error'))
            snapshot = stored.get('CapacitorStorage.sim-ad-trace', '[]')
            observed = json.loads(snapshot)
            if len(observed) > len(events):
                events = observed
        except (FileNotFoundError, plistlib.InvalidFileException):
            pass
        status = outcome(events, time.monotonic() >= deadline)
        if status:
            break
        time.sleep(1)
    stages = {}
    for event in events:
        method, _, completion = event['name'].partition('.')
        labels = {'requestConsentInfo': 'consent', 'showConsentForm': 'form',
                  'initialize': 'initialize', 'prepareInterstitial': 'preload'}
        if method in labels and completion in ('ok', 'error') and labels[method] not in stages:
            began = next((e for e in events if e['name'] == method + '.call'), None)
            if began:
                stages[labels[method]] = event['ms'] - began['ms']
        if event['name'] == 'interstitialAdShowed':
            stages['shown_since_probe'] = event['ms']
    report = {'outcome': status, 'events': public_events(events), 'timings_ms': stages, 'ump_error': ump,
              'admob_app_id_verified': True, 'app_id_kind': 'google_sample' if configured.endswith('3940256099942544~1458002511') else 'configured'}
    (evidence / 'result.json').write_text(json.dumps(report, indent=2))
    summary = [status] + [f'{key}={value}ms' for key, value in stages.items()]
    if ump:
        summary.extend([f"UMP={ump['domain']}/{ump['code']}", ump['category']])
    print('::notice title=iOS AdMob simulator::' + ' '.join(summary), flush=True)
    time.sleep(2)
    subprocess.run(['xcrun', 'simctl', 'io', udid, 'screenshot', str(evidence / 'screen.png')], check=False)
    return status == 'native_shown'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence', type=Path)
    dest = parser.parse_args().evidence.resolve()
    dest.mkdir(parents=True, exist_ok=True)
    os.chdir(APP)
    device = create_device()
    try:
        with tempfile.TemporaryDirectory(prefix='hl-sim-') as derived_data:
            passed = verify(device, dest, derived_data)
    finally:
        subprocess.run(['xcrun', 'simctl', 'shutdown', device], check=False)
        subprocess.run(['xcrun', 'simctl', 'delete', device], check=False)
    raise SystemExit(0 if passed else 1)
