import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { MessageSquareText, Group, Globe2, Settings } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { BlurView } from 'expo-blur';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { useUser } from '../../context/UserContext';
import { registerForPushNotificationsAsync } from '~/utils/notifications';
import { Config } from '../../constants/Config';

export default function TabLayout() {
    const { user, unreadCount, isProfileComplete, requestCount } = useUser();

    // console.log('TabLayout: unreadCount', unreadCount);

    useEffect(() => {
        let tokenListener: any;
        const registerToken = async () => {
            if (user) {
                try {
                    const registerForPushNotificationsAsyncModule = require('../../utils/notifications');
                    const token = await registerForPushNotificationsAsyncModule.registerForPushNotificationsAsync();

                    const saveTokenToDB = async (fcmToken: string) => {
                        await fetch(`${Config.API_URL}/api/save-token.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: user.id,
                                token: fcmToken,
                                platform: Platform.OS
                            })
                        });
                        console.log('FCM Device token registered & saved:', fcmToken);
                    };

                    if (token) {
                        await saveTokenToDB(token);
                    }

                    // Also listen for FCM token refreshes in the background
                    tokenListener = registerForPushNotificationsAsyncModule.addPushTokenListener((newToken: string) => {
                        saveTokenToDB(newToken);
                    });

                } catch (err) {
                    console.log('Error registering fcm token:', err);
                }
            }
        };

        registerToken();

        return () => {
            if (tokenListener && tokenListener.remove) {
                tokenListener.remove();
            }
        };
    }, [user]);

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
                        <MessageSquareText size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
                    ),
                    // Use actual count, but show '9+' for more than 9
                    tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: Colors.online, // Green for chats
                        color: '#000', // Black text for readability
                        fontSize: 10,
                        fontWeight: '800',
                        minWidth: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: Colors.background,
                        marginTop: 4,
                    },
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
                    tabBarBadge: requestCount > 0 ? '' : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: Colors.error, // Red dot for requests
                        minWidth: 10,
                        height: 10,
                        maxHeight: 10,
                        maxWidth: 10,
                        borderRadius: 5,
                        borderWidth: 1.5,
                        borderColor: Colors.background,
                        marginTop: 4,
                    },
                }}
            />

            <Tabs.Screen
                name="settings-tab" // Rename to settings-tab to avoid conflict with /settings folder
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, focused }) => <Settings size={24} color={color} strokeWidth={focused ? 2.5 : 2} />,
                    tabBarBadge: !isProfileComplete ? '' : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: Colors.error,
                        minWidth: 10,
                        height: 10,
                        maxHeight: 10,
                        maxWidth: 10,
                        borderRadius: 5,
                        borderWidth: 1.5,
                        borderColor: Colors.background,
                        marginTop: 4,
                    },
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
        height: 65, // Slimmer height
        backgroundColor: Colors.background,
        paddingBottom: 8,
        paddingTop: 8,
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

