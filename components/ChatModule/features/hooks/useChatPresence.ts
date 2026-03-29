import { useState, useRef, useEffect } from 'react';
import { ApiService } from '../../../../utils/ApiService';
import { Config } from '../../../../constants/Config';
import { Socket } from 'socket.io-client';

interface UseChatPresenceProps {
    currentUser: any;
    chatId: string;
    isGroup: boolean;
    groupMembers: any[];
}

export function useChatPresence({ currentUser, chatId, isGroup, groupMembers }: UseChatPresenceProps) {
    const [presenceMap, setPresenceMap] = useState<Record<string, { isOnline: boolean, lastActive?: string, isTyping: boolean, typingMembers?: string[] }>>({});
    
    // Use a ref to avoid stale closures in socket handlers
    const groupMembersRef = useRef(groupMembers);
    useEffect(() => {
        groupMembersRef.current = groupMembers;
    }, [groupMembers]);

    const lastTypingEmit = useRef<number>(0);
    const typingStopTimer = useRef<NodeJS.Timeout | null>(null);
    const autoHideTypingTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const handleTyping = (text: string, socket: Socket | null, setInputText: (text: string) => void) => {
        setInputText(text);
        if (!socket || !currentUser) return;

        const targetRoom = isGroup ? `group_${chatId}` : `chat_${Math.min(Number(currentUser.id), Number(chatId))}_${Math.max(Number(currentUser.id), Number(chatId))}`;
        const now = Date.now();

        if (text.length > 0) {
            // Throttled typing:start (max once per 2s)
            if (now - lastTypingEmit.current > 2000) {
                socket.emit('typing:start', { room: targetRoom, user: currentUser.id });
                lastTypingEmit.current = now;

                ApiService.post(`${Config.API_URL}/users/update_online_status.php`, { user_id: currentUser.id, is_typing: 1 }).catch(() => { });
            }

            // Reset idle timer for typing:stop
            if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
            typingStopTimer.current = setTimeout(() => {
                socket.emit('typing:stop', { room: targetRoom, user: currentUser.id });
                lastTypingEmit.current = 0; // Reset throttle
            }, 1500);
        } else {
            // Immediate stop if text cleared
            if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
            socket.emit('typing:stop', { room: targetRoom, user: currentUser.id });
            lastTypingEmit.current = 0;
        }
    };

    const updateTypingState = (prev: any, userId: string, isTyping: boolean) => {
        const newState = {
            ...prev,
            [userId]: { ...prev[userId], isTyping }
        };

        if (isGroup) {
            const members = groupMembersRef.current;
            const typingMembers = Object.keys(newState)
                .filter(uid => uid !== String(chatId) && newState[uid]?.isTyping && members.some((m: any) => String(m.user_id) === uid));

            newState[String(chatId)] = {
                ...newState[String(chatId)],
                isOnline: isTyping ? true : newState[String(chatId)]?.isOnline,
                isTyping: typingMembers.length > 0,
                typingMembers: typingMembers.map(uid => members.find((m: any) => String(m.user_id) === uid)?.username).filter(Boolean)
            };
        }
        return newState;
    };

    const setupPresenceListeners = (socket: Socket) => {
        socket.on('user_online', (data: { user_id: string }) => {
            setPresenceMap(prev => ({
                ...prev,
                [data.user_id]: { 
                    ...prev[data.user_id], 
                    isOnline: true, 
                    isTyping: prev[data.user_id]?.isTyping || false 
                }
            }));
        });

        socket.on('user_offline', (data: { user_id: string, last_active?: string }) => {
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

        socket.on('typing:start', (data: { user: string }) => {
            const userId = String(data.user);

            if (autoHideTypingTimers.current[userId]) {
                clearTimeout(autoHideTypingTimers.current[userId]);
            }

            autoHideTypingTimers.current[userId] = setTimeout(() => {
                setPresenceMap(prev => updateTypingState(prev, userId, false));
            }, 3000);

            setPresenceMap(prev => updateTypingState(prev, userId, true));
        });

        socket.on('typing:stop', (data: { user: string }) => {
            const userId = String(data.user);
            if (autoHideTypingTimers.current[userId]) {
                clearTimeout(autoHideTypingTimers.current[userId]);
            }
            setPresenceMap(prev => updateTypingState(prev, userId, false));
        });
    };

    return {
        presenceMap,
        setPresenceMap,
        handleTyping,
        setupPresenceListeners
    };
}
