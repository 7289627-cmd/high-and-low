import importlib.util
import pathlib
import unittest


SCRIPT = pathlib.Path(__file__).with_name('ios-metadata.py')


def load():
    spec = importlib.util.spec_from_file_location('ios_metadata', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class MetadataSafetyTests(unittest.TestCase):
    def test_existing_different_values_are_not_overwritten(self):
        m = load()
        existing = {'description': 'Existing owner copy', 'keywords': '', 'supportUrl': None}
        changes, same, skipped = m.missing_fields(existing, {
            'description': 'New copy', 'keywords': 'number,game', 'supportUrl': 'https://example.test/'})
        self.assertEqual(changes, {'keywords': 'number,game', 'supportUrl': 'https://example.test/'})
        self.assertEqual(same, [])
        self.assertEqual(skipped, ['description'])

    def test_exact_values_are_idempotent(self):
        m = load()
        self.assertEqual(m.missing_fields({'subtitle': 'Hello'}, {'subtitle': 'Hello'}), ({}, ['subtitle'], []))

    def test_unique_selection_rejects_missing_or_ambiguous(self):
        m = load()
        with self.assertRaises(m.SafetyError):
            m.unique([], 'localization')
        with self.assertRaises(m.SafetyError):
            m.unique([{'id': 'a'}, {'id': 'b'}], 'localization')

    def test_pagination_rejects_foreign_hosts_before_request(self):
        m = load()
        requests = []
        def fake(method, path, body=None):
            requests.append(path)
            return {'data': [], 'links': {'next': 'https://evil.example/v1/apps'}}
        with self.assertRaises(m.SafetyError):
            m.pages(fake, '/v1/apps/6835591902/builds')
        self.assertEqual(len(requests), 1)

    def test_pagination_collects_multiple_apple_pages(self):
        m = load()
        def fake(method, path, body=None):
            if 'cursor=' not in path:
                return {'data': [{'id': 'a'}], 'links': {'next': 'https://api.appstoreconnect.apple.com/v1/a?cursor=2'}}
            return {'data': [{'id': 'b'}], 'links': {}}
        self.assertEqual([x['id'] for x in m.pages(fake, '/v1/a')], ['a', 'b'])

    def test_only_requested_ios_build_can_be_selected(self):
        m = load()
        rows = [{'id': 'ios', 'attributes': {'version': '12', 'processingState': 'VALID', 'expired': False}},
                {'id': 'mac', 'attributes': {'version': '12', 'processingState': 'VALID', 'expired': False}}]
        def platform(build):
            return 'IOS' if build['id'] == 'ios' else 'MAC_OS'
        self.assertEqual(m.select_build(rows, '12', platform)['id'], 'ios')
        with self.assertRaises(m.SafetyError):
            m.select_build(rows, '11', platform)
        with self.assertRaises(m.SafetyError):
            m.select_build(rows, '12', lambda _: 'IOS')

    def test_invalid_processing_or_expired_build_is_rejected(self):
        m = load()
        rows = [{'id': 'a', 'attributes': {'version': '12', 'processingState': 'PROCESSING', 'expired': False}}]
        with self.assertRaises(m.SafetyError):
            m.select_build(rows, '12', lambda _: 'IOS')
        rows[0]['attributes'].update(processingState='VALID', expired=True)
        with self.assertRaises(m.SafetyError):
            m.select_build(rows, '12', lambda _: 'IOS')

    def test_full_sync_does_not_overwrite_and_is_idempotent(self):
        m = load()
        def resource(kind, rid, attrs):
            return {'type': kind, 'id': rid, 'attributes': attrs}
        records = {
            ('apps', m.APP): resource('apps', m.APP, {'bundleId': 'com.highandlow.game'}),
            ('appStoreVersions', 'ver'): resource('appStoreVersions', 'ver', {'platform': 'IOS', 'appVersionState': 'PREPARE_FOR_SUBMISSION'}),
            ('appInfos', 'info'): resource('appInfos', 'info', {'appStoreState': 'PREPARE_FOR_SUBMISSION'}),
            ('appStoreVersionLocalizations', 'vl'): resource('appStoreVersionLocalizations', 'vl', {'locale': 'en-US', **{k: None for k in m.VERSION}}),
            ('appInfoLocalizations', 'il'): resource('appInfoLocalizations', 'il', {'locale': 'en-US', **{k: None for k in m.INFO}}),
            ('builds', 'build'): resource('builds', 'build', {'version': '12', 'processingState': 'VALID', 'expired': False}),
            ('betaBuildLocalizations', 'bl'): resource('betaBuildLocalizations', 'bl', {'locale': 'en-US', 'whatsNew': None}),
        }
        records['appStoreVersionLocalizations', 'vl']['attributes']['description'] = 'Existing owner text'
        calls = []
        def fake(method, path, body=None):
            clean = path.split('?')[0]
            calls.append((method, clean, body))
            if method == 'PATCH':
                _, _, kind, rid = clean.split('/')
                records[kind, rid]['attributes'].update(body['data']['attributes'])
                return {}
            if clean == '/v1/apps/' + m.APP + '/appStoreVersions':
                return {'data': [records['appStoreVersions', 'ver']]}
            if clean == '/v1/apps/' + m.APP + '/appInfos':
                return {'data': [records['appInfos', 'info']]}
            if clean == '/v1/appStoreVersions/ver/appStoreVersionLocalizations':
                return {'data': [records['appStoreVersionLocalizations', 'vl']]}
            if clean == '/v1/appInfos/info/appInfoLocalizations':
                return {'data': [records['appInfoLocalizations', 'il']]}
            if clean == '/v1/builds':
                return {'data': [records['builds', 'build']]}
            if clean == '/v1/builds/build/preReleaseVersion':
                return {'data': resource('preReleaseVersions', 'pr', {'platform': 'IOS'})}
            if clean == '/v1/builds/build/betaBuildLocalizations':
                return {'data': [records['betaBuildLocalizations', 'bl']]}
            _, _, kind, rid = clean.split('/')
            return {'data': records[kind, rid]}
        m.run(fake, '12')
        self.assertEqual(records['appStoreVersionLocalizations', 'vl']['attributes']['description'], 'Existing owner text')
        self.assertEqual(records['betaBuildLocalizations', 'bl']['attributes']['whatsNew'], m.BETA['whatsNew'])
        writes = [call for call in calls if call[0] != 'GET']
        self.assertEqual(len(writes), 3)
        calls.clear()
        m.run(fake, '12')
        self.assertFalse([call for call in calls if call[0] != 'GET'])


if __name__ == '__main__':
    unittest.main()
