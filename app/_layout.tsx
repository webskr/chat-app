import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    useEffect(() => {
        const init = async () => {
            // Let any initial splash animation play
            await new Promise(resolve => setTimeout(resolve, 500));
            await checkAuth();
            await SplashScreen.hideAsync();
        };
        init();
    }, []);

    const checkAuth = async () => {
        try {
            const user = await AsyncStorage.getItem('user');
            if (user) {
                router.replace('/(tabs)');
            } else {
                router.replace('/(auth)/login');
            }
        } catch (error) {
            console.error('Auth check error:', error);
            router.replace('/(auth)/login');
        }
    };

    return (
        <UserProvider>
            <View style={{ flex: 1, backgroundColor: Colors.background }}>
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="+not-found" />
                </Stack>
            </View>
        </UserProvider>
    );
}
