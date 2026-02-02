import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { SearchInput } from '../../components/SearchInput';
import { MessageSquare, MoreVertical } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { router, useFocusEffect } from 'expo-router';

export default function FriendsScreen() {
    const { user: currentUser } = useUser();
    const [users, setUsers] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');

    const fetchUsers = React.useCallback(async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/get_users.php?user_id=${currentUser.id}`);
            const data = await response.json();
            if (response.ok) {
                setUsers(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    useFocusEffect(
        React.useCallback(() => {
            fetchUsers();
        }, [fetchUsers])
    );

    const filteredUsers = React.useMemo(() => {
        return users.filter(user =>
            user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [users, searchQuery]);

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity onPress={() => router.push({
            pathname: '/chat/[id]',
            params: { id: item.id, user: item.username, avatar_id: item.avatar_id }
        })}>
            <GlassCard style={styles.card}>
                <View style={styles.row}>
                    <Avatar source={getAvatarById(item.avatar_id)} online={true} size={50} />
                    <View style={styles.info}>
                        <ThemedText type="defaultSemiBold">{item.username}</ThemedText>
                        <ThemedText type="caption">{item.email}</ThemedText>
                    </View>
                    <View style={styles.addButton}>
                        <MessageSquare size={20} color={Colors.white} />
                    </View>
                </View>
            </GlassCard>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <ThemedText type="title" style={styles.headerTitle}>Vegarm</ThemedText>
                <TouchableOpacity onPress={() => {/* More options */ }}>
                    <MoreVertical size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
                <SearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search people..."
                />
            </View>
            <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id.toString()}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 0.5,
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
