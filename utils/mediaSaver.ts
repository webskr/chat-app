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

        // 3. Request Media Library Permission
        // On Android 13+, write-only permission is sufficient and avoids READ_EXTERNAL_STORAGE denial
        let status: string;
        try {
            const writeOnly = Platform.OS === 'android';
            const permResult = await MediaLibrary.requestPermissionsAsync(writeOnly);
            status = permResult.status;
        } catch (e) {
            console.log('Permission request failed:', e);
            status = 'denied';
        }

        if (status !== 'granted') {
            await attemptShare(downloadResult.uri, 'Media Library permission denied. Sharing file instead.');
            return false;
        }

        try {
            // 4. Create asset first — this triggers creation of Android/media/com.skr.vegarm
            const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

            // 5. Create or reuse album (must create asset before album)
            let album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
            if (album === null) {
                // createAlbumAsync moves the asset into a new album folder
                await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
            } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
            Alert.alert('Saved', `Saved to ${ALBUM_NAME} album`);
            return true;
        } catch (saveError: any) {
            console.log('MediaLibrary save failed (likely Expo Go):', saveError);
            await attemptShare(downloadResult.uri, 'Could not save to Gallery. Sharing instead.');
            return false;
        }

    } catch (error: any) {
        console.error('Media save error:', error);
        if (localUri) {
            await attemptShare(localUri, 'Failed to save. Sharing instead.');
            return false;
        }
        Alert.alert('Error', 'Failed to download or save media.');
        return false;
    }
};
