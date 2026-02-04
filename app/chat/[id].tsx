import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Image as RNImage, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { ChevronLeft, Send, Image as ImageIcon, Smile, MoreVertical, Heart, ThumbsUp, Laugh, Angry, Frown, Sparkles, User, BellOff, Trash2, UserMinus, ShieldAlert, Flag, Timer, X, Paperclip } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { OverflowMenu } from '../../components/OverflowMenu';
import { ProfileModal } from '../../components/ProfileModal';
import * as ImagePicker from 'expo-image-picker';

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '✨', '👋', '🙏', '🎉', '💩', '🍔', '🍕'];

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
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [targetUserProfile, setTargetUserProfile] = useState<any>(null);

    useEffect(() => {
        fetchMessages();
        fetchRelationshipStatus();
        fetchTargetUserProfile(); // New fetch for full profile (bio etc)
        // Polling for new messages every 3 seconds
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [id]);

    const fetchTargetUserProfile = async () => {
        // Fetch specific user details including bio
        // Since get_users.php returns all or filtered, we can reuse it filtering by ID or just use what we have?
        // get_users.php?user_id=ME returns everyone ELSE.
        // We probably need a way to get specific user info clearly.
        // get_users.php returns u.id, u.bio etc.
        // Let's filter client side from get_users? heavy.
        // Better: create get_user_profile.php or just use get_users.php and filter.
        // For now, let's try to find them in get_users list.
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`);
            const data = await response.json();
            if (response.ok) {
                const found = data.find((u: any) => String(u.id) === String(id));
                if (found) {
                    setTargetUserProfile(found);
                } else if (String(id) === String(currentUser.id)) {
                    // Self chat
                    setTargetUserProfile({ ...currentUser, bio: 'Note to self' });
                }
            }
        } catch (e) {
            console.error("Profile fetch error", e);
        }
    };

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
            // Alert.alert('Fetch Error', 'Failed to load messages. Please ensure your database is updated.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (text: string = inputText, imagePath: string | null = null) => {
        if (!currentUser) {
            Alert.alert('Error', 'No user found');
            return;
        }

        if (text.trim() || imagePath) {
            const messageToSend = text.trim();
            if (!imagePath) setInputText(''); // Clear input immediately if text only

            try {
                const response = await fetch(`${Config.API_URL}/chat/send_message.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender_id: currentUser.id,
                        receiver_id: id,
                        message: messageToSend,
                        image_path: imagePath
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

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            console.log('IMAGE PICKER RESULT:', result);

            if (!result.canceled && result.assets && result.assets.length > 0) {
                await uploadImage(result.assets[0]);
            }
        } catch (e) {
            console.error('PICKER ERROR:', e);
        }
    };

    const uploadImage = async (asset: any) => {
        setIsUploading(true);
        console.log('STARTING IMAGE UPLOAD');
        console.log("Asset URI:", asset.uri);
        console.log("Asset MimeType:", asset.mimeType);

        const formData = new FormData();
        const uri = asset.uri;
        // filename prioritization: asset.fileName -> distinct name from URI -> default
        const filename = asset.fileName || uri.split('/').pop() || 'upload.jpg';

        // MimeType is CRITICAL for separate parts in specific android versions
        // If asset.mimeType is null, try to deduce, otherwise default to image/jpeg
        let type = asset.mimeType;
        if (!type) {
            const match = /\.(\w+)$/.exec(filename);
            type = match ? `image/${match[1]}` : `image/jpeg`;
        }

        console.log("Form Data - Name:", filename, "Type:", type);

        // Append as specific object for RN
        if (Platform.OS === 'web') {
            try {
                const res = await fetch(uri);
                const blob = await res.blob();
                formData.append('image', blob, filename);
            } catch (e) {
                console.error("Web Blob conversion failed:", e);
                setIsUploading(false);
                return;
            }
        } else {
            formData.append('image', {
                uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                name: filename,
                type: type
            } as any);
        }

        // Custom Filename Params
        if (currentUser?.id) {
            formData.append('sender_id', String(currentUser.id));
        }
        formData.append('receiver_id', String(id));

        const uploadUrl = `${Config.API_URL}/chat/upload_image.php`;
        console.log('UPLOAD URL:', uploadUrl);

        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                },
            });

            console.log("Response status:", response.status);
            const text = await response.text();
            console.log('UPLOAD RESPONSE (RAW):', text);

            let data;
            try {
                data = JSON.parse(text);
                console.log('UPLOAD RESPONSE (JSON):', data);
            } catch (e) {
                console.error("JSON Parse error:", e);
                Alert.alert('Upload Error', 'Server returned invalid response');
                return;
            }

            if (response.ok && data.success !== false) {
                console.log('IMAGE UPLOADED, SENDING MESSAGE...');
                // Send message with image path
                await handleSend(inputText, data.media_url);
                console.log('IMAGE MESSAGE SENT');
                setInputText('');
            } else {
                console.error('UPLOAD FAILED LOGICALLY:', data);
                Alert.alert('Upload Failed', data.message || 'Could not upload image');
            }
        } catch (error) {
            console.error('UPLOAD NETWORK ERROR:', error);
            Alert.alert('Error', 'Failed to upload image. Check network.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setInputText(prev => prev + emoji);
    };

    const handleViewProfile = () => {
        setModalVisible(true);
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
                                    m.id === msgId ? { ...m, is_deleted: 1, message_text: '🚫 This message was deleted', image_path: null } : m
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
        const performClear = async () => {
            try {
                const response = await fetch(`${Config.API_URL}/chat/clear_msgs.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: currentUser?.id,
                        target_id: id,
                        sender_id: currentUser?.id,
                        receiver_id: id
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    setMessages([]);
                    if (Platform.OS === 'web') {
                        alert('Messages deleted successfully from database.');
                    } else {
                        Alert.alert('Success', 'Messages deleted from database.');
                    }
                } else {
                    const errorMsg = data.message || 'Failed to clear messages';
                    if (Platform.OS === 'web') {
                        alert('Error: ' + errorMsg);
                    } else {
                        Alert.alert('Server Error', errorMsg);
                    }
                }
            } catch (error) {
                console.error('Error clearing chat:', error);
                const networkMsg = 'Could not reach server. Check backend connection.';
                if (Platform.OS === 'web') {
                    alert('Network Error: ' + networkMsg);
                } else {
                    Alert.alert('Network Error', networkMsg);
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to clear your chat history? This will delete all messages from DB.')) {
                performClear();
            }
        } else {
            Alert.alert(
                'Clear Messages',
                'Are you sure you want to clear your chat history?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: performClear }
                ]
            );
        }
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
        const actionText = isBlocked ? 'Unblock' : 'Block';
        const confirmMessage = isBlocked ? `Unblock ${otherUsername}?` : `Block ${otherUsername}? They won't be able to message you.`;

        const performBlock = async () => {
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
                    const successMsg = `${otherUsername} has been ${isBlocked ? 'unblocked' : 'blocked'}.`;

                    if (Platform.OS === 'android') {
                        const { ToastAndroid } = require('react-native');
                        ToastAndroid.show(successMsg, ToastAndroid.SHORT);
                    } else if (Platform.OS === 'web') {
                        window.alert(successMsg);
                    } else {
                        Alert.alert('Success', successMsg);
                    }

                    if (!isBlocked) router.back();
                } else {
                    Alert.alert('Error', 'Action failed. Please try again.');
                }
            } catch (error) {
                console.error('Error blocking:', error);
                Alert.alert('Error', 'Network error occurred.');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${actionText} User: ${confirmMessage}`)) {
                performBlock();
            }
        } else {
            Alert.alert(
                `${actionText} User`,
                confirmMessage,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: actionText,
                        style: 'destructive',
                        onPress: performBlock
                    }
                ]
            );
        }
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
                        {item.media_url ? (
                            <RNImage
                                source={{ uri: `${Config.API_URL}/${item.media_url.replace(/^\//, '')}` }}
                                style={[styles.messageImage, { width: 220, height: 280 }]}
                                resizeMode="cover"
                            />
                        ) : null}

                        {item.message_text ? (
                            <ThemedText style={[styles.messageText, item.is_deleted && { fontStyle: 'italic', opacity: 0.7 }]}>{item.message_text}</ThemedText>
                        ) : null}
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
                <TouchableOpacity
                    style={styles.headerInfo}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.7}
                >
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
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton} onPress={() => setMenuVisible(true)}>
                    <MoreVertical size={24} color={Colors.text} />
                </TouchableOpacity>

                <OverflowMenu
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    items={menuItems}
                />
            </View>

            <ProfileModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                user={targetUserProfile || { id, username: otherUsername, avatar_id: avatar_id || '1' }}
                currentUser={currentUser}
                relationship={String(id) === String(currentUser?.id) ? 'self' : (relationshipStatus as any) || 'none'}
                onActionComplete={() => {
                    fetchRelationshipStatus();
                    // If blocked/unfriendly, maybe go back? For now just refresh status.
                }}
            />

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={[styles.inputContainer]}>
                    {showEmojiPicker && (
                        <GlassCard style={styles.inputEmojiPicker}>
                            <View style={styles.inputEmojiRow}>
                                {EMOJIS.map(emoji => (
                                    <TouchableOpacity
                                        key={emoji}
                                        onPress={() => handleEmojiSelect(emoji)}
                                        style={styles.inputEmojiButton}
                                    >
                                        <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                                    <X size={20} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </GlassCard>
                    )}

                    <View style={styles.inputArea}>
                        <GlassCard
                            style={styles.inputWrapper}
                            contentContainerStyle={styles.inputContent}
                            intensity={30}
                        >
                            <TouchableOpacity style={styles.iconButton} onPress={handlePickImage} disabled={isUploading}>
                                <Paperclip size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>

                            <TextInput
                                style={styles.input}
                                placeholder="Type something..."
                                placeholderTextColor={Colors.textSecondary}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                maxLength={500}
                                onFocus={() => setShowEmojiPicker(false)}
                            />

                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => handleSend(inputText)}
                                disabled={!inputText.trim()}
                            >
                                <Send
                                    size={22}
                                    color={inputText.trim() ? Colors.primary : Colors.textSecondary}
                                    fill={inputText.trim() ? Colors.primary : 'transparent'}
                                />
                            </TouchableOpacity>
                        </GlassCard>
                    </View>
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
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
    },
    inputWrapper: {
        borderRadius: 25,
        overflow: 'hidden',
        backgroundColor: Colors.surface, // Or Colors.white if you want strictly white
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    inputContent: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    iconButton: {
        padding: 10,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: 16,
        maxHeight: 100,
        paddingVertical: 0,
        paddingHorizontal: 8,
        textAlignVertical: 'center',
    },
    // Removed old sendButton styles as it is now an icon
    messageImage: {
        borderRadius: 12,
        marginBottom: 4,
    },
    inputContainer: {
        width: '100%',
    },
    inputEmojiPicker: {
        marginBottom: 10,
        marginHorizontal: 16,
        padding: 10,
        borderRadius: 16,
    },
    inputEmojiRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
    },
    inputEmojiButton: {
        padding: 5,
    },
});
