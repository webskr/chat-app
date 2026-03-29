import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MediaUploadService } from '../../../../utils/MediaUploadService';
import { MediaStorageService } from '../../../../storage/MediaStorageService';

type MediaType = 'image' | 'video' | 'document';

export interface PreviewMediaItem {
    type: MediaType;
    uri: string;
    name?: string;
    mimeType?: string;
    size?: number;
    duration?: number;
}

interface UseChatMediaPickerProps {
    currentUser: any;
    chatId: string;
    setIsUploading: (val: boolean) => void;
    handleSend: (messageText: string, mediaPath: string | null, mediaType: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'gif' | 'sticker', isRetry?: boolean, isOneTime?: boolean, scheduledAt?: Date | null, extraMeta?: any) => Promise<any>;
}

export function useChatMediaPicker({ currentUser, chatId, setIsUploading, handleSend }: UseChatMediaPickerProps) {
    const [isEditorVisible, setIsEditorVisible] = useState(false);
    const [editorImageUri, setEditorImageUri] = useState<string | null>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [previewMedia, setPreviewMedia] = useState<PreviewMediaItem[] | null>(null);
    const lastVoiceUploadRef = useRef<{ uri: string, time: number } | null>(null);

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsMultipleSelection: true,
            selectionLimit: 10,
            allowsEditing: false, 
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newMediaItems = result.assets.map(asset => {
                const type = asset.type === 'video' ? 'video' : 'image';
                if (type === 'video' && asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
                    Alert.alert('File too large', 'One or more videos exceed the 50MB limit and were skipped.');
                    return null;
                }
                return {
                    type: type as 'image' | 'video',
                    uri: asset.uri,
                    name: asset.fileName || (type === 'video' ? 'video.mp4' : 'image.jpg'),
                    mimeType: asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
                    size: asset.fileSize ?? undefined,
                    duration: asset.duration ?? undefined
                };
            }).filter((item): item is PreviewMediaItem => item !== null);

            if (newMediaItems.length > 0) {
                setPreviewMedia(newMediaItems);
                setIsPreviewVisible(true);
            }
        }
    };

    const handlePickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsMultipleSelection: true,
            selectionLimit: 10,
            allowsEditing: false,
            quality: 1
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newMediaItems = result.assets.map(asset => {
                if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) return null;
                return {
                    type: 'video' as const,
                    uri: asset.uri,
                    name: asset.fileName || 'video.mp4',
                    mimeType: asset.mimeType || 'video/mp4',
                    size: asset.fileSize ?? undefined,
                    duration: asset.duration ?? undefined
                };
            }).filter((item): item is PreviewMediaItem => item !== null);

            if (newMediaItems.length > 0) {
                setPreviewMedia(newMediaItems);
                setIsPreviewVisible(true);
            }
        }
    };

    const handlePickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: ['*/*'], multiple: true });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newMediaItems = result.assets.map(asset => {
                if (asset.size && asset.size > 50 * 1024 * 1024) return null;
                return {
                    type: 'document' as const,
                    uri: asset.uri,
                    name: asset.name,
                    mimeType: asset.mimeType,
                    size: asset.size
                };
            }).filter((item): item is PreviewMediaItem => item !== null);

            if (newMediaItems.length > 0) {
                setPreviewMedia(newMediaItems);
                setIsPreviewVisible(true);
            }
        }
    };

    const handleLaunchCamera = async () => {
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            setEditorImageUri(result.assets[0].uri);
            setIsEditorVisible(true);
        }
    };

    const uploadImage = async (asset: any) => {
        if (!currentUser) return { success: false };
        setIsUploading(true);
        try {
            return await MediaUploadService.uploadMedia(asset.uri, 'image', currentUser.id, chatId, {
                fileName: asset.fileName || 'upload.jpg',
                mimeType: asset.type || 'image/jpeg'
            });
        } catch (e) {
            console.error("Image upload failed", e);
        } finally {
            setIsUploading(false);
        }
        return { success: false };
    };

    const handleEditorSend = async (uri: string) => {
        setIsEditorVisible(false);
        const asset = { uri, type: 'image/jpeg', fileName: uri.split('/').pop() || 'edited.jpg' };
        await uploadImage(asset);
        setEditorImageUri(null);
    };

    const handleMediaPreviewSend = async (caption: string, isOneTime: boolean) => {
        if (!currentUser || !previewMedia || previewMedia.length === 0) return;
        setIsPreviewVisible(false);

        const mediaItems = previewMedia;
        setPreviewMedia(null);

        for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            const itemCaption = i === 0 ? caption : '';

            let uploadResult: any = { success: false };
            let messageId: number | string | null = null;
            let finalUri = item.uri;
            let thumbnailUrl: string | undefined = undefined;
            let fileSize = item.size;

            try {
                if (item.type === 'image') {
                    finalUri = await MediaUploadService.compressImage(item.uri);
                    const sizeCheck = await MediaUploadService.validateFileSize(finalUri);
                    if (!sizeCheck.valid) {
                        Alert.alert('File too large', 'Even after compression, the image exceeds 20MB.');
                        continue;
                    }
                    fileSize = sizeCheck.size;
                } else if (item.type === 'video') {
                    const sizeCheck = await MediaUploadService.validateFileSize(item.uri);
                    if (!sizeCheck.valid) {
                        Alert.alert('File too large', 'The video exceeds the 20MB limit.');
                        continue;
                    }
                    fileSize = sizeCheck.size;

                    const thumb = await MediaUploadService.getVideoThumbnail(item.uri);
                    if (thumb) {
                        const thumbUpload = await MediaUploadService.uploadMedia(thumb, 'image', currentUser.id, chatId, {
                            fileName: `thumb_${Date.now()}.jpg`,
                        });
                        if (thumbUpload.success) {
                            thumbnailUrl = thumbUpload.media_url;
                        }
                    }
                } else if (item.type === 'document') {
                    const sizeCheck = await MediaUploadService.validateFileSize(item.uri);
                    if (!sizeCheck.valid) {
                        Alert.alert('File too large', 'The document exceeds the 20MB limit.');
                        continue;
                    }
                    fileSize = sizeCheck.size;
                }

                if (item.type === 'image') {
                    uploadResult = await MediaUploadService.uploadMedia(finalUri, 'image', currentUser.id, chatId, {
                        fileName: item.name || 'image.jpg',
                        mimeType: 'image/jpeg'
                    });
                    if (uploadResult?.success) {
                        messageId = await handleSend(itemCaption, uploadResult.media_url, 'image', false, isOneTime, null, {
                            file_size: fileSize,
                        });
                    }
                } else if (item.type === 'video') {
                    uploadResult = await MediaUploadService.uploadMedia(item.uri, 'video', currentUser.id, chatId, {
                        fileName: item.name || 'video.mp4',
                        duration: item.duration ? Math.ceil(item.duration / 1000) : undefined,
                        mimeType: item.mimeType || 'video/mp4'
                    });
                    if (uploadResult?.success) {
                        messageId = await handleSend(itemCaption, uploadResult.media_url, 'video', false, isOneTime, null, {
                            file_size: fileSize,
                            duration: item.duration ? Math.ceil(item.duration / 1000) : undefined,
                            thumbnail_url: thumbnailUrl
                        });
                    }
                } else if (item.type === 'document') {
                    uploadResult = await MediaUploadService.uploadMedia(item.uri, 'document', currentUser.id, chatId, {
                        fileName: item.name || 'document',
                        mimeType: item.mimeType || 'application/octet-stream'
                    });
                    if (uploadResult?.success) {
                        messageId = await handleSend(itemCaption, uploadResult.media_url, 'document', false, isOneTime, null, {
                            file_size: fileSize,
                            file_name: item.name,
                            mime_type: item.mimeType,
                        });
                    }
                }
            } catch (err) {
                console.error(`[MediaPreviewSend] Optimized upload failed for ${item.type}:`, err);
            }

            if (messageId && finalUri) {
                try {
                    await MediaStorageService.copyToCache(finalUri, messageId, item.type as any);
                } catch (e) { /* non-fatal */ }
            }
        }
    };

    const uploadVoiceMessage = async (uri: string, duration: number) => {
        if (!currentUser) return;

        const now = Date.now();
        if (lastVoiceUploadRef.current &&
            lastVoiceUploadRef.current.uri === uri &&
            (now - lastVoiceUploadRef.current.time) < 2000) {
            console.log('Skipping duplicate voice upload trigger');
            return;
        }
        lastVoiceUploadRef.current = { uri, time: now };

        setIsUploading(true);
        try {
            const result = await MediaUploadService.uploadMedia(uri, 'audio', currentUser.id, chatId, {
                duration: duration,
                fileName: uri.split('/').pop() || 'voice.m4a',
                mimeType: 'audio/m4a'
            });

            if (result.success) {
                const audUrl = result.audio_url || result.media_url;
                const messageId = await handleSend('', audUrl, 'voice', false, false, null, { duration: duration });
                if (messageId) {
                    await MediaStorageService.copyToCache(uri, messageId, 'voice');
                }
            } else {
                console.error("Voice upload failed:", result.message || result);
            }
        } catch (error) {
            console.error('Voice upload error', error);
        } finally {
            setIsUploading(false);
        }
    };

    return {
        isEditorVisible,
        setIsEditorVisible,
        editorImageUri,
        setEditorImageUri,
        isPreviewVisible,
        setIsPreviewVisible,
        previewMedia,
        setPreviewMedia,
        handlePickImage,
        handlePickVideo,
        handlePickDocument,
        handleLaunchCamera,
        handleEditorSend,
        handleMediaPreviewSend,
        uploadVoiceMessage
    };
}
