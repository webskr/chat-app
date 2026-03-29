import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Send, Search, CheckCircle, Circle } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../ThemedText';
import { Avatar } from '../../Avatar';
import { SearchInput } from '../../SearchInput';
import { getAvatarById } from '../../../constants/Avatars';
import { useUser } from '../../../context/UserContext';
import { Config } from '../../../constants/Config';

export default function ForwardSelectionScreen() {
    const { user: currentUser } = useUser();
    const { messageIds, initialText } = useLocalSearchParams<{ messageIds: string, initialText?: string }>();

    const [chats, setChats] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_conversations.php?user_id=${currentUser.id}`);
            const data = await response.json();
            if (response.ok) {
                setChats(data);
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleForward = async () => {
        if (selectedIds.length === 0 || isSending || !currentUser) return;

        setIsSending(true);
        try {
            const idsList = messageIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];

            if (idsList.length === 0) {
                alert('No messages to forward');
                setIsSending(false);
                return;
            }

            // Loop through each message and send it to all selected receivers
            // This ensures compatibility if backend only accepts single 'message_id'
            const promises = idsList.map(id =>
                fetch(`${Config.API_URL}/chat/forward_message.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender_id: currentUser.id,
                        receiver_ids: selectedIds, // Array of receivers
                        message_id: id // Single message ID
                    })
                })
            );

            const responses = await Promise.all(promises);
            const allOk = responses.every(r => r.ok);

            if (allOk) {
                if (selectedIds.length === 1) {
                    const target = chats.find(c => c.other_user_id === selectedIds[0]);
                    router.replace({
                        pathname: '/chat/[id]',
                        params: {
                            id: selectedIds[0].toString(),
                            user: target?.other_username || 'User',
                            avatar_id: target?.other_avatar_id
                        }
                    });
                } else {
                    router.dismissAll();
                    router.push('/(tabs)');
                }
            } else {
                console.error('Some requests failed', responses.map(r => r.status));
                alert('Failed to forward some messages');
            }
        } catch (error) {
            console.error('Forward error:', error);
            alert('An error occurred while forwarding');
        } finally {
            setIsSending(false);
        }
    };

    const filteredChats = chats.filter(chat =>
        chat.other_username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }: { item: any }) => {
        const isSelected = selectedIds.includes(item.other_user_id);
        return (
            <TouchableOpacity
                style={styles.chatItem}
                onPress={() => toggleSelection(item.other_user_id)}
                activeOpacity={0.7}
            >
                <View style={styles.chatRow}>
                    <Avatar source={getAvatarById(item.other_avatar_id)} size={45} />
                    <View style={styles.chatDetails}>
                        <ThemedText type="defaultSemiBold" style={styles.username}>
                            {item.other_username}
                        </ThemedText>
                    </View>
                    {isSelected ? (
                        <CheckCircle size={24} color={Colors.primary} fill={Colors.primary + '20'} />
                    ) : (
                        <Circle size={24} color={Colors.textSecondary} opacity={0.5} />
                    )}
                </View>
                <View style={styles.divider} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={28} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <ThemedText type="subtitle">Forward to...</ThemedText>
                    {selectedIds.length > 0 && (
                        <ThemedText style={styles.selectionCount}>
                            {selectedIds.length} selected
                        </ThemedText>
                    )}
                </View>
            </View>

            <View style={styles.searchContainer}>
                <SearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search users..."
                />
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredChats}
                    keyExtractor={(item) => item.other_user_id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {selectedIds.length > 0 && (
                <TouchableOpacity
                    style={[styles.forwardButton, isSending && styles.forwardButtonDisabled]}
                    onPress={handleForward}
                    disabled={isSending}
                >
                    {isSending ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Send size={24} color="#fff" />
                    )}
                </TouchableOpacity>
            )}
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
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    backButton: {
        padding: 4,
        marginLeft: -8,
    },
    headerTextContainer: {
        flex: 1,
    },
    selectionCount: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: '600',
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
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    chatDetails: {
        flex: 1,
    },
    username: {
        fontSize: 16,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.glassBorder,
        marginLeft: 73,
        opacity: 0.3,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    forwardButton: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    forwardButtonDisabled: {
        opacity: 0.7,
    },
});
