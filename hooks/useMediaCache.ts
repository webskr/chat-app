/**
 * useMediaCache.ts
 *
 * Hook that provides the resolved media URI and download state for a message.
 *
 * Behaviour:
 * - Sender/Receiver: look up local file natively from MediaStorageService. If present → use it. If not → isDownloaded=false.
 * - Expose `downloadMedia()` to trigger manual download via MediaStorageService.
 * - Voice messages: always auto-download (small file size, inline playback expected).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import { MediaStorageService } from '../storage/MediaStorageService';
import { Config } from '../constants/Config';
import * as FileSystem from 'expo-file-system';
import { E2EEService } from '../app/utils/crypto';
import { LocalDatabaseService } from '../app/utils/LocalDatabaseService';

export type UseMediaCacheResult = {
    /** Best available URI (local file:// or remote URL). Null while checking. */
    localUri: string | null;
    /** True once the file natively exists locally. */
    isDownloaded: boolean;
    /** True while the initial check or a download is in progress. */
    isLoading: boolean;
    /** Call to trigger a manual download (receiver only). */
    downloadMedia: () => Promise<void>;
    /** True while a manual download is running. */
    isDownloading: boolean;
};

/**
 * @param messageId   Unique message ID from the server
 * @param mediaUrl    Raw `media_url` from the API response (relative or absolute)
 * @param isMe        True if the current user is the sender
 * @param messageType e.g. 'image', 'video', 'document', 'voice'
 */
export function useMediaCache(
    messageId: number | string | undefined,
    mediaUrl: string | null | undefined,
    isMe: boolean,
    messageType?: string,
    userId?: number | string,
    e2eMedia?: any
): UseMediaCacheResult {
    const [localUri, setLocalUri] = useState<string | null>(null);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Build the full remote URL
    const remoteUrl = !mediaUrl
        ? null
        : mediaUrl.startsWith('http')
            ? mediaUrl
            : `${Config.API_URL}/${mediaUrl.replace(/^\//, '')}`;

    // ── Initial check on mount / when message changes ────────────────────────
    useEffect(() => {
        if (!messageId || !remoteUrl) {
            setLocalUri(null);
            setIsDownloaded(false);
            return;
        }

        const isVoice = messageType === 'voice' || /\.(m4a|mp3|wav|aac)$/i.test(mediaUrl ?? '');

        setIsLoading(true);

        (async () => {
            let uri: string | null = null;

            // Sender/Receiver: Use native file check
            uri = await MediaStorageService.getLocalUri(messageId, remoteUrl, messageType);

            // Auto-download voice messages (or if you want to auto-download e2eMedia)
            // For now, E2E voice should also auto-download!
            if (!uri && !isMe && isVoice) {
                try {
                    if (e2eMedia && e2eMedia.key) {
                        // It's encrypted! Handled via manual trigger below, but we can do it inline:
                        const tempUri = ((FileSystem as any).cacheDirectory || 'file:///') + 'temp_dl_' + Date.now() + '.enc';
                        const downloaded = await FileSystem.downloadAsync(remoteUrl, tempUri);
                        uri = await E2EEService.decryptFile(downloaded.uri, e2eMedia.key, e2eMedia.nonce, e2eMedia.tag, e2eMedia.mimeType);
                        if (uri && messageId) await LocalDatabaseService.updateMessageMediaUrl(String(messageId), uri);
                    } else {
                        uri = await MediaStorageService.saveMedia(remoteUrl, messageId, messageType);
                    }

                    if (uri && userId) {
                        fetch(`${Config.API_URL}/chat/mark_media_downloaded.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: userId, message_id: messageId })
                        }).catch(console.warn);
                        DeviceEventEmitter.emit('media_downloaded', { messageId, uri });
                    }
                } catch (_) { uri = remoteUrl; }
            }

            if (mountedRef.current) {
                if (uri && uri !== remoteUrl) {
                    setLocalUri(uri);
                    setIsDownloaded(true);

                    // Sync backend: If receiver has the file, ensure server knows it (idempotent)
                    if (!isMe && userId && messageId) {
                        fetch(`${Config.API_URL}/chat/mark_media_downloaded.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: userId, message_id: messageId })
                        }).catch(() => { }); // silent fail
                    }
                } else {
                    setLocalUri(remoteUrl);
                    setIsDownloaded(false);
                }
                setIsLoading(false);
            }
        })();
    }, [messageId, remoteUrl, isMe, messageType, userId, e2eMedia]);

    // ── Manual download trigger (receiver taps Download button) ──────────────
    const downloadMedia = useCallback(async () => {
        if (!messageId || !remoteUrl || isMe || isDownloading) return;
        setIsDownloading(true);

        try {
            let uri: string | null = null;

            if (e2eMedia && e2eMedia.key) {
                // Determine remote URL from e2eMedia.url since it was uploaded there
                const e2eRemoteUrl = e2eMedia.url.startsWith('http') ? e2eMedia.url : `${Config.API_URL}/${e2eMedia.url.replace(/^\//, '')}`;

                // --- ZERO-KNOWLEDGE DOWNLOAD FLIGHT ---
                const tempUri = ((FileSystem as any).cacheDirectory || 'file:///') + 'temp_dl_' + Date.now() + '.enc';
                console.log("Downloading Encrypted E2E Blob:", e2eRemoteUrl);
                const downloaded = await FileSystem.downloadAsync(e2eRemoteUrl, tempUri);

                // --- CLIENT-SIDE DECRYPTION ---
                uri = await E2EEService.decryptFile(downloaded.uri, e2eMedia.key, e2eMedia.nonce, e2eMedia.tag, e2eMedia.mimeType);

                // --- TRIGGER SERVER DELETION ---
                try {
                    // We extract UUID from the URL if backend needs it, or mark_media_downloaded handles it via messageId.
                    // The backend will automatically delete if mark_media_downloaded is modified to clean up e2e.
                } catch (e) { }

                // Update local storage so we don't have to download again natively!
                if (uri && messageId) {
                    await LocalDatabaseService.updateMessageMediaUrl(String(messageId), uri);
                }
            } else {
                uri = await MediaStorageService.saveMedia(remoteUrl, messageId, messageType);
            }

            if (uri && userId) {
                // Notify backend that this recipient has the file
                await fetch(`${Config.API_URL}/chat/mark_media_downloaded.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, message_id: messageId })
                });
                DeviceEventEmitter.emit('media_downloaded', { messageId, uri });
            }

            if (mountedRef.current) {
                setLocalUri(uri);
                setIsDownloaded(true);
            }
        } catch (error) {
            console.warn('Download failed:', error);
        } finally {
            if (mountedRef.current) setIsDownloading(false);
        }
    }, [messageId, remoteUrl, isMe, isDownloading, userId, e2eMedia]);

    return { localUri, isDownloaded, isLoading, downloadMedia, isDownloading };
}
