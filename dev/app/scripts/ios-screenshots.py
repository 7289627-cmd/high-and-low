"""Upload the approved gameplay images to the localized iOS draft."""
import hashlib
import importlib.util
import os
from pathlib import Path
import struct
import sys
import time
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), HERE / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


metadata = load('ios-metadata')
SafetyError = metadata.SafetyError
IMAGES = 'appAssetLibraryImages'
PLACEMENTS = 'appAssetLibraryPlacements'
LOCALIZATIONS = 'appStoreVersionLocalizations'
SCREENSHOT = 'APP_SCREENSHOT'
CATEGORY = 'APP_SCREENSHOTS_AND_PREVIEWS'
DISPLAY = 'IPHONE_DYNAMIC_ISLAND_LARGE_DISPLAY'
SIZE = (1320, 2868)
NAMES = ('01-friends-room', '02-pick-number', '03-active-question')
LOCALES = {'ar-SA': 'ar', 'es-MX': 'es-419', 'fr-CA': 'fr', 'fr-FR': 'fr',
           'hi': 'hi', 'id': 'id', 'ja': 'ja', 'ko': 'ko', 'pt-BR': 'pt-BR',
           'zh-Hans': 'zh-Hans', 'zh-Hant': 'zh-Hant'}
READY = {'PREPARE_FOR_SUBMISSION', 'APPROVED', 'ACCEPTED'}


def link(kind, identifier):
    return {'data': {'type': kind, 'id': identifier}}


def linked_id(row, relationship, kind):
    value = row.get('relationships', {}).get(relationship, {}).get('data', {})
    if not isinstance(value, dict) or value.get('type') != kind:
        raise SafetyError('incorrect relationship type')
    return metadata.unique([value], relationship)['id']


def read_images(root):
    images = {}
    for game in sorted(set(LOCALES.values())):
        images[game] = []
        for name in NAMES:
            path = root / game / (name + '.png')
            data = path.read_bytes()
            if (data[:16] != b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR' or
                    len(data) < 33 or struct.unpack('>IIBB', data[16:26]) != (*SIZE, 8, 2)):
                raise SafetyError('expected RGB 1320x2868 PNG for ' + game + '/' + name)
            key = 'hl-' + game + '-' + name + '-' + hashlib.sha256(data).hexdigest()[:16]
            images[game].append((key, data))
    return images


def parts(operations, data):
    result = []
    offset = 0
    for part in sorted(operations, key=lambda value: value['offset']):
        url = urllib.parse.urlsplit(part['url'])
        end = offset + part['length']
        if (part['offset'] != offset or not offset < end <= len(data) or part['method'] != 'PUT'
                or url.scheme != 'https' or not url.hostname
                or not url.hostname.endswith('.blobstore.apple.com') or url.netloc != url.hostname
                or url.fragment):
            raise SafetyError('unexpected upload operation')
        result.append((part, data[offset:end]))
        offset = end
    if offset != len(data):
        raise SafetyError('incomplete upload operation coverage')
    return result


def transfer(opener, operation, data):
    request = urllib.request.Request(operation['url'], method='PUT', data=data,
        headers={row['name']: row['value'] for row in operation['requestHeaders']})
    for attempt in range(3):
        try:
            with opener.open(request, timeout=60):
                return
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise SafetyError('Apple image transfer failed') from None
            time.sleep(2 ** attempt)


def route(api, path):
    payload = api('GET', path)
    row = metadata.unique([payload.get('data')], 'related resource')
    return row


def create(api, kind, attributes, relationships):
    response = api('POST', '/v1/' + kind, {'data': {
        'type': kind, 'attributes': attributes, 'relationships': relationships}})
    row = metadata.unique([response.get('data')], kind)
    if row.get('type') != kind:
        raise SafetyError('unexpected resource type')
    return row


def query(path, **filters):
    return path + '?' + urllib.parse.urlencode({f'filter[{key}]': value for key, value in filters.items()})


def reference(api, max_size):
    catalog = metadata.pages(api, query('/v1/appAssetLibraryRefData', features='APP_STORE_VERSIONS',
                                       placementTypes=SCREENSHOT))
    groups = set()
    for row in catalog:
        a = metadata.attr(row)
        profiles = {profile['placementProfileGroupId'] for profile in a['placementProfileGroups']
                    if profile['displayClassId'] == DISPLAY and profile['platform'] == 'IOS'}
        eligible = {g for f in a['features'] if f['featureId'] == 'APP_STORE_VERSIONS'
                    for p in f['placementPolicies'] if p['placementType'] == SCREENSHOT
                    for limit in p['groupLimits'] if limit['maxCount'] >= len(NAMES)
                    for g in limit['groupIds']}
        sizes = a['imageSpecs']
        specs = {s['specId'] for s in sizes if s['dimensions'] == {
            'minWidth': SIZE[0], 'maxWidth': SIZE[0], 'minHeight': SIZE[1], 'maxHeight': SIZE[1]}
            and 'image/png' in s['mimeTypes'] and max_size <= s['maxFileSize']}
        for placement in a['placementTypes']:
            if placement['placementTypeId'] == SCREENSHOT and CATEGORY in placement['acceptsAssetCategories']:
                groups.update(m['placementGroupId'] for m in placement['specMappings']
                              if m['placementGroupId'] in profiles & eligible and specs.intersection(m['specs']))
    if len(groups) != 1:
        raise SafetyError('Apple did not report a unique large-display group accepting the approved PNGs')
    return groups.pop()


def images_in_library(api, library_id):
    return metadata.pages(api, query(f'/v1/appAssetLibraries/{library_id}/images', category=CATEGORY))


def placement_ids(rows, group, image_ids, ready=False):
    result = {}
    for row in rows:
        a = metadata.attr(row)
        image = linked_id(row, 'image', IMAGES)
        if (row.get('type') != PLACEMENTS or a.get('placementGroup') != group
                or a.get('placementType') != SCREENSHOT or image not in image_ids or image in result
                or a.get('state') == 'FAILED'
                or (ready and a.get('state') != 'PARENT_PREPARE_FOR_SUBMISSION')):
            raise SafetyError('unexpected existing placement or delivery state')
        result[image] = metadata.unique([row], PLACEMENTS)['id']
    return result


def placed(api, loc_id, group):
    return metadata.pages(api, query(f'/v1/{LOCALIZATIONS}/{loc_id}/placements',
                                    placementType=SCREENSHOT, placementGroup=group) + '&sort=placementGroupPosition&include=image')


def upload(api, put, library_id, key, data, previous):
    filename = key + '.png'
    row = previous or create(api, IMAGES, {'fileName': filename, 'fileSize': len(data),
            'category': CATEGORY, 'referenceName': key}, {'assetLibrary': link('appAssetLibraries', library_id)})
    image_id = row['id']
    a = metadata.attr(row)
    if (a.get('fileName') != filename or a.get('fileSize') != len(data)
            or a.get('category') != CATEGORY or a.get('referenceName') != key):
        raise SafetyError('existing image differs from the approved upload')
    if a['state'] == 'AWAITING_UPLOAD':
        for operation, chunk in parts(a['uploadOperations'], data):
            put(operation, chunk)
        api('PATCH', f'/v1/{IMAGES}/{image_id}',
            {'data': {'type': IMAGES, 'id': image_id, 'attributes': {'uploaded': True}}})
    elif a['state'] not in READY | {'UPLOAD_COMPLETE', 'COMPLETE'}:
        raise SafetyError('Apple image is in an unexpected state for ' + key)
    return image_id


def wait_ready(api, image_ids):
    pending = set(image_ids)
    deadline = time.monotonic() + 100
    while pending:
        for image_id in sorted(pending):
            a = metadata.attr(metadata.get_resource(api, IMAGES, image_id))
            if a['state'] in READY:
                dimensions = a.get('imageAsset') or {}
                if (dimensions.get('width'), dimensions.get('height')) != SIZE:
                    raise SafetyError('Apple reported incorrect delivered image dimensions')
                pending.remove(image_id)
            elif a['state'] not in {'UPLOAD_COMPLETE', 'COMPLETE'}:
                raise SafetyError('Apple reported image processing failure')
        if pending:
            if time.monotonic() > deadline:
                raise SafetyError('Apple is still processing images; rerun this upload after processing')
            time.sleep(5)


def run(api, put, images):
    _, version = metadata.editable_drafts(api)
    version_id = version['id']
    current = metadata.pages(api, f'/v1/appStoreVersions/{version_id}/{LOCALIZATIONS}?limit=200')
    targets = {}
    for locale in LOCALES:
        loc = metadata.unique([row for row in current if metadata.attr(row).get('locale') == locale], locale)
        if (loc.get('type') != LOCALIZATIONS or
                metadata.attr(metadata.get_resource(api, LOCALIZATIONS, loc['id'])).get('locale') != locale):
            raise SafetyError('Apple localization changed: ' + locale)
        targets[locale] = loc['id']
    if len(set(targets.values())) != len(targets):
        raise SafetyError('Apple localized resource IDs overlap')

    group = reference(api, max(len(data) for assets in images.values() for _, data in assets))
    library = route(api, f'/v1/apps/{metadata.APP}/assetLibrary')
    if library.get('type') != 'appAssetLibraries':
        raise SafetyError('unexpected asset library type')
    library_id = library['id']
    rows = images_in_library(api, library_id)
    existing = {}
    for key, _ in (image for assets in images.values() for image in assets):
        named = [row for row in rows if metadata.attr(row).get('referenceName') == key]
        if named:
            existing[key] = metadata.unique(named, 'approved image ' + key)
            if existing[key].get('type') != IMAGES:
                raise SafetyError('unexpected image resource type')
    for locale, loc_id in targets.items():
        approved = {existing[key]['id'] for key, _ in images[LOCALES[locale]] if key in existing}
        placement_ids(placed(api, loc_id, group), group, approved)
    if metadata.attr(metadata.get_resource(api, 'appStoreVersions', version_id)).get('appVersionState') != 'PREPARE_FOR_SUBMISSION':
        raise SafetyError('draft stopped accepting edits')

    assets_by_game = {
        game: [upload(api, put, library_id, key, data, existing.get(key)) for key, data in assets]
        for game, assets in images.items()
    }
    wait_ready(api, [image_id for assets in assets_by_game.values() for image_id in assets])

    for locale, loc_id in targets.items():
        images_for_locale = assets_by_game[LOCALES[locale]]
        current = placed(api, loc_id, group)
        by_image = placement_ids(current, group, set(images_for_locale))
        for image_id in images_for_locale:
            if image_id not in by_image:
                row = create(api, PLACEMENTS, {'placementType': SCREENSHOT, 'placementGroup': group},
                    {'image': link(IMAGES, image_id), 'appStoreVersionLocalization': link(LOCALIZATIONS, loc_id)})
                by_image[image_id] = row['id']
        desired = [by_image[image_id] for image_id in images_for_locale]
        current = placed(api, loc_id, group)
        if [row['id'] for row in current] != desired:
            create(api, 'appAssetLibraryPlacementOrderingRequests', {'placementGroup': group}, {
                'orderedPlacements': {'data': [{'type': PLACEMENTS, 'id': pid} for pid in desired]},
                'appStoreVersionLocalization': link(LOCALIZATIONS, loc_id)})
        final = placed(api, loc_id, group)
        placement_ids(final, group, set(images_for_locale), ready=True)
        if [row['id'] for row in final] != desired:
            raise SafetyError('localized placement order did not match: ' + locale)
        print(locale + ': 3 processed iPhone screenshots verified in order', flush=True)


def main():
    if len(sys.argv) != 2:
        raise SafetyError('usage: ios-screenshots.py ASSET_DIRECTORY')
    images = read_images(Path(sys.argv[1]))
    api, opener = metadata.connect()
    run(api, lambda operation, data: transfer(opener, operation, data), images)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        message = str(error) if isinstance(error, SafetyError) else 'unexpected image or Apple response'
        print('::error::screenshots: ' + message, file=sys.stderr)
        sys.exit(1)
