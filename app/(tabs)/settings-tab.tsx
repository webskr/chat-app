import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import {
    Check,
    MessageSquarePlus,
    Database,
    User,
    UserPlus,
    Lock,
    Shield,
    UserX,
    Bell,
    Sliders,
    Palette,
    MoreVertical,
    ChevronRight,
    LogOut
} from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';
import { ApiService } from '../../utils/ApiService';

const SECTIONS = [
    {
        title: 'Account',
        items: [
            { id: 'profile', icon: User, label: 'Profile', type: 'link' },
            { id: 'invite', icon: UserPlus, label: 'Invite Friends', type: 'link' },
            { id: 'privacy', icon: Lock, label: 'Privacy', type: 'link' },
            { id: 'backup', icon: Database, label: 'Backup & Restore', type: 'link' },
            { id: 'blocked', icon: UserX, label: 'Blocked Contacts', type: 'link' },
        ],
    },
    {
        title: 'Preferences',
        items: [
            { id: 'notifications', icon: Bell, label: 'Notifications', type: 'link' },
            { id: 'controls', icon: Sliders, label: 'Controls', type: 'link' },
            { id: 'appearance', icon: Palette, label: 'Appearance', type: 'link' },
        ],
    },
    {
        title: 'Support',
        items: [
            { id: 'feedback', icon: MessageSquarePlus, label: 'Feedback & Support', type: 'link' },

        ],
    },
];

const AUTO_DELETE_OPTIONS = [
    { label: 'Off', value: 0 },
    { label: '10 Minutes', value: 10 },
    { label: '24 Hours', value: 1440 },
    { label: '7 Days', value: 10080 },
    { label: '30 Days', value: 43200 },
    { label: '90 Days', value: 129600 },
];

export default function SettingsScreen() {
    const { user, setUser, reloadUser, isProfileComplete, updateUserProfile } = useUser();
    const [avatarKey, setAvatarKey] = React.useState(Date.now());

    useFocusEffect(
        React.useCallback(() => {
            reloadUser();
            setAvatarKey(Date.now()); // Force refresh image
        }, [])
    );

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out? Your messages will remain saved on this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Close the DB connection without dropping any tables.
                            // Messages and media files are fully preserved.
                            LocalDatabaseService.resetConnection();
                            // Remove the session (user object) from AsyncStorage.
                            await setUser(null);
                            router.replace('/(auth)/login');
                        } catch (error) {
                            console.error('[Logout] Error during logout:', error);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <ThemedText type="title" style={styles.headerTitle}>Vegram</ThemedText>
                    <TouchableOpacity onPress={() => {/* More options */ }}>
                        <MoreVertical size={22} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Profile Card */}
                <GlassCard style={styles.profileCard}>
                    <TouchableOpacity
                        style={styles.profileRow}
                        onPress={() => router.push('/profile-edit')}
                        activeOpacity={0.7}
                    >
                        <Avatar
                            key={`${user?.avatar_url}-${avatarKey}`}
                            source={user?.avatar_url ? `${Config.API_URL}/${user.avatar_url}?t=${avatarKey}` : getAvatarById(user?.avatar_id ?? '1')}
                            size={60}
                            online={true}
                        />
                        <View style={styles.profileInfo}>
                            <ThemedText type="defaultSemiBold" style={styles.profileName}>
                                {user?.username || 'Guest'}
                            </ThemedText>
                            <ThemedText type="caption">{user?.email || 'Not logged in'}</ThemedText>
                        </View>
                        <View style={styles.editButton}>
                            <ThemedText style={{ color: Colors.primary }}>Edit</ThemedText>
                            {!isProfileComplete && (
                                <View style={styles.inlineRedDot} />
                            )}
                        </View>
                    </TouchableOpacity>
                </GlassCard>

                {/* Settings Sections */}
                {SECTIONS.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>{section.title}</ThemedText>
                        <GlassCard style={styles.sectionCard}>
                            {section.items.map((item, itemIndex) => (
                                <View key={item.id}>
                                    <TouchableOpacity
                                        style={styles.settingItem}
                                        disabled={item.type === 'toggle'}
                                        onPress={() => {
                                            if (item.id === 'profile') router.push('/profile-edit');
                                            if (item.id === 'invite') router.push('/invite');
                                            if (item.id === 'notifications') router.push('/settings/notifications');
                                            if (item.id === 'controls') router.push('/settings/controls');
                                            if (item.id === 'privacy') router.push('/settings/privacy');
                                            if (item.id === 'appearance') router.push('/appearance');
                                            if (item.id === 'backup') router.push('/settings/backup');
                                            if (item.id === 'blocked') router.push('/settings/blocked');
                                            if (item.id === 'feedback') router.push('/settings/feedback');
                                        }}
                                    >
                                        <View style={styles.settingLeft}>
                                            <View style={styles.iconContainer}>
                                                <item.icon size={20} color={Colors.text} />
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <ThemedText>{item.label}</ThemedText>
                                                {item.id === 'profile' && !isProfileComplete && (
                                                    <View style={styles.smallRedDot} />
                                                )}
                                            </View>
                                        </View>

                                        {item.type === 'link' ? (
                                            <ChevronRight size={20} color={Colors.textSecondary} />
                                        ) : null}
                                    </TouchableOpacity>

                                    {itemIndex < section.items.length - 1 && (
                                        <View style={styles.divider} />
                                    )}
                                </View>
                            ))}
                        </GlassCard>
                    </View>
                ))}

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut size={20} color={Colors.accent} />
                    <ThemedText style={{ color: Colors.accent, fontWeight: '600' }}>Log Out</ThemedText>
                </TouchableOpacity>

                <ThemedText type="caption" style={styles.version}>Version 1.0.0 - WEBSKR</ThemedText>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({

    headerTitle: {
        fontSize: 24, // WhatsApp uses ~20-23sp for Title
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 0.5,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    header: {

        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
    },
    profileCard: {
        padding: 16,
        marginBottom: 24,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 18,
        marginBottom: 4,
    },
    editButton: {
        padding: 8,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        marginBottom: 12,
        marginLeft: 4,
    },
    sectionCard: {

    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.glassBorder,
        marginLeft: 60,
    },
    dropdownContainer: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderTopWidth: 1,
        borderTopColor: Colors.glassBorder,
    },
    dropdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        paddingLeft: 60, // Indent to align with text
    },
    dropdownItemSelected: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)', // Example highlight
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(244, 63, 94, 0.1)', // Rose with opacity
        marginTop: 8,
    },
    version: {
        textAlign: 'center',
        marginTop: 24,
        opacity: 0.5,
    },
    inlineRedDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.error,
        marginLeft: 4,
    },
    smallRedDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.error,
    },
});
