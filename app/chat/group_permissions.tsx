import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Edit2, MessageSquare, UserPlus, Link, Shield, Users } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { GlassCard } from '../../components/GlassCard';
import { Config } from '../../constants/Config';
import { useUser } from '../../context/UserContext';

export default function GroupPermissionsScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { user } = useUser();

    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    // Permissions State
    const [permissions, setPermissions] = useState({
        allow_member_edit_info: false, // Default 0
        allow_member_send_messages: true,
        allow_member_add_members: true,
        admin_approve_new_members: false
    });

    useEffect(() => {
        fetchPermissions();
    }, [groupId]);

    const fetchPermissions = async () => {
        if (!user || !groupId) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_group_details.php?group_id=${groupId}&user_id=${user.id}`);
            const data = await response.json();
            if (response.ok) {
                if (data.my_role !== 'owner' && data.my_role !== 'admin') {
                    Alert.alert("Error", "Only admins can restrict group settings.");
                    router.back();
                    return;
                }
                setPermissions({
                    allow_member_edit_info: !!data.allow_member_edit_info,
                    allow_member_send_messages: !!data.allow_member_send_messages,
                    allow_member_add_members: !!data.allow_member_add_members,
                    admin_approve_new_members: !!data.admin_approve_new_members
                });
            } else {
                Alert.alert("Error", data.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const updatePermission = async (key: string, value: boolean) => {
        // Optimistic update
        setPermissions(prev => ({ ...prev, [key]: value }));
        setUpdating(true);

        try {
            const response = await fetch(`${Config.API_URL}/chat/update_group_permissions.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: groupId,
                    user_id: user?.id,
                    [key]: value
                })
            });
            const data = await response.json();
            if (!response.ok) {
                // Revert on failure
                setPermissions(prev => ({ ...prev, [key]: !value }));
                Alert.alert("Error", data.message || "Failed to update permission.");
            }
        } catch (error) {
            console.error(error);
            setPermissions(prev => ({ ...prev, [key]: !value })); // Revert
            Alert.alert("Error", "Network error.");
        } finally {
            setUpdating(false);
        }
    };

    const renderSwitchRow = (icon: React.ReactNode, title: string, description: string, value: boolean, onValueChange: (val: boolean) => void) => (
        <View style={styles.row}>
            <View style={styles.iconContainer}>{icon}</View>
            <View style={{ flex: 1, paddingRight: 12 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{title}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>{description}</ThemedText>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: '#767577', true: Colors.primary }}
                thumbColor={'#f4f3f4'}
                disabled={updating}
            />
        </View>
    );

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
                        <ThemedText type="subtitle" style={{ fontSize: 18 }}>Group permissions</ThemedText>
                        {/* Could add group name here if passed or fetched */}
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <ThemedText style={styles.sectionTitle}>Members can:</ThemedText>

                <GlassCard>
                    {renderSwitchRow(
                        <MessageSquare size={20} color={Colors.text} />,
                        "Send new messages",
                        "",
                        permissions.allow_member_send_messages,
                        (val) => updatePermission('allow_member_send_messages', val)
                    )}

                    <View style={styles.divider} />

                    {renderSwitchRow(
                        <UserPlus size={20} color={Colors.text} />,
                        "Add other members",
                        "",
                        permissions.allow_member_add_members,
                        (val) => updatePermission('allow_member_add_members', val)
                    )}

                    <View style={styles.divider} />

                    {/* Mock for now as backend logic implies strict membership */}
                    {renderSwitchRow(
                        <Link size={20} color={Colors.text} />,
                        "Invite via link or QR code",
                        "",
                        true, // Always true mock for now or link to feature
                        () => Alert.alert("Invite Link", "This setting is not yet configurable.")
                    )}
                </GlassCard>

                <ThemedText style={[styles.sectionTitle, { marginTop: 24 }]}>Admins can:</ThemedText>

                <GlassCard>
                    {renderSwitchRow(
                        <Edit2 size={20} color={Colors.text} />,
                        "Edit group settings",
                        "Only admins can change this group's name, icon, description, disappearing message timer, and advanced chat privacy.",
                        !permissions.allow_member_edit_info, // Inverted: If true (Only Admins), then allow_member_edit_info should be false
                        (val) => updatePermission('allow_member_edit_info', !val) // If val is true (restrict), set allow to false
                    )}

                    <View style={styles.divider} />

                    {renderSwitchRow(
                        <Shield size={20} color={Colors.text} />,
                        "Approve new members",
                        "When turned on, admins must approve anyone who wants to join the group.",
                        permissions.admin_approve_new_members,
                        (val) => updatePermission('admin_approve_new_members', val)
                    )}
                </GlassCard>

                <ThemedText style={[styles.sectionTitle, { marginTop: 24 }]}>Group admins</ThemedText>
                <GlassCard>
                    <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: '/chat/edit_group_admins', params: { groupId } })}>
                        <View style={styles.iconContainer}><Users size={20} color={Colors.text} /></View>
                        <View style={{ flex: 1 }}>
                            <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Edit group admins</ThemedText>
                            <ThemedText style={{ fontSize: 12, color: Colors.textSecondary }}>You</ThemedText>
                        </View>
                    </TouchableOpacity>
                </GlassCard>

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
    sectionTitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 8,
        marginLeft: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    iconContainer: {
        width: 32,
        marginRight: 8,
        alignItems: 'center',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#333',
        marginLeft: 44, // Align with text start
    }
});
