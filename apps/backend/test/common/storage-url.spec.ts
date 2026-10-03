import {
    isStoragePublicUrl,
    storagePublicPrefix,
} from 'src/common/file/storage-url';

describe('isStoragePublicUrl', () => {
    const SUPABASE = 'https://proj.supabase.co';
    const BUCKET = 'eastpark-uploads';
    const PREFIX = `${SUPABASE}/storage/v1/object/public/${BUCKET}`;
    const ok = (url: unknown) => isStoragePublicUrl(url, SUPABASE, BUCKET);

    it('builds the same prefix as supabase-js getPublicUrl', () => {
        expect(storagePublicPrefix(SUPABASE, BUCKET).href).toBe(`${PREFIX}/`);
        expect(storagePublicPrefix(`${SUPABASE}/`, BUCKET).href).toBe(
            `${PREFIX}/`
        );
    });

    it('accepts an object in the bucket', () => {
        expect(ok(`${PREFIX}/user-avatars/u1/1-x.jpg`)).toBe(true);
    });

    it.each([
        [
            'other host',
            'https://evil.example/storage/v1/object/public/eastpark-uploads/a.jpg',
        ],
        [
            'look-alike host',
            'https://proj.supabase.co.evil.example/storage/v1/object/public/eastpark-uploads/a.jpg',
        ],
        ['plain http', `${PREFIX.replace('https:', 'http:')}/a.jpg`],
        [
            'other port',
            'https://proj.supabase.co:8443/storage/v1/object/public/eastpark-uploads/a.jpg',
        ],
        [
            'credentials',
            'https://user:pw@proj.supabase.co/storage/v1/object/public/eastpark-uploads/a.jpg',
        ],
        [
            'other bucket',
            'https://proj.supabase.co/storage/v1/object/public/other/a.jpg',
        ],
        ['bucket name prefix', `${PREFIX}-x/a.jpg`],
        ['dot-dot escape', `${PREFIX}/../other/a.jpg`],
        ['encoded dot-dot escape', `${PREFIX}/%2e%2e/other/a.jpg`],
        ['backslash', `${PREFIX}\\..\\x.jpg`],
        ['bucket root only', `${PREFIX}/`],
        [
            'signed (non-public) path',
            'https://proj.supabase.co/storage/v1/object/sign/eastpark-uploads/a.jpg',
        ],
        ['javascript scheme', 'javascript:alert(1)'],
        ['not a URL', 'not a url'],
    ])('rejects %s', (_label, url) => {
        expect(ok(url)).toBe(false);
    });

    it('rejects non-strings', () => {
        expect(ok(null)).toBe(false);
        expect(ok(42)).toBe(false);
    });

    it('follows the configured origin, e.g. local MinIO over http', () => {
        expect(
            isStoragePublicUrl(
                'http://localhost:9002/storage/v1/object/public/eastpark-uploads/a.png',
                'http://localhost:9002',
                BUCKET
            )
        ).toBe(true);
    });
});
