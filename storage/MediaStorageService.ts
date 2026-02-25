import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { Config } from '../constants/Config';

/**
 * Media Type enum for folder organization
 */
export type MediaType = 'Images' | 'Videos' | 'Documents' | 'Thumbnails' | 'Cache';

// Hardened: We use FileSystem.documentDirectory which is always available.
let MEDIA_BASE_DIR = `${FileSystem.documentDirectory}vegarm/`;

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
     */
    static async init(): Promise<void> {
        try {
            const baseDirInfo = await FileSystem.getInfoAsync(MEDIA_BASE_DIR);

            if (!baseDirInfo.exists) {
                console.log(`[Storage] Creating secure base media directory: ${MEDIA_BASE_DIR}`);
                await FileSystem.makeDirectoryAsync(MEDIA_BASE_DIR, { intermediates: true });
            }

            for (const folder of Object.values(FOLDERS)) {
                const folderPath = `${MEDIA_BASE_DIR}${folder}`;
                const dirInfo = await FileSystem.getInfoAsync(folderPath);
                if (!dirInfo.exists) {
                    await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
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

    static resolveMediaType(url: string, explicitType?: string): MediaType {
        if (explicitType === 'image' || explicitType === 'sticker' || explicitType === 'gif') return 'Images';
        if (explicitType === 'video' || explicitType === 'voice') return 'Videos';
        if (explicitType === 'document') return 'Documents';

        const rawUrl = url.split('?')[0].toLowerCase();
        if (/\.(jpg|jpeg|png|webp|gif)$/i.test(rawUrl)) return 'Images';
        if (/\.(mp4|mov|mkv|webm|m4a|mp3|wav|aac)$/i.test(rawUrl)) return 'Videos';
        return 'Documents';
    }

    static extractExtension(url: string): string {
        const rawUrl = url.split('?')[0];
        return rawUrl.split('.').pop()?.split('/')[0]?.toLowerCase()?.slice(0, 5) || 'bin';
    }

    static async fileExists(path: string): Promise<boolean> {
        try {
            const info = await FileSystem.getInfoAsync(path);
            return info.exists;
        } catch (e) {
            return false;
        }
    }

    static async getLocalUri(messageId: number | string, url: string, type?: string): Promise<string | null> {
        const mediaType = this.resolveMediaType(url, type);
        const ext = this.extractExtension(url);
        const expectedFilename = `msg_${messageId}.${ext}`;
        const localPath = this.getMediaPath(mediaType, expectedFilename);

        const exists = await this.fileExists(localPath);
        if (exists) {
            return localPath;
        }
        return null;
    }

    /**
     * Downloads an HTTP URL directly into the deterministic internal folder structure.
     * Then saves to gallery if it's an image or video on Android.
     */
    static async saveMedia(url: string, messageId: number | string, type?: string): Promise<string> {
        const mediaType = this.resolveMediaType(url, type);
        const ext = this.extractExtension(url);
        const fullUrl = url.startsWith('http') ? url : `${Config.API_URL}/${url.replace(/^\//, '')}`;
        const expectedFilename = `msg_${messageId}.${ext}`;
        const destinationPath = this.getMediaPath(mediaType, expectedFilename);

        const alreadyExists = await this.fileExists(destinationPath);
        if (alreadyExists) {
            return destinationPath;
        }

        try {
            const downloadResult = await FileSystem.downloadAsync(fullUrl, destinationPath);

            // Save to Gallery on Android
            if (Platform.OS === 'android' && (mediaType === 'Images' || mediaType === 'Videos')) {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                    const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
                    await MediaLibrary.createAlbumAsync('Vegarm', asset, false);
                    console.log(`[Storage] Media saved to gallery: Vegarm album`);
                }
            }

            return downloadResult.uri;
        } catch (e) {
            console.error('[Storage Error] saveMedia fatal error:', e);
            throw e;
        }
    }

    static async copyToCache(localUri: string, messageId: number | string, type?: string): Promise<string> {
        const mediaType = this.resolveMediaType(localUri, type);
        const ext = this.extractExtension(localUri);
        const expectedFilename = `msg_${messageId}.${ext}`;
        const destinationPath = this.getMediaPath(mediaType, expectedFilename);

        try {
            const exists = await this.fileExists(destinationPath);
            if (!exists) {
                await FileSystem.copyAsync({ from: localUri, to: destinationPath });
            }
            return destinationPath;
        } catch (e) {
            console.error('[Storage Error] Failed to copy local sender media:', e);
            return localUri;
        }
    }
}

