import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { SearchInput } from '../../components/SearchInput';
import { MessageSquare, MoreVertical, UserPlus, Clock, Check, X } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

export default function GlobalFriendsScreen() {
    const { user: currentUser } = useUser();
    const [users, setUsers] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');

    const fetchUsers = React.useCallback(async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`);
            const data = await response.json();
            if (response.ok) {
                // Mocking relationship status for valid UI demonstration if backend doesn't send it yet
                const dataWithStatus = data.map((u: any) => ({
                    ...u,
                    relationship_status: u.relationship_status || 'none'
                }));
                setUsers(dataWithStatus);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    useFocusEffect(
        React.useCallback(() => {
            fetchUsers();

            // Auto-refresh every 5 seconds for "real-time" experience
            const interval = setInterval(() => {
                fetchUsers();
            }, 5000);

            return () => clearInterval(interval);
        }, [fetchUsers])
    );

    const filteredUsers = React.useMemo(() => {
        return users.filter(user =>
            user.relationship_status !== 'accepted' &&
            user.username.toLowerCase().includes(searchQuery.toLowerCase())
            // Removed email search for privacy
        );
    }, [users, searchQuery]);

    const handleAction = async (targetId: string, action: 'friend' | 'accept' | 'decline' | 'unsend') => {
        if (!currentUser) return;
        const backendAction = action === 'unsend' ? 'decline' : action;
        try {
            const response = await fetch(`${Config.API_URL}/users/handle_relationship.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    target_id: targetId,
                    action: backendAction
                })
            });
            if (response.ok) {
                if (action === 'friend') Alert.alert('Success', 'Friend request sent!');
                else if (action === 'accept') Alert.alert('Success', 'Friend request accepted!');
                else if (action === 'unsend') Alert.alert('Success', 'Friend request unsent!');
                fetchUsers();
            }
        } catch (error) {
            console.error('Error handling relationship:', error);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isReceived = item.relationship_status === 'request_received';
        const isSent = item.relationship_status === 'pending';
        const isFriend = item.relationship_status === 'accepted';
        const userBorderColor = item.border_color || '#10B981';
        const userButtonColor = item.button_color || '#10B981';

        return (
            <View style={styles.cardContainer}>
                <View style={[
                    styles.neonCard,
                    {
                        borderColor: userBorderColor,
                        backgroundColor: `${userBorderColor}20`,
                        shadowColor: userBorderColor,
                        opacity: .9,
                    }
                ]}>
                    <View style={styles.row}>
                        <Avatar
                            source={item.avatar_url ? `${Config.API_URL}/${item.avatar_url}` : getAvatarById(item.avatar_id)}
                            online={item.is_online}
                            size={48}
                        />
                        <View style={styles.info}>
                            <ThemedText type="defaultSemiBold" style={styles.username}>{item.username}</ThemedText>
                        </View>

                        {isFriend ? (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.chatButton]}
                                onPress={() => router.push({
                                    pathname: '/chat/[id]',
                                    params: {
                                        id: item.id,
                                        user: item.username,
                                        avatar_id: item.avatar_id,
                                        avatar_url: item.avatar_url // Pass it here
                                    }
                                })}
                            >
                                <MessageSquare size={18} color={Colors.white} />
                                <ThemedText style={styles.btnText}>Chat</ThemedText>
                            </TouchableOpacity>
                        ) : isReceived ? (
                            <View style={styles.multiActions}>
                                <TouchableOpacity
                                    style={[styles.smallActionBtn, styles.acceptBtn]}
                                    onPress={() => handleAction(item.id, 'accept')}
                                >
                                    <Check size={16} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.smallActionBtn, styles.declineBtn]}
                                    onPress={() => handleAction(item.id, 'decline')}
                                >
                                    <X size={16} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ) : isSent ? (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.pendingButton]}
                                onPress={() => handleAction(item.id, 'unsend')}
                            >
                                <Clock size={16} color={Colors.textSecondary} />
                                <ThemedText style={[styles.btnText, styles.textPending]}>Unsend</ThemedText>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.requestButton, { backgroundColor: userButtonColor }]}
                                onPress={() => handleAction(item.id, 'friend')}
                            >
                                <UserPlus size={18} color={Colors.white} />
                                <ThemedText style={styles.btnText}>Add</ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <ThemedText type="title" style={styles.headerTitle}>Vegarm</ThemedText>
                <TouchableOpacity onPress={() => {/* More options */ }}>
                    <MoreVertical size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
                <SearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search people..."
                />
            </View>
            <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 0.5,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
        gap: 12, // Slightly increased gap for neon cards to breathe
    },
    cardContainer: {
        // No overflow hidden here to let potential outer glow breathe if added, 
        // but for inner border style we keep it clean.
        borderRadius: 16,
    },
    neonCard: {
        // Base styles that are overridden dynamically
        // backgroundColor: 'rgba(3, 103, 39, 0.08)', // Inner glow simulation: translucent primary tint
        borderRadius: 16,
        borderWidth: 1.5, // Slightly thicker for neon effect
        // borderColor: 'rgba(3, 103, 39, 0.6)', // Brighter/Visible border
        paddingVertical: 12,
        paddingHorizontal: 16,
        // Outer glow to complement the inner feel
        // shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    info: {
        flex: 1,
        justifyContent: 'center',
    },
    username: {
        fontSize: 16,
        color: Colors.text,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    chatButton: {
        backgroundColor: Colors.primary,
    },
    requestButton: {
        backgroundColor: Colors.primary,
    },
    pendingButton: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    btnText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.white,
    },
    textPending: {
        color: Colors.textSecondary,
    },
    multiActions: {
        flexDirection: 'row',
        gap: 8,
    },
    smallActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    acceptBtn: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    declineBtn: {
        backgroundColor: Colors.surface,
        borderColor: Colors.glassBorder,
    },
});
