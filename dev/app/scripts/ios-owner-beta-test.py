import contextlib
import io
from pathlib import Path
import runpy
import unittest
import urllib.parse


script = runpy.run_path(str(Path(__file__).with_name('ios-owner-beta.py')))
APP, GROUP, Stop = (script[key] for key in ('APP', 'GROUP', 'Stop'))
API_GROUP_ID = 'resolved-api-group-id'
RELATIONSHIPS = '/v1/betaGroups/' + API_GROUP_ID + '/relationships/'


class Apple:
    def __init__(self):
        self.builds = [{'type': 'builds', 'id': 'chosen-build', 'attributes': {
            'version': '18', 'processingState': 'VALID', 'expired': False,
        }}]
        self.groups = [{'type': 'betaGroups', 'id': API_GROUP_ID, 'attributes': {
            'name': GROUP, 'isInternalGroup': True, 'publicLinkEnabled': False, 'hasAccessToAllBuilds': False,
        }}]
        self.app = {'type': 'apps', 'id': APP}
        self.testers = [{'type': 'betaTesters', 'id': name} for name in ('tester-one', 'tester-two')]
        self.group_builds = [{'type': 'builds', 'id': 'earlier-build'}]
        self.writes = []
        self.save_link = True

    def __call__(self, method, path, body=None):
        url = urllib.parse.urlsplit(path)
        route = url.path
        if method == 'POST' and route == RELATIONSHIPS + 'builds':
            self.writes.append((method, path, body))
            if self.save_link:
                self.group_builds.extend(body['data'])
            return {}
        if method != 'GET' or body is not None:
            raise AssertionError('Unexpected Apple mutation')
        query = urllib.parse.parse_qs(url.query)
        if route == '/v1/builds':
            expected = {'filter[app]': APP, 'filter[preReleaseVersion.platform]': 'IOS',
                        'filter[preReleaseVersion.version]': '1.0.18', 'filter[version]': '18'}
            for key, value in expected.items():
                assert query.get(key) == [value]
            return {'data': self.builds}
        if route == '/v1/betaGroups':
            assert query['filter[app]'] == [APP] and query['filter[name]'] == [GROUP]
            return {'data': self.groups}
        if route == RELATIONSHIPS + 'app':
            return {'data': self.app}
        if route == RELATIONSHIPS + 'builds':
            return {'data': self.group_builds}
        raise AssertionError(f'Unexpected Apple route: {route}')


class AssignmentTests(unittest.TestCase):
    def assign(self, api):
        with contextlib.redirect_stdout(io.StringIO()):
            script['assign'](api, '18')

    def test_links_exact_build_once_without_replacing_builds_or_testers(self):
        api = Apple()
        self.assign(api)
        self.assign(api)
        self.assertEqual(api.writes, [('POST', RELATIONSHIPS + 'builds', {
            'data': [{'type': 'builds', 'id': 'chosen-build'}],
        })])
        self.assertEqual([record['id'] for record in api.group_builds], ['earlier-build', 'chosen-build'])
        self.assertEqual([record['id'] for record in api.testers], ['tester-one', 'tester-two'])

    def test_accepts_explicit_null_for_the_verified_internal_groups_public_link(self):
        api = Apple()
        api.groups[0]['attributes']['publicLinkEnabled'] = None
        self.assign(api)
        self.assertEqual(len(api.writes), 1)

    def test_rejects_unsafe_or_unavailable_targets_before_writing(self):
        for fault in ('processing', 'expired', 'missing group', 'external', 'public link', 'automatic',
                      'missing public link', 'unrecognized public link', 'other app', 'duplicate same-name group'):
            with self.subTest(fault=fault):
                api = Apple()
                if fault == 'processing':
                    api.builds[0]['attributes']['processingState'] = 'PROCESSING'
                elif fault == 'expired':
                    api.builds[0]['attributes']['expired'] = True
                elif fault == 'missing group':
                    api.groups.clear()
                elif fault == 'external':
                    api.groups[0]['attributes']['isInternalGroup'] = False
                elif fault == 'public link':
                    api.groups[0]['attributes']['publicLinkEnabled'] = True
                elif fault == 'missing public link':
                    del api.groups[0]['attributes']['publicLinkEnabled']
                elif fault == 'unrecognized public link':
                    api.groups[0]['attributes']['publicLinkEnabled'] = 0
                elif fault == 'automatic':
                    api.groups[0]['attributes']['hasAccessToAllBuilds'] = True
                elif fault == 'other app':
                    api.app['id'] = 'other-app'
                elif fault == 'duplicate same-name group':
                    api.groups.append(dict(api.groups[0], id='duplicate-group-id'))
                with self.assertRaises(Stop):
                    self.assign(api)
                self.assertEqual(api.writes, [])

    def test_fails_when_apple_does_not_return_the_new_association(self):
        api = Apple()
        api.save_link = False
        with self.assertRaises(Stop):
            self.assign(api)
        self.assertEqual(len(api.writes), 1)


if __name__ == '__main__':
    unittest.main()
