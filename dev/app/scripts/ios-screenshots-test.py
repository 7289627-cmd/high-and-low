import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout
from io import StringIO

spec = importlib.util.spec_from_file_location('shots', Path(__file__).with_name('ios-screenshots.py'))
shots = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shots)


class ScreenshotsTest(unittest.TestCase):
    def test_only_approved_locales_and_french_reuse(self):
        self.assertEqual(len(shots.LOCALES), 11)
        self.assertNotIn('en-US', shots.LOCALES)
        self.assertEqual(shots.LOCALES['fr-CA'], shots.LOCALES['fr-FR'])

    def test_parts_use_offsets_and_reject_gaps_before_transfer(self):
        def part(offset, length):
            return dict(offset=offset, length=length, method='PUT',
                        url='https://store-001.blobstore.apple.com/upload', requestHeaders=[])
        self.assertEqual([chunk for _, chunk in shots.parts([part(4, 2), part(0, 4)], b'abcdef')],
                         [b'abcd', b'ef'])
        for operations in ([part(0, 4)], [part(0, 4), part(3, 3)], [part(0, 4), part(5, 1)]):
            with self.assertRaises(shots.SafetyError):
                shots.parts(operations, b'abcdef')
        alternate = part(0, 6) | {'url': 'https://storage.example.test/signed', 'method': 'put'}
        self.assertEqual(shots.parts([alternate], b'abcdef'), [(alternate, b'abcdef')])
        bad = part(0, 6) | {'url': 'https://user:pass@storage.example.test/signed'}
        with self.assertRaises(shots.SafetyError):
            shots.parts([bad], b'abcdef')

    def test_existing_placement_ids_verified_and_unrelated_rejected(self):
        group = 'iphone-large'
        def placement(pid, image, state='PARENT_PREPARE_FOR_SUBMISSION'):
            return {'id': pid, 'type': shots.PLACEMENTS,
                    'attributes': {'placementGroup': group, 'placementType': shots.SCREENSHOT, 'state': state},
                    'relationships': {'image': shots.link(shots.IMAGES, image)}}
        rows = [placement('p2', 'i2'), placement('p1', 'i1')]
        self.assertEqual(shots.placement_ids(rows, group, {'i1', 'i2'}, ready=True), {'i2': 'p2', 'i1': 'p1'})
        with self.assertRaises(shots.SafetyError):
            shots.placement_ids(rows, group, {'i1'})
        with self.assertRaises(shots.SafetyError):
            shots.placement_ids(rows + [placement('p3', 'i2')], group, {'i1', 'i2'})
        with self.assertRaises(shots.SafetyError):
            shots.placement_ids([placement('p1', 'i1', 'ASSET_PROCESSING')], group, {'i1'}, ready=True)


    def test_two_french_locales_reuse_assets_and_rerun_verifies_without_writes(self):
        group, library, version = 'iphone-large', 'library-id', 'version-id'
        locales = {locale: 'id-' + locale for locale in ('en-US', 'fr-CA', 'fr-FR')}
        assets = {'fr': [(name, bytes([i])) for i, name in enumerate(shots.NAMES, start=1)]}
        pictures, placements, writes, transfers = {}, {key: [] for key in locales.values()}, [], []
        placements['id-en-US'] = [{'id': 'old-primary-screenshot'}]
        def row(kind, identifier, **attrs):
            return {'id': identifier, 'type': kind, 'attributes': attrs}
        def api(method, path, request=None):
            key = path.split('?')[0]
            if method == 'GET':
                if key.endswith('/assetLibrary'):
                    data = row('appAssetLibraries', library)
                elif key.endswith('/images'):
                    data = list(pictures.values())
                elif key.endswith('/placements'):
                    self.assertIn('sort=placementGroupPosition', path)
                    self.assertNotIn('/id-en-US/', path)
                    data = list(placements[key.split('/')[-2]])
                elif key.endswith('/' + shots.LOCALIZATIONS):
                    data = [row(shots.LOCALIZATIONS, identifier, locale=locale)
                            for locale, identifier in locales.items()]
                elif ('/' + shots.LOCALIZATIONS + '/') in key:
                    identifier = key.split('/')[-1]
                    data = row(shots.LOCALIZATIONS, identifier, locale=identifier[3:])
                elif key.endswith('/' + version):
                    data = row('appStoreVersions', version, appVersionState='PREPARE_FOR_SUBMISSION')
                else:
                    data = pictures[key.split('/')[-1]]
                return {'data': data}
            writes.append((method, path))
            body = request['data']
            if method == 'PATCH':
                a = pictures[body['id']]['attributes']
                self.assertEqual(body['attributes'], {'uploaded': True})
                a.update(state='PREPARE_FOR_SUBMISSION', imageAsset={'width': 1320, 'height': 2868})
                return {}
            kind = body['type']
            a = body['attributes']
            rels = body['relationships']
            if kind == shots.IMAGES:
                identifier = 'image-' + str(len(pictures))
                result = row(kind, identifier, **a, state='AWAITING_UPLOAD', uploadOperations=[
                    {'offset': 0, 'length': 1, 'method': 'PUT',
                     'url': 'https://store-001.blobstore.apple.com/upload', 'requestHeaders': []}])
                pictures[identifier] = result
            else:
                locale = rels['appStoreVersionLocalization']['data']['id']
                self.assertNotEqual(locale, 'id-en-US')
                if kind == shots.PLACEMENTS:
                    result = row(kind, 'placement-' + str(len(writes)), **a, state='ACTIVE')
                    result['relationships'] = {'image': rels['image']}
                    placements[locale].insert(0, result)
                else:
                    by_id = {r['id']: r for r in placements[locale]}
                    placements[locale] = [by_id[x['id']] for x in rels['orderedPlacements']['data']]
                    result = row(kind, 'request-' + str(len(writes)))
            return {'data': result}

        with (patch.object(shots, 'LOCALES', {'fr-CA': 'fr', 'fr-FR': 'fr'}),
              patch.object(shots.metadata, 'editable_drafts', return_value=({}, {'id': version})),
              patch.object(shots, 'reference', return_value=group),
              redirect_stdout(StringIO()) as report):
            put = lambda _, data: transfers.append(data)
            shots.run(api, put, assets)
            counts = len(writes), len(transfers)
            shots.run(api, put, assets)
            self.assertEqual((len(writes), len(transfers)), counts)
            self.assertIn('fr-CA: 3 processed iPhone screenshots verified in order', report.getvalue())
            self.assertIn('fr-FR: 3 processed iPhone screenshots verified in order', report.getvalue())
        self.assertEqual(len(pictures), 3)
        self.assertEqual(counts, (14, 3))
        self.assertEqual(placements['id-en-US'], [{'id': 'old-primary-screenshot'}])

if __name__ == '__main__':
    unittest.main()
