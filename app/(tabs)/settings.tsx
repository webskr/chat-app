import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import {
    User,
    Bell,
    Lock,
    Palette,
    LogOut,
    ChevronRight,
    Shield,
    CircleHelp,
    MoreVertical
} from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../context/UserContext';

const SECTIONS = [
    // ... existing sections (omitted for brevity if possible, but replace_file_content needs exact match)

    {
        title: 'Account',
        items: [
            { id: 'profile', icon: User, label: 'Profile', type: 'link' },
            { id: 'privacy', icon: Lock, label: 'Privacy', type: 'link' },
            { id: 'security', icon: Shield, label: 'Security', type: 'link' },
        ],
    },
    {
        title: 'Preferences',
        items: [
            { id: 'notifications', icon: Bell, label: 'Notifications', type: 'toggle', value: true },
            { id: 'appearance', icon: Palette, label: 'Appearance', type: 'link' },
        ],
    },
    {
        title: 'Support',
        items: [
            { id: 'help', icon: CircleHelp, label: 'Help & Support', type: 'link' },
        ],
    },
];

export default function SettingsScreen() {
    const { user, setUser } = useUser();

    const handleLogout = async () => {
        try {
            await setUser(null);
            router.replace('/(auth)/login');
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <ThemedText type="title" style={styles.headerTitle}>Vegarm</ThemedText>
                    <TouchableOpacity onPress={() => {/* More options */ }}>
                        <MoreVertical size={22} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Profile Card */}
                <GlassCard style={styles.profileCard}>
                    <TouchableOpacity
                        style={styles.profileRow}
                        onPress={() => router.push('/(tabs)/profile-edit')}
                        activeOpacity={0.7}
                    >
                        <Avatar source={getAvatarById(user?.avatar_id || '1')} size={60} online={true} />
                        <View style={styles.profileInfo}>
                            <ThemedText type="defaultSemiBold" style={styles.profileName}>
                                {user?.username || 'Guest'}
                            </ThemedText>
                            <ThemedText type="caption">{user?.email || 'Not logged in'}</ThemedText>
                        </View>
                        <View style={styles.editButton}>
                            <ThemedText style={{ color: Colors.primary }}>Edit</ThemedText>
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
                                        onPress={() => item.id === 'profile' && router.push('/(tabs)/profile-edit')}
                                    >
                                        <View style={styles.settingLeft}>
                                            <View style={styles.iconContainer}>
                                                <item.icon size={20} color={Colors.text} />
                                            </View>
                                            <ThemedText>{item.label}</ThemedText>
                                        </View>
                                        {item.type === 'link' && (
                                            <ChevronRight size={20} color={Colors.textSecondary} />
                                        )}
                                        {item.type === 'toggle' && (
                                            <Switch
                                                value={item.value}
                                                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                                thumbColor={Colors.white}
                                            />
                                        )}
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

                <ThemedText type="caption" style={styles.version}>Version 1.0.0</ThemedText>
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
});
