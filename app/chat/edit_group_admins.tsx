import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { Config } from '../../constants/Config';
import { useUser } from '../../context/UserContext';
import { getAvatarById } from '../../constants/Avatars';

export default function EditGroupAdminsScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { user } = useUser();

    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchGroupMembers();
    }, [groupId]);

    const fetchGroupMembers = async () => {
        if (!user || !groupId) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_group_details.php?group_id=${groupId}&user_id=${user.id}`);
            const data = await response.json();
            if (response.ok) {
                if (data.my_role !== 'owner') {
                    Alert.alert("Permission Denied", "Only the group owner can manage admins.");
                    router.back();
                    return;
                }
                setMembers(data.members);
            } else {
                Alert.alert("Error", data.message);
                router.back();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAdmin = async (member: any) => {
        if (member.role === 'owner') {
            Alert.alert("Action not allowed", "You cannot change the owner's role here.");
            return;
        }

        const newRole = member.role === 'admin' ? 'member' : 'admin';
        const action = newRole === 'admin' ? 'promote_admin' : 'demote_admin';

        setActionLoading(true);
        try {
            const response = await fetch(`${Config.API_URL}/chat/group_actions.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    group_id: groupId,
                    user_id: user?.id,
                    target_id: member.id
                })
            });
            const data = await response.json();

            if (response.ok) {
                // Update local state
                setMembers(prev => prev.map(m =>
                    m.id === member.id ? { ...m, role: newRole } : m
                ));
            } else {
                Alert.alert("Error", data.message || "Failed to update role.");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    <View style={{ marginLeft: 12 }}>
                        <ThemedText type="subtitle" style={{ fontSize: 18 }}>Edit group admins</ThemedText>
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <ThemedText style={styles.infoText}>
                    Group admins can add or remove members and edit group info. You can have up to 3 admins.
                </ThemedText>

                <View style={styles.listContainer}>
                    {members.map((member) => (
                        <TouchableOpacity
                            key={member.id}
                            style={styles.memberRow}
                            onPress={() => toggleAdmin(member)}
                            disabled={actionLoading}
                        >
                            <Avatar
                                source={member.avatar_url ? `${Config.API_URL}/${member.avatar_url}` : getAvatarById(member.avatar_id)}
                                size={44}
                            />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <ThemedText type="defaultSemiBold">{member.username}</ThemedText>
                                <ThemedText style={{
                                    fontSize: 12,
                                    color: member.role === 'owner' ? Colors.error : (member.role === 'admin' ? '#FF9500' : Colors.textSecondary)
                                }}>
                                    {member.role === 'owner' ? 'Group Owner' : member.role === 'admin' ? 'Admin' : 'Member'}
                                </ThemedText>
                            </View>

                            {/* Checkmark or Status Indicator */}
                            {member.role === 'admin' && (
                                <View style={styles.checkContainer}>
                                    <Ionicons name="checkmark" size={16} color={'white'} />
                                </View>
                            )}
                            {member.role === 'owner' && (
                                <View style={[styles.checkContainer, { backgroundColor: Colors.error }]}>
                                    <Ionicons name="shield" size={16} color={'white'} />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
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
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
    },
    infoText: {
        color: Colors.textSecondary,
        marginBottom: 20,
        fontSize: 14,
        paddingHorizontal: 4,
    },
    listContainer: {
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        overflow: 'hidden',
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
    },
    checkContainer: {
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF9500', // Orange
        justifyContent: 'center',
        alignItems: 'center',
    }
});
