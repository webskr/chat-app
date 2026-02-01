import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { GlassCard } from '../../components/GlassCard';
import { SearchInput } from '../../components/SearchInput';
import { router } from 'expo-router';

import { getAvatarById } from '../../constants/Avatars';

// Mock Data
const MOCK_CHATS = [
    {
        id: '1',
        user: 'Alice Wonderland',
        avatar: getAvatarById('3'), // female1
        lastMessage: 'Hey! Are we still on for tonight?',
        time: '10:30 AM',
        unread: 2,
        online: true,
    },
    {
        id: '2',
        user: 'Bob Builder',
        avatar: getAvatarById('0'), // male1
        lastMessage: 'Can you send me the designs?',
        time: 'Yesterday',
        unread: 0,
        online: false,
    },
    {
        id: '3',
        user: 'Charlie Brown',
        avatar: getAvatarById('1'), // male2
        lastMessage: 'Good grief!',
        time: 'Tue',
        unread: 5,
        online: true,
    },
    {
        id: '4',
        user: 'Diana Prince',
        avatar: getAvatarById('4'), // female2
        lastMessage: 'Meeting confirmed.',
        time: 'Mon',
        unread: 0,
        online: false,
    },
    {
        id: '5',
        user: 'Evan Wright',
        avatar: getAvatarById('2'), // male3
        lastMessage: 'Thanks for the help!',
        time: 'Last Week',
        unread: 0,
        online: true,
    },
];

export default function ChatScreen() {
    const [searchQuery, setSearchQuery] = React.useState('');

    const filteredChats = React.useMemo(() => {
        return MOCK_CHATS.filter(chat =>
            chat.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const renderItem = ({ item }: { item: typeof MOCK_CHATS[0] }) => (
        <TouchableOpacity onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id, user: item.user } })}>
            <GlassCard style={styles.chatItem}>
                <View style={styles.row}>
                    <Avatar source={item.avatar} online={item.online} size={56} />
                    <View style={styles.chatInfo}>
                        <View style={styles.headerRow}>
                            <ThemedText type="defaultSemiBold" style={styles.username}>
                                {item.user}
                            </ThemedText>
                            <ThemedText type="caption" style={styles.time}>
                                {item.time}
                            </ThemedText>
                        </View>
                        <View style={styles.messageRow}>
                            <ThemedText
                                numberOfLines={1}
                                style={[styles.lastMessage, { color: item.unread > 0 ? Colors.text : Colors.textSecondary }]}
                            >
                                {item.lastMessage}
                            </ThemedText>
                            {item.unread > 0 && <Badge count={item.unread} />}
                        </View>
                    </View>
                </View>
            </GlassCard>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <ThemedText type="title">Messages</ThemedText>
            </View>
            <View style={styles.searchContainer}>
                <SearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search messages..."
                />
            </View>
            <FlatList
                data={filteredChats}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 10,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100, // Space for bottom tab bar
        gap: 12
    },
    chatItem: {
        marginBottom: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    chatInfo: {
        flex: 1,
        gap: 4,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    username: {
        color: Colors.text,
    },
    time: {
        color: Colors.textSecondary,
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        flex: 1,
        marginRight: 8,
        fontSize: 14,
    },
});
