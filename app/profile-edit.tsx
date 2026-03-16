import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, FlatList, Image, Modal } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/Colors';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/Config';
import { AVATARS, getAvatarById } from '../constants/Avatars';
import { Avatar } from '../components/Avatar';
import { ThemedText } from '../components/ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';

export default function ProfileEditScreen() {
    const { user, updateUserProfile, reloadUser } = useUser();
    const [username, setUsername] = useState(user?.username || '');
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [links, setLinks] = useState<{ label: string, url: string }[]>([]);
    const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
    const [currentLink, setCurrentLink] = useState({ label: '', url: '' });

    const [avatarId, setAvatarId] = useState(user?.avatar_id || '1');
    const [customAvatar, setCustomAvatar] = useState<string | null>(user?.avatar_url ? `${Config.API_URL}/${user.avatar_url}` : null);
    const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);

    // Password change states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const [isSecurityVisible, setIsSecurityVisible] = useState(false);
    
    useEffect(() => {
        reloadUser();
    }, []);

    useEffect(() => {
        if (user) {
            setUsername(user.username);
            setDisplayName(user.display_name || '');
            setBio(user.bio || '');
            try {
                setLinks(user.links ? JSON.parse(user.links) : []);
            } catch (e) {
                setLinks([]);
            }
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
                links: JSON.stringify(links),
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
                    links: JSON.stringify(links),
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
            <View style={styles.container}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Custom Header Row */}
                        <View style={styles.headerRow}>
                            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                                <Ionicons name="chevron-back" size={24} color={Colors.text} />
                            </TouchableOpacity>
                            <ThemedText type="title">Edit Profile</ThemedText>
                        </View>

                        {/* 1. Top Profile Header Card */}
                        <View style={styles.profileHeaderCard}>
                            <View style={styles.headerAvatarContainer}>
                                <Avatar 
                                    source={avatarId === 'custom' ? customAvatar : Object.values(AVATARS)[parseInt(avatarId) || 0]} 
                                    size={85} 
                                />
                            </View>
                            <Text style={styles.headerDisplayName}>{displayName || 'New User'}</Text>
                            <Text style={styles.headerUsername}>@{username || 'username'}</Text>
                            {bio ? <Text style={styles.headerBio}>{bio}</Text> : null}
                            
                            <View style={styles.socialLinksRow}>
                                <Ionicons name="logo-instagram" size={20} color={Colors.textSecondary} />
                                <Ionicons name="logo-twitter" size={20} color={Colors.textSecondary} />
                                <Ionicons name="globe-outline" size={20} color={Colors.textSecondary} />
                            </View>
                        </View>

                        {/* 2. Avatar Selector */}
                        <View style={styles.avatarSection}>
                            <Text style={styles.sectionLabel}>Choose Avatar</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScroll}>
                                <TouchableOpacity style={styles.uploadButton} onPress={handlePickAvatar}>
                                    <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
                                </TouchableOpacity>

                                {customAvatar && (
                                    <TouchableOpacity
                                        style={[styles.avatarWrapper, avatarId === 'custom' && styles.avatarSelected]}
                                        onPress={() => setAvatarId('custom')}
                                    >
                                        <Avatar source={customAvatar} size={60} />
                                    </TouchableOpacity>
                                )}

                                {Object.values(AVATARS).map((source, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.avatarWrapper, avatarId === index.toString() && styles.avatarSelected]}
                                        onPress={() => setAvatarId(index.toString())}
                                    >
                                        <Avatar source={source} size={60} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* 3. Profile Information Section */}
                        <View style={styles.infoCard}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Display Name</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Your full name"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Username</Text>
                                <TextInput
                                    style={[styles.textInput, !canUpdateUsername && { opacity: 0.5 }]}
                                    placeholder="Unique username"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={username}
                                    onChangeText={setUsername}
                                    editable={canUpdateUsername}
                                    autoCapitalize="none"
                                />
                                {!canUpdateUsername && (
                                    <Text style={{ color: Colors.error, fontSize: 11, marginTop: 4 }}>
                                        Change available in {daysRemaining} days
                                    </Text>
                                )}
                            </View>

                            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                                <Text style={styles.inputLabel}>Bio</Text>
                                <TextInput
                                    style={[styles.textInput, styles.bioInput]}
                                    placeholder="Tell something about yourself..."
                                    placeholderTextColor={Colors.textSecondary}
                                    value={bio}
                                    onChangeText={(text) => setBio(text.slice(0, 120))}
                                    multiline
                                    maxLength={120}
                                />
                                <Text style={styles.charCount}>{bio.length}/120</Text>
                            </View>
                        </View>

                        {/* 4. Links Section */}
                        <View style={styles.linksCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.collapsibleTitle}>Links</Text>
                                <TouchableOpacity 
                                    onPress={() => {
                                        if (links.length >= 5) {
                                            Alert.alert('Limit Reached', 'You can only add up to 5 links.');
                                            return;
                                        }
                                        setCurrentLink({ label: '', url: '' });
                                        setIsLinkModalVisible(true);
                                    }}
                                >
                                    <Ionicons name="add-circle" size={24} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>

                            {links.map((link, index) => (
                                <View key={index} style={styles.addedLinkItem}>
                                    <View style={styles.linkIconBox}>
                                        <Ionicons name="link-outline" size={18} color={Colors.text} />
                                    </View>
                                    <View style={styles.linkData}>
                                        <Text style={styles.linkLabel}>{link.label}</Text>
                                        <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => {
                                        const newLinks = [...links];
                                        newLinks.splice(index, 1);
                                        setLinks(newLinks);
                                    }}>
                                        <Ionicons name="close-circle-outline" size={22} color={Colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            
                            {links.length === 0 && (
                                <Text style={{ color: Colors.textSecondary, textAlign: 'center', fontSize: 13, paddingVertical: 10 }}>
                                    No links added yet.
                                </Text>
                            )}
                        </View>

                        {/* 5. Security Section */}
                        <View style={styles.collapsibleCard}>
                            <TouchableOpacity 
                                style={styles.collapsibleHeader} 
                                onPress={() => setIsSecurityVisible(!isSecurityVisible)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
                                    <Text style={styles.collapsibleTitle}>Security</Text>
                                </View>
                                <Ionicons name={isSecurityVisible ? "chevron-up" : "chevron-down"} size={20} color={Colors.textSecondary} />
                            </TouchableOpacity>

                            {isSecurityVisible && (
                                <View style={styles.collapsibleContent}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Current Password</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            secureTextEntry
                                            value={currentPassword}
                                            onChangeText={setCurrentPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor={Colors.glassBorder}
                                        />
                                    </View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>New Password</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            secureTextEntry
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor={Colors.glassBorder}
                                        />
                                    </View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Confirm Password</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            secureTextEntry
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor={Colors.glassBorder}
                                        />
                                    </View>
                                    <TouchableOpacity 
                                        style={[styles.changePasswordBtn, isUpdatingPassword && { opacity: 0.7 }]}
                                        onPress={handleChangePassword}
                                        disabled={isUpdatingPassword}
                                    >
                                        <Text style={styles.saveButtonText}>
                                            {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* 6. Sticky Save Button */}
                <BlurView intensity={80} tint="dark" style={styles.stickyFooter}>
                    <TouchableOpacity 
                        style={[styles.saveButton, isLoading && { opacity: 0.7 }]} 
                        onPress={handleUpdateProfile}
                        disabled={isLoading}
                    >
                        <Text style={styles.saveButtonText}>
                            {isLoading ? 'Saving Changes...' : 'Save Profile Changes'}
                        </Text>
                    </TouchableOpacity>
                </BlurView>
            </View>

            {/* Link Editor Modal */}
            <Modal
                visible={isLinkModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsLinkModalVisible(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.modalOverlay}>
                        <BlurView intensity={90} tint="dark" style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Add Link</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Label</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="e.g. Portfolio"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={currentLink.label}
                                    onChangeText={(text) => setCurrentLink({ ...currentLink, label: text })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>URL</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="https://example.com"
                                    placeholderTextColor={Colors.textSecondary}
                                    value={currentLink.url}
                                    onChangeText={(text) => setCurrentLink({ ...currentLink, url: text })}
                                    autoCapitalize="none"
                                    keyboardType="url"
                                />
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}
                                    onPress={() => setIsLinkModalVisible(false)}
                                >
                                    <Text style={{ color: Colors.text }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: Colors.primary }]}
                                    onPress={() => {
                                        if (!currentLink.label || !currentLink.url) {
                                            Alert.alert('Error', 'Please fill in both fields');
                                            return;
                                        }
                                        setLinks([...links, currentLink]);
                                        setIsLinkModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.saveButtonText}>Add</Text>
                                </TouchableOpacity>
                            </View>
                        </BlurView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 120, // Reduced padding as tab bar is gone
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        marginBottom: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    // Top Profile Header Card
    profileHeaderCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    headerAvatarContainer: {
        marginBottom: 16,
        padding: 4,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    headerDisplayName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 4,
    },
    headerUsername: {
        fontSize: 14,
        color: Colors.textSecondary,
        opacity: 0.8,
        marginBottom: 12,
    },
    headerBio: {
        fontSize: 14,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    socialLinksRow: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 5,
    },
    // Avatar Selector
    avatarSection: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 12,
        marginLeft: 4,
    },
    avatarScroll: {
        paddingVertical: 5,
    },
    avatarWrapper: {
        marginRight: 12,
        padding: 3,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    avatarSelected: {
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 8,
    },
    uploadButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: Colors.textSecondary,
    },
    // Info Section Card
    infoCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    textInput: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 52,
        color: Colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    bioInput: {
        height: 100,
        paddingTop: 12,
        textAlignVertical: 'top',
    },
    charCount: {
        textAlign: 'right',
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    // Links Section
    linksCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        marginBottom: 20,
    },
    addLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(37, 211, 102, 0.1)',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: Colors.primary,
        marginBottom: 16,
    },
    addedLinkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
    },
    linkIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    linkData: {
        flex: 1,
    },
    linkLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
    },
    linkUrl: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    // Security Section
    collapsibleCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        marginBottom: 20,
        overflow: 'hidden',
    },
    collapsibleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
    },
    collapsibleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    collapsibleContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    changePasswordBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    // Save Button
    stickyFooter: {
        position: 'absolute',
        bottom: 10, // Positioned at the bottom since tab bar is gone
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'transparent',
        zIndex: 100,
        elevation: 10,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: 25,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    saveButtonText: {
        color: Colors.white,
        fontSize: 17,
        fontWeight: 'bold',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        overflow: 'hidden',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 24,
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    modalBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
