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
                    status: msg.status || 'delivered'
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

                    const response = await fetch(`${Config.API_URL}/chat/update_status.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: currentUserId,
                            sender_id: update.chat_id.replace('chat_', '').split('_').find((id: string) => id !== currentUserId.toString()),
                            status: update.status
                        })
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
    static async reportStatus(currentUserId: number, otherId: number, chatId: string, status: 'delivered' | 'seen') {
        try {
            const response = await fetch(`${Config.API_URL}/chat/update_status.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUserId,
                    sender_id: otherId,
                    status: status
                })
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
