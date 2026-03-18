import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { SearchInput } from '../components/SearchInput';
import { ThemedText } from '../components/ThemedText';
import { Colors } from '../constants/Colors';
import { Avatar } from '../components/Avatar';
import { LocalDatabaseService } from '../utils/LocalDatabaseService';
import { formatChatTime } from '../utils/time';
import { useUser } from '../context/UserContext';
import { HighlightedText } from '../components/HighlightedText';
import { router } from 'expo-router';
import { ArrowLeft, BadgeCheck } from 'lucide-react-native';
import { Config } from '../constants/Config';
import { getAvatarById } from '../constants/Avatars';
import { GroupDefaultIcon } from '../components/icons/GroupDefaultIcon';

const LIMIT = 30;

export default function SearchScreen() {
    const { user } = useUser();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    const performSearch = useCallback(async (searchQuery: string, pageNum: number, append: boolean) => {
        if (!searchQuery.trim()) {
            setResults([]);
            setHasMore(false);
            setLoading(false);
            return;
        }

        try {
            const offset = pageNum * LIMIT;
            const newResults = await LocalDatabaseService.searchGlobalMessages(searchQuery, LIMIT, offset);

            if (append) {
                setResults(prev => [...prev, ...newResults]);
            } else {
                setResults(newResults);
            }

            setHasMore(newResults.length === LIMIT);
        } catch (error) {
            console.error('[Search] Error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (!query.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        searchTimeout.current = setTimeout(() => {
            setPage(0);
            performSearch(query, 0, false);
        }, 300);

        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [query, performSearch]);

    const loadMore = () => {
        if (!loading && hasMore && query.trim()) {
            const nextPage = page + 1;
            setPage(nextPage);
            setLoading(true);
            performSearch(query, nextPage, true);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isGroup = item.is_group == 1;
        const chatName = isGroup ? item.group_name : (String(item.sender_id) === String(user?.id) ? 'Note to self' : item.other_username);
        const displayAvatar = isGroup ? item.group_icon : item.other_avatar_url;

        return (
            <TouchableOpacity
                style={styles.resultItem}
                activeOpacity={0.7}
                onPress={() => router.push({
                    pathname: '/chat/[id]',
                    params: {
                        id: item.chat_id,
                        highlightMessageId: item.id.toString(),
                        is_group: item.is_group.toString(),
                        user: chatName,
                        avatar_url: displayAvatar
                    }
                })}
            >
                <View style={styles.row}>
                    <Avatar
                        source={displayAvatar ? `${Config.API_URL}/${displayAvatar}` : (isGroup ? undefined : getAvatarById(item.other_avatar_id))}
                        size={48}
                        fallbackComponent={isGroup ? <GroupDefaultIcon size={48} /> : undefined}
                    />
                    <View style={styles.content}>
                        <View style={styles.topRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                                <ThemedText type="defaultSemiBold" style={styles.name} numberOfLines={1}>
                                    {chatName}
                                </ThemedText>
                                {(
                                    item.other_is_official == 1 || 
                                    item.other_is_official === '1' ||
                                    chatName === 'Vegram Official' ||
                                    chatName === 'VegarmOfficial' ||
                                    item.other_username === 'VegarmOfficial'
                                ) && (
                                    <BadgeCheck size={16} color={Colors.officialBadgeBorder} fill={Colors.officialBadge} />
                                )}
                            </View>
                            <ThemedText style={styles.time}>{formatChatTime(item.timestamp)}</ThemedText>
                        </View>
                        <HighlightedText
                            text={item.encrypted_payload}
                            highlight={query}
                            style={styles.preview}
                            numberOfLines={2}
                        />
                    </View>
                </View>
                <View style={styles.divider} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.searchWrapper}>
                    <SearchInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search messages..."
                        style={styles.searchInput}
                    />
                </View>
            </View>

            <FlashList
                data={results}
                renderItem={renderItem}
                estimatedItemSize={85}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loading && page > 0 ? <ActivityIndicator style={styles.loader} color={Colors.primary} /> : null}
                ListEmptyComponent={
                    !loading && query.trim() !== '' ? (
                        <View style={styles.emptyContainer}>
                            <ThemedText style={styles.emptyText}>No messages found for "{query}"</ThemedText>
                        </View>
                    ) : (
                        !loading && query.trim() === '' ? (
                            <View style={styles.emptyContainer}>
                                <ThemedText style={styles.emptyText}>Type to search across all your messages</ThemedText>
                            </View>
                        ) : (loading && page === 0 ? <ActivityIndicator style={{ marginTop: 50 }} color={Colors.primary} /> : null)
                    )
                }
                contentContainerStyle={styles.listContent}
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
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    backButton: {
        padding: 8,
        marginRight: 4,
        marginBottom: 16,
    },
    searchWrapper: {
        flex: 1,
    },
    searchInput: {
        marginBottom: 16,
    },
    resultItem: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 14,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    name: {
        fontSize: 16,
        color: Colors.text,
        flex: 1,
        marginRight: 8,
    },
    time: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    preview: {
        fontSize: 14,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#454545',
        opacity: 0.3,
        marginTop: 12,
        marginLeft: 62,
    },
    loader: {
        paddingVertical: 20,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: 16,
    },
    listContent: {
        paddingBottom: 40,
    }
});
