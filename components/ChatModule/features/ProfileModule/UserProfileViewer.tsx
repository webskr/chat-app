import React, { useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Animated,
    ScrollView,
    Image,
    Alert,
    Switch,
    Linking
} from 'react-native';
import { Colors } from '../../../../constants/Colors';
import { ThemedText } from '../../../../components/ThemedText';
import { Avatar } from '../../../../components/Avatar';
import {
    X,
    MessageCircle,
    Bell,
    BellOff,
    Ban,
    Flag,
    ChevronDown,
    MapPin,
    Calendar,
    Link as LinkIcon,
    Lock,
    UserMinus,
    BadgeCheck,
    Clock,
    ShieldCheck,
    MessageSquareLock,
    ChevronRight,
    Info,
    Shield
} from 'lucide-react-native';
import { useChatLock } from '../hooks/useChatLock';
import { LockSetupModal, UnlockPromptModal } from '../ChatLockUI';
import { getAvatarById } from '../../../../constants/Avatars';
import { BlurView } from 'expo-blur';
import { Config } from '../../../../constants/Config';
import { router } from 'expo-router';
import { formatChatTime } from '../../../../utils/time';
import { AVAILABLE_TAGS } from '../../../../constants/Tags';
import { PLATFORMS } from '../../../../constants/Platforms';
import * as LucideIcons from 'lucide-react-native';
import { MediaDocsSection } from './MediaDocsSection';


const { width, height } = Dimensions.get('window');

interface UserProfileViewerProps {
    visible?: boolean;
    onClose: () => void;
    user: any;
    currentUser: any;
    relationship?: 'friend' | 'blocked' | 'request_received' | 'pending' | 'none' | 'self' | 'accepted';
    onActionComplete?: () => void;
    isPage?: boolean;
}

export function UserProfileViewer({
    visible,
    onClose,
    user,
    currentUser,
    relationship = 'none',
    onActionComplete,
    isPage = false
}: UserProfileViewerProps) {
    const slideAnim = useRef(new Animated.Value(isPage ? 0 : height)).current;
    const fadeAnim = useRef(new Animated.Value(isPage ? 1 : 0)).current;
    const [encryptionModalVisible, setEncryptionModalVisible] = React.useState(false);

    const {
        isLocked, setIsLocked,
        showLockSetup, setShowLockSetup, showUnlockPrompt, setShowUnlockPrompt,
        lockPin, setLockPin, unlockPin, setUnlockPin,
        handleConfirmLock, handleConfirmUnlock
    } = useChatLock(user?.id);

    useEffect(() => {
        if (isPage) return;
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
    }, [visible, isPage]);

    const handleClose = () => {
        if (isPage) {
            onClose();
            return;
        }
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

    if (!user) return null;

    const isSelf = String(user.id) === String(currentUser?.id);
    const isOnline = user.last_seen && (Date.now() - new Date(user.last_seen).getTime() < 60000);
    const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : '';
    
    const isFriend = relationship === 'friend' || relationship === 'accepted';
    const isPublic = user.privacy_profile_visibility === 'public';
    const showFullProfile = isFriend || isSelf || isPublic;

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
                if (action === 'unfriend') Alert.alert('Unfriended', `${user.username} has been unfriended.`);
                if (onActionComplete) onActionComplete();
                if (action === 'block' || action === 'unfriend') handleClose();
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

    const content = (
        <View style={[styles.container, isPage && styles.pageContainer]}>
            {/* Background Blur */}
            {!isPage && (
                <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1}>
                        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Main Card */}
            <Animated.View
                style={[
                    isPage ? styles.pageContent : styles.modalContent,
                    !isPage && { transform: [{ translateY: slideAnim }] }
                ]}
            >
                {/* Status Bar Spacer */}
                <View style={{ height: isPage ? 40 : 20 }} />

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Header Actions */}
                    <TouchableOpacity onPress={handleClose} style={styles.iconBtn}>
                        {isPage ? <LucideIcons.ChevronLeft size={28} color="#fff" /> : <ChevronDown size={28} color="#fff" />}
                    </TouchableOpacity>

                    {/* HERO SECTION */}
                    <View style={styles.hero}>
                        <View style={styles.avatarContainer}>
                            <Avatar
                                source={user.avatar_url ? `${Config.API_URL}/${user.avatar_url}` : getAvatarById(user.avatar_id)}
                                size={120}
                                online={relationship === 'friend' && isOnline}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <ThemedText type="title" style={styles.displayName}>
                                {user.display_name || user.username}
                            </ThemedText>
                            {user.is_official == 1 && (
                                <BadgeCheck size={24} color={Colors.officialBadgeBorder} fill={Colors.officialBadge} />
                            )}
                        </View>
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

                    {/* COMBINED CONTENT SECTION */}
                    <View style={styles.section}>
                        {/* About Sub-section */}
                        <View style={styles.subSection}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { marginBottom: 0 }]}>About</ThemedText>
                                {showFullProfile && user.country && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={14} color={Colors.primary} />
                                        <ThemedText style={{ fontSize: 13, color: Colors.primary, fontWeight: '500' }}>
                                            {user.country}{user.state ? `, ${user.state}` : ''}
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                            <ThemedText style={styles.bioText}>
                                {showFullProfile ? (user.bio || "No bio yet.") : "Bio is private."}
                            </ThemedText>
                            
                            <View style={{ gap: 8, marginTop: 12 }}>
                                {joinedDate && (
                                    <View style={styles.metaRow}>
                                        <Calendar size={14} color={Colors.textSecondary} />
                                        <ThemedText style={styles.metaText}>Joined {joinedDate}</ThemedText>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Tags Sub-section */}
                        {showFullProfile && user.tags && (
                            <View style={[styles.subSection, { marginTop: 24 }]}>
                                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Tags</ThemedText>
                                <View style={styles.tagsContainer}>
                                    {(() => {
                                        try {
                                            const tags = typeof user.tags === 'string' ? JSON.parse(user.tags) : user.tags;
                                            if (!Array.isArray(tags) || tags.length === 0) return null;
                                            return tags.map((tagName: string) => {
                                                const tagInfo = AVAILABLE_TAGS.find(t => t.label === tagName);
                                                return (
                                                    <View 
                                                        key={tagName} 
                                                        style={[
                                                            styles.tagChip, 
                                                            { 
                                                                backgroundColor: `${tagInfo?.color || Colors.primary}20`,
                                                                borderColor: tagInfo?.color || Colors.primary
                                                            }
                                                        ]}
                                                    >
                                                        <ThemedText style={[styles.tagText, { color: tagInfo?.color || Colors.text }]}>
                                                            {tagName}
                                                        </ThemedText>
                                                    </View>
                                                );
                                            });
                                        } catch (e) {
                                            return null;
                                        }
                                    })()}
                                </View>
                            </View>
                        )}

                        {/* Links Sub-section */}
                        {showFullProfile && user.links && user.links !== '[]' && (
                            <View style={[styles.subSection, { marginTop: 24 }]}>
                                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Links</ThemedText>
                                <View style={{ gap: 8, marginTop: 12 }}>
                                    {(() => {
                                        try {
                                            const links = typeof user.links === 'string' ? JSON.parse(user.links) : user.links;
                                            if (!Array.isArray(links)) return null;
                                            return links.map((link: any, index: number) => {
                                                const platform = PLATFORMS.find(p => p.id === link.platform) || PLATFORMS.find(p => p.id === 'other')!;
                                                const IconComponent = (LucideIcons as any)[platform.lucideIcon] || LucideIcons.Link;
                                                
                                                return (
                                                    <TouchableOpacity
                                                        key={index}
                                                        style={styles.linkRow}
                                                        onPress={() => Linking.openURL(link.url).catch(err => console.error('Error opening URL:', err))}
                                                    >
                                                        <View style={[styles.linkIconContainer, { backgroundColor: `${platform.color}15` }]}>
                                                            <IconComponent size={18} color={platform.color} />
                                                        </View>
                                                        <ThemedText style={styles.linkText} numberOfLines={1}>
                                                            {link.label || link.url}
                                                        </ThemedText>
                                                    </TouchableOpacity>
                                                );
                                            });
                                        } catch (e) {
                                            return null;
                                        }
                                    })()}
                                </View>
                            </View>
                        )}

                        {/* Shared Media Section */}
                        {showFullProfile && (
                            <MediaDocsSection user={user} currentUser={currentUser} />
                        )}

                        {/* SETTINGS SECTION (Mimicking Image) */}
                        <View style={[styles.subSection, { marginTop: 24, opacity: isSelf ? 0.7 : 1 }]}>
                            <View style={styles.settingsGroup}>
                                <TouchableOpacity 
                                    style={styles.settingsRow}
                                    onPress={() => !isSelf && router.push('/settings/notifications')}
                                    disabled={isSelf}
                                >
                                    <View style={styles.settingsRowLeft}>
                                        <Bell size={22} color="rgba(255,255,255,0.7)" />
                                        <ThemedText style={styles.settingsRowLabel}>Notifications</ThemedText>
                                    </View>
                                    <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.settingsRow}
                                    onPress={() => !isSelf && setEncryptionModalVisible(true)}
                                    disabled={isSelf}
                                >
                                    <View style={styles.settingsRowLeft}>
                                        <Lock size={22} color="rgba(255,255,255,0.7)" />
                                        <View>
                                            <ThemedText style={styles.settingsRowLabel}>Encryption</ThemedText>
                                            <ThemedText style={styles.settingsRowCaption}>
                                                Messages are end-to-end encrypted. Tap to verify.
                                            </ThemedText>
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.settingsRow}
                                    onPress={() => !isSelf && router.push({
                                        pathname: '/settings/controls',
                                        params: { scrollTo: 'chat-management' }
                                    })}
                                    disabled={isSelf}
                                >
                                    <View style={styles.settingsRowLeft}>
                                        <Clock size={22} color="rgba(255,255,255,0.7)" />
                                        <View>
                                            <ThemedText style={styles.settingsRowLabel}>Disappearing messages</ThemedText>
                                            <ThemedText style={styles.settingsRowCaption}>Off</ThemedText>
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.settingsRow}>
                                    <View style={styles.settingsRowLeft}>
                                        <MessageSquareLock size={22} color="rgba(255,255,255,0.7)" />
                                        <View>
                                            <ThemedText style={styles.settingsRowLabel}>Chat lock</ThemedText>
                                            <ThemedText style={styles.settingsRowCaption}>
                                                Lock and hide this chat on this device.
                                            </ThemedText>
                                        </View>
                                    </View>
                                    <Switch
                                        value={isLocked}
                                        onValueChange={(val) => {
                                            if (val) setShowLockSetup(true);
                                            else setShowUnlockPrompt(true);
                                        }}
                                        disabled={isSelf}
                                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: Colors.primary }}
                                        thumbColor="#fff"
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* FOOTER ACTIONS */}
                    {!isSelf && (
                        <View style={styles.footer}>
                            {user.is_official != 1 && (
                                <TouchableOpacity style={styles.footerBtn} onPress={() => handleAction('block')}>
                                    <Ban size={20} color="#FF6B6B" />
                                    <ThemedText style={[styles.footerBtnText, { color: '#FF6B6B' }]}>
                                        Block {user.username}
                                    </ThemedText>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.footerBtn} onPress={() => handleAction('report')}>
                                <Flag size={20} color="#FF6B6B" />
                                <ThemedText style={[styles.footerBtnText, { color: '#FF6B6B' }]}>
                                    Report User
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={{ height: 150 }} />
                </ScrollView>
            </Animated.View>
        </View>
    );

    const isPageContent = isPage;

    if (isPageContent) return (
        <>
            {content}
            {encryptionModalVisible && (
                <Modal
                    visible={encryptionModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setEncryptionModalVisible(false)}
                >
                    <TouchableOpacity 
                        style={styles.overlay} 
                        activeOpacity={1} 
                        onPress={() => setEncryptionModalVisible(false)}
                    >
                        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={styles.modalAlert}>
                            <View style={styles.modalIconCircle}>
                                <ShieldCheck size={48} color={Colors.primary} />
                            </View>
                            <ThemedText type="title" style={styles.modalAlertTitle}>Encryption</ThemedText>
                            <ThemedText style={styles.modalAlertText}>
                                Your messages are end-to-end encrypted. Only you and {user.display_name || user.username} can read them. Not even Vegram can access them.
                            </ThemedText>
                            <TouchableOpacity 
                                style={styles.modalPrimaryBtn}
                                onPress={() => setEncryptionModalVisible(false)}
                            >
                                <ThemedText style={styles.modalPrimaryBtnText}>Close</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}
            <LockSetupModal 
                visible={showLockSetup} 
                onClose={() => setShowLockSetup(false)} 
                lockPin={lockPin} 
                setLockPin={setLockPin} 
                onConfirm={handleConfirmLock} 
            />
            <UnlockPromptModal 
                visible={showUnlockPrompt} 
                onClose={() => setShowUnlockPrompt(false)} 
                unlockPin={unlockPin} 
                setUnlockPin={setUnlockPin} 
                onConfirm={handleConfirmUnlock} 
            />
        </>
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none" // We handle animation
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            {content}

            {/* Encryption Modal */}
            <Modal
                visible={encryptionModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setEncryptionModalVisible(false)}
            >
                <TouchableOpacity 
                    style={styles.overlay} 
                    activeOpacity={1} 
                    onPress={() => setEncryptionModalVisible(false)}
                >
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.modalAlert}>
                        <View style={styles.modalIconCircle}>
                            <ShieldCheck size={48} color={Colors.primary} />
                        </View>
                        <ThemedText type="title" style={styles.modalAlertTitle}>Encryption</ThemedText>
                        <ThemedText style={styles.modalAlertText}>
                            Your messages are end-to-end encrypted. Only you and {user.display_name || user.username} can read them. Not even Vegram can access them.
                        </ThemedText>
                        <TouchableOpacity 
                            style={styles.modalPrimaryBtn}
                            onPress={() => setEncryptionModalVisible(false)}
                        >
                            <ThemedText style={styles.modalPrimaryBtnText}>Close</ThemedText>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Chat Lock Modals */}
            <LockSetupModal 
                visible={showLockSetup} 
                onClose={() => setShowLockSetup(false)} 
                lockPin={lockPin} 
                setLockPin={setLockPin} 
                onConfirm={handleConfirmLock} 
            />
            <UnlockPromptModal 
                visible={showUnlockPrompt} 
                onClose={() => setShowUnlockPrompt(false)} 
                unlockPin={unlockPin} 
                setUnlockPin={setUnlockPin} 
                onConfirm={handleConfirmUnlock} 
            />
        </Modal >
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



const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    pageContainer: {
        justifyContent: 'flex-start',
        backgroundColor: '#1a1a1a',
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
    pageContent: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },

    scrollContent: {
        paddingTop: 10,
        paddingHorizontal: 20,
        paddingBottom: 150,
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
        alignSelf: 'flex-start',
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
    subSection: {
        width: '100%',
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
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
    },
    linkIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    linkText: {
        fontSize: 15,
        color: '#fff',
        flex: 1,
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
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    tagChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
    },
    tagText: {
        fontSize: 14,
        fontWeight: '500',
    },

    // New Styles
    settingsGroup: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 20,
        overflow: 'hidden',
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    settingsRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
    },
    settingsRowLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#fff',
    },
    settingsRowCaption: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalAlert: {
        width: '100%',
        backgroundColor: '#1E1E1E',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(52, 199, 89, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalAlertTitle: {
        fontSize: 22,
        marginBottom: 12,
        color: '#fff',
    },
    modalAlertText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalPrimaryBtn: {
        width: '100%',
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 50,
        alignItems: 'center',
    },
    modalPrimaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
