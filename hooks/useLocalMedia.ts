import { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { Config } from '../constants/Config';
import { MediaStorageService } from '../storage/MediaStorageService';

/**
 * useLocalMedia.ts
 *
 * A specialized hook that resolves the best available URI for a media item.
 *
 * Logic:
 * 1. Checks if the media natively exists in FileSystem.documentDirectory Cache.
 * 2. If local URI exists -> returns local URI (offline-ready).
 * 3. Otherwise -> returns the remote Thumbnail URL to save bandwidth.
 * 4. Switches to local URI automatically when it becomes available (reactive).
 *
 * @param messageId    Server-side message ID
 * @param remoteUrl    Full URL (or relative path) of the main media file
 * @param thumbnailUrl Full URL (or relative path) of the thumbnail
 * @returns The best available URI string (local > thumbnail > remote)
 */
export function useLocalMedia(
    messageId: number | string | undefined,
    remoteUrl: string | null | undefined,
    thumbnailUrl: string | null | undefined
): string | undefined {
    // Resolve full remote URLs immediately
    const fullRemoteUrl = remoteUrl
        ? ((remoteUrl.startsWith('http') || remoteUrl.startsWith('file://')) ? remoteUrl : `${Config.API_URL}/${remoteUrl.replace(/^\//, '')}`)
        : undefined;

    const fullThumbnailUrl = thumbnailUrl
        ? ((thumbnailUrl.startsWith('http') || thumbnailUrl.startsWith('file://')) ? thumbnailUrl : `${Config.API_URL}/${thumbnailUrl.replace(/^\//, '')}`)
        : undefined;

    const [resolvedUri, setResolvedUri] = useState<string | undefined>(fullThumbnailUrl || fullRemoteUrl);

    useEffect(() => {
        if (!messageId || !fullRemoteUrl) return;

        let isMounted = true;

        async function checkCache() {
            if (!messageId || !fullRemoteUrl) return;
            // Native FileSystem check for cached copy (Handles both sender/receiver inherently)
            const localUri = await MediaStorageService.getLocalUri(messageId, fullRemoteUrl);

            if (isMounted) {
                if (localUri) {
                    setResolvedUri(localUri);
                } else {
                    const fallback = fullThumbnailUrl || fullRemoteUrl;
                    setResolvedUri(fallback);
                }
            }
        }

        checkCache();

        // ── Listener for reactive updates ─────────────────────────────────────
        // If a download completes elsewhere (e.g. useMediaCache), update this hook.
        const subscription = DeviceEventEmitter.addListener('media_downloaded', (data) => {
            if (String(data.messageId) === String(messageId)) {
                setResolvedUri(data.uri);
            }
        });

        return () => {
            isMounted = false;
            subscription.remove();
        };
    }, [messageId, fullThumbnailUrl, fullRemoteUrl]);

    return resolvedUri;
}
