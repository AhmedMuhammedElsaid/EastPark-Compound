/**
 * Magic-byte sniffing for uploads. The client-supplied filename and MIME type
 * are never trusted: the stored content type and extension are derived from
 * the bytes themselves.
 */
export interface DetectedFileType {
    mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
    ext: 'jpg' | 'png' | 'webp' | 'pdf';
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
    if (buffer.length < offset + bytes.length) return false;
    return bytes.every((byte, i) => buffer[offset + i] === byte);
}

function asciiAt(buffer: Buffer, text: string, offset = 0): boolean {
    return startsWith(
        buffer,
        [...text].map(c => c.charCodeAt(0)),
        offset
    );
}

export function detectImageType(buffer: Buffer): DetectedFileType | null {
    if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
        return { mime: 'image/jpeg', ext: 'jpg' };
    }
    if (startsWith(buffer, PNG_SIGNATURE)) {
        return { mime: 'image/png', ext: 'png' };
    }
    if (asciiAt(buffer, 'RIFF', 0) && asciiAt(buffer, 'WEBP', 8)) {
        return { mime: 'image/webp', ext: 'webp' };
    }
    return null;
}

export function detectPdf(buffer: Buffer): DetectedFileType | null {
    return asciiAt(buffer, '%PDF-', 0)
        ? { mime: 'application/pdf', ext: 'pdf' }
        : null;
}
