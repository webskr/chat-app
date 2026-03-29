import { useState, useRef } from 'react';
import { AppState } from 'react-native';
import { ApiService } from '../../../../utils/ApiService';
import { Config } from '../../../../constants/Config';
import { LocalDatabaseService } from '../../../../utils/LocalDatabaseService';
import { SyncService } from '../../../../utils/SyncService';
import { E2EEService } from '../../../../utils/E2EEService';

export function mapDatabaseRowToMessage(r: any) {
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
        server_id: r.server_id,
        temp_id: r.temp_id,
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
        sender_is_official: r.sender_is_official,
        reactions: r.reactions ? (typeof r.reactions === 'string' ? JSON.parse(r.reactions) : r.reactions).map((re: any) => ({
            userId: String(re.userId || re.user_id),
            emoji: re.emoji,
            username: re.username
        })) : []
    };
}

interface UseChatSyncProps {
    id: string;
    currentUser: any;
    isGroup: boolean;
    otherUsername?: string;
    avatar_url?: string;
    highlightMessageId?: string;
    cutoffTimestamp: string | undefined;
    currentIdRef: React.MutableRefObject<string | null>;
    sharedSecretCache: React.MutableRefObject<Map<string, Buffer>>; // or any
    groupMembers: any[];
    flatListRef: React.RefObject<any>;
    safeSetMessages: (updater: any) => void;
    setTargetUserProfile: (profile: any) => void;
    setRelationshipStatus: (status: string | null) => void;
    setPresenceMap: (updater: any) => void;
}

export function useChatSync({
    id, currentUser, isGroup, otherUsername, avatar_url, highlightMessageId, 
    cutoffTimestamp, currentIdRef, sharedSecretCache, groupMembers, flatListRef,
    safeSetMessages, setTargetUserProfile, setRelationshipStatus, setPresenceMap
}: UseChatSyncProps) {
    const isFetchingRef = useRef(false);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);

    const updateMessageStatus = async (status: 'delivered' | 'seen', messageIds: (string | number)[] = []) => {
        if (!id || !currentUser) return;
        try {
            const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

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
    };

    const syncChatData = async (signal?: AbortSignal, onComplete?: () => void) => {
        if (!currentUser || !id) return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

        try {
            console.log(`[Sync] Loading local messages for ${chatId}`);
            let localRows: any[] = [];
            if (highlightMessageId) {
                localRows = await LocalDatabaseService.getMessagesUpToId(chatId, highlightMessageId);
                if (localRows.length === 0) localRows = await LocalDatabaseService.getLocalMessages(chatId, 50, undefined, cutoffTimestamp);
            } else {
                localRows = await LocalDatabaseService.getLocalMessages(chatId, 50, undefined, cutoffTimestamp);
            }

            const initialMessages = localRows.map(mapDatabaseRowToMessage);
            safeSetMessages((prev: any[]) => [...initialMessages, ...prev]);
            
            setHasMore(localRows.length >= 50);
            if (onComplete) onComplete();

            if (highlightMessageId) {
                setTimeout(() => {
                    const index = localRows.findIndex((r: any) => String(r.id) === String(highlightMessageId) || String(r.server_id) === String(highlightMessageId));
                    if (index !== -1 && flatListRef.current) {
                        flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                    }
                }, 800);
            }

            console.log(`[Sync] Fetching server updates for ${chatId}`);
            
            const [msgsRes, relRes] = await Promise.all([
                ApiService.fetch(`${Config.API_URL}/chat/get_messages.php?sender_id=${currentUser.id}&${isGroup ? `group_id=${id}` : `receiver_id=${id}`}`, { signal }),
                !isGroup ? ApiService.fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`, { signal }) : Promise.resolve(null),
            ]);

            if (signal?.aborted) return;
            if (currentIdRef.current !== id) return;

            if (relRes && relRes.ok) {
                const users = await relRes.json();
                const other = users.find((u: any) => String(u.id) === String(id));
                if (other) {
                    setRelationshipStatus(other.relationship_status);
                    setTargetUserProfile(other);
                } else if (String(id) === String(currentUser.id)) {
                    setTargetUserProfile({ ...currentUser, bio: 'Note to self' });
                }
            } else if (isGroup) {
                setTargetUserProfile({ id: id, username: otherUsername || 'Group', avatar_url: avatar_url, is_group: true });
            }

            if (msgsRes.ok) {
                let data = await msgsRes.json();
                if (data && data.length > 0) {
                    if (!isGroup) {
                        try {
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
                                            msg.message_text = E2EEService.decryptMessage(msg.message_text, sharedSecret);
                                            msg.encrypted_payload = msg.message_text;
                                        } catch (e) { }
                                    }
                                    return msg;
                                });
                            }
                        } catch (decryptErr) { console.error("Decryption sweep failed:", decryptErr); }
                    }

                    for (const msg of data) {
                        try {
                            const msgTime = msg.created_at || msg.timestamp;
                            if (cutoffTimestamp && msgTime < cutoffTimestamp) continue;

                            await LocalDatabaseService.insertMessage({
                                server_id: msg.id?.toString(),
                                chat_id: chatId,
                                sender_id: msg.sender_id?.toString(),
                                receiver_id: msg.receiver_id?.toString(),
                                type: msg.message_type || 'text',
                                encrypted_payload: msg.encrypted_payload || msg.message_text,
                                local_file_path: msg.media_url || undefined,
                                status: msg.status || 'delivered',
                                timestamp: msg.created_at || msg.timestamp,
                                reactions: msg.reactions || []
                            });
                        } catch (e) { }
                    }

                    const updatedRows = await LocalDatabaseService.getLocalMessages(chatId, 50, undefined, cutoffTimestamp);
                    const updatedMessages = updatedRows.map(mapDatabaseRowToMessage);
                    safeSetMessages((prev: any[]) => [...updatedMessages, ...prev]);

                    if (AppState.currentState === 'active') {
                        const shouldMarkRead = isGroup ? true : data.some((m: any) => String(m.sender_id) !== String(currentUser.id) && m.status !== 'seen');
                        if (shouldMarkRead) updateMessageStatus('seen');
                    }
                }
            }

            const presenceIds = isGroup ? groupMembers.map((m: any) => m.user_id).join(',') : id;
            if (presenceIds) {
                const pRes = await ApiService.fetch(`${Config.API_URL}/chat/get_presence.php?ids=${presenceIds}`, { signal });
                if (pRes.ok) {
                    const data = await pRes.json();
                    const newMap: any = {};
                    data.forEach((p: any) => {
                        newMap[String(p.id)] = { isOnline: !!p.is_online, lastActive: p.last_active, isTyping: false };
                    });
                    setPresenceMap((prev: any) => ({ ...prev, ...newMap }));
                }
            }

        } catch (error: any) {
            if (error.name !== 'AbortError') console.error('[Sync] Consolidated fetch failed:', error);
        } finally {
            isFetchingRef.current = false;
        }
    };

    const fetchOlderMessages = async (messages: any[]) => {
        if (!hasMore || isLoadingOlder || !currentUser) return;
        setIsLoadingOlder(true);

        const chatId = isGroup ? id : `chat_${Math.min(Number(currentUser.id), Number(id))}_${Math.max(Number(currentUser.id), Number(id))}`;

        const oldestMessage = messages[messages.length - 1];
        if (!oldestMessage || !oldestMessage.created_at) {
            setIsLoadingOlder(false);
            return;
        }

        try {
            const olderRows = await LocalDatabaseService.getLocalMessages(chatId, 30, oldestMessage.created_at, cutoffTimestamp);
            if (olderRows.length > 0) {
                const olderMessages = olderRows.map(mapDatabaseRowToMessage);
                safeSetMessages((prev: any[]) => [...prev, ...olderMessages]);
                setHasMore(olderRows.length === 30);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error fetching older messages:', error);
        } finally {
            setIsLoadingOlder(false);
        }
    };

    const fetchGroupData = async (signal?: AbortSignal) => {
        if (!isGroup || !currentUser) return;
        try {
            const res = await ApiService.fetch(`${Config.API_URL}/chat/get_group_details.php?group_id=${id}&user_id=${currentUser.id}`, { signal });
            if (res.ok) {
                return await res.json();
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') console.error('fetchGroupData error:', e);
        }
        return null;
    };

    return {
        updateMessageStatus,
        syncChatData,
        fetchOlderMessages,
        fetchGroupData,
        hasMore,
        setHasMore,
        isLoadingOlder
    };
}
