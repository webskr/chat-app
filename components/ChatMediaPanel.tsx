import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Image, TextInput, ActivityIndicator, Dimensions, Text, SectionList, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';
import { Smile, Search, StickyNote, Heart, Clock, Gift, Delete, X, ChevronLeft, Hash, Flag, Lightbulb, Coffee, Car, Activity, Cat, Dog, Leaf, Zap, Globe, Trophy, PenLine, Flame } from 'lucide-react-native';
import { EMOJI_CATEGORIES, STICKER_PACKS } from '../constants/EmojiList';
import { TextmojiService } from '../utils/TextmojiService';
import { Textmoji, TEXTMOJI_CATEGORIES } from '../constants/TextmojiList';

const TENOR_API_KEY = 'LIVDSRZULELA'; // Public Demo Key
const CLIENT_KEY = 'ChatApp';

const CATEGORY_ICONS: Record<string, any> = {
    recent: Clock,
    smileys: Smile,
    gestures: Heart,
    animals: Leaf,
    food: Coffee,
    activity: Trophy,
    travel: Car,
    objects: Lightbulb,
    symbols: Hash,
    flags: Flag
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#121212',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#1E1E1E',
    },
    searchButton: {
        padding: 8,
    },
    headerSearchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2C',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 44,
        marginHorizontal: 8,
    },
    headerSearchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        marginLeft: 8,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#2C2C2C',
        borderRadius: 20,
        padding: 4,
        height: 44,
        alignItems: 'center',
    },
    topTabItem: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 18,
        height: '100%',
        justifyContent: 'center',
    },
    activeTopTab: {
        backgroundColor: '#404040',
    },
    tabText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    activeTabText: {
        color: '#fff',
    },
    backspaceButton: {
        padding: 8,
    },
    contentContainer: {
        flex: 1,
        backgroundColor: '#121212',
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#121212',
    },
    sectionHeaderText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        opacity: 0.8,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    emojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 8,
    },
    emojiItem: {
        width: (Dimensions.get('window').width - 16) / 9,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiText: {
        fontSize: 24,
    },
    bottomBar: {
        height: 50,
        backgroundColor: '#1E1E1E',
        borderTopWidth: 1,
        borderTopColor: '#2C2C2C',
    },
    bottomBarContent: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    categoryItem: {
        padding: 12,
        marginHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeCategoryItem: {},
    stickerCategory: {
        marginBottom: 15,
        paddingHorizontal: 10,
    },
    categoryTitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 8,
        marginTop: 8,
        fontWeight: 'bold',
    },
    stickerItem: {
        marginRight: 15,
    },
    stickerImage: {
        width: 80,
        height: 80,
    },
    gifContainer: {
        flex: 1,
        margin: 4,
        aspectRatio: 1.3,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#2C2C2C',
    },
    gifImage: {
        width: '100%',
        height: '100%',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textmojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    textmojiItem: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#2C2C2C',
        margin: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    textmojiText: {
        fontSize: 14,
        color: '#fff',
        textAlign: 'center',
    },
});

const EmojiItem = React.memo(({ emoji, onSelect }: { emoji: string, onSelect: (type: string, content: string) => void }) => (
    <TouchableOpacity onPress={() => onSelect('emoji', emoji)} style={styles.emojiItem}>
        <Text style={styles.emojiText}>{emoji}</Text>
    </TouchableOpacity>
));

const TextmojiItem = React.memo(({ tm, onSelect, onLongPress }: { tm: Textmoji, onSelect: (tm: Textmoji) => void, onLongPress: (text: string) => void }) => (
    <TouchableOpacity 
        onPress={() => onSelect(tm)} 
        onLongPress={() => onLongPress(tm.text)}
        style={styles.textmojiItem}
    >
        <ThemedText style={styles.textmojiText}>{tm.text}</ThemedText>
    </TouchableOpacity>
));

const GifItem = React.memo(({ item, onSelect }: { item: any, onSelect: (type: string, content: string) => void }) => {
    const previewUrl = item.images?.fixed_height_small?.url || item.images?.preview_gif?.url || item.images?.fixed_height?.url;
    const gifUrl = item.images?.original?.url || item.images?.fixed_height?.url;
    return (
        <TouchableOpacity onPress={() => onSelect('gif', gifUrl)} style={styles.gifContainer}>
            <Image
                source={{ uri: previewUrl }}
                style={styles.gifImage}
                resizeMode="cover"
            />
        </TouchableOpacity>
    );
});

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    if (!arr) return chunks;
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

const EmojiTab = React.memo(({ onSelect, searchQuery }: { onSelect: any, searchQuery: string }) => {
    const sectionListRef = useRef<SectionList>(null);
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);

    const sections = useMemo(() => EMOJI_CATEGORIES.map(cat => ({
        title: cat.name,
        data: chunkArray(cat.emojis, 9),
        id: cat.id
    })), []);

    const renderSectionHeader = useCallback(({ section: { title } }: any) => (
        <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionHeaderText}>{title}</ThemedText>
        </View>
    ), []);

    const renderItem = useCallback(({ item }: any) => (
        <View style={styles.emojiGrid}>
            {item.map((emoji: string, index: number) => (
                <EmojiItem key={index} emoji={emoji} onSelect={onSelect} />
            ))}
        </View>
    ), [onSelect]);

    const scrollToSection = useCallback((index: number) => {
        setActiveSectionIndex(index);
        sectionListRef.current?.scrollToLocation({
            sectionIndex: index,
            itemIndex: 0,
            animated: true,
            viewOffset: 0
        });
    }, []);

    const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const output = viewableItems[0];
            if (output.section) {
                const index = EMOJI_CATEGORIES.findIndex(s => s.name === output.section.title);
                if (index !== -1) setActiveSectionIndex(index);
            }
        }
    }).current;

    return (
        <View style={{ flex: 1 }}>
            <SectionList
                ref={sectionListRef}
                sections={sections}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onViewableItemsChanged={handleViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                removeClippedSubviews={Platform.OS === 'android'}
                maxToRenderPerBatch={10}
                windowSize={5}
            />
            <View style={styles.bottomBar}>
                <FlatList
                    data={EMOJI_CATEGORIES}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item, index }) => {
                        const Icon = CATEGORY_ICONS[item.id] || Smile;
                        const isActive = index === activeSectionIndex;
                        return (
                            <TouchableOpacity
                                onPress={() => scrollToSection(index)}
                                style={[styles.categoryItem, isActive && styles.activeCategoryItem]}
                            >
                                <Icon
                                    size={20}
                                    color={isActive ? Colors.primary : Colors.textSecondary}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                            </TouchableOpacity>
                        );
                    }}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.bottomBarContent}
                />
            </View>
        </View>
    );
});

const GIPHY_API_KEY = 'BsjkMBD80tAvvv4YXOP3ja5vEsuCUzPM';

const GifTab = React.memo(({ onSelect, searchQuery }: { onSelect: any, searchQuery: string }) => {
    const [gifs, setGifs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [offset, setOffset] = useState(0);

    const fetchGifs = useCallback(async (searchTerm = '', currentOffset = 0) => {
        if (loading && currentOffset !== 0) return;
        setLoading(true);
        try {
            const endpoint = searchTerm ? 'search' : 'trending';
            const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=20&offset=${currentOffset}&rating=g`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.data) {
                if (currentOffset === 0) {
                    setGifs(data.data);
                } else {
                    setGifs(prev => [...prev, ...data.data]);
                }
                if (data.pagination) {
                    setOffset(currentOffset + 20);
                }
            }
        } catch (error) {
            console.error('Error fetching GIFs:', error);
        } finally {
            setLoading(false);
        }
    }, [loading]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchGifs(searchQuery, 0);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const renderItem = useCallback(({ item }: { item: any }) => (
        <GifItem item={item} onSelect={onSelect} />
    ), [onSelect]);

    return (
        <View style={{ flex: 1 }}>
            <FlatList
                data={gifs}
                renderItem={renderItem}
                keyExtractor={(item, index) => item.id + index}
                numColumns={2}
                onEndReached={() => {
                    if (!loading) fetchGifs(searchQuery, offset);
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loading ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} /> : <View style={{ height: 20 }} />}
                contentContainerStyle={{ paddingBottom: 10, paddingTop: 10 }}
            />
        </View>
    );
});

const TextmojiTab = React.memo(({ onSelect, searchQuery }: { onSelect: any, searchQuery: string }) => {
    const [allTextmojis, setAllTextmojis] = useState<Textmoji[]>([]);
    const [recents, setRecents] = useState<Textmoji[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [all, recentList] = await Promise.all([
            TextmojiService.getTextmojis(),
            TextmojiService.getRecents()
        ]);
        setAllTextmojis(all);
        setRecents(recentList);
        setLoading(false);
    };

    const handleSelect = useCallback(async (tm: Textmoji) => {
        onSelect('textmoji', tm.text);
        await TextmojiService.recordUsage(tm.id);
        const updatedRecents = await TextmojiService.getRecents();
        setRecents(updatedRecents);
    }, [onSelect]);

    const handleLongPress = useCallback((text: string) => {
        onSelect('textmoji', text);
    }, [onSelect]);

    const sections = useMemo(() => {
        const trending = [...allTextmojis]
            .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
            .slice(0, 10);

        const allFiltered = allTextmojis
            .filter(tm => 
                tm.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tm.id.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => a.id.localeCompare(b.id));

        const result = [];
        // Flattening into chunks of 3 for better virtualization of the textmojis (which vary in width)
        if (recents.length > 0) result.push({ title: 'Recent', data: chunkArray(recents, 3), icon: Clock });
        result.push({ title: 'Trending', data: chunkArray(trending, 3), icon: Flame });
        if (allFiltered.length > 0) {
            result.push({ 
                title: 'All Textmojis', 
                data: chunkArray(allFiltered, 3),
                icon: Smile
            });
        }
        return result;
    }, [allTextmojis, recents, searchQuery]);

    const renderItem = useCallback(({ item }: { item: Textmoji[] }) => (
        <View style={styles.textmojiGrid}>
            {item.map((tm: Textmoji) => (
                <TextmojiItem 
                    key={tm.id}
                    tm={tm}
                    onSelect={handleSelect} 
                    onLongPress={handleLongPress}
                />
            ))}
        </View>
    ), [handleSelect, handleLongPress]);

    const renderSectionHeader = useCallback(({ section: { title, icon: Icon } }: any) => (
        <View style={[styles.sectionHeader, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            {Icon && <Icon size={14} color={Colors.textSecondary} />}
            <ThemedText style={styles.sectionHeaderText}>{title}</ThemedText>
        </View>
    ), []);

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <SectionList
            sections={sections}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={10}
            windowSize={5}
        />
    );
});

const StickerTab = React.memo(({ onSelect, searchQuery }: { onSelect: any, searchQuery: string }) => {
    const renderPack = useCallback(({ item }: { item: any }) => (
        <View key={item.id} style={styles.stickerCategory}>
            <ThemedText style={styles.categoryTitle}>{item.name}</ThemedText>
            <FlatList
                data={item.stickers}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item: stickerUrl }) => (
                    <TouchableOpacity onPress={() => onSelect('sticker', stickerUrl)} style={styles.stickerItem}>
                        <Image source={{ uri: stickerUrl }} style={styles.stickerImage} resizeMode="contain" />
                    </TouchableOpacity>
                )}
                keyExtractor={url => url}
            />
        </View>
    ), [onSelect]);

    return (
        <FlatList
            data={STICKER_PACKS}
            renderItem={renderPack}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.scrollContent}
        />
    );
});

export const ChatMediaPanel = React.memo(({ height, visible, onSelect, activeTab, onTabChange, isSearching, onSearchToggle }: any) => {
    const [searchQuery, setSearchQuery] = useState('');
    
    const toggleSearch = useCallback(() => {
        const nextSearching = !isSearching;
        onSearchToggle(nextSearching);
        if (isSearching) setSearchQuery('');
    }, [isSearching, onSearchToggle]);

    if (!visible) return null;

    return (
        <View style={[styles.container, { height }]}>
            <View style={styles.topBar}>
                {isSearching ? (
                    <View style={styles.headerSearchContainer}>
                        <Search size={20} color={Colors.textSecondary} />
                        <TextInput
                            style={styles.headerSearchInput}
                            placeholder={activeTab === 'gif' ? "Search GIPHY..." : "Search..."}
                            placeholderTextColor={Colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                        <TouchableOpacity onPress={toggleSearch}>
                            <X size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity style={styles.searchButton} onPress={toggleSearch}>
                            <Search size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                onPress={() => onTabChange('emoji')}
                                style={[styles.topTabItem, activeTab === 'emoji' && styles.activeTopTab]}
                            >
                                <Smile size={20} color={activeTab === 'emoji' ? '#fff' : Colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => onTabChange('textmoji')}
                                style={[styles.topTabItem, activeTab === 'textmoji' && styles.activeTopTab]}
                            >
                                <PenLine size={20} color={activeTab === 'textmoji' ? '#fff' : Colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => onTabChange('gif')}
                                style={[styles.topTabItem, activeTab === 'gif' && styles.activeTopTab]}
                            >
                                <ThemedText style={[styles.tabText, activeTab === 'gif' && styles.activeTabText]}>GIF</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => onTabChange('sticker')}
                                style={[styles.topTabItem, activeTab === 'sticker' && styles.activeTopTab]}
                            >
                                <StickyNote size={20} color={activeTab === 'sticker' ? '#fff' : Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.backspaceButton} onPress={() => onSelect('emoji', 'BACKSPACE')}>
                            <Delete size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </>
                )}
            </View>
            <View style={styles.contentContainer}>
                {activeTab === 'emoji' && <EmojiTab onSelect={onSelect} searchQuery={searchQuery} />}
                {activeTab === 'textmoji' && <TextmojiTab onSelect={onSelect} searchQuery={searchQuery} />}
                {activeTab === 'gif' && <GifTab onSelect={onSelect} searchQuery={searchQuery} />}
                {activeTab === 'sticker' && <StickerTab onSelect={onSelect} searchQuery={searchQuery} />}
            </View>
        </View>
    );
});
