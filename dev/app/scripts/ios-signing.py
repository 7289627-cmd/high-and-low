#!/usr/bin/env python3
"""Set up (and afterwards remove) App Store signing for the cloud iOS build.

Used by .github/workflows/ios.yml on a GitHub Mac runner. It talks to the App Store Connect API with
the key in ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_P8 and:
  setup   : makes a one-off Apple Distribution certificate and an App Store provisioning profile for
            the app, puts both on the runner, and switches the App target to manual signing.
  cleanup : deletes that certificate and profile again, so nothing piles up in the Apple account.
It never touches certificates or profiles it did not create itself. It prints no secret values.
"""
import base64, json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.request

BUNDLE = os.environ.get('BUNDLE_ID', 'com.highandlow.game')
TEAM = os.environ.get('TEAM_ID', '')
TMP = os.environ.get('RUNNER_TEMP') or tempfile.gettempdir()
STATE = os.path.join(TMP, 'ios_signing.json')
KEYCHAIN = os.path.join(TMP, 'hl-build.keychain-db')
KC_PASS = 'hl-ci'          # throwaway keychain on a throwaway machine
API = 'https://api.appstoreconnect.apple.com'

def fail(msg):
    print('::error::signing: ' + str(msg).replace('\n', ' ')[:900]); sys.exit(1)

def sh(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, **kw)
    if r.returncode != 0:
        fail(' '.join(cmd[:3]) + ' failed: ' + (r.stderr or b'').decode('utf8', 'replace')[-400:] if isinstance(r.stderr, bytes) else str(r.stderr)[-400:])
    return r.stdout

def clean_p8():
    p8 = os.environ.get('ASC_KEY_P8', '')
    body = ''.join(l.strip() for l in p8.strip().splitlines() if 'PRIVATE KEY' not in l)
    return '-----BEGIN PRIVATE KEY-----\n' + '\n'.join(body[i:i+64] for i in range(0, len(body), 64)) + '\n-----END PRIVATE KEY-----\n'

def token():
    kid = re.sub(r'\s', '', os.environ.get('ASC_KEY_ID', '')); iss = re.sub(r'\s', '', os.environ.get('ASC_ISSUER_ID', ''))
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
    now = int(time.time())
    head = b64(json.dumps({'alg': 'ES256', 'kid': kid, 'typ': 'JWT'}).encode())
    pay = b64(json.dumps({'iss': iss, 'iat': now, 'exp': now + 900, 'aud': 'appstoreconnect-v1'}).encode())
    f = tempfile.NamedTemporaryFile('w', suffix='.p8', delete=False); f.write(clean_p8()); f.close()
    try:
        der = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', f.name], input=(head + '.' + pay).encode(), capture_output=True).stdout
    finally:
        os.unlink(f.name)
    if not der: fail('could not sign the API token with the .p8 key')
    i = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7f); raw = b''
    for _ in range(2):
        n = der[i+1]; raw += der[i+2:i+2+n][-32:].rjust(32, b'\0'); i += 2 + n
    return head + '.' + pay + '.' + b64(raw)

def api(method, path, body=None, ok_missing=False):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read(); return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        if ok_missing and e.code in (404, 409): return {}
        detail = e.read().decode('utf8', 'replace')
        try: detail = '; '.join((x.get('title', '') + ': ' + x.get('detail', '')) for x in json.loads(detail).get('errors', []))
        except Exception: detail = detail[:400]
        fail(f'{method} {path.split("?")[0]} answered {e.code}: {detail}')

def setup():
    os.makedirs(TMP, exist_ok=True)
    key = os.path.join(TMP, 'dist.key'); csr = os.path.join(TMP, 'dist.csr'); cer = os.path.join(TMP, 'dist.cer'); pem = os.path.join(TMP, 'dist.pem'); p12 = os.path.join(TMP, 'dist.p12')
    sh(['openssl', 'genrsa', '-out', key, '2048'])
    sh(['openssl', 'req', '-new', '-key', key, '-out', csr, '-subj', '/CN=High and Low cloud build/C=US'])
    state = {}
    cert = api('POST', '/v1/certificates', {'data': {'type': 'certificates', 'attributes': {'certificateType': 'DISTRIBUTION', 'csrContent': open(csr).read()}}})['data']
    state['cert'] = cert['id']; json.dump(state, open(STATE, 'w'))
    open(cer, 'wb').write(base64.b64decode(cert['attributes']['certificateContent']))
    sh(['openssl', 'x509', '-inform', 'DER', '-in', cer, '-out', pem])
    ossl = '/usr/bin/openssl' if os.path.exists('/usr/bin/openssl') else 'openssl'   # the system one writes a .p12 the keychain can read
    sh([ossl, 'pkcs12', '-export', '-inkey', key, '-in', pem, '-out', p12, '-passout', 'pass:' + KC_PASS, '-name', 'High and Low distribution'])
    bids = api('GET', '/v1/bundleIds?filter%5Bidentifier%5D=' + BUNDLE + '&limit=50')['data']
    bid = [b['id'] for b in bids if b['attributes']['identifier'] == BUNDLE]
    if not bid: fail('bundle id ' + BUNDLE + ' is not registered in the Apple developer account')
    name = 'HL CI ' + os.environ.get('GITHUB_RUN_NUMBER', str(int(time.time())))
    prof = api('POST', '/v1/profiles', {'data': {'type': 'profiles', 'attributes': {'name': name, 'profileType': 'IOS_APP_STORE'},
               'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': bid[0]}}, 'certificates': {'data': [{'type': 'certificates', 'id': cert['id']}]}}}})['data']
    state['profile'] = prof['id']; state['name'] = name; json.dump(state, open(STATE, 'w'))
    blob = base64.b64decode(prof['attributes']['profileContent']); uuid = prof['attributes']['uuid']
    for d in ('~/Library/MobileDevice/Provisioning Profiles', '~/Library/Developer/Xcode/UserData/Provisioning Profiles'):
        d = os.path.expanduser(d); os.makedirs(d, exist_ok=True); open(os.path.join(d, uuid + '.mobileprovision'), 'wb').write(blob)
    if sys.platform == 'darwin':
        subprocess.run(['security', 'delete-keychain', KEYCHAIN], capture_output=True)
        sh(['security', 'create-keychain', '-p', KC_PASS, KEYCHAIN])
        sh(['security', 'set-keychain-settings', '-lut', '7200', KEYCHAIN])
        sh(['security', 'unlock-keychain', '-p', KC_PASS, KEYCHAIN])
        sh(['security', 'import', p12, '-k', KEYCHAIN, '-P', KC_PASS, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security'])
        sh(['security', 'set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', KC_PASS, KEYCHAIN])
        cur = subprocess.run(['security', 'list-keychains', '-d', 'user'], capture_output=True, text=True).stdout
        others = [x.strip().strip('"') for x in cur.splitlines() if x.strip() and 'hl-build' not in x]
        sh(['security', 'list-keychains', '-d', 'user', '-s', KEYCHAIN] + others)
        ids = subprocess.run(['security', 'find-identity', '-v', '-p', 'codesigning', KEYCHAIN], capture_output=True, text=True).stdout
        print('signing identities on the runner:', len(re.findall(r'^\s+\d+\)', ids, re.M)))
    for f in (key, csr, p12): os.path.exists(f) and os.unlink(f)
    # Switch only the App target to manual App Store signing. Package targets keep their own settings.
    pbx = os.environ.get('PBXPROJ', 'ios/App/App.xcodeproj/project.pbxproj')
    if os.path.exists(pbx):
        s = open(pbx).read()
        new = ('CODE_SIGN_STYLE = Manual;\n\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";\n\t\t\t\tDEVELOPMENT_TEAM = ' + TEAM +
               ';\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "' + name + '";')
        s2, n = re.subn(r'CODE_SIGN_STYLE = Automatic;', new, s)
        open(pbx, 'w').write(s2)
        print('App target configurations switched to manual signing:', n)
        if not n: fail('could not find CODE_SIGN_STYLE = Automatic in ' + pbx)
    env = os.environ.get('GITHUB_ENV')
    if env: open(env, 'a').write('HL_PROFILE_NAME=' + name + '\n')
    print('::notice::signing ready: certificate and profile "' + name + '" created')

def cleanup():
    try: state = json.load(open(STATE))
    except Exception: print('nothing to clean up'); return
    if state.get('profile'): api('DELETE', '/v1/profiles/' + state['profile'], ok_missing=True)
    if state.get('cert'): api('DELETE', '/v1/certificates/' + state['cert'], ok_missing=True)
    if sys.platform == 'darwin': subprocess.run(['security', 'delete-keychain', KEYCHAIN], capture_output=True)
    os.unlink(STATE); print('one-off certificate and profile removed')

if __name__ == '__main__':
    {'setup': setup, 'cleanup': cleanup}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: fail('use: ios-signing.py setup|cleanup'))()
