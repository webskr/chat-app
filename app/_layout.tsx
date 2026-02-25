import { Stack } from "expo-router";
import { UserProvider } from "../context/UserContext";
import { ThemeProvider as NeonThemeProvider } from '../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [loaded] = useFonts({
        // Add custom fonts here if needed
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

