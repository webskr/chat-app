import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { ChevronLeft, Send, Image as ImageIcon, Smile, MoreVertical } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';

const MOCK_MESSAGES = [
    { id: '1', text: 'Hey! Are we still on for tonight?', senderId: 'friend', time: '10:30 AM' },
    { id: '2', text: 'Yes, definitely! What time?', senderId: 'me', time: '10:31 AM' },
    { id: '3', text: 'How about 7:30?', senderId: 'friend', time: '10:32 AM' },
    { id: '4', text: 'Sounds good to me. See you then!', senderId: 'me', time: '10:33 AM' },
];

export default function ChatDetailScreen() {
    const { id, user } = useLocalSearchParams<{ id: string, user: string }>();
    const [messages, setMessages] = useState(MOCK_MESSAGES);
    const [inputText, setInputText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const handleSend = () => {
        if (inputText.trim()) {
            const newMessage = {
                id: Date.now().toString(),
                text: inputText.trim(),
                senderId: 'me',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages([...messages, newMessage]);
            setInputText('');
        }
    };

    useEffect(() => {
        // Scroll to bottom when messages change
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    const renderMessage = ({ item }: { item: typeof MOCK_MESSAGES[0] }) => {
        const isMe = item.senderId === 'me';
        return (
            <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.friendMessage]}>
                {!isMe && <Avatar source={getAvatarById(id)} size={32} style={styles.messageAvatar} />}
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.friendBubble]}>
                    <ThemedText style={styles.messageText}>{item.text}</ThemedText>
                    <ThemedText style={styles.messageTime}>{item.time}</ThemedText>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Avatar source={getAvatarById(id)} online={true} size={40} />
                    <View style={styles.nameContainer}>
                        <ThemedText type="defaultSemiBold">{user}</ThemedText>
                        <ThemedText type="caption" style={{ color: Colors.online }}>Online</ThemedText>
                    </View>
                </View>
                <TouchableOpacity style={styles.moreButton}>
                    <MoreVertical size={24} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {/* Message List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputArea}>
                    <GlassCard
                        style={styles.inputWrapper}
                        contentContainerStyle={styles.inputContent}
                        intensity={30}
                    >
                        <TouchableOpacity style={styles.iconButton}>
                            <Smile size={22} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Type a message..."
                            placeholderTextColor={Colors.textSecondary}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={500}
                        />

                        <View style={styles.rightIcons}>
                            <TouchableOpacity style={styles.iconButton}>
                                <ImageIcon size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </GlassCard>

                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Send size={20} color={Colors.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
    },
    backButton: {
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    nameContainer: {
        gap: 2,
    },
    moreButton: {
        padding: 4,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        gap: 16,
    },
    messageContainer: {
        flexDirection: 'row',
        maxWidth: '80%',
        alignItems: 'flex-end',
        gap: 8,
    },
    myMessage: {
        alignSelf: 'flex-end',
    },
    friendMessage: {
        alignSelf: 'flex-start',
    },
    messageAvatar: {
        marginBottom: 4,
    },
    bubble: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    myBubble: {
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 4,
    },
    friendBubble: {
        backgroundColor: Colors.surface,
        borderBottomLeftRadius: 4,
    },
    messageText: {
        color: Colors.white,
        fontSize: 15,
    },
    messageTime: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.6)',
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
        gap: 10,
        backgroundColor: 'transparent',
    },
    inputWrapper: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
    },
    inputContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 48,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: 16,
        paddingHorizontal: 10,
        paddingTop: Platform.OS === 'ios' ? 8 : 4,
        paddingBottom: Platform.OS === 'ios' ? 8 : 4,
        maxHeight: 120,
    },
    rightIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    sendButtonDisabled: {
        backgroundColor: Colors.surfaceLight,
        opacity: 0.6,
        shadowOpacity: 0,
        elevation: 0,
    },
});
