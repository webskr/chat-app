import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { GlassCard } from '../../components/GlassCard';
import { SearchInput } from '../../components/SearchInput';
import { router } from 'expo-router';
import { Bookmark, MoreVertical, BadgeCheck } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { useFocusEffect } from 'expo-router';
import { formatChatTime } from '../../utils/time';
import { EmptyState } from '../../components/EmptyState';
import { SyncService } from '../../utils/SyncService';
import { MessageSquare, Megaphone } from 'lucide-react-native';
import { GroupDefaultIcon } from '../../components/icons/GroupDefaultIcon';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';

export default function ChatScreen() {
    const { user, setUnreadCount, safeSync } = useUser();
    const [chats, setChats] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');
    // const hasNavigatedRef = React.useRef(false); // REMOVED

    const fetchConversations = React.useCallback(async (syncWithServer = false) => {
        if (!user) return;
        try {
            // STEP 1: Load from local DB for instant UI
            const localChats = await LocalDatabaseService.getConversations();
            setChats(localChats.map(c => ({
                ...c,
                last_message: c.last_message_preview || c.last_message,
                last_message_time: c.last_message_time_real || c.last_message_time
            })));

            const totalUnread = localChats.reduce((sum: number, chat: any) => sum + (Number(chat.unread_count) || 0), 0);
            setUnreadCount(totalUnread);
            setIsLoading(false);

            // STEP 2: Background sync from server (Unified Sync)
            if (syncWithServer) {
                await SyncService.syncEverything(user.id);
                // Refresh local UI after sync
                const refreshedChats = await LocalDatabaseService.getConversations();
                setChats(refreshedChats.map(c => ({
                    ...c,
                    last_message: c.last_message_preview || c.last_message,
                    last_message_time: c.last_message_time_real || c.last_message_time
                })));
                const refreshUnread = refreshedChats.reduce((sum: number, chat: any) => sum + (Number(chat.unread_count) || 0), 0);
                setUnreadCount(refreshUnread);
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, setUnreadCount]);

    useFocusEffect(
        React.useCallback(() => {
            fetchConversations(true); // Sync on focus
            if (user) safeSync();

            // Instead of 10s polling, we rely on WebSockets (handled by UserContext/safeSync)
            // and the 30s heartbeat in SyncService if implemented.
            // For now, let's keep a very slow fallback polling (e.g. 60s) or remove it.
            const interval = setInterval(() => {
                fetchConversations(true);
            }, 60000); // Reduced polling to 60s as a safety fallback

            return () => clearInterval(interval);
        }, [fetchConversations, user, safeSync])
    );

    const filteredChats = React.useMemo(() => {
        return chats.filter(chat => {
            const nameMatch = chat.other_username && chat.other_username.toLowerCase().includes(searchQuery.toLowerCase());
            const msgMatch = chat.last_message && chat.last_message.toLowerCase().includes(searchQuery.toLowerCase());
            return nameMatch || msgMatch;
        });
    }, [chats, searchQuery]);


    const renderItem = ({ item }: { item: any }) => {
        const isGroup = item.is_group == 1;
        const displayName = (isGroup ? item.group_name : (String(item.other_user_id) === String(user?.id) ? 'Note to self' : item.other_username)) || 'Unknown';
        const displayAvatar = isGroup ? item.group_icon : item.other_avatar_url; // Group icon is path, user avatar_url is path
        // For groups, other_avatar_id is 0. 
        // Logic for Avatar component: 
        // source={uri} or id={id}
        // If isGroup, we use source with full URL if icon exists, else default group icon? 
        // Let's assume passed to Avatar component.

        return (
            <TouchableOpacity
                style={styles.chatItem}
                activeOpacity={0.7}
                onPress={() => router.push({
                    pathname: '/chat/[id]',
                    params: {
                        id: isGroup ? item.id?.toString() : item.other_user_id?.toString(),
                        user: displayName,
                        avatar_id: item.other_avatar_id?.toString(),
                        avatar_url: displayAvatar,
                        is_official: item.other_is_official?.toString(),
                        is_group: isGroup ? '1' : '0'
                    }
                })}
            >
                <View style={styles.chatRow}>
                    <Avatar
                        source={displayAvatar ? `${Config.API_URL}/${displayAvatar}` : (isGroup ? undefined : getAvatarById(item.other_avatar_id))}
                        online={!isGroup && item.is_online}
                        size={50}
                        fallbackComponent={isGroup ? <GroupDefaultIcon size={50} /> : undefined}
                    />
                    <View style={styles.chatDetails}>
                        <View style={styles.rowTop}>
                            <View style={styles.nameBadgeContainer}>
                                <ThemedText type="defaultSemiBold" style={styles.username} numberOfLines={1}>
                                    {displayName}
                                </ThemedText>
                                {!isGroup && item.other_is_official == 1 && (
                                    <BadgeCheck size={16} color={Colors.background} fill={Colors.verifiedBackground} />
                                )}
                            </View>
                            <ThemedText style={[styles.time, (item.unread_count > 0 || (item.unread_count_raw > 0)) && styles.timeActive]}>
                                {formatChatTime(item.last_message_time)}
                            </ThemedText>
                        </View>
                        <View style={styles.rowBottom}>
                            <ThemedText
                                numberOfLines={1}
                                style={styles.lastMessage}
                            >
                                {(() => {
                                    if (!item.last_message) return 'No messages yet';

                                    // Handle JSON previews (for E2EE messages)
                                    if (typeof item.last_message === 'string' && item.last_message.startsWith('{') && item.last_message.endsWith('}')) {
                                        try {
                                            const parsed = JSON.parse(item.last_message);
                                            if (parsed.content) return parsed.content;
                                            if (parsed.media) {
                                                const type = parsed.media.type || '';
                                                if (type === 'image') return '📷 Image';
                                                if (type === 'video') return '🎥 Video';
                                                if (type === 'voice' || type === 'audio') return '🎤 Voice Message';
                                                if (type === 'document') return '📄 Document';
                                                return '📎 Attachment';
                                            }
                                        } catch (e) {
                                            // Fallback to raw if parsing fails
                                        }
                                    }
                                    return item.last_message;
                                })()}
                            </ThemedText>

                            {Number(item.unread_count) > 0 && (
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
    };

    const [menuVisible, setMenuVisible] = React.useState(false);

    const onNewGroup = () => {
        setMenuVisible(false);
        router.push('/chat/create_group');
    };

    const onSettings = () => {
        setMenuVisible(false);
        router.push('/(tabs)/settings-tab'); // Match renamed route to avoid conflict
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <ThemedText type="title" style={styles.headerTitle}>Vegarm</ThemedText>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                    {/* Independent Create Group button REMOVED */}

                    {user?.is_official == 1 && (
                        <TouchableOpacity onPress={() => router.push('/broadcast/compose')}>
                            <Megaphone size={22} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setMenuVisible(true)}>
                        <MoreVertical size={22} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Menu Modal */}
            <Modal
                transparent
                visible={menuVisible}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
                    <View style={styles.menuContainer}>
                        <TouchableOpacity style={styles.menuItem} onPress={onNewGroup}>
                            <ThemedText>New group</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={onSettings}>
                            <ThemedText>Settings</ThemedText>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

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
        fontSize: 16,
        marginRight: 4,
        flexShrink: 1, // Allow text to shrink so badge stays visible
    },
    nameBadgeContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    menuContainer: {
        position: 'absolute',
        top: 50,
        right: 10,
        backgroundColor: '#1E1E1E', // Dark menu
        borderRadius: 8,
        padding: 4,
        minWidth: 150,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 1000,
    },
    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    }
});
