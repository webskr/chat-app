import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image as RNImage, Platform, Vibration, Pressable, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useAnimatedGestureHandler,
    useSharedValue,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolation,
    withTiming,
    withDelay,
    useDerivedValue,
    interpolateColor
} from 'react-native-reanimated';
import { MessageSquare, Check, CheckCheck, Timer, ShieldAlert, Trash2, Forward, RefreshCcw, AlertCircle, BadgeCheck } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../../components/ThemedText';
import { Avatar } from '../../../components/Avatar';
import { GlassCard } from '../../../components/GlassCard';
import { getAvatarById } from '../../../constants/Avatars';
import { Config } from '../../../constants/Config';
import { formatChatTime } from '../../../utils/time';
import { ChatMediaContent } from './ChatMediaContent';
import { LinkPreview } from '../../../components/LinkPreview';
import { extractFirstUrl, URL_REGEX } from '../../../utils/links';
import * as Linking from 'expo-linking';
import { useMediaCache } from '../../../hooks/useMediaCache';
import { useLocalMedia } from '../../../hooks/useLocalMedia';

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export const MessageItem = React.memo(({
    item,
    index,
    isMe,
    isSelfChat,
    isLastInGroup,
    currentUser,
    id,
    otherUsername,
    isGroupChat,
    showSenderName,
    targetUserProfile,
    onSwipe,
    onLongPress,
    onReaction,
    onDelete,
    onSend,
    onImagePress,
    onQuotePress,
    onForward,
    selectedMessageId,

    // Selection Props
    isSelected,
    selectionMode,
    onSelect,
    selectedCount,
    groupMembers,
    highlighted,
    
    // Reaction Props
    activeReactionMessageId,
    setActiveReactionMessageId
}: any) => {
    const swipeableRef = useRef<any>(null);
    const [reactionModalVisible, setReactionModalVisible] = useState(false);
    const [reactionModalFilter, setReactionModalFilter] = useState<string | null>(null);

    const {
        localUri: cachedMediaUri,
        isDownloaded,
        isLoading: mediaLoading,
        downloadMedia,
        isDownloading
    } = useMediaCache(
        item.server_id || item.id, 
        item.media_url, 
        isMe, 
        item.message_type, 
        currentUser?.id, 
        item.e2e_media,
        item.temp_id,
        item.id
    );

    const resolvedDisplayUri = useLocalMedia(item.id, item.media_url, item.thumbnail_url);

    const isSticker = item.message_type === 'sticker' || (item.media_url && (item.media_url.includes('flaticon') || item.media_url.includes('sticker')));
    const isGif = item.message_type === 'gif' || (item.media_url && (item.media_url.includes('tenor') || item.media_url.includes('giphy') || item.media_url.includes('.gif')));
    const isVideo = item.message_type === 'video' || (item.media_url && /\.(mp4|mov|mkv|webm)$/i.test(item.media_url));
    const isDocument = item.message_type === 'document' || (item.media_url && !isSticker && !isGif && !isVideo && !/\.(jpg|jpeg|png|webp|m4a|mp3|wav|aac)$/i.test(item.media_url));
    const isImage = (item.media_url && (item.message_type === 'image' || (!item.message_type && /\.(jpg|jpeg|png|webp)$/i.test(item.media_url)))) && !isSticker && !isGif;
    const isOneTime = Number(item.is_one_time) === 1 || item.is_one_time === true || item.is_one_time === 'true';

    const hasContent = !!item.message_text ||
        !!item.media_url ||
        item.message_type === 'sticker' ||
        item.message_type === 'voice' ||
        !!item.is_forwarded ||
        !!item.reply_to_message_id ||
        !!item.is_deleted ||
        !!item.deleted_for_everyone;

    const translateX = useSharedValue(0);
    const SWIPE_THRESHOLD = 60;

    const onGestureEvent = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
        onActive: (event) => {
            // Strict horizontal check: only allow right swipe (x > 0) 
            // and reject diagonal (y must be small)
            if (event.translationX > 0 && Math.abs(event.translationY) < 25) {
                // Apply a bit of resistance/clamping
                translateX.value = Math.min(event.translationX * 0.5, SWIPE_THRESHOLD + 20);
            } else {
                translateX.value = 0;
            }
        },
        onEnd: (event) => {
            if (translateX.value >= SWIPE_THRESHOLD) {
                runOnJS(onSwipe)(item);
                if (Platform.OS !== 'web') runOnJS(Vibration.vibrate)(10);
            }
            translateX.value = withSpring(0);
        },
    });

    const animatedContentStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const highlightAnim = useSharedValue(0);
    useEffect(() => {
        if (highlighted) {
            highlightAnim.value = withTiming(1, { duration: 400 }, () => {
                highlightAnim.value = withDelay(1500, withTiming(0, { duration: 1000 }));
            });
        }
    }, [highlighted]);

    const highlightAnimatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            highlightAnim.value,
            [0, 1],
            ['transparent', 'rgba(255, 215, 0, 0.3)']
        )
    }));

    const animatedIconStyle = useAnimatedStyle(() => {
        const opacity = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
        const scale = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0.5, 1], Extrapolation.CLAMP);
        return {
            opacity,
            transform: [{ scale }],
        };
    });

    if (!hasContent) return null;

    const handlePress = () => {
        if (activeReactionMessageId) {
            setActiveReactionMessageId(null);
            return;
        }

        if (selectionMode) {
            onSelect(item.id);
        }
    };

    const handleLongPress = () => {
        if (onLongPress) {
            onLongPress(item);
        }
    };

    const handleImagePress = () => {
        if (activeReactionMessageId) {
            setActiveReactionMessageId(null);
            return;
        }

        if (selectionMode) {
            onSelect(item.id);
        } else if (isDownloaded && cachedMediaUri) {
            onImagePress(cachedMediaUri);
        }
    };

    return (
        <PanGestureHandler
            onGestureEvent={onGestureEvent}
            activeOffsetX={[0, 10]} // Only trigger on right swipe
            failOffsetY={[-20, 20]}  // Fail if there's significant vertical movement
            enabled={!selectionMode && !item.is_deleted && !item.deleted_for_everyone}
        >
            <Animated.View style={[styles.swipeWrapper, (activeReactionMessageId === item.id) && { zIndex: 9999, elevation: 9999 }]}>
                {/* Swipe Action Icon (Visible when swiping) */}
                <Animated.View style={[styles.swipeActionContainer, animatedIconStyle]}>
                    <Forward size={24} color={Colors.primary} />
                </Animated.View>

                <Animated.View style={[animatedContentStyle, highlightAnimatedStyle]}>
                    <View style={[
                        styles.messageRow,
                        isMe ? styles.myRow : styles.friendRow,
                        isSelected && styles.selectedRow,
                    ]}>
                        {isSelected && <View style={styles.selectionOverlay} />}

                        {!isMe && !isSelfChat && (
                            <View style={styles.avatarPlaceholder}>
                                {!!isLastInGroup && (
                                    <Avatar source={getAvatarById(item.sender_avatar_id ?? '1')} size={32} />
                                )}
                            </View>
                        )}

                        <View style={[styles.bubbleWrapper, isMe ? styles.myBubbleWrapper : styles.friendBubbleWrapper, (activeReactionMessageId === item.id) && { zIndex: 9999, elevation: 9999 }]}>
                            {activeReactionMessageId === item.id && (
                                <View style={[
                                    styles.emojiPicker,
                                    isMe ? styles.emojiPickerRight : styles.emojiPickerLeft,
                                    styles.emojiPickerAbsolute
                                ]}>
                                    <View style={styles.emojiRow}>
                                        {EMOJIS.map(emoji => (
                                            <TouchableOpacity 
                                                key={emoji} 
                                                onPress={() => {
                                                    onReaction(item.id, emoji);
                                                    setActiveReactionMessageId(null);
                                                }} 
                                                style={styles.emojiButton}
                                            >
                                                <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                            {!isMe && !!isGroupChat && !isSelfChat && !!showSenderName && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 12, marginBottom: 2 }}>
                                    <ThemedText style={[styles.senderName, {
                                        color: (() => {
                                            const sender = groupMembers?.find((m: any) => String(m.id) === String(item.sender_id) || String(m.user_id) === String(item.sender_id));
                                            if (sender?.role === 'owner') return '#FF3B30';
                                            if (sender?.role === 'admin') return '#2196F3';
                                            return Colors.text;
                                        })()
                                    }]}>
                                        {item.sender_name || 'Unknown'}
                                    </ThemedText>
                                    {(
                                        item.sender_is_official == 1 || 
                                        item.sender_is_official === '1' ||
                                        item.sender_name === 'Vegram Official' ||
                                        item.sender_name === 'VegramOfficial'
                                    ) && (
                                        <BadgeCheck size={14} color={Colors.officialBadgeBorder} fill={Colors.officialBadge} />
                                    )}
                                </View>
                            )}

                            <Pressable
                                onLongPress={handleLongPress}
                                onPress={handlePress}
                                delayLongPress={300}
                                style={({ pressed }) => [
                                    !isSticker && styles.bubble,
                                    !isSticker && (isMe ? styles.myBubble : styles.friendBubble),
                                    isImage ? styles.imageBubble : null,
                                    isVideo ? styles.videoBubble : null,
                                    isDocument ? styles.documentBubble : null,
                                    isOneTime ? styles.otvBubble : null,
                                    isSticker ? styles.stickerBubble : null,
                                    { opacity: pressed ? 0.9 : 1 }
                                ]}
                            >
                                {!!item.is_forwarded && (
                                    <View style={styles.forwardedIndicator}>
                                        <Forward size={10} color={isMe ? '#fff' : Colors.textSecondary} opacity={0.6} />
                                        <ThemedText style={[styles.forwardedText, isMe && styles.myForwardedText]}>Forwarded</ThemedText>
                                    </View>
                                )}

                                {!!item.reply_to_message_id && (
                                    <TouchableOpacity
                                        onPress={() => !selectionMode && onQuotePress(item.reply_to_message_id)}
                                        style={[styles.replyQuoteContainer, isMe && styles.myReplyQuoteContainer]}
                                    >
                                        <View style={styles.replyQuoteTextContainer}>
                                            <ThemedText style={[styles.replyQuoteName, isMe && styles.myReplyQuoteName]}>
                                                {String(item.reply_sender_id) === String(currentUser?.id) ? 'You' : (item.reply_username || 'User')}
                                            </ThemedText>
                                            <ThemedText numberOfLines={1} style={[styles.replyQuoteText, isMe && styles.myReplyQuoteText]}>
                                                {item.reply_text || item.reply_type || 'Message'}
                                            </ThemedText>
                                        </View>
                                        {!!item.reply_media_url && (
                                            <RNImage
                                                source={{ uri: item.reply_media_url.startsWith('http') ? item.reply_media_url : `${Config.API_URL}/${item.reply_media_url.replace(/^\//, '')}` }}
                                                style={styles.replyQuoteImage}
                                            />
                                        )}
                                    </TouchableOpacity>
                                )}

                                {!!item.is_deleted || !!item.deleted_for_everyone ? (
                                    <View style={styles.deletedContainer}>
                                        <ThemedText style={[styles.messageText, styles.deletedText]}>
                                            🚫 This message was deleted
                                        </ThemedText>
                                    </View>
                                ) : (
                                    !!isOneTime ? (
                                        <TouchableOpacity
                                            style={styles.otvContent}
                                            onPress={() => onImagePress(item.media_url ? (item.media_url.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url.replace(/^\//, '')}`) : 'TEXT_OTV', true, item.id)}
                                            disabled={isMe || item.status === 'seen'}
                                        >
                                            {item.status === 'seen' ? (
                                                <ThemedText style={[styles.otvText, styles.viewedText, { color: isMe ? 'rgba(255,255,255,0.7)' : Colors.textSecondary }]}>
                                                    👣 Viewed once
                                                </ThemedText>
                                            ) : (
                                                <>
                                                    <View style={[styles.otvIconWrapper, { borderColor: isMe ? '#fff' : Colors.text }]}>
                                                        <ThemedText style={[styles.otvIconText, { color: isMe ? '#fff' : Colors.text }]}>1</ThemedText>
                                                    </View>
                                                    <View style={{ gap: 2 }}>
                                                        <ThemedText style={[styles.otvText, { color: isMe ? '#fff' : Colors.text }]}>
                                                            {item.message_type === 'image' ? 'Photo' : item.message_type === 'video' ? 'Video' : 'Message'}
                                                        </ThemedText>
                                                        <ThemedText style={[styles.tapToView, { color: isMe ? 'rgba(255,255,255,0.7)' : Colors.textSecondary }]}>
                                                            Tap to view
                                                        </ThemedText>
                                                    </View>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    ) : (isSticker && item.media_url) ? (
                                        <RNImage
                                            source={{ uri: item.media_url.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url.replace(/^\//, '')}` }}
                                            style={styles.stickerImage}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <ChatMediaContent
                                            item={item}
                                            isMe={isMe}
                                            currentUser={currentUser}
                                            selectionMode={selectionMode}
                                            handlePress={handlePress}
                                            handleLongPress={handleLongPress}
                                            handleImagePress={handleImagePress}
                                            cachedMediaUri={cachedMediaUri}
                                            isDownloaded={isDownloaded}
                                            mediaLoading={mediaLoading}
                                            downloadMedia={downloadMedia}
                                            isDownloading={isDownloading}
                                            resolvedDisplayUri={resolvedDisplayUri}
                                        />
                                    )
                                )}

                                {!!item.message_text && !isOneTime && (
                                    <View>
                                        <View style={styles.textWrap}>
                                            {item.message_text.split(URL_REGEX).map((part: string, i: number) => {
                                                if (/^https?:\/\//.test(part)) {
                                                    return (
                                                        <ThemedText
                                                            key={i}
                                                            style={[styles.messageText, styles.linkText, isMe && styles.whiteLinkText]}
                                                            onPress={() => !selectionMode && Linking.openURL(part)}
                                                        >
                                                            {part}
                                                        </ThemedText>
                                                    );
                                                }
                                                const mentionParts = part.split(/(@[a-zA-Z0-9_]+)/g);
                                                return mentionParts.map((subPart, j) => {
                                                    if (subPart.startsWith('@') && groupMembers) {
                                                        const username = subPart.slice(1);
                                                        const isMember = groupMembers.some((m: any) => m.username.toLowerCase() === username.toLowerCase());
                                                        if (isMember) {
                                                            return (
                                                                <ThemedText key={`${i}-${j}`} style={[styles.messageText, { fontWeight: 'bold', color: isMe ? '#fff' : Colors.primary }]}>
                                                                    {subPart}
                                                                </ThemedText>
                                                            );
                                                        }
                                                    }
                                                    return (
                                                        <ThemedText key={`${i}-${j}`} style={[styles.messageText, item.is_deleted && { fontStyle: 'italic', opacity: 0.7 }]}>
                                                            {subPart}
                                                        </ThemedText>
                                                    );
                                                });
                                            })}
                                        </View>
                                        {!(item.is_deleted || item.deleted_for_everyone) && !!extractFirstUrl(item.message_text) && (
                                            <LinkPreview url={extractFirstUrl(item.message_text)!} isMe={isMe} />
                                        )}
                                    </View>
                                )}
                            </Pressable>

                            {!!isLastInGroup && (
                                <View style={styles.timeRow}>
                                    <ThemedText numberOfLines={1} style={[styles.messageTime, isMe ? styles.myMessageTime : styles.friendMessageTime]}>
                                        {(item.message_type === 'voice' || item.message_type === 'audio') && item.duration ? (
                                            `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')} · `
                                        ) : null}
                                        {formatChatTime(item.sent_at || item.created_at)}
                                        {!!item.is_edited && <ThemedText style={styles.editedText}> edited</ThemedText>}
                                    </ThemedText>
                                    {isMe && (
                                        <View style={styles.statusIcon}>
                                            {item.status === 'seen' ? <CheckCheck size={16} color={Colors.read} /> :
                                                item.status === 'delivered' ? <CheckCheck size={16} color={Colors.textSecondary} /> :
                                                    item.status === 'sending' ? <Timer size={14} color={Colors.textSecondary} /> :
                                                        item.status === 'pending' ? <RefreshCcw size={14} color={Colors.textSecondary} /> :
                                                            item.status === 'failed' ? (
                                                                <TouchableOpacity onPress={() => onSend(item)}>
                                                                    <AlertCircle size={16} color={Colors.error} />
                                                                </TouchableOpacity>
                                                            ) :
                                                                <Check size={16} color={Colors.textSecondary} />}
                                        </View>
                                    )}
                                </View>
                            )}

                            {item.reactions?.length > 0 && (
                                <>
                                    <View style={[styles.reactionTray, isMe ? styles.myReactionTray : styles.friendReactionTray]}>
                                        {Array.from(new Set(item.reactions.map((r: any) => r.emoji))).map((emoji: any) => {
                                            const count = item.reactions.filter((r: any) => r.emoji === emoji).length;
                                            const iMineThisEmoji = item.reactions.some(
                                                (r: any) => String(r.userId) === String(currentUser?.id) && r.emoji === emoji
                                            );
                                            return (
                                                <TouchableOpacity
                                                    key={emoji}
                                                    style={[styles.reactionBadge, iMineThisEmoji && styles.reactionBadgeMine]}
                                                    onPress={() => {
                                                        // tap to view list (group) or toggle own reaction (1-1)
                                                        if (isGroupChat) {
                                                            setReactionModalFilter(emoji);
                                                            setReactionModalVisible(true);
                                                        } else {
                                                            // toggle: if it's mine → remove, else set
                                                            onReaction(item.id, emoji);
                                                        }
                                                    }}
                                                    onLongPress={() => {
                                                        setReactionModalFilter(null);
                                                        setReactionModalVisible(true);
                                                    }}
                                                >
                                                    <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                                                    {count > 1 && (
                                                        <ThemedText style={styles.reactionCount}>{count}</ThemedText>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Reaction Detail Modal (Group chats) */}
                                    <Modal
                                        visible={reactionModalVisible}
                                        transparent
                                        animationType="fade"
                                        onRequestClose={() => setReactionModalVisible(false)}
                                    >
                                        <TouchableOpacity
                                            style={styles.reactionModalOverlay}
                                            activeOpacity={1}
                                            onPress={() => setReactionModalVisible(false)}
                                        >
                                            <View style={styles.reactionModalSheet}>
                                                <View style={styles.reactionModalHeader}>
                                                    <ThemedText style={styles.reactionModalTitle}>Reactions</ThemedText>
                                                    {/* Emoji filter pills */}
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                                        <TouchableOpacity
                                                            style={[styles.reactionFilterPill, !reactionModalFilter && styles.reactionFilterPillActive]}
                                                            onPress={() => setReactionModalFilter(null)}
                                                        >
                                                            <ThemedText style={styles.reactionFilterText}>All</ThemedText>
                                                        </TouchableOpacity>
                                                        {Array.from(new Set(item.reactions.map((r: any) => r.emoji))).map((em: any) => (
                                                            <TouchableOpacity
                                                                key={em}
                                                                style={[styles.reactionFilterPill, reactionModalFilter === em && styles.reactionFilterPillActive]}
                                                                onPress={() => setReactionModalFilter(em)}
                                                            >
                                                                <ThemedText style={styles.reactionFilterText}>
                                                                    {em} {item.reactions.filter((r: any) => r.emoji === em).length}
                                                                </ThemedText>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                                <ScrollView style={{ maxHeight: 240 }}>
                                                    {(reactionModalFilter
                                                        ? item.reactions.filter((r: any) => r.emoji === reactionModalFilter)
                                                        : item.reactions
                                                    ).map((r: any, i: number) => (
                                                        <View key={i} style={styles.reactionUserRow}>
                                                            <View style={styles.reactionUserAvatar}>
                                                                <ThemedText style={{ fontSize: 14, fontWeight: 'bold', color: Colors.primary }}>
                                                                    {(r.username || r.userId || '?')[0].toUpperCase()}
                                                                </ThemedText>
                                                            </View>
                                                            <ThemedText style={styles.reactionUsername}>{r.username || r.userId}</ThemedText>
                                                            <ThemedText style={styles.reactionUserEmoji}>{r.emoji}</ThemedText>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        </TouchableOpacity>
                                    </Modal>
                                </>
                            )}


                        </View>
                    </View>
                </Animated.View>
            </Animated.View>
        </PanGestureHandler>
    );
});

const styles = StyleSheet.create({
    messageRow: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'flex-end',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 1,
    },
    selectedRow: {
        backgroundColor: 'rgba(0, 128, 0, 0.2)',
    },
    selectionOverlay: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
    },
    myRow: { justifyContent: 'flex-end' },
    friendRow: { justifyContent: 'flex-start' },
    avatarPlaceholder: { width: 32, height: 32 },
    bubbleWrapper: { maxWidth: '85%', position: 'relative', overflow: 'visible' },
    myBubbleWrapper: { alignItems: 'flex-end' },
    friendBubbleWrapper: { alignItems: 'flex-start' },
    bubble: {
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 18,
    },
    myBubble: {
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 4,
    },
    friendBubble: {
        backgroundColor: Colors.surface,
        borderBottomLeftRadius: 4,
    },
    imageBubble: { padding: 0, paddingTop: 2, paddingBottom: 2, paddingLeft: 2, paddingRight: 2, paddingHorizontal: 2, paddingVertical: 2, backgroundColor: 'green', borderRadius: 12, alignItems: 'center' },
    videoBubble: { padding: 0, paddingTop: 2, paddingBottom: 2, paddingLeft: 2, paddingRight: 2, paddingHorizontal: 2, paddingVertical: 2, backgroundColor: 'green', borderRadius: 12, alignItems: 'center' },
    gifBubble: { padding: 0, paddingTop: 2, paddingBottom: 2, paddingLeft: 2, paddingRight: 2, paddingHorizontal: 2, paddingVertical: 2, backgroundColor: 'green', borderRadius: 12, alignItems: 'center' },
    documentBubble: { padding: 5, backgroundColor: 'green', borderRadius: 12, alignItems: 'center' },
    otvBubble: { paddingHorizontal: 16, paddingVertical: 12 },
    stickerBubble: { backgroundColor: 'transparent', padding: 0 },
    stickerImage: { width: 160, height: 160 },
    senderName: { fontSize: 12, marginLeft: 12, marginBottom: 2, fontWeight: 'bold' },
    forwardedIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    forwardedText: { fontSize: 10, fontStyle: 'italic', color: Colors.textSecondary },
    myForwardedText: { color: 'rgba(255,255,255,0.7)' },
    replyQuoteContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8, overflow: 'hidden', marginBottom: 6, borderLeftWidth: 4, borderLeftColor: Colors.primary },
    myReplyQuoteContainer: { backgroundColor: 'rgba(255,255,255,0.1)', borderLeftColor: '#fff' },
    replyQuoteTextContainer: { flex: 1, padding: 8 },
    replyQuoteName: { fontWeight: 'bold', fontSize: 12, color: Colors.primary },
    myReplyQuoteName: { color: '#fff' },
    replyQuoteText: { fontSize: 12, color: Colors.textSecondary },
    myReplyQuoteText: { color: 'rgba(255,255,255,0.8)' },
    replyQuoteImage: { width: 50, height: 50 },
    otvContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    otvIconWrapper: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    otvIconText: { fontSize: 10, fontWeight: 'bold' },
    otvText: { fontWeight: '600', fontSize: 16 },
    viewedText: { fontStyle: 'italic' },
    tapToView: { fontSize: 12, opacity: 0.8 },
    textWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    messageText: { fontSize: 16, color: Colors.text },
    linkText: { color: Colors.primary, textDecorationLine: 'underline' },
    whiteLinkText: { color: '#fff' },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    messageTime: { fontSize: 10, color: Colors.textSecondary },
    myMessageTime: { color: 'rgba(255,255,255,0.7)' },
    friendMessageTime: { color: Colors.textSecondary },
    editedText: { fontSize: 9, fontStyle: 'italic' },
    statusIcon: { marginLeft: 2 },
    reactionTray: { flexDirection: 'row', flexWrap: 'wrap', marginTop: -8, marginBottom: 4, backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 3, paddingHorizontal: 4, borderWidth: 1, borderColor: Colors.glassBorder, gap: 2 },
    myReactionTray: { alignSelf: 'flex-end' },
    friendReactionTray: { alignSelf: 'flex-start' },
    reactionBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10 },
    reactionBadgeMine: { backgroundColor: 'rgba(0,150,255,0.15)', borderWidth: 1, borderColor: 'rgba(0,150,255,0.3)' },
    reactionEmoji: { fontSize: 14 },
    reactionCount: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
    reactionModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    reactionModalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, paddingHorizontal: 16 },
    reactionModalHeader: { paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder, marginBottom: 8 },
    reactionModalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
    reactionFilterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.background, marginRight: 6 },
    reactionFilterPillActive: { backgroundColor: Colors.primary },
    reactionFilterText: { fontSize: 13, color: Colors.text },
    reactionUserRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
    reactionUserAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.glass, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    reactionUsername: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
    reactionUserEmoji: { fontSize: 20 },
    emojiPicker: { 
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 24, 
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    emojiPickerAbsolute: {
        position: 'absolute',
        bottom: '100%',
        marginBottom: 8,
        zIndex: 10000,
        elevation: 10000,
    },
    emojiPickerRight: { right: 0 },
    emojiPickerLeft: { left: 0 },
    emojiRow: { flexDirection: 'row', alignItems: 'center' },
    emojiButton: { padding: 4, marginHorizontal: 2 },
    emojiText: { fontSize: 20 },
    deleteButton: { marginLeft: 6, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 10, paddingVertical: 2 },
    swipeWrapper: {
        position: 'relative',
        justifyContent: 'center',
        alignSelf: 'stretch',
    },
    swipeActionContainer: {
        position: 'absolute',
        left: 20,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
        zIndex: 0
    },
    deletedContainer: {
        paddingVertical: 4,
    },
    deletedText: {
        fontStyle: 'italic',
        opacity: 0.7,
        fontSize: 14,
    },
});
