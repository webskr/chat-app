import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { Config } from '../constants/Config';
import { getPublicMediaDirectory, downloadMedia } from '../modules/vegarm-media';

/**
 * Media Type enum for folder organization
 */
export type MediaType = 'Images' | 'Videos' | 'Documents' | 'Thumbnails' | 'Cache';

// Hardened: Use native path if available (Android Scoped Storage), fallback to internal.
const publicDir = getPublicMediaDirectory();
const INTERNAL_BASE_DIR = `${FileSystem.documentDirectory}vegarm/`;
let MEDIA_BASE_DIR = publicDir ? publicDir : INTERNAL_BASE_DIR;

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
            // If using public native directory, folders are pre-created in VegarmMediaModule.kt
            if (publicDir && Platform.OS === 'android') {
                console.log('[Storage] Using native public directory, skipping Expo folder creation.');
                return;
            }

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
        if (explicitType === 'video') return 'Videos';
        if (explicitType === 'voice') return 'Videos'; // Keep as Videos for folder structure
        if (explicitType === 'document') return 'Documents';

        const rawUrl = url.split('?')[0].toLowerCase();
        if (/\.(jpg|jpeg|png|webp|gif)$/i.test(rawUrl)) return 'Images';
        if (/\.(mp4|mov|mkv|webm)$/i.test(rawUrl)) return 'Videos';
        if (/\.(m4a|mp3|wav|aac)$/i.test(rawUrl)) return 'Videos'; // Voice/Audio folders
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
        
        // 1. Try public path first if available
        const publicPath = this.getMediaPath(mediaType, expectedFilename);
        if (await this.fileExists(publicPath)) {
            return publicPath;
        }

        // 2. Try internal fallback path
        const internalPath = `${INTERNAL_BASE_DIR}${FOLDERS[mediaType]}${expectedFilename}`;
        if (await this.fileExists(internalPath)) {
            return internalPath;
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
            let resultUri: string;

            if (publicDir && Platform.OS === 'android') {
                // Use native download to bypass Expo FileSystem write restrictions on Android/media
                const subfolder = FOLDERS[mediaType].replace('/', '');
                console.log(`[Storage] Using native download for ${expectedFilename} into ${subfolder}`);
                resultUri = await downloadMedia(fullUrl, expectedFilename, subfolder);
                
                // Fallback to internal if native download failed/missing
                if (!resultUri) {
                    console.warn('[Storage] Native download failed or unavailable, falling back to internal storage.');
                    const internalPath = `${INTERNAL_BASE_DIR}${FOLDERS[mediaType]}${expectedFilename}`;
                    const downloadResult = await FileSystem.downloadAsync(fullUrl, internalPath);
                    resultUri = downloadResult.uri;
                }
            } else {
                const downloadResult = await FileSystem.downloadAsync(fullUrl, destinationPath);
                resultUri = downloadResult.uri;
            }

            // Save to Gallery on Android (Images and Videos ONLY, skip automatic gallery save for voice)
            const isGalleryMedia = (mediaType === 'Images' || mediaType === 'Videos') && type !== 'voice';

            if (Platform.OS === 'android' && isGalleryMedia) {
                const { status } = await MediaLibrary.requestPermissionsAsync(true); // Request write-only
                if (status === 'granted') {
                    const ALBUM_NAME = 'Vegarm';
                    const asset = await MediaLibrary.createAssetAsync(resultUri);

                    // Check if album exists
                    let album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
                    if (!album) {
                        // Create album with copyAssets: true to avoid Scoped Storage "modify" prompt
                        await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, true);
                        console.log(`[Storage] Created "${ALBUM_NAME}" album and saved asset (copyAssets: true)`);
                    } else {
                        // Add to existing album with copyAssets: true
                        await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
                        console.log(`[Storage] Added asset to existing "${ALBUM_NAME}" album (copyAssets: true)`);
                    }
                }
            }

            return resultUri;
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
                if (publicDir && Platform.OS === 'android') {
                    const subfolder = FOLDERS[mediaType].replace('/', '');
                    console.log(`[Storage] Using native copy for ${expectedFilename} into ${subfolder}`);
                    const VegarmMedia = require('../modules/vegarm-media');
                    const result = await VegarmMedia.copyMedia(localUri, expectedFilename, subfolder);
                    if (result) return result;
                    
                    console.warn('[Storage] Native copyMedia failed or unavailable, falling back to internal storage.');
                }
                
                // Final fallback: use internal storage (always writable)
                const internalPath = `${INTERNAL_BASE_DIR}${FOLDERS[mediaType]}${expectedFilename}`;
                console.log(`[Storage] Falling back to internal copy: ${internalPath}`);
                
                // Ensure internal directory exists before copying
                const internalDir = `${INTERNAL_BASE_DIR}${FOLDERS[mediaType]}`;
                const dirInfo = await FileSystem.getInfoAsync(internalDir);
                if (!dirInfo.exists) {
                    await FileSystem.makeDirectoryAsync(internalDir, { intermediates: true });
                }

                await FileSystem.copyAsync({ from: localUri, to: internalPath });
                return internalPath;
            }
            return destinationPath;
        } catch (e) {
            console.error('[Storage Error] Failed to copy local sender media:', e);
            return localUri;
        }
    }
}

