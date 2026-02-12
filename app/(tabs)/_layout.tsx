import React from 'react';
import { Tabs } from 'expo-router';
import { MessageSquareText, Group, Globe2, Settings } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { BlurView } from 'expo-blur';
import { StyleSheet, View, Text } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
                tabBarBackground: () => (
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                ),
            }}>
            <Tabs.Screen
                name="index" // Chat List (was chats)
                options={{
                    title: 'Chats',
                    tabBarIcon: ({ color, focused }) => (
                        <View>
                            <MessageSquareText size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
                            {/* Badge logic could go here if global state available, but usually handled in badge prop */}
                        </View>
                    ),
                    tabBarBadge: 45, // Example badge count from reference, or dynamic
                    tabBarBadgeStyle: styles.badge,
                }}
            />
            <Tabs.Screen
                name="global_friends" // Global / Home (was index)
                options={{
                    title: 'Global',
                    tabBarIcon: ({ color, focused }) => <Globe2 size={24} color={color} strokeWidth={focused ? 2.5 : 2} />,
                }}
            />

            <Tabs.Screen
                name="requests" // Mapped to Updates
                options={{
                    title: 'Requests',
                    tabBarIcon: ({ color, focused }) => <Group size={24} color={color} strokeWidth={focused ? 2.5 : 2} />,
                }}
            />

            <Tabs.Screen
                name="settings" // Mapped to Calls
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, focused }) => <Settings size={24} color={color} strokeWidth={focused ? 2.5 : 2} />,
                }}
            />
            <Tabs.Screen
                name="profile-edit"
                options={{
                    href: null,
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
        height: 90, // Taller for labels
        backgroundColor: Colors.background, // Solid background preferred for bottom bar visibility
        paddingBottom: 10,
        paddingTop: 10,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    badge: {
        backgroundColor: Colors.primary,
        color: '#000', // Black text on green badge
        fontSize: 10,
        fontWeight: 'bold',
    },
});

