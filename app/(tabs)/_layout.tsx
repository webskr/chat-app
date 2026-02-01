import React from 'react';
import { Tabs } from 'expo-router';
import { Chrome as Home, Users, UserPlus, Settings } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                tabBarShowLabel: false,
                tabBarBackground: () => (
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                ),
            }}>
            <Tabs.Screen
                name="index" // Chat
                options={{
                    tabBarIcon: ({ color }) => <Home size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="friends" // Global Friends
                options={{
                    tabBarIcon: ({ color }) => <Users size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="requests" // Requests
                options={{
                    tabBarIcon: ({ color }) => <UserPlus size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings" // Settings
                options={{
                    tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        borderTopWidth: 0,
        elevation: 0,
        height: 60,
        backgroundColor: 'transparent',
    },
});
