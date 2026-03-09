import { LocalDatabaseService } from './LocalDatabaseService';
import { Config } from '../constants/Config';
import { Platform } from 'react-native';
import { ApiService } from './ApiService';

export class SyncService {
    private static isSyncing = false;
    private static isProcessingQueue = false;

    /**
     * Synchronizes missing messages for a specific chat.
     * Fetches only messages after the last stored server_id.
     */
    static async syncChat(currentUserId: number, otherId: number, isGroup: boolean, chatId: string) {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const lastServerId = await LocalDatabaseService.getLastServerId(chatId);

            let url = `${Config.API_URL}/chat/get_messages.php?sender_id=${currentUserId}&after_id=${lastServerId || 0}`;
            if (isGroup) {
                url += `&group_id=${otherId}`;
            } else {
                url += `&receiver_id=${otherId}`;
            }

            const response = await ApiService.fetch(url);
            if (!response.ok) throw new Error('Sync fetch failed');

            const messages = await response.json();

            for (const msg of messages) {
                // Duplicate prevention is handled by the "ON CONFLICT(server_id) DO UPDATE" in LocalDatabaseService.insertMessage
                await LocalDatabaseService.insertMessage({
                    server_id: msg.id?.toString(),
                    chat_id: chatId,
                    sender_id: msg.sender_id?.toString(),
                    receiver_id: msg.receiver_id?.toString(),
                    type: msg.message_type || 'text',
                    encrypted_payload: msg.encrypted_payload || msg.message_text,
                    status: msg.status || 'delivered',
                    timestamp: msg.created_at,
                    sender_name: msg.sender_name
                });
            }

            // Sync metadata for this chat to ensure names/avatars are present locally
            if (messages.length > 0) {
                const latest = messages[messages.length - 1];
                await LocalDatabaseService.updateChatMetadata({
                    id: chatId,
                    is_group: isGroup,
                    other_user_id: isGroup ? undefined : String(otherId),
                    other_username: latest.other_username,
                    other_avatar_url: latest.other_avatar_url,
                    other_avatar_id: latest.other_avatar_id,
                    other_is_official: latest.other_is_official,
                    group_name: latest.group_name,
                    group_icon: latest.group_icon,
                    unread_count: 0 // Resetting unread locally usually happens on chat open
                });
            }

            console.log(`[Sync] Synchronized ${messages.length} messages for chat ${chatId}`);
        } catch (error) {
            console.error('[Sync Error] Chat sync failed:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Synchronizes all missed messages, conversations, and presence for the user.
     */
    static async syncEverything(userId: number) {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const lastSync = await LocalDatabaseService.getLastSyncTime();

            let response: Response;
            try {
                response = await ApiService.post(`${Config.API_URL}/chat/sync.php`, {
                    user_id: userId,
                    last_sync_time: lastSync
                });
            } catch (networkError: any) {
                // Network-level failure (no connection, DNS failure, auth throw, etc.)
                console.warn(`[Sync] Network/auth error reaching sync.php: ${networkError?.message}`);
                return;
            }

            if (!response.ok) {
                // Log the actual HTTP status and body for easy diagnosis
                let body = '';
                try { body = await response.text(); } catch (_) { }
                console.warn(`[Sync] sync.php returned HTTP ${response.status}: ${body.substring(0, 300)}`);
                return; // Graceful non-throw - will retry on next safeSync cycle
            }

            let data: any;
            try {
                data = await response.json();
            } catch (parseError) {
                console.warn('[Sync] sync.php response is not valid JSON. Possible PHP error output contaminating response.');
                return;
            }

            const { messages = [], conversations = [], presence = [], sync_time } = data;

            console.log(`[Sync] Synchronizing ${messages.length} messages and ${conversations.length} conversations...`);

            // 1. Update Messages
            for (const msg of messages) {
                await LocalDatabaseService.insertMessage({
                    server_id: msg.id?.toString(),
                    chat_id: msg.chat_id,
                    sender_id: msg.sender_id?.toString(),
                    receiver_id: msg.receiver_id?.toString(),
                    type: msg.message_type || 'text',
                    encrypted_payload: msg.message_text,
                    status: msg.status || 'delivered',
                    timestamp: msg.created_at,
                    sender_name: msg.sender_name
                });
            }

            // 2. Update Conversations Metadata
            for (const conv of conversations) {
                const chatId = conv.is_group
                    ? String(conv.group_id)
                    : "chat_" + Math.min(Number(userId), Number(conv.other_user_id || (conv.user1_id == userId ? conv.user2_id : conv.user1_id))) + "_" + Math.max(Number(userId), Number(conv.other_user_id || (conv.user1_id == userId ? conv.user2_id : conv.user1_id)));

                await LocalDatabaseService.updateChatMetadata({
                    id: chatId,
                    is_group: !!conv.is_group,
                    other_user_id: conv.is_group ? undefined : String(conv.other_user_id || (conv.user1_id == userId ? conv.user2_id : conv.user1_id)),
                    other_username: conv.is_group ? conv.group_name : undefined,
                    group_name: conv.group_name,
                    group_icon: conv.group_icon,
                    other_avatar_url: conv.is_group ? conv.group_icon : undefined,
                    unread_count: conv.unread_count
                });
            }

            // 3. Mark delivered for new messages (batch)
            if (messages.length > 0) {
                const messageIds = messages.map((m: any) => m.id);
                this.reportStatus(userId, 0, 'ALL', 'delivered', false, messageIds);
            }

            // 4. Update sync time
            if (sync_time) {
                await LocalDatabaseService.updateLastSyncTime(sync_time);
            }

            console.log(`[Sync] Unified synchronization complete.`);
            return data;
        } catch (error) {
            console.warn('[Sync] Unexpected error during sync (non-fatal):', error);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Finds and retries messages that are in 'failed' or 'pending' state.
     * Retries chronologically (oldest first).
     */
    static async retryPendingMessages(userId: number, resendFn: (msg: any) => Promise<any>) {
        try {
            const pendingMessages = await LocalDatabaseService.getFailedMessages();
            if (pendingMessages.length === 0) return;

            console.log(`[Sync] Found ${pendingMessages.length} pending/failed messages to retry.`);

            for (const msg of pendingMessages) {
                // Map DB row to message object expected by resendFn
                const messageObj = {
                    id: msg.server_id ? parseInt(msg.server_id) : msg.id,
                    temp_id: msg.temp_id || msg.id,
                    local_db_id: msg.id,
                    message_text: msg.encrypted_payload,
                    media_url: msg.local_file_path,
                    message_type: msg.type,
                    status: msg.status,
                    retry_count: msg.retry_count,
                    reply_to_message_id: msg.reply_to_message_id
                };

                try {
                    console.log(`[Sync] Retrying message id=${msg.id}, type=${msg.type}`);
                    await resendFn(messageObj);
                } catch (sendError) {
                    console.error(`[Sync] Individual message retry failed:`, sendError);
                    // Update status to pending if it wasn't already, so it stays in queue
                    await LocalDatabaseService.updateMessageStatus(msg.id, 'pending');
                    // We continue to next message in queue, or should we stop? 
                    // Usually we stop if it's a network error, but handleSend might handle that.
                }
            }
        } catch (error) {
            console.error('[Sync Error] retryPendingMessages failed:', error);
        }
    }

    /**
     * Processes the status update retry queue.
     * Attempts to send queued 'delivered'/'seen' statuses to the server.
     */
    static async processRetryQueue(currentUserId: number) {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        try {
            const queuedUpdates = await LocalDatabaseService.getQueuedStatusUpdates();
            if (queuedUpdates.length === 0) return;

            console.log(`[Sync] Processing ${queuedUpdates.length} queued status updates...`);

            for (const update of queuedUpdates) {
                try {
                    // Update: Our backend update_status.php purges messages on 'delivered'/'seen'
                    // We need to send our own ID (receiver) and the sender's ID (which we can derive from chat_id or server_id)
                    // For simplicity, let's assume server_id is enough if we had a per-message update, 
                    // but update_status.php works per conversation.

                    // Actually, update_status.php takes {user_id, sender_id, status}.
                    // We need the sender_id. We might need to store it in the queue or 
                    // fetch it from the messages table by server_id.

                    const endpoint = update.status === 'delivered' ? 'message_delivered.php' : 'message_seen.php';
                    const payload: any = {
                        user_id: currentUserId,
                    };

                    if (update.status === 'delivered') {
                        payload.sender_id = update.chat_id.replace('chat_', '').split('_').find((id: string) => id !== currentUserId.toString());
                    } else {
                        // seen
                        const isGroup = !update.chat_id.startsWith('chat_');
                        payload.target_id = isGroup ? update.chat_id : update.chat_id.replace('chat_', '').split('_').find((id: string) => id !== currentUserId.toString());
                        payload.is_group = isGroup;
                    }

                    const response = await ApiService.post(`${Config.API_URL}/chat/${endpoint}`, payload);

                    if (response.ok) {
                        await LocalDatabaseService.deleteQueuedStatusUpdate(update.id);
                    }
                } catch (e) {
                    // Fail silently, will retry next time
                }
            }
        } catch (error) {
            console.error('[Sync Error] Retry queue processing failed:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Helper to report status and handle offline queuing
     */
    static async reportStatus(
        currentUserId: number,
        otherId: number,
        chatId: string,
        status: 'delivered' | 'seen',
        isGroup: boolean = false,
        messageIds: (string | number)[] = []
    ) {
        try {
            const payload: any = {
                user_id: currentUserId,
                message_ids: messageIds
            };

            if (status === 'seen') {
                payload.target_id = isGroup ? chatId : otherId;
                payload.is_group = isGroup;
            } else if (status === 'delivered' && messageIds.length === 0) {
                payload.sender_id = otherId;
            }

            const response = await ApiService.post(`${Config.API_URL}/chat/mark_seen_batch.php`, payload);

            if (!response.ok) {
                throw new Error('Network reporting failed');
            }
        } catch (e) {
            console.log(`[Sync] Report failed, queuing ${status} for ${chatId}`);
            // Queueing for multiple IDs could be complex, for now we queue conversation-wide or per-message if needed
            if (messageIds.length > 0) {
                for (const id of messageIds) {
                    await LocalDatabaseService.queueStatusUpdate(id.toString(), chatId, status);
                }
            } else {
                await LocalDatabaseService.queueStatusUpdate('0', chatId, status);
            }
        }
    }
}
