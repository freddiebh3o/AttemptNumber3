// api-server/src/services/uploadService.ts
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { supabaseAdmin, SUPABASE_STORAGE_BUCKET } from '../integrations/supabaseClient.js';
import { Errors } from '../utils/httpErrors.js';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

export type UploadKind = 'logo' | 'product' | 'user' | 'misc';

function pickExt(contentType: string, originalName?: string) {
  if (EXT_BY_TYPE[contentType]) return EXT_BY_TYPE[contentType];
  // fallback to original file extension if any
  const ext = originalName ? extname(originalName) : '';
  return ext || '';
}

function makeObjectPath(tenantId: string, kind: UploadKind, filename: string) {
  // folder structure: <tenantId>/<kind>/<yyyy>/<mm>/<random>.<ext>
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${tenantId}/${kind}/${yyyy}/${mm}/${filename}`;
}

export async function uploadImageToStorageService(params: {
  tenantId: string;
  kind: UploadKind;
  bytes: Buffer;
  contentType: string;
  originalName?: string;
  upsert?: boolean; // default false
}) {
  const { tenantId, kind, bytes, contentType, originalName, upsert = false } = params;

  if (!ALLOWED_TYPES.has(contentType)) {
    throw Errors.validation('Unsupported file type', `Got ${contentType}`);
  }
  if (!bytes || bytes.length === 0) {
    throw Errors.validation('No file uploaded');
  }

  const ext = pickExt(contentType, originalName);
  const filename = `${randomUUID().slice(0, 8)}${ext}`;
  const path = makeObjectPath(tenantId, kind, filename);

  const { error } = await supabaseAdmin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert,
      cacheControl: '31536000', // 1y; adjust per your needs
    });

  if (error) {
    // Supabase returns descriptive errors; bubble via our envelope
    throw Errors.internal(error.message);
  }

  // Build a public URL (bucket must be public for this to be accessible)
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(path);

  const publicUrl = publicUrlData.publicUrl;

  return {
    path,
    url: publicUrl,
    contentType,
    bytes: bytes.length,
  };
}
