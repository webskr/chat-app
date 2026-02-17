import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useUser } from '../context/UserContext';
import { Colors } from '../constants/Colors';

export default function Index() {
    const { user, isLoading } = useUser();

    useEffect(() => {
        if (!isLoading) {
            if (user) {
                router.replace('/(tabs)');
            } else {
                router.replace('/(auth)/signup');
            }
        }
    }, [user, isLoading]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
            <ActivityIndicator size="large" color={Colors.primary} />
        </View>
    );
}
