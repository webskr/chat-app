import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Modal, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play, X, Download } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { ThemedText } from './ThemedText';
import { Config } from '../constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveMedia } from '../utils/mediaSaver';

interface VideoMessageBubbleProps {
    videoUrl: string | null;
    thumbnailUrl?: string | null;
    duration?: number;
    fileSize?: number;
    isMe: boolean;
    onLongPress?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ThumbnailVideoContent = ({ url }: { url: string }) => {
    const player = useVideoPlayer(url, (player) => {
        player.muted = true;
        player.loop = true;
        player.play();
    });

    return (
        <VideoView
            player={player}
            style={styles.thumbnail}
            contentFit="cover"
            nativeControls={false}
        />
    );
};

const FullscreenVideoContent = ({ url }: { url: string }) => {
    const player = useVideoPlayer(url, (player) => {
        player.loop = false;
        player.staysActiveInBackground = false;
        player.play();
    });

    return (
        <VideoView
            player={player}
            style={styles.fullscreenVideo}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
        />
    );
};

export const VideoMessageBubble: React.FC<VideoMessageBubbleProps> = ({ videoUrl, thumbnailUrl, duration, fileSize, isMe, onLongPress }) => {
    const [modalVisible, setModalVisible] = useState(false);

    // Construct full URLs
    const fullVideoUrl = videoUrl ? (videoUrl.startsWith('http') ? videoUrl : `${Config.API_URL}/${videoUrl.replace(/^\//, '')}`) : null;
    const fullThumbnailUrl = thumbnailUrl
        ? (thumbnailUrl.startsWith('http') ? thumbnailUrl : `${Config.API_URL}/${thumbnailUrl.replace(/^\//, '')}`)
        : null;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    return (
        <>
            <TouchableOpacity
                style={styles.container}
                onPress={() => setModalVisible(true)}
                onLongPress={onLongPress}
                delayLongPress={300}
                activeOpacity={0.9}
            >
                <View style={styles.thumbnailContainer}>
                    {fullThumbnailUrl ? (
                        <Image source={{ uri: fullThumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholder]}>
                            {fullVideoUrl && (
                                <ThumbnailVideoContent url={fullVideoUrl} />
                            )}
                        </View>
                    )}

                    <View style={styles.overlay}>
                        <View style={styles.playButton}>
                            <Play size={24} color="white" fill="white" />
                        </View>
                    </View>

                    <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>
                            {duration ? formatTime(duration) : 'Video'} • {formatSize(fileSize)}
                        </ThemedText>
                    </View>

                </View>
            </TouchableOpacity>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    {modalVisible && fullVideoUrl ? (
                        <FullscreenVideoContent url={fullVideoUrl} />
                    ) : !fullVideoUrl ? (
                        <View style={styles.modalContainer}>
                            <ThemedText style={{ color: '#fff' }}>Download video to watch</ThemedText>
                        </View>
                    ) : null}

                    <View style={styles.headerButtons}>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => videoUrl && saveMedia(videoUrl, 'video')}
                        >
                            <Download size={26} color="white" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => setModalVisible(false)}
                        >
                            <X size={28} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 240,
        height: 160,
        borderRadius: 12, // match bubble radius
        overflow: 'hidden',
        backgroundColor: '#000',
        marginBottom: 2,
    },
    thumbnailContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        backgroundColor: '#1a1a1a',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    playButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    footer: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        flexDirection: 'row',
    },
    badge: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenVideo: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    headerButtons: {
        position: 'absolute',
        top: 50,
        right: 20,
        flexDirection: 'row',
        gap: 15,
        alignItems: 'center',
    },
    headerButton: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 20,
    },
    bubbleDownloadButton: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 6,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
});
