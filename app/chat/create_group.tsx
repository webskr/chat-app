import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { GlassCard } from '../../components/GlassCard';
import { Avatar } from '../../components/Avatar';
import { Config } from '../../constants/Config';
import { useUser } from '../../context/UserContext';
import { getAvatarById } from '../../constants/Avatars';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';
import { SearchInput } from '../../components/SearchInput';

export default function CreateGroupScreen() {
    const { user } = useUser();
    const [step, setStep] = useState(1);
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Group Details
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [groupIcon, setGroupIcon] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        if (!user) return;
        try {
            // Fetch all users (excluding self and blocked)
            // Ideally should be "contacts" but for now using get_users.php or similiar
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${user.id}`);
            // Note: get_users.php usually returns all users for search. 
            // We might want to filter to only friends/contacts if relationship exists.
            const data = await response.json();
            if (response.ok) {
                // Filter out self if API doesn't
                setUsers(data.filter((u: any) => u.id != user.id));
            }
        } catch (error) {
            console.error(error);
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

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setGroupIcon(result.assets[0].uri);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            Alert.alert("Error", "Group name is required.");
            return;
        }

        setCreating(true);
        try {
            const formData = new FormData();
            formData.append('name', groupName);
            formData.append('description', groupDescription);
            formData.append('user_id', user!.id); // Creator
            formData.append('members', JSON.stringify(selectedUsers));

            if (groupIcon) {
                const filename = groupIcon.split('/').pop() || 'group_icon.jpg';
                const fileType = filename.split('.').pop() === 'png' ? 'image/png' : 'image/jpeg';

                if (Platform.OS === 'web') {
                    const res = await fetch(groupIcon);
                    const blob = await res.blob();
                    formData.append('icon', blob, filename);
                } else {
                    formData.append('icon', {
                        uri: Platform.OS === 'android' ? groupIcon : groupIcon.replace('file://', ''),
                        name: filename,
                        type: fileType,
                    } as any);
                }
            }

            const response = await fetch(`${Config.API_URL}/chat/create_group.php`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", "Group created!", [
                    {
                        text: "OK", onPress: () => {
                            // router.replace('/'); 
                            // Go directly to the new group chat
                            if (data.group_id) {
                                // Proactively update local metadata to prevent "Unnamed Group"
                                LocalDatabaseService.updateChatMetadata({
                                    id: data.group_id.toString(),
                                    is_group: true,
                                    other_username: groupName,
                                    other_avatar_url: data.icon_path,
                                    group_name: groupName,
                                    group_icon: data.icon_path
                                }).catch(e => console.error("Metadata update failed", e));

                                router.replace({
                                    pathname: '/chat/[id]',
                                    params: {
                                        id: data.group_id,
                                        user: groupName,
                                        avatar_url: data.icon_path,
                                        is_group: '1'
                                    }
                                });
                            } else {
                                router.replace('/(tabs)/chats');
                            }
                        }
                    }
                ]);
            } else {
                Alert.alert("Error", data.message || "Failed to create group.");
            }

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Network or server error.");
        } finally {
            setCreating(false);
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
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => {
                    if (step === 2) setStep(1);
                    else router.back();
                }}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.headerTitle}>
                    {step === 1 ? "New Group: Add Members" : "New Group: Details"}
                </ThemedText>
                {step === 1 && (
                    <TouchableOpacity onPress={() => {
                        if (selectedUsers.length === 0) {
                            Alert.alert("Select Members", "Please select at least one member.");
                            return;
                        }
                        setStep(2);
                    }}>
                        <ThemedText style={{ color: Colors.primary, fontWeight: 'bold' }}>Next</ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            {step === 1 && (
                <View style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
                        <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search people..." />
                    </View>
                    <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                        <ThemedText style={{ color: Colors.textSecondary }}>{selectedUsers.length} selected</ThemedText>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
                    ) : (
                        <FlatList
                            data={filteredUsers}
                            keyExtractor={item => item?.id?.toString() || Math.random().toString()}
                            renderItem={renderUserItem}
                            contentContainerStyle={{ paddingBottom: 50 }}
                        />
                    )}
                </View>
            )}

            {step === 2 && (
                <View style={{ flex: 1, padding: 20 }}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatarPicker}>
                        {groupIcon ? (
                            <Image source={{ uri: groupIcon }} style={styles.groupIcon} />
                        ) : (
                            <View style={styles.groupIconPlaceholder}>
                                <Ionicons name="camera" size={32} color={Colors.textSecondary} />
                            </View>
                        )}
                        <ThemedText style={{ fontSize: 12, color: Colors.primary, marginTop: 8 }}>Set Group Icon</ThemedText>
                    </TouchableOpacity>

                    <TextInput
                        placeholder="Group Name (Required)"
                        placeholderTextColor={Colors.textSecondary}
                        style={styles.input}
                        value={groupName}
                        onChangeText={setGroupName}
                    />

                    <TextInput
                        placeholder="Description (Optional)"
                        placeholderTextColor={Colors.textSecondary}
                        style={[styles.input, { height: 80, textAlignVertical: 'top' }]} // multiline
                        multiline
                        value={groupDescription}
                        onChangeText={setGroupDescription}
                    />

                    <View style={{ marginTop: 20 }}>
                        <ThemedText style={{ marginBottom: 10 }}>Members: {selectedUsers.length + 1} (including you)</ThemedText>
                        {/* Could list selected members avatars here horizontally */}
                    </View>

                    <TouchableOpacity
                        style={[styles.createButton, creating && { opacity: 0.7 }]}
                        onPress={handleCreateGroup}
                        disabled={creating}
                    >
                        {creating ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.createButtonText}>Create Group</ThemedText>}
                    </TouchableOpacity>
                </View>
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
        backgroundColor: 'rgba(3, 103, 39, 0.1)' // Highlight
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
        marginLeft: 78 // Align with text
    },
    avatarPicker: {
        alignItems: 'center',
        marginBottom: 30
    },
    groupIcon: {
        width: 100,
        height: 100,
        borderRadius: 50
    },
    groupIconPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center'
    },
    input: {
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        padding: 12,
        color: Colors.text,
        fontSize: 16,
        marginBottom: 16
    },
    createButton: {
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    createButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    }
});
