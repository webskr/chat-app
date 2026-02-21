import { useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';

export function usePermissions() {
    const requestAllPermissions = async () => {
        if (Platform.OS === 'web') return;

        if (Constants.appOwnership === AppOwnership.Expo) {
            console.log('NOTE: You are running in Expo Go. Some native features like media saving (audio) may be limited by Expo Go\'s manifest. For full functionality, use a Development Build.');
        }

        try {
            // 1. Media Library
            try {
                const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
                if (mediaStatus !== 'granted') console.log('Media permission not granted');
            } catch (e) {
                console.log('MediaLibrary permission request failed:', e);
            }

            // 2. Microphone (for voice messages)
            try {
                const { status: audioStatus } = await Audio.requestPermissionsAsync();
                // if (audioStatus !== 'granted') console.log('Audio permission not granted');
            } catch (e) {
                // This is expected to fail in Expo Go if AUDIO is not in THEIR manifest
                console.log('Audio permission request failed (expected in Expo Go):', e);
            }

            // 3. Camera (for taking photos/videos)
            try {
                const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                if (cameraStatus !== 'granted') console.log('Camera permission not granted');
            } catch (e) {
                console.log('Camera permission request failed:', e);
            }
        } catch (error) {
            console.error('Error in requestAllPermissions:', error);
        }
    };

    useEffect(() => {
        requestAllPermissions();
    }, []);

    return { requestAllPermissions };
}
