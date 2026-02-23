import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { Config } from '../constants/Config';

const ALBUM_NAME = 'Vegarm';

const attemptShare = async (uri: string, message: string) => {
    Alert.alert(
        'Save Issue',
        message,
        [{ text: 'Share/Save to Files', onPress: () => Sharing.shareAsync(uri) }]
    );
};

export const saveMedia = async (url: string, type: string, fileName?: string) => {
    let localUri: string | null = null;
    try {
        const fullUrl = url.startsWith('http') ? url : `${Config.API_URL}/${url.replace(/^\//, '')}`;
        const extension = fullUrl.split('.').pop()?.split('?')[0] || '';
        const name = fileName || `media_${Date.now()}.${extension}`;
        localUri = `${FileSystem.cacheDirectory}${name}`;

        // 1. Download to cache
        const downloadResult = await FileSystem.downloadAsync(fullUrl, localUri);

        if (downloadResult.status !== 200) {
            throw new Error('Failed to download file');
        }

        // 2. Handle Documents (Sharing API)
        if (type === 'document') {
            await Sharing.shareAsync(downloadResult.uri);
            return true;
        }

        // 3. Handle Media (Gallery)
        let status;
        try {
            const permissionResponse = await MediaLibrary.requestPermissionsAsync();
            status = permissionResponse.status;
        } catch (e) {
            console.log('Full permission request failed, trying writeOnly:', e);
            try {
                const writePermissionResponse = await MediaLibrary.requestPermissionsAsync(true);
                status = writePermissionResponse.status;
            } catch (e2) {
                console.log('WriteOnly permission request failed:', e2);
                status = 'denied';
            }
        }

        if (status !== 'granted') {
            // Fallback to Share for Expo Go or denied permissions
            await attemptShare(downloadResult.uri, 'Media Library permission denied (or not available in Expo Go). Sharing file instead.');
            return false;
        }

        try {
            const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
            // 4. Create or Reuse Album
            let album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
            if (album === null) {
                await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
            } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
            Alert.alert('Success', `Saved to ${ALBUM_NAME} album`);
            return true;
        } catch (saveError: any) {
            console.log('MediaLibrary save failed (likely Expo Go limitation):', saveError);
            await attemptShare(downloadResult.uri, 'Could not save to Library (likely Expo Go limitation). Shared instead.');
            return false;
        }

    } catch (error: any) {
        console.error('Media save error:', error);
        // Specific handling if the error percolated up
        if (error.message && error.message.includes('ExpoMediaLibrary') && localUri) {
            await attemptShare(localUri, 'Saving this media requires native permissions not present in Expo Go. Sharing instead.');
            return false;
        }
        Alert.alert('Error', 'Failed to download or save media.');
        return false;
    }
};
