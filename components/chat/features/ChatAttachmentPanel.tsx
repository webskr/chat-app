import React from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions, TouchableWithoutFeedback, Platform, Text } from 'react-native';
import { Image, Camera, MapPin, User, FileText, Music, BarChart2, IndianRupee, Map, Sparkles, X } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../../components/ThemedText';
import { GlassCard } from '../../../components/GlassCard';
import { BlurView } from 'expo-blur';

interface AttachmentOption {
    id: string;
    label: string;
    icon: any;
    color: string;
    onPress: () => void;
}

interface ChatAttachmentPanelProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (type: string) => void;
}

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 4;
const SPACING = 20; // Consistent spacing
const ITEM_WIDTH = (width - 48 - (SPACING * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

export const ChatAttachmentPanel: React.FC<ChatAttachmentPanelProps> = ({ visible, onClose, onSelect }) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(300)).current;
    const [isExited, setIsExited] = React.useState(!visible);

    React.useEffect(() => {
        if (visible) {
            setIsExited(false);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 300,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                if (finished) {
                    setIsExited(true);
                }
            });
        }
    }, [visible]);

    if (!visible && isExited) return null;

    const options: AttachmentOption[] = [
        { id: 'gallery', label: 'Gallery', icon: Image, color: '#FF2E93', onPress: () => onSelect('gallery') },
        { id: 'camera', label: 'Camera', icon: Camera, color: '#00F0FF', onPress: () => onSelect('camera') },
        { id: 'document', label: 'File', icon: FileText, color: '#7B61FF', onPress: () => onSelect('document') },
        { id: 'audio', label: 'Audio', icon: Music, color: '#FF9500', onPress: () => onSelect('audio') },
        { id: 'location', label: 'Location', icon: MapPin, color: '#00C7BE', onPress: () => onSelect('location') },
        { id: 'contact', label: 'Contact', icon: User, color: '#30D158', onPress: () => onSelect('contact') },
        { id: 'poll', label: 'Poll', icon: BarChart2, color: '#FFCC00', onPress: () => onSelect('poll') },
        { id: 'ai', label: 'AI Gen', icon: Sparkles, color: '#007AFF', onPress: () => onSelect('ai') },
    ];

    return (
        <TouchableWithoutFeedback onPress={onClose}>
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <TouchableWithoutFeedback>
                    <Animated.View style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}>

                        {/* Handle Bar */}
                        <View style={styles.handleContainer}>
                            <View style={styles.handle} />
                        </View>

                        <View style={styles.header}>
                            <ThemedText type="defaultSemiBold" style={styles.headerTitle}>Share Content</ThemedText>
                        </View>

                        <View style={styles.grid}>
                            {options.map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={styles.optionWrapper}
                                    onPress={() => {
                                        onClose();
                                        setTimeout(option.onPress, 200);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.itemContainer}>
                                        <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
                                            <option.icon size={28} color={option.color} strokeWidth={2} />
                                        </View>
                                        <ThemedText style={styles.label}>{option.label}</ThemedText>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                </TouchableWithoutFeedback>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    panel: {
        backgroundColor: '#151515',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    handleContainer: {
        alignItems: 'center',
        marginBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    header: {
        marginBottom: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.9,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    optionWrapper: {
        width: ITEM_WIDTH,
        marginBottom: SPACING,
    },
    itemContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
        color: '#E0E0E0',
        textAlign: 'center',
    },
});
