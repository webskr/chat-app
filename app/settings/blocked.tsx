import React, { useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, UserX } from 'lucide-react-native';
import { router } from 'expo-router';

import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { getAvatarById } from '../../constants/Avatars';

export default function BlockedContactsScreen() {
    const { user } = useUser();
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchBlockedUsers();
    }, []);

    const fetchBlockedUsers = async () => {
        if (!user) return;

        try {
            const res = await fetch(
                `${Config.API_URL}/users/get_blocked_users.php?user_id=${user.id}`
            );
            const data = await res.json();

            if (res.ok) {
                setBlockedUsers(data);
            }
        } catch (err) {
            console.error('Fetch blocked users error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnblock = (targetId: number, username: string) => {
        const confirmContent = `Are you sure you want to unblock ${username}?`;

        const performUnblock = async () => {
            try {
                const res = await fetch(
                    `${Config.API_URL}/users/handle_relationship.php`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: user?.id,
                            target_id: targetId,
                            action: 'unblock',
                        }),
                    }
                );

                if (res.ok) {
                    setBlockedUsers(prev =>
                        prev.filter(u => u.id !== targetId)
                    );

                    const successMsg = `${username} has been unblocked.`;
                    if (Platform.OS === 'android') {
                        const { ToastAndroid } = require('react-native');
                        ToastAndroid.show(successMsg, ToastAndroid.SHORT);
                    } else if (Platform.OS === 'web') {
                        window.alert(successMsg);
                    } else {
                        Alert.alert('Success', successMsg);
                    }
                } else {
                    Alert.alert('Error', 'Failed to unblock user');
                }
            } catch (err) {
                Alert.alert('Error', 'Network error');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Unblock User: ${confirmContent}`)) {
                performUnblock();
            }
        } else {
            Alert.alert(
                'Unblock User',
                confirmContent,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Unblock',
                        style: 'destructive',
                        onPress: performUnblock,
                    },
                ]
            );
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <GlassCard style={styles.card}>
            <View style={styles.row}>
                <View style={styles.userInfo}>
                    <Avatar
                        source={getAvatarById(item.avatar_id)}
                        size={48}
                        online={false}
                    />

                    <View style={styles.userDetails}>
                        <ThemedText
                            type="defaultSemiBold"
                            numberOfLines={1}
                            style={styles.username}
                        >
                            {item.username}
                        </ThemedText>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.unblockButton}
                    onPress={() => handleUnblock(item.id, item.username)}
                    activeOpacity={0.85}
                >
                    <ThemedText style={styles.unblockText}>Unblock</ThemedText>
                </TouchableOpacity>
            </View>
        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.headerTitle}>
                    Blocked Contacts
                </ThemedText>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : blockedUsers.length === 0 ? (
                <View style={styles.emptyState}>
                    <UserX size={64} color={Colors.textSecondary} />
                    <ThemedText style={styles.emptyText}>
                        No blocked contacts
                    </ThemedText>
                </View>
            ) : (
                <FlatList
                    data={blockedUsers}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    /* Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
    },
    backBtn: {
        marginRight: 12,
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
    },

    /* List */
    list: {
        padding: 16,
    },

    card: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        marginBottom: 10,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 64,
    },

    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },

    userDetails: {
        marginLeft: 12,
        justifyContent: 'center',
    },

    username: {
        fontSize: 16,
        fontWeight: '600',
    },

    unblockButton: {
        height: 36,
        paddingHorizontal: 18,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },

    unblockText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },

    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.7,
    },

    emptyText: {
        marginTop: 12,
        fontSize: 18,
        color: Colors.textSecondary,
    },
});
