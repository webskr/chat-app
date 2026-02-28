/**
 * initMediaFolder.ts
 *
 * Proactively creates the "Vegarm" album in the user's gallery on first login.
 * This also triggers Android to register the app in the MediaStore, which
 * indirectly causes Android to create/register Android/media/com.skr.vegarm
 * in the system's media directories list.
 *
 * NOTE: Android/media/com.skr.vegarm is the app's EXTERNAL FILES directory
 * managed by the Android OS — it is created when the OS registers the app's
 * external media access for the first time. expo-media-library triggers this.
 *
 * Safe to call multiple times — guarded by AsyncStorage.
 * Bump INIT_KEY version if you need to force a re-run.
 */

import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Bump this version string to force the init to re-run on all devices
const INIT_KEY = 'media_folder_initialized_v3';
const ALBUM_NAME = 'Vegarm';

// Minimal 1×1 transparent PNG (base64)
const TRANSPARENT_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export async function initMediaFolder(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
        const alreadyDone = await AsyncStorage.getItem(INIT_KEY);
        if (alreadyDone === 'true') return;

        // Request permissions — need WRITE_EXTERNAL_STORAGE on older, 
        // but MediaLibrary.requestPermissionsAsync handles Scoped Storage on 33+
        const { status } = await MediaLibrary.requestPermissionsAsync(true);
        if (status !== 'granted') {
            console.log('[initMediaFolder] Permission not granted — will retry on next launch.');
            return;
        }

        // Write the 1×1 placeholder PNG to the cache directory
        const placeholderPath = `${FileSystem.cacheDirectory}vegarm_placeholder_init.png`;
        await FileSystem.writeAsStringAsync(placeholderPath, TRANSPARENT_PNG_B64, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Verify the file was written
        const info = await FileSystem.getInfoAsync(placeholderPath);
        if (!info.exists) {
            console.warn('[initMediaFolder] Placeholder file not created, aborting.');
            return;
        }

        // createAssetAsync — this is the call that:
        //   1. Registers the app with Android's MediaStore
        //   2. Creates/registers Android/media/com.skr.vegarm (EXTERNAL FILES DIR)
        //   3. Adds the file to the shared media store (visible in gallery)
        const asset = await MediaLibrary.createAssetAsync(placeholderPath);
        console.log('[initMediaFolder] Asset created, id:', asset.id);

        // Create the Vegarm album (or add to existing)
        let album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
        if (!album) {
            await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
            console.log('[initMediaFolder] ✅ Created "Vegarm" album.');
        } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            console.log('[initMediaFolder] ✅ Added placeholder to existing "Vegarm" album.');
        }

        // Trigger a simple FileSystem check to force OS to create the media folder
        // This is often needed on Android 11+ to ensure the directory is physically present
        if (FileSystem.documentDirectory) {
            const mediaDir = `${FileSystem.documentDirectory.replace('files/', 'media/')}com.skr.vegarm/`;
            await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true }).catch(() => { });
        }

        // Mark done — use the bumped key so old devices re-run with the new logic
        await AsyncStorage.setItem(INIT_KEY, 'true');
        console.log('[initMediaFolder] ✅ Android media directory registered successfully.');

    } catch (error: any) {
        console.warn('[initMediaFolder] Setup failed (non-fatal):', error?.message || error);
    }
}

/**
 * Call this to reset the init guard (e.g., after a fresh install or for debugging).
 */
export async function resetMediaFolderInit(): Promise<void> {
    await AsyncStorage.removeItem(INIT_KEY);
    console.log('[initMediaFolder] Guard reset. Will re-run on next launch.');
}
