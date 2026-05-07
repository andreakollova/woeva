import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/**
 * Uploads a local image URI to Supabase Storage.
 * Handles ph:// URIs (iOS simulator/Photos Library) by copying to cache first.
 * Uses FileSystem.uploadAsync (native, most reliable in Expo).
 * Returns the public URL or null on failure.
 */
export async function uploadImage(
  localUri: string,
  bucket: string,
  fileName: string
): Promise<string | null> {
  try {
    let uri = localUri;

    // ph:// URIs (iOS Photos Library / simulator) must be copied to a file:// path first
    if (uri.startsWith('ph://')) {
      const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      const dest = `${FileSystem.cacheDirectory}img_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      uri = dest;
    }

    const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

    // Get auth token for the upload request
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token
      ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
      ?? '';

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`;

    const result = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mime,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-upsert': 'true',
      },
    });

    if (result.status < 200 || result.status >= 300) {
      console.warn('Upload failed:', result.status, result.body);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e) {
    console.warn('uploadImage error:', e);
    return null;
  }
}
