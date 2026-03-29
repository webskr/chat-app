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
import { MessageSquare, Megaphone, Star, X, Trash2, Pin, PinOff, BellOff, CheckSquare, Lock, Eraser, Check } from 'lucide-react-native';
import { GroupDefaultIcon } from '../../components/icons/GroupDefaultIcon';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';
import { ChatCategories, ChatCategory } from '../../components/ChatModule/ChatCategories';
import { ApiService } from '../../utils/ApiService';

export default function ChatScreen() {
    const { user, setUnreadCount, safeSync } = useUser();
    const [chats, setChats] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [activeCategory, setActiveCategory] = React.useState<ChatCategory>('All');
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const isSelectionMode = selectedIds.size > 0;

    const fetchConversations = React.useCallback(async (syncWithServer = false) => {
        if (!user) return;
        try {
            // STEP 1: Load from local DB for instant UI
            const localChats = await LocalDatabaseService.getConversations();
            setChats(localChats.map(c => ({
                ...c,
                last_message: c.last_message_preview || c.last_message,
                last_message_time: c.last_message_time_real || c.last_message_time,
                other_is_official: c.other_is_official != null ? Number(c.other_is_official) : 0
            })));

            const totalUnread = localChats.reduce((sum: number, chat: any) => sum + (Number(chat.unread_count) || 0), 0);
            setUnreadCount(totalUnread);
            setIsLoading(false);

            // STEP 2: Background sync from server (Unified Sync)
            if (syncWithServer) {
                await safeSync(); // Use the throttled safeSync instead of calling SyncService directly
                
                // Refresh local UI after sync
                const refreshedChats = await LocalDatabaseService.getConversations();
                setChats(refreshedChats.map(c => ({
                    ...c,
                    last_message: c.last_message_preview || c.last_message,
                    last_message_time: c.last_message_time_real || c.last_message_time,
                    other_is_official: c.other_is_official != null ? Number(c.other_is_official) : 0
                })));
                const refreshUnread = refreshedChats.reduce((sum: number, chat: any) => sum + (Number(chat.unread_count) || 0), 0);
                setUnreadCount(refreshUnread);
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, setUnreadCount, safeSync]);

    useFocusEffect(
        React.useCallback(() => {
            fetchConversations(true); // Sync on focus (via safeSync)

            const interval = setInterval(() => {
                fetchConversations(true);
            }, 60000); 

            return () => clearInterval(interval);
        }, [fetchConversations])
    );

    const filteredChats = React.useMemo(() => {
        return chats.filter(chat => {
            const isGroup = Number(chat.is_group) === 1;
            const displayName = (isGroup ? chat.group_name : (String(chat.other_user_id) === String(user?.id) ? 'Note to self' : chat.other_username)) || 'Unknown';

            // Filter out Unknown chats (typically orphaned or non-friend records)
            if (displayName === 'Unknown' && !isGroup) return false;

            // Category Filter
            if (activeCategory === 'Unread' && !(Number(chat.unread_count) > 0)) return false;
            if (activeCategory === 'Groups' && !isGroup) return false;
            if (activeCategory === 'Favourites' && !(Number(chat.is_favourite) === 1)) return false;

            // Search Filter
            const lowerQuery = searchQuery.toLowerCase();
            const nameMatch = displayName.toLowerCase().includes(lowerQuery);
            const msgMatch = chat.last_message && typeof chat.last_message === 'string' && chat.last_message.toLowerCase().includes(lowerQuery);
            
            return (nameMatch || msgMatch) || !searchQuery;
        });
    }, [chats, searchQuery, activeCategory, user?.id]);

    const toggleFavourite = async (item: any) => {
        const newStatus = !Number(item.is_favourite);
        try {
            // 1. Update Local DB for instant feedback
            await LocalDatabaseService.toggleFavourite(item.id.toString(), newStatus);
            
            // 2. Update State
            setChats(prev => prev.map(c => c.id === item.id ? { ...c, is_favourite: newStatus ? 1 : 0 } : c));

            // 3. Update Sync/Backend
            await ApiService.post(`${Config.API_URL}/chat/toggle_favourite.php`, {
                chat_id: item.id.toString(),
                is_favourite: newStatus
            });
        } catch (error) {
            console.error('[ChatScreen] Failed to toggle favourite:', error);
        }
    };


    const renderItem = ({ item }: { item: any }) => {
        const isGroup = Number(item.is_group) === 1;
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
                onPress={() => {
                    if (isSelectionMode) {
                        toggleSelection(item.id.toString());
                    } else {
                        router.push({
                            pathname: '/chat/[id]',
                            params: {
                                id: isGroup ? item.id?.toString() : item.other_user_id?.toString(),
                                user: displayName,
                                avatar_id: item.other_avatar_id?.toString(),
                                avatar_url: displayAvatar,
                                is_official: item.other_is_official?.toString(),
                                is_group: isGroup ? '1' : '0'
                            }
                        });
                    }
                }}
                onLongPress={() => {
                    if (!isSelectionMode) {
                        toggleSelection(item.id.toString());
                    }
                }}
            >
                <View style={[styles.chatRow, selectedIds.has(item.id.toString()) && styles.selectedRow]}>
                    <View style={styles.avatarContainer}>
                        <Avatar
                            source={displayAvatar ? `${Config.API_URL}/${displayAvatar}` : (isGroup ? undefined : getAvatarById(item.other_avatar_id))}
                            online={!isGroup && item.is_online}
                            size={50}
                            fallbackComponent={isGroup ? <GroupDefaultIcon size={50} /> : undefined}
                        />
                        {selectedIds.has(item.id.toString()) && (
                            <View style={styles.selectionOverlay}>
                                <Check size={20} color="#fff" />
                            </View>
                        )}
                    </View>
                    <View style={styles.chatDetails}>
                        <View style={styles.rowTop}>
                            <View style={styles.nameBadgeContainer}>
                                <ThemedText type="defaultSemiBold" style={styles.username} numberOfLines={1}>
                                    {displayName}
                                </ThemedText>
                                {Number(item.other_is_official) == 1 && (
                                    <BadgeCheck size={16} color={Colors.officialBadgeBorder} fill={Colors.officialBadge} />
                                )}
                                {Number(item.is_favourite) === 1 && (
                                    <Star size={14} color="#e9edef" fill="#e9edef" style={{ marginLeft: 2 }} />
                                )}
                                {Number(item.is_pinned) === 1 && (
                                    <Pin size={14} color={Colors.primary} style={{ marginLeft: 2, transform: [{ rotate: '45deg' }] }} />
                                )}
                                {Number(item.is_muted) === 1 && (
                                    <BellOff size={14} color={Colors.textSecondary} style={{ marginLeft: 2 }} />
                                )}
                                {Number(item.is_locked) === 1 && (
                                    <Lock size={14} color={Colors.textSecondary} style={{ marginLeft: 2 }} />
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

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const selectAll = () => {
        setSelectedIds(new Set(filteredChats.map(c => c.id.toString())));
    };

    const handleBatchAction = async (action: string) => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        
        try {
            // 1. Update Local DB
            switch (action) {
                case 'pin': await LocalDatabaseService.batchUpdateChats(ids, { is_pinned: 1 }); break;
                case 'unpin': await LocalDatabaseService.batchUpdateChats(ids, { is_pinned: 0 }); break;
                case 'favourite': await LocalDatabaseService.batchUpdateChats(ids, { is_favourite: 1 }); break;
                case 'unfavourite': await LocalDatabaseService.batchUpdateChats(ids, { is_favourite: 0 }); break;
                case 'lock': await LocalDatabaseService.batchUpdateChats(ids, { is_locked: 1 }); break;
                case 'unlock': await LocalDatabaseService.batchUpdateChats(ids, { is_locked: 0 }); break;
                case 'mute': await LocalDatabaseService.batchUpdateChats(ids, { is_muted: 1 }); break;
                case 'unmute': await LocalDatabaseService.batchUpdateChats(ids, { is_muted: 0 }); break;
                case 'delete': await LocalDatabaseService.batchDeleteChats(ids); break;
                case 'clear': await LocalDatabaseService.batchClearChats(ids); break;
            }

            // 2. Refresh UI
            fetchConversations(false);
            clearSelection();

            // 3. API Sync
            await ApiService.post(`${Config.API_URL}/chat/batch_actions.php`, {
                chat_ids: ids,
                action: action
            });
        } catch (error) {
            console.error('[ChatScreen] Batch action failed:', action, error);
        }
    };

    const SelectionHeader = () => (
        <View style={styles.selectionHeader}>
            <View style={styles.selectionHeaderLeft}>
                <TouchableOpacity onPress={clearSelection}>
                    <X size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText style={styles.selectionCount}>{selectedIds.size}</ThemedText>
            </View>
            <View style={styles.selectionHeaderRight}>
                <TouchableOpacity onPress={() => handleBatchAction(selectedIds.has(Array.from(selectedIds)[0]) && filteredChats.find(c => c.id.toString() === Array.from(selectedIds)[0])?.is_pinned ? 'unpin' : 'pin')}>
                    <Pin size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleBatchAction('delete')}>
                    <Trash2 size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleBatchAction('mute')}>
                    <BellOff size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={selectAll}>
                    <CheckSquare size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleBatchAction('lock')}>
                    <Lock size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleBatchAction('favourite')}>
                    <Star size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleBatchAction('clear')}>
                    <Eraser size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {isSelectionMode ? <SelectionHeader /> : (
                <View style={styles.header}>
                    <ThemedText type="title" style={styles.headerTitle}>Vegram</ThemedText>

                    <View style={{ flexDirection: 'row', gap: 16 }}>
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
            )}

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
                    style={{ marginBottom: 4 }}
                />
            </View>

            <ChatCategories 
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
            />
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
        paddingBottom: 6,
    },
    headerTitle: {
        fontSize: 24, // WhatsApp uses ~20-23sp for Title
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 0.5,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingBottom: 2,
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
        gap: 4,
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
    },
    selectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
    },
    selectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    selectionCount: {
        fontSize: 20,
        color: Colors.text,
        fontWeight: '600',
    },
    selectionHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    selectedRow: {
        backgroundColor: Colors.primary + '15', // Subtle primary tint
    },
    avatarContainer: {
        position: 'relative',
    },
    selectionOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.background,
    },
});
