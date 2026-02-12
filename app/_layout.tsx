import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { View, Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UserProvider } from '../context/UserContext';
import { ThemeProvider as NeonThemeProvider } from '../context/ThemeContext';
import * as Linking from 'expo-linking';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [loaded] = useFonts({
        // If you have custom fonts, add them here. 
        // For now, leaving empty or assuming system fonts if no assets are present.
        // 'SpaceMono': require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    const url = Linking.useURL();

    useEffect(() => {
        if (url) {
            handleURL(url);
        }
    }, [url]);

    useEffect(() => {
        // Android Deferred Invite: Check install referrer on first boot
        if (Platform.OS === 'android') {
            checkDeferredInvite();
        }
    }, []);

    const handleURL = async (link: string) => {
        const { hostname, path, queryParams } = Linking.parse(link);
        console.log('Invite Debug - Link:', { hostname, path, queryParams });

        if ((hostname === 'invite' || path === 'invite') && queryParams?.code) {
            const code = queryParams.code as string;
            await AsyncStorage.setItem('pending_invite_code', code);
            console.log('Invite Debug - Saved from link:', code);
        }
    };

    const checkDeferredInvite = async () => {
        try {
            // Check if we already have a code from a direct deep link
            const existing = await AsyncStorage.getItem('pending_invite_code');
            if (existing) return;

            // In a production app with native builds, you would use:
            // import InstallReferrer from 'react-native-install-referrer';
            // const result = await InstallReferrer.getReferrer();
            // if (result.referrer) { ... parse invite_code ... }

            // For Expo/Development context, we'll log the intent.
            // The logic is: if user clicks Play Store link with ?referrer=invite_code%3DCODE
            // The OS passes that to the app on first launch.
            console.log('Checking for deferred Android invite via Install Referrer...');
        } catch (e) {
            console.log('Install Referrer Check Failed:', e);
        }
    };

    if (!loaded) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <UserProvider>
                <NeonThemeProvider>
                    <View style={{ flex: 1, backgroundColor: Colors.background }}>
                        <StatusBar style="light" />
                        <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                            <Stack.Screen name="(tabs)" />
                            <Stack.Screen name="appearance" options={{ presentation: 'modal' }} />
                            <Stack.Screen name="+not-found" />
                        </Stack>
                    </View>
                </NeonThemeProvider>
            </UserProvider>
        </GestureHandlerRootView>
    );
}
