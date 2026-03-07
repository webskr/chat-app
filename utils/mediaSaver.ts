/**
 * mediaSaver.ts
 *
 * Downloads a remote media URL and saves it to the user's gallery.
 *
 * Save locations:
 *  • Images/Videos → MediaLibrary → "Vegarm" album  (Pictures/Vegarm/)
 *  • Documents      → Expo Sharing sheet (system file picker / Files app)
 *
 * Android/media/com.skr.vegarm is the app's EXTERNAL FILES dir, not the
 * public gallery.  It is created automatically by initMediaFolder on first
 * login via MediaLibrary. The gallery album (Pictures/Vegarm) is the correct
 * public location for user-saved media.
 */

import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { Config } from '../constants/Config';

const ALBUM_NAME = 'Vegarm';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Turn any relative or absolute URL into a fully-qualified http URL. */
function resolveUrl(url: string): string {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
        return url;
    }
    // Strip leading slash to avoid double-slash
    return `${Config.API_URL}/${url.replace(/^\/+/, '')}`;
}

/** Show a share sheet as fallback when gallery save fails. */
async function shareAsFallback(uri: string, reason: string): Promise<void> {
    Alert.alert(
        'Save Issue',
        reason,
        [{ text: 'Share / Save to Files', onPress: () => Sharing.shareAsync(uri) }]
    );
}

// ─── main export ──────────────────────────────────────────────────────────────

export const saveMedia = async (
    url: string,
    type: string,
    fileName?: string
): Promise<boolean> => {

    const fullUrl = resolveUrl(url);

    // Derive a sensible filename
    const ext = fullUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'bin';
    const name = fileName || `vegarm_${Date.now()}.${ext}`;
    const localUri = `${FileSystem.cacheDirectory}${name}`;

    // ── Step 1: Download to local cache ───────────────────────────────────────
    let downloadedUri: string = localUri;
    try {
        console.log(`[saveMedia] Downloading: ${fullUrl}`);

        const result = await FileSystem.downloadAsync(fullUrl, localUri);

        console.log(`[saveMedia] Download status: ${result.status}, uri: ${result.uri}`);

        // Some servers return redirects (301/302) that Expo follows automatically.
        // Treat anything outside 200-299 as a failure.
        if (result.status < 200 || result.status >= 300) {
            throw new Error(`Server returned HTTP ${result.status} for ${fullUrl}`);
        }

        downloadedUri = result.uri;
    } catch (downloadError: any) {
        console.error('[saveMedia] Download failed:', downloadError?.message || downloadError);

        // If we already have a local file from a previous download (cached), use it
        const info = await FileSystem.getInfoAsync(localUri).catch(() => ({ exists: false } as any));
        if (info.exists) {
            console.log('[saveMedia] Using previously cached file as fallback.');
            downloadedUri = localUri;
        } else {
            Alert.alert(
                'Download Failed',
                `Could not download the file.\n\nURL tried: ${fullUrl}\n\nMake sure the server is reachable.`
            );
            return false;
        }
    }

    // ── Step 2: Documents → share sheet ───────────────────────────────────────
    if (type === 'document') {
        try {
            await Sharing.shareAsync(downloadedUri);
            return true;
        } catch (e) {
            Alert.alert('Error', 'Could not open the share sheet.');
            return false;
        }
    }

    // ── Step 3: Media (image / video / audio) → MediaLibrary ──────────────────

    // Request write-only permission on Android (avoids READ_EXTERNAL_STORAGE denial on API 33+)
    let granted = false;
    try {
        const writeOnly = Platform.OS === 'android';
        const { status } = await MediaLibrary.requestPermissionsAsync(writeOnly);
        granted = status === 'granted';
    } catch (permErr) {
        console.warn('[saveMedia] Permission request threw:', permErr);
    }

    if (!granted) {
        await shareAsFallback(
            downloadedUri,
            'Gallery permission denied. Use the share option to save manually.'
        );
        return false;
    }

    try {
        // createAssetAsync MUST come before getAlbumAsync / createAlbumAsync
        const asset = await MediaLibrary.createAssetAsync(downloadedUri);

        let album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
        if (!album) {
            // First time — createAlbumAsync creates the Pictures/Vegarm directory
            // Use copyAssets: true to avoid "Modify this file?" prompt on Android
            await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, true);
        } else {
            // Use copyAssets: true to avoid "Modify this file?" prompt on Android
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
        }

        Alert.alert('✅ Saved', `Media saved to "${ALBUM_NAME}" album in your gallery.`);
        return true;

    } catch (saveErr: any) {
        console.error('[saveMedia] MediaLibrary save failed:', saveErr?.message || saveErr);
        await shareAsFallback(
            downloadedUri,
            'Could not save to gallery. Use the share option instead.'
        );
        return false;
    }
};
