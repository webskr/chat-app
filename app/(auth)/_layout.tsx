import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ animation: 'fade' }} />
            <Stack.Screen name="signup" options={{ animation: 'fade' }} />
        </Stack>
    );
}
