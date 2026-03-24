import React, { useState, useEffect } from 'react';
import { MediaStorageService } from '../../../storage/MediaStorageService';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Image,
    FlatList,
    ActivityIndicator,
    Dimensions,
    Alert,
    SafeAreaView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ChevronLeft,
    FileText,
    Film,
    Link as LinkIcon
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { Colors } from '../../../constants/Colors';
import { Config } from '../../../constants/Config';
import { ThemedText } from '../../../components/ThemedText';
import { LocalDatabaseService } from '../../../utils/LocalDatabaseService';
import { FullScreenImageModal } from '../../../components/FullScreenImageModal';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

export default function FullMediaView() {
    const { chatId } = useLocalSearchParams();
    const router = useRouter();
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'media' | 'links' | 'docs'>('media');

    useEffect(() => {
        loadAllMedia();
    }, [chatId]);

    const loadAllMedia = async () => {
        if (!chatId) return;
        setLoading(true);
        try {
            // Fetch a large number of items to show the "full" view
            const results = await LocalDatabaseService.getChatMedia(String(chatId), 500);
            setMediaItems(results);
        } catch (error) {
            console.error('[FullMediaView] Error loading media:', error);
        } finally {
            setLoading(false);
        }
    };

    const ensureUri = (path: string | undefined | null) => {
        if (!path) return '';
        if (path.startsWith('file://') || path.startsWith('http')) return path;
        if (path.startsWith('/')) return `file://${path}`;
        return `${Config.API_URL}/${path.replace(/^\//, '')}`;
    };

    const filteredItems = mediaItems.filter(item => {
        // 1. Link Detection (Robust)
        const hasUrlPattern = item.encrypted_payload && (
            item.encrypted_payload.includes('http') || 
            item.encrypted_payload.includes('www.') ||
            /\.[a-z]{2,6}(\/|$)/i.test(item.encrypted_payload)
        );
        const isLink = item.type === 'link' || (item.type === 'text' && hasUrlPattern);

        // 2. Document Detection
        const isDoc = item.type === 'document' || item.type === 'file';

        // 3. Media Detection
        const isMedia = item.type === 'image' || item.type === 'video';
        
        // E2EE media payloads hidden in type='text'
        let isRealMedia = isMedia;
        if (item.type === 'text' && item.encrypted_payload && item.encrypted_payload.startsWith('{') && item.encrypted_payload.includes('"media"')) {
            isRealMedia = true;
        }

        if (activeTab === 'media') return isRealMedia && !isLink; // Prefer links over media if overlapping
        if (activeTab === 'links') return isLink;
        if (activeTab === 'docs') return isDoc;
        return false;
    });

    const renderItem = ({ item }: { item: any }) => {
        let isVideo = item.type === 'video';
        let isImage = item.type === 'image';
        const isDoc = item.type === 'document';
        const isLink = item.type === 'link' || (item.type === 'text' && item.encrypted_payload && item.encrypted_payload.includes('http'));

        let mediaUrl = item.local_file_path || item.media_url;

        // Handle E2EE media payloads
        if (item.encrypted_payload && item.encrypted_payload.startsWith('{') && item.encrypted_payload.includes('"media"')) {
            try {
                const parsed = JSON.parse(item.encrypted_payload);
                if (parsed.media) {
                    if (parsed.media.mimeType?.includes('video')) isVideo = true;
                    else isImage = true;
                    if (!mediaUrl) mediaUrl = parsed.media.url;
                }
            } catch (e) { }
        }

        // Use a more robust check for local URI that handles ID transitions
        const [displayUri, setDisplayUri] = useState(ensureUri(mediaUrl));

        useEffect(() => {
            const checkLocal = async () => {
                const local = await MediaStorageService.getLocalUri([item.server_id, item.temp_id, item.id], ensureUri(mediaUrl), item.type);
                if (local) setDisplayUri(local);
            };
            checkLocal();
        }, [item.id, mediaUrl]);

        return (
            <TouchableOpacity
                style={styles.gridItem}
                onPress={() => {
                    if (isImage && displayUri) {
                        setFullScreenImage(displayUri);
                    } else if (isLink) {
                        const urlMatch = (item.encrypted_payload || '').match(/https?:\/\/[^\s]+/);
                        if (urlMatch) {
                            Linking.openURL(urlMatch[0]);
                        } else if (item.type === 'link' && item.media_url) {
                            Linking.openURL(ensureUri(item.media_url));
                        }
                    } else if (displayUri) {
                        Alert.alert('Media', `This is a ${item.type}. Full preview coming soon.`);
                    }
                }}
            >
                {isImage || isVideo ? (
                    <Image
                        source={{ uri: displayUri }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                    />
                ) : isLink ? (
                    <View style={[styles.thumbnail, styles.placeholder]}>
                        <LinkIcon size={32} color={Colors.primary} />
                    </View>
                ) : (
                    <View style={[styles.thumbnail, styles.placeholder]}>
                        <FileText size={32} color={Colors.textSecondary} />
                    </View>
                )}
                {isVideo && (
                    <View style={styles.videoBadge}>
                        <Film size={16} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={28} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.title}>Media, links and docs</ThemedText>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.tabBar}>
                {(['media', 'links', 'docs'] as const).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <ThemedText style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : filteredItems.length === 0 ? (
                <View style={styles.centered}>
                    <ThemedText style={{ opacity: 0.5 }}>No {activeTab} yet</ThemedText>
                </View>
            ) : (
                <FlatList
                    data={filteredItems}
                    renderItem={renderItem}
                    keyExtractor={item => String(item.id)}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={styles.listContent}
                />
            )}

            <FullScreenImageModal
                visible={!!fullScreenImage}
                imageUri={fullScreenImage || null}
                onClose={() => setFullScreenImage(null)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 30,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    activeTab: {
        backgroundColor: Colors.primary,
    },
    tabText: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    activeTabText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 1,
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        padding: 1,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 4,
    },
});
