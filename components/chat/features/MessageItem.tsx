import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image as RNImage, Platform, Vibration, Pressable, ActivityIndicator } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { MessageSquare, Check, CheckCheck, Timer, ShieldAlert, Trash2, Forward } from 'lucide-react-native';
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

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '✨', '👋', '🙏', '🎉', '💩', '🍕', '🌸'];

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
    groupMembers
}: any) => {
    const swipeableRef = useRef<any>(null);

    const {
        localUri: cachedMediaUri,
        isDownloaded,
        isLoading: mediaLoading,
        downloadMedia,
        isDownloading
    } = useMediaCache(item.id, item.media_url, isMe, item.message_type, currentUser?.id, item.e2e_media);

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
        !!item.is_deleted;

    if (!hasContent) return null;

    const ForwardAction = ({ progress }: { progress: Animated.SharedValue<number> }) => {
        const animatedStyle = useAnimatedStyle(() => ({
            opacity: progress.value,
            transform: [
                {
                    scale: interpolate(
                        progress.value,
                        [0, 1],
                        [0.5, 1],
                        Extrapolation.CLAMP
                    ),
                },
            ],
        }));

        return (
            <Animated.View style={[styles.swipeActionContainer, animatedStyle]}>
                <Forward size={24} color={Colors.primary} />
            </Animated.View>
        );
    };

    const renderLeftActions = (progress: any) => <ForwardAction progress={progress} />;

    const handleSwipeWillOpen = () => {
        if (selectionMode) return;
        if (Platform.OS !== 'web') Vibration.vibrate(10);
        onSwipe(item);
        setTimeout(() => { swipeableRef.current?.close(); }, 0);
    };

    const handlePress = () => {
        if (selectionMode) {
            onSelect(item.id);
        }
    };

    const handleLongPress = () => {
        onSelect(item.id);
    };

    const handleImagePress = () => {
        if (selectionMode) {
            onSelect(item.id);
        } else if (isDownloaded && cachedMediaUri) {
            onImagePress(cachedMediaUri);
        }
    };

    return (
        <ReanimatedSwipeable
            ref={swipeableRef}
            renderLeftActions={renderLeftActions}
            onSwipeableOpen={handleSwipeWillOpen}
            friction={2}
            leftThreshold={70}
            enabled={!selectionMode}
            overshootLeft={false}
        >
            <View style={[
                styles.messageRow,
                isMe ? styles.myRow : styles.friendRow,
                isSelected && styles.selectedRow,
            ]}>
                {isSelected && <View style={styles.selectionOverlay} />}

                {!isMe && !isSelfChat && (
                    <View style={styles.avatarPlaceholder}>
                        {!!isLastInGroup && (
                            <Avatar source={getAvatarById(item.sender_avatar_id || '1')} size={32} />
                        )}
                    </View>
                )}

                <View style={[styles.bubbleWrapper, isMe ? styles.myBubbleWrapper : styles.friendBubbleWrapper]}>
                    {!isMe && !!isGroupChat && !isSelfChat && (
                        <ThemedText style={[styles.senderName, {
                            color: (() => {
                                const sender = groupMembers?.find((m: any) => String(m.id) === String(item.sender_id) || String(m.user_id) === String(item.sender_id));
                                if (sender?.role === 'owner') return '#FF3B30';
                                if (sender?.role === 'admin') return '#FF9500';
                                return Colors.text;
                            })()
                        }]}>
                            {item.sender_name || 'Unknown'}
                        </ThemedText>
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

                        {!!item.is_deleted ? null : (
                            !!isOneTime && (!!item.media_url || item.message_text === '🔒 One-Time Message' || item.status === 'seen') ? (
                                <TouchableOpacity
                                    style={styles.otvContent}
                                    onPress={() => onImagePress(item.media_url ? (item.media_url.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url.replace(/^\//, '')}`) : 'TEXT_OTV', true, item.id)}
                                    disabled={isMe || item.status === 'seen'}
                                >
                                    <View style={[styles.otvIconWrapper, { borderColor: isMe ? '#fff' : Colors.text }]}>
                                        <ThemedText style={[styles.otvIconText, { color: isMe ? '#fff' : Colors.text }]}>1</ThemedText>
                                    </View>
                                    <ThemedText style={[styles.otvText, { color: isMe ? '#fff' : Colors.text }]}>
                                        {item.status === 'seen' ? 'Opened' : (item.message_type === 'image' ? 'Photo' : item.message_type === 'video' ? 'Video' : 'Message')}
                                    </ThemedText>
                                </TouchableOpacity>
                            ) : isSticker ? (
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

                        {!!item.message_text && (!isOneTime || item.message_text !== '🔒 One-Time Message') && (
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
                                {!item.is_deleted && !!extractFirstUrl(item.message_text) && (
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
                                    {item.status === 'seen' ? <CheckCheck size={16} color={Colors.primary} /> :
                                        item.status === 'delivered' ? <CheckCheck size={16} color={Colors.textSecondary} /> :
                                            item.status === 'sending' ? <Timer size={14} color={Colors.textSecondary} /> :
                                                <Check size={16} color={Colors.textSecondary} />}
                                </View>
                            )}
                        </View>
                    )}

                    {item.reactions?.length > 0 && (
                        <View style={[styles.reactionTray, isMe ? styles.myReactionTray : styles.friendReactionTray]}>
                            {Array.from(new Set(item.reactions.map((r: any) => r.emoji))).map((emoji: any) => (
                                <View key={emoji} style={styles.reactionBadge}>
                                    <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                                    <ThemedText style={styles.reactionCount}>
                                        {item.reactions.filter((r: any) => r.emoji === emoji).length}
                                    </ThemedText>
                                </View>
                            ))}
                        </View>
                    )}

                    {!!isSelected && selectedCount === 1 && (
                        <GlassCard style={styles.emojiPicker}>
                            <View style={styles.emojiRow}>
                                {EMOJIS.map(emoji => (
                                    <TouchableOpacity key={emoji} onPress={() => onReaction(item.id, emoji)} style={styles.emojiButton}>
                                        <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                                {isMe && !item.is_deleted && (
                                    <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)}>
                                        <Trash2 size={20} color={Colors.error} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </GlassCard>
                    )}
                </View>
            </View>
        </ReanimatedSwipeable>
    );
});

const styles = StyleSheet.create({
    messageRow: {
        flexDirection: 'row',
        maxWidth: '100%',
        alignItems: 'flex-end',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 1,
        overflow: 'hidden',
    },
    selectedRow: {
        backgroundColor: 'rgba(0, 128, 0, 0.2)',
        alignSelf: 'stretch',
    },
    selectionOverlay: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
    },
    myRow: { alignSelf: 'flex-end' },
    friendRow: { alignSelf: 'flex-start' },
    avatarPlaceholder: { width: 32, height: 32 },
    bubbleWrapper: { maxWidth: '85%', position: 'relative' },
    myBubbleWrapper: { alignItems: 'flex-end' },
    friendBubbleWrapper: { alignItems: 'flex-start' },
    bubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
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
    imageBubble: { padding: 4 },
    videoBubble: { padding: 0 },
    gifBubble: { padding: 4 },
    documentBubble: { padding: 10 },
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
    otvText: { fontWeight: '600' },
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
    reactionTray: { flexDirection: 'row', marginTop: -10, marginBottom: 4, backgroundColor: Colors.surface, borderRadius: 12, padding: 2, borderWidth: 1, borderColor: Colors.glassBorder },
    myReactionTray: { alignSelf: 'flex-end' },
    friendReactionTray: { alignSelf: 'flex-start' },
    reactionBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 },
    reactionEmoji: { fontSize: 12 },
    reactionCount: { fontSize: 10, color: Colors.textSecondary },
    emojiPicker: { position: 'absolute', top: -50, right: 0, zIndex: 1000, padding: 8, borderRadius: 24 },
    emojiRow: { flexDirection: 'row', alignItems: 'center' },
    emojiButton: { padding: 6 },
    emojiText: { fontSize: 20 },
    deleteButton: { marginLeft: 8, borderLeftWidth: 1, borderLeftColor: Colors.glassBorder, paddingLeft: 12 },
    swipeActionContainer: { width: 70, justifyContent: 'center', alignItems: 'center' },
});
