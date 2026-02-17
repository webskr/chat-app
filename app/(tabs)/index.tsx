import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { GlassCard } from '../../components/GlassCard';
import { SearchInput } from '../../components/SearchInput';
import { router } from 'expo-router';
import { Bookmark, MoreVertical } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { useFocusEffect } from 'expo-router';
import { formatChatTime } from '../../utils/time';
import { EmptyState } from '../../components/EmptyState';
import { MessageSquare } from 'lucide-react-native';

export default function ChatScreen() {
    const { user, setUnreadCount } = useUser();
    const [chats, setChats] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');
    // const hasNavigatedRef = React.useRef(false); // REMOVED

    const fetchConversations = React.useCallback(async () => {
        if (!user) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_conversations.php?user_id=${user.id}`);
            const data = await response.json();
            if (response.ok) {
                setChats(data);
                const totalUnread = data.reduce((sum: number, chat: any) => sum + (Number(chat.unread_count) || 0), 0);
                setUnreadCount(totalUnread);
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, setUnreadCount]);

    useFocusEffect(
        React.useCallback(() => {
            fetchConversations();
            markDelivered();

            const interval = setInterval(() => {
                fetchConversations();
                markDelivered();
            }, 5000);

            return () => clearInterval(interval);
        }, [fetchConversations])
    );

    // Auto-redirection logic removed as per user request to always show chat list
    const markDelivered = async () => {
        if (!user) return;
        try {
            await fetch(`${Config.API_URL}/chat/mark_delivered.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            });
        } catch (error) {
            console.error('Error marking delivered:', error);
        }
    };

    const filteredChats = React.useMemo(() => {
        return chats.filter(chat =>
            chat.other_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (chat.last_message && chat.last_message.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [chats, searchQuery]);


    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.chatItem}
            activeOpacity={0.7}
            onPress={() => router.push({
                pathname: '/chat/[id]',
                params: {
                    id: item.other_user_id.toString(),
                    user: String(item.other_user_id) === String(user?.id) ? 'Note to self' : item.other_username,
                    avatar_id: item.other_avatar_id,
                    avatar_url: item.other_avatar_url
                }
            })}
        >
            <View style={styles.chatRow}>
                <Avatar
                    source={item.other_avatar_url ? `${Config.API_URL}/${item.other_avatar_url}` : getAvatarById(item.other_avatar_id)}
                    online={item.is_online}
                    size={50}
                />
                <View style={styles.chatDetails}>
                    <View style={styles.rowTop}>
                        <ThemedText type="defaultSemiBold" style={styles.username} numberOfLines={1}>
                            {String(item.other_user_id) === String(user?.id) ? 'Note to self' : item.other_username}
                        </ThemedText>
                        <ThemedText style={[styles.time, item.unread_count > 0 && styles.timeActive]}>
                            {formatChatTime(item.last_message_time)}
                        </ThemedText>
                    </View>
                    <View style={styles.rowBottom}>
                        <ThemedText
                            numberOfLines={1}
                            style={styles.lastMessage}
                        >
                            {/* Draft: prefix could be handled here if needed */}
                            {item.last_message || 'No messages yet'}
                        </ThemedText>

                        {item.unread_count > 0 && (
                            <View style={styles.badgeContainer}>
                                <ThemedText style={styles.badgeText}>
                                    {item.unread_count}
                                </ThemedText>
                            </View>
                        )}
                    </View>
                </View>
            </View>
            <View style={styles.divider} />
        </TouchableOpacity>
    );

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
                    placeholder="Search..."
                />
            </View>
            <FlatList
                data={filteredChats}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={[styles.listContent, filteredChats.length === 0 && { flex: 1 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    !isLoading ? (
                        <EmptyState
                            icon={MessageSquare}
                            title="No conversations yet"
                            message="Start chatting 🚀"
                        />
                    ) : null
                }
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
        fontSize: 24, // WhatsApp uses ~20-23sp for Title
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 0.5,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    listContent: {
        paddingBottom: 100,
    },
    chatItem: {
        backgroundColor: 'transparent',
    },
    chatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10, // Compact height
        paddingHorizontal: 16,
        gap: 14, // Tighter gap between avatar and text
    },
    chatDetails: {
        flex: 1,
        justifyContent: 'center',
        gap: 2, // Minimal vertical gap
    },
    rowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    rowBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    username: {
        color: Colors.text,
        fontSize: 16, // Standard readable size, slightly bold from defaultSemiBold
        flex: 1,
        marginRight: 8,
    },
    time: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontWeight: '400',
    },
    timeActive: {
        color: Colors.primary, // Green time when unread
        fontWeight: '600',
    },
    lastMessage: {
        color: Colors.textSecondary,
        fontSize: 14,
        flex: 1,
        marginRight: 8,
        lineHeight: 20,
    },
    badgeContainer: {
        backgroundColor: Colors.primary,
        borderRadius: 12, // Circle
        height: 22,
        minWidth: 22, // Ensure uniform circle for single digits
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    badgeText: {
        color: '#000', // Black text on Green badge for contrast (WhatsApp style) or white if background is dark green? 
        // WhatsApp uses nice green with white text usually, or light green with dark text. 
        // Given Colors.primary is #036727ff (Dark Green), White text is better.
        fontSize: 10,
        fontWeight: 'bold',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#454545ff',
        marginLeft: 80, // 16(pad) + 50(avatar) + 14(gap)
        opacity: 0.3,
    },
});
