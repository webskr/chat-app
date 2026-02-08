import React, { useState, useCallback } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, MoreVertical, Clock } from 'lucide-react-native';

import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { getAvatarById } from '../../constants/Avatars';
import { ProfileModal } from '../../components/ProfileModal';
import { useUser } from '../../context/UserContext';

import { useFocusEffect } from 'expo-router';
import { Config } from '../../constants/Config';

export default function RequestsScreen() {
    const { user } = useUser();
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
    const [requests, setRequests] = useState<{ received: any[], sent: any[] }>({ received: [], sent: [] });
    const [isLoading, setIsLoading] = useState(true);

    const fetchRequests = useCallback(async () => {
        if (!user) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_requests.php?user_id=${user.id}`);
            const data = await response.json();
            if (response.ok) {
                // Ensure data structure is correct
                setRequests({
                    received: data.received || [],
                    sent: data.sent || []
                });
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            fetchRequests();
            const interval = setInterval(fetchRequests, 5000);
            return () => clearInterval(interval);
        }, [fetchRequests])
    );

    const handleAction = async (targetId: string, action: 'accept' | 'decline' | 'unsend') => {
        if (!user) return;

        // Use 'decline' backend action for both declining and unsending (cancelling)
        const backendAction = action === 'unsend' ? 'decline' : action;

        try {
            const response = await fetch(`${Config.API_URL}/users/handle_relationship.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    target_id: targetId,
                    action: backendAction
                })
            });
            if (response.ok) {
                fetchRequests();
                if (action === 'accept') {
                    Alert.alert('Success', 'Friend request accepted!');
                } else if (action === 'unsend') {
                    Alert.alert('Success', 'Friend request unsent!');
                }
            }
        } catch (error) {
            console.error(`Error ${action}ing request:`, error);
        }
    };

    const openProfile = (item: any) => {
        setSelectedUser({
            ...item,
            avatar_id: item.avatar_id,
            created_at: item.created_at
        });
        setModalVisible(true);
    };

    const renderItem = ({ item }: { item: any }) => (
        <GlassCard style={styles.card}>
            <View style={styles.row}>
                <TouchableOpacity
                    style={styles.userInfo}
                    onPress={() => openProfile(item)}
                    activeOpacity={0.7}
                >
                    <Avatar source={getAvatarById(item.avatar_id)} size={46} />

                    <View style={styles.textInfo}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1}>
                            {item.display_name || item.username}
                        </ThemedText>
                        <ThemedText type="caption" style={styles.meta}>
                            @{item.username}
                        </ThemedText>
                    </View>
                </TouchableOpacity>

                <View style={styles.actions}>
                    {activeTab === 'received' ? (
                        <>
                            <TouchableOpacity
                                style={styles.acceptBtn}
                                onPress={() => handleAction(item.id, 'accept')}
                            >
                                <Check size={18} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.declineBtn}
                                onPress={() => handleAction(item.id, 'decline')}
                            >
                                <X size={18} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            style={styles.unsendBtn}
                            onPress={() => handleAction(item.id, 'unsend')}
                        >
                            <Clock size={16} color="#EF4444" style={{ marginRight: 4 }} />
                            <ThemedText style={styles.unsendText}>Unsend</ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </GlassCard>
    );

    const currentData = activeTab === 'received' ? requests.received : requests.sent;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <ThemedText type="title" style={styles.headerTitle}>
                    Requests
                </ThemedText>

                <TouchableOpacity>
                    <MoreVertical size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'received' && styles.activeTab]}
                    onPress={() => setActiveTab('received')}
                >
                    <ThemedText style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
                        Received ({requests.received.length})
                    </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
                    onPress={() => setActiveTab('sent')}
                >
                    <ThemedText style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
                        Sent ({requests.sent.length})
                    </ThemedText>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={currentData}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={{ marginTop: 100, alignItems: 'center' }}>
                            <ThemedText style={{ opacity: 0.6 }}>
                                {activeTab === 'received' ? 'No pending requests' : 'No sent requests'}
                            </ThemedText>
                        </View>
                    }
                />
            )}

            <ProfileModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                user={selectedUser}
                currentUser={user}
                relationship={activeTab === 'received' ? "request_received" : "pending"}
                onActionComplete={fetchRequests}
            />
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 0.5,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 12,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    activeTab: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    activeTabText: {
        color: '#fff',
    },

    /* List */
    list: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },

    card: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 20,
        marginBottom: 12,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },

    textInfo: {
        marginLeft: 12,
        flex: 1,
    },

    meta: {
        marginTop: 2,
        opacity: 0.6,
    },

    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    acceptBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },

    declineBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unsendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    unsendText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
    },
});
