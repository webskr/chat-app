import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image as RNImage, Platform, Vibration, Pressable } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { MessageSquare, Check, CheckCheck, Timer, ShieldAlert, Trash2, Download } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../../components/ThemedText';
import { Avatar } from '../../../components/Avatar';
import { GlassCard } from '../../../components/GlassCard';
import { getAvatarById } from '../../../constants/Avatars';
import { Config } from '../../../constants/Config';
import { formatChatTime } from '../../../utils/time';
import { VoiceMessageBubble } from '../../../components/VoiceMessageBubble';
import { VideoMessageBubble } from '../../../components/VideoMessageBubble';
import { DocumentMessageBubble } from '../../../components/DocumentMessageBubble';
import { saveMedia } from '../../../utils/mediaSaver';
import { LinkPreview } from '../../../components/LinkPreview';
import { extractFirstUrl, URL_REGEX } from '../../../utils/links';
import * as Linking from 'expo-linking';

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
    scrollToMessage,

    // Selection Props
    isSelected,
    selectionMode,
    onSelect,
    selectedCount,
    groupMembers
}: any) => {
    const swipeableRef = useRef<any>(null);

    const isSticker = item.message_type === 'sticker' || (item.media_url && (item.media_url.includes('flaticon') || item.media_url.includes('sticker')));
    const isGif = item.message_type === 'gif' || (item.media_url && (item.media_url.includes('tenor') || item.media_url.includes('giphy') || item.media_url.includes('.gif')));
    const isVideo = item.message_type === 'video' || (item.media_url && /\.(mp4|mov|mkv|webm)$/i.test(item.media_url));
    const isDocument = item.message_type === 'document' || (item.media_url && !isSticker && !isGif && !isVideo && !/\.(jpg|jpeg|png|webp|m4a|mp3|wav|aac)$/i.test(item.media_url));
    const isImage = (item.media_url && (item.message_type === 'image' || (!item.message_type && /\.(jpg|jpeg|png|webp)$/i.test(item.media_url)))) && !isSticker && !isGif;
    const isOneTime = Number(item.is_one_time) === 1 || item.is_one_time === true || item.is_one_time === 'true';

    const renderLeftActions = () => {
        return (
            <View style={styles.swipeActionContainer}>
                <MessageSquare size={24} color={Colors.primary} />
            </View>
        );
    };

    const handleSwipeWillOpen = () => {
        if (selectionMode) return; // Disable swipe actions during selection
        if (Platform.OS !== 'web') Vibration.vibrate(10);
        onSwipe(item);
        // Snap back immediately
        setTimeout(() => {
            swipeableRef.current?.close();
        }, 0);
    };

    const handlePress = () => {
        if (selectionMode) {
            onSelect(item.id);
        }
    };

    const handleLongPress = () => {
        if (selectionMode) {
            onSelect(item.id);
        } else {
            onSelect(item.id); // Triggers selection mode start
        }
    };

    const handleImagePress = () => {
        if (selectionMode) {
            onSelect(item.id);
        } else {
            onImagePress(item.media_url?.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url?.replace(/^\//, '')}`);
        }
    };

    return (
        <ReanimatedSwipeable
            ref={swipeableRef}
            renderLeftActions={renderLeftActions}
            onSwipeableOpen={handleSwipeWillOpen}
            friction={2}
            leftThreshold={70}
            activeOffsetX={[10, 1000]}
            failOffsetY={[-20, 20]}
            enabled={!selectionMode}
            overshootLeft={false}
            containerStyle={{ backgroundColor: Colors.background }}
            childrenContainerStyle={{ backgroundColor: Colors.background }}
        >
            <View style={[
                styles.messageRow,
                isMe ? styles.myRow : styles.friendRow,
                isSelected && styles.selectedRow,
                isSelected && { justifyContent: isMe ? 'flex-end' : 'flex-start' }
            ]}>

                {/* Visual Selection Overlay/Highlight - Applied to Row */}
                {isSelected && (
                    <View style={styles.selectionOverlay} />
                )}

                {!isMe && !isSelfChat && (
                    <View style={styles.avatarPlaceholder}>
                        {isLastInGroup && (
                            <Avatar source={getAvatarById(item.sender_avatar_id || '1')} size={32} style={styles.messageAvatar} />
                        )}
                    </View>
                )}
                <View style={[styles.bubbleWrapper, isMe ? styles.myBubbleWrapper : styles.friendBubbleWrapper]}>
                    {!isMe && isGroupChat && !isSelfChat && (
                        <ThemedText style={{
                            fontSize: 12,
                            color: (() => {
                                const sender = groupMembers?.find((m: any) => String(m.id) === String(item.sender_id) || String(m.user_id) === String(item.sender_id));
                                if (sender?.role === 'owner') return '#FF3B30'; // Red
                                if (sender?.role === 'admin') return '#FF9500'; // Orange
                                return Colors.text; // Default (remove green)
                            })(),
                            marginLeft: 12,
                            marginBottom: 2,
                            fontWeight: 'bold'
                        }}>
                            {item.sender_name || 'Unknown'}
                        </ThemedText>
                    )}
                    <Pressable
                        onLongPress={handleLongPress}
                        onPress={handlePress}
                        {...({
                            onContextMenu: (e: any) => {
                                if (Platform.OS === 'web') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }
                        } as any)}
                        delayLongPress={300}
                        android_ripple={null}
                        style={({ pressed }) => [
                            !isSticker && styles.bubble,
                            !isSticker && (isMe ? styles.myBubble : styles.friendBubble),
                            !isSticker && !isLastInGroup && (isMe ? styles.myBubbleGroup : styles.friendBubbleGroup),
                            isImage ? styles.imageBubble : null,
                            isVideo ? styles.videoBubble : null,
                            isGif ? styles.gifBubble : null,
                            isDocument ? styles.documentBubble : null,
                            isOneTime ? styles.otvBubble : null,
                            isSticker ? { backgroundColor: 'transparent', borderWidth: 0, padding: 0, shadowOpacity: 0, elevation: 0, borderRadius: 0 } : null,
                            { opacity: pressed ? 0.9 : 1 }
                        ]}
                    >
                        {item.is_forwarded ? (
                            <View style={styles.forwardedIndicator}>
                                <MessageSquare size={10} color={isMe ? '#fff' : Colors.textSecondary} opacity={0.6} style={{ transform: [{ scaleX: -1 }] }} />
                                <ThemedText style={[styles.forwardedText, isMe && styles.myForwardedText]}>Forwarded</ThemedText>
                            </View>
                        ) : null}

                        {item.reply_to_message_id ? (
                            <TouchableOpacity
                                onPress={() => !selectionMode && onQuotePress(item.reply_to_message_id)}
                                style={[styles.replyQuoteContainer, isMe && styles.myReplyQuoteContainer]}
                            >
                                <View style={styles.replyQuoteTextContainer}>
                                    <ThemedText style={[styles.replyQuoteName, isMe && styles.myReplyQuoteName]}>
                                        {String(item.reply_sender_id) === String(currentUser?.id) ? 'You' : (item.reply_username || 'User')}
                                    </ThemedText>
                                    <ThemedText numberOfLines={1} style={[styles.replyQuoteText, isMe && styles.myReplyQuoteText]}>
                                        {item.reply_text || (
                                            item.reply_type === 'image' ? 'Photo' :
                                                item.reply_type === 'video' ? 'Video' :
                                                    item.reply_type === 'voice' ? 'Voice message' :
                                                        item.reply_type === 'gif' ? 'GIF' :
                                                            item.reply_type === 'sticker' ? 'Sticker' :
                                                                item.reply_type === 'document' ? 'Document' : 'Message'
                                        )}
                                    </ThemedText>
                                </View>
                                {item.reply_media_url && (
                                    <RNImage
                                        source={{ uri: item.reply_media_url.startsWith('http') ? item.reply_media_url : `${Config.API_URL}/${item.reply_media_url.replace(/^\//, '')}` }}
                                        style={styles.replyQuoteImage}
                                    />
                                )}
                            </TouchableOpacity>
                        ) : null}

                        {!item.is_deleted ? (
                            isOneTime && (item.media_url || item.message_text === '🔒 One-Time Message' || item.status === 'seen') ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity
                                        style={styles.otvContent}
                                        onPress={() => onImagePress(item.media_url ? (item.media_url.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url.replace(/^\//, '')}`) : 'TEXT_OTV', true, item.id)}
                                        disabled={isMe || item.status === 'seen'}
                                    >
                                        <View style={[styles.otvIconWrapper, { borderColor: isMe ? '#fff' : Colors.text }]}>
                                            <ThemedText style={[styles.otvIconText, { color: isMe ? '#fff' : Colors.text }]}>1</ThemedText>
                                        </View>
                                        <ThemedText style={[styles.otvText, { color: isMe ? '#fff' : Colors.text }]}>
                                            {item.status === 'seen' ?
                                                (item.media_url ? 'Opened' : 'Message was deleted') :
                                                (item.message_type === 'image' ? 'Photo' :
                                                    item.message_type === 'video' ? 'Video' : 'Text Message')}
                                        </ThemedText>
                                    </TouchableOpacity>
                                </View>
                            ) :
                                isSticker ? (
                                    <Pressable onLongPress={handleLongPress} onPress={handlePress} android_ripple={null}>
                                        <RNImage
                                            source={{ uri: item.media_url.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url.replace(/^\//, '')}` }}
                                            style={{ width: 160, height: 160 }}
                                            resizeMode="contain"
                                        />
                                    </Pressable>
                                ) : isImage ? (
                                    <Pressable
                                        onPress={handleImagePress}
                                        onLongPress={handleLongPress}
                                        delayLongPress={300}
                                        android_ripple={null}
                                    >
                                        <RNImage
                                            source={{ uri: item.media_url?.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url?.replace(/^\//, '')}` }}
                                            style={[styles.messageImage, { width: 220, height: 280 }]}
                                            resizeMode="cover"
                                        />
                                        {!selectionMode && (
                                            <TouchableOpacity
                                                style={styles.mediaDownloadButton}
                                                onPress={() => saveMedia(item.media_url, 'image')}
                                            >
                                                <Download size={18} color="white" />
                                            </TouchableOpacity>
                                        )}
                                    </Pressable>
                                ) : (item.message_type === 'voice' || (item.media_url && /\.(m4a|mp3|wav|aac)$/i.test(item.media_url))) ? (
                                    <Pressable onPress={handlePress} onLongPress={handleLongPress} android_ripple={null}>
                                        <VoiceMessageBubble
                                            audioUrl={item.media_url}
                                            duration={item.duration || 0}
                                            isMe={isMe}
                                            onLongPress={handleLongPress} // Pass selection handler
                                        />
                                    </Pressable>
                                ) : isVideo ? (
                                    <Pressable onPress={handlePress} onLongPress={handleLongPress} android_ripple={null}>
                                        <VideoMessageBubble
                                            videoUrl={item.media_url}
                                            thumbnailUrl={item.thumbnail_url}
                                            duration={item.duration}
                                            fileSize={item.file_size}
                                            isMe={isMe}
                                            onLongPress={handleLongPress}
                                        />
                                    </Pressable>
                                ) : isDocument ? (
                                    <Pressable onPress={handlePress} onLongPress={handleLongPress} android_ripple={null}>
                                        <DocumentMessageBubble
                                            fileUrl={item.media_url}
                                            fileName={item.file_name}
                                            fileSize={item.file_size}
                                            mimeType={item.mime_type}
                                            isMe={isMe}
                                            onLongPress={handleLongPress}
                                        />
                                    </Pressable>
                                ) : isGif ? (
                                    <Pressable
                                        onPress={handleImagePress}
                                        onLongPress={handleLongPress}
                                        delayLongPress={300}
                                        android_ripple={null}
                                    >
                                        <RNImage
                                            source={{ uri: item.media_url?.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url?.replace(/^\//, '')}` }}
                                            style={{
                                                width: 220,
                                                height: 280,
                                                borderRadius: 12,
                                                backgroundColor: '#f0f0f0'
                                            }}
                                            resizeMode="cover"
                                        />
                                        <View style={{ position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, borderRadius: 4 }}>
                                            <ThemedText style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>GIF</ThemedText>
                                        </View>
                                        {!selectionMode && (
                                            <TouchableOpacity
                                                style={styles.mediaDownloadButton}
                                                onPress={() => saveMedia(item.media_url, 'image')}
                                            >
                                                <Download size={18} color="white" />
                                            </TouchableOpacity>
                                        )}
                                    </Pressable>
                                ) : null
                        ) : null}

                        {(item.message_text && (!isOneTime || item.message_text !== '🔒 One-Time Message')) ? (
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

                                        // Mention Parsing
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
                                {!item.is_deleted && extractFirstUrl(item.message_text) && (
                                    <LinkPreview url={extractFirstUrl(item.message_text)!} isMe={isMe} />
                                )}
                            </View>
                        ) : null}
                    </Pressable>

                    {isLastInGroup && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 2 }}>
                            <ThemedText numberOfLines={1} style={[styles.messageTime, isMe ? styles.myMessageTime : styles.friendMessageTime, { marginRight: isMe ? 4 : 0 }]}>
                                {(item.message_type === 'voice' || (item.media_url && /\.(m4a|mp3|wav|aac)$/i.test(item.media_url))) && item.duration ? (
                                    <ThemedText style={{ fontSize: 10, marginRight: 6 }}>
                                        {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')} · {formatChatTime(item.sent_at || item.created_at)}
                                    </ThemedText>
                                ) : (
                                    formatChatTime(item.sent_at || item.created_at)
                                )}
                                {item.is_edited && <ThemedText style={{ fontSize: 9, marginLeft: 4, fontStyle: 'italic', color: Colors.textSecondary }}>edited</ThemedText>}
                            </ThemedText>
                            {isMe && (
                                <View style={{ marginLeft: 2 }}>
                                    {item.status === 'seen' ? (
                                        <CheckCheck size={16} color={Colors.primary || '#474747ff'} />
                                    ) : item.status === 'delivered' ? (
                                        <CheckCheck size={16} color={Colors.textSecondary || '#8E8E93'} />
                                    ) : item.status === 'sending' ? (
                                        <Timer size={14} color={Colors.textSecondary} />
                                    ) : item.status === 'failed' ? (
                                        <TouchableOpacity onPress={() => onSend(item.message_text, item.media_url, true)}>
                                            <ShieldAlert size={16} color={Colors.accent} />
                                        </TouchableOpacity>
                                    ) : (
                                        <Check size={16} color={Colors.textSecondary || '#8E8E93'} />
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    {item.reactions && item.reactions.length > 0 && (
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

                    {/* ONLY SHOW PICKER IF SELECTED AND COUNT IS 1 */}
                    {isSelected && selectedCount === 1 && (
                        <GlassCard style={styles.emojiPicker}>
                            <View style={styles.emojiRow}>
                                {EMOJIS.map(emoji => (
                                    <TouchableOpacity
                                        key={emoji}
                                        onPress={() => onReaction(item.id, emoji)}
                                        style={styles.emojiButton}
                                    >
                                        <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                                {isMe && !item.is_deleted && (
                                    <TouchableOpacity
                                        style={[styles.emojiButton, { marginLeft: 8, borderLeftWidth: 1, borderLeftColor: Colors.glassBorder, paddingLeft: 12 }]}
                                        onPress={() => onDelete(item.id)}
                                    >
                                        <Trash2 size={20} color={Colors.error || '#FF3B30'} />
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
        paddingHorizontal: 16, // Moved from FlatList container
        paddingVertical: 1, // Add vertical padding instead of margin to include in background
        overflow: 'hidden', // Mask overflow as requested
        borderWidth: 1, // Ensure borderWidth is defined
        borderColor: 'transparent', // Default transparent
    },
    selectedRow: {
        backgroundColor: 'rgba(0, 128, 0, 0.2)', // Green highlight
        width: 'auto', // Allow growing
        alignSelf: 'stretch', // Force full width
        borderWidth: 1, // Ensure consistency
        borderColor: 'transparent', // Or 'rgba(0,128,0,0.5)' if explicit highlight needed
    },
    selectionOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
    },
    myRow: {
        alignSelf: 'flex-end',
    },
    friendRow: {
        alignSelf: 'flex-start',
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
    },
    messageAvatar: {
        // Avatar is shown via avatarPlaceholder
    },
    bubbleWrapper: {
        maxWidth: '85%',
        position: 'relative',
    },
    myBubbleWrapper: {
        alignItems: 'flex-end',
    },
    friendBubbleWrapper: {
        alignItems: 'flex-start',
    },
    bubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    imageBubble: {
        padding: 0,
        paddingHorizontal: 4,
        paddingVertical: 4,
        paddingBottom: 1,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 8,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
    },
    videoBubble: {
        padding: 0,
        paddingHorizontal: 4,
        paddingVertical: 4,
        paddingBottom: 1,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 8,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
    },
    gifBubble: {
        padding: 0,
        paddingHorizontal: 4,
        paddingVertical: 4,
        paddingBottom: 3,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 8,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
    },
    documentBubble: {
        padding: 0,
        paddingHorizontal: 4,
        paddingVertical: 4,
        paddingBottom: 1,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 8,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
    },
    myBubble: {
        backgroundColor: Colors.primary,
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
    },
    myBubbleGroup: {
        // Intermediate bubbles in a group
    },
    friendBubble: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
    },
    friendBubbleGroup: {
        // Intermediate bubbles
    },
    reactionTray: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: -8,
        paddingHorizontal: 4,
        zIndex: 10,
    },
    myReactionTray: {
        justifyContent: 'flex-end',
    },
    friendReactionTray: {
        justifyContent: 'flex-start',
    },
    reactionBadge: {
        backgroundColor: Colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        marginHorizontal: 2,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    reactionEmoji: {
        fontSize: 12,
    },
    reactionCount: {
        fontSize: 10,
        color: Colors.text,
        marginLeft: 2,
    },
    emojiPicker: {
        position: 'absolute',
        top: -60,
        right: 0,
        zIndex: 1000,
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    emojiRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    emojiButton: {
        padding: 4,
    },
    emojiText: {
        fontSize: 22,
    },
    messageText: {
        color: Colors.white,
        fontSize: 15,
        lineHeight: 20,
    },
    textWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    linkText: {
        color: '#3498db',
        textDecorationLine: 'underline',
    },
    whiteLinkText: {
        color: '#fff',
        textDecorationLine: 'underline',
        fontWeight: '500',
    },
    messageTime: {
        fontSize: 10,
        color: Colors.textSecondary,
        marginTop: 4,
        marginBottom: 8, // Gap after timestamp
    },
    myMessageTime: {
        alignSelf: 'flex-end',
        marginRight: 4,
    },
    friendMessageTime: {
        alignSelf: 'flex-start',
        marginLeft: 4,
    },
    messageImage: {
        borderRadius: 12,
        marginBottom: 4,
    },
    swipeActionContainer: {
        width: 60,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    otvBubble: {
        paddingVertical: 10,
        minWidth: 100,
        paddingHorizontal: 8, // Added padding for better feel
    },
    otvContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    otvIconWrapper: {
        width: 20, // Smaller icon size
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        // Incomplete circle logic is complex in pure CSS/View, keeping full circle for now or could use SVG if needed. 
        // Keeping it simple as requested: "1" in a ring.
        borderStyle: 'dashed', // close approximation to "incomplete" look if supported, else solid
    },
    otvIconText: {
        fontSize: 9,
        fontWeight: 'bold',
    },
    otvText: {
        fontSize: 15, // Matching message text size
        fontWeight: '400',
    },
    replyQuoteContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 8,
        marginBottom: 6,
        overflow: 'hidden',
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        maxHeight: 52,
        alignItems: 'stretch',
        minWidth: 150,
    },
    myReplyQuoteContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    replyQuoteTextContainer: {
        flex: 1,
        paddingVertical: 4,
        paddingHorizontal: 8,
        justifyContent: 'center',
    },
    replyQuoteName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 0,
    },
    myReplyQuoteName: {
        color: '#fff',
        opacity: 0.9,
    },
    replyQuoteText: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    myReplyQuoteText: {
        color: '#fff',
        opacity: 0.8,
    },
    replyQuoteImage: {
        width: 52,
        height: 52,
    },
    forwardedIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
        opacity: 0.7,
    },
    forwardedText: {
        fontSize: 11,
        fontStyle: 'italic',
        color: Colors.textSecondary,
    },
    myForwardedText: {
        color: '#fff',
    },
    mediaDownloadButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 6,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
});
