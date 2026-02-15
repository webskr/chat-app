import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Image, Platform, Dimensions, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface OneTimeViewerModalProps {
    visible: boolean;
    url: string | null;
    text?: string | null;
    type: 'image' | 'video' | 'text';
    onClose: () => void;
}

export const OneTimeViewerModal = ({ visible, url, text, type, onClose }: OneTimeViewerModalProps) => {
    if (!visible) return null; // Check visible first, url might be null for text

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X color="#fff" size={28} />
                    </TouchableOpacity>
                </SafeAreaView>

                <View style={styles.content}>
                    {type === 'video' ? (
                        <Video
                            source={{ uri: url! }}
                            style={styles.media}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay={true} // Auto-play
                            useNativeControls={true} // Allow controls (pause/seek) but maybe we should disable seeking? Standard OTV usually allows linear playback.
                            isLooping={false} // Don't loop
                            onPlaybackStatusUpdate={(status: any) => {
                                if (status.didJustFinish) {
                                    // Optional: Close on finish? 
                                    // For now, let user close manually to avoid abrupt experience.
                                }
                            }}
                        />
                    ) : type === 'text' ? (
                        <View style={styles.textContainer}>
                            <Text style={styles.textContent}>{text}</Text>
                        </View>
                    ) : (
                        <Image
                            source={{ uri: url! }}
                            style={styles.media}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    safeArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: 16,
    },
    closeButton: {
        alignSelf: 'flex-start',
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        width: '100%',
    },
    textContent: {
        color: '#fff',
        fontSize: 24,
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 34,
    },
});
