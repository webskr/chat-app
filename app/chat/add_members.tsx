import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { Config } from '../../constants/Config';
import { useUser } from '../../context/UserContext';
import { getAvatarById } from '../../constants/Avatars';
import { SearchInput } from '../../components/SearchInput';

export default function AddMembersScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { user } = useUser();
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [existingMembers, setExistingMembers] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (groupId) {
            fetchCandidates();
        }
    }, [groupId]);

    const fetchCandidates = async () => {
        if (!user || !groupId) return;
        try {
            setLoading(true);
            // 1. Fetch current members to exclude
            const membersResp = await fetch(`${Config.API_URL}/chat/get_group_details.php?group_id=${groupId}&user_id=${user.id}`);
            const membersData = await membersResp.json();
            const currentMemberIds = new Set<number>(membersData.members.map((m: any) => Number(m.id)));
            setExistingMembers(currentMemberIds);

            // 2. Fetch all users
            const usersResp = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${user.id}`);
            const usersData = await usersResp.json();

            // Filter out existing members
            const candidates = usersData.filter((u: any) => !currentMemberIds.has(Number(u.id)));
            setUsers(candidates);

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load users.");
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (id: number) => {
        if (selectedUsers.includes(id)) {
            setSelectedUsers(selectedUsers.filter(uid => uid !== id));
        } else {
            setSelectedUsers([...selectedUsers, id]);
        }
    };

    const handleAddMembers = async () => {
        if (selectedUsers.length === 0) return;
        setAdding(true);
        try {
            // We need to loop or update group_actions.php to accept multiple
            // group_actions currently accepts single target_id.
            // I'll loop for now or update backend. Looping is safer for quick fix.

            let successCount = 0;
            for (const uid of selectedUsers) {
                const response = await fetch(`${Config.API_URL}/chat/group_actions.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'add_member',
                        group_id: groupId,
                        user_id: user!.id,
                        target_id: uid
                    })
                });
                if (response.ok) successCount++;
            }

            if (successCount > 0) {
                Alert.alert("Success", `Added ${successCount} members.`, [
                    { text: "OK", onPress: () => router.back() }
                ]);
            } else {
                Alert.alert("Error", "Failed to add members.");
            }

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error.");
        } finally {
            setAdding(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.display_name && u.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const renderUserItem = ({ item }: { item: any }) => {
        const isSelected = selectedUsers.includes(item.id);
        return (
            <TouchableOpacity onPress={() => toggleUser(item.id)}>
                <View style={[styles.userItem, isSelected && styles.userItemSelected]}>
                    <Avatar
                        source={item.avatar_url ? `${Config.API_URL}/${item.avatar_url}` : getAvatarById(item.avatar_id)}
                        size={50}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <ThemedText style={styles.userName}>{item.username}</ThemedText>
                        <ThemedText style={styles.userBio} numberOfLines={1}>{item.bio || "No bio"}</ThemedText>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />}
                </View>
                <View style={styles.divider} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.headerTitle}>Add Members</ThemedText>
                <TouchableOpacity onPress={handleAddMembers} disabled={adding || selectedUsers.length === 0}>
                    {adding ? (
                        <ActivityIndicator color={Colors.primary} />
                    ) : (
                        <ThemedText style={{ color: selectedUsers.length > 0 ? Colors.primary : Colors.textSecondary, fontWeight: 'bold' }}>
                            Done ({selectedUsers.length})
                        </ThemedText>
                    )}
                </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
                <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search people..." />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderUserItem}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    ListEmptyComponent={
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ThemedText style={{ color: Colors.textSecondary }}>No users found to add.</ThemedText>
                        </View>
                    }
                />
            )}
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
        padding: 16,
        justifyContent: 'space-between'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16
    },
    userItemSelected: {
        backgroundColor: 'rgba(3, 103, 39, 0.1)'
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text
    },
    userBio: {
        fontSize: 12,
        color: Colors.textSecondary
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#333',
        marginLeft: 78
    }
});
