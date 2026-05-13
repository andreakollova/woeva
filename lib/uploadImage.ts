import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// Max dimensions and quality for uploaded images
const MAX_SIZE = 1200;
const COMPRESS_QUALITY = 0.82;

/**
 * Uploads a local image URI to Supabase Storage.
 * Compresses and resizes to max 1200px before upload (handles HEIC from iPhone).
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
      const dest = `${FileSystem.cacheDirectory}img_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      uri = dest;
    }

    // Compress + resize + convert to JPEG (handles HEIC automatically)
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_SIZE } }],
      { compress: COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    uri = compressed.uri;

    const ext = 'jpg';
    const mime = 'image/jpeg';

    // Get auth token for the upload request
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token
      ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
      ?? '';

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName.replace(/\.[^.]+$/, '.jpg')}`;

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
