import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, Keyboard, AppState, ActivityIndicator, AlertButton, Animated } from 'react-native';
import { FlashList } from '@shopify/flash-list';
// @ts-ignore
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
import { formatChatTime, parseToDate } from '../../utils/time';
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
import { SecureStoreHelper } from '../../utils/SecureStoreHelper';

// Add local styles override/extension if needed or rely on importing them.
// Since 'styles' is imported from components/chat/features/styles, we should probably update THAT file, 
// OR simpler: define these extra styles relative to the usage if they don't exist.
// Let's check 'components/chat/features/styles.ts' content first?
// Or just inline them for now if I can't easily edit the styles file without seeing it.
// The user prompt implied designing the popup.
// I will edit the 'styles' object in `components/chat/features/styles.ts` to be clean.

import { saveMedia } from '../../utils/mediaSaver';
import { MediaStorageService } from '../../storage/MediaStorageService';
import { SyncService } from '../../utils/SyncService';
import { ScheduleConfirmationModal } from '../../components/chat/features/ScheduleConfirmationModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { E2EEService } from '../../utils/E2EEService';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';
import { MediaUploadService } from '../../utils/MediaUploadService';
import { NetworkService } from '../../utils/NetworkService';
import { ApiService } from '../../utils/ApiService';

export default function ChatDetailScreen() {
    // 1. Params & Context Hooks
    const { id, user: otherUsername, avatar_id, avatar_url, is_group: isGroupParam, is_official: isOfficialParam, highlightMessageId } = useLocalSearchParams<{
        id: string,
        user: string,
        avatar_id: string,
        avatar_url?: string,
        is_group?: string,
        is_official?: string,
        highlightMessageId?: string
    }>();
    const { user: currentUser, isDbReady, safeSync, setActiveChatId } = useUser();

    // 2. Core State Hooks
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
    const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
    const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [failedMessages, setFailedMessages] = useState<any[]>([]);
    const [isReady, setIsReady] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [groupMembers, setGroupMembers] = useState<any[]>([]);
    const [relationshipStatus, setRelationshipStatus] = useState<string | null>(null);
    const [targetUserProfile, setTargetUserProfile] = useState<any>(null);
    const [inputHeight, setInputHeight] = useState(60);
    const [permissions, setPermissions] = useState({ allow_member_send_messages: true });
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);

    // 3. UI & Modal State Hooks
    const [menuVisible, setMenuVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [messageOptionsVisible, setMessageOptionsVisible] = useState(false);
    const [selectedMessageForOptions, setSelectedMessageForOptions] = useState<any>(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [canDeleteForEachOther, setCanDeleteForEachOther] = useState(false);
    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
    const [isEditorVisible, setIsEditorVisible] = useState(false);
    const [editorImageUri, setEditorImageUri] = useState<string | null>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [previewMedia, setPreviewMedia] = useState<{ type: 'image' | 'video' | 'document'; uri: string; name?: string; mimeType?: string; size?: number; duration?: number }[] | null>(null);
    const [otvUrl, setOtvUrl] = useState<string | null>(null);
    const [otvText, setOtvText] = useState<string | null>(null);
    const [otvType, setOtvType] = useState<'image' | 'video' | 'text'>('image');
    const [otvVisible, setOtvVisible] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
    const [isMediaSearching, setIsMediaSearching] = useState(false);
    const [panelActiveTab, setPanelActiveTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
    const [panelHeight, setPanelHeight] = useState(380);
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [pendingScheduleTime, setPendingScheduleTime] = useState<Date | null>(null);
    const [pendingScheduleText, setPendingScheduleText] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
    const [presenceMap, setPresenceMap] = useState<Record<string, { isOnline: boolean, lastActive?: string, isTyping: boolean }>>({});
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

    // 4. Ref Hooks
    const lastSentRef = useRef<{ text: string, media: string | null, type: string, time: number } | null>(null);
    const flatListRef = useRef<FlashList<any>>(null);
    const inputRef = useRef<TextInput>(null);
    const isAtBottomRef = useRef(true);
    const scrollOffset = useRef(0);
    const appState = useRef(AppState.currentState);
    const socket = useRef<Socket | null>(null);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);
    const lastTypingEmit = useRef<number>(0);
    const typingStopTimer = useRef<NodeJS.Timeout | null>(null);
    const autoHideTypingTimers = useRef<Record<string, NodeJS.Timeout>>({});
    const recentMessages = useRef<number[]>([]);
    const isMounted = useRef(true);
    const currentIdRef = useRef(id);
    const isFetchingRef = useRef(false);
    const isMediaSearchingRef = useRef(false);
    const sharedSecretCache = useRef<Map<string, Buffer>>(new Map());
    const translateY = useRef(new Animated.Value(0)).current;

    // --- Network & Connectivity Logic ---
    useEffect(() => {
        NetworkService.init().then(() => {
            if (!NetworkService.getIsConnected()) {
                console.log("[Chat] Initial network state: Offline");
            }
        });

        const unsubscribe = NetworkService.subscribe((connected) => {
            if (connected) {
                console.log("[Chat] Back online! Triggering retries...");
                if (currentUser?.id) {
                    SyncService.retryPendingMessages(Number(currentUser.id), (msg) => handleSend(msg.message_text, msg.media_url, msg.message_type, true, false, null, { local_db_id: msg.local_db_id, temp_id: msg.temp_id }));
                }
            }
        });

        return unsubscribe;
    }, [currentUser]);

    // Fix Race Condition Ref
    if (currentIdRef.current !== id) currentIdRef.current = id;

    // 5. Custom Hooks
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

    // 6. Basic Parsing (After hooks to ensure they are top-level)
    const isGroup = isGroupParam === '1' || isGroupParam === 'true';
    const isSelectionMode = selectedMessageIds.length > 0;

    // 7. Helper Functions (Non-Hooks)
    const deduplicateMessages = useCallback((msgs: any[]): any[] => {
        if (!msgs || msgs.length === 0) return [];
        const confirmed = new Map<string, any>();
        const localOnly = new Map<string, any>();

        for (const m of msgs) {
            if (!m) continue;
            const isLocal = m.is_local || !m.id || isNaN(Number(m.id)) || (typeof m.id === 'string' && (m.id.startsWith('temp_') || m.id.startsWith('sock_') && !m.server_id));

            if (isLocal) {
                const tempKey = `temp_${m.temp_id ?? m.id}`;
                if (!localOnly.has(tempKey) || m.media_url) {
                    localOnly.set(tempKey, m);
                }
            } else {
                const serverKey = String(m.id);
                const existing = confirmed.get(serverKey);
                if (!existing || m.status === 'seen' || (m.status === 'delivered' && existing.status !== 'seen')) {
                    confirmed.set(serverKey, m);
                }
            }
        }

        for (const [, m] of confirmed) {
            if (m.temp_id) localOnly.delete(`temp_${m.temp_id}`);
        }

        const merged = [...confirmed.values(), ...localOnly.values()];
        // Only sort if we have items
        if (merged.length > 1) {
            merged.sort((a, b) => {
                const ta = parseToDate(a.created_at || a.timestamp || 0).getTime();
                const tb = parseToDate(b.created_at || b.timestamp || 0).getTime();
                return tb - ta;
            });
        }
        return merged;
    }, []);

    const safeSetMessages = useCallback(
        (updater: any[] | ((prev: any[]) => any[])) => {
            if (!isMounted.current) return;
            setMessages(prev => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                // Optimization: If it's a small update (like a single message), we could potentially be smarter
                // but for now, just ensure deduplicateMessages is memoized and stable.
                return deduplicateMessages(next);
            });
        },
        [deduplicateMessages]
    );

    // 8. Effect Hooks
    useEffect(() => {
        safeSetMessages([]);
        setIsLoading(true);
        setFailedMessages([]);
        setReplyingToMessage(null);
        setSelectedMessageIds([]);
        setInputText('');
        setRelationshipStatus(null);
        setTargetUserProfile(null);
    }, [id]);

    useEffect(() => {
        if (!__DEV__) return;
        const seen = new Map<string, number>();
        const duplicates: string[] = [];
        messages.forEach(m => {
            const key = String(m.id);
            const count = (seen.get(key) ?? 0) + 1;
            seen.set(key, count);
            if (count === 2) duplicates.push(key);
        });
        if (duplicates.length > 0) {
            console.warn(`[DuplicateKey] ⚠️ ${duplicates.length} duplicate detected:`, duplicates);
        }
    }, [messages]);

    useEffect(() => {
        if (isGroup && currentUser) {
            fetchGroupRole();
            fetchGroupMembers();
        }
    }, [id, isGroup, currentUser]);

    useEffect(() => {
        if (!currentUser || !id) return;
        const checkMuteStatus = async () => {
            try {
                const response = await ApiService.get(`${Config.API_URL}/chat/check_mute.php?user_id=${currentUser.id}&target_id=${id}`);
                const data = await response.json();
                if (response.ok) {
                    setIsMuted(data.is_muted);
                    if (String(id) === String(currentUser.id) && !data.is_muted) {
                        await ApiService.post(`${Config.API_URL}/chat/mute_chat.php`, { user_id: currentUser.id, target_id: id, action: 'mute' });
                        setIsMuted(true);
                    }
                }
            } catch (e) { console.error("Check mute error", e); }
        };
        checkMuteStatus();
    }, [currentUser, id]);

    useEffect(() => {
        if (isDbReady && isReady && currentUser) {
            // Mark all currently unread messages as seen when entering the chat
            updateMessageStatus('seen');

            // ✅ Emit batch seen receipt via socket
            if (socket.current) {
                const socketRoom = isGroup ? `group_${id}` : `user_${id}`;
                const dbChatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

                socket.current.emit('message:seen', {
                    room: socketRoom,
                    chat_id: dbChatId,
                    sender_id: currentUser.id
                });
            }
        }
    }, [isDbReady, isReady, id, currentUser]);

    useEffect(() => {
        if (!isPanelOpen) {
            setIsMediaSearching(false);
            isMediaSearchingRef.current = false;
        }
    }, [isPanelOpen]);

    useEffect(() => {
        if (Platform.OS === 'android') return; // Android handles keyboard resizing natively with adjustResize

        const showSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
            const height = e.endCoordinates.height;
            if (height > 100) {
                setPanelHeight(height);
                if (!isMediaSearchingRef.current) setIsPanelOpen(false);
            }
            Animated.timing(translateY, { toValue: -height, duration: 250, useNativeDriver: true }).start();
        });
        const hideSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
            Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        });
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // 9. Focus Effect Hooks

    // Handlers & Logic - Defined BEFORE useFocusEffect to be used inside
    async function updateLastSeen(signal?: AbortSignal) {
        if (!currentUser) return;
        try {
            await ApiService.post(`${Config.API_URL}/users/update_online_status.php`, { user_id: currentUser.id, is_online: 1 }, { signal });
        } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Heartbeat update error", e);
        }
    }

    async function fetchMessages(signal?: AbortSignal) {
        if (!currentUser) return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

        try {
            // 1. Load initial messages from Local DB immediately
            let localRows: any[] = [];
            if (highlightMessageId) {
                localRows = await LocalDatabaseService.getMessagesUpToId(chatId, highlightMessageId);
                // Fallback if not found or empty
                if (localRows.length === 0) {
                    localRows = await LocalDatabaseService.getLocalMessages(chatId, 30);
                }
            } else {
                localRows = await LocalDatabaseService.getLocalMessages(chatId, 30);
            }

            const initialMessages = localRows.map(mapDatabaseRowToMessage);

            safeSetMessages(initialMessages);
            setHasMore(localRows.length >= 30);
            setIsLoading(false);
            setIsReady(true);

            // If we have a highlight ID, scroll to it after rendering
            if (highlightMessageId) {
                setTimeout(() => {
                    const index = localRows.findIndex((r: any) => String(r.id) === String(highlightMessageId) || String(r.server_id) === String(highlightMessageId));
                    if (index !== -1 && flatListRef.current) {
                        flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                    }
                }, 800);
            }

            // 2. Sync from Server (Fetch new messages)
            let url = `${Config.API_URL}/chat/get_messages.php?sender_id=${currentUser.id}`;
            if (isGroup) url += `&group_id=${id}`;
            else url += `&receiver_id=${id}`;

            const response = await ApiService.fetch(url, { signal });
            if (signal?.aborted) return;
            let data = await response.json();

            if (currentIdRef.current !== id) return;

            if (response.ok && data && data.length > 0) {
                for (const msg of data) {
                    try {
                        await LocalDatabaseService.insertMessage({
                            server_id: msg.id?.toString(),
                            chat_id: chatId,
                            sender_id: msg.sender_id?.toString(),
                            receiver_id: msg.receiver_id?.toString(),
                            type: msg.message_type || 'text',
                            encrypted_payload: msg.encrypted_payload || msg.message_text,
                            local_file_path: msg.media_url || undefined,
                            status: msg.status || 'delivered',
                            timestamp: msg.created_at || msg.timestamp
                        });
                    } catch (e) { }
                }

                // Refresh initial view with synced messages
                const updatedRows = await LocalDatabaseService.getLocalMessages(chatId, 30);
                safeSetMessages(updatedRows.map(mapDatabaseRowToMessage));
                setHasMore(updatedRows.length === 30);

                if (AppState.currentState === 'active') {
                    const shouldMarkRead = isGroup ? true : data.some((m: any) => String(m.sender_id) !== String(currentUser.id) && m.status !== 'seen');
                    if (shouldMarkRead) updateMessageStatus('seen');
                }
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') console.error('Error fetching messages:', error);
        } finally {
            isFetchingRef.current = false;
        }
    }

    const mapDatabaseRowToMessage = (r: any) => {
        let msgText = r.encrypted_payload;
        let mediaUrl = r.local_file_path;
        let msgType = r.type;
        let e2e_media = null;

        if (msgText && msgText.startsWith('{') && msgText.includes('"media"')) {
            try {
                const parsed = JSON.parse(msgText);
                if (parsed.media) {
                    msgText = parsed.content;
                    e2e_media = parsed.media;
                    msgType = parsed.media.mimeType && parsed.media.mimeType.includes('video') ? 'video' : 'image';
                }
            } catch (e) { }
        }

        return {
            id: r.server_id ? parseInt(r.server_id) : r.id,
            is_local: false,
            local_db_id: r.id,
            sender_id: r.sender_id,
            receiver_id: r.receiver_id,
            message_text: msgText,
            media_url: mediaUrl,
            e2e_media: e2e_media,
            message_type: msgType,
            status: r.status,
            is_deleted: r.is_deleted === 1,
            deleted_for_everyone: r.deleted_for_everyone === 1,
            is_one_time: r.is_one_time === 1,
            created_at: r.timestamp,
            sender_name: r.sender_name,
            sender_is_official: r.sender_is_official
        };
    };

    async function fetchOlderMessages() {
        if (!hasMore || isLoadingOlder || !currentUser) return;
        setIsLoadingOlder(true);

        const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

        // Use the timestamp of the last message (oldest in the inverted list)
        const oldestMessage = messages[messages.length - 1];
        if (!oldestMessage || !oldestMessage.created_at) {
            setIsLoadingOlder(false);
            return;
        }

        try {
            const olderRows = await LocalDatabaseService.getLocalMessages(chatId, 30, oldestMessage.created_at);
            if (olderRows.length > 0) {
                const olderMessages = olderRows.map(mapDatabaseRowToMessage);
                safeSetMessages(prev => [...prev, ...olderMessages]);
                setHasMore(olderRows.length === 30);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error fetching older messages:', error);
        } finally {
            setIsLoadingOlder(false);
        }
    }

    async function updateMessageStatus(status: 'delivered' | 'seen', messageIds: (string | number)[] = []) {
        if (!id || !currentUser) return;
        try {
            const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

            // Update locally first for immediate feedback
            if (status === 'seen') {
                if (messageIds.length > 0) {
                    await LocalDatabaseService.markMessagesSeenLocally(messageIds);
                } else {
                    await LocalDatabaseService.markChatRead(chatId, currentUser.id);
                }
            }

            await SyncService.reportStatus(
                Number(currentUser.id),
                Number(id),
                chatId,
                status,
                isGroup,
                messageIds
            );
        } catch (error) {
            console.error(`[ChatDetail] Error reporting ${status}:`, error);
        }
    }

    async function fetchRelationshipStatus(signal?: AbortSignal) {
        if (!currentUser || isGroup) return;
        try {
            const response = await ApiService.get(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`, { signal });
            if (signal?.aborted) return;
            const data = await response.json();
            if (response.ok) {
                const otherUser = data.find((u: any) => String(u.id) === String(id));
                if (otherUser) setRelationshipStatus(otherUser.relationship_status);
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') console.error('Error fetching relationship:', error);
        }
    }

    async function fetchGroupDetails(signal?: AbortSignal) {
        if (!isGroup) return;
        setTargetUserProfile({ id: id, username: otherUsername || 'Group', avatar_url: avatar_url, is_group: true });
    }

    async function fetchTargetUserProfile(signal?: AbortSignal) {
        if (!currentUser || isGroup) return;
        try {
            const response = await ApiService.get(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`, { signal });
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
    }

    useFocusEffect(
        React.useCallback(() => {
            if (!currentUser || !id || !isDbReady) return;

            // 1. Notifications Setup & Clean Unread
            Notifications.setNotificationHandler({
                handleNotification: async (notification) => {
                    const data = notification.request.content.data;
                    if (String(data?.conversation_id) === String(id)) return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false };
                    return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true };
                },
            });
            updateMessageStatus('seen');

            // 2. Heartbeat & Presence
            const heartbeatInterval = setInterval(() => updateLastSeen(), 30000);
            updateLastSeen();

            setIsLoading(true);
            setIsReady(false);
            const abortController = new AbortController();
            const signal = abortController.signal;

            // --- REAL-TIME SOCKET SETUP ---
            socket.current = io(Config.SOCKET_URL, {
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
            });

            socket.current.on('connect', () => {
                const socketRoom = isGroup ? `group_${id}` : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                console.log(`[Socket] Connected. Joining room: ${socketRoom}`);
                socket.current?.emit('join_room', socketRoom);

                if (currentUser) {
                    socket.current?.emit('user:identify', currentUser.id);
                    socket.current?.emit('user_online', { user_id: currentUser.id });
                    socket.current?.emit('chat_open', { chatId: id });
                }

                // [Sync] Trigger offline sync on reconnect using safeSync (lock + throttle)
                const dbChatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                SyncService.syncChat(Number(currentUser.id), Number(id), isGroup, dbChatId);

                // 3. Initial Fetch (Local + Sync) - Immediately load local data
                fetchMessages(signal);

                safeSync().then(() => {
                    // [Retry] Trigger auto-retry for failed messages
                    SyncService.retryPendingMessages(Number(currentUser.id), resendMessage);
                });
            });

            // Set active chat ID for unread count logic
            const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
            setActiveChatId(chatId);
            LocalDatabaseService.markChatRead(chatId, currentUser.id).catch(() => { });

            // Listen for user status changes (online/offline)
            socket.current.on('user_online', (data: { user_id: string }) => {
                setPresenceMap(prev => ({
                    ...prev,
                    [data.user_id]: {
                        ...prev[data.user_id],
                        isOnline: true,
                        isTyping: prev[data.user_id]?.isTyping || false
                    }
                }));
            });

            socket.current.on('user_offline', (data: { user_id: string, last_active?: string }) => {
                setPresenceMap(prev => ({
                    ...prev,
                    [data.user_id]: {
                        ...prev[data.user_id],
                        isOnline: false,
                        lastActive: data.last_active,
                        isTyping: false
                    }
                }));
            });

            socket.current.on('typing:start', (data: { user: string }) => {
                const userId = String(data.user);

                // Auto-hide if no event for 3s
                if (autoHideTypingTimers.current[userId]) {
                    clearTimeout(autoHideTypingTimers.current[userId]);
                }

                autoHideTypingTimers.current[userId] = setTimeout(() => {
                    setPresenceMap(prev => {
                        const newState = {
                            ...prev,
                            [userId]: { ...prev[userId], isTyping: false }
                        };

                        if (isGroup) {
                            const typingMembers = Object.keys(newState)
                                .filter(uid => uid !== String(id) && newState[uid]?.isTyping && groupMembers.some(m => String(m.user_id) === uid));

                            newState[String(id)] = {
                                ...newState[String(id)],
                                isTyping: typingMembers.length > 0,
                                typingMembers: typingMembers.map(uid => groupMembers.find(m => String(m.user_id) === uid)?.username).filter(Boolean)
                            } as any;
                        }
                        return newState;
                    });
                }, 3000);

                setPresenceMap(prev => {
                    const newState = {
                        ...prev,
                        [userId]: { ...prev[userId], isTyping: true }
                    };

                    // If group, update synthetic group status
                    if (isGroup) {
                        const typingMembers = Object.keys(newState)
                            .filter(uid => uid !== String(id) && newState[uid]?.isTyping && groupMembers.some(m => String(m.user_id) === uid));

                        newState[String(id)] = {
                            ...newState[String(id)],
                            isOnline: true,
                            isTyping: typingMembers.length > 0,
                            typingMembers: typingMembers.map(uid => groupMembers.find(m => String(m.user_id) === uid)?.username).filter(Boolean)
                        } as any;
                    }
                    return newState;
                });
            });

            socket.current.on('typing:stop', (data: { user: string }) => {
                const userId = String(data.user);
                if (autoHideTypingTimers.current[userId]) {
                    clearTimeout(autoHideTypingTimers.current[userId]);
                }
                setPresenceMap(prev => {
                    const newState = {
                        ...prev,
                        [userId]: { ...prev[userId], isTyping: false }
                    };

                    if (isGroup) {
                        const typingMembers = Object.keys(newState)
                            .filter(uid => uid !== String(id) && newState[uid]?.isTyping && groupMembers.some(m => String(m.user_id) === uid));

                        newState[String(id)] = {
                            ...newState[String(id)],
                            isTyping: typingMembers.length > 0,
                            typingMembers: typingMembers.map(uid => groupMembers.find(m => String(m.user_id) === uid)?.username).filter(Boolean)
                        } as any;
                    }
                    return newState;
                });
            });

            socket.current.on('message:new', async (data: any) => {
                console.log(`[Socket] 📩 Received message:new from ${data.sender_id}`, data);

                // ── Determine if this message belongs to THIS chat ──
                const belongsHere = isGroup
                    ? String(data.room) === `group_${id}`
                    : (
                        // 1-on-1: must be from the OTHER user to us
                        String(data.sender_id) === String(id) &&
                        String(data.receiver_id ?? currentUser.id) === String(currentUser.id)
                    );

                if (!belongsHere) return;

                // ── Skip own messages: we already have the optimistic message ──
                // The sender already handled state update in handleSend()
                if (String(data.sender_id) === String(currentUser.id)) return;

                // Add to Local DB
                try {
                    const dbChatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                    let decryptedPayload = data.encrypted_payload;

                    // Decrypt if 1-on-1 and encrypted
                    if (!isGroup && data.message_type === 'text' && data.encrypted_payload && data.encrypted_payload.includes(':')) {
                        try {
                            const otherId = String(data.sender_id);
                            const msgKeyVersion = data.key_version || 1;
                            const cacheKey = `${otherId}_v${msgKeyVersion}`;

                            let sharedSecret = sharedSecretCache.current.get(cacheKey);

                            if (!sharedSecret) {
                                console.log(`[Socket] Fetching specific key version ${msgKeyVersion} for ${otherId}...`);
                                // We need our private key (version 1 logic for now, but should ideally be tracked)
                                // Actually, for incoming messages, it depends on which of our public keys they used.
                                // BUT in this simplified rotation, we always encrypt for the receiver's LATEST key.
                                // So IF we are the receiver (current user), the sender used OUR latest key version at that time.
                                // The sender should have included the key_version they used.

                                const myVersion = msgKeyVersion; // Assume sender uses this version of OUR key
                                const myPrivateKey = await E2EEService.loadPrivateKey(currentUser.id, myVersion);

                                const keyRes = await fetch(`${Config.API_URL}/chat/get_latest_key.php?user_id=${otherId}`);
                                if (keyRes.ok && myPrivateKey) {
                                    const keys = await keyRes.json();
                                    if (keys && keys.public_key) {
                                        sharedSecret = E2EEService.deriveSharedSecret(myPrivateKey, keys.public_key);
                                        sharedSecretCache.current.set(cacheKey, sharedSecret);
                                    }
                                }
                            }

                            if (sharedSecret) {
                                decryptedPayload = E2EEService.decryptMessage(data.encrypted_payload, sharedSecret);
                                console.log(`[Socket] Decrypted message using key v${msgKeyVersion}`);
                            }
                        } catch (e) { console.error("Realtime decryption failed", e); }
                    }

                    // Use real server message_id if available
                    const realId = data.message_id ?? data.temp_id ?? `sock_${Date.now()}`;

                    // ✅ Standard De-duplication Check BEFORE state update
                    safeSetMessages(prev => {
                        const alreadyExists = prev.some(m => String(m.id) === String(realId) || (m.temp_id && String(m.temp_id) === String(data.temp_id)));
                        if (alreadyExists) return prev;

                        const incomingMsg = {
                            id: realId,
                            temp_id: data.temp_id,
                            sender_id: data.sender_id,
                            receiver_id: isGroup ? null : currentUser.id,
                            message_text: decryptedPayload,
                            media_url: data.media_url || null,
                            message_type: data.message_type || 'text',
                            status: 'delivered',
                            is_local: false,
                            is_one_time: !!data.is_one_time,
                            created_at: data.timestamp || new Date().toISOString(),
                            sender_name: data.sender_name
                        };

                        // ✅ Persistence for real-time messages
                        LocalDatabaseService.insertMessage({
                            server_id: String(realId),
                            temp_id: data.temp_id?.toString(),
                            chat_id: dbChatId,
                            sender_id: data.sender_id.toString(),
                            receiver_id: isGroup ? undefined : currentUser.id.toString(),
                            type: data.message_type || 'text',
                            encrypted_payload: data.encrypted_payload,
                            local_file_path: data.media_url || undefined,
                            status: 'delivered',
                            timestamp: data.timestamp,
                            sender_name: data.sender_name,
                            is_one_time: data.is_one_time ? 1 : 0
                        }).catch(e => console.warn("[Socket] Failed to persist realtime message", e));

                        return [incomingMsg, ...prev];
                    });

                    // ✅ Emit message:delivered back to sender
                    if (socket.current) {
                        const receiptRoom = isGroup ? `group_${id}` : `chat_${Math.min(Number(currentUser.id), Number(data.sender_id))}_${Math.max(Number(currentUser.id), Number(data.sender_id))}`;
                        console.log(`[Socket] 📤 Emitting message:delivered to room: ${receiptRoom}`);
                        socket.current.emit('message:delivered', {
                            room: receiptRoom,
                            message_ids: [realId],
                            chat_id: chatId,
                            sender_id: currentUser.id
                        });
                    }

                    // Mark as seen automatically if chat is open and focused
                    if (AppState.currentState === 'active' && isMounted.current) {
                        updateMessageStatus('seen', [realId]);
                        // ✅ Also emit message:seen via socket
                        if (socket.current) {
                            const receiptRoom = isGroup ? `group_${id}` : `chat_${Math.min(Number(currentUser.id), Number(data.sender_id))}_${Math.max(Number(currentUser.id), Number(data.sender_id))}`;
                            console.log(`[Socket] 👁️ Emitting message:seen to room: ${receiptRoom}`);
                            socket.current.emit('message:seen', {
                                room: receiptRoom,
                                message_ids: [realId],
                                chat_id: dbChatId,
                                sender_id: currentUser.id
                            });
                        }
                    }


                } catch (e) {
                    console.error("Socket: message:new handling error", e);
                }
            });

            if (socket.current) {
                socket.current.on('message:delivered', async (data: any) => {
                    console.log(`[Socket] Received message:delivered for ${data.message_ids?.length || 'all'} messages`);

                    // 1. Update UI: Only for messages SENT by ME
                    safeSetMessages(prev => prev.map(m => {
                        const isMessageMatch = (data.message_ids && data.message_ids.map(String).includes(String(m.id))) || !data.message_ids;
                        const isSentByMe = String(m.sender_id) === String(currentUser.id);
                        
                        if (isMessageMatch && isSentByMe && m.status !== 'seen') {
                            return { ...m, status: 'delivered' };
                        }
                        return m;
                    }));

                    // 2. Update Local DB
                    if (data.message_ids && currentUser) {
                        for (const msgId of data.message_ids) {
                            try {
                                const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                                const localRows = await LocalDatabaseService.getLocalMessages(chatId, 100);
                                const matchingRow = localRows.find(r => r.server_id === String(msgId));
                                if (matchingRow) {
                                    await LocalDatabaseService.updateMessageStatus(matchingRow.id, 'delivered');
                                }
                            } catch (e) { }
                        }
                    }
                });

                socket.current.on('message:seen', async (data: any) => {
                    console.log(`[Socket] Received message:seen for ${data.message_ids?.length || 'all'} messages`);

                    // 1. Update UI: Only for messages SENT by ME
                    safeSetMessages(prev => prev.map(m => {
                        const isMessageMatch = (data.message_ids && data.message_ids.map(String).includes(String(m.id))) || !data.message_ids;
                        const isSentByMe = String(m.sender_id) === String(currentUser.id);

                        if (isMessageMatch && isSentByMe) {
                            return { ...m, status: 'seen' };
                        }
                        return m;
                    }));

                    // 2. Update Local DB
                    if (!currentUser) return;
                    try {
                        const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                        if (data.message_ids) {
                            for (const msgId of data.message_ids) {
                                const localRows = await LocalDatabaseService.getLocalMessages(chatId, 100);
                                const matchingRow = localRows.find(r => r.server_id === String(msgId));
                                if (matchingRow) {
                                    await LocalDatabaseService.updateMessageStatus(matchingRow.id, 'seen');
                                }
                            }
                        } else {
                            await LocalDatabaseService.markAllMessagesSeen(chatId, currentUser.id);
                        }
                    } catch (e) { }
                });

                socket.current.on('message:delete', async (data: any) => {
                    try {
                        const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                        const localRows = await LocalDatabaseService.getLocalMessages(chatId);
                        const matchingRow = localRows.find(r => r.server_id === String(data.message_id));

                        if (matchingRow) {
                            if (matchingRow.local_file_path && matchingRow.local_file_path.startsWith('file://')) {
                                try {
                                    const FileSystem = require('expo-file-system');
                                    await FileSystem.deleteAsync(matchingRow.local_file_path, { idempotent: true });
                                } catch (e) { }
                            }
                            await LocalDatabaseService.markMessageDeletedForEveryone(String(data.message_id));
                        }
                    } catch (e) { }

                    safeSetMessages(prev => prev.map(m => m.id === data.message_id || String(m.id) === String(data.message_id)
                        ? { ...m, message_text: '🚫 This message was deleted', media_url: null, message_type: 'deleted', deleted_for_everyone: true }
                        : m
                    ));
                });

                // Remove old typing handlers
                // socket.current.on('typing_start', ...
                // socket.current.on('typing_stop', ...
                // --- END REAL-TIME SOCKET SETUP ---
            }

            const fetchData = async () => {
                const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

                // 1. First, always load from local database (Offline-First)
                try {
                    console.log(`[ChatDetail] Loading local messages for chatId: ${chatId}`);
                    const localRows = await LocalDatabaseService.getLocalMessages(chatId);
                    console.log(`[ChatDetail] Local database returned ${localRows.length} rows.`);

                    const mappedMessages = localRows.map(r => {
                        let msgText = r.encrypted_payload;
                        let mediaUrl = r.local_file_path;
                        let msgType = r.type;
                        let e2e_media = null;

                        if (msgText && msgText.startsWith('{') && msgText.includes('"media"')) {
                            try {
                                const parsed = JSON.parse(msgText);
                                if (parsed.media) {
                                    msgText = parsed.content;
                                    e2e_media = parsed.media;
                                    msgType = parsed.media.mimeType && parsed.media.mimeType.includes('video') ? 'video' : 'image';
                                }
                            } catch (e) { /* Not JSON or malformed */ }
                        }

                        return {
                            id: r.server_id ? parseInt(r.server_id) : r.id,
                            is_local: false, // ✅ from local DB = already confirmed
                            local_db_id: r.id,
                            sender_id: r.sender_id,
                            receiver_id: r.receiver_id,
                            message_text: msgText,
                            media_url: mediaUrl,
                            e2e_media: e2e_media,
                            message_type: msgType,
                            status: r.status,
                            is_deleted: r.is_deleted === 1,
                            deleted_for_everyone: r.deleted_for_everyone === 1,
                            is_one_time: r.is_one_time === 1,
                            created_at: r.timestamp,
                        };
                    });
                    // ✅ Initial load: safeSetMessages deduplicates automatically
                    safeSetMessages(mappedMessages);
                    // setIsLoading(false); // Keep loading until network fetch is done
                } catch (localError) {
                    console.error("[ChatDetail] Local load failed:", localError);
                }

                // 2. Then, try to fetch from server and update DB
                try {
                    console.log(`[Chat ${id}] Syncing with server...`);

                    // Parallel Fetch
                    const [msgsRes, relRes] = await Promise.all([
                        ApiService.fetch(`${Config.API_URL}/chat/get_messages.php?sender_id=${currentUser.id}&${isGroup ? `group_id=${id}` : `receiver_id=${id}`}`, { signal }),
                        !isGroup ? ApiService.fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`, { signal }) : Promise.resolve(null),
                    ]);

                    if (signal.aborted) return;

                    // 1. Messages
                    if (msgsRes.ok) {
                        let data = await msgsRes.json();

                        // --- E2EE DECRYPTION ---
                        try {
                            if (!isGroup) {
                                const otherId = String(id);
                                let sharedSecret = sharedSecretCache.current.get(otherId);

                                if (!sharedSecret) {
                                    const myVersion = await E2EEService.getCurrentKeyVersion(currentUser.id);
                                    const myPrivateKey = await E2EEService.loadPrivateKey(currentUser.id, myVersion);
                                    if (myPrivateKey) {
                                        const keyRes = await ApiService.fetch(`${Config.API_URL}/chat/get_keys.php?receiver_id=${id}`);
                                        if (keyRes.ok) {
                                            const keys = await keyRes.json();
                                            if (keys && keys.identity_key) {
                                                sharedSecret = E2EEService.deriveSharedSecret(myPrivateKey, keys.identity_key);
                                                sharedSecretCache.current.set(otherId, sharedSecret);
                                            }
                                        }
                                    }
                                }

                                if (sharedSecret) {
                                    data = data.map((msg: any) => {
                                        if (msg.message_type === 'text' && msg.message_text && msg.message_text.includes(':')) {
                                            try {
                                                const decryptedText = E2EEService.decryptMessage(msg.message_text, sharedSecret);
                                                msg.message_text = decryptedText;
                                                msg.encrypted_payload = decryptedText;
                                            } catch (e) { /* Fallback */ }
                                        }
                                        return msg;
                                    });
                                }
                            }
                        } catch (decryptErr) {
                            console.error("Decryption sweep failed:", decryptErr);
                        }
                        // --- END E2EE DECRYPTION ---

                        // --- MERGE INTO LOCAL DB ---
                        if (data && data.length > 0) {
                            for (const msg of data) {
                                try {
                                    await LocalDatabaseService.insertMessage({
                                        server_id: msg.id.toString(),
                                        chat_id: chatId,
                                        sender_id: msg.sender_id.toString(),
                                        receiver_id: msg.receiver_id?.toString(),
                                        type: msg.message_type || 'text',
                                        encrypted_payload: msg.encrypted_payload || msg.message_text,
                                        local_file_path: msg.media_url || undefined,
                                        status: msg.status || 'delivered',
                                        timestamp: msg.created_at || msg.timestamp
                                    });
                                } catch (e) { /* Ignore duplicates or errors during insert */ }
                            }
                        }

                        // Re-load UI from secure local DB after network sync
                        console.log(`[ChatDetail] Re-loading messages for chatId: ${chatId} after network sync.`);
                        const updatedLocalRows = await LocalDatabaseService.getLocalMessages(chatId);
                        const updatedMappedMessages = updatedLocalRows.map(r => {
                            let msgText = r.encrypted_payload;
                            let mediaUrl = r.local_file_path;
                            let msgType = r.type;
                            let e2e_media = null;

                            if (msgText && msgText.startsWith('{') && msgText.includes('"media"')) {
                                try {
                                    const parsed = JSON.parse(msgText);
                                    if (parsed.media) {
                                        msgText = parsed.content;
                                        e2e_media = parsed.media;
                                        msgType = parsed.media.mimeType && parsed.media.mimeType.includes('video') ? 'video' : 'image';
                                    }
                                } catch (e) { }
                            }

                            return {
                                id: r.server_id ? parseInt(r.server_id) : r.id,
                                is_local: false, // ✅ server-confirmed
                                local_db_id: r.id,
                                sender_id: r.sender_id,
                                receiver_id: r.receiver_id,
                                message_text: msgText,
                                media_url: mediaUrl,
                                e2e_media: e2e_media,
                                message_type: msgType,
                                status: r.status,
                                created_at: r.timestamp
                            };
                        });

                        // ✅ MERGE: keep any new optimistic messages sent during the network round-trip
                        safeSetMessages(prev => {
                            const localOnly = prev.filter(m => m.is_local === true);
                            return [...updatedMappedMessages, ...localOnly];
                        });
                        // Mark seen if active
                        if (AppState.currentState === 'active') {
                            const shouldMarkRead = isGroup ? true : data.some((m: any) => String(m.sender_id) !== String(currentUser.id) && m.status !== 'seen');
                            if (shouldMarkRead) updateMessageStatus('seen');
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
                        await ApiService.post(`${Config.API_URL}/users/update_last_seen.php`, { user_id: currentUser.id });
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

            const fetchPresenceState = async () => {
                const ids = isGroup ? groupMembers.map(m => m.user_id).join(',') : id;
                if (!ids) return;
                try {
                    const res = await ApiService.fetch(`${Config.API_URL}/chat/get_presence.php?ids=${ids}`, { signal });
                    if (res.ok) {
                        const data = await res.json();
                        const newMap: any = {};
                        data.forEach((p: any) => {
                            newMap[String(p.id)] = {
                                isOnline: !!p.is_online,
                                lastActive: p.last_active,
                                isTyping: false
                            };
                        });
                        setPresenceMap(prev => ({ ...prev, ...newMap }));
                    }
                } catch (e) { }
            };

            fetchData();
            fetchPresenceState();

            // Fallback Polling (Interval) - Much slower now that we have WebSockets and Unified Sync
            const interval = setInterval(() => {
                if (AppState.currentState === 'active') {
                    // Only sync incrementally, don't fetch all messages
                    const dbChatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                    SyncService.syncChat(Number(currentUser.id), Number(id), isGroup, dbChatId);
                    updateLastSeen();
                }
            }, 30000); // 30s interval is enough for fallback

            return () => {
                isMounted.current = false;
                abortController.abort();
                clearInterval(interval);
                clearInterval(heartbeatInterval);
                setActiveChatId(null);
                if (socket.current) {
                    socket.current.emit('chat_close');
                    socket.current.disconnect();
                    socket.current = null;
                }
                Notifications.setNotificationHandler({
                    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
                });
                saveLastScrollPosition();
            };
        }, [id, currentUser, isDbReady])
    );

    const handleSend = async (messageText: string = inputText, mediaPath: string | null = null, mediaType: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'gif' | 'sticker' = 'text', isRetry = false, isOneTime = false, scheduledAt: Date | null = null, extraMeta: any = {}) => {
        if (!currentUser) return null;
        if (!messageText.trim() && !mediaPath && !extraMeta?.e2e_media_payload) return null;

        // --- DEBOUNCE GUARD ---
        const now = Date.now();
        if (lastSentRef.current &&
            lastSentRef.current.text === messageText &&
            lastSentRef.current.media === mediaPath &&
            lastSentRef.current.type === mediaType &&
            (now - lastSentRef.current.time) < 1000) {
            console.log('handleSend: Debounced duplicate send');
            return null;
        }
        lastSentRef.current = { text: messageText, media: mediaPath, type: mediaType, time: now };

        console.log('handleSend called:', { messageText, mediaPath, mediaType, isOneTime, scheduledAt, isGroup });

        // Rate Limit (Skip)

        if (!mediaPath) setInputText('');
        setIsSending(true);

        const tempId = Date.now();
        const newMessage = {
            id: tempId,          // temp key — will be replaced by server ID after response
            temp_id: tempId,     // kept so we can find & replace this message in state
            sender_id: currentUser.id,
            receiver_id: isGroup ? null : id,
            group_id: isGroup ? id : null,
            message_text: messageText,
            media_url: mediaPath,
            message_type: mediaPath ? mediaType : 'text',
            is_local: true,      // ✅ marks this as unconfirmed / optimistic
            reply_to_message_id: replyingToMessage?.id || null,
            is_one_time: isOneTime ? 1 : 0,
            status: scheduledAt ? 'scheduled' : 'sending',
            created_at: new Date().toISOString(),
            ...extraMeta
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
            if (!isRetry) {
                // ✅ safeSetMessages deduplicates — rapid taps can never cause duplicate optimistic messages
                safeSetMessages(prev => [localMessage, ...prev]);
            }

            // --- LOCAL DB INSERT ---
            try {
                if (!isRetry) {
                    const dbId = await LocalDatabaseService.insertMessage({
                        temp_id: newMessage.temp_id.toString(),
                        chat_id: isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`,
                        sender_id: currentUser.id.toString(),
                        receiver_id: isGroup ? undefined : id.toString(),
                        type: newMessage.message_type,
                        encrypted_payload: newMessage.message_text || undefined,
                        local_file_path: mediaPath || undefined,
                        status: 'sending',
                        retry_count: 0,
                        sender_name: currentUser.username
                    });
                    (newMessage as any).local_db_id = dbId;
                } else {
                    (newMessage as any).local_db_id = extraMeta.local_db_id;
                }
            } catch (err) {
                console.error("Local DB Insert Error", err);
            }
        } else {
            Alert.alert("Scheduled", `Message scheduled for ${formatChatTime(scheduledAt)}`);
            setInputText('');
        }

        setReplyingToMessage(null);
        if (isRetry) setFailedMessages(prev => prev.filter(m => m.message_text !== messageText || m.media_url !== mediaPath));

        try {
            let payloadToEncrypt = messageText;
            let isMediaE2E = false;

            if (extraMeta && extraMeta.e2e_media_payload) {
                payloadToEncrypt = JSON.stringify({
                    content: messageText,
                    media: extraMeta.e2e_media_payload
                });
                isMediaE2E = true;
                messageText = payloadToEncrypt; // set as stringified JSON. Will be ciphertext if E2EE succeeds.
            }

            // --- E2EE SCRAMBLE ---
            let currentKeyVersion = 1;
            try {
                if (!isGroup && (messageText || isMediaE2E)) {
                    // 1. Get our latest private key version
                    const myVersion = await E2EEService.getCurrentKeyVersion(currentUser.id);
                    const myPrivateKey = await E2EEService.loadPrivateKey(currentUser.id, myVersion);

                    if (myPrivateKey) {
                        // 2. Fetch receiver's latest public key and version
                        const keyRes = await ApiService.fetch(`${Config.API_URL}/chat/get_latest_key.php?user_id=${id}`);
                        if (keyRes.ok) {
                            const keys = await keyRes.json();
                            if (keys && keys.public_key) {
                                currentKeyVersion = keys.key_version;
                                const sharedSecret = E2EEService.deriveSharedSecret(myPrivateKey, keys.public_key);
                                // Include version in ciphertext metadata prefix if desired,
                                // but we'll mainly use the explicit key_version field in the payload.
                                messageText = await E2EEService.encryptMessage(payloadToEncrypt || " ", sharedSecret);
                                console.log(`[E2EE] Message encrypted using receiver key v${currentKeyVersion}`);
                            }
                        }
                    }
                }
            } catch (encryptError) {
                console.error("Encryption failed, falling back or aborting:", encryptError);
            }
            // --- END E2EE SCRAMBLE ---

            const payload: any = {
                sender_id: currentUser.id,
                message: messageText,
                reply_to_message_id: newMessage.reply_to_message_id,
                is_one_time: isOneTime ? 1 : 0,
                key_version: !isGroup ? currentKeyVersion : null,
                scheduled_at: scheduledAt ? scheduledAt.toISOString() : null
            };

            // Map mediaPath to correct backend key ONLY if NOT encrypted as JSON
            // Because if it's E2EE, the server ignores native media attachments.
            if (mediaPath && !isMediaE2E) {
                if (mediaType === 'image') payload.image_path = mediaPath;
                else if (mediaType === 'video') payload.video_url = mediaPath;
                else if (mediaType === 'audio' || mediaType === 'voice') payload.audio_url = mediaPath;
                else if (mediaType === 'document') payload.file_url = mediaPath;
                else if (mediaType === 'gif') payload.gif_url = mediaPath;
                else if (mediaType === 'sticker') payload.sticker_url = mediaPath;
            }

            // Append extra metadata (duration, file_size, etc.)
            Object.assign(payload, extraMeta);
            delete payload.e2e_media_payload;

            if (isGroup) {
                payload.group_id = id;
            } else {
                payload.receiver_id = id;
            }

            const response = await ApiService.post(`${Config.API_URL}/chat/send_message.php`, payload);

            if (response.ok) {
                const data = await response.json();
                if (!scheduledAt) {
                    isAtBottomRef.current = true;
                    // --- LOCAL DB UPDATE ---
                    if ((newMessage as any).local_db_id) {
                        try {
                            await LocalDatabaseService.updateMessageStatusAndRetry((newMessage as any).local_db_id, 'sent', 0);
                            if (!isGroup) {
                                (newMessage as any).key_version = currentKeyVersion;
                                // Update local DB with the key version used
                                await LocalDatabaseService.getDB().execute(
                                    `UPDATE messages SET key_version = ? WHERE id = ?`,
                                    [currentKeyVersion, (newMessage as any).local_db_id]
                                );
                            }
                            if (data.message_id) {
                                await LocalDatabaseService.updateServerId((newMessage as any).local_db_id, String(data.message_id));
                            }
                        } catch (e) { console.error(e); }
                    }

                    // ✅ Replace optimistic temp message with server-confirmed ID + server timestamp
                    if (data.message_id) {
                        safeSetMessages(prev =>
                            prev.map(m =>
                                m.id === tempId || m.temp_id === tempId
                                    ? {
                                        ...m,
                                        id: data.message_id,
                                        temp_id: tempId,
                                        is_local: false,
                                        status: 'sent',
                                        retry_count: 0,
                                        created_at: data.created_at || m.created_at,
                                    }
                                    : m
                            )
                        );
                    }

                    // --- REALTIME SOCKET FORWARDING ---
                    if (socket.current) {
                        const targetRoom = isGroup ? `group_${id}` : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                        socket.current.emit("message:new", {
                            room: targetRoom,
                            sender_id: currentUser.id,
                            message_id: data.message_id,
                            temp_id: tempId,
                            encrypted_payload: messageText,
                            timestamp: newMessage.created_at,
                            message_type: newMessage.message_type,
                            reply_to_message_id: newMessage.reply_to_message_id,
                            is_one_time: newMessage.is_one_time,
                            media_url: newMessage.media_url,
                            key_version: !isGroup ? currentKeyVersion : null,
                            sender_name: currentUser.username
                        });
                    }
                }
                return data.message_id;
            } else {
                if (!scheduledAt) {
                    handleSendFailure(newMessage, tempId);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            if (!scheduledAt) {
                handleSendFailure(newMessage, tempId);
            }
        } finally {
            setIsSending(false);
        }
    };

    const handleSendFailure = async (newMessage: any, tempId: number) => {
        const isOnline = NetworkService.getIsConnected();
        const status = isOnline ? 'failed' : 'pending';
        const newRetryCount = (newMessage.retry_count || 0) + 1;

        if ((newMessage as any).local_db_id) {
            await LocalDatabaseService.updateMessageStatusAndRetry((newMessage as any).local_db_id, status, status === 'failed' ? newRetryCount : (newMessage.retry_count || 0));
        }

        safeSetMessages(prev => prev.map(m => (m.id === tempId || m.temp_id === tempId) ? { ...m, status: status, retry_count: newRetryCount } : m));

        if (status === 'failed') {
            setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed', retry_count: newRetryCount }]);
        }
    };

    const resendMessage = async (message: any) => {
        console.log("Resending message:", message.id);

        // Update state to 'sending'
        safeSetMessages(prev => prev.map(m => m.id === message.id ? { ...m, status: 'sending' } : m));
        if (message.local_db_id) {
            await LocalDatabaseService.updateMessageStatus(message.local_db_id, 'sending');
        }

        // Re-call handleSend but avoid adding a new local message
        // We'll pass the existing message data
        // Actually, it's cleaner to reuse the core logic but without the local push
        // Let's modify handleSend to accept an optional existing local_db_id or similar
        // For now, I will just call handleSend with isRetry=true which already handles some logic
        return handleSend(message.message_text, message.media_url, message.message_type, true, !!message.is_one_time, null, {
            reply_to_message_id: message.reply_to_message_id,
            retry_count: message.retry_count,
            local_db_id: message.local_db_id,
            temp_id: message.temp_id || message.id
        });
    };


    const handleTyping = (text: string) => {
        setInputText(text);
        if (!socket.current || !currentUser) return;

        const targetRoom = isGroup ? `group_${id}` : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
        const now = Date.now();

        if (text.length > 0) {
            // Throttled typing:start (max once per 2s)
            if (now - lastTypingEmit.current > 2000) {
                socket.current.emit('typing:start', { room: targetRoom, user: currentUser.id });
                lastTypingEmit.current = now;

                // Optional: Update last_typing in DB via API (lightweight)
                ApiService.post(`${Config.API_URL}/users/update_online_status.php`, { user_id: currentUser.id, is_typing: 1 }).catch(() => { });
            }

            // Reset idle timer for typing:stop
            if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
            typingStopTimer.current = setTimeout(() => {
                socket.current?.emit('typing:stop', { room: targetRoom, user: currentUser.id });
                lastTypingEmit.current = 0; // Reset throttle
            }, 1500);
        } else {
            // Immediate stop if text cleared
            if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
            socket.current.emit('typing:stop', { room: targetRoom, user: currentUser.id });
            lastTypingEmit.current = 0;
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
        if (!currentUser) return { success: false };
        setIsUploading(true);
        try {
            const uploadResult = await MediaUploadService.uploadMedia(asset.uri, 'image', currentUser.id, id, {
                fileName: asset.fileName || 'upload.jpg',
                mimeType: asset.type || 'image/jpeg'
            });
            return uploadResult;
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
        if (!currentUser) return { success: false };
        setIsUploading(true);
        try {
            const uploadResult = await MediaUploadService.uploadMedia(asset.uri, 'video', currentUser.id, id, {
                fileName: asset.fileName || 'video.mp4',
                duration: asset.duration ? Math.ceil(asset.duration / 1000) : undefined,
                mimeType: asset.mimeType || 'video/mp4'
            });
            return uploadResult;
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
        if (!currentUser) return { success: false };
        setIsUploading(true);
        try {
            const uploadResult = await MediaUploadService.uploadMedia(asset.uri, 'document', currentUser.id, id, {
                fileName: asset.name,
                mimeType: asset.mimeType
            });
            return uploadResult;
        } catch (e) {
            console.error("Doc upload error", e);
        } finally {
            setIsUploading(false);
        }
        return { success: false };
    };

    const uploadEncryptedFile = async (asset: any) => {
        setIsUploading(true);
        try {
            const encryptedData = await E2EEService.encryptFile(asset.uri);
            const formData = new FormData();
            formData.append('file', { uri: Platform.OS === 'android' ? encryptedData.encryptedUri : encryptedData.encryptedUri.replace('file://', ''), name: 'upload.enc', type: 'application/octet-stream' } as any);

            const response = await fetch(`${Config.API_URL}/chat/upload_encrypted_media.php`, { method: 'POST', body: formData });
            const data = await response.json();

            if (response.ok && data.success) {
                return {
                    success: true,
                    url: data.url,
                    key: encryptedData.key,
                    nonce: encryptedData.nonce,
                    tag: encryptedData.tag,
                    mimeType: asset.mimeType || asset.type
                };
            }
        } catch (e) {
            console.error("Encrypted upload error", e);
        } finally {
            setIsUploading(false);
        }
        return { success: false };
    };

    const handleMediaPreviewSend = async (caption: string, isOneTime: boolean) => {
        if (!currentUser || !previewMedia || previewMedia.length === 0) return;
        setIsPreviewVisible(false);

        const mediaItems = previewMedia;
        setPreviewMedia(null);

        for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            const itemCaption = i === 0 ? caption : '';

            let uploadResult: any = { success: false };
            let messageId: number | string | null = null;
            let finalUri = item.uri;
            let thumbnailUrl: string | undefined = undefined;
            let fileSize = item.size;

            try {
                // --- COMPRESSION & THUMBNAIL OPTIMIZATION ---
                if (item.type === 'image') {
                    finalUri = await MediaUploadService.compressImage(item.uri);
                    const sizeCheck = await MediaUploadService.validateFileSize(finalUri);
                    if (!sizeCheck.valid) {
                        Alert.alert('File too large', 'Even after compression, the image exceeds 20MB.');
                        continue;
                    }
                    fileSize = sizeCheck.size;
                } else if (item.type === 'video') {
                    const sizeCheck = await MediaUploadService.validateFileSize(item.uri);
                    if (!sizeCheck.valid) {
                        Alert.alert('File too large', 'The video exceeds the 20MB limit.');
                        continue;
                    }
                    fileSize = sizeCheck.size;

                    // Generate thumbnail
                    const thumb = await MediaUploadService.getVideoThumbnail(item.uri);
                    if (thumb) {
                        const thumbUpload = await MediaUploadService.uploadMedia(thumb, 'image', currentUser.id, id, {
                            fileName: `thumb_${Date.now()}.jpg`,
                        });
                        if (thumbUpload.success) {
                            thumbnailUrl = thumbUpload.media_url;
                        }
                    }
                }

                if (item.type === 'image') {
                    uploadResult = await MediaUploadService.uploadMedia(finalUri, 'image', currentUser.id, id, {
                        fileName: item.name || 'image.jpg',
                        mimeType: 'image/jpeg'
                    });
                    if (uploadResult?.success) {
                        messageId = await handleSend(itemCaption, uploadResult.media_url, 'image', false, isOneTime, null, {
                            file_size: fileSize,
                        });
                    }
                } else if (item.type === 'video') {
                    uploadResult = await MediaUploadService.uploadMedia(item.uri, 'video', currentUser.id, id, {
                        fileName: item.name || 'video.mp4',
                        duration: item.duration ? Math.ceil(item.duration / 1000) : undefined,
                        mimeType: item.mimeType || 'video/mp4'
                    });
                    if (uploadResult?.success) {
                        messageId = await handleSend(itemCaption, uploadResult.media_url, 'video', false, isOneTime, null, {
                            file_size: fileSize,
                            duration: item.duration ? Math.ceil(item.duration / 1000) : undefined,
                            thumbnail_url: thumbnailUrl
                        });
                    }
                } else if (item.type === 'document') {
                    const sizeCheck = await MediaUploadService.validateFileSize(item.uri);
                    if (!sizeCheck.valid) {
                        Alert.alert('File too large', 'The document exceeds the 20MB limit.');
                        continue;
                    }
                    fileSize = sizeCheck.size;

                    uploadResult = await MediaUploadService.uploadMedia(item.uri, 'document', currentUser.id, id, {
                        fileName: item.name || 'document',
                        mimeType: item.mimeType || 'application/octet-stream'
                    });
                    if (uploadResult?.success) {
                        messageId = await handleSend(itemCaption, uploadResult.media_url, 'document', false, isOneTime, null, {
                            file_size: fileSize,
                            file_name: item.name,
                            mime_type: item.mimeType,
                        });
                    }
                }
            } catch (err) {
                console.error(`[MediaPreviewSend] Optimized upload failed for ${item.type}:`, err);
            }

            if (messageId && finalUri) {
                try {
                    await MediaStorageService.copyToCache(finalUri, messageId, item.type as any);
                } catch (e) { /* non-fatal */ }
            }
        }
    };

    const lastVoiceUploadRef = useRef<{ uri: string, time: number } | null>(null);

    const uploadVoiceMessage = async (uri: string, duration: number) => {
        if (!currentUser) return;

        // --- DUPLICATION GUARD ---
        const now = Date.now();
        if (lastVoiceUploadRef.current &&
            lastVoiceUploadRef.current.uri === uri &&
            (now - lastVoiceUploadRef.current.time) < 2000) {
            console.log('Skipping duplicate voice upload trigger');
            return;
        }
        lastVoiceUploadRef.current = { uri, time: now };

        setIsUploading(true);
        try {
            const result = await MediaUploadService.uploadMedia(uri, 'audio', currentUser.id, id, {
                duration: duration,
                fileName: uri.split('/').pop() || 'voice.m4a',
                mimeType: 'audio/m4a'
            });

            if (result.success) {
                const audUrl = result.audio_url || result.media_url;
                const messageId = await handleSend('', audUrl, 'voice', false, false, null, { duration: duration });
                if (messageId) {
                    await MediaStorageService.copyToCache(uri, messageId, 'voice' as any);
                }
            } else {
                console.error("Voice upload failed:", result.message || result);
            }
        } catch (error) {
            console.error('Voice upload error', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleGifSelect = async (url: string) => {
        if (!currentUser || !id) return;
        await handleSend('', url, 'gif');
    };


    const handleStickerSend = async (url: string) => {
        if (!currentUser || !id) return;
        await handleSend('', url, 'sticker');
    };

    const handleSaveEdit = async () => {
        if (!currentUser || !editingMessage || !inputText.trim()) return;
        const originalText = editingMessage.message_text;
        const newText = inputText.trim();
        if (originalText === newText) return handleCancelEdit();
        safeSetMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, message_text: newText, is_edited: true } : m));
        handleCancelEdit();
        try {
            const response = await fetch(`${Config.API_URL}/chat/edit_message.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: editingMessage.id, user_id: currentUser?.id, new_text: newText })
            });
            if (response.ok && socket.current) {
                const targetRoom = isGroup ? `group_${id}` : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                socket.current.emit('edit_message', { room: targetRoom, message_id: editingMessage.id, new_text: newText });
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

    async function fetchGroupRole() {
        if (!currentUser || !id || !isGroup) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_group_details.php?group_id=${id}&user_id=${currentUser.id}`);
            const data = await response.json();
            if (response.ok) {
                setUserRole(data.my_role);
                setPermissions({
                    allow_member_send_messages: !!data.allow_member_send_messages,
                    // @ts-ignore - Adding other permissions if they exist in state but not yet used
                    allow_member_edit_info: !!data.allow_member_edit_info,
                    allow_member_add_members: !!data.allow_member_add_members,
                });
            }
        } catch (error) {
            console.error('Error fetching group role:', error);
        }
    }

    async function fetchGroupMembers() {
        if (!id || !isGroup) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_group_details.php?group_id=${id}`);
            const data = await response.json();
            if (response.ok && data.members) {
                setGroupMembers(data.members);
            }
        } catch (error) {
            console.error('Error fetching group members:', error);
        }
    }

    const handleMuteToggle = async () => {
        if (!currentUser || !id) return;
        const action = isMuted ? 'unmute' : 'mute';
        try {
            const response = await fetch(`${Config.API_URL}/chat/mute_chat.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    target_id: id,
                    action: action,
                    is_group: isGroup ? 1 : 0
                })
            });
            if (response.ok) {
                setIsMuted(!isMuted);
                setMenuVisible(false);
            }
        } catch (error) {
            console.error('Error toggling mute:', error);
        }
    };

    const handleUnfriend = async () => {
        if (!currentUser || !id || isGroup) return;

        setActionModalConfig({
            visible: true,
            title: 'Unfriend User?',
            description: `Are you sure you want to remove ${otherUsername} from your friends?`,
            confirmText: 'Unfriend',
            isDestructive: true,
            icon: <UserMinus size={24} color="#EF4444" />,
            onConfirm: async () => {
                setActionModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    const response = await fetch(`${Config.API_URL}/users/handle_relationship.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: currentUser.id,
                            target_id: id,
                            action: 'unfriend'
                        })
                    });
                    if (response.ok) {
                        fetchRelationshipStatus();
                        Alert.alert("Success", "User removed from friends.");
                    }
                } catch (error) {
                    console.error('Error unfriending user:', error);
                }
            }
        });
    };

    const handleConfirmSchedule = () => {
        if (pendingScheduleTime && pendingScheduleText) {
            handleSend(pendingScheduleText, null, 'text', false, false, pendingScheduleTime);
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
        if (!currentUser) return;
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
        if (!currentUser) return;
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
        if (!currentUser) return;
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
        if (!currentUser) return;
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
        if (!currentUser) return;
        const ids = Array.isArray(messageId) ? messageId : [messageId];

        try {
            const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
            const localRows = await LocalDatabaseService.getLocalMessages(chatId);

            ids.forEach(async idLocal => {
                const message = messages.find(m => m.id === idLocal);
                const localRow = localRows.find(r => parseInt(r.server_id) === idLocal || r.id === idLocal);

                if (type === 'for_me') {
                    // 1. Update UI
                    safeSetMessages(prev => prev.filter(m => m.id !== idLocal));

                    // 2. Update Local DB
                    if (localRow) {
                        await LocalDatabaseService.deleteMessageLocal(localRow.id);
                    }

                    // 3. Optional backend sync
                    fetch(`${Config.API_URL}/chat/delete_message.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message_id: idLocal, user_id: currentUser?.id, delete_type: type })
                    });
                } else if (type === 'everyone') {
                    // 1. Update UI
                    safeSetMessages(prev => prev.map(m => m.id === idLocal
                        ? { ...m, message_text: '🚫 This message was deleted', media_url: null, message_type: 'deleted', deleted_for_everyone: true }
                        : m
                    ));

                    // 2. Remove File
                    if (message && message.media_url && message.media_url.startsWith('file://')) {
                        try {
                            const FileSystem = require('expo-file-system');
                            await FileSystem.deleteAsync(message.media_url, { idempotent: true });
                        } catch (e) { }
                    }

                    // 3. Update Local DB
                    const targetServerId = message?.server_id || localRow?.server_id || idLocal;
                    await LocalDatabaseService.markMessageDeletedForEveryone(String(targetServerId));

                    // 4. Backend sync
                    fetch(`${Config.API_URL}/chat/delete_message.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message_id: idLocal, user_id: currentUser?.id, delete_type: type })
                    });

                    // 5. Emit Socket
                    if (socket.current) {
                        const targetRoom = isGroup ? `group_${id}` : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                        socket.current.emit("message:delete", {
                            room: targetRoom,
                            message_id: idLocal
                        });
                    }
                }
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
        const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id) && !m.is_one_time);

        if (selectedMsgs.length === 0 && selectedMessageIds.length > 0) {
            Alert.alert('Cannot Copy', 'One-Time View messages cannot be copied.');
            return;
        }

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
        if (msg.is_one_time) {
            Alert.alert('Cannot Save', 'One-Time View messages cannot be saved to device.');
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

                // Update Local State Optimistically - Clear content immediately after view
                safeSetMessages(prev => prev.map(m => m.id === messageId ? {
                    ...m,
                    status: 'seen',
                    message_text: null,
                    media_url: null
                } : m));

                // Persist to Local DB
                const msgToUpdate = messages.find(m => m.id === messageId);
                if (msgToUpdate && msgToUpdate.local_db_id) {
                    await LocalDatabaseService.updateMessageStatus(msgToUpdate.local_db_id, 'seen');
                }

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
                    safeSetMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'seen' } : m));

                    // Also ensure local DB is synced if server says already seen
                    const msgToUpdate = messages.find(m => m.id === messageId);
                    if (msgToUpdate && msgToUpdate.local_db_id) {
                        await LocalDatabaseService.updateMessageStatus(msgToUpdate.local_db_id, 'seen');
                    }
                }
            }
        } catch (e) {
            console.error('Failed to mark OTV as seen', e);
        }
    };

    const handleImagePress = useCallback((url: string, isOneTime?: boolean, messageId?: number) => {
        if (isOneTime && messageId) {
            handleViewOneTimeMessage(url, messageId);
        } else {
            setFullScreenImage(url);
            setIsFullScreenVisible(true);
        }
    }, [id, currentUser]); // handleViewOneTimeMessage is stable

    const handleReaction = useCallback((msgId: number, emoji: string) => { }, []);

    const renderMessage = useCallback(({ item, index }: any) => {
        if (!item) return null;
        const isMe = String(item.sender_id) === String(currentUser?.id);
        const isSelfChat = String(id) === String(currentUser?.id);

        return (
            <MessageItem
                item={item}
                index={index}
                isMe={isMe}
                isSelfChat={isSelfChat}
                isLastInGroup={item.isLastInGroup} // Use pre-calculated value
                showSenderName={item.showSenderName}
                isGroupChat={isGroup}
                currentUser={currentUser}
                id={id}
                otherUsername={otherUsername}
                targetUserProfile={targetUserProfile}
                onSwipe={setReplyingToMessage}
                onLongPress={handleLongPressMessage}
                onReaction={handleReaction}
                onDelete={handleDeleteMessage}
                onSend={handleSend}
                onImagePress={handleImagePress}
                onQuotePress={scrollToMessage}
                onForward={handleForwardMessage}
                selectedMessageId={selectedMessageId}
                selectionMode={isSelectionMode}
                isSelected={selectedMessageIds.includes(item.id)}
                onSelect={handleSelectMessage}
                selectedCount={selectedMessageIds.length}
                groupMembers={groupMembers}
                highlighted={highlightMessageId && (String(item.id) === String(highlightMessageId) || String(item.server_id) === String(highlightMessageId))}
            />
        );
    }, [
        isGroup, currentUser?.id, id, otherUsername, targetUserProfile?.id,
        selectedMessageId, isSelectionMode, selectedMessageIds.length, groupMembers.length,
        handleLongPressMessage, handleDeleteMessage, handleSend, handleImagePress,
        scrollToMessage, handleForwardMessage, handleSelectMessage, handleReaction,
        setReplyingToMessage, highlightMessageId
    ]);

    // ── STEP 5: Stable deduplicated data array for FlashList ────────────────────
    const mergedMessages = useMemo(() => {
        const start = performance.now();
        const rawMerged = deduplicateMessages([...messages, ...failedMessages]);

        // O(N) pre-pass to find "visible" neighbors (non-metadata/system messages if any)
        // In this app, most rows are visible, but we filter for content anyway.
        // Array is inverted: index 0 is bottom (newest), index N-1 is top (oldest).

        const visibleMsgs = rawMerged.filter(m =>
            !!m.message_text || !!m.media_url || m.message_type === 'sticker' ||
            m.message_type === 'voice' || !!m.is_forwarded || !!m.reply_to_message_id ||
            !!m.is_deleted || !!m.deleted_for_everyone
        );

        const FIVE_MINUTES = 5 * 60 * 1000;

        const result = rawMerged.map((item) => {
            const isMe = String(item.sender_id) === String(currentUser?.id);
            const hasContent = !!item.message_text || !!item.media_url || item.message_type === 'sticker' || item.message_type === 'voice' || !!item.is_forwarded || !!item.reply_to_message_id || !!item.is_deleted || !!item.deleted_for_everyone;

            if (!hasContent) return item;

            // Find neighbors in visibleMsgs list for cluster detection (O(1) in most cases due to adjacency)
            const vIndex = visibleMsgs.findIndex(m => m.id === item.id);
            const prevVisibleMsg = vIndex < visibleMsgs.length - 1 ? visibleMsgs[vIndex + 1] : null; // Physically ABOVE (Older)
            const nextVisibleMsg = vIndex > 0 ? visibleMsgs[vIndex - 1] : null; // Physically BELOW (Newer)

            const itemTime = parseToDate(item.created_at || 0).getTime();
            const prevTime = prevVisibleMsg ? parseToDate(prevVisibleMsg.created_at || 0).getTime() : 0;
            const nextTime = nextVisibleMsg ? parseToDate(nextVisibleMsg.created_at || 0).getTime() : 0;

            // showSenderName: TOP of cluster (Older msg is different or too far)
            const showSenderName = isGroup && !isMe && (
                !prevVisibleMsg ||
                String(prevVisibleMsg.sender_id) !== String(item.sender_id) ||
                (itemTime - prevTime) > FIVE_MINUTES
            );

            // isLastInGroup: BOTTOM of cluster (Newer msg is different or too far)
            const isLastInGroup = !nextVisibleMsg ||
                String(nextVisibleMsg.sender_id) !== String(item.sender_id) ||
                (nextTime - itemTime) > FIVE_MINUTES;

            return { ...item, isLastInGroup, showSenderName };
        });

        const end = performance.now();
        if (end - start > 16) console.warn(`[PERF] Chat list grouping took ${Math.round(end - start)}ms`);
        return result;
    }, [messages, failedMessages, currentUser?.id, isGroup, deduplicateMessages]);

    // ── STEP 6: Conditional Rendering (AFTER all hooks) ────────────────────────
    if (isCheckingLock || !isDbReady) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (isLocked && !isAuthenticated) {
        return <ChatLockScreen unlockPin={unlockPin} setUnlockPin={setUnlockPin} handleEntryUnlock={handleEntryUnlock} />;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ChatHeader
                id={id}
                otherUsername={otherUsername}
                avatar_id={avatar_id}
                avatar_url={avatar_url}
                isGroup={isGroup}
                currentUser={currentUser}
                targetUserProfile={targetUserProfile}
                presence={presenceMap[String(id)]}
                relationshipStatus={relationshipStatus}
                menuVisible={menuVisible}
                setMenuVisible={setMenuVisible}
                modalVisible={modalVisible}
                setModalVisible={setModalVisible}
                menuItems={menuItems}
                fetchRelationshipStatus={fetchRelationshipStatus}
                selectionMode={isSelectionMode}
                selectedCount={selectedMessageIds.length}
                onCancelSelection={() => setSelectedMessageIds([])}
                onDeleteSelected={handleDeleteSelected}
                onCopySelected={handleCopySelected}
                isOfficialParam={isOfficialParam}
            />

            <View style={{ flex: 1, backgroundColor: Colors.background }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    {mergedMessages.length === 0 && isReady && !isLoading && (
                        <View style={{ marginTop: 60, alignItems: 'center', width: '100%' }}>
                            <EmptyState
                                icon={MessageSquare}
                                title="No messages yet"
                                message="Start chatting!"
                                style={{ flex: 0 }}
                            />
                        </View>
                    )}
                    <FlashList
                        key={id} // 4️⃣ Force re-mount on chat change
                        ref={flatListRef}
                        data={mergedMessages}
                        inverted={true}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderMessage}
                        extraData={{
                            selectedMessageIds,
                            isSelectionMode,
                            highlightMessageId
                        }}
                        estimatedItemSize={120}
                        contentContainerStyle={{
                            ...styles.listContent,
                            paddingBottom: 20
                        }}
                        onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
                        onEndReached={fetchOlderMessages}
                        onEndReachedThreshold={0.1}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            isLoading || !isReady ? (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={Colors.primary} />
                                </View>
                            ) : null
                        }
                        ListFooterComponent={
                            isLoadingOlder ? (
                                <View style={{ paddingVertical: 10 }}>
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                </View>
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
                    ) : ((targetUserProfile?.is_official == 1 || isOfficialParam === '1' || otherUsername === 'Vegram Official' || otherUsername === 'VegramOfficial' || targetUserProfile?.username === 'VegramOfficial') && currentUser?.is_official != 1) ? (
                        <View style={{ height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.glassBorder }}>
                            <ThemedText style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Only Vegram can send messages</ThemedText>
                        </View>
                    ) : (
                        <Animated.View
                            style={[
                                styles.inputContainer,
                                {
                                    transform: [{ translateY: isPanelOpen ? 0 : translateY }]
                                }
                            ]}
                            onLayout={(e: any) => setInputHeight(e.nativeEvent.layout.height)}
                        >
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
                                onRequestSchedule={handleRequestSchedule}
                                isGroup={isGroup}
                                userRole={userRole}
                                permissions={permissions}
                                groupMembers={groupMembers}
                                isOfficialChat={targetUserProfile?.is_official == 1 && currentUser?.is_official != 1}
                            />
                        </Animated.View>
                    )}
                </KeyboardAvoidingView>
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
                onClose={() => {
                    setOtvVisible(false);
                    setOtvUrl(null);
                    setOtvText(null);
                }}
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
                        {!!selectedMessageForOptions?.media_url && !selectedMessageForOptions.is_one_time && (
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
