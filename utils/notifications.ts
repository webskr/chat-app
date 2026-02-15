import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';

// Configure how notifications behave when the app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

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

        // Learn more about projectId:
        // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
        // For bare workflow or development builds, project ID might be needed if not in app.json
        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId ?? 'a577d34c-aee7-46d8-9df6-ffee5d2d947a';
            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
            console.log("Push Token:", token);
        } catch (e) {
            console.log("Error fetching token:", e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
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
