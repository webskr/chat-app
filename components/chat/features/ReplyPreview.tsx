import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image as RNImage } from 'react-native';
import { MessageSquare, Image as ImageIcon, Mic, Video, Sparkles, Paperclip, X } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../../components/ThemedText';
import { Config } from '../../../constants/Config';

export const ReplyPreview = ({ replyingToMessage, currentUser, onCancel }: any) => {
    if (!replyingToMessage) return null;

    const isMe = String(replyingToMessage.sender_id) === String(currentUser?.id);
    const name = isMe ? 'You' : (replyingToMessage.sender_name || 'User');

    let previewText = replyingToMessage.message_text;
    let Icon: any = MessageSquare;

    if (replyingToMessage.message_type === 'image') {
        previewText = 'Photo';
        Icon = ImageIcon;
    } else if (replyingToMessage.message_type === 'voice') {
        previewText = 'Voice message';
        Icon = Mic;
    } else if (replyingToMessage.message_type === 'video') {
        previewText = 'Video';
        Icon = Video;
    } else if (replyingToMessage.message_type === 'gif') {
        previewText = 'GIF';
        Icon = Sparkles;
    } else if (replyingToMessage.message_type === 'sticker') {
        previewText = 'Sticker';
        Icon = Sparkles;
    } else if (replyingToMessage.message_type === 'document') {
        previewText = 'Document';
        Icon = Paperclip;
    }

    return (
        <View style={styles.replyPreviewContainer}>
            <View style={styles.replyPreviewContent}>
                <View style={styles.replyIndicator} />
                <View style={styles.replyTextContainer}>
                    <ThemedText style={styles.replyName}>{name}</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {replyingToMessage.message_type !== 'text' && (
                            <Icon size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                        )}
                        <ThemedText numberOfLines={1} style={styles.replyTextSnippet}>
                            {previewText || 'Message'}
                        </ThemedText>
                    </View>
                </View>
                {replyingToMessage.media_url && (
                    <RNImage
                        source={{ uri: replyingToMessage.media_url.startsWith('http') ? replyingToMessage.media_url : `${Config.API_URL}/${replyingToMessage.media_url.replace(/^\//, '')}` }}
                        style={styles.replyPreviewImage}
                    />
                )}
                <TouchableOpacity onPress={onCancel} style={styles.replyCloseButton}>
                    <X size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    replyPreviewContainer: {
        paddingHorizontal: 8,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: 'transparent',
    },
    replyPreviewContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        overflow: 'hidden',
        paddingRight: 10,
    },
    replyIndicator: {
        width: 4,
        height: '100%',
        backgroundColor: Colors.primary,
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
    },
    replyTextContainer: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    replyName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 2,
    },
    replyTextSnippet: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    replyPreviewImage: {
        width: 40,
        height: 40,
        borderRadius: 4,
        marginRight: 8,
    },
    replyCloseButton: {
        padding: 4,
    },
});
