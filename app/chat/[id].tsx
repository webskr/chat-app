import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Image as RNImage, Dimensions, AlertButton, Modal } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { ChevronLeft, Send, Image as ImageIcon, Smile, MoreVertical, Heart, ThumbsUp, Laugh, Angry, Frown, Sparkles, User, BellOff, Trash2, UserMinus, ShieldAlert, Flag, Timer, X, Paperclip, Check, CheckCheck, Edit2 } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { getAvatarById } from '../../constants/Avatars';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { OverflowMenu } from '../../components/OverflowMenu';
import { ProfileModal } from '../../components/ProfileModal';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { formatChatTime } from '../../utils/time';
import { EmptyState } from '../../components/EmptyState';
import { MessageSquare, Copy, Trash } from 'lucide-react-native';
import { FullScreenImageModal } from '../../components/FullScreenImageModal';
import { ImageEditorModal } from '../../components/ImageEditorModal';

import { ChatLockService } from '../../utils/ChatLockService';
import { Lock, Unlock } from 'lucide-react-native';

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
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const isAtBottomRef = useRef(true);
    const flatListRef = useRef<FlatList>(null);
    const scrollOffset = useRef(0);

    const appState = useRef(AppState.currentState);

    // Socket & Typing Refs
    const socket = useRef<Socket | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);

    const [modalVisible, setModalVisible] = useState(false);
    const [targetUserProfile, setTargetUserProfile] = useState<any>(null);
    const [msgMenuVisible, setMsgMenuVisible] = useState(false);
    const [msgMenuAnchor, setMsgMenuAnchor] = useState({ x: 0, y: 0 });
    const [msgMenuMessage, setMsgMenuMessage] = useState<any>(null);
    const [failedMessages, setFailedMessages] = useState<any[]>([]);

    const recentMessages = useRef<number[]>([]);

    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);

    // Chat Lock State
    const [isLocked, setIsLocked] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showLockSetup, setShowLockSetup] = useState(false);
    const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
    const [lockPin, setLockPin] = useState('');
    const [unlockPin, setUnlockPin] = useState('');
    const [isCheckingLock, setIsCheckingLock] = useState(true);

    useEffect(() => {
        checkLockStatus();
    }, [id]);

    const checkLockStatus = async () => {
        if (!id) return;
        setIsCheckingLock(true);
        const locked = await ChatLockService.isChatLocked(String(id));
        setIsLocked(locked);
        // If locked, we need to authenticate. If not locked, we are authenticated by default.
        setIsAuthenticated(!locked);
        setIsCheckingLock(false);
    };

    const [editorImageUri, setEditorImageUri] = useState<string | null>(null);

    const [isEditorVisible, setIsEditorVisible] = useState(false);

    const [messageOptionsVisible, setMessageOptionsVisible] = useState(false);
    const [selectedMessageForOptions, setSelectedMessageForOptions] = useState<any>(null);
    const [editingMessage, setEditingMessage] = useState<any>(null);

    const updateLastSeen = async () => {
        if (!currentUser) return;
        try {
            await fetch(`${Config.API_URL}/users/update_last_seen.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id })
            });
        } catch (e) {
            console.error("Last seen update error", e);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            checkLockStatus();
            fetchMessages();
            fetchRelationshipStatus();
            fetchTargetUserProfile();
            updateLastSeen();
            loadLastScrollPosition();

            const handleAppStateChange = async (nextAppState: any) => {
                if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                    // App has come to the foreground!
                    setIsLoading(true);
                    await fetchMessages();
                    await updateLastSeen();
                    // Sync message states logic if needed, but fetchMessages handles latest
                    setIsLoading(false);
                }
                appState.current = nextAppState;
            };

            const subscription = AppState.addEventListener('change', handleAppStateChange);

            const interval = setInterval(() => {
                if (AppState.currentState === 'active') {
                    fetchMessages();
                    updateLastSeen();
                }
            }, 3000);

            return () => {
                subscription.remove();
                clearInterval(interval);
                saveLastScrollPosition();
            };
            return () => {
                subscription.remove();
                clearInterval(interval);
                saveLastScrollPosition();
            };
        }, [id, currentUser])
    );

    // Socket Initialization
    useEffect(() => {
        if (!currentUser || !id) return;

        // Initialize Socket
        socket.current = io(Config.SOCKET_URL);

        const roomId = `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

        socket.current.emit('join_room', roomId);

        socket.current.on('typing_start', ({ user }: { user: string }) => {
            if (String(user) === String(id)) {
                setIsTyping(true);
            }
        });

        socket.current.on('typing_stop', ({ user }: { user: string }) => {
            if (String(user) === String(id)) {
                setIsTyping(false);
            }
        });

        socket.current.on('message_edited', ({ message_id, new_text }: { message_id: number, new_text: string }) => {
            setMessages(prev => prev.map(m =>
                m.id === message_id ? { ...m, message_text: new_text, is_edited: true, edited_at: new Date().toISOString() } : m
            ));
        });

        return () => {
            socket.current?.disconnect();
        };
    }, [id, currentUser]);

    const handleTyping = (text: string) => {
        setInputText(text);

        if (!socket.current || !currentUser) return;

        const roomId = `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

        // Emit start typing if not empty
        if (text.length > 0) {
            socket.current.emit('typing_start', { room: roomId, user: currentUser.id });

            // Clear existing timeout
            if (typingTimeout.current) clearTimeout(typingTimeout.current);

            // Set new timeout to stop typing after 2 seconds of inactivity
            typingTimeout.current = setTimeout(() => {
                socket.current?.emit('typing_stop', { room: roomId, user: currentUser.id });
            }, 2000);
        } else {
            // Immediately stop if text is empty
            if (typingTimeout.current) clearTimeout(typingTimeout.current);
            socket.current.emit('typing_stop', { room: roomId, user: currentUser.id });
        }
    };


    const saveLastScrollPosition = async () => {
        if (!id) return;
        try {
            await AsyncStorage.setItem(`last_scroll_${id}`, String(scrollOffset.current));
            await AsyncStorage.setItem('last_chat_id', id);
            await AsyncStorage.setItem('last_chat_other', otherUsername || '');
            await AsyncStorage.setItem('last_chat_avatar', avatar_id || '');
        } catch (e) {
            console.error("Error saving scroll position", e);
        }
    };

    const loadLastScrollPosition = async () => {
        if (!id) return;
        try {
            const pos = await AsyncStorage.getItem(`last_scroll_${id}`);
            if (pos && flatListRef.current) {
                // We might need to wait for messages to load before scrolling
                setTimeout(() => {
                    flatListRef.current?.scrollToOffset({ offset: parseFloat(pos), animated: false });
                }, 500);
            }
        } catch (e) {
            console.error("Error loading scroll position", e);
        }
    };

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
        if (!currentUser) {
            console.log("FETCH MESSAGES: currentUser is null");
            setIsLoading(false);
            return;
        }

        const url = `${Config.API_URL}/chat/get_messages.php?sender_id=${currentUser.id}&receiver_id=${id}`;
        try {
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                setMessages(data);

                // Check if there are messages from the other user that need status update
                // ONLY mark as seen if the app is active
                if (AppState.currentState === 'active') {
                    const hasUnseen = data.some((m: any) => String(m.sender_id) === String(id) && m.status !== 'seen');
                    if (hasUnseen) {
                        updateMessageStatus('seen');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateMessageStatus = async (status: 'delivered' | 'seen') => {
        if (!currentUser) return;
        try {
            await fetch(`${Config.API_URL}/chat/update_status.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,      // Me (Receiver)
                    sender_id: id,                // Them (Sender)
                    status: status
                })
            });
            // We don't strictly need to do anything on success, the next poll will update the UI
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleSend = async (text: string = inputText, imagePath: string | null = null, isRetry = false) => {
        if (!currentUser) {
            Alert.alert('Error', 'No user found');
            return;
        }

        const messageText = text.trim();
        if (!messageText && !imagePath) return;

        // Rate Limit Check
        const now = Date.now();
        recentMessages.current = recentMessages.current.filter(t => now - t < 60000);
        if (recentMessages.current.length >= 20) {
            if (Platform.OS === 'android') {
                const { ToastAndroid } = require('react-native');
                ToastAndroid.show('Slow down! Too many messages.', ToastAndroid.SHORT);
            } else {
                Alert.alert('Slow Down', 'You are sending messages too fast.');
            }
            return;
        }
        recentMessages.current.push(now);

        if (messageText.length > 5000) {
            Alert.alert('Too Long', 'Message cannot exceed 5000 characters.');
            return;
        }

        if (!imagePath) setInputText('');
        setIsSending(true);

        // Optimistic UID for local tracking
        const tempId = Date.now();
        const newMessage = {
            id: tempId,
            sender_id: currentUser.id,
            receiver_id: id,
            message_text: messageText,
            media_url: imagePath,
            status: 'sending',
            created_at: new Date().toISOString(),
            is_local: true
        };

        if (isRetry) {
            setFailedMessages(prev => prev.filter(m => m.message_text !== messageText || m.media_url !== imagePath));
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${Config.API_URL}/chat/send_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: currentUser.id,
                    receiver_id: id,
                    message: messageText,
                    image_path: imagePath
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                isAtBottomRef.current = true;
                fetchMessages();
            } else {
                const data = await response.json();
                if (response.status === 429) {
                    Alert.alert('Rate Limit', 'Too many messages. Please wait.');
                } else {
                    setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed' }]);
                }
                if (!imagePath) setInputText(messageText);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed' }]);
            if (!imagePath) setInputText(messageText);
        } finally {
            setIsSending(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false, // We use our own editor now
                quality: 0.8,
            });

            console.log('IMAGE PICKER RESULT:', result);

            if (!result.canceled && result.assets && result.assets.length > 0) {
                // Open Editor instead of sending directly
                setEditorImageUri(result.assets[0].uri);
                setIsEditorVisible(true);
            }
        } catch (e) {
            console.error('PICKER ERROR:', e);
        }
    };

    const handleEditorSend = async (uri: string) => {
        setIsEditorVisible(false);
        // Upload and send the edited image
        // Create a fake asset object to reuse uploadImage logic
        const asset = {
            uri: uri,
            type: 'image/jpeg',
            fileName: uri.split('/').pop() || 'edited_image.jpg',
            mimeType: 'image/jpeg'
        };
        await uploadImage(asset);
        setEditorImageUri(null);
    };

    // Removed the old pickImage helper since we don't need the alert anymore

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
        handleTyping(inputText + emoji);
    };

    const handleEditMessage = (message: any) => {
        setEditingMessage(message);
        setInputText(message.message_text);
        if (flatListRef.current) {
            // Optional: scroll to message?
        }
    };

    const handleCancelEdit = () => {
        setEditingMessage(null);
        setInputText('');
    };

    const handleSaveEdit = async () => {
        if (!editingMessage || !inputText.trim()) return;

        const originalText = editingMessage.message_text;
        const newText = inputText.trim();

        if (originalText === newText) {
            handleCancelEdit();
            return;
        }

        // Optimistic Update
        setMessages(prev => prev.map(m =>
            m.id === editingMessage.id ? { ...m, message_text: newText, is_edited: true, edited_at: new Date().toISOString() } : m
        ));

        handleCancelEdit();

        try {
            const response = await fetch(`${Config.API_URL}/chat/edit_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message_id: editingMessage.id,
                    user_id: currentUser?.id,
                    new_text: newText
                })
            });

            if (response.ok) {
                // Socket emit
                if (socket.current) {
                    const roomId = `chat_${Math.min(Number(currentUser?.id), Number(id))}_${Math.max(Number(currentUser?.id), Number(id))}`;
                    socket.current.emit('edit_message', {
                        room: roomId,
                        message_id: editingMessage.id,
                        new_text: newText
                    });
                }
            } else {
                Alert.alert('Error', 'Failed to save edit.');
                // Revert?
                setMessages(prev => prev.map(m =>
                    m.id === editingMessage.id ? { ...m, message_text: originalText, is_edited: false } : m
                ));
            }
        } catch (error) {
            console.error('Error editing message:', error);
            Alert.alert('Error', 'Network error.');
            // Revert
            setMessages(prev => prev.map(m =>
                m.id === editingMessage.id ? { ...m, message_text: originalText, is_edited: false } : m
            ));
        }
    };

    const handleDeleteMessage = (msgId: number, deleteType: 'for_me' | 'everyone' = 'everyone') => {
        const title = deleteType === 'everyone' ? 'Delete for Everyone' : 'Delete for Me';
        const message = deleteType === 'everyone'
            ? 'Are you sure? This will remove the message for all participants.'
            : 'This message will be removed from your view only.';

        Alert.alert(
            title,
            message,
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
                                    user_id: currentUser?.id,
                                    delete_type: deleteType
                                })
                            });

                            if (response.ok) {
                                if (deleteType === 'everyone') {
                                    // Update local state for "Everyone" (soft delete placeholder)
                                    setMessages(prev => prev.map(m =>
                                        m.id === msgId ? { ...m, is_deleted: 1, message_text: '🚫 This message was deleted', media_url: null } : m
                                    ));
                                } else {
                                    // Remove from local state for "For Me" (hidden filtering is done on server, but we can optimistically remove)
                                    setMessages(prev => prev.filter(m => m.id !== msgId));
                                }

                                const successMsg = deleteType === 'everyone' ? 'Message deleted for everyone.' : 'Message removed from your view.';
                                if (Platform.OS === 'android') {
                                    const { ToastAndroid } = require('react-native');
                                    ToastAndroid.show(successMsg, ToastAndroid.SHORT);
                                } else {
                                    // Alert.alert('Success', successMsg);
                                }
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

    const handleMessageLongPress = (message: any) => {
        if (message.is_deleted) return;
        setSelectedMessageForOptions(message);
        setMessageOptionsVisible(true);
    };

    const handleScroll = (event: any) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const paddingToBottom = 50; // Larger padding for better reliability
        const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
        isAtBottomRef.current = isNearBottom;
        scrollOffset.current = contentOffset.y;
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
                    onPress: async (reason?: string) => {
                        try {
                            const response = await fetch(`${Config.API_URL}/users/report_user.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    reporter_id: currentUser?.id,
                                    reported_id: id,
                                    reason: reason || ''
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

    const getMessageMenuItems = (message: any) => {
        if (!message) return [];
        const isMe = String(message.sender_id) === String(currentUser?.id);
        const options = [
            {
                label: 'Copy Text',
                icon: Copy,
                onPress: () => { Clipboard.setStringAsync(message.message_text || ''); }
            },
            {
                label: 'Delete for Me',
                icon: Trash,
                destructive: true,
                onPress: () => handleDeleteMessage(message.id, 'for_me')
            }
        ];
        if (isMe) {
            if (!message.media_url && !message.is_deleted) {
                options.push({
                    label: 'Edit',
                    icon: Edit2,
                    onPress: () => handleEditMessage(message)
                });
            }
            options.push({
                label: 'Delete for Everyone',
                icon: Trash2,
                destructive: true,
                onPress: () => handleDeleteMessage(message.id, 'everyone')
            });
        }
        return options;
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

    const handleLockSetup = () => {
        setShowLockSetup(true);
        setMenuVisible(false);
    };

    const handleUnlockSetup = () => {
        setShowUnlockPrompt(true);
        setMenuVisible(false);
    };

    const handleConfirmLock = async () => {
        if (lockPin.length < 4) {
            Alert.alert('Error', 'PIN must be at least 4 digits');
            return;
        }
        await ChatLockService.lockChat(String(id), lockPin);
        setIsLocked(true);
        setIsAuthenticated(true); // Don't lock them out immediately after setting
        setShowLockSetup(false);
        setLockPin('');
        Alert.alert('Success', 'Chat locked successfully.');
    };

    const handleConfirmUnlock = async () => {
        const isValid = await ChatLockService.verifyPin(String(id), unlockPin);
        if (isValid) {
            await ChatLockService.unlockChat(String(id));
            setIsLocked(false);
            setIsAuthenticated(true);
            setShowUnlockPrompt(false);
            setUnlockPin('');
            Alert.alert('Success', 'Chat unlocked.');
        } else {
            Alert.alert('Error', 'Incorrect PIN');
            setUnlockPin('');
        }
    };

    // For the initial unlock screen handling
    const handleEntryUnlock = async () => {
        const isValid = await ChatLockService.verifyPin(String(id), unlockPin);
        if (isValid) {
            setIsAuthenticated(true);
            setUnlockPin('');
        } else {
            Alert.alert('Error', 'Incorrect PIN');
            setUnlockPin('');
        }
    };

    const menuItems = [
        { label: 'View Profile', icon: User, onPress: handleViewProfile },
        { label: isLocked ? 'Unlock Chat' : 'Lock Chat', icon: isLocked ? Unlock : Lock, onPress: isLocked ? handleUnlockSetup : handleLockSetup },
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
        // Any other message related logic, but SCROLLING IS HANDLED BY onContentSizeChange now.
    }, [messages.length]);

    const renderMessage = ({ item, index }: { item: any, index: number }) => {
        const isMe = String(item.sender_id) === String(currentUser?.id);
        const isSelfChat = String(id) === String(currentUser?.id);
        const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

        const isLastInGroup = !nextMessage ||
            String(nextMessage.sender_id) !== String(item.sender_id) ||
            new Date(nextMessage.created_at).getTime() - new Date(item.created_at).getTime() > 60000;

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
                        onLongPress={() => handleMessageLongPress(item)}
                        {...({
                            onContextMenu: (e: any) => {
                                if (Platform.OS === 'web') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const { clientX, clientY } = e as any;
                                    setMsgMenuAnchor({ x: clientX, y: clientY });
                                    setMsgMenuMessage(item);
                                    setMsgMenuVisible(true);
                                }
                            }
                        } as any)}
                        delayLongPress={300}
                        activeOpacity={0.8}
                        style={[
                            styles.bubble,
                            isMe ? styles.myBubble : styles.friendBubble,
                            !isLastInGroup && (isMe ? styles.myBubbleGroup : styles.friendBubbleGroup),
                            item.media_url ? styles.imageBubble : null
                        ]}
                    >
                        {item.media_url ? (
                            <TouchableOpacity
                                onPress={() => {
                                    setFullScreenImage(`${Config.API_URL}/${item.media_url.replace(/^\//, '')}`);
                                    setIsFullScreenVisible(true);
                                }}
                                onLongPress={() => handleMessageLongPress(item)}
                                delayLongPress={300}
                                activeOpacity={0.9}
                            >
                                <RNImage
                                    source={{ uri: `${Config.API_URL}/${item.media_url.replace(/^\//, '')}` }}
                                    style={[styles.messageImage, { width: 220, height: 280 }]}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ) : null}

                        {item.message_text ? (
                            <ThemedText style={[styles.messageText, item.is_deleted && { fontStyle: 'italic', opacity: 0.7 }]}>{item.message_text}</ThemedText>
                        ) : null}
                    </TouchableOpacity>

                    {isLastInGroup && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 2 }}>
                            <ThemedText numberOfLines={1} style={[styles.messageTime, isMe ? styles.myMessageTime : styles.friendMessageTime, { marginRight: isMe ? 4 : 0 }]}>
                                {formatChatTime(item.created_at)}
                                {item.is_edited && <ThemedText style={{ fontSize: 9, marginLeft: 4, fontStyle: 'italic', color: Colors.textSecondary }}>edited</ThemedText>}
                            </ThemedText>
                            {isMe && (
                                <View style={{ marginLeft: 2 }}>
                                    {item.status === 'seen' ? (
                                        <CheckCheck size={16} color={Colors.primary || '#474747ff'} />
                                    ) : item.status === 'delivered' ? (
                                        <CheckCheck size={16} color={Colors.textSecondary || '#8E8E93'} />
                                    ) : item.status === 'sending' ? (
                                        <Timer size={14} color={Colors.textSecondary} />
                                    ) : item.status === 'failed' ? (
                                        <TouchableOpacity onPress={() => handleSend(item.message_text, item.media_url, true)}>
                                            <ShieldAlert size={16} color={Colors.accent} />
                                        </TouchableOpacity>
                                    ) : (
                                        <Check size={16} color={Colors.textSecondary || '#8E8E93'} />
                                    )}
                                </View>
                            )}
                        </View>
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
                        source={getAvatarById(targetUserProfile?.avatar_id || avatar_id || id)}
                        online={!!targetUserProfile?.last_seen && (new Date().getTime() - new Date(targetUserProfile.last_seen).getTime() < 60000)}
                        size={40}
                    />
                    <View style={styles.nameContainer}>
                        <ThemedText type="defaultSemiBold">
                            {String(id) === String(currentUser?.id) ? 'Note to self' : otherUsername}
                        </ThemedText>

                        <ThemedText type="caption" style={{ color: String(id) === String(currentUser?.id) ? Colors.secondary : (isTyping ? Colors.primary : (targetUserProfile?.last_seen && (new Date().getTime() - new Date(targetUserProfile.last_seen).getTime() < 60000) ? Colors.online : Colors.textSecondary)) }}>
                            {String(id) === String(currentUser?.id)
                                ? 'Personal Space'
                                : isTyping
                                    ? 'Typing...'
                                    : targetUserProfile?.last_seen
                                        ? (new Date().getTime() - new Date(targetUserProfile.last_seen).getTime() < 60000
                                            ? 'Online'
                                            : `Last seen ${formatChatTime(targetUserProfile.last_seen)}`)
                                        : 'Recently active'}
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

            {isCheckingLock ? (
                <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Timer size={32} color={Colors.primary} />
                </View>
            ) : !isLocked || isAuthenticated ? (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
                >
                    <FlatList
                        ref={flatListRef}
                        data={[...messages, ...failedMessages]}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderMessage}
                        style={{ flex: 1 }}
                        contentContainerStyle={[styles.listContent, messages.length === 0 && { flex: 1 }, { paddingBottom: 20 }]}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        onContentSizeChange={() => {
                            if (isAtBottomRef.current) {
                                flatListRef.current?.scrollToEnd({ animated: true });
                            }
                        }}
                        ListEmptyComponent={
                            !isLoading ? (
                                <EmptyState
                                    icon={MessageSquare}
                                    title="No messages yet"
                                    message={`Me: ${currentUser?.id || '?'}, Partner: ${id}. Waiting for messages... 👋`}
                                />
                            ) : null
                        }
                        showsVerticalScrollIndicator={false}
                    />

                    {/* Input Area */}
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
                                {editingMessage ? (
                                    <TouchableOpacity style={styles.iconButton} onPress={handleCancelEdit}>
                                        <X size={22} color={Colors.error || '#FF3B30'} />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.iconButton} onPress={handlePickImage} disabled={isUploading}>
                                        <Paperclip size={22} color={Colors.textSecondary} />
                                    </TouchableOpacity>
                                )}

                                <TextInput
                                    style={styles.input}
                                    placeholder={editingMessage ? "Edit message..." : "Type something..."}
                                    placeholderTextColor={Colors.textSecondary}
                                    value={inputText}
                                    onChangeText={handleTyping}
                                    multiline
                                    maxLength={5000}
                                    onFocus={() => setShowEmojiPicker(false)}
                                />

                                <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => editingMessage ? handleSaveEdit() : handleSend(inputText)}
                                    disabled={!inputText.trim() || isSending || isUploading}
                                >
                                    {editingMessage ? (
                                        <Check
                                            size={22}
                                            color={(inputText.trim()) ? Colors.primary : Colors.textSecondary}
                                        />
                                    ) : (
                                        <Send
                                            size={22}
                                            color={(inputText.trim() && !isSending && !isUploading) ? Colors.primary : Colors.textSecondary}
                                            fill={(inputText.trim() && !isSending && !isUploading) ? Colors.primary : 'transparent'}
                                        />
                                    )}
                                </TouchableOpacity>
                            </GlassCard>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            ) : (
                <View style={styles.lockScreenContainer}>
                    <Lock size={64} color={Colors.primary} style={styles.lockIcon} />
                    <ThemedText type="subtitle" style={styles.lockTitle}>Chat Locked</ThemedText>
                    <ThemedText style={styles.lockSubtitle}>Enter PIN to view this chat</ThemedText>

                    <TextInput
                        style={styles.pinInput}
                        placeholder="Enter PIN"
                        placeholderTextColor={Colors.textSecondary}
                        value={unlockPin}
                        onChangeText={setUnlockPin}
                        keyboardType="numeric"
                        secureTextEntry
                        maxLength={4}
                        onSubmitEditing={handleEntryUnlock}
                        autoFocus
                    />
                    <TouchableOpacity style={styles.unlockButton} onPress={handleEntryUnlock}>
                        <ThemedText style={styles.unlockButtonText}>Unlock</ThemedText>
                    </TouchableOpacity>
                </View>
            )}

            {/* Lock Setup Modal */}
            <Modal
                transparent={true}
                visible={showLockSetup}
                animationType="fade"
                onRequestClose={() => setShowLockSetup(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: Colors.surface, borderColor: Colors.glassBorder }]}>
                        <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Set Chat PIN</ThemedText>
                        <ThemedText style={{ color: Colors.textSecondary, marginBottom: 15, textAlign: 'center' }}>
                            Create a secure PIN to lock this chat context.
                        </ThemedText>

                        <TextInput
                            style={[styles.pinInput, { marginBottom: 20 }]}
                            placeholder="Enter 4-digit PIN"
                            placeholderTextColor={Colors.textSecondary}
                            value={lockPin}
                            onChangeText={setLockPin}
                            keyboardType="numeric"
                            secureTextEntry
                            maxLength={4}
                            autoFocus
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.modalOption, styles.modalCancel, { flex: 1 }]} onPress={() => setShowLockSetup(false)}>
                                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalOption, { backgroundColor: Colors.primary, flex: 1, justifyContent: 'center' }]}
                                onPress={handleConfirmLock}
                            >
                                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Lock Chat</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Unlock Prompt Modal (Generic use) */}
            <Modal
                transparent={true}
                visible={showUnlockPrompt}
                animationType="fade"
                onRequestClose={() => setShowUnlockPrompt(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: Colors.surface, borderColor: Colors.glassBorder }]}>
                        <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Authentication Required</ThemedText>
                        <ThemedText style={{ color: Colors.textSecondary, marginBottom: 15, textAlign: 'center' }}>
                            Enter PIN to unlock settings.
                        </ThemedText>
                        <TextInput
                            style={[styles.pinInput, { marginBottom: 20 }]}
                            placeholder="Enter PIN"
                            placeholderTextColor={Colors.textSecondary}
                            value={unlockPin}
                            onChangeText={setUnlockPin}
                            keyboardType="numeric"
                            secureTextEntry
                            maxLength={4}
                            autoFocus
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.modalOption, styles.modalCancel, { flex: 1 }]} onPress={() => setShowUnlockPrompt(false)}>
                                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalOption, { backgroundColor: Colors.primary, flex: 1, justifyContent: 'center' }]}
                                onPress={handleConfirmUnlock}
                            >
                                <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Verify</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <OverflowMenu
                visible={msgMenuVisible}
                onClose={() => setMsgMenuVisible(false)}
                items={getMessageMenuItems(msgMenuMessage)}
                anchor={msgMenuAnchor}
            />

            <FullScreenImageModal
                visible={isFullScreenVisible}
                imageUri={fullScreenImage}
                onClose={() => setIsFullScreenVisible(false)}
            />

            <ImageEditorModal
                visible={isEditorVisible}
                imageUri={editorImageUri}
                onClose={() => setIsEditorVisible(false)}
                onSend={handleEditorSend}
            />

            {/* Custom Message Options Modal */}
            <Modal
                transparent={true}
                visible={messageOptionsVisible}
                animationType="fade"
                onRequestClose={() => setMessageOptionsVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setMessageOptionsVisible(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: Colors.surface, borderColor: Colors.glassBorder }]}>
                        <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Message Options</ThemedText>

                        {String(selectedMessageForOptions?.sender_id) === String(currentUser?.id) && !selectedMessageForOptions?.media_url && !selectedMessageForOptions?.is_deleted && (
                            <TouchableOpacity style={styles.modalOption} onPress={() => {
                                setMessageOptionsVisible(false);
                                handleEditMessage(selectedMessageForOptions);
                            }}>
                                <Edit2 size={20} color={Colors.text} />
                                <ThemedText style={styles.modalOptionText}>Edit Message</ThemedText>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.modalOption} onPress={() => {
                            Clipboard.setStringAsync(selectedMessageForOptions?.message_text || '');
                            setMessageOptionsVisible(false);
                        }}>
                            <Copy size={20} color={Colors.text} />
                            <ThemedText style={styles.modalOptionText}>Copy Text</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalOption} onPress={() => {
                            setMessageOptionsVisible(false);
                            setTimeout(() => handleDeleteMessage(selectedMessageForOptions?.id, 'for_me'), 100);
                        }}>
                            <Trash size={20} color="#EF4444" />
                            <ThemedText style={[styles.modalOptionText, { color: '#EF4444' }]}>Delete for Me</ThemedText>
                        </TouchableOpacity>

                        {String(selectedMessageForOptions?.sender_id) === String(currentUser?.id) && (
                            <TouchableOpacity style={styles.modalOption} onPress={() => {
                                setMessageOptionsVisible(false);
                                setTimeout(() => handleDeleteMessage(selectedMessageForOptions?.id, 'everyone'), 100);
                            }}>
                                <Trash2 size={20} color="#EF4444" />
                                <ThemedText style={[styles.modalOptionText, { color: '#EF4444' }]}>Delete for Everyone</ThemedText>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.modalOption, styles.modalCancel]} onPress={() => setMessageOptionsVisible(false)}>
                            <X size={20} color={Colors.textSecondary} />
                            <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView >
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
    imageBubble: {
        padding: 0,
        paddingHorizontal: 4,
        paddingVertical: 4,
        paddingBottom: 1,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 8,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        // maxWidth: 00,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        gap: 12,
    },
    modalTitle: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 10,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        paddingVertical: 14,
        paddingHorizontal: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
    },
    modalOptionText: {
        fontSize: 16,
        color: Colors.text,
        fontWeight: '500',
    },
    modalCancel: {
        backgroundColor: 'transparent',
        justifyContent: 'center',
        marginTop: 5,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    modalCancelText: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
    lockScreenContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: Colors.background,
    },
    lockIcon: {
        marginBottom: 20,
    },
    lockTitle: {
        marginBottom: 10,
    },
    lockSubtitle: {
        color: Colors.textSecondary,
        marginBottom: 30,
        textAlign: 'center',
    },
    pinInput: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        borderRadius: 12,
        padding: 16,
        fontSize: 20,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 4,
    },
    unlockButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 25,
    },
    unlockButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
