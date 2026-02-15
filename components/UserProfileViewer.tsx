import React, { useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Animated,
    ScrollView,
    PanResponder,
    Image,
    Alert
} from 'react-native';
import { Colors } from '../constants/Colors';
import { ThemedText } from './ThemedText';
import { Avatar } from './Avatar';
import {
    X,
    MessageCircle,
    Phone,
    Video,
    Bell,
    BellOff,
    Ban,
    Flag,
    ChevronDown,
    MapPin,
    Link as LinkIcon,
    Image as ImageIcon
} from 'lucide-react-native';
import { getAvatarById } from '../constants/Avatars';
import { BlurView } from 'expo-blur';
import { Config } from '../constants/Config';
import { router } from 'expo-router';
import { formatChatTime } from '../utils/time';

const { width, height } = Dimensions.get('window');

interface UserProfileViewerProps {
    visible: boolean;
    onClose: () => void;
    user: any;
    currentUser: any;
    relationship?: 'friend' | 'blocked' | 'request_received' | 'pending' | 'none' | 'self';
    onActionComplete?: () => void;
}

export function UserProfileViewer({
    visible,
    onClose,
    user,
    currentUser,
    relationship = 'none',
    onActionComplete
}: UserProfileViewerProps) {
    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: height,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: height,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => onClose());
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 10; // Only capture downward swipes
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) {
                    handleClose();
                }
            },
        })
    ).current;


    if (!user) return null;

    const isSelf = String(user.id) === String(currentUser?.id);
    const isOnline = user.last_seen && (Date.now() - new Date(user.last_seen).getTime() < 60000);
    const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : '';

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
                if (action === 'block') Alert.alert('Blocked', `${user.username} has been blocked.`);
                if (action === 'report') Alert.alert('Reported', 'User has been reported.');
                if (onActionComplete) onActionComplete();
                if (action === 'block') handleClose();
            }
        } catch (error) {
            console.error('Action failed:', error);
            Alert.alert('Error', 'Action failed. Please try again.');
        }
    };

    const handleMessage = () => {
        if (isSelf) return;
        onClose();
        router.push({
            pathname: '/chat/[id]',
            params: {
                id: user.id,
                user: user.username,
                avatar_id: user.avatar_id,
                avatar_url: user.avatar_url
            }
        });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none" // We handle animation
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Background Blur */}
                <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1}>
                        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                    </TouchableOpacity>
                </Animated.View>

                {/* Main Card */}
                <Animated.View
                    style={[
                        styles.modalContent,
                        { transform: [{ translateY: slideAnim }] }
                    ]}
                    {...panResponder.panHandlers}
                >
                    {/* Status Bar Spacer */}
                    <View style={styles.dragIndicator} />

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Header Actions */}
                        <View style={styles.headerRow}>
                            <TouchableOpacity onPress={handleClose} style={styles.iconBtn}>
                                <ChevronDown size={28} color="#fff" />
                            </TouchableOpacity>
                            {/* Can add share/more options here */}
                            {!isSelf && (
                                <TouchableOpacity onPress={() => handleAction('report')} style={styles.iconBtn}>
                                    <MoreVerticalIcon />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* HERO SECTION */}
                        <View style={styles.hero}>
                            <View style={styles.avatarContainer}>
                                <Avatar
                                    source={user.avatar_url ? `${Config.API_URL}/${user.avatar_url}` : getAvatarById(user.avatar_id)}
                                    size={120}
                                    online={relationship === 'friend' && isOnline}
                                />
                            </View>
                            <ThemedText type="title" style={styles.displayName}>
                                {user.display_name || user.username}
                            </ThemedText>
                            <ThemedText style={styles.handle}>@{user.username}</ThemedText>

                            {!isSelf && (
                                <View style={styles.statusBadge}>
                                    <View style={[styles.statusDot, { backgroundColor: isOnline ? Colors.online : Colors.textSecondary }]} />
                                    <ThemedText style={styles.statusText}>
                                        {isOnline ? 'Online' : user.last_seen ? `Last seen ${formatChatTime(user.last_seen)}` : 'Offline'}
                                    </ThemedText>
                                </View>
                            )}
                        </View>

                        {/* ACTION ROW */}
                        {!isSelf && (
                            <View style={styles.actionRow}>
                                <ActionButton icon={MessageCircle} label="Message" onPress={handleMessage} primary />
                                <ActionButton icon={Phone} label="Call" onPress={() => Alert.alert('Coming Soon', 'Voice calls are coming soon!')} />
                                <ActionButton icon={Video} label="Video" onPress={() => Alert.alert('Coming Soon', 'Video calls are coming soon!')} />
                                <ActionButton icon={Bell} label="Mute" onPress={() => { }} />
                            </View>
                        )}

                        {/* CONTENT SECTION */}
                        <View style={styles.section}>
                            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>About</ThemedText>
                            <ThemedText style={styles.bioText}>
                                {user.bio || "No bio yet."}
                            </ThemedText>
                            {joinedDate ? (
                                <View style={styles.metaRow}>
                                    <MapPin size={14} color={Colors.textSecondary} />
                                    <ThemedText style={styles.metaText}>Joined {joinedDate}</ThemedText>
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Media</ThemedText>
                                <TouchableOpacity>
                                    <ThemedText style={styles.seeAll}>See All</ThemedText>
                                </TouchableOpacity>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
                                {/* Placeholder Media Grid */}
                                {[1, 2, 3, 4].map((i) => (
                                    <View key={i} style={styles.mediaPlaceholder}>
                                        <ImageIcon size={24} color="rgba(255,255,255,0.2)" />
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

                        {/* FOOTER ACTIONS */}
                        {!isSelf && (
                            <View style={styles.footer}>
                                <TouchableOpacity style={styles.footerBtn} onPress={() => handleAction('block')}>
                                    <Ban size={20} color="#FF6B6B" />
                                    <ThemedText style={[styles.footerBtnText, { color: '#FF6B6B' }]}>
                                        Block {user.username}
                                    </ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.footerBtn} onPress={() => handleAction('report')}>
                                    <Flag size={20} color="#FF6B6B" />
                                    <ThemedText style={[styles.footerBtnText, { color: '#FF6B6B' }]}>
                                        Report User
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={{ height: 100 }} />
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const ActionButton = ({ icon: Icon, label, onPress, primary }: any) => (
    <TouchableOpacity style={styles.actionBtnContainer} onPress={onPress}>
        <View style={[styles.actionBtnCircle, primary && styles.primaryActionBtn]}>
            <Icon size={24} color={primary ? '#000' : '#fff'} />
        </View>
        <ThemedText style={styles.actionBtnLabel}>{label}</ThemedText>
    </TouchableOpacity>
);

const MoreVerticalIcon = () => (
    <View style={{ gap: 3 }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        height: '92%',
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
    },
    dragIndicator: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: 12,
    },
    scrollContent: {
        paddingTop: 10,
        paddingHorizontal: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    iconBtn: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    hero: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    avatarContainer: {
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    displayName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    handle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 20,
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        marginBottom: 30,
    },
    actionBtnContainer: {
        alignItems: 'center',
        gap: 8,
    },
    actionBtnCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    primaryActionBtn: {
        backgroundColor: Colors.primary, // Green
        borderColor: Colors.primary,
    },
    actionBtnLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
    },
    section: {
        marginBottom: 30,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        color: '#fff',
        marginBottom: 8,
    },
    bioText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 22,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        opacity: 0.6,
    },
    metaText: {
        fontSize: 12,
        color: '#fff',
    },
    seeAll: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    mediaRow: {
        flexDirection: 'row',
        marginHorizontal: -4,
    },
    mediaPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        gap: 16,
        paddingBottom: 20,
    },
    footerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        backgroundColor: 'rgba(255,68,68, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,68,68, 0.2)',
    },
    footerBtnText: {
        fontWeight: '600',
        fontSize: 16,
    },
});
