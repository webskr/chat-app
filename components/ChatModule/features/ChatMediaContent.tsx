import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image as RNImage, ActivityIndicator, Pressable } from 'react-native';
import { Download, ShieldAlert } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../ThemedText';
import { Config } from '../../../constants/Config';
import { useMediaCache } from '../../../hooks/useMediaCache';
import { useLocalMedia } from '../../../hooks/useLocalMedia';
import { VoiceMessageBubble } from '../../VoiceMessageBubble';
import { VideoMessageBubble } from '../../VideoMessageBubble';
import { DocumentMessageBubble } from '../../DocumentMessageBubble';
import { saveMedia } from '../../../utils/mediaSaver';

interface ChatMediaContentProps {
    item: any;
    isMe: boolean;
    currentUser?: any;
    selectionMode?: boolean;
    handlePress: () => void;
    handleLongPress: () => void;
    handleImagePress: () => void;
    // Cache State Props
    cachedMediaUri: string | null;
    isDownloaded: boolean;
    mediaLoading: boolean;
    downloadMedia: () => Promise<void>;
    isDownloading: boolean;
    resolvedDisplayUri?: string;
}

export const ChatMediaContent: React.FC<ChatMediaContentProps> = React.memo(({
    item,
    isMe,
    currentUser,
    selectionMode,
    handlePress,
    handleLongPress,
    handleImagePress,
    cachedMediaUri,
    isDownloaded,
    mediaLoading,
    downloadMedia,
    isDownloading,
    resolvedDisplayUri
}) => {

    const isVideo = item.message_type === 'video' || (item.media_url && /\.(mp4|mov|mkv|webm)$/i.test(item.media_url));
    const isGif = item.message_type === 'gif' || (item.media_url && (item.media_url.includes('tenor') || item.media_url.includes('giphy') || item.media_url.includes('.gif')));
    const isDocument = item.message_type === 'document' || (item.media_url && !isVideo && !isGif && !/\.(jpg|jpeg|png|webp|m4a|mp3|wav|aac)$/i.test(item.media_url));
    const isImage = (item.media_url && (item.message_type === 'image' || (!item.message_type && /\.(jpg|jpeg|png|webp)$/i.test(item.media_url))));

    // ── Expired State ────────────────────────────────────────────────────────
    if (item.is_deleted_from_server && !isDownloaded) {
        return (
            <View style={[styles.mediaPlaceholder, { backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <ShieldAlert size={32} color={isMe ? '#fff' : Colors.primary} opacity={0.5} />
                <ThemedText style={[styles.expiredText, { color: isMe ? '#fff' : Colors.textSecondary }]}>
                    {isVideo ? 'Video' : isDocument ? 'File' : 'Media'} Expired
                </ThemedText>
            </View>
        );
    }

    // ── Image Rendering ──────────────────────────────────────────────────────
    if (isImage) {
        return (
            <Pressable
                onPress={handleImagePress}
                onLongPress={handleLongPress}
                delayLongPress={300}
                android_ripple={null}
            >
                {(!isDownloaded && !isMe) ? (
                    <View>
                        {!!resolvedDisplayUri && (
                            <RNImage
                                source={{ uri: resolvedDisplayUri }}
                                style={[styles.messageImage, { width: 220, height: 280, opacity: 0.6 }]}
                                resizeMode="cover"
                            />
                        )}
                        <View style={styles.downloadOverlay}>
                            {isDownloading ? (
                                <ActivityIndicator color="#fff" size="large" />
                            ) : (
                                <TouchableOpacity style={styles.downloadBtn} onPress={downloadMedia}>
                                    <Download size={22} color="white" />
                                    {item.file_size ? (
                                        <ThemedText style={styles.downloadSizeText}>
                                            {(item.file_size / 1024 / 1024).toFixed(1)} MB
                                        </ThemedText>
                                    ) : null}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ) : (
                    !!(isMe ? resolvedDisplayUri : (cachedMediaUri ?? undefined)) ? (
                        <RNImage
                            source={{ uri: isMe ? (resolvedDisplayUri || undefined) : (cachedMediaUri || undefined) }}
                            style={[styles.messageImage, { width: 220, height: 280 }]}
                            resizeMode="cover"
                        />
                    ) : null
                )}
            </Pressable>
        );
    }

    // ── GIF Rendering ────────────────────────────────────────────────────────
    if (isGif) {
        return (
            <Pressable onPress={handlePress} onLongPress={handleLongPress} android_ripple={null}>
                {!!(resolvedDisplayUri || item.media_url) ? (
                    <RNImage
                        source={{ uri: (resolvedDisplayUri || (item.media_url?.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url?.replace(/^\//, '')}`)) }}
                        style={{ width: 240, height: 240, borderRadius: 12 }}
                        resizeMode="cover"
                    />
                ) : null}
            </Pressable>
        );
    }

    // ── Video Rendering ──────────────────────────────────────────────────────
    if (isVideo) {
        return (
            <Pressable onPress={handlePress} onLongPress={handleLongPress} android_ripple={null}>
                {(!isDownloaded && !isMe) ? (
                    <View>
                        <VideoMessageBubble
                            videoUrl={null}
                            thumbnailUrl={item.thumbnail_url}
                            duration={item.duration}
                            fileSize={item.file_size}
                            isMe={isMe}
                            onLongPress={handleLongPress}
                        />
                        <View style={styles.downloadOverlay}>
                            {isDownloading ? (
                                <ActivityIndicator color="#fff" size="large" />
                            ) : (
                                <TouchableOpacity style={styles.downloadBtn} onPress={downloadMedia}>
                                    <Download size={22} color="white" />
                                    {item.file_size ? (
                                        <ThemedText style={styles.downloadSizeText}>
                                            {(item.file_size / 1024 / 1024).toFixed(1)} MB
                                        </ThemedText>
                                    ) : null}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ) : (
                    <VideoMessageBubble
                        videoUrl={resolvedDisplayUri || (item.media_url?.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url?.replace(/^\//, '')}`)}
                        thumbnailUrl={item.thumbnail_url}
                        duration={item.duration}
                        fileSize={item.file_size}
                        isMe={isMe}
                        onLongPress={handleLongPress}
                    />
                )}
            </Pressable>
        );
    }

    // ── Document Rendering ───────────────────────────────────────────────────
    if (isDocument) {
        return (
            <Pressable onPress={handlePress} onLongPress={handleLongPress} android_ripple={null}>
                <DocumentMessageBubble
                    fileUrl={resolvedDisplayUri || (item.media_url?.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url?.replace(/^\//, '')}`)}
                    fileName={item.file_name}
                    fileSize={item.file_size}
                    mimeType={item.mime_type}
                    isMe={isMe}
                    onLongPress={handleLongPress}
                />
                {!isDownloaded && !isMe && (
                    <View style={[styles.downloadOverlay, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
                        <TouchableOpacity style={[styles.downloadBtn, { paddingVertical: 6 }]} onPress={downloadMedia}>
                            {isDownloading ? <ActivityIndicator color="#fff" /> : <Download size={18} color="white" />}
                        </TouchableOpacity>
                    </View>
                )}
            </Pressable>
        );
    }

    // ── Voice Rendering ──────────────────────────────────────────────────────
    if (item.message_type === 'voice' || (item.media_url && /\.(m4a|mp3|wav|aac)$/i.test(item.media_url))) {
        return (
            <Pressable onPress={handlePress} onLongPress={handleLongPress} android_ripple={null}>
                <VoiceMessageBubble
                    audioUrl={resolvedDisplayUri || (item.media_url?.startsWith('http') ? item.media_url : `${Config.API_URL}/${item.media_url?.replace(/^\//, '')}`)}
                    duration={item.duration || 0}
                    isMe={isMe}
                    onLongPress={handleLongPress}
                />
            </Pressable>
        );
    }

    return null;
});

const styles = StyleSheet.create({
    messageImage: {
        borderRadius: 12,
        backgroundColor: '#f0f0f0',
    },
    mediaPlaceholder: {
        width: 220,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    expiredText: {
        fontSize: 13,
        marginTop: 4,
    },
    downloadOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    downloadBtn: {
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    downloadSizeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    mediaDownloadButton: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 6,
        borderRadius: 15,
    },
});
