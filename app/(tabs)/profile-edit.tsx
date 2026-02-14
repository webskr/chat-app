import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, FlatList, Image } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../../constants/Config';
import { AVATARS, getAvatarById } from '../../constants/Avatars';
import { Avatar } from '../../components/Avatar';
import { ThemedText } from '../../components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';

export default function ProfileEditScreen() {
    const { user, updateUserProfile } = useUser();
    const [username, setUsername] = useState(user?.username || '');
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [website, setWebsite] = useState(user?.website || '');
    const [websiteLabel, setWebsiteLabel] = useState(user?.website_label || '');

    const [avatarId, setAvatarId] = useState(user?.avatar_id || '1');
    const [customAvatar, setCustomAvatar] = useState<string | null>(user?.avatar_url ? `${Config.API_URL}/${user.avatar_url}` : null);
    const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);

    // Password change states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setUsername(user.username);
            setDisplayName(user.display_name || '');
            setBio(user.bio || '');
            setWebsite(user.website || '');
            setWebsiteLabel(user.website_label || '');
            setAvatarId(user.avatar_id || '1');
            if (user.avatar_url) {
                setCustomAvatar(`${Config.API_URL}/${user.avatar_url}`);
            }
        }
    }, [user]);

    const handlePickAvatar = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0].uri) {
                const localUri = result.assets[0].uri;
                setPendingAvatarUri(localUri); // Mark for upload
                setCustomAvatar(localUri); // Show preview
                setAvatarId('custom');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const performAvatarUpload = async (uri: string): Promise<string | null> => {
        if (!user) return null;

        const formData = new FormData();
        const filename = uri.split('/').pop() || 'avatar.jpg';

        if (Platform.OS === 'web') {
            const res = await fetch(uri);
            const blob = await res.blob();
            formData.append('avatar', blob, filename);
        } else {
            formData.append('avatar', {
                uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                name: filename,
                type: 'image/jpeg'
            } as any);
        }

        formData.append('user_id', String(user.id));

        try {
            const response = await fetch(`${Config.API_URL}/users/upload_avatar.php`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                body: formData
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON Parse Error:', e);
                return null;
            }

            if (response.ok) {
                return data.avatar_url;
            } else {
                console.error('Upload failed:', data.message);
                return null;
            }
        } catch (error) {
            console.error('Upload error:', error);
            return null;
        }
    };

    const getDaysRemaining = () => {
        if (!user?.username_last_updated) return 0;
        const lastUpdated = new Date(user.username_last_updated);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastUpdated.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, 15 - diffDays);
    };

    const daysRemaining = getDaysRemaining();
    const canUpdateUsername = daysRemaining === 0 || username === user?.username;


    const handleUpdateProfile = async () => {
        if (!user) {
            Alert.alert('Error', 'User session not found. Please log in again.');
            return;
        }

        if (!username.trim()) {
            Alert.alert('Error', 'Username cannot be empty');
            return;
        }

        setIsLoading(true);
        try {
            let newAvatarUrl = null;

            // 1. Upload Avatar if a new one was selected
            if (pendingAvatarUri) {
                newAvatarUrl = await performAvatarUpload(pendingAvatarUri);
                if (!newAvatarUrl) {
                    Alert.alert('Error', 'Failed to upload image. Please try again.');
                    setIsLoading(false);
                    return;
                }
            }

            // 2. Prepare payload
            const payload: any = {
                id: user.id,
                username: username,
                display_name: displayName,
                bio: bio,
                website: website,
                website_label: websiteLabel,
                avatar_id: avatarId
            };

            if (newAvatarUrl) {
                payload.avatar_url = newAvatarUrl;
            }

            const response = await fetch(`${Config.API_URL}/users/update_profile.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                await updateUserProfile({
                    username: username,
                    display_name: displayName,
                    bio: bio,
                    website: website,
                    website_label: websiteLabel,
                    avatar_id: avatarId,
                    avatar_url: newAvatarUrl || (avatarId === 'custom' ? user.avatar_url : undefined), // Keep existing if custom and not changed, or new one
                    username_last_updated: data.user?.username_last_updated || user.username_last_updated
                });
                setPendingAvatarUri(null); // Clear pending
                Alert.alert('Success', 'Profile updated successfully!');
            } else {
                Alert.alert('Error', data.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Update profile error:', error);
            Alert.alert('Error', 'Could not connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        // ... (Keep existing password logic)
        if (!user) return;
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all password fields');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const response = await fetch(`${Config.API_URL}/auth/update_password.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    current_password: currentPassword,
                    new_password: newPassword
                }),
            });
            const data = await response.json();
            if (response.ok) {
                Alert.alert('Success', 'Password updated successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                Alert.alert('Error', data.message || 'Failed to update password');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not connect to server');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.container, { backgroundColor: Colors.background }]}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.header}>
                            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                                <Ionicons name="arrow-back" size={24} color={Colors.text} />
                            </TouchableOpacity>
                            <ThemedText type="title">Edit Profile</ThemedText>
                        </View>

                        {/* Avatar Selection */}
                        <View style={styles.section}>
                            <ThemedText type="subtitle" style={styles.sectionTitle}>Select Avatar</ThemedText>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarList}>
                                {/* Plus Icon for Upload */}
                                <TouchableOpacity
                                    style={[styles.avatarItem, { backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', width: 60, height: 60, borderRadius: 30 }]}
                                    onPress={handlePickAvatar}
                                >
                                    <Ionicons name="add" size={30} color={Colors.text} />
                                </TouchableOpacity>

                                {customAvatar && (
                                    <TouchableOpacity
                                        style={[styles.avatarItem, avatarId === 'custom' && styles.avatarItemSelected]}
                                        onPress={() => setAvatarId('custom')}
                                    >
                                        <Avatar source={customAvatar} size={60} />
                                        {avatarId === 'custom' && (
                                            <View style={styles.checkIcon}>
                                                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}

                                {Object.entries(AVATARS).map(([key, source], index) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.avatarItem, avatarId === index.toString() && styles.avatarItemSelected]}
                                        onPress={() => setAvatarId(index.toString())}
                                    >
                                        <Avatar source={source} size={60} />
                                        {avatarId === index.toString() && (
                                            <View style={styles.checkIcon}>
                                                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Profile Info */}
                        <BlurView intensity={20} tint="dark" style={styles.glassCard}>
                            <ThemedText type="subtitle" style={styles.cardTitle}>Personal Info</ThemedText>

                            {/* Display Name */}
                            <ThemedText style={styles.inputLabel}>Display Name</ThemedText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter display name"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                />
                            </View>

                            {/* Username */}
                            <ThemedText style={styles.inputLabel}>Username</ThemedText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="at-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, !canUpdateUsername && { opacity: 0.5 }]}
                                    placeholder="Enter username"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={username}
                                    onChangeText={setUsername}
                                    editable={canUpdateUsername}
                                />
                            </View>
                            {!canUpdateUsername && (
                                <ThemedText style={{ color: Colors.error, fontSize: 12, marginTop: -10, marginBottom: 15 }}>
                                    You can change your username again in {daysRemaining} days.
                                </ThemedText>
                            )}

                            {/* Bio */}
                            <ThemedText style={styles.inputLabel}>Bio</ThemedText>
                            <View style={[styles.inputContainer, { alignItems: 'flex-start', paddingTop: 12, height: 100 }]}>
                                <Ionicons name="newspaper-outline" size={20} color={Colors.textSecondary} style={[styles.inputIcon, { marginTop: 4 }]} />
                                <TextInput
                                    style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
                                    placeholder="Short bio (optional, max 120 chars)"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={bio}
                                    onChangeText={(text) => setBio(text.slice(0, 120))}
                                    multiline
                                    maxLength={120}
                                />
                            </View>
                            <ThemedText style={{ color: Colors.textSecondary, fontSize: 12, alignSelf: 'flex-end', marginTop: -10, marginBottom: 15 }}>
                                {bio.length}/120
                            </ThemedText>
                        </BlurView>

                        {/* Links & Socials */}
                        <BlurView intensity={20} tint="dark" style={[styles.glassCard, { marginTop: 20 }]}>
                            <ThemedText type="subtitle" style={styles.cardTitle}>Links</ThemedText>

                            <ThemedText style={styles.inputLabel}>Link Label</ThemedText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="pricetag-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. My Website, Portfolio"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={websiteLabel}
                                    onChangeText={setWebsiteLabel}
                                />
                            </View>

                            <ThemedText style={styles.inputLabel}>URL</ThemedText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="link-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="https://"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={website}
                                    onChangeText={setWebsite}
                                    autoCapitalize="none"
                                    keyboardType="url"
                                />
                            </View>
                        </BlurView>

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled]}
                            onPress={handleUpdateProfile}
                            disabled={isLoading}
                        >
                            <View style={[styles.buttonGradient, { backgroundColor: Colors.primary }]}>
                                <Text style={styles.buttonText}>
                                    {isLoading ? 'Saving...' : 'Save Changes'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Password Change */}
                        <BlurView intensity={20} tint="dark" style={[styles.glassCard, { marginTop: 20 }]}>
                            <ThemedText type="subtitle" style={styles.cardTitle}>Change Password</ThemedText>

                            <ThemedText style={styles.inputLabel}>Current Password</ThemedText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter current password"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    secureTextEntry
                                />
                            </View>

                            <ThemedText style={styles.inputLabel}>New Password</ThemedText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-open-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter new password"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry
                                />
                            </View>

                            <ThemedText style={styles.inputLabel}>Confirm Password</ThemedText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm new password"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, isUpdatingPassword && styles.buttonDisabled]}
                                onPress={handleChangePassword}
                                disabled={isUpdatingPassword}
                            >
                                <View style={[styles.buttonGradient, { backgroundColor: Colors.primary }]}>
                                    <Text style={styles.buttonText}>
                                        {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </BlurView>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    gradient: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 15,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        marginBottom: 15,
        color: Colors.textSecondary,
    },
    avatarList: {
        paddingVertical: 10,
    },
    avatarItem: {
        marginRight: 15,
        padding: 5,
        borderRadius: 40,
        position: 'relative',
    },
    avatarItemSelected: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    checkIcon: {
        position: 'absolute',
        bottom: -5,
        right: -5,
        backgroundColor: Colors.background,
        borderRadius: 12,
    },
    glassCard: {
        padding: 20,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        overflow: 'hidden',
    },
    cardTitle: {
        marginBottom: 20,
        fontSize: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 15,
        marginBottom: 15,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        color: Colors.text,
        fontSize: 16,
    },
    button: {
        height: 50,
        borderRadius: 15,
        overflow: 'hidden',
        marginTop: 10,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    inputLabel: {
        color: Colors.textSecondary,
        fontSize: 14,
        marginBottom: 8,
        marginLeft: 4,
    },
});
