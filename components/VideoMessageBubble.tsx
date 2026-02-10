import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Modal, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Play, X, Maximize2 } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { ThemedText } from './ThemedText';
import { Config } from '../constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';

/* 
  RECOMMENDED: install expo-av if not already
  npx expo install expo-av
*/

interface VideoMessageBubbleProps {
    videoUrl: string;
    thumbnailUrl?: string | null;
    duration?: number;
    fileSize?: number;
    isMe: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const VideoMessageBubble: React.FC<VideoMessageBubbleProps> = ({ videoUrl, thumbnailUrl, duration, fileSize, isMe }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [status, setStatus] = useState<any>({});

    // Construct full URLs
    const fullVideoUrl = videoUrl.startsWith('http') ? videoUrl : `${Config.API_URL}/${videoUrl.replace(/^\//, '')}`;
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
                activeOpacity={0.9}
            >
                <View style={styles.thumbnailContainer}>
                    {fullThumbnailUrl ? (
                        <Image source={{ uri: fullThumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholder]}>
                            <Video
                                style={styles.thumbnail}
                                source={{ uri: fullVideoUrl }}
                                useNativeControls={false}
                                resizeMode={ResizeMode.COVER}
                                shouldPlay={false}
                                isMuted={true}
                            />
                        </View>
                    )}

                    <View style={styles.overlay}>
                        <View style={styles.playButton}>
                            <Play size={24} color="white" fill="white" />
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.badge}>
                            <ThemedText style={styles.badgeText}>
                                {duration ? formatTime(duration) : 'Video'} • {formatSize(fileSize)}
                            </ThemedText>
                        </View>
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
                    <Video
                        style={styles.fullscreenVideo}
                        source={{ uri: fullVideoUrl }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                        shouldPlay={true}
                        onPlaybackStatusUpdate={status => setStatus(() => status)}
                    />

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setModalVisible(false)}
                    >
                        <X size={28} color="white" />
                    </TouchableOpacity>
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
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 20,
    }
});
