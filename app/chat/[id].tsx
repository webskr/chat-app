import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { ChevronLeft, Send, Image as ImageIcon, Smile, MoreVertical, Heart, ThumbsUp, Laugh, Angry, Frown, Sparkles, User, BellOff, Trash2, UserMinus, ShieldAlert, Flag } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { OverflowMenu } from '../../components/OverflowMenu';

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '✨'];

export default function ChatDetailScreen() {
    const { id, user: otherUsername, avatar_id } = useLocalSearchParams<{ id: string, user: string, avatar_id: string }>();
    const { user: currentUser } = useUser();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [menuVisible, setMenuVisible] = useState(false);
    const [relationshipStatus, setRelationshipStatus] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        fetchMessages();
        fetchRelationshipStatus();
        // Polling for new messages every 3 seconds
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [id]);

    const fetchRelationshipStatus = async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`);
            const data = await response.json();
            if (response.ok) {
                const otherUser = data.find((u: any) => String(u.id) === String(id));
                if (otherUser) {
                    setRelationshipStatus(otherUser.relationship_status);
                }
            }
        } catch (error) {
            console.error('Error fetching relationship:', error);
        }
    };

    const fetchMessages = async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_messages.php?sender_id=${currentUser.id}&receiver_id=${id}`);
            const data = await response.json();
            if (response.ok) {
                setMessages(data);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
            Alert.alert('Fetch Error', 'Failed to load messages. Please ensure your database is updated.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!currentUser) {
            Alert.alert('Error', 'No user found');
            return;
        }

        if (inputText.trim()) {
            const messageToSend = inputText.trim();
            setInputText(''); // Clear input immediately for better UX

            try {
                const response = await fetch(`${Config.API_URL}/chat/send_message.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender_id: currentUser.id,
                        receiver_id: id,
                        message: messageToSend
                    }),
                });

                if (response.ok) {
                    fetchMessages(); // Refresh messages after sending
                } else {
                    const data = await response.json();
                    Alert.alert('Send Error', data.message || 'Failed to send message');
                }
            } catch (error) {
                console.error('Error sending message:', error);
                Alert.alert('Network Error', error instanceof Error ? error.message : 'Unknown error');
            }
        }
    };

    const handleViewProfile = () => {
        // Logically navigate to profile
        Alert.alert('View Profile', `Opening ${otherUsername}'s profile...`);
    };

    const handleMute = () => {
        const muteOptions = [
            { label: '8 hours', value: '8h' },
            { label: '1 week', value: '1w' },
            { label: 'Always', value: 'always' },
            { label: 'None', value: 'none' }
        ];

        Alert.alert(
            'Mute Notifications',
            'Mute this chat for:',
            muteOptions.map(opt => ({
                text: opt.label,
                onPress: async () => {
                    try {
                        const response = await fetch(`${Config.API_URL}/chat/mute_chat.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: currentUser?.id,
                                target_id: id,
                                duration: opt.value
                            })
                        });
                        if (response.ok) {
                            Alert.alert('Success', `Notifications ${opt.value === 'none' ? 'unmuted' : 'muted'}.`);
                        }
                    } catch (error) {
                        console.error('Error muting:', error);
                    }
                }
            })).concat([{ text: 'Cancel', style: 'cancel' } as any])
        );
    };

    const handleDeleteMessage = (msgId: number) => {
        Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message for everyone?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await fetch(`${Config.API_URL}/chat/delete_message.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    message_id: msgId,
                                    user_id: currentUser?.id
                                })
                            });
                            if (response.ok) {
                                // Update local state immediately
                                setMessages(prev => prev.map(m =>
                                    m.id === msgId ? { ...m, is_deleted: 1, message_text: '🚫 This message was deleted' } : m
                                ));
                                Alert.alert('Success', 'Message deleted.');
                                setSelectedMessageId(null);
                            } else {
                                const data = await response.json();
                                Alert.alert('Error', data.message || 'Failed to delete.');
                            }
                        } catch (error) {
                            console.error('Error deleting message:', error);
                            Alert.alert('Error', 'Network error.');
                        }
                    }
                }
            ]
        );
    };

    const handleClearChat = () => {
        Alert.alert(
            'Clear Messages',
            'Are you sure you want to clear your chat history?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await fetch(`${Config.API_URL}/chat/clear_msgs.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    user_id: currentUser?.id,
                                    target_id: id
                                })
                            });
                            if (response.ok) {
                                setMessages([]); // Clear local UI immediately
                            }
                        } catch (error) {
                            console.error('Error clearing chat:', error);
                            Alert.alert('Error', 'Failed to clear chat.');
                        }
                    }
                }
            ]
        );
    };

    const handleUnfriend = () => {
        Alert.alert(
            'Unfriend',
            `Are you sure you want to remove ${otherUsername} from your friends? The chat will be locked.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unfriend',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await fetch(`${Config.API_URL}/users/handle_relationship.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    user_id: currentUser?.id,
                                    target_id: id,
                                    action: 'unfriend'
                                })
                            });
                            if (response.ok) {
                                setRelationshipStatus(null);
                                Alert.alert('Success', `${otherUsername} is no longer your friend.`);
                            }
                        } catch (error) {
                            console.error('Error unfriending:', error);
                        }
                    }
                }
            ]
        );
    };

    const handleBlockUser = async () => {
        const isBlocked = relationshipStatus === 'blocked';
        Alert.alert(
            isBlocked ? 'Unblock User' : 'Block User',
            isBlocked ? `Unblock ${otherUsername}?` : `Block ${otherUsername}? They won't be able to message you.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isBlocked ? 'Unblock' : 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await fetch(`${Config.API_URL}/users/handle_relationship.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    user_id: currentUser?.id,
                                    target_id: id,
                                    action: isBlocked ? 'unblock' : 'block'
                                })
                            });
                            if (response.ok) {
                                setRelationshipStatus(isBlocked ? null : 'blocked');
                                Alert.alert('Success', `${otherUsername} has been ${isBlocked ? 'unblocked' : 'blocked'}.`);
                                if (!isBlocked) router.back();
                            }
                        } catch (error) {
                            console.error('Error blocking:', error);
                        }
                    }
                }
            ]
        );
    };

    const handleReportUser = () => {
        Alert.prompt(
            'Report User',
            'Please provide a reason for reporting:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Submit',
                    onPress: async (reason) => {
                        try {
                            const response = await fetch(`${Config.API_URL}/users/report_user.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    reporter_id: currentUser?.id,
                                    reported_id: id,
                                    reason: reason
                                })
                            });
                            if (response.ok) {
                                Alert.alert('Success', 'Report submitted. Thank you.');
                            }
                        } catch (error) {
                            console.error('Error reporting:', error);
                        }
                    }
                }
            ]
        );
    };

    const menuItems = [
        { label: 'View Profile', icon: User, onPress: handleViewProfile },
        { label: 'Mute Notifications', icon: BellOff, onPress: handleMute },
        { label: 'Clear Messages', icon: Trash2, onPress: handleClearChat },
        { label: 'Unfriend', icon: UserMinus, onPress: handleUnfriend, destructive: true, hidden: relationshipStatus !== 'accepted' },
        { label: relationshipStatus === 'blocked' ? 'Unblock User' : 'Block User', icon: ShieldAlert, onPress: handleBlockUser, destructive: true },
        { label: 'Report', icon: Flag, onPress: handleReportUser },
    ];

    const handleReaction = async (messageId: number, emoji: string) => {
        if (!currentUser) return;

        try {
            const response = await fetch(`${Config.API_URL}/chat/toggle_reaction.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message_id: messageId,
                    user_id: currentUser.id,
                    emoji: emoji
                }),
            });

            if (response.ok) {
                fetchMessages();
                setSelectedMessageId(null);
            }
        } catch (error) {
            console.error('Error toggling reaction:', error);
        }
    };

    useEffect(() => {
        // Scroll to bottom when messages change
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

    const renderMessage = ({ item, index }: { item: any, index: number }) => {
        const isMe = String(item.sender_id) === String(currentUser?.id);
        const isSelfChat = String(id) === String(currentUser?.id);
        const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

        // WhatsApp grouping logic: Show time only if:
        // 1. It's the last message in the total list
        // 2. The next message is from a different sender
        // 3. The next message is more than 1 minute later
        const isLastInGroup = !nextMessage ||
            String(nextMessage.sender_id) !== String(item.sender_id) ||
            new Date(nextMessage.created_at).getTime() - new Date(item.created_at).getTime() > 60000;

        const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <View key={item.id} style={[styles.messageRow, isMe ? styles.myRow : styles.friendRow]}>
                {!isMe && !isSelfChat && (
                    <View style={styles.avatarPlaceholder}>
                        {isLastInGroup && (
                            <Avatar source={getAvatarById(item.sender_avatar_id || '1')} size={32} style={styles.messageAvatar} />
                        )}
                    </View>
                )}
                <View style={[styles.bubbleWrapper, isMe ? styles.myBubbleWrapper : styles.friendBubbleWrapper]}>
                    <TouchableOpacity
                        onLongPress={() => setSelectedMessageId(item.id)}
                        delayLongPress={300}
                        activeOpacity={0.8}
                        style={[styles.bubble, isMe ? styles.myBubble : styles.friendBubble, !isLastInGroup && (isMe ? styles.myBubbleGroup : styles.friendBubbleGroup)]}
                    >
                        <ThemedText style={[styles.messageText, item.is_deleted && { fontStyle: 'italic', opacity: 0.7 }]}>{item.message_text}</ThemedText>
                    </TouchableOpacity>

                    {isLastInGroup && (
                        <ThemedText numberOfLines={1} style={[styles.messageTime, isMe ? styles.myMessageTime : styles.friendMessageTime]}>
                            {time}
                        </ThemedText>
                    )}

                    {item.reactions && item.reactions.length > 0 && (
                        <View style={[styles.reactionTray, isMe ? styles.myReactionTray : styles.friendReactionTray]}>
                            {Array.from(new Set(item.reactions.map((r: any) => r.emoji))).map((emoji: any) => (
                                <View key={emoji} style={styles.reactionBadge}>
                                    <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                                    <ThemedText style={styles.reactionCount}>
                                        {item.reactions.filter((r: any) => r.emoji === emoji).length}
                                    </ThemedText>
                                </View>
                            ))}
                        </View>
                    )}

                    {selectedMessageId === item.id && (
                        <GlassCard style={styles.emojiPicker}>
                            <View style={styles.emojiRow}>
                                {EMOJIS.map(emoji => (
                                    <TouchableOpacity
                                        key={emoji}
                                        onPress={() => handleReaction(item.id, emoji)}
                                        style={styles.emojiButton}
                                    >
                                        <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                                {isMe && !item.is_deleted && (
                                    <TouchableOpacity
                                        style={[styles.emojiButton, { marginLeft: 8, borderLeftWidth: 1, borderLeftColor: Colors.glassBorder, paddingLeft: 12 }]}
                                        onPress={() => handleDeleteMessage(item.id)}
                                    >
                                        <Trash2 size={20} color={Colors.error || '#FF3B30'} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </GlassCard>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Avatar
                        source={getAvatarById(avatar_id || id)}
                        online={String(id) !== String(currentUser?.id)}
                        size={40}
                    />
                    <View style={styles.nameContainer}>
                        <ThemedText type="defaultSemiBold">
                            {String(id) === String(currentUser?.id) ? 'Note to self' : otherUsername}
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: String(id) === String(currentUser?.id) ? Colors.secondary : Colors.online }}>
                            {String(id) === String(currentUser?.id) ? 'Personal Space' : 'Online'}
                        </ThemedText>
                    </View>
                </View>
                <TouchableOpacity style={styles.moreButton} onPress={() => setMenuVisible(true)}>
                    <MoreVertical size={24} color={Colors.text} />
                </TouchableOpacity>

                <OverflowMenu
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    items={menuItems}
                />
            </View>

            {/* Message List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderMessage}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputArea}>
                    <GlassCard
                        style={styles.inputWrapper}
                        contentContainerStyle={styles.inputContent}
                        intensity={30}
                    >
                        <TouchableOpacity style={styles.iconButton}>
                            <Smile size={22} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Type a message..."
                            placeholderTextColor={Colors.textSecondary}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={500}
                        />

                        <View style={styles.rightIcons}>
                            <TouchableOpacity style={styles.iconButton}>
                                <ImageIcon size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </GlassCard>

                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Send size={20} color={Colors.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
    },
    backButton: {
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    nameContainer: {
        gap: 2,
    },
    moreButton: {
        padding: 4,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        gap: 2, // Tight gap for WhatsApp feel
    },
    messageRow: {
        flexDirection: 'row',
        maxWidth: '100%',
        alignItems: 'flex-end',
        gap: 8,
        marginVertical: 1,
    },
    myRow: {
        alignSelf: 'flex-end',
    },
    friendRow: {
        alignSelf: 'flex-start',
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
    },
    messageAvatar: {
        // Avatar is shown via avatarPlaceholder
    },
    bubbleWrapper: {
        maxWidth: '85%',
        position: 'relative',
    },
    myBubbleWrapper: {
        alignItems: 'flex-end',
    },
    friendBubbleWrapper: {
        alignItems: 'flex-start',
    },
    bubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    myBubble: {
        backgroundColor: Colors.primary,
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
    },
    myBubbleGroup: {
        // Intermediate bubbles in a group
    },
    friendBubble: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
    },
    friendBubbleGroup: {
        // Intermediate bubbles
    },
    reactionTray: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: -8,
        paddingHorizontal: 4,
        zIndex: 10,
    },
    myReactionTray: {
        justifyContent: 'flex-end',
    },
    friendReactionTray: {
        justifyContent: 'flex-start',
    },
    reactionBadge: {
        backgroundColor: Colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        marginHorizontal: 2,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    reactionEmoji: {
        fontSize: 12,
    },
    reactionCount: {
        fontSize: 10,
        color: Colors.text,
        marginLeft: 2,
    },
    emojiPicker: {
        position: 'absolute',
        top: -60,
        right: 0,
        zIndex: 1000,
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    emojiRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    emojiButton: {
        padding: 4,
    },
    emojiText: {
        fontSize: 22,
    },
    messageText: {
        color: Colors.white,
        fontSize: 15,
        lineHeight: 20,
    },
    messageTime: {
        fontSize: 10,
        color: Colors.textSecondary,
        marginTop: 4,
        marginBottom: 8, // Gap after timestamp
    },
    myMessageTime: {
        alignSelf: 'flex-end',
        marginRight: 4,
    },
    friendMessageTime: {
        alignSelf: 'flex-start',
        marginLeft: 4,
    },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
        gap: 10,
        backgroundColor: 'transparent',
    },
    inputWrapper: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
    },
    inputContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 48,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: 16,
        paddingHorizontal: 10,
        paddingTop: Platform.OS === 'ios' ? 8 : 4,
        paddingBottom: Platform.OS === 'ios' ? 8 : 4,
        maxHeight: 120,
    },
    rightIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    sendButtonDisabled: {
        backgroundColor: Colors.surfaceLight,
        opacity: 0.6,
        shadowOpacity: 0,
        elevation: 0,
    },
});
