import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { Config } from '../constants/Config';
import { getPublicMediaDirectory, downloadMedia as nativeDownloadMedia } from '../modules/vegarm-media';

/**
 * Media Type enum for folder organization
 */
export type MediaType = 'Images' | 'Videos' | 'Documents' | 'Thumbnails' | 'Cache';

let MEDIA_BASE_DIR = `${Paths.document.uri}/vegarm/`;

const FOLDERS: { [key in MediaType]: string } = {
    Images: 'images/',
    Videos: 'videos/',
    Documents: 'documents/',
    Thumbnails: 'thumbnails/',
    Cache: 'cache/'
};

export class MediaStorageService {

    /**
     * Initializes the nested folder structure.
     * Uses public Android/media on Android, and isolated documentDirectory on iOS.
     */
    static async init(): Promise<void> {
        try {
            // Hardened: We intentionally bypass public Android/media directories.
            // Everything securely stays inside the private Document Sandbox.
            const baseDir = new Directory(MEDIA_BASE_DIR);

            if (!baseDir.exists) {
                console.log(`[Storage] Creating secure base media directory: ${MEDIA_BASE_DIR}`);
                baseDir.create({ intermediates: true });
            }

            // Create .nomedia to prevent Android gallery indexing
            if (Platform.OS === 'android') {
                try {
                    const noMedia = new File(`${MEDIA_BASE_DIR}.nomedia`);
                    if (!noMedia.exists) {
                        noMedia.create();
                    }
                } catch (e) {
                    console.error("[Storage] Failed to create .nomedia", e);
                }
            }

            for (const folder of Object.values(FOLDERS)) {
                const folderPath = `${MEDIA_BASE_DIR}${folder}`;
                const dir = new Directory(folderPath);
                if (!dir.exists) {
                    dir.create({ intermediates: true });
                }
            }
            console.log('[Storage] Media folders verified successfully.');
        } catch (error) {
            console.error('[Storage Error] Failed to create media folders:', error);
            throw error;
        }
    }

    /**
     * Returns the absolute directory string for a specific media type.
     */
    static getMediaDirectory(type: MediaType): string {
        return `${MEDIA_BASE_DIR}${FOLDERS[type]}`;
    }

    /**
     * Returns the absolute file path for a given media type and filename.
     */
    static getMediaPath(type: MediaType, filename: string): string {
        return `${this.getMediaDirectory(type)}${filename}`;
    }

    /**
     * Helper to resolve the standard subfolder based on the file extension/type string.
     */
    static resolveMediaType(url: string, explicitType?: string): MediaType {
        if (explicitType === 'image' || explicitType === 'sticker' || explicitType === 'gif') return 'Images';
        if (explicitType === 'video' || explicitType === 'voice') return 'Videos';
        if (explicitType === 'document') return 'Documents';

        const rawUrl = url.split('?')[0].toLowerCase();
        if (/\.(jpg|jpeg|png|webp|gif)$/i.test(rawUrl)) return 'Images';
        if (/\.(mp4|mov|mkv|webm|m4a|mp3|wav|aac)$/i.test(rawUrl)) return 'Videos';
        return 'Documents';
    }

    /**
     * Helper to parse the file extension from a URL safely.
     */
    static extractExtension(url: string): string {
        const rawUrl = url.split('?')[0];
        return rawUrl.split('.').pop()?.split('/')[0]?.toLowerCase()?.slice(0, 5) || 'bin';
    }

    /**
     * Returns true if the file physically exists on the disk.
     */
    static async fileExists(path: string): Promise<boolean> {
        try {
            const file = new File(path);
            return file.exists;
        } catch (e) {
            return false;
        }
    }

    /**
     * Finds and returns the local `file://` URI if the message media is already downloaded.
     * Standardizes the internal naming convention to `msg_{messageId}.{ext}`.
     * 
     * @param messageId Unique message ID from the backend.
     * @param url The relative or absolute remote URL of the original media.
     * @param type Optional metadata type hint.
     * @returns local URI, or null if the cache missed.
     */
    static async getLocalUri(messageId: number | string, url: string, type?: string): Promise<string | null> {
        const mediaType = this.resolveMediaType(url, type);
        const ext = this.extractExtension(url);
        const expectedFilename = `msg_${messageId}.${ext}`;
        const localPath = this.getMediaPath(mediaType, expectedFilename);

        const exists = await this.fileExists(localPath);
        if (exists) {
            console.log(`[Cache Hit] Local load: ${localPath} for Message ${messageId}`);
            return localPath;
        }

        console.log(`[Cache Miss] Server load needed for Message ${messageId}`);
        return null; // Return null so the UI can fallback to Thumbnail or Download prompt
    }

    /**
     * Downloads an HTTP URL directly into the deterministic internal cache folder structure.
     * On Android: uses the native Kotlin module (Java HTTP + FileOutputStream) to bypass
     * Expo FileSystem's WRITE permission check on Android/media paths.
     * On iOS/Web: uses the Expo FileSystem File.downloadFileAsync.
     */
    static async saveMedia(url: string, messageId: number | string, type?: string): Promise<string> {
        const mediaType = this.resolveMediaType(url, type);
        const ext = this.extractExtension(url);

        // Ensure remote URL is fully qualified
        const fullUrl = url.startsWith('http') ? url : `${Config.API_URL}/${url.replace(/^\//, '')}`;

        const expectedFilename = `msg_${messageId}.${ext}`;
        const destinationPath = this.getMediaPath(mediaType, expectedFilename);

        const alreadyExists = await this.fileExists(destinationPath);
        if (alreadyExists) {
            console.log(`[Storage] File already cached natively. Skipping download for ${messageId}`);
            return destinationPath;
        }

        console.log(`[Storage] Downloading ${fullUrl} to ${expectedFilename}`);

        // Hardened: Route all downloads exclusively through the secure Expo FileSystem JS layer.
        try {
            const destFile = new File(destinationPath);
            const downloadResult = await File.downloadFileAsync(fullUrl, destFile);
            console.log(`[Download Success] Expo saved to: ${downloadResult.uri}`);
            return downloadResult.uri;
        } catch (e) {
            console.error('[Storage Error] DownloadAsync fatal error:', e);
            throw e;
        }
    }

    /**
     * Saves a copy of a file (e.g., from ImagePicker) directly into the cache.
     * Used by the sender side immediately after picking and before sending.
     */
    static async copyToCache(localUri: string, messageId: number | string, type?: string): Promise<string> {
        const mediaType = this.resolveMediaType(localUri, type);
        const ext = this.extractExtension(localUri);
        const expectedFilename = `msg_${messageId}.${ext}`;
        const destinationPath = this.getMediaPath(mediaType, expectedFilename);

        try {
            const exists = await this.fileExists(destinationPath);
            if (!exists) {
                const sourceFile = new File(localUri);
                const destFile = new File(destinationPath);
                sourceFile.copy(destFile);
            }
            console.log(`[Storage] Sender media natively cached at ${destinationPath}`);
            return destinationPath;
        } catch (e) {
            console.error('[Storage Error] Failed to copy local sender media:', e);
            return localUri; // Fallback to original uri
        }
    }
}

