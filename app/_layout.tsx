import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { UserProvider } from '../context/UserContext';
import { ThemeProvider as NeonThemeProvider } from '../context/ThemeContext';

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

    if (!loaded) {
        return null;
    }

    return (
        <UserProvider>
            <NeonThemeProvider>
                <View style={{ flex: 1, backgroundColor: Colors.background }}>
                    <StatusBar style="light" />
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                        <Stack.Screen name="(tabs)" />

                        <Stack.Screen name="+not-found" />
                    </Stack>
                </View>
            </NeonThemeProvider>
        </UserProvider>
    );
}
