import { Stack } from "expo-router";
import { UserProvider } from "../context/UserContext";
import { ThemeProvider as NeonThemeProvider } from '../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { KeyboardProvider } from 'react-native-keyboard-controller';

export default function RootLayout() {
    const router = useRouter();
    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();

    const [loaded] = useFonts({
        // Add custom fonts here if needed
    });

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    useEffect(() => {
        // Handle notifications received while app is explicitly in FOREGROUND
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification received in foreground:', notification);
        });

        // Handle user tapping on a notification (Background / Killed State)
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('User tapped notification:', response);
            const data = response.notification.request.content.data;

            // Navigate to specific chat if conversation_id is provided
            if (data?.conversation_id) {
                // Introduce a slight delay to ensure layout is ready if app just cold-started
                setTimeout(() => {
                    router.push(`/chat/${data.conversation_id}`);
                }, 500);
            }
        });

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, []);

    if (!loaded) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
            <UserProvider>
                <NeonThemeProvider>
                    <KeyboardProvider>
                        <View style={{ flex: 1, backgroundColor: Colors.background }}>
                            <StatusBar style="light" />
                            <Stack screenOptions={{ headerShown: false }}>
                                <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                                <Stack.Screen name="(tabs)" />
                                <Stack.Screen name="appearance" options={{ presentation: 'modal' }} />
                                <Stack.Screen name="+not-found" />
                            </Stack>
                        </View>
                    </KeyboardProvider>
                </NeonThemeProvider>
            </UserProvider>
        </GestureHandlerRootView>
    );
}

