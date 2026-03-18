import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure how notifications behave when the app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => {
        let shouldNotify = true;
        try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                if (user.notifications_enabled === 0) {
                    shouldNotify = false;
                }
            }
        } catch (e) {
            console.error("Error checking notification preference", e);
        }

        return {
            shouldShowAlert: shouldNotify,
            shouldPlaySound: shouldNotify,
            shouldSetBadge: false,
            shouldShowBanner: shouldNotify,
            shouldShowList: shouldNotify,
        };
    },
});

/**
 * Requests permission and gets the raw Device Push Token (FCM token on Android, APNs on iOS).
 * This bypasses the Expo Push API completely.
 */
export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    // Check if running in Expo Go
    if (Constants.appOwnership === 'expo') {
        console.log('Expo Go detected: Push Notifications are not supported in Expo Go (SDK 53+). Use a Development Build.');
        return null;
    }

    if (Device.isDevice) {
        // Request Permissions First
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        try {
            // Get the raw Device Token (FCM on Android) instead of Expo Token
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            token = deviceToken.data;
            console.log("Raw FCM Device Token:", token);
        } catch (e: any) {
            console.log("Error fetching device token:", e);
            if (e.message?.includes('SERVICE_NOT_AVAILABLE')) {
                console.warn('Google Play Services is temporarily unavailable. Push tokens cannot be fetched right now.');
            }
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

/**
 * Listens for token refreshes from Firebase (e.g. if the FCM token rotates).
 * Call this in your root layout/component.
 */
export function addPushTokenListener(callback: (token: string) => void) {
    return Notifications.addPushTokenListener((deviceToken) => {
        console.log("FCM Token was refreshed:", deviceToken.data);
        callback(deviceToken.data);
    });
}

// Navigation logic for tapping a notification
export function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;

    if (data?.conversation_id) {
        // Navigate to the chat
        router.push(`/chat/${data.conversation_id}`);
    } else if (data?.type === 'friend_request') {
        // Navigate to friend requests (assuming route exists)
        // router.push('/(tabs)/contacts'); // Adjust as needed
    }
}
