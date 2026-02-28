import { LocalDatabaseService } from './LocalDatabaseService';
import { Config } from '../constants/Config';
import { Platform } from 'react-native';

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

            const response = await fetch(url);
            if (!response.ok) throw new Error('Sync fetch failed');

            const messages = await response.json();

            for (const msg of messages) {
                // Duplicate prevention is handled by the "ON CONFLICT(server_id) DO UPDATE" in LocalDatabaseService.insertMessage
                await LocalDatabaseService.insertMessage({
                    server_id: msg.id.toString(),
                    chat_id: chatId,
                    sender_id: msg.sender_id.toString(),
                    receiver_id: msg.receiver_id?.toString(),
                    type: msg.message_type || 'text',
                    encrypted_payload: msg.encrypted_payload || msg.message_text,
                    status: msg.status || 'delivered',
                    timestamp: msg.created_at
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
     * Synchronizes all missed messages for the user across all chats.
     */
    static async syncMissedMessages(userId: number) {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const lastSync = await LocalDatabaseService.getLastSyncTime();
            const url = `${Config.API_URL}/chat/get_missed_messages.php?user_id=${userId}&after_time=${encodeURIComponent(lastSync)}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Global sync fetch failed');

            const messages = await response.json();
            if (!messages || messages.length === 0) {
                await LocalDatabaseService.updateLastSyncTime();
                return;
            }

            console.log(`[Sync] Synchronizing ${messages.length} missed messages...`);

            for (const msg of messages) {
                await LocalDatabaseService.insertMessage({
                    server_id: msg.id.toString(),
                    chat_id: msg.chat_id,
                    sender_id: msg.sender_id.toString(),
                    receiver_id: msg.receiver_id?.toString(),
                    type: msg.message_type || 'text',
                    encrypted_payload: msg.message_text,
                    status: msg.status || 'delivered',
                    timestamp: msg.created_at
                });

                // Update metadata for this chat to ensure names/avatars are present locally
                await LocalDatabaseService.updateChatMetadata({
                    id: msg.chat_id,
                    is_group: msg.is_group,
                    other_user_id: msg.other_user_id || undefined,
                    other_username: msg.other_username,
                    other_avatar_url: msg.other_avatar_url,
                    other_avatar_id: msg.other_avatar_id,
                    other_is_official: msg.other_is_official,
                });
            }

            // Report delivered status to senders
            for (const msg of messages) {
                const isGroupMsg = !!msg.group_id;
                const otherId = Number(msg.sender_id);
                this.reportStatus(userId, otherId, msg.chat_id, 'delivered', isGroupMsg);
            }

            // Update sync time
            const latest = messages[messages.length - 1];
            await LocalDatabaseService.updateLastSyncTime(latest.created_at);

            console.log(`[Sync] Global synchronization complete.`);
        } catch (error) {
            console.error('[Sync Error] Global sync failed:', error);
        } finally {
            this.isSyncing = false;
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

                    const response = await fetch(`${Config.API_URL}/chat/${endpoint}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

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
    static async reportStatus(currentUserId: number, otherId: number, chatId: string, status: 'delivered' | 'seen', isGroup: boolean = false) {
        try {
            const endpoint = status === 'delivered' ? 'message_delivered.php' : 'message_seen.php';
            const payload: any = { user_id: currentUserId };

            if (status === 'delivered') {
                payload.sender_id = otherId;
            } else {
                payload.target_id = isGroup ? chatId : otherId;
                payload.is_group = isGroup;
            }

            const response = await fetch(`${Config.API_URL}/chat/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Network reporting failed');
            }
        } catch (e) {
            console.log(`[Sync] Report failed, queuing ${status} for ${chatId}`);
            await LocalDatabaseService.queueStatusUpdate('0', chatId, status); // server_id 0 means bulk/latest
        }
    }
}
