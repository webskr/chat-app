import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, Platform, Alert, Modal, Keyboard, AppState, ActivityIndicator, AlertButton, BackHandler } from 'react-native';
import { KeyboardAvoidingView, KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
// @ts-ignore
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { MessageItem } from '../../components/ChatModule/features/MessageItem';
import { ChatHeader } from '../../components/ChatModule/features/ChatHeader';
import { ChatInputBar } from '../../components/ChatModule/features/ChatInputBar';
import { ReplyPreview } from '../../components/ChatModule/features/ReplyPreview';
import { ChatAttachmentPanel } from '../../components/ChatModule/features/ChatAttachmentPanel';
import { ChatLockScreen, LockSetupModal, UnlockPromptModal } from '../../components/ChatModule/features/ChatLockUI';
import { MediaPreviewModal } from '../../components/ChatModule/features/MediaPreviewModal';
import { OneTimeViewerModal } from '../../components/ChatModule/features/OneTimeViewerModal';
import { DeleteConfirmationModal } from '../../components/ChatModule/features/DeleteConfirmationModal';
import { ActionConfirmationModal } from '../../components/ChatModule/features/ActionConfirmationModal';
import { useVoiceRecording } from '../../components/ChatModule/features/hooks/useVoiceRecording';
import { useChatLock } from '../../components/ChatModule/features/hooks/useChatLock';
import { usePermissions } from '../../components/ChatModule/features/hooks/usePermissions';
import { useChatMediaPicker } from '../../components/ChatModule/features/hooks/useChatMediaPicker';
import { useChatSelection } from '../../components/ChatModule/features/hooks/useChatSelection';
import { useChatPresence } from '../../components/ChatModule/features/hooks/useChatPresence';
import { useChatMessageSender } from '../../components/ChatModule/features/hooks/useChatMessageSender';
import { useChatSync, mapDatabaseRowToMessage } from '../../components/ChatModule/features/hooks/useChatSync';
import { styles } from '../../components/ChatModule/features/styles';
import { SecureStoreHelper } from '../../utils/SecureStoreHelper';

// Add local styles override/extension if needed or rely on importing them.
// Since 'styles' is imported from components/ChatModule/features/styles, we should probably update THAT file, 
// OR simpler: define these extra styles relative to the usage if they don't exist.
// Let's check 'components/ChatModule/features/styles.ts' content first?
// Or just inline them for now if I can't easily edit the styles file without seeing it.
// The user prompt implied designing the popup.
// I will edit the 'styles' object in `components/ChatModule/features/styles.ts` to be clean.

import { saveMedia } from '../../utils/mediaSaver';
import { MediaStorageService } from '../../storage/MediaStorageService';
import { SyncService } from '../../utils/SyncService';
import { ScheduleConfirmationModal } from '../../components/ChatModule/features/ScheduleConfirmationModal';
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
    const isGroup = isGroupParam === '1' || isGroupParam === 'true';

    // 2. Core State Hooks
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
    const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [groupMembers, setGroupMembers] = useState<any[]>([]);
    const [relationshipStatus, setRelationshipStatus] = useState<string | null>(null);
    const [targetUserProfile, setTargetUserProfile] = useState<any>(null);
    const [inputHeight, setInputHeight] = useState(60);
    const [permissions, setPermissions] = useState({ 
        allow_member_send_messages: true,
        allow_member_edit_info: false,
        allow_member_add_members: false
    });

    // 3. UI & Modal State Hooks
    const [menuVisible, setMenuVisible] = useState(false);
    const [messageOptionsVisible, setMessageOptionsVisible] = useState(false);
    const [selectedMessageForOptions, setSelectedMessageForOptions] = useState<any>(null);
    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [isFullScreenVisible, setIsFullScreenVisible] = useState(false);
    // Removed old states
    const [otvUrl, setOtvUrl] = useState<string | null>(null);
    const [otvText, setOtvText] = useState<string | null>(null);
    const [otvType, setOtvType] = useState<'image' | 'video' | 'text'>('image');
    const [otvVisible, setOtvVisible] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
    const [isMediaSearching, setIsMediaSearching] = useState(false);
    const [panelActiveTab, setPanelActiveTab] = useState<'emoji' | 'gif' | 'sticker' | 'textmoji'>('emoji');
    const [panelHeight, setPanelHeight] = useState(380);
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [pendingScheduleTime, setPendingScheduleTime] = useState<Date | null>(null);
    const [pendingScheduleText, setPendingScheduleText] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const insets = useSafeAreaInsets();
    const keyboardHeight = useSharedValue(0);

    useKeyboardHandler({
        onMove: (e) => {
            'worklet';
            keyboardHeight.value = e.height;
        },
        onEnd: (e) => {
            'worklet';
            keyboardHeight.value = e.height;
        },
    }, []);

    const animatedSpacerStyle = useAnimatedStyle(() => ({
        height: Platform.OS === 'android' ? keyboardHeight.value : 0,
    }));
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
    const flatListRef = useRef<FlashList<any>>(null);
    const inputRef = useRef<TextInput>(null);
    const isAtBottomRef = useRef(true);
    const scrollOffset = useRef(0);
    const appState = useRef(AppState.currentState);
    const socket = useRef<Socket | null>(null);
    const recentMessages = useRef<number[]>([]);
    const isMounted = useRef(true);
    const currentIdRef = useRef(id);
    const isMediaSearchingRef = useRef(false);
    const sharedSecretCache = useRef<Map<string, Buffer>>(new Map());
    // Removed translateY ref as we'll rely on KeyboardAvoidingView

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
        selectedMessageIds, setSelectedMessageIds, activeReactionMessageId, setActiveReactionMessageId,
        isSelectionMode, deleteModalVisible, setDeleteModalVisible, canDeleteForEachOther,
        handleSelectMessage, handleLongPressMessage, handleCancelSelection,
        handleDeleteSelected, handleCopySelected, handleForwardSelected, handleReplySelected
    } = useChatSelection({
        currentUser,
        chatId: isGroup ? String(id) : `chat_${Math.min(Number(currentUser?.id || 0), Number(id))}_${Math.max(Number(currentUser?.id || 0), Number(id))}`,
        messages,
        otherUsername,
        setReplyingToMessage,
        inputRef
    });

    const {
        isEditorVisible, setIsEditorVisible, editorImageUri, setEditorImageUri,
        isPreviewVisible, setIsPreviewVisible, previewMedia, setPreviewMedia,
        handlePickImage, handlePickVideo, handlePickDocument, handleLaunchCamera,
        handleEditorSend, handleMediaPreviewSend, uploadVoiceMessage
    } = useChatMediaPicker({
        currentUser,
        chatId: isGroup ? String(id) : `chat_${Math.min(Number(currentUser?.id || 0), Number(id))}_${Math.max(Number(currentUser?.id || 0), Number(id))}`,
        setIsUploading,
        handleSend: (...args) => handleSend(...args)
    });

    const {
        recordingStatus, recordingDuration, startRecording, stopRecording, cancelRecording
    } = useVoiceRecording(async (uri, duration) => {
        await uploadVoiceMessage(uri, duration);
    });

    const {
        presenceMap, setPresenceMap, handleTyping, setupPresenceListeners
    } = useChatPresence({
        currentUser,
        chatId: isGroup ? String(id) : `chat_${Math.min(Number(currentUser?.id || 0), Number(id))}_${Math.max(Number(currentUser?.id || 0), Number(id))}`,
        isGroup,
        groupMembers
    });

    usePermissions();

    // 6. Basic Parsing (After hooks to ensure they are top-level)

    // --- Auto-Delete Calculation ---
    const autoDeleteMinutes = useMemo(() => {
        if (!currentUser || !currentUser.global_auto_delete_minutes || currentUser.global_auto_delete_minutes <= 0) return 0;
        
        // 1. Check if it's a self-chat (Note to Self)
        const isSelfChat = String(id) === String(currentUser.id);
        if (isSelfChat) return 0;

        // 2. Check if it's official
        const isOfficial = isOfficialParam === '1' || isOfficialParam === 'true' || targetUserProfile?.is_official;
        if (isOfficial) return 0;

        // 3. Check group/individual enabled
        if (isGroup) {
            return currentUser.global_auto_delete_group !== 0 ? currentUser.global_auto_delete_minutes : 0;
        } else {
            return currentUser.global_auto_delete_individual !== 0 ? currentUser.global_auto_delete_minutes : 0;
        }
    }, [currentUser, id, isGroup, isOfficialParam, targetUserProfile?.is_official]);

    const cutoffTimestamp = useMemo(() => {
        if (autoDeleteMinutes <= 0) return undefined;
        // Use a 5-second buffer to avoid immediate race conditions with recently synced messages 
        // that might have slightly skewed timestamps from server vs local time.
        return new Date(Date.now() - (autoDeleteMinutes * 60 * 1000)).toISOString();
    }, [autoDeleteMinutes]);

    // 7. Helper Functions (Non-Hooks)
    const deduplicateMessages = useCallback((msgs: any[]): any[] => {
        if (!msgs || msgs.length === 0) return [];
        const map = new Map<string, any>();

        for (const m of msgs) {
            if (!m) continue;
            
            // Priority-based unique key: server_id > temp_id > id
            let key = '';
            if (m.server_id) {
                key = String(m.server_id);
            } else if (m.temp_id) {
                // Ensure temp_ id is always handled consistently
                key = String(m.temp_id).startsWith('temp_') ? String(m.temp_id) : `temp_${m.temp_id}`;
            } else {
                key = `id_${m.id}`;
            }
            
            const existing = map.get(key);
            const statusPriority = { 'seen': 3, 'delivered': 2, 'sent': 1, 'sending': 0, 'failed': -1, 'pending': -1 };
            const getPrio = (s: string) => (statusPriority[s as keyof typeof statusPriority] ?? 0);

            if (!existing || getPrio(m.status) > getPrio(existing.status) || (!existing.server_id && m.server_id)) {
                map.set(key, m);
            }
        }

        const merged = Array.from(map.values());
        merged.sort((a, b) => {
            const ta = parseToDate(a.created_at || a.timestamp || 0).getTime();
            const tb = parseToDate(b.created_at || b.timestamp || 0).getTime();
            return tb - ta;
        });
        return merged;
    }, []);

    const safeSetMessages = useCallback(
        (updater: any[] | ((prev: any[]) => any[])) => {
            if (!isMounted.current) return;
            setMessages(prev => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                const result = deduplicateMessages(next);
                console.log(`[Chat-Debug] Messages updated. Count: ${result.length}, Newest ID: ${result[0]?.id}, Status: ${result[0]?.status}`);
                return result;
            });
        },
        [deduplicateMessages]
    );

    const {
        isSending, setIsSending, failedMessages, setFailedMessages, handleSend, resendMessage
    } = useChatMessageSender({
        currentUser,
        chatId: isGroup ? String(id) : `chat_${Math.min(Number(currentUser?.id || 0), Number(id))}_${Math.max(Number(currentUser?.id || 0), Number(id))}`,
        isGroup,
        socket: socket.current,
        replyingToMessage,
        setReplyingToMessage,
        setInputText,
        safeSetMessages,
        isAtBottomRef
    });

    const {
        updateMessageStatus,
        syncChatData,
        fetchOlderMessages,
        fetchGroupData,
        hasMore,
        isLoadingOlder
    } = useChatSync({
        id: String(id), currentUser, isGroup, otherUsername, avatar_url, highlightMessageId, 
        cutoffTimestamp, currentIdRef, sharedSecretCache, groupMembers, flatListRef,
        safeSetMessages, setTargetUserProfile, setRelationshipStatus, setPresenceMap
    });

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
            fetchGroupData();
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
        const backAction = () => {
            if (activeReactionMessageId || selectedMessageIds.length > 0) {
                setActiveReactionMessageId(null);
                setSelectedMessageIds([]);
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [activeReactionMessageId, selectedMessageIds]);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, (e) => {
            setIsKeyboardVisible(true);
            const height = e.endCoordinates.height;
            if (height > 100) {
                setPanelHeight(height);
                if (!isMediaSearchingRef.current) setIsPanelOpen(false);
            }
        });
        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            setIsKeyboardVisible(false);
        });
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    useEffect(() => {
        // Trigger background purge of old messages when entering a chat if timer is active
        if (isDbReady && id && autoDeleteMinutes > 0 && currentUser) {
            const dbChatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
            LocalDatabaseService.purgeOldMessages(dbChatId, autoDeleteMinutes)
                .then(() => {
                    // Pre-emptively filter local state if needed (though getLocalMessages handles it)
                })
                .catch(e => console.error("[AutoDelete] Purge failed:", e));
        }
    }, [isDbReady, id, autoDeleteMinutes, isGroup, currentUser?.id]);

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

                // Synchronize non-E2EE metadata/messages via Unified Sync
                safeSync().then(() => {
                    // [Retry] Trigger auto-retry for failed messages
                    SyncService.retryPendingMessages(Number(currentUser.id), resendMessage);
                });
            });

            // Set active chat ID for unread count logic
            const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
            setActiveChatId(chatId);
            LocalDatabaseService.markChatRead(chatId, currentUser.id).catch(() => { });

            // Listen for user status changes and typing state
            setupPresenceListeners(socket.current);

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


            // Initial Data Sync
            syncChatData(signal);

            // Fallback Polling (Interval) - Much slower now that we have WebSockets and Unified Sync
            const interval = setInterval(() => {
                if (AppState.currentState === 'active' && currentUser) {
                    const dbChatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;
                    SyncService.syncChat(Number(currentUser.id), Number(id), isGroup, dbChatId);
                    updateLastSeen(signal);
                }
            }, 60000);


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

    const handleTypingWrapper = (text: string) => {
        handleTyping(text, socket.current, setInputText);
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

    // Media Picker Logic Moved to useChatMediaPicker

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
                        await syncChatData();
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
                        syncChatData();
                    } else {
                        Alert.alert("Error", data.message || "Failed to update block status.");
                    }
                } catch (e) { console.error("Block error", e); }
            }
        });
    };

    // --- Selection Mode Handlers ---
    const handleDeleteMessage = (messageId?: number, type: 'for_me' | 'everyone' = 'for_me') => {
        if (String(id) === String(currentUser?.id)) {
            Alert.alert('Note to Self', 'Messages in Note to Self cannot be deleted.');
            return;
        }
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
        if (!currentUser || String(id) === String(currentUser?.id)) return;
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

    // Selection and Bulk Action Logic Moved to useChatSelection

    const handleMediaSelect = useCallback((type: string, content: string) => {
        if (type === 'emoji' || type === 'textmoji') {
            if (content === 'BACKSPACE') {
                setInputText(prev => prev.slice(0, -1));
            } else {
                setInputText(prev => prev + content);
            }
        } else if (type === 'gif') {
            handleGifSelect(content);
            setIsPanelOpen(false);
        } else if (type === 'sticker') {
            handleStickerSend(content);
            setIsPanelOpen(false);
        }
    }, [handleGifSelect, handleStickerSend]);

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
                    router.push(`/user/${id}`);
                }
            }
        },
        ...(String(id) !== String(currentUser?.id) ? [
            { label: isMuted ? 'Unmute Notifications' : 'Mute Notifications', icon: BellOff, onPress: handleMuteToggle }
        ] : []),
        { label: isLocked ? 'Unlock Chat' : 'Lock Chat', icon: isLocked ? Unlock : Lock, onPress: () => isLocked ? setShowUnlockPrompt(true) : setShowLockSetup(true) },
        ...(String(id) !== String(currentUser?.id) ? [
            { label: 'Clear Messages', icon: Trash2, onPress: handleClearChat }
        ] : []),
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

    const handleReaction = useCallback(async (msgId: number, emoji: string) => {
        if (!currentUser) return;

        // Optimistic state update
        safeSetMessages(prev => prev.map(m => {
            if (m.id !== msgId) return m;
            const existing: any[] = m.reactions || [];
            const myReactionIdx = existing.findIndex((r: any) => String(r.userId) === String(currentUser.id));

            let updated: any[];
            if (myReactionIdx !== -1 && existing[myReactionIdx].emoji === emoji) {
                // Same emoji tapped again → remove
                updated = existing.filter((_: any, i: number) => i !== myReactionIdx);
            } else if (myReactionIdx !== -1) {
                // Different emoji → replace
                updated = existing.map((r: any, i: number) =>
                    i === myReactionIdx ? { ...r, emoji } : r
                );
            } else {
                // New reaction
                updated = [...existing, { userId: String(currentUser.id), emoji, username: currentUser.username }];
            }
            const result = { ...m, reactions: updated };
            
            // Persist to local DB immediately
            if (m.local_db_id) {
                LocalDatabaseService.getDB().execute(
                    `UPDATE messages SET reactions = ? WHERE id = ?`,
                    [JSON.stringify(updated), m.local_db_id]
                ).catch((err: any) => console.error('[Reaction] Local DB update failed:', err));
            }
            
            return result;
        }));

        // Persist to backend
        try {
            await ApiService.post(`${Config.API_URL}/chat/toggle_reaction.php`, {
                message_id: msgId,
                user_id: currentUser.id,
                emoji,
            });
        } catch (e) {
            console.error('[Reaction] Failed to save reaction', e);
        }

        // Close the reaction picker
        setActiveReactionMessageId(null);
        setSelectedMessageIds([]);
    }, [currentUser, safeSetMessages]);

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
                activeReactionMessageId={activeReactionMessageId}
                setActiveReactionMessageId={setActiveReactionMessageId}
                highlighted={highlightMessageId && (String(item.id) === String(highlightMessageId) || String(item.server_id) === String(highlightMessageId))}
            />
        );
    }, [
        isGroup, currentUser?.id, id, otherUsername, targetUserProfile?.id,
        selectedMessageId, isSelectionMode, selectedMessageIds.length, groupMembers.length,
        activeReactionMessageId,
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
            const itemIdStr = String(item.id);
            const vIndex = visibleMsgs.findIndex(m => String(m.id) === itemIdStr);
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
        <SafeAreaView style={styles.container} edges={['top']}>
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
                menuItems={menuItems}
                fetchRelationshipStatus={syncChatData}
                selectionMode={isSelectionMode}
                selectedCount={selectedMessageIds.length}
                onCancelSelection={() => {
                    setSelectedMessageIds([]);
                    setActiveReactionMessageId(null);
                }}
                onDeleteSelected={handleDeleteSelected}
                onCopySelected={handleCopySelected}
                onForwardSelected={handleForwardSelected}
                onReplySelected={handleReplySelected}
                isOfficialParam={isOfficialParam}
            />

            <View style={{ flex: 1, backgroundColor: Colors.background }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
                            highlightMessageId,
                            activeReactionMessageId
                        }}
                        estimatedItemSize={120}
                        contentContainerStyle={{
                            ...styles.listContent,
                            paddingBottom: 20
                        }}
                        onScroll={(e) => { 
                            scrollOffset.current = e.nativeEvent.contentOffset.y; 
                        }}
                        onScrollBeginDrag={() => {
                            if (activeReactionMessageId) setActiveReactionMessageId(null);
                        }}
                        onEndReached={() => fetchOlderMessages(messages)}
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
                    <Animated.View style={animatedSpacerStyle} />

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
                        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
                            <View
                                style={[
                                    styles.inputContainer,
                                    { paddingBottom: isKeyboardVisible ? 4 : Math.max(8, insets.bottom) }
                                ]}
                                onLayout={(e: any) => setInputHeight(e.nativeEvent.layout.height)}
                            >
                                <ReplyPreview replyingToMessage={replyingToMessage} currentUser={currentUser} onCancel={() => setReplyingToMessage(null)} />
                                <ChatInputBar
                                    inputText={inputText}
                                    editingMessage={editingMessage}
                                    handleTyping={handleTypingWrapper}
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
                                    bottomInset={insets.bottom}
                                    isKeyboardVisible={isKeyboardVisible}
                                />
                            </View>
                        </KeyboardStickyView>
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
                        {String(id) !== String(currentUser?.id) && (
                            <TouchableOpacity style={styles.modalOption} onPress={() => { setMessageOptionsVisible(false); handleDeleteMessage(selectedMessageForOptions?.id, 'for_me'); }}>
                                <Trash size={20} color="#EF4444" /><ThemedText style={[styles.modalOptionText, { color: '#EF4444' }]}>Delete for me</ThemedText>
                            </TouchableOpacity>
                        )}
                        {String(selectedMessageForOptions?.sender_id) === String(currentUser?.id) && String(id) !== String(currentUser?.id) && (
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
