#!/usr/bin/env python3
"""Prepare one iOS build in an empty, manual, private High & Low TestFlight group.

Apple supports assigning builds and testers in the original group-creation request.
For an existing group Apple has no conditional add-build-if-empty operation, so
this script only verifies an existing group; it never modifies its membership.
"""
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


def prepare(api, number):
    if not re.fullmatch(r'[1-9][0-9]*', number):
        raise Stop('Expected a positive integer build number')
    query = urllib.parse.urlencode({
        'filter[app]': APP, 'filter[preReleaseVersion.platform]': 'IOS',
        'filter[preReleaseVersion.version]': '1.0.' + number, 'filter[version]': number,
        'fields[builds]': 'version,processingState,expired', 'limit': 2,
    })
    builds = rows(api('GET', '/v1/builds?' + query))
    if len(builds) != 1:
        raise Stop('The requested iOS build is missing or ambiguous')
    build = builds[0]
    attrs = build['attributes']
    if attrs.get('version') != number or attrs.get('processingState') != 'VALID' or attrs.get('expired') is not False:
        raise Stop('The requested iOS build did not pass version, processing and expiration checks')
    build_id = identifier(build, 'builds')
    build_link = {'type': 'builds', 'id': build_id}
    app_link = {'type': 'apps', 'id': APP}
    groups_path = '/v1/betaGroups?' + urllib.parse.urlencode({
        'filter[app]': APP, 'filter[name]': GROUP, 'fields[betaGroups]': ','.join(FLAGS), 'limit': 2,
    })
    groups = rows(api('GET', groups_path))
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
        groups = rows(api('GET', groups_path))
        if len(groups) != 1 or identifier(groups[0], 'betaGroups') != group_id:
            raise Stop('Created group could not be uniquely verified; inspect TestFlight before retrying')
    group_id = identifier(groups[0], 'betaGroups')
    attr = groups[0]['attributes']
    if (attr.get('name') != GROUP or attr.get('isInternalGroup') is not True
            or attr.get('publicLinkEnabled') is not False or attr.get('hasAccessToAllBuilds') is not False):
        raise Stop('Group name, visibility or manual distribution settings do not match')
    base = '/v1/betaGroups/' + group_id + '/relationships/'
    if api('GET', base + 'app')['data'] != app_link:
        raise Stop('Group belongs to a different app')
    if rows(api('GET', base + 'betaTesters?limit=1')):
        raise Stop('The owner group already has testers')
    if rows(api('GET', base + 'builds?limit=2')) != [build_link]:
        raise Stop('Existing group has a different build set; no build was added to it')
    print(f'Verified private manual group for High & Low iOS 1.0.{number}, build {number}, with zero testers.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    if len(sys.argv) != 2:
        raise Stop('Usage: ios-owner-beta.py BUILD_NUMBER')
    if os.environ.get('GITHUB_ACTIONS') != 'true' or not os.environ.get('RUNNER_TEMP'):
        raise Stop('Run on a GitHub Actions runner')
    if any(not os.environ.get(key) for key in ('ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8')):
        raise Stop('Missing App Store Connect credentials')
    signing = runpy.run_path(str(Path(__file__).with_name('ios-signing.py')))
    opener = urllib.request.build_opener(NoRedirect())

    def api(method, path, body=None):
        request = urllib.request.Request(signing['API'] + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': 'Bearer ' + signing['token'](), 'Content-Type': 'application/json'})
        try:
            with opener.open(request, timeout=15) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise Stop(f'Apple API {method} returned HTTP {error.code}') from None
        except (urllib.error.URLError, TimeoutError, ValueError):
            raise Stop('Apple API unavailable or invalid response; check group state before retrying') from None

    prepare(api, sys.argv[1])


if __name__ == '__main__':
    try:
        main()
    except Stop as error:
        sys.exit('::error::' + str(error))
    except (AttributeError, IndexError, KeyError, TypeError):
        sys.exit('::error::Unexpected Apple response')
