import React, { useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { X, Download, Share2 } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Colors } from '../constants/Colors';
import { ThemedText } from './ThemedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveMedia } from '../utils/mediaSaver';

interface FullScreenImageModalProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
}

export function FullScreenImageModal({ visible, imageUri, onClose }: FullScreenImageModalProps) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!imageUri) return;

        setIsDownloading(true);
        try {
            const success = await saveMedia(imageUri, 'image');
            if (success && Platform.OS === 'android') {
                const { ToastAndroid } = require('react-native');
                ToastAndroid.show('Image saved to gallery', ToastAndroid.SHORT);
            }
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('Error', 'An error occurred while saving the image.');
        } finally {
            setIsDownloading(false);
        }
    };

    if (!imageUri) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                            <X color="#fff" size={24} />
                        </TouchableOpacity>

                        <View style={styles.rightIcons}>
                            {isDownloading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <TouchableOpacity onPress={handleDownload} style={styles.iconButton}>
                                    <Download color="#fff" size={24} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </SafeAreaView>

                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.image}
                        resizeMode="contain"
                    />
                </View>
            </View>
        </Modal>
    );
}

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
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    rightIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    iconButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});
