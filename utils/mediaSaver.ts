import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { Config } from '../constants/Config';

const ALBUM_NAME = 'Vegarm';

export const saveMedia = async (url: string, type: string, fileName?: string) => {
    try {
        const fullUrl = url.startsWith('http') ? url : `${Config.API_URL}/${url.replace(/^\//, '')}`;
        const extension = fullUrl.split('.').pop()?.split('?')[0] || '';
        const name = fileName || `media_${Date.now()}.${extension}`;
        const localUri = `${FileSystem.cacheDirectory}${name}`;

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
            const writePermissionResponse = await MediaLibrary.requestPermissionsAsync(true);
            status = writePermissionResponse.status;
        }

        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Please enable media library permissions to save files.');
            return false;
        }

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
    } catch (error) {
        console.error('Media save error:', error);
        Alert.alert('Error', 'Failed to save media to device.');
        return false;
    }
};
