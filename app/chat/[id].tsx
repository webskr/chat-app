import React, { useState, useRef, useEffect } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, Keyboard, AppState, AlertButton } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { User, BellOff, Trash2, UserMinus, ShieldAlert, Flag, Timer, X, Copy, Trash, MoreVertical, ChevronLeft, MessageSquare, Edit2, Mic, Unlock, Lock, Send, Download } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { formatChatTime } from '../../utils/time';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { EmptyState } from '../../components/EmptyState';
import { FullScreenImageModal } from '../../components/FullScreenImageModal';
import { ImageEditorModal } from '../../components/ImageEditorModal';
import { ChatMediaPanel } from '../../components/ChatMediaPanel';
import { OverflowMenu } from '../../components/OverflowMenu';
import { ChatLockService } from '../../utils/ChatLockService';

// Extracted Features
import { MessageItem } from '../../components/chat/features/MessageItem';
import { ChatHeader } from '../../components/chat/features/ChatHeader';
import { ChatInputBar } from '../../components/chat/features/ChatInputBar';
import { ReplyPreview } from '../../components/chat/features/ReplyPreview';
import { ChatAttachmentPanel } from '../../components/chat/features/ChatAttachmentPanel';
import { ChatLockScreen, LockSetupModal, UnlockPromptModal } from '../../components/chat/features/ChatLockUI';
import { MediaPreviewModal } from '../../components/chat/features/MediaPreviewModal';
import { OneTimeViewerModal } from '../../components/chat/features/OneTimeViewerModal';
import { useVoiceRecording } from '../../components/chat/features/hooks/useVoiceRecording';
import { useChatLock } from '../../components/chat/features/hooks/useChatLock';
import { usePermissions } from '../../components/chat/features/hooks/usePermissions';
import { styles } from '../../components/chat/features/styles';
import { saveMedia } from '../../utils/mediaSaver';
import { ScheduleConfirmationModal } from '../../components/chat/features/ScheduleConfirmationModal';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ChatDetailScreen() {
    const { id, user: otherUsername, avatar_id, avatar_url } = useLocalSearchParams<{ id: string, user: string, avatar_id: string, avatar_url?: string }>();
    const { user: currentUser } = useUser();

    // Core State
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
    const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
    const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
    const isSelectionMode = selectedMessageIds.length > 0;
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [failedMessages, setFailedMessages] = useState<any[]>([]);

    // UI State
    const [menuVisible, setMenuVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [messageOptionsVisible, setMessageOptionsVisible] = useState(false);
    const [selectedMessageForOptions, setSelectedMessageForOptions] = useState<any>(null);
    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
    const [isEditorVisible, setIsEditorVisible] = useState(false);
    const [editorImageUri, setEditorImageUri] = useState<string | null>(null);

    // Media Preview State
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [previewMedia, setPreviewMedia] = useState<{ type: 'image' | 'video' | 'document'; uri: string; name?: string; mimeType?: string; size?: number; duration?: number }[] | null>(null);

    // OTV Viewer State
    const [otvUrl, setOtvUrl] = useState<string | null>(null);
    const [otvType, setOtvType] = useState<'image' | 'video'>('image');
    const [otvVisible, setOtvVisible] = useState(false);



    // Media Panel State
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
    const [isMediaSearching, setIsMediaSearching] = useState(false);
    const isMediaSearchingRef = useRef(false);
    const [panelActiveTab, setPanelActiveTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');

    const [panelHeight, setPanelHeight] = useState(380);

    // Schedule State
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [pendingScheduleTime, setPendingScheduleTime] = useState<Date | null>(null);
    const [pendingScheduleText, setPendingScheduleText] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');

    // Data State
    const [relationshipStatus, setRelationshipStatus] = useState<string | null>(null);
    const [targetUserProfile, setTargetUserProfile] = useState<any>(null);

    // Refs
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const isAtBottomRef = useRef(true);
    const scrollOffset = useRef(0);
    const appState = useRef(AppState.currentState);
    const socket = useRef<Socket | null>(null);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);
    const recentMessages = useRef<number[]>([]);

    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [inputHeight, setInputHeight] = useState(60);
    const [isTyping, setIsTyping] = useState(false);

    // Hooks
    const {
        isLocked, setIsLocked, isAuthenticated, setIsAuthenticated,
        showLockSetup, setShowLockSetup, showUnlockPrompt, setShowUnlockPrompt,
        lockPin, setLockPin, unlockPin, setUnlockPin, isCheckingLock,
        handleConfirmLock, handleConfirmUnlock, handleEntryUnlock
    } = useChatLock(id);

    const {
        recordingStatus, recordingDuration, startRecording, stopRecording, cancelRecording
    } = useVoiceRecording(async (uri, duration) => {
        await uploadVoiceMessage(uri, duration);
    });

    usePermissions();

    // Sync Media Panel Search state
    useEffect(() => {
        if (!isPanelOpen) {
            setIsMediaSearching(false);
            isMediaSearchingRef.current = false;
        }
    }, [isPanelOpen]);

    // Keyboard Listeners
    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
            const height = e.endCoordinates.height;
            if (height > 100) {
                setKeyboardHeight(height);
                setPanelHeight(height);
                if (!isMediaSearchingRef.current) {
                    setIsPanelOpen(false);
                }
            }
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // Initial Data Fetch
    useFocusEffect(
        React.useCallback(() => {
            fetchMessages();
            fetchRelationshipStatus();
            fetchTargetUserProfile();
            updateLastSeen();
            loadLastScrollPosition();

            const handleAppStateChange = async (nextAppState: any) => {
                if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                    setIsLoading(true);
                    // Lazy Trigger: Check for scheduled messages on resume
                    try {
                        await fetch(`${Config.API_URL}/chat/trigger_scheduled.php`);
                    } catch (e) {
                        console.error("Scheduled trigger failed", e);
                    }
                    await fetchMessages();
                    await updateLastSeen();
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
        }, [id, currentUser])
    );

    // Socket Initialization
    useEffect(() => {
        if (!currentUser || !id) return;
        socket.current = io(Config.SOCKET_URL);
        const roomId = `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
        socket.current.emit('join_room', roomId);

        socket.current.on('typing_start', ({ user }: { user: string }) => {
            if (String(user) === String(id)) setIsTyping(true);
        });

        socket.current.on('typing_stop', ({ user }: { user: string }) => {
            if (String(user) === String(id)) setIsTyping(false);
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

    // Handlers & Logic
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

    const fetchMessages = async () => {
        if (!currentUser) return;
        const url = `${Config.API_URL}/chat/get_messages.php?sender_id=${currentUser.id}&receiver_id=${id}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (response.ok) {
                setMessages(data);
                if (AppState.currentState === 'active') {
                    const hasUnseen = data.some((m: any) => String(m.sender_id) === String(id) && m.status !== 'seen');
                    if (hasUnseen) updateMessageStatus('seen');
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
                body: JSON.stringify({ user_id: currentUser.id, sender_id: id, status: status })
            });
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const fetchRelationshipStatus = async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`);
            const data = await response.json();
            if (response.ok) {
                const otherUser = data.find((u: any) => String(u.id) === String(id));
                if (otherUser) setRelationshipStatus(otherUser.relationship_status);
            }
        } catch (error) {
            console.error('Error fetching relationship:', error);
        }
    };

    const fetchTargetUserProfile = async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`);
            const data = await response.json();
            if (response.ok) {
                const found = data.find((u: any) => String(u.id) === String(id));
                if (found) {
                    setTargetUserProfile(found);
                } else if (String(id) === String(currentUser.id)) {
                    setTargetUserProfile({ ...currentUser, bio: 'Note to self' });
                }
            }
        } catch (e) {
            console.error("Profile fetch error", e);
        }
    };

    const handleSend = async (text: string = inputText, imagePath: string | null = null, isRetry = false, isOneTime = false, scheduledAt: Date | null = null) => {
        console.log('handleSend called:', { text, imagePath, isOneTime, scheduledAt });
        if (!currentUser) return;
        const messageText = text.trim();
        if (!messageText && !imagePath) return;

        // Rate Limit
        const now = Date.now();
        recentMessages.current = recentMessages.current.filter(t => now - t < 60000);
        if (recentMessages.current.length >= 20) {
            Alert.alert('Slow Down', 'You are sending messages too fast.');
            return;
        }
        recentMessages.current.push(now);

        if (!imagePath) setInputText('');
        setIsSending(true);

        const tempId = Date.now();
        const newMessage = {
            id: tempId,
            sender_id: currentUser.id,
            receiver_id: id,
            message_text: messageText,
            media_url: imagePath,
            message_type: imagePath ? 'image' : 'text',
            is_local: true,
            reply_to_message_id: replyingToMessage?.id || null,
            is_one_time: isOneTime ? 1 : 0,
            status: scheduledAt ? 'scheduled' : 'sending', // Update status
        };

        // If scheduled, we don't add to messages immediately OR we add it with a special status?
        // Requirement: "Message must NOT appear in chat until delivered."
        // So we should NOT add to `messages` state if scheduled.
        // We can optionally show a toast or feedback.

        if (!scheduledAt) {
            const localMessage = {
                ...newMessage,
                reply_sender_id: replyingToMessage?.sender_id,
                reply_username: replyingToMessage ? (String(replyingToMessage.sender_id) === String(currentUser?.id) ? 'You' : (replyingToMessage.sender_name || 'User')) : null,
                reply_text: replyingToMessage?.message_text,
                reply_type: replyingToMessage?.message_type,
                reply_media_url: replyingToMessage?.media_url
            };
            setMessages(prev => [...prev, localMessage]);
        } else {
            // Provide feedback for scheduled message
            Alert.alert("Scheduled", `Message scheduled for ${formatChatTime(scheduledAt)}`);
            setInputText(''); // Clear input
        }

        setReplyingToMessage(null);

        if (isRetry) {
            setFailedMessages(prev => prev.filter(m => m.message_text !== messageText || m.media_url !== imagePath));
        }

        try {
            const response = await fetch(`${Config.API_URL}/chat/send_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: currentUser.id,
                    receiver_id: id,
                    message: messageText,
                    image_path: imagePath,
                    reply_to_message_id: newMessage.reply_to_message_id,

                    is_one_time: isOneTime ? 1 : 0,
                    scheduled_at: scheduledAt ? scheduledAt.toISOString() : null
                })
            });

            if (response.ok) {
                if (!scheduledAt) {
                    isAtBottomRef.current = true;
                    fetchMessages();
                }
            } else {
                if (!scheduledAt) {
                    setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed' }]);
                    if (!imagePath) setInputText(messageText);
                } else {
                    Alert.alert("Error", "Failed to schedule message.");
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed' }]);
            if (!imagePath) setInputText(messageText);
        } finally {
            setIsSending(false);
        }
    };


    const handleTyping = (text: string) => {
        setInputText(text);
        if (!socket.current || !currentUser) return;
        const roomId = `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
        if (text.length > 0) {
            socket.current.emit('typing_start', { room: roomId, user: currentUser.id });
            if (typingTimeout.current) clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => {
                socket.current?.emit('typing_stop', { room: roomId, user: currentUser.id });
            }, 2000);
        } else {
            if (typingTimeout.current) clearTimeout(typingTimeout.current);
            socket.current.emit('typing_stop', { room: roomId, user: currentUser.id });
        }
    };


    // Media Panel State
    const handleAttachmentSelect = () => {
        Alert.alert('Choose Media Type', '', [
            { text: 'Photo', onPress: handlePickImage },
            { text: 'Video', onPress: handlePickVideo },
            { text: 'Document', onPress: handlePickDocument },
            { text: 'Cancel', style: 'cancel' }
        ]);
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsMultipleSelection: true,
            selectionLimit: 10,
            allowsEditing: false, // Editing not supported for multiple selection usually
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newMediaItems = result.assets.map(asset => {
                const type = asset.type === 'video' ? 'video' : 'image';
                if (type === 'video' && asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
                    Alert.alert('File too large', 'One or more videos exceed the 50MB limit and were skipped.');
                    return null;
                }
                return {
                    type: type as 'image' | 'video',
                    uri: asset.uri,
                    name: asset.fileName || (type === 'video' ? 'video.mp4' : 'image.jpg'),
                    mimeType: asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
                    size: asset.fileSize ?? undefined,
                    duration: asset.duration ?? undefined
                };
            }).filter(item => item !== null) as any[];

            if (newMediaItems.length > 0) {
                setPreviewMedia(newMediaItems);
                setIsPreviewVisible(true);
            }
        }
    };

    const handleLaunchCamera = async () => {
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            setEditorImageUri(result.assets[0].uri);
            setIsEditorVisible(true);
        }
    };

    const handleEditorSend = async (uri: string) => {
        setIsEditorVisible(false);
        const asset = { uri, type: 'image/jpeg', fileName: uri.split('/').pop() || 'edited.jpg' };
        await uploadImage(asset);
        setEditorImageUri(null);
    };

    const uploadImage = async (asset: any) => {
        setIsUploading(true);
        const formData = new FormData();
        const filename = asset.fileName || asset.uri.split('/').pop() || 'upload.jpg';
        if (Platform.OS === 'web') {
            const res = await fetch(asset.uri);
            formData.append('image', await res.blob(), filename);
        } else {
            formData.append('image', { uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''), name: filename, type: asset.type || 'image/jpeg' } as any);
        }
        formData.append('sender_id', String(currentUser?.id));
        formData.append('receiver_id', String(id));

        try {
            const response = await fetch(`${Config.API_URL}/chat/upload_image.php`, { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok && data.success) {
                return { success: true, ...data };
            }
        } catch (e) {
            console.error("Image upload failed", e);
        } finally {
            setIsUploading(false);
        }
        return { success: false };
    };

    const handlePickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsMultipleSelection: true,
            selectionLimit: 10,
            allowsEditing: false,
            quality: 1
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newMediaItems = result.assets.map(asset => {
                if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) return null;
                return {
                    type: 'video',
                    uri: asset.uri,
                    name: asset.fileName || 'video.mp4',
                    mimeType: asset.mimeType || 'video/mp4',
                    size: asset.fileSize ?? undefined,
                    duration: asset.duration ?? undefined
                };
            }).filter(item => item !== null) as any[];

            if (newMediaItems.length > 0) {
                setPreviewMedia(newMediaItems);
                setIsPreviewVisible(true);
            }
        }
    };


    const uploadVideo = async (asset: any) => {
        setIsUploading(true);
        const formData = new FormData();
        const filename = asset.fileName || asset.uri.split('/').pop();
        if (Platform.OS === 'web') {
            const res = await fetch(asset.uri);
            formData.append('video', await res.blob(), filename);
        } else {
            formData.append('video', { uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''), name: filename, type: asset.mimeType || 'video/mp4' } as any);
        }
        formData.append('sender_id', String(currentUser?.id));
        formData.append('receiver_id', String(id));
        if (asset.duration) formData.append('duration', String(Math.ceil(asset.duration / 1000)));

        try {
            const response = await fetch(`${Config.API_URL}/chat/upload_video.php`, { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok && data.success) {
                return { success: true, ...data };
            }
        } catch (e) {
            console.error("Video upload error", e);
        } finally {
            setIsUploading(false);
        }
        return { success: false };
    };

    const handlePickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: ['*/*'], multiple: true });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newMediaItems = result.assets.map(asset => {
                if (asset.size && asset.size > 50 * 1024 * 1024) return null;
                return {
                    type: 'document',
                    uri: asset.uri,
                    name: asset.name,
                    mimeType: asset.mimeType,
                    size: asset.size
                };
            }).filter(item => item !== null) as any[];

            if (newMediaItems.length > 0) {
                setPreviewMedia(newMediaItems);
                setIsPreviewVisible(true);
            }
        }
    };

    const uploadDocument = async (asset: any) => {
        setIsUploading(true);
        const formData = new FormData();
        const filename = asset.name;
        if (Platform.OS === 'web') {
            const res = await fetch(asset.uri);
            formData.append('document', await res.blob(), filename);
        } else {
            formData.append('document', { uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''), name: filename, type: asset.mimeType } as any);
        }
        formData.append('sender_id', String(currentUser?.id));
        formData.append('receiver_id', String(id));

        try {
            const response = await fetch(`${Config.API_URL}/chat/upload_document.php`, { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok && data.success) {
                return { success: true, ...data };
            }
        } catch (e) {
            console.error("Doc upload error", e);
        } finally {
            setIsUploading(false);
        }
        return { success: false };
    };

    const handleMediaPreviewSend = async (caption: string, isOneTime: boolean) => {
        console.log('handleMediaPreviewSend called:', isOneTime);
        if (!previewMedia || previewMedia.length === 0) return;
        setIsPreviewVisible(false);

        const mediaItems = previewMedia; // Capture current state
        setPreviewMedia(null); // Clear state immediately

        // Iterate and send
        for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            const itemCaption = i === 0 ? caption : ''; // Attach caption only to the first item

            let uploadResult;

            if (item.type === 'image') {
                uploadResult = await uploadImage({ uri: item.uri, type: item.mimeType, fileName: item.name });
                if (uploadResult.success) {
                    handleSend(itemCaption, uploadResult.image_path, false, isOneTime);
                }
            } else if (item.type === 'video') {
                uploadResult = await uploadVideo({ uri: item.uri, fileName: item.name, mimeType: item.mimeType, duration: item.duration });
                if (uploadResult.success) {
                    await fetch(`${Config.API_URL}/chat/send_message.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sender_id: currentUser?.id,
                            receiver_id: id,
                            message: itemCaption,
                            video_url: uploadResult.video_path,
                            thumbnail_url: uploadResult.thumbnail_path,
                            file_size: uploadResult.file_size,
                            duration: Math.ceil((item.duration || 0) / 1000),
                            is_one_time: isOneTime ? 1 : 0
                        })
                    });
                }
            } else if (item.type === 'document') {
                uploadResult = await uploadDocument({ uri: item.uri, name: item.name, mimeType: item.mimeType, size: item.size });
                if (uploadResult.success) {
                    await fetch(`${Config.API_URL}/chat/send_message.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sender_id: currentUser?.id,
                            receiver_id: id,
                            message: itemCaption,
                            file_url: uploadResult.file_path,
                            file_size: uploadResult.file_size,
                            file_name: uploadResult.file_name,
                            mime_type: uploadResult.mime_type,
                            is_one_time: isOneTime ? 1 : 0
                        })
                    });
                }
            }
        }
        fetchMessages();
    };

    const uploadVoiceMessage = async (uri: string, duration: number) => {
        setIsUploading(true);
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'voice.m4a';
        if (Platform.OS === 'web') {
            const res = await fetch(uri);
            formData.append('audio', await res.blob(), filename);
        } else {
            formData.append('audio', { uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''), name: filename, type: 'audio/m4a' } as any);
        }
        formData.append('sender_id', String(currentUser?.id));
        formData.append('receiver_id', String(id));
        formData.append('duration', String(duration));

        try {
            const response = await fetch(`${Config.API_URL}/chat/upload_audio.php`, { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok && data.success) {
                await fetch(`${Config.API_URL}/chat/send_message.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sender_id: currentUser?.id, receiver_id: id, audio_url: data.audio_url, duration: duration })
                });
                fetchMessages();
            }
        } catch (error) {
            console.error('Voice upload error', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleGifSelect = async (url: string) => {
        if (!currentUser || !id) return;
        const tempId = Date.now();
        const newMessage = { id: tempId, sender_id: currentUser.id, receiver_id: id, message_text: '', media_url: url, message_type: 'gif', status: 'sending', created_at: new Date().toISOString(), is_local: true };
        setMessages(prev => [...prev, newMessage]);
        try {
            await fetch(`${Config.API_URL}/chat/send_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_id: currentUser.id, receiver_id: id, gif_url: url })
            });
            fetchMessages();
        } catch (error) {
            setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed' }]);
        }
    };

    const handleStickerSend = async (url: string) => {
        if (!currentUser || !id) return;
        const tempId = Date.now();
        const newMessage = { id: tempId, sender_id: currentUser.id, receiver_id: id, message_text: '', media_url: url, message_type: 'sticker', status: 'sending', created_at: new Date().toISOString(), is_local: true };
        setMessages(prev => [...prev, newMessage]);
        try {
            await fetch(`${Config.API_URL}/chat/send_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_id: currentUser.id, receiver_id: id, sticker_url: url })
            });
            fetchMessages();
        } catch (error) {
            setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed' }]);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingMessage || !inputText.trim()) return;
        const originalText = editingMessage.message_text;
        const newText = inputText.trim();
        if (originalText === newText) return handleCancelEdit();
        setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, message_text: newText, is_edited: true } : m));
        handleCancelEdit();
        try {
            const response = await fetch(`${Config.API_URL}/chat/edit_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: editingMessage.id, user_id: currentUser?.id, new_text: newText })
            });
            if (response.ok && socket.current) {
                const roomId = `chat_${Math.min(Number(currentUser?.id), Number(id))}_${Math.max(Number(currentUser?.id), Number(id))}`;
                socket.current.emit('edit_message', { room: roomId, message_id: editingMessage.id, new_text: newText });
            }
        } catch (error) {
            console.error('Save edit failed', error);
        }
    };

    const handleCancelEdit = () => { setEditingMessage(null); setInputText(''); };
    const handleEditMessage = (msg: any) => { setEditingMessage(msg); setInputText(msg.message_text); };

    const handleDeleteMessage = (msgId: number, deleteType: 'for_me' | 'everyone' = 'everyone') => {
        Alert.alert('Delete', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const response = await fetch(`${Config.API_URL}/chat/delete_message.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message_id: msgId, user_id: currentUser?.id, delete_type: deleteType })
                        });
                        if (response.ok) {
                            if (deleteType === 'everyone') {
                                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: 1, message_text: '🚫 This message was deleted', media_url: null } : m));
                            } else {
                                setMessages(prev => prev.filter(m => m.id !== msgId));
                            }
                        }
                    } catch (e) {
                        console.error("Delete error", e);
                    }
                }
            }
        ]);
    };

    const handleRequestSchedule = (date: Date, text: string) => {
        setPendingScheduleTime(date);
        setPendingScheduleText(text);
        setScheduleModalVisible(true);
    };

    const handleConfirmSchedule = () => {
        if (pendingScheduleTime && pendingScheduleText) {
            handleSend(pendingScheduleText, null, false, false, pendingScheduleTime);
            setScheduleModalVisible(false);
            setPendingScheduleTime(null);
            setPendingScheduleText('');
        }
    };

    const handleCancelSchedule = () => {
        setScheduleModalVisible(false);
        setPendingScheduleTime(null);
        setPendingScheduleText('');
    };

    const handleClearChat = async () => {
        Alert.alert('Clear Chat', 'Delete all messages?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const response = await fetch(`${Config.API_URL}/chat/clear_msgs.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: currentUser?.id, target_id: id })
                        });
                        if (response.ok) setMessages([]);
                    } catch (e) { console.error("Clear error", e); }
                }
            }
        ]);
    };

    const handleBlockUser = async () => {
        const isBlocked = relationshipStatus === 'blocked';
        try {
            const response = await fetch(`${Config.API_URL}/users/${isBlocked ? 'unblock_user.php' : 'block_user.php'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser?.id, target_id: id })
            });
            if (response.ok) fetchRelationshipStatus();
        } catch (e) { console.error("Block error", e); }
    };

    // --- Selection Mode Handlers ---
    const handleSelectMessage = (messageId: number) => {
        if (selectedMessageIds.includes(messageId)) {
            setSelectedMessageIds(prev => prev.filter(id => id !== messageId));
        } else {
            setSelectedMessageIds(prev => [...prev, messageId]);
        }
    };

    const handleLongPressMessage = (message: any) => {
        if (!isSelectionMode) {
            setSelectedMessageIds([message.id]);
        } else {
            handleSelectMessage(message.id);
        }
    };

    const handleCancelSelection = () => {
        setSelectedMessageIds([]);
    };

    const handleDeleteSelected = () => {
        const confirmDelete = (deleteType: 'for_me' | 'everyone') => {
            // Optimistic update
            if (deleteType === 'for_me') {
                setMessages(prev => prev.filter(m => !selectedMessageIds.includes(m.id)));
            } else {
                setMessages(prev => prev.map(m => selectedMessageIds.includes(m.id) ? { ...m, is_deleted: 1, message_text: '🚫 This message was deleted', media_url: null } : m));
            }

            // Trigger deletes in background
            try {
                selectedMessageIds.forEach(id => {
                    fetch(`${Config.API_URL}/chat/delete_message.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message_id: id, user_id: currentUser?.id, delete_type: deleteType })
                    });
                });
            } catch (e) { console.error("Bulk delete error", e); }

            setSelectedMessageIds([]); // Exit mode
        };

        const canDeleteForEveryone = selectedMessageIds.every(id => {
            const msg = messages.find(m => m.id === id);
            return msg && String(msg.sender_id) === String(currentUser?.id);
        });

        const options: AlertButton[] = [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete for me', style: 'destructive', onPress: () => confirmDelete('for_me') }
        ];

        if (canDeleteForEveryone) {
            options.push({ text: 'Delete for everyone', style: 'destructive', onPress: () => confirmDelete('everyone') });
        }

        Alert.alert('Delete Messages?', `Delete ${selectedMessageIds.length} messages?`, options);
    };

    const handleCopySelected = async () => {
        const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
        const textToCopy = selectedMsgs
            .map(m => `[${formatChatTime(m.created_at)}] ${m.sender_id === currentUser?.id ? 'You' : otherUsername}: ${m.message_text || (m.media_url ? '[Media]' : '')}`)
            .join('\n');

        await Clipboard.setStringAsync(textToCopy);
        setSelectedMessageIds([]);
    };

    const handleForwardSelected = () => {
        // Filter out One-Time View messages from forwarding
        const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id) && !m.is_one_time);

        if (selectedMsgs.length === 0) {
            if (selectedMessageIds.some(id => messages.find(m => m.id === id)?.is_one_time)) {
                Alert.alert('Cannot Forward', 'One-Time View messages cannot be forwarded.');
            }
            return;
        }

        const messageIds = selectedMsgs.map(m => m.id).join(',');
        const firstMessageText = selectedMsgs[0].message_text || (selectedMsgs[0].media_url ? '[Media]' : '');
        const previewText = selectedMsgs.length > 1 ? `${firstMessageText} and ${selectedMsgs.length - 1} others` : firstMessageText;

        router.push({
            pathname: '/chat/features/forward-selection',
            params: {
                messageIds: messageIds,
                initialText: previewText
            }
        });

        setSelectedMessageIds([]);
    };

    const handleMediaSelect = (type: string, content: string) => {
        if (type === 'emoji') {
            content === 'BACKSPACE' ? setInputText(prev => prev.slice(0, -1)) : setInputText(prev => prev + content);
        } else if (type === 'gif') {
            handleGifSelect(content);
            setIsPanelOpen(false);
        } else if (type === 'sticker') {
            handleStickerSend(content);
            setIsPanelOpen(false);
        }
    };

    const handleAttachmentTypeSelect = (type: string) => {
        setIsAttachmentPanelOpen(false);
        switch (type) {
            case 'gallery':
                handlePickImage();
                break;
            case 'camera':
                handleLaunchCamera();
                break;
            case 'video':
                handlePickVideo();
                break;
            case 'document':
                handlePickDocument();
                break;
            case 'audio':
                // We don't have a record audio button in current attachment menu, but we have voice recording.
                // WhatsApp attachment audio usually opens file picker for audio files.
                handlePickDocument(); // fallback
                break;
            default:
                Alert.alert('Coming Soon', `${type} feature is under development.`);
                break;
        }
    };

    const saveLastScrollPosition = async () => {
        if (!id) return;
        await AsyncStorage.setItem(`last_scroll_${id}`, String(scrollOffset.current));
    };

    const loadLastScrollPosition = async () => {
        if (!id) return;
        const pos = await AsyncStorage.getItem(`last_scroll_${id}`);
        if (pos && flatListRef.current) {
            setTimeout(() => flatListRef.current?.scrollToOffset({ offset: parseFloat(pos), animated: false }), 500);
        }
    };

    const scrollToMessage = (messageId: number) => {
        const index = messages.findIndex(m => m.id === messageId);
        if (index !== -1) flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    };

    const menuItems = [
        { label: 'View Profile', icon: User, onPress: () => setModalVisible(true) },
        { label: isLocked ? 'Unlock Chat' : 'Lock Chat', icon: isLocked ? Unlock : Lock, onPress: () => isLocked ? setShowUnlockPrompt(true) : setShowLockSetup(true) },
        { label: 'Clear Messages', icon: Trash2, onPress: handleClearChat },
        { label: relationshipStatus === 'blocked' ? 'Unblock' : 'Block', icon: ShieldAlert, onPress: handleBlockUser, destructive: true },
    ];

    const handleForwardMessage = (msg: any) => {
        setMessageOptionsVisible(false);
        router.push({
            pathname: '/chat/features/forward-selection',
            params: {
                messageId: msg.id.toString(),
                initialText: msg.message_text || ''
            }
        });
    };

    const handleSaveMediaToDevice = async (msg: any) => {
        if (!msg.media_url || msg.is_one_time) {
            if (msg.is_one_time) Alert.alert('Restricted', 'One-Time View messages cannot be saved.');
            return;
        }
        setMessageOptionsVisible(false);
        const type = (msg.message_type === 'voice' || (msg.media_url && /\.(m4a|mp3|wav|aac)$/i.test(msg.media_url))) ? 'audio' :
            (msg.message_type === 'video' || (msg.media_url && /\.(mp4|mov|mkv|webm)$/i.test(msg.media_url))) ? 'video' :
                (msg.message_type === 'document' || (msg.media_url && !/\.(jpg|jpeg|png|webp|gif|sticker|mp4|mov|mkv|webm|m4a|mp3|wav|aac)$/i.test(msg.media_url))) ? 'document' : 'image';

        await saveMedia(msg.media_url, type, msg.file_name);
    };

    const handleViewOneTimeMessage = async (url: string, messageId: number) => {
        console.log('handleViewOneTimeMessage called:', { url, messageId });
        // Detect type
        const type = (/\.(mp4|mov|mkv|webm)$/i.test(url)) ? 'video' : 'image';

        setOtvUrl(url);
        setOtvType(type);
        setOtvVisible(true);

        // Optimistic update
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'seen' } : m));

        try {
            await fetch(`${Config.API_URL}/chat/mark_one_time_seen.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: messageId, user_id: currentUser?.id })
            });
        } catch (e) {
            console.error('Failed to mark OTV as seen', e);
        }
    };

    const renderMessage = ({ item, index }: any) => (
        <MessageItem
            item={item}
            index={index}
            isMe={String(item.sender_id) === String(currentUser?.id)}
            isSelfChat={String(id) === String(currentUser?.id)}
            isLastInGroup={
                !messages[index + 1] ||
                messages[index + 1].sender_id !== item.sender_id ||
                formatChatTime(messages[index + 1].created_at) !== formatChatTime(item.created_at)
            }
            currentUser={currentUser}
            id={id}
            otherUsername={otherUsername}
            targetUserProfile={targetUserProfile}
            onSwipe={setReplyingToMessage}
            onLongPress={handleLongPressMessage}
            onReaction={(msgId: number, emoji: string) => { }} // TODO
            onDelete={handleDeleteMessage}
            onSend={handleSend}
            onImagePress={(url: string, isOneTime?: boolean, messageId?: number) => {
                if (isOneTime && messageId) {
                    handleViewOneTimeMessage(url, messageId);
                } else {
                    setFullScreenImage(url);
                    setIsFullScreenVisible(true);
                }
            }}
            onQuotePress={scrollToMessage}
            onForward={handleForwardMessage}
            selectedMessageId={selectedMessageId}
            // Selection Props
            selectionMode={isSelectionMode}
            isSelected={selectedMessageIds.includes(item.id)}
            onSelect={handleSelectMessage}
            selectedCount={selectedMessageIds.length}
        />
    );

    if (isCheckingLock) {
        return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Timer size={32} color={Colors.primary} /></View>;
    }

    if (isLocked && !isAuthenticated) {
        return <ChatLockScreen unlockPin={unlockPin} setUnlockPin={setUnlockPin} handleEntryUnlock={handleEntryUnlock} />;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ChatHeader
                id={id} otherUsername={otherUsername} avatar_id={avatar_id}
                avatar_url={avatar_url}
                currentUser={currentUser} targetUserProfile={targetUserProfile}
                isTyping={isTyping} relationshipStatus={relationshipStatus}
                menuVisible={menuVisible} setMenuVisible={setMenuVisible}
                modalVisible={modalVisible} setModalVisible={setModalVisible}
                menuItems={menuItems} fetchRelationshipStatus={fetchRelationshipStatus}
                // Selection Props
                selectionMode={isSelectionMode}
                selectedCount={selectedMessageIds.length}
                onCancelSelection={handleCancelSelection}
                onDeleteSelected={handleDeleteSelected}
                onForwardSelected={handleForwardSelected}
                onCopySelected={handleCopySelected}
            />

            <View style={{ flex: 1, backgroundColor: Colors.background }}>
                {Platform.OS === 'android' ? (
                    <View style={{ flex: 1, backgroundColor: Colors.background }}>
                        <FlatList
                            ref={flatListRef}
                            data={[...messages, ...failedMessages]}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderMessage}
                            style={{ flex: 1, backgroundColor: Colors.background }}
                            contentContainerStyle={[styles.listContent, messages.length === 0 && { flex: 1 }, { paddingBottom: keyboardHeight + inputHeight + 20 }]}
                            onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={!isLoading ? <EmptyState icon={MessageSquare} title="No messages yet" message="Start chatting!" /> : null}
                            showsVerticalScrollIndicator={false}
                        />
                        <View style={[styles.inputContainer, { position: 'absolute', bottom: isPanelOpen ? 0 : keyboardHeight, left: 0, right: 0 }]} onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}>
                            <ReplyPreview replyingToMessage={replyingToMessage} currentUser={currentUser} onCancel={() => setReplyingToMessage(null)} />
                            <ChatInputBar
                                inputText={inputText} editingMessage={editingMessage} handleTyping={handleTyping}
                                handleAttachmentSelect={handleAttachmentSelect} handlePickImage={handlePickImage}
                                handleSaveEdit={handleSaveEdit} handleSend={handleSend} handleCancelEdit={handleCancelEdit}
                                startRecording={startRecording} stopRecording={stopRecording} cancelRecording={cancelRecording}
                                recordingStatus={recordingStatus} recordingDuration={recordingDuration}
                                isPanelOpen={isPanelOpen} setIsPanelOpen={setIsPanelOpen}
                                panelActiveTab={panelActiveTab} setPanelActiveTab={setPanelActiveTab}
                                isAttachmentPanelOpen={isAttachmentPanelOpen} setIsAttachmentPanelOpen={setIsAttachmentPanelOpen}
                                isUploading={isUploading} isSending={isSending} inputRef={inputRef} Platform={Platform}
                                onRequestSchedule={handleRequestSchedule}
                            />
                        </View>
                    </View>
                ) : (
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={90}>
                        <FlatList
                            ref={flatListRef}
                            data={[...messages, ...failedMessages]}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderMessage}
                            style={{ flex: 1 }}
                            contentContainerStyle={[styles.listContent, messages.length === 0 && { flex: 1 }, { paddingBottom: 20 }]}
                            onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
                            ListEmptyComponent={!isLoading ? <EmptyState icon={MessageSquare} title="No messages yet" message="Start chatting!" /> : null}
                            showsVerticalScrollIndicator={false}
                        />
                        <View style={styles.inputContainer}>
                            <ReplyPreview replyingToMessage={replyingToMessage} currentUser={currentUser} onCancel={() => setReplyingToMessage(null)} />
                            <ChatInputBar
                                inputText={inputText} editingMessage={editingMessage} handleTyping={handleTyping}
                                handleAttachmentSelect={handleAttachmentSelect} handlePickImage={handlePickImage}
                                handleSaveEdit={handleSaveEdit} handleSend={handleSend} handleCancelEdit={handleCancelEdit}
                                startRecording={startRecording} stopRecording={stopRecording} cancelRecording={cancelRecording}
                                recordingStatus={recordingStatus} recordingDuration={recordingDuration}
                                isPanelOpen={isPanelOpen} setIsPanelOpen={setIsPanelOpen}
                                panelActiveTab={panelActiveTab} setPanelActiveTab={setPanelActiveTab}
                                isAttachmentPanelOpen={isAttachmentPanelOpen} setIsAttachmentPanelOpen={setIsAttachmentPanelOpen}
                                isUploading={isUploading} isSending={isSending} inputRef={inputRef} Platform={Platform}
                                onRequestSchedule={handleRequestSchedule}
                            />
                        </View>
                    </KeyboardAvoidingView>
                )}
            </View>

            <ChatMediaPanel
                height={isMediaSearching ? panelHeight * 1.25 : panelHeight}
                visible={isPanelOpen} onSelect={handleMediaSelect}
                activeTab={panelActiveTab} onTabChange={setPanelActiveTab}
                isSearching={isMediaSearching} onSearchToggle={setIsMediaSearching}
            />

            <ChatAttachmentPanel
                visible={isAttachmentPanelOpen}
                onClose={() => setIsAttachmentPanelOpen(false)}
                onSelect={handleAttachmentTypeSelect}
            />

            <LockSetupModal visible={showLockSetup} onClose={() => setShowLockSetup(false)} lockPin={lockPin} setLockPin={setLockPin} onConfirm={handleConfirmLock} />
            <UnlockPromptModal visible={showUnlockPrompt} onClose={() => setShowUnlockPrompt(false)} unlockPin={unlockPin} setUnlockPin={setUnlockPin} onConfirm={handleConfirmUnlock} />
            <OneTimeViewerModal visible={otvVisible} url={otvUrl} type={otvType} onClose={() => setOtvVisible(false)} />
            <FullScreenImageModal visible={isFullScreenVisible} imageUri={fullScreenImage} onClose={() => setIsFullScreenVisible(false)} />
            <ImageEditorModal visible={isEditorVisible} imageUri={editorImageUri} onClose={() => setIsEditorVisible(false)} onSend={handleEditorSend} />
            <MediaPreviewModal visible={isPreviewVisible} media={previewMedia} onClose={() => setIsPreviewVisible(false)} onSend={handleMediaPreviewSend} />

            <ScheduleConfirmationModal
                visible={scheduleModalVisible}
                scheduledTime={pendingScheduleTime}
                messageText={pendingScheduleText}
                onConfirm={handleConfirmSchedule}
                onCancel={handleCancelSchedule}
            />

            {/* Options Modal */}
            <Modal transparent={true} visible={messageOptionsVisible} animationType="fade" onRequestClose={() => setMessageOptionsVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMessageOptionsVisible(false)}>
                    <View style={[styles.modalContent, { backgroundColor: Colors.surface, borderColor: Colors.glassBorder }]}>
                        <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Options</ThemedText>
                        <TouchableOpacity style={styles.modalOption} onPress={() => { Clipboard.setStringAsync(selectedMessageForOptions?.message_text || ''); setMessageOptionsVisible(false); }}>
                            <Copy size={20} color={Colors.text} /><ThemedText style={styles.modalOptionText}>Copy</ThemedText>
                        </TouchableOpacity>
                        {!selectedMessageForOptions?.is_one_time && (
                            <TouchableOpacity style={styles.modalOption} onPress={() => handleForwardMessage(selectedMessageForOptions)}>
                                <Send size={20} color={Colors.text} /><ThemedText style={styles.modalOptionText}>Forward</ThemedText>
                            </TouchableOpacity>
                        )}
                        {selectedMessageForOptions?.media_url && !selectedMessageForOptions.is_one_time && (
                            <TouchableOpacity style={styles.modalOption} onPress={() => handleSaveMediaToDevice(selectedMessageForOptions)}>
                                <Download size={20} color={Colors.text} />
                                <ThemedText style={styles.modalOptionText}>
                                    {selectedMessageForOptions.message_type === 'document' ? 'Save to Device' : 'Save to Gallery'}
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.modalOption} onPress={() => { setMessageOptionsVisible(false); handleDeleteMessage(selectedMessageForOptions?.id, 'for_me'); }}>
                            <Trash size={20} color="#EF4444" /><ThemedText style={[styles.modalOptionText, { color: '#EF4444' }]}>Delete for me</ThemedText>
                        </TouchableOpacity>
                        {String(selectedMessageForOptions?.sender_id) === String(currentUser?.id) && (
                            <TouchableOpacity style={styles.modalOption} onPress={() => { setMessageOptionsVisible(false); handleDeleteMessage(selectedMessageForOptions?.id, 'everyone'); }}>
                                <Trash2 size={20} color="#EF4444" /><ThemedText style={[styles.modalOptionText, { color: '#EF4444' }]}>Delete for everyone</ThemedText>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.modalOption, styles.modalCancel]} onPress={() => setMessageOptionsVisible(false)}>
                            <X size={20} color={Colors.textSecondary} /><ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}
