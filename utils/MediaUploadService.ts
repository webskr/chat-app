import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Config } from '../constants/Config';
import { SecureStoreHelper } from './SecureStoreHelper';

export interface UploadResult {
    success: boolean;
    media_url?: string;
    thumbnail_url?: string;
    file_size?: number;
    error?: string;
    [key: string]: any;
}

export class MediaUploadService {
    static MAX_FILE_SIZE_MB = 20;

    /**
     * Compresses an image to max width/height of 1280px and 0.7 quality.
     */
    static async compressImage(uri: string): Promise<string> {
        try {
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1280 } }], // ImageManipulator handles aspect ratio if only width is provided
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            return result.uri;
        } catch (error) {
            console.error('[MediaUploadService] Image compression failed:', error);
            return uri; // Fallback to original URI
        }
    }

    /**
     * Generates a thumbnail for a video.
     */
    static async getVideoThumbnail(uri: string): Promise<string | null> {
        try {
            const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, {
                time: 1000, // 1 second in
            });
            // Compress the thumbnail too
            return await this.compressImage(thumbnailUri);
        } catch (error) {
            console.error('[MediaUploadService] Video thumbnail generation failed:', error);
            return null;
        }
    }

    /**
     * Validates if the file size is within the limit.
     */
    static async validateFileSize(uri: string, maxSizeMB: number = this.MAX_FILE_SIZE_MB): Promise<{ valid: boolean; size?: number }> {
        try {
            const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
            if (!fileInfo.exists) return { valid: false };

            const sizeInBytes = (fileInfo as any).size || 0;
            const sizeInMB = sizeInBytes / (1024 * 1024);

            return {
                valid: sizeInMB <= maxSizeMB,
                size: sizeInBytes
            };
        } catch (error) {
            console.error('[MediaUploadService] File size validation failed:', error);
            return { valid: false };
        }
    }

    /**
     * Uploads media using FormData.
     */
    static async uploadMedia(
        uri: string,
        type: 'image' | 'video' | 'document' | 'audio',
        senderId: string | number,
        receiverId: string | number,
        extraData: Record<string, any> = {}
    ): Promise<UploadResult> {
        const formData = new FormData();
        const filename = extraData.fileName || uri.split('/').pop() || `upload_${Date.now()}`;

        let endpoint = '';
        let fieldName = '';

        switch (type) {
            case 'image':
                endpoint = '/chat/upload_image.php';
                fieldName = 'image';
                break;
            case 'video':
                endpoint = '/chat/upload_video.php';
                fieldName = 'video';
                break;
            case 'document':
                endpoint = '/chat/upload_document.php';
                fieldName = 'document';
                break;
            case 'audio':
                endpoint = '/chat/upload_audio.php';
                fieldName = 'audio';
                break;
        }

        if (Platform.OS === 'web') {
            const res = await fetch(uri);
            formData.append(fieldName, await res.blob(), filename);
        } else {
            formData.append(fieldName, {
                uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                name: filename,
                type: extraData.mimeType || this.getMimeType(type, filename)
            } as any);
        }

        formData.append('sender_id', String(senderId));
        formData.append('receiver_id', String(receiverId));

        // Append extra data (e.g., duration)
        Object.keys(extraData).forEach(key => {
            if (key !== 'fileName' && key !== 'mimeType') {
                formData.append(key, String(extraData[key]));
            }
        });

        try {
            const accessToken = await SecureStoreHelper.getAccessToken();
            const headers: Record<string, string> = {};
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

            const response = await fetch(`${Config.API_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: formData,
            });

            const responseText = await response.text();
            try {
                const data = JSON.parse(responseText);
                if (response.ok && data.success) {
                    return {
                        success: true,
                        media_url: data.media_url || data.image_path || data.video_path || data.file_path || data.audio_url,
                        ...data
                    };
                }
                return { success: false, error: data.message || 'Upload failed' };
            } catch (jsonErr) {
                console.error(`[MediaUploadService] ${type} upload failed parsing JSON:`, responseText);
                return { success: false, error: 'Invalid server response' };
            }
        } catch (error) {
            console.error(`[MediaUploadService] ${type} upload error:`, error);
            return { success: false, error: 'Network error or server unavailable' };
        }
    }

    private static getMimeType(type: string, filename: string): string {
        if (type === 'image') return 'image/jpeg';
        if (type === 'video') return 'video/mp4';
        if (type === 'audio') return 'audio/m4a';

        const ext = filename.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'pdf': return 'application/pdf';
            case 'doc': return 'application/msword';
            case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            default: return 'application/octet-stream';
        }
    }
}
