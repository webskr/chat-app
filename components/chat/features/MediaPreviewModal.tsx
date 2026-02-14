import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Image, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import { X, Send, Timer, FileText, CheckCircle2 } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../../components/ThemedText';

interface MediaItem {
    type: 'image' | 'video' | 'document';
    uri: string;
    name?: string;
    mimeType?: string;
    size?: number;
    duration?: number;
}

interface MediaPreviewModalProps {
    visible: boolean;
    onClose: () => void;
    onSend: (caption: string, isOneTime: boolean) => void;
    media: MediaItem[] | null;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({ visible, onClose, onSend, media }) => {
    const [caption, setCaption] = useState('');
    const [isOneTime, setIsOneTime] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const width = Dimensions.get('window').width;

    useEffect(() => {
        if (visible) {
            setCaption('');
            setIsOneTime(false);
            setIsSending(false);
            setCurrentIndex(0);
        }
    }, [visible]);

    if (!media || media.length === 0) return null;

    const handleSend = () => {
        setIsSending(true);
        onSend(caption, isOneTime);
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={[styles.mediaPage, { width }]}>
            {item.type === 'image' && (
                <Image source={{ uri: item.uri }} style={styles.imagePreview} resizeMode="contain" />
            )}
            {item.type === 'video' && (
                <Video
                    source={{ uri: item.uri }}
                    style={styles.videoPreview}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    isLooping
                />
            )}
            {item.type === 'document' && (
                <View style={styles.documentPreview}>
                    <FileText size={64} color={Colors.textSecondary} />
                    <ThemedText style={styles.fileName}>{item.name || 'Document'}</ThemedText>
                    <ThemedText style={styles.fileSize}>
                        {item.size ? `${(item.size / 1024 / 1024).toFixed(2)} MB` : ''}
                    </ThemedText>
                </View>
            )}
        </View>
    );

    const handleScroll = (event: any) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        const roundIndex = Math.round(index);
        setCurrentIndex(roundIndex);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <ThemedText style={styles.headerTitle}>
                            {isOneTime ? 'One-Time View' : 'Send Media'}
                        </ThemedText>
                        {media.length > 1 && (
                            <ThemedText style={styles.counterText}>
                                {currentIndex + 1} / {media.length}
                            </ThemedText>
                        )}
                    </View>
                    {isOneTime && <Timer size={20} color={Colors.primary} />}
                </View>

                <View style={styles.mediaContainer}>
                    <FlatList
                        data={media}
                        renderItem={renderItem}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        keyExtractor={(_, index) => index.toString()}
                    />
                </View>

                <View style={styles.footer}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.captionInput}
                            placeholder={currentIndex === 0 ? "Add a caption..." : "Caption applied to first item"}
                            placeholderTextColor="#8E8E93"
                            value={caption}
                            onChangeText={setCaption}
                            multiline
                            maxLength={500}
                            editable={currentIndex === 0}
                        />
                    </View>

                    <View style={styles.controlsRow}>
                        <TouchableOpacity
                            style={[styles.oneTimeButton, isOneTime && styles.oneTimeActive]}
                            onPress={() => setIsOneTime(!isOneTime)}
                        >
                            <View style={styles.oneTimeIconWrapper}>
                                <ThemedText style={[styles.oneTimeText, isOneTime && styles.oneTimeTextActive]}>1</ThemedText>
                                {isOneTime && (
                                    <View style={styles.dashedCircle} />
                                )}
                            </View>
                            <ThemedText style={styles.oneTimeLabel}>
                                {isOneTime ? 'View Once' : 'Standard'}
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.sendButton, isSending && styles.sendingButton]}
                            onPress={handleSend}
                            disabled={isSending}
                        >
                            {isSending ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Send size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'android' ? 10 : 0,
        zIndex: 10,
    },
    closeButton: {
        padding: 8,
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    counterText: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 2,
    },
    mediaContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1c1c1e',
    },
    mediaPage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 0,
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    videoPreview: {
        width: '100%',
        height: '100%',
    },
    documentPreview: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#2c2c2e',
        borderRadius: 12,
        width: '80%',
        aspectRatio: 1,
    },
    fileName: {
        color: '#fff',
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    fileSize: {
        color: '#8E8E93',
        marginTop: 8,
        fontSize: 14,
    },
    footer: {
        padding: 16,
        backgroundColor: 'rgba(28, 28, 30, 0.9)',
        borderTopWidth: 1,
        borderTopColor: '#3a3a3c',
    },
    inputContainer: {
        backgroundColor: '#2c2c2e',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 16,
        minHeight: 40,
        maxHeight: 100,
    },
    captionInput: {
        color: '#fff',
        fontSize: 16,
        maxHeight: 80,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    oneTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2c2c2e',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    oneTimeActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        borderWidth: 1,
        borderColor: '#0A84FF',
    },
    oneTimeIconWrapper: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#8E8E93',
        alignItems: 'center',
        justifyContent: 'center',
    },
    oneTimeText: {
        color: '#8E8E93',
        fontSize: 10,
        fontWeight: 'bold',
    },
    oneTimeTextActive: {
        color: '#0A84FF',
    },
    dashedCircle: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderWidth: 1,
        borderColor: '#0A84FF',
        borderRadius: 12,
        borderStyle: 'dashed',
    },
    oneTimeLabel: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendingButton: {
        opacity: 0.7,
    },
});
