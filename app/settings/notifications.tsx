import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { GlassCard } from '../../components/GlassCard';
import { ChevronLeft, Bell, EyeOff, Shield } from 'lucide-react-native';
import { router } from 'expo-router';
import { useUser } from '../../context/UserContext';
import { ApiService } from '../../utils/ApiService';
import { Config } from '../../constants/Config';

export default function NotificationSettingsScreen() {
    const { user, updateUserProfile } = useUser();

    const updateSetting = async (key: string, value: number) => {
        try {
            await updateUserProfile({ [key]: value });
            const response = await ApiService.post(`${Config.API_URL}/users/update_profile.php`, {
                id: user?.id,
                [key]: value
            });
            
            if (!response.ok) {
                console.error(`Failed to update ${key} on server`);
                // Revert local state if server fails
                await updateUserProfile({ [key]: user?.[key as keyof typeof user] });
                Alert.alert("Error", "Failed to update settings. Please try again.");
            }
        } catch (e) {
            console.error(`Error updating ${key}`, e);
            Alert.alert("Error", "An unexpected error occurred.");
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.headerTitle}>Notifications</ThemedText>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={styles.sectionTitle}>Main Settings</ThemedText>
                <GlassCard style={styles.card}>
                    <View style={styles.item}>
                        <View style={styles.itemLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                <Bell size={20} color="#3b82f6" />
                            </View>
                            <View>
                                <ThemedText style={styles.itemText}>Enable Notifications</ThemedText>
                                <ThemedText type="caption">Receive push notifications for messages</ThemedText>
                            </View>
                        </View>
                        <Switch
                            value={user?.notifications_enabled !== 0}
                            onValueChange={(val) => updateSetting('notifications_enabled', val ? 1 : 0)}
                            trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                            thumbColor={Colors.white}
                        />
                    </View>
                </GlassCard>

                <ThemedText style={[styles.sectionTitle, { marginTop: 24 }]}>Privacy & Security</ThemedText>
                <GlassCard style={styles.card}>
                    <View style={styles.item}>
                        <View style={styles.itemLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                <EyeOff size={20} color="#10b981" />
                            </View>
                            <View>
                                <ThemedText style={styles.itemText}>Hide Message Content</ThemedText>
                                <ThemedText type="caption">Don't show message preview in notifications</ThemedText>
                            </View>
                        </View>
                        <Switch
                            value={user?.hide_notification_message === 1}
                            onValueChange={(val) => updateSetting('hide_notification_message', val ? 1 : 0)}
                            trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                            thumbColor={Colors.white}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.item}>
                        <View style={styles.itemLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                                <Shield size={20} color="#8b5cf6" />
                            </View>
                            <View>
                                <ThemedText style={styles.itemText}>Hide Sender Name</ThemedText>
                                <ThemedText type="caption">Hide who sent the message in notifications</ThemedText>
                            </View>
                        </View>
                        <Switch
                            value={user?.hide_notification_name === 1}
                            onValueChange={(val) => updateSetting('hide_notification_name', val ? 1 : 0)}
                            trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                            thumbColor={Colors.white}
                        />
                    </View>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 12,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemText: {
        fontSize: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.glassBorder,
        marginLeft: 64,
    },
});
