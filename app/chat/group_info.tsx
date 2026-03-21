import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList, TextInput, Switch, Modal, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MoreVertical, UserPlus, Shield, Clock, Lock, Flag, LogOut, MessageSquare, Edit2, BadgeCheck, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { Config } from '../../constants/Config';
import { useUser } from '../../context/UserContext';
import { getAvatarById } from '../../constants/Avatars';
import { GroupDefaultIcon } from '../../components/icons/GroupDefaultIcon';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';

export default function GroupInfoScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useUser();
    const [group, setGroup] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const isOwner = group?.my_role === 'owner';
    const canEdit = isOwner || group?.my_role === 'admin' || !!group?.allow_member_edit_info;

    // UI States
    const [showAllMembers, setShowAllMembers] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [chatLocked, setChatLocked] = useState(false); // Mock state for now
    const [isMuted, setIsMuted] = useState(false);

    const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');

    // Editing States
    const [editNameModalVisible, setEditNameModalVisible] = useState(false);
    const [editDescModalVisible, setEditDescModalVisible] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [editedDesc, setEditedDesc] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchGroupDetails();
    }, [id]);

    const fetchGroupDetails = async () => {
        if (!user || !id) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_group_details.php?group_id=${id}&user_id=${user.id}`);
            const data = await response.json();
            if (response.ok) {
                setGroup(data);
                setMembers(data.members);

                // Fetch mute status
                const muteRes = await fetch(`${Config.API_URL}/chat/check_mute.php?user_id=${user.id}&target_id=${id}&is_group=1`);
                const muteData = await muteRes.json();
                if (muteRes.ok) {
                    setIsMuted(muteData.is_muted);
                }
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

    const toggleMute = async (value: boolean) => {
        if (!user || !id) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/mute_chat.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    target_id: id,
                    action: value ? 'mute' : 'unmute',
                    is_group: 1
                })
            });
            const data = await response.json();
            if (response.ok) {
                setIsMuted(value);
            } else {
                Alert.alert("Error", data.message);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error.");
        }
    };

    const pickImage = async () => {
        if (!canEdit) {
            Alert.alert("Error", "You don't have permission to change the group icon.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            handleUpdateIcon(result.assets[0].uri);
        }
    };

    const handleUpdateIcon = async (uri: string) => {
        if (!user || !id) return;
        setUpdating(true);
        try {
            const formData = new FormData();
            formData.append('group_id', id.toString());
            formData.append('user_id', user.id.toString());
            
            // @ts-ignore
            formData.append('icon', {
                uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
                type: 'image/jpeg',
                name: 'group_icon.jpg',
            });

            const response = await fetch(`${Config.API_URL}/chat/update_group.php`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                    // Note: Don't set Content-Type header when using FormData; 
                    // the browser/fetch will set it with the correct boundary.
                },
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", "Group icon updated successfully.");
                fetchGroupDetails(); // Refresh to show new icon
                
                // Update local metadata
                LocalDatabaseService.updateChatMetadata({
                    id: id.toString(),
                    is_group: true,
                    group_icon: data.icon_path // Backend returns the new path
                }).catch(e => console.error("Local metadata update failed", e));

            } else {
                Alert.alert("Error", data.message || "Failed to update icon.");
            }
        } catch (error) {
            console.error("Icon upload error:", error);
            Alert.alert("Error", "Network error.");
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateDetails = async (field: 'name' | 'description', value: string) => {
        if (!user || !id) return;
        setUpdating(true);
        try {
            const body: any = {
                group_id: id,
                user_id: user.id
            };
            if (field === 'name') body.name = value;
            else body.description = value;

            const response = await fetch(`${Config.API_URL}/chat/update_group_details.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", "Group updated successfully.");
                setGroup((prev: any) => ({ ...prev, [field === 'name' ? 'name' : 'description']: value }));

                // Update local metadata for instant chat list/header refresh
                if (field === 'name') {
                    LocalDatabaseService.updateChatMetadata({
                        id: id.toString(),
                        is_group: true,
                        group_name: value,
                        other_username: value
                    }).catch(e => console.error("Local metadata update failed", e));
                }

                setEditNameModalVisible(false);
                setEditDescModalVisible(false);
            } else {
                Alert.alert("Error", data.message || "Failed to update.");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error.");
        } finally {
            setUpdating(false);
        }
    };

    const handleAction = async (action: string, targetId?: number) => {
        if (!user || !group) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${Config.API_URL}/chat/group_actions.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    group_id: group.id,
                    user_id: user.id,
                    target_id: targetId
                })
            });
            const data = await response.json();

            if (response.ok) {
                if (action === 'leave_group' || action === 'delete_group') {
                    router.replace('/(tabs)/chats');
                } else {
                    Alert.alert("Success", data.message);
                    fetchGroupDetails(); // Refresh
                }
            } else {
                Alert.alert("Error", data.message);
            }

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReportGroup = () => {
        Alert.alert(
            "Report Group",
            "Why are you reporting this group?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Spam", onPress: () => submitGroupReport('spam') },
                { text: "Inappropriate Content", onPress: () => submitGroupReport('inappropriate') },
                { text: "Harassment", onPress: () => submitGroupReport('harassment') }
            ]
        );
    };

    const submitGroupReport = async (reason: string) => {
        if (!user || !group) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/report_group.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reporter_id: user.id, group_id: group.id, reason: reason })
            });
            const data = await response.json();
            Alert.alert(response.ok ? "Reported" : "Error", data.message || "Failed to report.");
        } catch (e) {
            Alert.alert("Error", "Network error.");
        }
    };

    const handleClearChat = async () => {
        if (!group) return;

        const options: any[] = [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear for me",
                onPress: () => clearChatSelf()
            }
        ];

        if (group.my_role === 'owner') {
            options.push({
                text: "Clear for everyone",
                style: 'destructive',
                onPress: () => confirmClearEveryone()
            });
        }

        Alert.alert(
            "Clear Chat",
            "Do you want to clear chat history?",
            options
        );
    };

    const clearChatSelf = async () => {
        if (!user || !group) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${Config.API_URL}/chat/group_actions.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, group_id: group.id, action: 'clear_chat_self' })
            });
            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", "Chat cleared for you.");
            } else {
                Alert.alert("Error", data.message || "Failed to clear chat.");
            }
        } catch (e) { Alert.alert("Error", "Network error"); }
        finally { setActionLoading(false); }
    };

    const confirmClearEveryone = () => {
        Alert.alert(
            "Clear Everyone",
            "This will delete messages for ALL participants. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear Everywhere",
                    style: 'destructive',
                    onPress: async () => {
                        if (!user || !group) return;
                        setActionLoading(true);
                        try {
                            const response = await fetch(`${Config.API_URL}/chat/clear_msgs.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user_id: user.id, group_id: group.id })
                            });
                            const data = await response.json();
                            if (response.ok) {
                                Alert.alert("Success", "Chat cleared for everyone.");
                            } else {
                                Alert.alert("Error", data.message || "Failed to clear.");
                            }
                        } catch (e) { console.error("Clear error", e); }
                        finally { setActionLoading(false); }
                    }
                }
            ]
        );
    };

    const confirmLeave = () => {
        Alert.alert("Leave Group", "Are you sure you want to leave this group?", [
            { text: "Cancel", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: () => handleAction('leave_group') }
        ]);
    };

    const confirmDelete = () => {
        Alert.alert("Delete Group", "Are you sure? This will delete the group for everyone and cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => handleAction('delete_group') }
        ]);
    };

    // --- Menu Handlers ---
    const onAddMember = () => {
        setMenuVisible(false);
        router.push({ pathname: '/chat/add_members', params: { groupId: id } });
    };

    const onEditGroup = () => {
        setMenuVisible(false);
        setEditedName(group?.name || '');
        setEditNameModalVisible(true);
    };

    const onGroupPermissions = () => {
        setMenuVisible(false);
        router.push({ pathname: '/chat/group_permissions', params: { groupId: id } });
    };


    const renderMember = ({ item }: { item: any }) => (
        <View style={styles.memberRow}>
            <Avatar
                source={item.avatar_url ? `${Config.API_URL}/${item.avatar_url}` : getAvatarById(item.avatar_id)}
                size={40}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ThemedText type="defaultSemiBold">{item.username}</ThemedText>
                    {item.is_official == 1 && (
                        <BadgeCheck size={14} color={Colors.white} fill={Colors.verifiedBackground} />
                    )}
                </View>
                <ThemedText style={{
                    fontSize: 12,
                    color: item.role === 'owner' ? Colors.error : (item.role === 'admin' ? '#2196F3' : Colors.textSecondary)
                }}>
                    {item.role === 'owner' ? 'Group Owner' : item.role === 'admin' ? 'Manager' : 'Member'}
                </ThemedText>
            </View>

            {/* Admin Actions */}
            {(group?.my_role === 'owner' || group?.my_role === 'admin') && item.id !== user?.id && item.role !== 'owner' && (
                <TouchableOpacity
                    onPress={() => {
                        const options: any[] = [
                            { text: "Cancel", style: "cancel" },
                            { text: "Remove", style: "destructive", onPress: () => handleAction('remove_member', item.id) }
                        ];

                        if (group?.my_role === 'owner') {
                            if (item.role === 'member') {
                                options.push({
                                    text: "Make Group Manager",
                                    onPress: () => handleAction('promote_admin', item.id)
                                });
                            } else if (item.role === 'admin') {
                                options.push({
                                    text: "Dismiss as Manager",
                                    style: "destructive",
                                    onPress: () => handleAction('demote_admin', item.id)
                                });
                            }
                        }

                        Alert.alert("Manage Member", `Manage ${item.username}?`, options);
                    }}
                    style={{ padding: 8 }}
                >
                    <MoreVertical size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    );

    const renderSettingRow = (icon: any, title: string, subtitle?: string, trailing?: React.ReactNode, onPress?: () => void) => (
        <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress}>
            <View style={styles.settingIcon}>
                {icon}
            </View>
            <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{title}</ThemedText>
                {subtitle && <ThemedText style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{subtitle}</ThemedText>}
            </View>
            {trailing}
        </TouchableOpacity>
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
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.headerTitle}></ThemedText>
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 4 }}>
                    <MoreVertical size={24} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {/* Menu Modal */}
            <Modal
                transparent
                visible={menuVisible}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
                    <View style={styles.menuContainer}>
                        {((group?.my_role === 'owner' || group?.my_role === 'admin') || (group?.allow_member_add_members)) && (
                            <TouchableOpacity style={styles.menuItem} onPress={onAddMember}>
                                <ThemedText>Add members</ThemedText>
                            </TouchableOpacity>
                        )}

                        {canEdit && (
                            <>
                                <TouchableOpacity style={styles.menuItem} onPress={onEditGroup}>
                                    <ThemedText>Edit group name</ThemedText>
                                </TouchableOpacity>
                                {(group?.my_role === 'owner' || group?.my_role === 'admin') && (
                                    <TouchableOpacity style={styles.menuItem} onPress={onGroupPermissions}>
                                        <ThemedText>Edit permissions</ThemedText>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                </Pressable>
            </Modal>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Group Details */}
                <View style={styles.groupHeader}>
                    <TouchableOpacity 
                        onPress={pickImage} 
                        disabled={!canEdit}
                        activeOpacity={0.7}
                        style={styles.avatarContainer}
                    >
                        <Avatar
                            source={group?.icon_path ? `${Config.API_URL}/${group.icon_path}` : undefined}
                            size={120}
                            style={{ marginBottom: 16 }}
                            fallbackComponent={<GroupDefaultIcon size={120} />}
                        />
                        {canEdit && (
                            <View style={styles.editIconBadge}>
                                <Edit2 size={16} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                    <ThemedText type="title" style={{ fontSize: 24, marginBottom: 4 }}>{group?.name}</ThemedText>
                    <ThemedText style={styles.memberCount}>Group • {group?.member_count} members</ThemedText>
                </View>

                {/* Tab Selector */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'members' && styles.activeTabButton]}
                        onPress={() => setActiveTab('members')}
                    >
                        <ThemedText style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>Members</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'settings' && styles.activeTabButton]}
                        onPress={() => setActiveTab('settings')}
                    >
                        <ThemedText style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>Settings</ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Tab Content */}
                {activeTab === 'members' ? (
                    /* --- MEMBERS TAB --- */
                    <View style={styles.section}>
                        <GlassCard>
                            {/* "Add Members" Row */}
                            {(group?.my_role === 'owner' || group?.my_role === 'admin' || group?.allow_member_add_members) && (
                                <TouchableOpacity style={styles.memberRow} onPress={() => router.push({ pathname: '/chat/add_members', params: { groupId: id } })}>
                                    <View style={[styles.iconCircle, { backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 20 }]}>
                                        <UserPlus size={20} color={'white'} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <ThemedText type="defaultSemiBold">Add members</ThemedText>
                                    </View>
                                </TouchableOpacity>
                            )}
                            {(group?.my_role === 'owner' || group?.allow_member_add_members) && <View style={styles.divider} />}

                            {/* Full Member List */}
                            {members.map((member, index) => (
                                <View key={member.id}>
                                    {renderMember({ item: member })}
                                    {index < members.length - 1 && (
                                        <View style={styles.divider} />
                                    )}
                                </View>
                            ))}
                        </GlassCard>
                    </View>
                ) : (
                    /* --- SETTINGS TAB --- */
                    <>
                        {/* Description Section */}
                        <View style={styles.section}>
                            <GlassCard>
                                <View style={{ padding: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <ThemedText type="defaultSemiBold">Description</ThemedText>
                                        {canEdit && (
                                            <TouchableOpacity onPress={() => {
                                                setEditedDesc(group?.description || '');
                                                setEditDescModalVisible(true);
                                            }}>
                                                <Edit2 size={16} color={Colors.primary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (canEdit) {
                                                setEditedDesc(group?.description || '');
                                                setEditDescModalVisible(true);
                                            }
                                        }}
                                        disabled={!canEdit}
                                    >
                                        <ThemedText style={{ color: group?.description ? Colors.textSecondary : Colors.offline, fontSize: 14, fontStyle: group?.description ? 'normal' : 'italic' }}>
                                            {group?.description || 'No description provided'}
                                        </ThemedText>
                                    </TouchableOpacity>
                                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                                        <ThemedText style={{ color: Colors.textSecondary, fontSize: 12 }}>Created by {group?.creator_name || 'Owner'}, {new Date(group?.created_at).toLocaleDateString()}</ThemedText>
                                    </View>
                                </View>
                            </GlassCard>
                        </View>

                        {/* Settings Section */}
                        <View style={styles.section}>
                            <GlassCard>
                                {/* Mute Notifications */}
                                {renderSettingRow(
                                    <Ionicons name={isMuted ? "notifications-off-outline" : "notifications-outline"} size={22} color={isMuted ? Colors.error : Colors.text} />,
                                    "Mute Notifications",
                                    isMuted ? "On" : "Off",
                                    <Switch
                                        value={isMuted}
                                        onValueChange={toggleMute}
                                        trackColor={{ false: '#767577', true: Colors.primary }}
                                        thumbColor={'#f4f3f4'}
                                    />
                                )}
                                <ThemedText style={styles.settingHelpText}>
                                    If anybody mentions you, you will still receive a notification.
                                </ThemedText>
                                <View style={styles.divider} />

                                {/* Encryption */}
                                {renderSettingRow(
                                    <Lock size={22} color={Colors.text} />,
                                    "Encryption",
                                    "Messages and calls are end-to-end encrypted.",
                                    null,
                                    () => Alert.alert("Encryption", "Your messages are secured with end-to-end encryption.")
                                )}
                                <View style={styles.divider} />

                                {/* Disappearing Messages (Owner only) */}
                                {group?.my_role === 'owner' && (
                                    <>
                                        {renderSettingRow(
                                            <Clock size={22} color={Colors.text} />,
                                            "Disappearing messages",
                                            "Off",
                                            null,
                                            () => Alert.alert("Disappearing Messages", "Feature coming soon.")
                                        )}
                                        <View style={styles.divider} />
                                    </>
                                )}

                                {/* Chat Lock */}
                                {renderSettingRow(
                                    <Shield size={22} color={Colors.text} />,
                                    "Chat lock",
                                    "Lock and hide this chat on this device.",
                                    <Switch
                                        value={chatLocked}
                                        onValueChange={setChatLocked}
                                        trackColor={{ false: '#767577', true: Colors.primary }}
                                        thumbColor={'#f4f3f4'}
                                    />
                                )}

                                {/* Security / Advanced Privacy */}
                                <View style={styles.divider} />
                                {renderSettingRow(
                                    <Shield size={22} color={Colors.text} />,
                                    "Advanced chat privacy",
                                    "Off",
                                    null,
                                    () => { } // Info page
                                )}
                            </GlassCard>
                        </View>

                        {/* Danger Zone: Clear/Report/Exit */}
                        <View style={styles.section}>
                            <GlassCard>
                                <TouchableOpacity style={styles.dangerRow} onPress={handleReportGroup}>
                                    <Flag size={22} color={Colors.error} />
                                    <ThemedText style={[styles.dangerText, { color: Colors.error }]}>Report Group</ThemedText>
                                </TouchableOpacity>
                                <View style={styles.divider} />

                                <TouchableOpacity style={styles.dangerRow} onPress={handleClearChat}>
                                    <MessageSquare size={22} color={Colors.error} />
                                    <ThemedText style={[styles.dangerText, { color: Colors.error }]}>Clear Chat</ThemedText>
                                </TouchableOpacity>
                                <View style={styles.divider} />

                                <TouchableOpacity style={styles.dangerRow} onPress={confirmLeave}>
                                    <LogOut size={22} color={Colors.error} />
                                    <ThemedText style={styles.dangerText}>Exit Group</ThemedText>
                                </TouchableOpacity>

                                {group?.my_role === 'owner' && (
                                    <>
                                        <View style={styles.divider} />
                                        <TouchableOpacity style={styles.dangerRow} onPress={confirmDelete}>
                                            <Trash2 size={22} color={Colors.error} />
                                            <ThemedText style={styles.dangerText}>Delete Group</ThemedText>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </GlassCard>
                        </View>
                    </>
                )}

            </ScrollView>

            {/* Edit Name Modal */}
            <Modal
                visible={editNameModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setEditNameModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setEditNameModalVisible(false)}>
                    <View style={styles.bottomModalContainer}>
                        <View style={styles.modalHeader}>
                            <ThemedText type="subtitle">Edit group name</ThemedText>
                            <TouchableOpacity onPress={() => setEditNameModalVisible(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.modalInput}
                            value={editedName}
                            onChangeText={setEditedName}
                            placeholder="Enter group name"
                            placeholderTextColor={Colors.textSecondary}
                            autoFocus
                        />
                        <TouchableOpacity
                            style={[styles.saveButton, updating && { opacity: 0.7 }]}
                            onPress={() => handleUpdateDetails('name', editedName)}
                            disabled={updating}
                        >
                            {updating ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.saveButtonText}>Save</ThemedText>}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Edit Description Modal */}
            <Modal
                visible={editDescModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setEditDescModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setEditDescModalVisible(false)}>
                    <View style={styles.bottomModalContainer}>
                        <View style={styles.modalHeader}>
                            <ThemedText type="subtitle">Edit description</ThemedText>
                            <TouchableOpacity onPress={() => setEditDescModalVisible(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                            value={editedDesc}
                            onChangeText={setEditedDesc}
                            placeholder="Enter group description"
                            placeholderTextColor={Colors.textSecondary}
                            multiline
                            autoFocus
                        />
                        <TouchableOpacity
                            style={[styles.saveButton, updating && { opacity: 0.7 }]}
                            onPress={() => handleUpdateDetails('description', editedDesc)}
                            disabled={updating}
                        >
                            {updating ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.saveButtonText}>Save</ThemedText>}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
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
        justifyContent: 'space-between',
        padding: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
    },
    groupHeader: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    avatarContainer: {
        position: 'relative',
        alignItems: 'center',
    },
    editIconBadge: {
        position: 'absolute',
        right: 0,
        bottom: 16,
        backgroundColor: Colors.primary,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: Colors.background,
    },
    description: {
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
    },
    memberCount: {
        color: Colors.textSecondary,
        marginTop: 4,
        fontSize: 14,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 20,
    },
    actionButton: {
        alignItems: 'center',
        gap: 8,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        fontSize: 12,
        color: Colors.primary,
    },
    section: {
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#333',
        marginLeft: 52,
    },
    dangerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    dangerText: {
        color: Colors.error,
        fontWeight: '600',
        fontSize: 16,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
    },
    settingIcon: {
        width: 32,
        marginRight: 12,
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'transparent', // Or semi-transparent if desired, but menu usually pops over
    },
    menuContainer: {
        position: 'absolute',
        top: 60,
        right: 16,
        backgroundColor: '#1E1E1E', // Dark menu
        borderRadius: 8,
        padding: 8,
        minWidth: 180,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    // Tab Styles
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTabButton: {
        borderBottomColor: Colors.primary,
    },
    tabText: {
        fontSize: 16,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: Colors.primary,
    },
    bottomModalContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalInput: {
        backgroundColor: '#2C2C2C',
        borderRadius: 8,
        padding: 12,
        color: Colors.text,
        fontSize: 16,
        marginBottom: 20,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    settingHelpText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginLeft: 52,
        marginTop: -8,
        marginBottom: 16,
        fontStyle: 'italic',
    },
});
