import { useState, useRef } from 'react';
import { ApiService } from '../../../../utils/ApiService';
import { Config } from '../../../../constants/Config';
import { E2EEService } from '../../../../utils/E2EEService';
import { LocalDatabaseService } from '../../../../utils/LocalDatabaseService';
import { NetworkService } from '../../../../utils/NetworkService';
import { Socket } from 'socket.io-client';
import { Alert } from 'react-native';

interface UseChatMessageSenderProps {
    currentUser: any;
    chatId: string;
    isGroup: boolean;
    socket: Socket | null;
    replyingToMessage: any | null;
    setReplyingToMessage: (msg: any | null) => void;
    setInputText: (text: string) => void;
    safeSetMessages: (updater: (prev: any[]) => any[]) => void;
    isAtBottomRef: React.MutableRefObject<boolean>;
}

export function useChatMessageSender({
    currentUser,
    chatId,
    isGroup,
    socket,
    replyingToMessage,
    setReplyingToMessage,
    setInputText,
    safeSetMessages,
    isAtBottomRef
}: UseChatMessageSenderProps) {
    const [isSending, setIsSending] = useState(false);
    const [failedMessages, setFailedMessages] = useState<any[]>([]);
    const lastSentRef = useRef<{ text: string, media: string | null, type: string, time: number } | null>(null);

    const handleSendFailure = async (newMessage: any, tempId: string) => {
        const isOnline = NetworkService.getIsConnected();
        const status = isOnline ? 'failed' : 'pending';
        const newRetryCount = (newMessage.retry_count || 0) + 1;

        if (newMessage.local_db_id) {
            await LocalDatabaseService.updateMessageStatusAndRetry(newMessage.local_db_id, status, status === 'failed' ? newRetryCount : (newMessage.retry_count || 0));
        }

        safeSetMessages(prev => prev.map(m => (String(m.id) === String(tempId) || String(m.temp_id) === String(tempId)) ? { ...m, status: status, retry_count: newRetryCount } : m));

        if (status === 'failed') {
            setFailedMessages(prev => [...prev, { ...newMessage, status: 'failed', retry_count: newRetryCount }]);
        }
    };

    const handleSend = async (messageText: string = '', mediaPath: string | null = null, mediaType: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'gif' | 'sticker' = 'text', isRetry = false, isOneTime = false, scheduledAt: Date | null = null, extraMeta: any = {}) => {
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

        if (!mediaPath) setInputText('');
        setIsSending(true);

        const tempIdStr = `temp_${Date.now()}`;
        const newMessage = {
            id: tempIdStr,
            temp_id: tempIdStr,
            sender_id: currentUser.id,
            receiver_id: isGroup ? null : chatId,
            group_id: isGroup ? chatId : null,
            message_text: messageText,
            media_url: mediaPath,
            message_type: mediaPath ? mediaType : 'text',
            is_local: true,
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
                safeSetMessages(prev => [localMessage, ...prev]);
            }

            // --- LOCAL DB INSERT ---
            try {
                if (!isRetry) {
                    const dbId = await LocalDatabaseService.insertMessage({
                        temp_id: newMessage.temp_id.toString(),
                        chat_id: isGroup ? chatId : `chat_${Math.min(Number(currentUser.id), Number(chatId))}_${Math.max(Number(currentUser.id), Number(chatId))}`,
                        sender_id: currentUser.id.toString(),
                        receiver_id: isGroup ? undefined : chatId.toString(),
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
            Alert.alert("Scheduled", `Message scheduled`);
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
                messageText = payloadToEncrypt;
            }

            // --- E2EE SCRAMBLE ---
            let currentKeyVersion = 1;
            try {
                if (!isGroup && (messageText || isMediaE2E)) {
                    const myVersion = await E2EEService.getCurrentKeyVersion(currentUser.id);
                    const myPrivateKey = await E2EEService.loadPrivateKey(currentUser.id, myVersion);

                    if (myPrivateKey) {
                        const keyRes = await ApiService.fetch(`${Config.API_URL}/chat/get_latest_key.php?user_id=${chatId}`);
                        if (keyRes.ok) {
                            const keys = await keyRes.json();
                            if (keys && keys.public_key) {
                                currentKeyVersion = keys.key_version;
                                const sharedSecret = E2EEService.deriveSharedSecret(myPrivateKey, keys.public_key);
                                messageText = await E2EEService.encryptMessage(payloadToEncrypt || " ", sharedSecret);
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

            if (mediaPath && !isMediaE2E) {
                if (mediaType === 'image') payload.image_path = mediaPath;
                else if (mediaType === 'video') payload.video_url = mediaPath;
                else if (mediaType === 'audio' || mediaType === 'voice') payload.audio_url = mediaPath;
                else if (mediaType === 'document') payload.file_url = mediaPath;
                else if (mediaType === 'gif') payload.gif_url = mediaPath;
                else if (mediaType === 'sticker') payload.sticker_url = mediaPath;
            }

            Object.assign(payload, extraMeta);
            delete payload.e2e_media_payload;

            if (isGroup) {
                payload.group_id = chatId;
            } else {
                payload.receiver_id = chatId;
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

                    if (data.message_id) {
                        safeSetMessages(prev =>
                            prev.map(m =>
                                String(m.id) === String(tempIdStr) || String(m.temp_id) === String(tempIdStr)
                                    ? {
                                        ...m,
                                        id: data.message_id,
                                        temp_id: tempIdStr,
                                        is_local: false,
                                        status: 'sent',
                                        retry_count: 0,
                                        created_at: data.created_at || m.created_at,
                                    }
                                    : m
                            )
                        );
                    }

                    if (socket) {
                        const targetRoom = isGroup ? `group_${chatId}` : `chat_${Math.min(Number(currentUser.id), Number(chatId))}_${Math.max(Number(currentUser.id), Number(chatId))}`;
                        socket.emit("message:new", {
                            room: targetRoom,
                            sender_id: currentUser.id,
                            message_id: data.message_id,
                            temp_id: tempIdStr,
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
                    handleSendFailure(newMessage, tempIdStr);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            if (!scheduledAt) {
                handleSendFailure(newMessage, tempIdStr);
            }
        } finally {
            setIsSending(false);
        }
    };

    const resendMessage = async (message: any) => {
        console.log("Resending message:", message.id);

        safeSetMessages(prev => prev.map(m => m.id === message.id ? { ...m, status: 'sending' } : m));
        if (message.local_db_id) {
            await LocalDatabaseService.updateMessageStatus(message.local_db_id, 'sending');
        }

        return handleSend(message.message_text, message.media_url, message.message_type, true, !!message.is_one_time, null, {
            reply_to_message_id: message.reply_to_message_id,
            retry_count: message.retry_count,
            local_db_id: message.local_db_id,
            temp_id: message.temp_id || message.id
        });
    };

    return {
        isSending,
        setIsSending,
        failedMessages,
        setFailedMessages,
        handleSend,
        resendMessage
    };
}
