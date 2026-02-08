import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Colors } from '../constants/Colors';
import { ThemedText } from './ThemedText';
import { Avatar } from './Avatar';
import { GlassCard } from './GlassCard';
import { X, MessageCircle, Ban, BadgeCheck, UserMinus, ShieldCheck, Clock } from 'lucide-react-native';
import { getAvatarById } from '../constants/Avatars';
import { BlurView } from 'expo-blur';
import { Config } from '../constants/Config';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface ProfileModalProps {
    visible: boolean;
    onClose: () => void;
    user: any;
    currentUser: any;
    relationship?: 'friend' | 'blocked' | 'request_received' | 'pending' | 'none' | 'self';
    onActionComplete?: () => void;
}

export function ProfileModal({ visible, onClose, user, currentUser, relationship = 'none', onActionComplete }: ProfileModalProps) {
    if (!user) return null;

    const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : 'Unknown';

    const handleAction = async (action: string) => {
        try {
            const endpoint = action === 'report' ? '/users/report_user.php' : '/users/handle_relationship.php';
            const body = action === 'report'
                ? { reporter_id: currentUser?.id, reported_id: user.id, reason: 'Reported via profile' }
                : { user_id: currentUser?.id, target_id: user.id, action };

            const response = await fetch(`${Config.API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                if (onActionComplete) onActionComplete();
                onClose();
            }
        } catch (error) {
            console.error('Action failed:', error);
        }
    };

    const handleMessage = () => {
        onClose();
        router.push({
            pathname: '/chat/[id]',
            params: {
                id: user.id,
                user: user.username,
                avatar_id: user.avatar_id
            }
        });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <GlassCard style={styles.modalContent} intensity={80}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <X size={24} color={Colors.text} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Avatar source={getAvatarById(user.avatar_id)} size={100} online={relationship === 'friend'} />
                        <View style={styles.nameSection}>
                            <ThemedText type="title" style={styles.displayName}>
                                {user.display_name || user.username}
                            </ThemedText>
                            {user.display_name && (
                                <ThemedText style={styles.handle}>@{user.username}</ThemedText>
                            )}
                            <ThemedText style={styles.joined}>Joined {joinedDate}</ThemedText>
                        </View>
                    </View>

                    {user.bio && (
                        <View style={styles.bioSection}>
                            <ThemedText style={styles.bioLabel}>ABOUT</ThemedText>
                            <ThemedText style={styles.bioText}>{user.bio}</ThemedText>
                        </View>
                    )}

                    <View style={styles.actions}>
                        {/* Friend Actions */}
                        {relationship === 'friend' && (
                            <>
                                <ActionButton icon={MessageCircle} label="Message" onPress={handleMessage} primary />
                                <ActionButton icon={Ban} label="Block" onPress={() => handleAction('block')} destructive />
                            </>
                        )}

                        {/* Request Actions */}
                        {relationship === 'request_received' && (
                            <>
                                <ActionButton icon={BadgeCheck} label="Accept" onPress={() => handleAction('friend')} primary />
                                <ActionButton icon={UserMinus} label="Decline" onPress={() => handleAction('decline')} />
                                <ActionButton icon={Ban} label="Block" onPress={() => handleAction('block')} destructive />
                            </>
                        )}

                        {/* Sent Request Actions */}
                        {relationship === 'pending' && (
                            <>
                                <ActionButton icon={Clock} label="Unsend" onPress={() => handleAction('decline')} primary />
                                <ActionButton icon={Ban} label="Block" onPress={() => handleAction('block')} destructive />
                            </>
                        )}

                        {/* Blocked Actions */}
                        {relationship === 'blocked' && (
                            <ActionButton icon={ShieldCheck} label="Unblock" onPress={() => handleAction('unblock')} primary />
                        )}

                        {/* Stranger Actions can be added here if needed */}
                        {relationship === 'none' && (
                            <>
                                <ActionButton icon={MessageCircle} label="Message" onPress={handleMessage} primary />
                                <ActionButton icon={Ban} label="Block" onPress={() => handleAction('block')} destructive />
                            </>
                        )}
                    </View>
                </GlassCard>
            </View>
        </Modal>
    );
}

const ActionButton = ({ icon: Icon, label, onPress, primary, destructive }: any) => (
    <TouchableOpacity
        style={[
            styles.actionButton,
            primary && styles.primaryButton,
            destructive && styles.destructiveButton
        ]}
        onPress={onPress}
    >
        <Icon size={20} color={primary ? '#fff' : destructive ? '#ff4444' : Colors.text} />
        <ThemedText style={[
            styles.actionLabel,
            primary && { color: '#fff' },
            destructive && { color: '#ff4444' }
        ]}>{label}</ThemedText>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end', // Bottom sheet style or center? Let's go center for profile
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        width: width * 0.9,
        marginBottom: height * 0.15, // Lift it up a bit
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        overflow: 'hidden', // For blur
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        padding: 4,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        gap: 16,
    },
    nameSection: {
        alignItems: 'center',
        gap: 4,
    },
    displayName: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    handle: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    joined: {
        fontSize: 12,
        color: Colors.textSecondary,
        opacity: 0.7,
    },
    bioSection: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
    },
    bioLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        marginBottom: 8,
        letterSpacing: 1,
    },
    bioText: {
        fontSize: 14,
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
        width: '100%',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    destructiveButton: {
        borderColor: 'rgba(255,68,68, 0.3)',
        backgroundColor: 'rgba(255,68,68, 0.1)',
    },
    actionLabel: {
        fontWeight: '600',
        fontSize: 14,
    },
});
