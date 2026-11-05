import { FINANCE_STORE_FOLDERS } from 'src/common/file/enums/files.enum';
import {
    isFinanceObjectPath,
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

describe('finance paths are never public URLs (accounting plan 5.3 point 5)', () => {
    const SUPABASE = 'https://proj.supabase.co';
    const BUCKET = 'eastpark-uploads';
    const ok = (url: unknown) => isStoragePublicUrl(url, SUPABASE, BUCKET);
    const pub = `${SUPABASE}/storage/v1/object/public`;

    it.each([
        ['a raw staging path', 'staging/usr_1/1730550000000-a.jpg'],
        ['a raw receipt path', 'receipts/2026/R-2026-000123/1-a.jpg'],
        [
            'the private bucket, public form',
            `${pub}/eastpark-finance/receipts/2026/R-2026-000001/a.jpg`,
        ],
        [
            'a signed private URL',
            `${SUPABASE}/storage/v1/object/sign/eastpark-finance/receipts/2026/R-2026-000001/a.jpg?token=x`,
        ],
        [
            'a finance folder copied into the public bucket',
            `${pub}/${BUCKET}/receipts/2026/a.jpg`,
        ],
        [
            'staging/ in the public bucket',
            `${pub}/${BUCKET}/staging/usr_1/a.jpg`,
        ],
        ['an encoded finance folder', `${pub}/${BUCKET}/%72eceipts/2026/a.jpg`],
        ['an upper-case finance folder', `${pub}/${BUCKET}/EXPENSES/a.pdf`],
        ['revenues/', `${pub}/${BUCKET}/revenues/a.pdf`],
    ])('rejects %s', (_label, url) => {
        expect(ok(url)).toBe(false);
    });

    it('still accepts the normal public folders', () => {
        expect(ok(`${pub}/${BUCKET}/user-avatars/u1/a.jpg`)).toBe(true);
        expect(ok(`${pub}/${BUCKET}/feedback-attachments/u1/a.jpg`)).toBe(true);
    });

    it('isFinanceObjectPath knows every finance folder', () => {
        for (const folder of FINANCE_STORE_FOLDERS)
            expect(isFinanceObjectPath(`${folder}/x/y.jpg`)).toBe(true);
        expect(isFinanceObjectPath('user-avatars/x/y.jpg')).toBe(false);
        expect(isFinanceObjectPath('%E0%A4%A/x.jpg')).toBe(true); // undecodable: refuse
    });
});
