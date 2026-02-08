import React, { useState, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, PanResponder, Modal, Alert, Text, Platform } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { X, Check, Undo2, Pencil, Trash2 } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface ImageEditorModalProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
    onSend: (uri: string) => void;
}

export function ImageEditorModal({ visible, imageUri, onClose, onSend }: ImageEditorModalProps) {
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [paths, setPaths] = useState<string[][]>([]);
    const [color, setColor] = useState('#FF0000'); // Default red
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const viewShotRef = useRef<any>(null);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => isDrawingMode,
                onMoveShouldSetPanResponder: () => isDrawingMode,
                onPanResponderGrant: (evt, gestureState) => {
                    const { locationX, locationY } = evt.nativeEvent;
                    setCurrentPath([`M${locationX},${locationY}`]);
                },
                onPanResponderMove: (evt, gestureState) => {
                    const { locationX, locationY } = evt.nativeEvent;
                    setCurrentPath((prev) => [...prev, `L${locationX},${locationY}`]);
                },
                onPanResponderRelease: () => {
                    if (currentPath.length > 0) {
                        setPaths((prev) => [...prev, currentPath]);
                        setCurrentPath([]);
                    }
                },
            }),
        [isDrawingMode, currentPath]
    );

    const handleUndo = () => {
        setPaths((prev) => prev.slice(0, -1));
    };

    const handleClear = () => {
        setPaths([]);
        setCurrentPath([]);
    };

    const handleSend = async () => {
        if (!viewShotRef.current) return;
        try {
            const uri = await viewShotRef.current.capture();
            onSend(uri);
        } catch (error) {
            console.error("Error capturing view:", error);
            Alert.alert("Error", "Failed to process image.");
        }
    };

    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFFFFF', '#000000'];

    if (!imageUri) return null;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <SafeAreaView style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                        <X color="#fff" size={24} />
                    </TouchableOpacity>
                    <View style={styles.rightHeader}>
                        <TouchableOpacity onPress={() => setIsDrawingMode(!isDrawingMode)} style={[styles.iconButton, isDrawingMode && styles.activeButton]}>
                            <Pencil color="#fff" size={24} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleUndo} style={styles.iconButton}>
                            <Undo2 color="#fff" size={24} />
                        </TouchableOpacity>
                        {/* <TouchableOpacity onPress={handleClear} style={styles.iconButton}>
                            <Trash2 color="#fff" size={24} />
                        </TouchableOpacity> */}
                    </View>
                </SafeAreaView>

                <View style={styles.editorContainer}>
                    <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.8 }} style={styles.viewShot}>
                        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
                        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
                            <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                                {paths.map((path, index) => (
                                    <Path
                                        key={index}
                                        d={path.join('')}
                                        stroke={color}
                                        strokeWidth={5}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                ))}
                                {currentPath.length > 0 && (
                                    <Path
                                        d={currentPath.join('')}
                                        stroke={color}
                                        strokeWidth={5}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}
                            </Svg>
                        </View>
                    </ViewShot>
                </View>

                {isDrawingMode && (
                    <View style={styles.colorPalette}>
                        {colors.map((c) => (
                            <TouchableOpacity
                                key={c}
                                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.selectedColor]}
                                onPress={() => setColor(c)}
                            />
                        ))}
                    </View>
                )}

                <SafeAreaView style={styles.footer} edges={['bottom']}>
                    <View style={styles.captionContainer}>
                        {/* Placeholder for future caption input if needed, distinct from chat input */}
                        <Text style={{ color: '#888' }}>Add a caption...</Text>
                    </View>
                    <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                        <View style={styles.sendIconBg}>
                            <Check color="#fff" size={24} />
                        </View>
                    </TouchableOpacity>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    rightHeader: {
        flexDirection: 'row',
        gap: 15,
    },
    iconButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
    },
    activeButton: {
        backgroundColor: Colors.primary || '#007AFF',
    },
    editorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewShot: {
        width: width,
        height: height * 0.8, // Reserve space for header/footer
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    captionContainer: {
        flex: 1,
        height: 40,
        justifyContent: 'center',
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        marginRight: 10,
    },
    sendButton: {

    },
    sendIconBg: {
        backgroundColor: Colors.primary || '#007AFF',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorPalette: {
        position: 'absolute',
        top: 100,
        right: 20,
        gap: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 10,
        borderRadius: 20,
    },
    colorSwatch: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#fff',
    },
    selectedColor: {
        transform: [{ scale: 1.2 }],
        borderColor: Colors.primary || '#007AFF',
    }
});
