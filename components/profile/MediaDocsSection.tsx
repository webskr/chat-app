import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { 
    View, 
    StyleSheet, 
    TouchableOpacity, 
    Image, 
    ActivityIndicator,
    Alert 
} from 'react-native';
import { 
    ChevronRight, 
    FileText, 
    Image as ImageIcon, 
    Film,
    HardDrive,
    Link as LinkIcon
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Colors } from '../../constants/Colors';
import { Config } from '../../constants/Config';
import { ThemedText } from '../ThemedText';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';
import { FullScreenImageModal } from '../FullScreenImageModal';
import { MediaStorageService } from '../../storage/MediaStorageService';

interface MediaDocsSectionProps {
    user: any;
    currentUser: any;
}

export const MediaDocsSection: React.FC<MediaDocsSectionProps> = ({ user, currentUser }) => {
    const router = useRouter();
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [totalSize, setTotalSize] = useState<number>(0);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    const isGroup = !!(user?.is_group || user?.group_id || user?.role); // Duck typing for group profile
    const chatId = isGroup 
        ? String(user?.id)
        : `chat_${Math.min(Number(currentUser?.id), Number(user?.id))}_${Math.max(Number(currentUser?.id), Number(user?.id))}`;

    useEffect(() => {
        const loadMedia = async () => {
            if (!user?.id || !currentUser?.id) return;
            try {
                // Fetch more items to get an accurate storage total
                const results = await LocalDatabaseService.getChatMedia(chatId, 500);
                setCount(results.length);
                setMediaItems(results.slice(0, 4));

                let size = 0;
                // Process in series to avoid concurrency issues on Android FS
                for (const item of results) {
                    if (item.type === 'link') continue;
                    
                    const path = item.local_file_path || item.media_url;
                    if (!path) continue;

                    const messageId = item.server_id || item.id;
                    const remoteUrl = ensureUri(path);
                    
                    // Try robust lookup via MediaStorageService
                    let localUri = await MediaStorageService.getLocalUri([item.server_id, item.temp_id, item.id], remoteUrl, item.type);
                    
                    // Fallback to direct local path if it was already absolute/file://
                    if (!localUri && path.startsWith('file://')) {
                        localUri = path;
                    }

                    if (localUri) {
                        try {
                            const info = await FileSystem.getInfoAsync(ensureUri(localUri));
                            if (info.exists) {
                                size += (info as any).size || 0;
                            }
                        } catch (e) {
                            // Silently fail for individual files
                        }
                    }
                }
                setTotalSize(size);
            } catch (error) {
                console.error('[MediaDocsSection] Error loading media:', error);
            } finally {
                setLoading(false);
            }
        };

        loadMedia();
    }, [user?.id, currentUser?.id]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const ensureUri = (path: string | undefined | null) => {
        if (!path) return '';
        if (path.startsWith('file://') || path.startsWith('http')) return path;
        
        // Android absolute path
        if (path.startsWith('/')) return `file://${path}`;
        
        // Relative server path
        return `${Config.API_URL}/${path.replace(/^\//, '')}`;
    };

    const renderThumbnail = (item: any) => {
        let isVideo = item.type === 'video';
        let isImage = item.type === 'image';
        const isDoc = item.type === 'document';
        const isLink = item.type === 'link' || (item.type === 'text' && item.encrypted_payload && item.encrypted_payload.includes('http'));
        
        let mediaUrl = item.local_file_path || item.media_url;
        let e2eMedia = null;

        // Handle E2EE media payloads
        if (item.encrypted_payload && item.encrypted_payload.startsWith('{') && item.encrypted_payload.includes('"media"')) {
            try {
                const parsed = JSON.parse(item.encrypted_payload);
                if (parsed.media) {
                    e2eMedia = parsed.media;
                    if (e2eMedia.mimeType?.includes('video')) isVideo = true;
                    else isImage = true;
                    
                    // Priority for E2EE display: local path > remote URL from JSON
                    if (!mediaUrl) mediaUrl = e2eMedia.url;
                }
            } catch (e) { }
        }

        // Priority for display: local path > remote media_url
        const displayUri = ensureUri(mediaUrl);

        return (
            <TouchableOpacity 
                key={item.id} 
                style={styles.thumbnailContainer}
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
                    <View style={[styles.thumbnail, styles.docPlaceholder]}>
                        <LinkIcon size={24} color={Colors.primary} />
                    </View>
                ) : (
                    <View style={[styles.thumbnail, styles.docPlaceholder]}>
                        <FileText size={24} color={Colors.textSecondary} />
                    </View>
                )}
                {isVideo && (
                    <View style={styles.videoBadge}>
                        <Film size={12} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    if (count === 0) return null;

    const handleOpenFullView = () => {
        router.push(`/chat/media/${chatId}` as any);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.header} onPress={handleOpenFullView} activeOpacity={0.7}>
                <View style={styles.headerTitleRow}>
                    <ThemedText type="defaultSemiBold" style={styles.title}>Media, links, and docs</ThemedText>
                </View>
                <View style={styles.headerCountRow}>
                    <ThemedText style={styles.countText}>{count}</ThemedText>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </View>
            </TouchableOpacity>

            <View style={styles.grid}>
                {mediaItems.map(renderThumbnail)}
                {count > 4 && (
                    <TouchableOpacity 
                        style={[styles.thumbnailContainer, styles.moreOverlay]}
                        onPress={handleOpenFullView}
                        activeOpacity={0.8}
                    >
                        <ThemedText style={styles.moreText}>+{count - 4}</ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            <TouchableOpacity style={styles.storageRow} activeOpacity={0.7}>
                <View style={styles.storageIconContainer}>
                    <HardDrive size={20} color={Colors.textSecondary} />
                </View>
                <View style={styles.storageTextContainer}>
                    <ThemedText style={styles.storageLabel}>Manage Storage</ThemedText>
                    <ThemedText style={styles.storageSize}>{formatSize(totalSize)}</ThemedText>
                </View>
            </TouchableOpacity>

            <FullScreenImageModal
                visible={!!fullScreenImage}
                imageUri={fullScreenImage || ''}
                onClose={() => setFullScreenImage(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitleRow: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
    },
    headerCountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    countText: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    grid: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    thumbnailContainer: {
        width: '22.5%', // 4 items per row with gap
        aspectRatio: 1,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    docPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 4,
    },
    moreOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        position: 'absolute',
        right: 0,
    },
    moreText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    storageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 12,
        borderRadius: 16,
        gap: 12,
    },
    storageIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    storageTextContainer: {
        flex: 1,
    },
    storageLabel: {
        fontSize: 15,
        color: '#fff',
        fontWeight: '500',
    },
    storageSize: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    loadingContainer: {
        marginTop: 24,
        padding: 20,
        alignItems: 'center',
    }
});
