import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { SearchInput } from '../../components/SearchInput';
import { MessageSquare, MoreVertical, UserPlus, Clock } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

export default function FriendsScreen() {
    const { user: currentUser } = useUser();
    const [users, setUsers] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sentRequests, setSentRequests] = React.useState<Set<string>>(new Set());

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
        }, [fetchUsers])
    );

    const filteredUsers = React.useMemo(() => {
        return users.filter(user =>
            user.username.toLowerCase().includes(searchQuery.toLowerCase())
            // Removed email search for privacy
        );
    }, [users, searchQuery]);

    const handleSendRequest = (userId: string) => {
        // Logic to send request
        // For now, update local state to show 'Pending' UI immediately
        setSentRequests(prev => new Set(prev).add(userId));
        Alert.alert('Request Sent', 'Friend request sent successfully.');
        // TODO: Call API to create friend request
    };

    const renderItem = ({ item }: { item: any }) => {
        const isPending = sentRequests.has(item.id) || item.relationship_status === 'pending';
        const isFriend = item.relationship_status === 'accepted';

        return (
            <View style={styles.cardContainer}>
                <View style={styles.neonCard}>
                    <View style={styles.row}>
                        <Avatar source={getAvatarById(item.avatar_id)} online={item.is_online} size={48} />
                        <View style={styles.info}>
                            <ThemedText type="defaultSemiBold" style={styles.username}>{item.username}</ThemedText>
                            {/* Removed Email for Privacy */}
                            {/* Optional: Show mutuals or bio if available */}
                        </View>

                        {isFriend ? (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.chatButton]}
                                onPress={() => router.push({
                                    pathname: '/chat/[id]',
                                    params: { id: item.id, user: item.username, avatar_id: item.avatar_id }
                                })}
                            >
                                <MessageSquare size={18} color={Colors.white} />
                                <ThemedText style={styles.btnText}>Chat</ThemedText>
                            </TouchableOpacity>
                        ) : isPending ? (
                            <View style={[styles.actionButton, styles.pendingButton]}>
                                <Clock size={16} color={Colors.textSecondary} />
                                <ThemedText style={[styles.btnText, styles.textPending]}>Pending</ThemedText>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.requestButton]}
                                onPress={() => handleSendRequest(item.id)}
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
});
