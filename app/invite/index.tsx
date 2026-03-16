import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Platform, Share, ActivityIndicator, Alert, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Share2, Copy, Trash2, Plus, Users, Clock, Hash, RefreshCcw } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { GlassCard } from '../../components/GlassCard';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { formatChatTime } from '../../utils/time';

export default function InviteFriendsScreen() {
    const { user: currentUser } = useUser();
    const [invites, setInvites] = useState<any[]>([]);
    const [stats, setStats] = useState({ sent: 0, joined: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchInvites();
    }, []);

    const fetchInvites = async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`${Config.API_URL}/chat/get_invites.php?user_id=${currentUser.id}`);
            const data = await response.json();
            if (data.success) {
                setInvites(data.invites);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching invites:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const createInvite = async (type: 'permanent' | 'limited', maxUses?: number, expiresInHours?: number) => {
        if (!currentUser || isCreating) return;
        setIsCreating(true);
        try {
            const response = await fetch(`${Config.API_URL}/chat/create_invite.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    type,
                    max_uses: maxUses,
                    expires_in_hours: expiresInHours
                })
            });
            const data = await response.json();
            if (data.success) {
                fetchInvites();
            } else {
                Alert.alert('Error', data.message || 'Failed to create invite');
            }
        } catch (error) {
            console.error('Error creating invite:', error);
            Alert.alert('Error', 'An error occurred while creating invite');
        } finally {
            setIsCreating(false);
        }
    };

    const revokeInvite = (code: string) => {
        Alert.alert('Revoke Invite', 'Are you sure you want to deactivate this invite link?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Revoke',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const response = await fetch(`${Config.API_URL}/chat/revoke_invite.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: currentUser?.id, invite_code: code })
                        });
                        const data = await response.json();
                        if (data.success) fetchInvites();
                    } catch (error) {
                        console.error('Error revoking invite:', error);
                    }
                }
            }
        ]);
    };

    const handleShare = async (code: string) => {
        const deepLink = `chat-app://invite?code=${code}`;
        const playStoreLink = `https://play.google.com/store/apps/details?id=com.skr.vegarm&referrer=invite_code%3D${code}`;

        const message = Platform.OS === 'android'
            ? `Connect with me on ChatApp! 
            
If you already have the app: ${deepLink}
If not, install it here to auto-add me: ${playStoreLink}`
            : `Join me on ChatApp! Use my invite link to connect: ${deepLink}`;

        try {
            await Share.share({
                message,
                url: Platform.OS === 'ios' ? deepLink : undefined,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const handleCopy = (code: string) => {
        const url = `chat-app://invite?code=${code}`;
        Clipboard.setString(url);
        if (Platform.OS === 'android') {
            Alert.alert('Copied', 'Invite link copied to clipboard');
        } else {
            // Success feedback
        }
    };

    const renderInviteActions = () => (
        <View style={styles.actionContainer}>
            <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.primary }]}
                onPress={() => createInvite('permanent')}
                disabled={isCreating}
            >
                <Plus size={20} color="#fff" />
                <ThemedText style={styles.actionButtonText}>Permanent Link</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
                onPress={() => {
                    Alert.alert('Limited Invite', 'What kind of limit?', [
                        { text: '5 Uses', onPress: () => createInvite('limited', 5) },
                        { text: '24 Hours', onPress: () => createInvite('limited', undefined, 24) },
                        { text: 'Cancel', style: 'cancel' }
                    ]);
                }}
                disabled={isCreating}
            >
                <Clock size={20} color="#fff" />
                <ThemedText style={styles.actionButtonText}>Limited Invite</ThemedText>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={28} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle">Invite Friends</ThemedText>
                <TouchableOpacity onPress={fetchInvites} style={styles.refreshButton}>
                    <RefreshCcw size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Stats Section */}
                <View style={styles.statsRow}>
                    <GlassCard style={styles.statCard}>
                        <Users size={24} color={Colors.primary} />
                        <ThemedText style={styles.statValue}>{stats.joined}</ThemedText>
                        <ThemedText style={styles.statLabel}>Joined</ThemedText>
                    </GlassCard>
                    <GlassCard style={styles.statCard}>
                        <Share2 size={24} color="#8B5CF6" />
                        <ThemedText style={styles.statValue}>{stats.sent}</ThemedText>
                        <ThemedText style={styles.statLabel}>Invites</ThemedText>
                    </GlassCard>
                </View>

                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Generate New Invite</ThemedText>
                {renderInviteActions()}

                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Active Invites</ThemedText>

                {isLoading ? (
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
                ) : invites.length > 0 ? (
                    invites.map((invite) => (
                        <GlassCard key={invite.invite_code} style={[styles.inviteCard, !invite.is_active && styles.inactiveCard]}>
                            <View style={styles.inviteInfo}>
                                <View style={styles.inviteHeader}>
                                    <View style={[styles.typeBadge, { backgroundColor: invite.type === 'permanent' ? Colors.primary + '20' : '#8B5CF620' }]}>
                                        <ThemedText style={[styles.typeText, { color: invite.type === 'permanent' ? Colors.primary : '#8B5CF6' }]}>
                                            {invite.type.toUpperCase()}
                                        </ThemedText>
                                    </View>
                                    {!invite.is_active && (
                                        <View style={styles.revokedBadge}>
                                            <ThemedText style={styles.revokedText}>REVOKED</ThemedText>
                                        </View>
                                    )}
                                </View>

                                <ThemedText style={styles.inviteCode}>{invite.invite_code}</ThemedText>

                                <View style={styles.metaRow}>
                                    <View style={styles.metaItem}>
                                        <Hash size={14} color={Colors.textSecondary} />
                                        <ThemedText style={styles.metaText}>{invite.used_count} uses {invite.max_uses ? `/ ${invite.max_uses}` : ''}</ThemedText>
                                    </View>
                                    {!!invite.expires_at && (
                                        <View style={styles.metaItem}>
                                            <Clock size={14} color={Colors.textSecondary} />
                                            <ThemedText style={styles.metaText}>Exp: {new Date(invite.expires_at).toLocaleDateString()}</ThemedText>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {!!invite.is_active && (
                                <View style={styles.inviteActions}>
                                    <TouchableOpacity style={styles.iconButton} onPress={() => handleCopy(invite.invite_code)}>
                                        <Copy size={20} color={Colors.text} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconButton} onPress={() => handleShare(invite.invite_code)}>
                                        <Share2 size={20} color={Colors.text} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.iconButton, styles.deleteButton]} onPress={() => revokeInvite(invite.invite_code)}>
                                        <Trash2 size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </GlassCard>
                    ))
                ) : (
                    <ThemedText style={styles.emptyText}>You haven't created any invite links yet.</ThemedText>
                )}
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backButton: {
        padding: 4,
        marginLeft: -8,
    },
    refreshButton: {
        padding: 4,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 25,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 20,
        borderRadius: 24,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: 15,
        marginTop: 10,
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 30,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    inviteCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        alignItems: 'center',
    },
    inactiveCard: {
        opacity: 0.6,
    },
    inviteInfo: {
        flex: 1,
    },
    inviteHeader: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    revokedBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    revokedText: {
        color: '#EF4444',
        fontSize: 10,
        fontWeight: 'bold',
    },
    inviteCode: {
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    inviteActions: {
        flexDirection: 'row',
        gap: 8,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    deleteButton: {
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginTop: 40,
        fontSize: 15,
    },
});
