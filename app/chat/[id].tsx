import React, { useState, useRef, useEffect } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, Keyboard, AppState, AlertButton, ActivityIndicator } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { User, BellOff, Trash2, UserMinus, ShieldAlert, Flag, Timer, X, Copy, Trash, MoreVertical, ChevronLeft, MessageSquare, Edit2, Mic, Unlock, Lock, Send, Download, Info, LogOut } from 'lucide-react-native';
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
import { DeleteConfirmationModal } from '../../components/chat/features/DeleteConfirmationModal';
import { ActionConfirmationModal } from '../../components/chat/features/ActionConfirmationModal';
import { useVoiceRecording } from '../../components/chat/features/hooks/useVoiceRecording';
import { useChatLock } from '../../components/chat/features/hooks/useChatLock';
import { usePermissions } from '../../components/chat/features/hooks/usePermissions';
import { styles } from '../../components/chat/features/styles';

// Add local styles override/extension if needed or rely on importing them.
// Since 'styles' is imported from components/chat/features/styles, we should probably update THAT file, 
// OR simpler: define these extra styles relative to the usage if they don't exist.
// Let's check 'components/chat/features/styles.ts' content first?
// Or just inline them for now if I can't easily edit the styles file without seeing it.
// The user prompt implied designing the popup.
// I will edit the 'styles' object in `components/chat/features/styles.ts` to be clean.

import { saveMedia } from '../../utils/mediaSaver';
import { ScheduleConfirmationModal } from '../../components/chat/features/ScheduleConfirmationModal';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ChatDetailScreen() {
    const { id, user: otherUsername, avatar_id, avatar_url, is_group: isGroupParam, is_official: isOfficialParam } = useLocalSearchParams<{ id: string, user: string, avatar_id: string, avatar_url?: string, is_group?: string, is_official?: string }>();
    const { user: currentUser } = useUser();

    // Parse isGroup correctly
    const isGroup = isGroupParam === '1' || isGroupParam === 'true';

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
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [canDeleteForEachOther, setCanDeleteForEachOther] = useState(false); // Renamed for clarity, logic to follow

    // 1️⃣ Strict State Reset on Chat Change
    useEffect(() => {
        setMessages([]);
        setIsLoading(true);
        setFailedMessages([]);
        setReplyingToMessage(null);
        setSelectedMessageIds([]);
        setInputText('');
        setRelationshipStatus(null);
        setTargetUserProfile(null);
    }, [id]);

    // Generic Action Modal State
    const [actionModalConfig, setActionModalConfig] = useState<{
        visible: boolean;
        title: string;
        description: string;
        confirmText?: string;
        isDestructive?: boolean;
        onConfirm: () => void;
        icon?: React.ReactNode;
    }>({
        visible: false,
        title: '',
        description: '',
        onConfirm: () => { },
    });

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
    const [otvText, setOtvText] = useState<string | null>(null);
    const [otvType, setOtvType] = useState<'image' | 'video' | 'text'>('image');
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
    const currentIdRef = useRef(id); // 5️⃣ Race condition protection
    if (currentIdRef.current !== id) currentIdRef.current = id;


    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [inputHeight, setInputHeight] = useState(60);
    const [userRole, setUserRole] = useState<string | null>(null);

    const [permissions, setPermissions] = useState({
        allow_member_send_messages: true,
        // Add others if needed locally, but mainly we need send_messages here
    });

    const [groupMembers, setGroupMembers] = useState<any[]>([]);

    useEffect(() => {
        // Fetch group details if it's a group
        if (isGroup && currentUser) {
            fetchGroupRole();
            fetchGroupMembers();
        }
    }, [id, isGroup, currentUser]);

    const fetchGroupMembers = async () => {
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_group_details.php?group_id=${id}&user_id=${currentUser?.id}`);
            const data = await response.json();
            if (response.ok && data.members) {
                setGroupMembers(data.members);
            }
        } catch (e) {
            console.error("Failed to fetch members", e);
        }
    };

    const fetchGroupRole = async () => {
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_group_role.php?group_id=${id}&user_id=${currentUser?.id}`);
            const data = await response.json();
            if (response.ok) {
                setUserRole(data.role);
                if (data.permissions) {
                    setPermissions({
                        allow_member_send_messages: !!data.permissions.send_messages
                    });
                }
            }
        } catch (e) {
            console.error("Failed to fetch role", e);
        }
    };
    const [isTyping, setIsTyping] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Fetch initial mute status & Auto-Mute Self Chat
    useEffect(() => {
        if (!currentUser || !id) return;
        const checkMuteStatus = async () => {
            try {
                // TODO: Update check_mute.php to support groups if needed
                const response = await fetch(`${Config.API_URL}/chat/check_mute.php?user_id=${currentUser.id}&target_id=${id}`);
                const data = await response.json();
                if (response.ok) {
                    setIsMuted(data.is_muted);

                    // Auto-mute Note to Self if not muted
                    if (String(id) === String(currentUser.id) && !data.is_muted) {
                        await fetch(`${Config.API_URL}/chat/mute_chat.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: currentUser.id, target_id: id, action: 'mute' })
                        });
                        setIsMuted(true);
                    }
                }
            } catch (e) {
                console.error("Check mute error", e);
            }
        };
        checkMuteStatus();
    }, [currentUser, id]);

    const handleMuteToggle = () => {
        if (!currentUser) return;
        const action = isMuted ? 'unmute' : 'mute';

        setActionModalConfig({
            visible: true,
            title: isMuted ? 'Unmute Notifications?' : 'Mute Notifications?',
            description: isMuted
                ? 'You will receive notifications for new messages in this chat.'
                : 'You will not receive notifications for new messages in this chat.',
            confirmText: isMuted ? 'Unmute' : 'Mute',
            isDestructive: false,
            icon: <BellOff size={24} color={Colors.text} />,
            onConfirm: async () => {
                setActionModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    const response = await fetch(`${Config.API_URL}/chat/mute_chat.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: currentUser.id, target_id: id, action: action })
                    });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        setIsMuted(!isMuted);
                    } else {
                        Alert.alert("Error", data.message || "Failed to update mute status.");
                    }
                } catch (e) {
                    Alert.alert("Error", "Network error.");
                }
            }
        });
    };

    const handleUnfriend = () => {
        setActionModalConfig({
            visible: true,
            title: 'Unfriend User?',
            description: 'Are you sure you want to unfriend this user? This will remove them from your friends list and DELETE ALL CHAT HISTORY, IMAGES, AND FILES PERMANENTLY.',
            confirmText: 'Unfriend & Delete',
            isDestructive: true,
            icon: <UserMinus size={24} color="#EF4444" />,
            onConfirm: async () => {
                if (!currentUser) return;
                setActionModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    const response = await fetch(`${Config.API_URL}/users/handle_relationship.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: currentUser.id, target_id: id, action: 'unfriend' })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        router.replace('/(tabs)/chats');
                    } else {
                        Alert.alert("Error", data.message || "Failed to unfriend.");
                    }
                } catch (e) {
                    Alert.alert("Error", "Network error.");
                }
            }
        });
    };

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

    // Notification Handler 
    useFocusEffect(
        React.useCallback(() => {
            Notifications.setNotificationHandler({
                handleNotification: async (notification) => {
                    const data = notification.request.content.data;
                    if (String(data?.conversation_id) === String(id)) {
                        return {
                            shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false,
                            shouldShowBanner: false, shouldShowList: false
                        };
                    }
                    return {
                        shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
                        shouldShowBanner: true, shouldShowList: true
                    };
                },
            });
            return () => {
                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
                        shouldShowBanner: true, shouldShowList: true
                    }),
                });
            };
        }, [id])
    );

    // Keyboard Listeners
    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
            const height = e.endCoordinates.height;
            if (height > 100) {
                setKeyboardHeight(height);
                setPanelHeight(height);
                if (!isMediaSearchingRef.current) setIsPanelOpen(false);
            }
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // 1️⃣ Strict State Reset & Unified Data Fetching
    const [isReady, setIsReady] = useState(false);

    // Handlers & Logic - Defined BEFORE useFocusEffect to be used inside
    const updateLastSeen = async (signal?: AbortSignal) => {
        if (!currentUser) return;
        try {
            await fetch(`${Config.API_URL}/users/update_last_seen.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id }),
                signal
            });
        } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Last seen update error", e);
        }
    };

    const fetchMessages = async (signal?: AbortSignal) => {
        if (!currentUser) return;
        let url = `${Config.API_URL}/chat/get_messages.php?sender_id=${currentUser.id}`;
        if (isGroup) url += `&group_id=${id}`;
        else url += `&receiver_id=${id}`;

        try {
            const response = await fetch(url, { signal });
            if (signal?.aborted) return;

            const data = await response.json();

            // 5️⃣ Race Condition Check
            if (currentIdRef.current !== id) {
                console.log('Ignored stale messages for:', id);
                return;
            }

            if (response.ok) {
                setMessages(data);
                if (AppState.currentState === 'active' && !isGroup) {
                    const hasUnseen = data.some((m: any) => String(m.sender_id) !== String(currentUser.id) && m.status !== 'seen');
                    if (hasUnseen) updateMessageStatus('seen');
                }
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') console.error('Error fetching messages:', error);
        }
    };

    const updateMessageStatus = async (status: 'delivered' | 'seen') => {
        if (!currentUser || isGroup) return;
        try {
            await fetch(`${Config.API_URL}/chat/update_status.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id, sender_id: id, status: status })
            });
        } catch (error) { console.error('Error updating status:', error); }
    };

    const fetchRelationshipStatus = async (signal?: AbortSignal) => {
        if (!currentUser || isGroup) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`, { signal });
            if (signal?.aborted) return;
            const data = await response.json();
            if (response.ok) {
                const otherUser = data.find((u: any) => String(u.id) === String(id));
                if (otherUser) setRelationshipStatus(otherUser.relationship_status);
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') console.error('Error fetching relationship:', error);
        }
    };

    const fetchGroupDetails = async (signal?: AbortSignal) => {
        if (!isGroup) return;
        setTargetUserProfile({
            id: id,
            username: otherUsername || 'Group',
            avatar_url: avatar_url,
            is_group: true
        });
    };

    const fetchTargetUserProfile = async (signal?: AbortSignal) => {
        if (!currentUser || isGroup) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`, { signal });
            if (signal?.aborted) return;
            const data = await response.json();
            if (response.ok) {
                const found = data.find((u: any) => String(u.id) === String(id));
                if (found) {
                    setTargetUserProfile(found);
                } else if (!isGroup && String(id) === String(currentUser.id)) {
                    setTargetUserProfile({ ...currentUser, bio: 'Note to self' });
                }
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Profile fetch error", e);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            if (!currentUser || !id) return;

            // Reset State Synchronously on Focus/Mount if ID changed (handled by dependency array)
            // But we also need to handle the case where we push a new ID.
            // React key={id} in Stack.Screen usually handles this by calculating a fresh component, 
            // but if we are reusing the screen, we must reset.

            setIsLoading(true);
            setIsReady(false); // Render Guard

            // AbortController for this effect session
            const abortController = new AbortController();
            const signal = abortController.signal;

            const fetchData = async () => {
                try {
                    console.log(`[Chat ${id}] Fetching data...`);

                    // Parallel Fetch
                    const [msgsRes, relRes, userRes] = await Promise.all([
                        fetch(`${Config.API_URL}/chat/get_messages.php?sender_id=${currentUser.id}&${isGroup ? `group_id=${id}` : `receiver_id=${id}`}`, { signal }),
                        !isGroup ? fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`, { signal }) : Promise.resolve(null),
                        // For groups, we might need group details
                        isGroup ? Promise.resolve(null) : Promise.resolve(null) // Group details handled differently usually
                    ]);

                    if (signal.aborted) return;

                    // 1. Messages
                    if (msgsRes.ok) {
                        const data = await msgsRes.json();
                        setMessages(data);
                        // Mark seen if active
                        if (AppState.currentState === 'active' && !isGroup) {
                            const hasUnseen = data.some((m: any) => String(m.sender_id) !== String(currentUser.id) && m.status !== 'seen');
                            if (hasUnseen) updateMessageStatus('seen');
                        }
                    }

                    // 2. Relationship / Profile
                    if (relRes && relRes.ok) {
                        const data = await relRes.json();
                        const otherUser = data.find((u: any) => String(u.id) === String(id));
                        if (otherUser) {
                            setRelationshipStatus(otherUser.relationship_status);
                            setTargetUserProfile(otherUser);
                        } else if (String(id) === String(currentUser.id)) {
                            setTargetUserProfile({ ...currentUser, bio: 'Note to self' });
                        }
                    }

                    // 3. Group Details
                    if (isGroup) {
                        // Simplify: use params or existing logic tailored for groups
                        setTargetUserProfile({
                            id: id,
                            username: otherUsername || 'Group',
                            avatar_url: avatar_url,
                            is_group: true
                        });
                    }

                    // 4. Update Last Seen
                    try {
                        await fetch(`${Config.API_URL}/users/update_last_seen.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: currentUser.id })
                        });
                    } catch (e) { }

                    // 5. Scroll Position
                    loadLastScrollPosition();

                } catch (error: any) {
                    if (error.name !== 'AbortError') {
                        console.error(`[Chat ${id}] Fetch error:`, error);
                    }
                } finally {
                    if (!signal.aborted) {
                        setIsLoading(false);
                        setIsReady(true);
                    }
                }
            };

            fetchData();

            // Polling (Interval) - Cleaned up
            const interval = setInterval(() => {
                if (AppState.currentState === 'active') {
                    fetchMessages();
                    updateLastSeen();
                }
            }, 3000);

            return () => {
                console.log(`[Chat ${id}] Unmounting/Blurring - Cleanup`);
                abortController.abort();
                clearInterval(interval);
                saveLastScrollPosition();
                // We DO NOT reset messages here to avoid flash if navigating back briefly,
                // BUT the goal is strict correctness. If we navigate BACK to list, we destroy.
                // If we navigate FORWARD, we might keep it.
                // For now, let's rely on the mount-reset logic.
            };
        }, [id, currentUser]) // Re-run deeply when ID changes
    );





    const handleSend = async (text: string = inputText, imagePath: string | null = null, isRetry = false, isOneTime = false, scheduledAt: Date | null = null) => {
        console.log('handleSend called:', { text, imagePath, isOneTime, scheduledAt, isGroup });
        if (!currentUser) return;
        const messageText = text.trim();
        if (!messageText && !imagePath) return;

        // Rate Limit (Skip)

        if (!imagePath) setInputText('');
        setIsSending(true);

        const tempId = Date.now();
        const newMessage = {
            id: tempId,
            sender_id: currentUser.id,
            receiver_id: isGroup ? null : id,
            group_id: isGroup ? id : null,
            message_text: messageText,
            media_url: imagePath,
            message_type: imagePath ? 'image' : 'text',
            is_local: true,
            reply_to_message_id: replyingToMessage?.id || null,
            is_one_time: isOneTime ? 1 : 0,
            status: scheduledAt ? 'scheduled' : 'sending',
        };

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
            Alert.alert("Scheduled", `Message scheduled for ${formatChatTime(scheduledAt)}`);
            setInputText('');
        }

        setReplyingToMessage(null);
        if (isRetry) setFailedMessages(prev => prev.filter(m => m.message_text !== messageText || m.media_url !== imagePath));

        try {
            const payload: any = {
                sender_id: currentUser.id,
                message: messageText,
                image_path: imagePath,
                reply_to_message_id: newMessage.reply_to_message_id,
                is_one_time: isOneTime ? 1 : 0,
                scheduled_at: scheduledAt ? scheduledAt.toISOString() : null
            };

            if (isGroup) {
                payload.group_id = id;
            } else {
                payload.receiver_id = id;
            }

            const response = await fetch(`${Config.API_URL}/chat/send_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                if (!scheduledAt) {
                    isAtBottomRef.current = true;
                    // fetchMessages(); // Optional, local update is faster
                }
            } else {
                if (!scheduledAt) setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed' }]);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            if (!scheduledAt) setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed' }]);
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
                            ...(isGroup ? { group_id: id } : { receiver_id: id }),
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
                            ...(isGroup ? { group_id: id } : { receiver_id: id }),
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
                    body: JSON.stringify({
                        sender_id: currentUser?.id,
                        ...(isGroup ? { group_id: id } : { receiver_id: id }),
                        audio_url: data.audio_url,
                        duration: duration
                    })
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
                body: JSON.stringify({
                    sender_id: currentUser.id,
                    ...(isGroup ? { group_id: id } : { receiver_id: id }),
                    gif_url: url
                })
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
                body: JSON.stringify({
                    sender_id: currentUser.id,
                    ...(isGroup ? { group_id: id } : { receiver_id: id }),
                    sticker_url: url
                })
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

    const handleReportGroup = () => {
        setMenuVisible(false);
        // We'll use a simple alert with input prompt if possible, or just a confirmation for MVP sending a default reason if no input UI available.
        // Or re-use ActionConfirmationModal but it doesn't support input.
        // For better UX, we should probably have a ReportModal, but to save time let's use a fixed reason or prompt.
        // "Report this group?" -> "Spam/Abuse" (hardcoded/generic)

        Alert.alert(
            "Report Group",
            "Why are you reporting this group?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Spam", onPress: () => submitGroupReport('spam') },
                { text: "Inappropriate Content", onPress: () => submitGroupReport('inappropriate') },
                { text: "Harassment", onPress: () => submitGroupReport('harassment') }
            ]
        );
    };

    const submitGroupReport = async (reason: string) => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/report_group.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reporter_id: currentUser.id, group_id: id, reason: reason })
            });
            const data = await response.json();
            Alert.alert(response.ok ? "Reported" : "Error", data.message || "Failed to report.");
        } catch (e) {
            Alert.alert("Error", "Network error.");
        }
    };

    const handleExitGroup = () => {
        setMenuVisible(false);
        setActionModalConfig({
            visible: true,
            title: 'Exit Group?',
            description: 'Are you sure you want to leave this group? You will strictly be removed.',
            confirmText: 'Exit Group',
            isDestructive: true,
            icon: <LogOut size={24} color="#EF4444" />,
            onConfirm: async () => {
                setActionModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    const response = await fetch(`${Config.API_URL}/chat/group_actions.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: currentUser?.id, group_id: id, action: 'leave_group' })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        router.replace('/(tabs)/chats');
                    } else {
                        Alert.alert("Error", data.message || "Failed to leave group.");
                    }
                } catch (e) { Alert.alert("Error", "Network error."); }
            }
        });
    };

    const handleClearChat = async () => {
        setMenuVisible(false);

        if (isGroup) {
            const options: AlertButton[] = [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear for me",
                    onPress: () => clearChatSelf()
                }
            ];

            if (userRole === 'owner') {
                options.push({
                    text: "Clear for everyone",
                    style: 'destructive',
                    onPress: () => confirmClearEveryone()
                });
            }

            Alert.alert(
                "Clear Chat",
                "Do you want to clear chat history?",
                options
            );
        } else {
            confirmClearEveryone(true);
        }
    };

    const clearChatSelf = async () => {
        try {
            const response = await fetch(`${Config.API_URL}/chat/group_actions.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser?.id, group_id: id, action: 'clear_chat_self' })
            });
            if (response.ok) {
                setMessages([]);
                Alert.alert("Success", "Chat cleared for you.");
            } else {
                const data = await response.json();
                Alert.alert("Error", data.message || "Failed to clear chat.");
            }
        } catch (e) { Alert.alert("Error", "Network error"); }
    };

    const confirmClearEveryone = (isOneOnOne = false) => {
        setActionModalConfig({
            visible: true,
            title: 'Clear Chat?',
            description: isOneOnOne ? 'This will delete messages for both of you.' : 'This will delete messages for ALL participants.',
            confirmText: 'Clear Everywhere',
            isDestructive: true,
            icon: <Trash2 size={24} color="#EF4444" />,
            onConfirm: async () => {
                setActionModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    const payload = isOneOnOne
                        ? { user_id: currentUser?.id, target_id: id }
                        : { user_id: currentUser?.id, group_id: id };

                    const response = await fetch(`${Config.API_URL}/chat/clear_msgs.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json();
                    if (response.ok) {
                        setMessages([]);
                    } else {
                        Alert.alert("Error", data.message || "Failed to clear.");
                    }
                } catch (e) { console.error("Clear error", e); }
            }
        });
    };

    const handleBlockUser = () => {
        const isBlocked = relationshipStatus === 'blocked';
        const action = isBlocked ? 'unblock' : 'block';

        setActionModalConfig({
            visible: true,
            title: isBlocked ? 'Unblock User?' : 'Block User?',
            description: isBlocked
                ? 'They will be able to message you and see your profile.'
                : 'They will not be able to message you or see your profile.',
            confirmText: isBlocked ? 'Unblock' : 'Block',
            isDestructive: !isBlocked,
            icon: <ShieldAlert size={24} color={isBlocked ? Colors.primary : "#EF4444"} />,
            onConfirm: async () => {
                setActionModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    const response = await fetch(`${Config.API_URL}/users/handle_relationship.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: currentUser?.id, target_id: id, action: action })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        fetchRelationshipStatus();
                    } else {
                        Alert.alert("Error", data.message || "Failed to update block status.");
                    }
                } catch (e) { console.error("Block error", e); }
            }
        });
    };

    // --- Selection Mode Handlers ---
    const handleDeleteMessage = (messageId?: number, type: 'for_me' | 'everyone' = 'for_me') => {
        // If called with specific type (from options menu), execute immediately
        if (messageId && type) {
            // We need to confirm this action or let the options menu handle it?
            // The options menu already has specific buttons.
            // Let's assume if it comes from options menu, we still want confirmation?
            // Original code didn't confirm from options menu?
            // "handleDeleteMessage" was called with type from Options Modal.
            // Let's reuse the modal for consistency if possible, or just execute if type is passed.

            // Actually, the original Options Modal called `handleDeleteMessage(id, type)`.
            // But `handleDeleteSelected` called `Alert.alert`.

            // To use the new Modal for single messages:
            if (messageId) {
                // If it's a direct call with type (from Options menu), we might want to skip modal or show it purely for confirmation?
                // The user request was about the "popup", implying the Alert.
                // Let's make `handleDeleteMessage` trigger the modal if no type is passed (which isn't current usage)
                // OR adapt the Options modal to open OUR modal.

                // Current Options Modal calls: `handleDeleteMessage(selectedMessageForOptions?.id, 'for_me')`
                // Let's intercept that.

                // WAIT: The Options Modal has "Delete for me" and "Delete for everyone" buttons directly.
                // If we want to replace THOSE alerts (if any), or just the selection delete?
                // The screenshot showed "Delete 1 messages?" which implies selection mode or a general delete prompt.

                // Let's update `handleDeleteMessage` to just perform the delete if type is known (Options Menu),
                // BUT `handleDeleteSelected` helps managing the "Delete 1 messages" popup.

                // To support single message delete via this modal (e.g. long press -> delete icon in header? No, header is for selection)
                // Accessing delete via Options Menu is direct.

                // Logic:
                // 1. Bulk Delete (Selection) -> `handleDeleteSelected` -> Opens Modal.
                // 2. Single Delete (Options) -> `handleDeleteMessage` -> Executes logic.

                // Executing logic directly:
                deleteMessageLogic(messageId, type);
            }
            return;
        }
    };

    const deleteMessageLogic = async (messageId: number | number[], type: 'for_me' | 'everyone') => {
        const ids = Array.isArray(messageId) ? messageId : [messageId];

        // Optimistic UI Update
        const msgsToDelete = messages.filter(m => ids.includes(m.id));
        setMessages(prev => prev.filter(m => !ids.includes(m.id)));
        if (msgsToDelete.length > 0) {
            // setDeletedMessagesStack(prev => [...prev, { ids, messages: msgsToDelete }]);
            // Show undo toast?
        }

        try {
            ids.forEach(id => {
                fetch(`${Config.API_URL}/chat/delete_message.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message_id: id, user_id: currentUser?.id, delete_type: type })
                });
            });
        } catch (e) { console.error("Delete error", e); }

        setSelectedMessageIds([]);
        setDeleteModalVisible(false);
    };

    // Refactor confirmDelete to use new logic
    const confirmDelete = async (deleteType: 'for_me' | 'everyone') => {
        await deleteMessageLogic(selectedMessageIds, deleteType);
    };

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
        const canDeleteForEveryone = selectedMessageIds.every(id => {
            const msg = messages.find(m => m.id === id);
            return msg && String(msg.sender_id) === String(currentUser?.id);
        });

        setCanDeleteForEachOther(canDeleteForEveryone);
        setDeleteModalVisible(true);
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
        {
            label: isGroup ? 'Group Info' : 'View Profile',
            icon: isGroup ? Info : User,
            onPress: () => {
                setMenuVisible(false);
                if (isGroup) {
                    router.push({
                        pathname: '/chat/group_info',
                        params: { id: id }
                    });
                } else {
                    setModalVisible(true);
                }
            }
        },
        ...(String(id) !== String(currentUser?.id) ? [
            { label: isMuted ? 'Unmute Notifications' : 'Mute Notifications', icon: BellOff, onPress: handleMuteToggle }
        ] : []),
        { label: isLocked ? 'Unlock Chat' : 'Lock Chat', icon: isLocked ? Unlock : Lock, onPress: () => isLocked ? setShowUnlockPrompt(true) : setShowLockSetup(true) },
        { label: 'Clear Messages', icon: Trash2, onPress: handleClearChat },
        ...(!isGroup && String(id) !== String(currentUser?.id) && (targetUserProfile?.is_official != 1 && isOfficialParam !== '1') ? [
            { label: relationshipStatus === 'blocked' ? 'Unblock' : 'Block', icon: ShieldAlert, onPress: handleBlockUser, destructive: true },
            { label: 'Unfriend', icon: UserMinus, onPress: () => { setMenuVisible(false); handleUnfriend(); }, destructive: true },
        ] : []),
        ...(isGroup ? [
            { label: 'Report Group', icon: Flag, onPress: handleReportGroup, destructive: true },
            { label: 'Exit Group', icon: LogOut, onPress: handleExitGroup, destructive: true }
        ] : [])
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
        try {
            const response = await fetch(`${Config.API_URL}/chat/mark_one_time_seen.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: messageId, user_id: currentUser?.id })
            });
            const res = await response.json();

            if (res.data) {
                const { message_text, media_url } = res.data;

                // Update Local State
                setMessages(prev => prev.map(m => m.id === messageId ? {
                    ...m,
                    status: 'seen',
                    message_text: message_text || m.message_text,
                    media_url: media_url || m.media_url
                } : m));

                // If Media, Show Viewer
                if (media_url) {
                    const type = (/\.(mp4|mov|mkv|webm)$/i.test(media_url)) ? 'video' : 'image';
                    const fullUrl = media_url.startsWith('http') ? media_url : `${Config.API_URL}/${media_url.replace(/^\//, '')}`;
                    setOtvUrl(fullUrl);
                    setOtvText(null); // Clear text if media
                    setOtvType(type);
                    setOtvVisible(true);
                } else if (message_text) {
                    // Text OTV
                    setOtvUrl(null); // Clear URL if text
                    setOtvText(message_text);
                    setOtvType('text');
                    setOtvVisible(true);
                }
            } else {
                if (res.message === 'Already seen.') {
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'seen' } : m));
                }
            }
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
            isGroupChat={isGroup}
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
            groupMembers={groupMembers}
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
                id={id}
                otherUsername={String(id) === String(currentUser?.id) ? 'Note to self' : otherUsername}
                avatar_id={avatar_id}
                avatar_url={avatar_url}
                isGroup={isGroup}
                currentUser={currentUser}
                targetUserProfile={targetUserProfile}
                isTyping={isTyping}
                relationshipStatus={relationshipStatus}
                menuVisible={menuVisible}
                setMenuVisible={setMenuVisible}
                modalVisible={modalVisible}
                setModalVisible={(visible: boolean) => {
                    if (isGroup) {
                        router.push({
                            pathname: '/chat/group_info',
                            params: { id: id }
                        });
                    } else {
                        setModalVisible(visible);
                    }
                }}
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
                            key={id} // 4️⃣ Force re-mount on chat change
                            ref={flatListRef}
                            data={isReady ? [...messages, ...failedMessages] : []}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderMessage}
                            style={{ flex: 1, backgroundColor: Colors.background }}
                            contentContainerStyle={[
                                styles.listContent,
                                (messages.length === 0 || !isReady) && { flex: 1 },
                                { paddingBottom: (relationshipStatus === 'blocked' ? 80 : keyboardHeight + inputHeight) + 20 }
                            ]}
                            onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={
                                isLoading || !isReady ? (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                        <ActivityIndicator size="large" color={Colors.primary} />
                                    </View>
                                ) : (
                                    <EmptyState
                                        icon={MessageSquare}
                                        title="No messages yet"
                                        message="Start chatting!"
                                    />
                                )
                            }
                            showsVerticalScrollIndicator={false}
                        />
                        {relationshipStatus === 'blocked' ? (
                            <View style={styles.blockedFooter}>
                                <ThemedText style={styles.blockedText}>You have blocked this contact.</ThemedText>
                                <TouchableOpacity style={styles.unblockButton} onPress={handleBlockUser}>
                                    <ThemedText style={styles.unblockText}>Tap to unblock</ThemedText>
                                </TouchableOpacity>
                            </View>
                        ) : ((targetUserProfile?.is_official == 1 || isOfficialParam === '1') && currentUser?.is_official != 1) ? (
                            <View style={{ height: 60, justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, zIndex: 9999, elevation: 10, borderTopWidth: 1, borderTopColor: Colors.glassBorder }}>
                                <ThemedText style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '600' }}>🚫 Only Vegarm can send messages</ThemedText>
                            </View>
                        ) : (
                            <View style={[styles.inputContainer, { position: 'absolute', bottom: isPanelOpen ? 0 : keyboardHeight, left: 0, right: 0 }]} onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}>
                                <ReplyPreview replyingToMessage={replyingToMessage} currentUser={currentUser} onCancel={() => setReplyingToMessage(null)} />
                                <ChatInputBar
                                    inputText={inputText}
                                    editingMessage={editingMessage}
                                    handleTyping={handleTyping}
                                    handleAttachmentSelect={handleAttachmentSelect}
                                    handlePickImage={handlePickImage}
                                    handleSaveEdit={handleSaveEdit}
                                    handleSend={handleSend}
                                    handleCancelEdit={handleCancelEdit}
                                    startRecording={startRecording}
                                    stopRecording={stopRecording}
                                    cancelRecording={cancelRecording}
                                    recordingStatus={recordingStatus}
                                    recordingDuration={recordingDuration}
                                    isPanelOpen={isPanelOpen}
                                    setIsPanelOpen={setIsPanelOpen}
                                    panelActiveTab={panelActiveTab}
                                    setPanelActiveTab={setPanelActiveTab}
                                    isAttachmentPanelOpen={isAttachmentPanelOpen}
                                    setIsAttachmentPanelOpen={setIsAttachmentPanelOpen}
                                    isUploading={isUploading}
                                    isSending={isSending}
                                    inputRef={inputRef}
                                    inputHeight={inputHeight}
                                    setInputHeight={setInputHeight}
                                    keyboardHeight={keyboardHeight}
                                    onRequestSchedule={handleRequestSchedule}
                                    isGroup={isGroup}
                                    userRole={userRole}
                                    permissions={permissions}
                                    groupMembers={groupMembers}
                                />
                            </View>
                        )}
                    </View>
                ) : (
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={90}>
                        <FlatList
                            key={id} // 4️⃣ Force re-mount on chat change
                            ref={flatListRef}
                            data={[...messages, ...failedMessages]}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderMessage}
                            style={{ flex: 1 }}
                            contentContainerStyle={[
                                styles.listContent,
                                messages.length === 0 && { flex: 1 },
                                { paddingBottom: 20 }
                            ]}
                            onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
                            ListEmptyComponent={
                                !isLoading ? (
                                    <EmptyState
                                        icon={MessageSquare}
                                        title="No messages yet"
                                        message="Start chatting!"
                                    />
                                ) : null
                            }
                            showsVerticalScrollIndicator={false}
                        />
                        {relationshipStatus === 'blocked' ? (
                            <View style={styles.blockedFooter}>
                                <ThemedText style={styles.blockedText}>You have blocked this contact.</ThemedText>
                                <TouchableOpacity style={styles.unblockButton} onPress={handleBlockUser}>
                                    <ThemedText style={styles.unblockText}>Tap to unblock</ThemedText>
                                </TouchableOpacity>
                            </View>
                        ) : ((targetUserProfile?.is_official == 1 || isOfficialParam === '1') && currentUser?.is_official != 1) ? (
                            <View style={[styles.blockedFooter, { height: 60, justifyContent: 'center', alignItems: 'center' }]}>
                                <ThemedText style={{ color: Colors.textSecondary, fontSize: 13 }}>🚫 Only Vegarm can send messages</ThemedText>
                            </View>
                        ) : (
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
                                    inputHeight={inputHeight} setInputHeight={setInputHeight} keyboardHeight={keyboardHeight}
                                    isGroup={isGroup}
                                    userRole={userRole}
                                    permissions={permissions}
                                    groupMembers={groupMembers}
                                />
                            </View>
                        )}
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
            <OneTimeViewerModal
                visible={otvVisible}
                url={otvUrl}
                text={otvText}
                type={otvType}
                onClose={() => setOtvVisible(false)}
            />
            <FullScreenImageModal visible={isFullScreenVisible} imageUri={fullScreenImage} onClose={() => setIsFullScreenVisible(false)} />
            <ImageEditorModal visible={isEditorVisible} imageUri={editorImageUri} onClose={() => setIsEditorVisible(false)} onSend={handleEditorSend} />
            <MediaPreviewModal visible={isPreviewVisible} media={previewMedia} onClose={() => setIsPreviewVisible(false)} onSend={handleMediaPreviewSend} />

            <DeleteConfirmationModal
                visible={deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
                onDeleteForMe={() => confirmDelete('for_me')}
                onDeleteForEveryone={() => confirmDelete('everyone')}
                count={selectedMessageIds.length || 1}
                canDeleteForEveryone={canDeleteForEachOther}
            />

            <ActionConfirmationModal
                visible={actionModalConfig.visible}
                title={actionModalConfig.title}
                description={actionModalConfig.description}
                confirmText={actionModalConfig.confirmText}
                isDestructive={actionModalConfig.isDestructive}
                onConfirm={actionModalConfig.onConfirm}
                onClose={() => setActionModalConfig(prev => ({ ...prev, visible: false }))}
                icon={actionModalConfig.icon}
            />

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
