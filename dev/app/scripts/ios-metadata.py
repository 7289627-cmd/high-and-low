#!/usr/bin/env python3
"""Fill blank Apple metadata for the High & Low iOS draft and one TestFlight build.

Run on the GitHub runner with ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8, followed
by the explicit numeric build number. Existing different values are never
intentionally overwritten. No submission, testers, pricing or declarations.

Apple API: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-appinfos
https://developer.apple.com/documentation/appstoreconnectapi/get-v1-appstoreversions-_id_-appstoreversionlocalizations
https://developer.apple.com/documentation/appstoreconnectapi/get-v1-builds-_id_-betabuildlocalizations
"""
import importlib.util
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

APP = '6835591902'
BASE = 'https://api.appstoreconnect.apple.com'
LOCALE = 'en-US'
INFO = {'subtitle': "Guess your friend's number",
        'privacyPolicyUrl': 'https://7289627-cmd.github.io/high-and-low/privacy.html'}
VERSION = {
    'promotionalText': 'Pick a secret number. Ask higher or lower. Guess right and your friend meets a falling piano. Rated 1v1 duels, or party rooms for up to 6. Free to play.',
    'keywords': 'guessing,number,duel,friends,party,multiplayer,bluff,rank,beans,mind,secret,quick,2 player,online',
    'supportUrl': 'https://7289627-cmd.github.io/high-and-low/support.html',
    'description': """High & Low is a quick number game for two to six players.

Everyone secretly picks a number. Ask higher or lower questions to narrow down another player's number, then make your guess. Guess right and your target gets a cartoon send-off. Last bean standing wins.

PLAY A RATED DUEL

Tap Play for a 1v1 match. Choose a range from 1 to 100, 1 to 10,000, or 1 to 100,000 and climb the ranks. If no other player is waiting, a computer player may fill the empty seat. Rated matches can be against a computer player.

PLAY WITH FRIENDS

Host a room, share its four-letter code, and play with up to six people. Choose the range and timer. Friends rooms are not rated.

MAKE IT YOURS

Pick your bean's color and a hat. Win games to unlock more hats and earn coins for powers. Send quick taunts from a fixed set. There is no text chat.

An internet connection is required. No account or sign-in is needed. Nicknames are visible to others in your game, so avoid using personal information.""",
}
BETA = {'whatsNew': 'Please test the iPhone build: start a rated duel, play a friends room with a code, check sound and haptics, and try leaving and returning to the app. Please report any clipped buttons, freezes or connection problems, along with your iPhone model and iOS version.'}


class SafetyError(Exception):
    pass


def unique(rows, name):
    if len(rows) != 1:
        raise SafetyError(name + ' missing or ambiguous')
    row = rows[0]
    if not isinstance(row, dict) or not re.fullmatch(r'[A-Za-z0-9-]+', str(row.get('id', ''))):
        raise SafetyError(name + ' has invalid identifier')
    return row


def pages(api, path):
    result, seen = [], set()
    initial = urllib.parse.urlsplit(path)
    required_query = urllib.parse.parse_qs(initial.query)
    while path:
        if path in seen or len(seen) >= 100:
            raise SafetyError('invalid or excessive pagination')
        seen.add(path)
        response = api('GET', path)
        if not isinstance(response, dict) or not isinstance(response.get('data'), list):
            raise SafetyError('unexpected list response')
        result.extend(response['data'])
        next_url = response.get('links', {}).get('next')
        if next_url:
            u = urllib.parse.urlsplit(next_url)
            next_query = urllib.parse.parse_qs(u.query)
            if (u.scheme != 'https' or u.netloc != 'api.appstoreconnect.apple.com' or
                    u.path != initial.path or u.fragment or
                    any(next_query.get(key) != value for key, value in required_query.items())):
                raise SafetyError('unsafe pagination URL')
            path = urllib.parse.urlunsplit(('', '', u.path, u.query, ''))
        else:
            path = None
    return result


def missing_fields(current, wanted):
    changes, same, skipped = {}, [], []
    for key, value in wanted.items():
        if key not in current:
            raise SafetyError('Apple omitted a requested metadata field')
        old = current[key]
        if old is None or old == '':
            changes[key] = value
        elif old == value:
            same.append(key)
        else:
            skipped.append(key)
    return changes, same, skipped


def select_build(rows, number, platform):
    candidates = [x for x in rows if x.get('attributes', {}).get('version') == number and platform(x) == 'IOS']
    build = unique(candidates, 'requested iOS build')
    attrs = build.get('attributes', {})
    if attrs.get('processingState') != 'VALID' or attrs.get('expired') is not False:
        raise SafetyError('requested build is not valid and unexpired')
    return build


def attr(row):
    value = row.get('attributes')
    if not isinstance(value, dict):
        raise SafetyError('unexpected resource attributes')
    return value


def get_resource(api, kind, resource_id):
    body = api('GET', '/v1/' + kind + '/' + resource_id)
    row = body.get('data') if isinstance(body, dict) else None
    if not isinstance(row, dict) or row.get('id') != resource_id or row.get('type') != kind:
        raise SafetyError('unexpected resource response')
    return row


def localizations(api, kind, resource_id, rel):
    rows = pages(api, '/v1/' + kind + '/' + resource_id + '/' + rel + '?limit=200')
    return [x for x in rows if attr(x).get('locale') == LOCALE]


def update_missing(api, kind, row, wanted):
    resource_id = unique([row], kind)['id']
    fresh = get_resource(api, kind, resource_id)
    if attr(fresh).get('locale') != LOCALE:
        raise SafetyError('localization changed or mismatched')
    changes, same, skipped = missing_fields(attr(fresh), wanted)
    if changes:
        api('PATCH', '/v1/' + kind + '/' + resource_id,
            {'data': {'type': kind, 'id': resource_id, 'attributes': changes}})
    print(kind + ': filled ' + (', '.join(changes) or 'none') + '; unchanged ' +
          (', '.join(same) or 'none') + '; skipped existing ' + (', '.join(skipped) or 'none'))


def editable_drafts(api):
    app = get_resource(api, 'apps', APP)
    if attr(app).get('bundleId') != 'com.highandlow.game':
        raise SafetyError('app bundle ID does not match')
    versions = pages(api, '/v1/apps/' + APP + '/appStoreVersions?limit=200')
    versions = [x for x in versions if attr(x).get('platform') == 'IOS' and attr(x).get('appVersionState') == 'PREPARE_FOR_SUBMISSION']
    version = unique(versions, 'editable iOS version')
    infos = pages(api, '/v1/apps/' + APP + '/appInfos?limit=50')
    info = unique([x for x in infos if attr(x).get('appStoreState') == 'PREPARE_FOR_SUBMISSION'], 'editable app info')
    return info, version


def sync_locale(api, parent, parent_id, kind, locale, values):
    rows = pages(api, f'/v1/{parent}/{parent_id}/{kind}?limit=200')
    matching = [row for row in rows if attr(row).get('locale') == locale]
    if matching:
        rid = unique(matching, kind + ' ' + locale)['id']
        current = attr(get_resource(api, kind, rid))
        if current.get('locale') != locale:
            raise SafetyError('localization identity changed')
        changes = {k: v for k, v in values.items() if current.get(k) != v}
        if changes:
            api('PATCH', f'/v1/{kind}/{rid}', {'data': {'type': kind, 'id': rid, 'attributes': changes}})
    else:
        response = api('POST', '/v1/' + kind, {'data': {
            'type': kind, 'attributes': {'locale': locale, **values},
            'relationships': {parent[:-1]: {'data': {'type': parent, 'id': parent_id}}},
        }})
        rid = unique([response['data']], kind + ' ' + locale)['id']
    fresh = attr(get_resource(api, kind, rid))
    if fresh.get('locale') != locale or any(fresh.get(k) != value for k, value in values.items()):
        raise SafetyError(f'Apple readback differs for {kind} {locale}')
    print(f'Verified {kind} {locale}', flush=True)


def localized_listing(api):
    info, version = editable_drafts(api)
    english = unique(localizations(api, 'appInfos', info['id'], 'appInfoLocalizations'), 'primary English listing')
    name = attr(english).get('name')
    if name != 'High & Low: Number Duel':
        raise SafetyError('unexpected primary listing name')
    copy_path = pathlib.Path(__file__).resolve().parents[2] / 'store/apple-localizations.json'
    catalog = json.loads(copy_path.read_text(encoding='utf8'))
    primary = unique(localizations(api, 'appStoreVersions', version['id'], 'appStoreVersionLocalizations'), 'primary English version')
    english_version = attr(get_resource(api, 'appStoreVersionLocalizations', primary['id']))
    english_info = attr(get_resource(api, 'appInfoLocalizations', english['id']))
    for current, wanted, kind, parent, parent_id in [
            (english_version, VERSION, 'appStoreVersionLocalizations', 'appStoreVersions', version['id']),
            (english_info, INFO, 'appInfoLocalizations', 'appInfos', info['id'])]:
        # A prior manual add switched the dropdown while a save was pending.
        # Restore primary fields only if they contain an exact non-English translation.
        repair = {k: v for k, v in wanted.items()
                  if any(current.get(k) == copy.get(k) for copy in catalog.values() if k in copy)}
        if repair:
            sync_locale(api, parent, parent_id, kind, LOCALE, repair)
    for locale, copy in catalog.items():
        if (locale == LOCALE or set(copy) != {'subtitle', 'description', 'keywords'}
                or not all(isinstance(v, str) and v.strip() for v in copy.values())
                or len(copy['subtitle']) > 30 or len(copy['description']) > 4000
                or len(copy['keywords'].encode('utf8')) > 100):
            raise SafetyError('invalid localized copy for ' + locale)
    for locale, copy in catalog.items():
        if attr(get_resource(api, 'appStoreVersions', version['id'])).get('appVersionState') != 'PREPARE_FOR_SUBMISSION':
            raise SafetyError('iOS version no longer editable')
        sync_locale(api, 'appInfos', info['id'], 'appInfoLocalizations', locale, {
            'name': name, 'subtitle': copy['subtitle'], 'privacyPolicyUrl': INFO['privacyPolicyUrl']})
        sync_locale(api, 'appStoreVersions', version['id'], 'appStoreVersionLocalizations', locale, {
            'keywords': copy['keywords'], 'description': copy['description'], 'supportUrl': VERSION['supportUrl']})


def run(api, number):
    info, version = editable_drafts(api)
    vloc = unique(localizations(api, 'appStoreVersions', version['id'], 'appStoreVersionLocalizations'), 'version en-US localization')
    iloc = unique(localizations(api, 'appInfos', info['id'], 'appInfoLocalizations'), 'app info en-US localization')
    query = urllib.parse.urlencode({'filter[app]': APP, 'filter[version]': number, 'limit': 200})
    builds = []
    for attempt in range(4):
        builds = pages(api, '/v1/builds?' + query)
        if builds or attempt == 3:
            break
        time.sleep(5)
    def platform(row):
        bid = unique([row], 'build')['id']
        response = api('GET', '/v1/builds/' + bid + '/preReleaseVersion')
        item = response.get('data') if isinstance(response, dict) else None
        if not isinstance(item, dict) or item.get('type') != 'preReleaseVersions':
            raise SafetyError('build prerelease version unavailable')
        return attr(item).get('platform')
    build = select_build(builds, number, platform)
    bloc = localizations(api, 'builds', build['id'], 'betaBuildLocalizations')
    if len(bloc) > 1:
        raise SafetyError('beta en-US localization ambiguous')
    # Recheck editability immediately before mutations. Other writers could still race the API.
    if attr(get_resource(api, 'appStoreVersions', version['id'])).get('appVersionState') != 'PREPARE_FOR_SUBMISSION':
        raise SafetyError('iOS version no longer editable')
    if attr(get_resource(api, 'appInfos', info['id'])).get('appStoreState') != 'PREPARE_FOR_SUBMISSION':
        raise SafetyError('app info no longer editable')
    update_missing(api, 'appStoreVersionLocalizations', vloc, VERSION)
    update_missing(api, 'appInfoLocalizations', iloc, INFO)
    # Re-list to avoid creating a duplicate when localization appeared during preparation.
    bloc = localizations(api, 'builds', build['id'], 'betaBuildLocalizations')
    if len(bloc) > 1:
        raise SafetyError('beta en-US localization ambiguous')
    if bloc:
        update_missing(api, 'betaBuildLocalizations', bloc[0], BETA)
    else:
        api('POST', '/v1/betaBuildLocalizations', {'data': {
            'type': 'betaBuildLocalizations', 'attributes': {'locale': LOCALE, **BETA},
            'relationships': {'build': {'data': {'type': 'builds', 'id': build['id']}}}}})
        print('betaBuildLocalizations: created en-US what-to-test text')


def main():
    if len(sys.argv) != 2 or not (re.fullmatch(r'[1-9][0-9]*', sys.argv[1]) or sys.argv[1] == '--localize'):
        raise SafetyError('usage: ios-metadata.py BUILD_NUMBER | --localize')
    if os.environ.get('GITHUB_ACTIONS') != 'true' or not os.environ.get('RUNNER_TEMP'):
        raise SafetyError('must run on a GitHub Actions runner')
    if any(not os.environ.get(x) for x in ('ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8')):
        raise SafetyError('missing App Store Connect credentials')
    signing_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ios-signing.py')
    spec = importlib.util.spec_from_file_location('ios_signing', signing_path)
    signing = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(signing)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    opener = urllib.request.build_opener(NoRedirect())
    def api(method, path, body=None):
        req = urllib.request.Request(BASE + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': 'Bearer ' + signing.token(), 'Content-Type': 'application/json'})
        try:
            with opener.open(req, timeout=60) as response:
                data = response.read()
                return json.loads(data) if data else {}
        except urllib.error.HTTPError as exc:
            try:
                codes = ', '.join(str(e.get('code', '')) for e in json.loads(exc.read()).get('errors', []))
            except (ValueError, AttributeError):
                codes = ''
            raise SafetyError(f'Apple API {method} {path.split("?")[0]} failed (HTTP {exc.code} {codes})') from None
        except (urllib.error.URLError, TimeoutError, ValueError):
            raise SafetyError('Apple API unavailable or returned invalid JSON') from None
    if sys.argv[1] == '--localize':
        localized_listing(api)
    else:
        run(api, sys.argv[1])


if __name__ == '__main__':
    try:
        main()
    except Exception:
        exc = sys.exc_info()[1]
        message = str(exc) if isinstance(exc, SafetyError) else 'unexpected Apple response'
        print('::error::metadata: ' + message, file=sys.stderr)
        sys.exit(1)
