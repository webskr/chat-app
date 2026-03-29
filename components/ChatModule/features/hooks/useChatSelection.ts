import { useState } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { formatChatTime } from '../../../../utils/time';

interface UseChatSelectionProps {
    currentUser: any;
    chatId: string;
    messages: any[];
    otherUsername: string;
    setReplyingToMessage: (msg: any) => void;
    inputRef: React.RefObject<any>;
}

export function useChatSelection({ currentUser, chatId, messages, otherUsername, setReplyingToMessage, inputRef }: UseChatSelectionProps) {
    const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
    const [activeReactionMessageId, setActiveReactionMessageId] = useState<number | null>(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [canDeleteForEachOther, setCanDeleteForEachOther] = useState(false);

    const isSelectionMode = selectedMessageIds.length > 0;

    const handleSelectMessage = (messageId: number) => {
        if (selectedMessageIds.includes(messageId)) {
            setSelectedMessageIds(prev => prev.filter(id => id !== messageId));
        } else {
            setSelectedMessageIds(prev => [...prev, messageId]);
        }
    };

    const handleLongPressMessage = (message: any) => {
        if (!isSelectionMode) {
            setActiveReactionMessageId(message.id);
            setSelectedMessageIds([message.id]);
        } else {
            handleSelectMessage(message.id);
        }
    };

    const handleCancelSelection = () => {
        setSelectedMessageIds([]);
        setActiveReactionMessageId(null);
    };

    const handleDeleteSelected = () => {
        if (String(chatId) === String(currentUser?.id)) {
            Alert.alert('Note to Self', 'Messages in Note to Self cannot be deleted.');
            return;
        }
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
            .map(m => `[${formatChatTime(m.created_at || new Date())}] ${m.sender_id === currentUser?.id ? 'You' : otherUsername}: ${m.message_text || (m.media_url ? '[Media]' : '')}`)
            .join('\n');

        await Clipboard.setStringAsync(textToCopy);
        setSelectedMessageIds([]);
    };

    const handleForwardSelected = () => {
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

    const handleReplySelected = () => {
        if (selectedMessageIds.length === 1) {
            const msg = messages.find(m => m.id === selectedMessageIds[0]);
            if (msg) {
                setReplyingToMessage(msg);
                setSelectedMessageIds([]);
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    };

    return {
        selectedMessageIds,
        setSelectedMessageIds,
        activeReactionMessageId,
        setActiveReactionMessageId,
        isSelectionMode,
        deleteModalVisible,
        setDeleteModalVisible,
        canDeleteForEachOther,
        handleSelectMessage,
        handleLongPressMessage,
        handleCancelSelection,
        handleDeleteSelected,
        handleCopySelected,
        handleForwardSelected,
        handleReplySelected
    };
}
