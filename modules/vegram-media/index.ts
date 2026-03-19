import { requireNativeModule } from 'expo-modules-core';

let VegramMedia: any = null;

function getModule() {
    if (!VegramMedia) {
        try {
            VegramMedia = requireNativeModule('VegramMedia');
        } catch (e) {
            console.warn('[VegramMedia] Native module not available. Run a native build (npx expo run:android).');
        }
    }
    return VegramMedia;
}

/**
 * Returns the public Android/media/com.skr.vegram/Vegram/ directory path.
 * Returns empty string in Expo Go where the native module is unavailable.
 */
export function getPublicMediaDirectory(): string {
    const mod = getModule();
    if (!mod || typeof mod.getPublicMediaDirectory !== 'function') return '';
    return mod.getPublicMediaDirectory();
}

/**
 * Downloads a file natively using Java HTTP + FileOutputStream directly into
 * Android/media/com.skr.vegram/Vegram/<subfolder>/<filename>.
 * This bypasses Expo FileSystem which lacks WRITE access to Android public media dirs.
 *
 * @param url       Full HTTP/HTTPS URL to download.
 * @param filename  Target filename, e.g. "msg_535.jpg".
 * @param subfolder Subfolder name, e.g. "images", "videos", "documents".
 * @returns A promise resolving to the saved `file://` URI, or empty string on failure.
 */
export async function downloadMedia(url: string, filename: string, subfolder: string): Promise<string> {
    const mod = getModule();
    if (!mod || typeof mod.downloadMedia !== 'function') return '';
    return mod.downloadMedia(url, filename, subfolder);
}

/**
 * Writes base64 data natively directly into
 * Android/media/com.skr.vegram/Vegram/<subfolder>/<filename>.
 * This bypasses Expo FileSystem which lacks WRITE access to Android public media dirs.
 *
 * @param base64Data Full base64 string to write.
 * @param filename   Target filename, e.g. "backup.zip".
 * @param subfolder  Subfolder name, e.g. "backups".
 * @returns A promise resolving to the saved `file://` URI, or empty string on failure.
 */
export async function writeMedia(base64Data: string, filename: string, subfolder: string): Promise<string> {
    const mod = getModule();
    if (!mod || typeof mod.writeMedia !== 'function') return '';
    return mod.writeMedia(base64Data, filename, subfolder);
}

/**
 * Copies a file natively from one URI to another within theVegram folder.
 * This bypasses Expo FileSystem which lacks WRITE access to Android public media dirs.
 *
 * @param sourceUri  The source file:// URI or local path.
 * @param filename   Target filename, e.g. "msg_535.jpg".
 * @param subfolder  Subfolder name, e.g. "images", "videos".
 * @returns A promise resolving to the saved `file://` URI, or empty string on failure.
 */
export async function copyMedia(sourceUri: string, filename: string, subfolder: string): Promise<string> {
    const mod = getModule();
    if (!mod || typeof mod.copyMedia !== 'function') return '';
    return mod.copyMedia(sourceUri, filename, subfolder);
}
