import { requireNativeModule } from 'expo-modules-core';

let VegarmMedia: any = null;

function getModule() {
    if (!VegarmMedia) {
        try {
            VegarmMedia = requireNativeModule('VegarmMedia');
        } catch (e) {
            console.warn('[VegarmMedia] Native module not available. Run a native build (npx expo run:android).');
        }
    }
    return VegarmMedia;
}

/**
 * Returns the public Android/media/com.skr.vegarm/Vegarm/ directory path.
 * Returns empty string in Expo Go where the native module is unavailable.
 */
export function getPublicMediaDirectory(): string {
    return getModule()?.getPublicMediaDirectory() ?? '';
}

/**
 * Downloads a file natively using Java HTTP + FileOutputStream directly into
 * Android/media/com.skr.vegarm/Vegarm/<subfolder>/<filename>.
 * This bypasses Expo FileSystem which lacks WRITE access to Android public media dirs.
 *
 * @param url       Full HTTP/HTTPS URL to download.
 * @param filename  Target filename, e.g. "msg_535.jpg".
 * @param subfolder Subfolder name, e.g. "images", "videos", "documents".
 * @returns A promise resolving to the saved `file://` URI, or empty string on failure.
 */
export async function downloadMedia(url: string, filename: string, subfolder: string): Promise<string> {
    const mod = getModule();
    if (!mod) return '';
    return mod.downloadMedia(url, filename, subfolder);
}

/**
 * Writes base64 data natively directly into
 * Android/media/com.skr.vegarm/Vegarm/<subfolder>/<filename>.
 * This bypasses Expo FileSystem which lacks WRITE access to Android public media dirs.
 *
 * @param base64Data Full base64 string to write.
 * @param filename   Target filename, e.g. "backup.zip".
 * @param subfolder  Subfolder name, e.g. "backups".
 * @returns A promise resolving to the saved `file://` URI, or empty string on failure.
 */
export async function writeMedia(base64Data: string, filename: string, subfolder: string): Promise<string> {
    const mod = getModule();
    if (!mod) return '';
    return mod.writeMedia(base64Data, filename, subfolder);
}
