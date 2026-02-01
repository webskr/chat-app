import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { SearchInput } from '../../components/SearchInput';
import { UserPlus } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';

const MOCK_FRIENDS = [
    { id: '1', name: 'Emma Watson', handle: '@emma_w', avatar: getAvatarById('3'), online: true },
    { id: '2', name: 'Tom Holland', handle: '@spidey', avatar: getAvatarById('0'), online: false },
    { id: '3', name: 'Robert Downey Jr.', handle: '@ironman', avatar: getAvatarById('1'), online: true },
    { id: '4', name: 'Scarlett Johansson', handle: '@blackwidow', avatar: getAvatarById('4'), online: true },
    { id: '5', name: 'Chris Hemsworth', handle: '@thor', avatar: getAvatarById('2'), online: false },
    { id: '6', name: 'Mark Ruffalo', handle: '@hulk', avatar: getAvatarById('5'), online: true },
];

export default function FriendsScreen() {
    const [searchQuery, setSearchQuery] = React.useState('');

    const filteredFriends = React.useMemo(() => {
        return MOCK_FRIENDS.filter(friend =>
            friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            friend.handle.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const renderItem = ({ item }: { item: typeof MOCK_FRIENDS[0] }) => (
        <GlassCard style={styles.card}>
            <View style={styles.row}>
                <Avatar source={item.avatar} online={item.online} size={50} />
                <View style={styles.info}>
                    <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                    <ThemedText type="caption">{item.handle}</ThemedText>
                </View>
                <TouchableOpacity style={styles.addButton}>
                    <UserPlus size={20} color={Colors.white} />
                </TouchableOpacity>
            </View>
        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <ThemedText type="title">Global Friends</ThemedText>
            </View>
            <View style={styles.searchContainer}>
                <SearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search people..."
                />
            </View>
            <FlatList
                data={filteredFriends}
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
        paddingBottom: 100,
        gap: 12,
    },
    card: {
        marginBottom: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    info: {
        flex: 1,
    },
    addButton: {
        backgroundColor: Colors.primary,
        padding: 8,
        borderRadius: 12,
    },
});
