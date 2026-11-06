// Shared handling for uploaded documents: validate, downscale, build a Claude content block.
// Files are processed in memory and discarded; nothing is written to disk or the database.
import type Anthropic from '@anthropic-ai/sdk';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export type UploadError = { code: 'no_file' | 'too_large' | 'heic' | 'unsupported'; message: { en: string; es: string } };

const ERR: Record<UploadError['code'], UploadError['message']> = {
  no_file: { en: 'Choose a file to upload.', es: 'Elija un archivo para subir.' },
  too_large: { en: 'That file is over 20 MB. Try a photo or a smaller PDF.', es: 'Ese archivo pesa más de 20 MB. Pruebe con una foto o un PDF más pequeño.' },
  heic: { en: "We can't read iPhone HEIC photos yet. Take a screenshot of the photo and upload that instead.", es: 'Aún no podemos leer fotos HEIC de iPhone. Tome una captura de pantalla de la foto y súbala.' },
  unsupported: { en: "We can only read photos (JPG, PNG) and PDFs. Upload one of those, or type the numbers in.", es: 'Solo podemos leer fotos (JPG, PNG) y PDF. Suba uno de esos, o escriba los números.' },
};
export const uploadError = (code: UploadError['code']): UploadError => ({ code, message: ERR[code] });

export async function fileToContent(file: File | null): Promise<{ block: Anthropic.Messages.ContentBlockParam } | { error: UploadError }> {
  if (!file || file.size === 0) return { error: uploadError('no_file') };
  if (file.size > MAX_UPLOAD_BYTES) return { error: uploadError('too_large') };
  const name = file.name.toLowerCase();
  const type = file.type || '';
  if (type.includes('heic') || type.includes('heif') || /\.(heic|heif)$/.test(name)) return { error: uploadError('heic') };
  const buf = Buffer.from(await file.arrayBuffer());
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    if (buf.subarray(0, 4).toString() !== '%PDF') return { error: uploadError('unsupported') };
    return { block: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } } };
  }
  if (IMAGE_TYPES.includes(type) || /\.(jpe?g|png|webp|gif)$/.test(name)) {
    // Downscale big phone photos: Claude reads ~1568px fine and the API caps images at 5 MB.
    let out = buf;
    let media: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = (IMAGE_TYPES.includes(type) ? type : 'image/jpeg') as 'image/jpeg';
    try {
      const sharp = (await import('sharp')).default;
      const img = sharp(buf, { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      if (!meta.width) return { error: uploadError('unsupported') };
      if (buf.length > 3.5 * 1024 * 1024 || (meta.width ?? 0) > 2000 || (meta.height ?? 0) > 2000) {
        out = await img.resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        media = 'image/jpeg';
      }
    } catch {
      return { error: uploadError('unsupported') };
    }
    return { block: { type: 'image', source: { type: 'base64', media_type: media, data: out.toString('base64') } } };
  }
  return { error: uploadError('unsupported') };
}

export const monthlyFromPay = (perPeriod: number, freq: string | null): number => {
  switch (freq) {
    case 'weekly':
      return (perPeriod * 52) / 12;
    case 'biweekly':
      return (perPeriod * 26) / 12;
    case 'semimonthly':
      return perPeriod * 2;
    case 'monthly':
      return perPeriod;
    default:
      return (perPeriod * 26) / 12; // most common for hourly work
  }
};
