#!/usr/bin/env python3
"""Prepare, inspect, or explicitly assign a build to the private High & Low TestFlight group."""
import json
import os
from pathlib import Path
import re
import runpy
import sys
import urllib.error
import urllib.parse
import urllib.request

APP = '6835591902'
GROUP = 'High & Low Owner Test'
OWNER_GROUP_ID = 'e1735043-f046-40af-a7ea-de5d07e2d285'
FLAGS = {'name': GROUP, 'isInternalGroup': True, 'publicLinkEnabled': False,
         'hasAccessToAllBuilds': False}


class Stop(Exception):
    """Messages shown to the operator must contain no account data."""


def rows(response):
    if not isinstance(response.get('data'), list) or response.get('links', {}).get('next'):
        raise Stop('Unexpected or ambiguous Apple result')
    return response['data']


def identifier(resource, kind):
    value = resource.get('id')
    if resource.get('type') != kind or not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9-]+', value):
        raise Stop('Unexpected Apple resource identifier')
    return value


def build_path(number, with_beta_detail=False):
    if not re.fullmatch(r'[1-9][0-9]*', number):
        raise Stop('Expected a positive integer build number')
    query = {
        'filter[app]': APP, 'filter[preReleaseVersion.platform]': 'IOS',
        'filter[preReleaseVersion.version]': '1.0.' + number, 'filter[version]': number,
        'fields[builds]': 'version,processingState,expired', 'limit': 2,
    }
    if with_beta_detail:
        query.update({'include': 'buildBetaDetail', 'fields[buildBetaDetails]': 'internalBuildState'})
        query['fields[builds]'] += ',buildBetaDetail'
    return '/v1/builds?' + urllib.parse.urlencode(query)


def groups_path():
    return '/v1/betaGroups?' + urllib.parse.urlencode({
        'filter[app]': APP, 'filter[name]': GROUP, 'fields[betaGroups]': ','.join(FLAGS), 'limit': 2,
    })


def valid_build(api, number):
    builds = rows(api('GET', build_path(number)))
    if len(builds) != 1:
        raise Stop('The requested iOS build is missing or ambiguous')
    build = builds[0]
    attrs = build['attributes']
    if attrs.get('version') != number or attrs.get('processingState') != 'VALID' or attrs.get('expired') is not False:
        raise Stop('The requested iOS build did not pass version, processing and expiration checks')
    return {'type': 'builds', 'id': identifier(build, 'builds')}


def group_relationships(api, group, *, allow_null_public_link=False):
    group_id = identifier(group, 'betaGroups')
    attr = group['attributes']
    public_link = attr.get('publicLinkEnabled', True)
    closed = public_link is False or (allow_null_public_link and public_link is None)
    if (attr.get('name') != GROUP or attr.get('isInternalGroup') is not True
            or not closed or attr.get('hasAccessToAllBuilds') is not False):
        raise Stop('Group name, visibility or manual distribution settings do not match')
    base = '/v1/betaGroups/' + group_id + '/relationships/'
    if api('GET', base + 'app')['data'] != {'type': 'apps', 'id': APP}:
        raise Stop('Group belongs to a different app')
    return base


def prepare(api, number):
    build_link = valid_build(api, number)
    app_link = {'type': 'apps', 'id': APP}
    groups = rows(api('GET', groups_path()))
    if len(groups) > 1:
        raise Stop('Multiple groups matched the owner group')
    if not groups:
        # Create the group and assign the build together; nobody can join the group between those operations.
        result = api('POST', '/v1/betaGroups', {'data': {
            'type': 'betaGroups', 'attributes': FLAGS,
            'relationships': {'app': {'data': app_link}, 'builds': {'data': [build_link]},
                              'betaTesters': {'data': []}},
        }})
        group_id = identifier(result['data'], 'betaGroups')
        groups = rows(api('GET', groups_path()))
        if len(groups) != 1 or identifier(groups[0], 'betaGroups') != group_id:
            raise Stop('Created group could not be uniquely verified; inspect TestFlight before retrying')
    base = group_relationships(api, groups[0])
    if rows(api('GET', base + 'betaTesters?limit=1')):
        raise Stop('The owner group already has testers')
    if rows(api('GET', base + 'builds?limit=2')) != [build_link]:
        raise Stop('Existing group has a different build set; no build was added to it')
    print(f'Verified private manual group for High & Low iOS 1.0.{number}, build {number}, with zero testers.')


def assign(api, number):
    build = valid_build(api, number)
    groups = rows(api('GET', groups_path()))
    if len(groups) != 1 or identifier(groups[0], 'betaGroups') != OWNER_GROUP_ID:
        raise Stop('The existing owner group is missing or ambiguous')
    base = group_relationships(api, groups[0], allow_null_public_link=True)
    builds = base + 'builds'
    if build not in rows(api('GET', builds + '?limit=200')):
        api('POST', builds, {'data': [build]})
        if build not in rows(api('GET', builds + '?limit=200')):
            raise Stop('Build assignment could not be verified in the owner group')
    print(f'Verified High & Low iOS 1.0.{number}, build {number}, in the internal owner group.')


def flag(attr, key):
    if key not in attr:
        return 'omitted'
    value = attr[key]
    return json.dumps(value) if value is None or isinstance(value, bool) else 'unrecognized'


def inspect_group(get, build_id):
    groups = rows(get(groups_path()))
    print('Owner group candidates:', len(groups))
    if len(groups) != 1:
        return
    group = groups[0]
    base = '/v1/betaGroups/' + identifier(group, 'betaGroups') + '/relationships/'
    attr = group['attributes']
    name_matches = attr.get('name') == GROUP
    app_matches = identifier(get(base + 'app')['data'], 'apps') == APP
    print('Exact group name:', name_matches, '| Exact app:', app_matches)
    for key in ('isInternalGroup', 'publicLinkEnabled', 'hasAccessToAllBuilds'):
        print(key + ':', flag(attr, key))
    if not name_matches or not app_matches:
        return
    testers = get(base + 'betaTesters?limit=2')
    if not isinstance(testers.get('data'), list):
        raise Stop('Unexpected tester count response')
    print('Testers (capped):', '2+' if len(testers['data']) >= 2 or testers.get('links', {}).get('next') else len(testers['data']))
    linked = get(base + 'builds?limit=2')
    linked_ids = {identifier(item, 'builds') for item in linked['data']}
    more = bool(linked.get('links', {}).get('next'))
    if not build_id:
        print('Requested build linked: unknown | Other builds: unknown')
    else:
        matches = 'yes' if build_id in linked_ids else ('unknown' if more else 'no')
        print('Requested build linked:', matches, '| Other builds:', 'yes' if linked_ids - {build_id} or more else 'no')


def inspect(get, number):
    path = build_path(number, with_beta_detail=True)
    build_id = None
    build_error = None
    try:
        response = get(path)
        builds = rows(response)
        print('Requested build candidates:', len(builds))
        if len(builds) == 1 and builds[0]['attributes'].get('version') == number:
            build_id = identifier(builds[0], 'builds')
            attrs = builds[0]['attributes']
            state = attrs.get('processingState')
            print('Processing:', state if state in ('PROCESSING', 'FAILED', 'INVALID', 'VALID') else 'unknown',
                  '| Expired:', flag(attrs, 'expired'))
            details = [x for x in response.get('included', []) if x.get('type') == 'buildBetaDetails']
            beta = details[0]['attributes'].get('internalBuildState') if len(details) == 1 else None
            allowed = ('PROCESSING', 'PROCESSING_EXCEPTION', 'MISSING_EXPORT_COMPLIANCE', 'IN_EXPORT_COMPLIANCE_REVIEW',
                       'READY_FOR_BETA_TESTING', 'IN_BETA_TESTING', 'EXPIRED')
            print('Internal TestFlight state:', beta if beta in allowed else 'unknown')
    except Stop as error:
        build_error = error
        print('Build status unavailable:', error)
    inspect_group(get, build_id)
    if build_error:
        raise build_error


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] not in ('--inspect', '--assign')):
        raise Stop('Usage: ios-owner-beta.py BUILD_NUMBER [--inspect | --assign]')
    mode = sys.argv[2] if len(sys.argv) == 3 else None
    if os.environ.get('GITHUB_ACTIONS') != 'true' or not os.environ.get('RUNNER_TEMP'):
        raise Stop('Run on a GitHub Actions runner')
    if any(not os.environ.get(key) for key in ('ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8')):
        raise Stop('Missing App Store Connect credentials')
    signing = runpy.run_path(str(Path(__file__).with_name('ios-signing.py')))
    opener = urllib.request.build_opener(NoRedirect())

    def api(method, path, body=None):
        if mode == '--inspect' and (method != 'GET' or body is not None):
            raise Stop('Read-only mode refused a write')
        request = urllib.request.Request(signing['API'] + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': 'Bearer ' + signing['token'](), 'Content-Type': 'application/json'})
        try:
            with opener.open(request, timeout=15) as response:
                if response.status == 204:
                    return {}
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise Stop(f'Apple API {method} returned HTTP {error.code}') from None
        except (urllib.error.URLError, TimeoutError, ValueError):
            raise Stop('Apple API unavailable or invalid response; check group state before retrying') from None

    if mode == '--inspect':
        inspect(lambda path: api('GET', path), sys.argv[1])
    elif mode == '--assign':
        assign(api, sys.argv[1])
    else:
        prepare(api, sys.argv[1])


if __name__ == '__main__':
    try:
        main()
    except Stop as error:
        sys.exit('::error::' + str(error))
    except (AttributeError, IndexError, KeyError, TypeError):
        sys.exit('::error::Unexpected Apple response')
