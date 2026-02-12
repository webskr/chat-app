
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Image, TextInput, ActivityIndicator, Dimensions, Text, SectionList } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';
import { Smile, Search, StickyNote, Heart, Clock, Gift, Delete, X, ChevronLeft, Hash, Flag, Lightbulb, Coffee, Car, Activity, Cat, Dog, Leaf, Zap, Globe, Trophy } from 'lucide-react-native';
import { EMOJI_CATEGORIES, STICKER_PACKS } from '../constants/EmojiList';

interface ChatMediaPanelProps {
    height: number;
    visible: boolean;
    onSelect: (type: 'emoji' | 'gif' | 'sticker', content: string) => void;
    activeTab: 'emoji' | 'gif' | 'sticker';
    onTabChange: (tab: 'emoji' | 'gif' | 'sticker') => void;
    isSearching: boolean;
    onSearchToggle: (searching: boolean) => void;
}

const TENOR_API_KEY = 'LIVDSRZULELA'; // Public Demo Key
const CLIENT_KEY = 'ChatApp';

const CATEGORY_ICONS: Record<string, any> = {
    recent: Clock,
    smileys: Smile,
    gestures: Heart, // Hand? Lucide doesn't have Hand well, Heart is fine for 'Favorites/Love' or similar, but gestures... maybe ThumbsUp?
    animals: Leaf, // Nature
    food: Coffee,
    activity: Trophy, // Activity
    travel: Car,
    objects: Lightbulb,
    symbols: Hash,
    flags: Flag
};

export const ChatMediaPanel: React.FC<ChatMediaPanelProps> = ({ height, visible, onSelect, activeTab, onTabChange, isSearching, onSearchToggle }) => {
    const [searchQuery, setSearchQuery] = useState('');

    if (!visible) return null;

    const toggleSearch = () => {
        const nextSearching = !isSearching;
        onSearchToggle(nextSearching);
        if (isSearching) setSearchQuery('');
    };

    return (
        <View style={[styles.container, { height }]}>
            {/* Top Bar */}
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
                {activeTab === 'gif' && <GifTab onSelect={onSelect} searchQuery={searchQuery} />}
                {activeTab === 'sticker' && <StickerTab onSelect={onSelect} searchQuery={searchQuery} />}
            </View>
        </View>
    );
};

const EmojiTab = ({ onSelect, searchQuery }: { onSelect: any, searchQuery: string }) => {
    const sectionListRef = useRef<SectionList>(null);
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);

    const sections = EMOJI_CATEGORIES.map(cat => ({
        title: cat.name,
        data: [cat.emojis], // Wrap emojis in a single item for rendering a grid per section
        id: cat.id
    }));

    const renderSectionHeader = ({ section: { title } }: any) => (
        <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionHeaderText}>{title}</ThemedText>
        </View>
    );

    const renderItem = ({ item }: any) => (
        <View style={styles.emojiGrid}>
            {item.map((emoji: string, index: number) => (
                <TouchableOpacity key={index} onPress={() => onSelect('emoji', emoji)} style={styles.emojiItem}>
                    <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const scrollToSection = (index: number) => {
        setActiveSectionIndex(index);
        sectionListRef.current?.scrollToLocation({
            sectionIndex: index,
            itemIndex: 0,
            animated: true,
            viewOffset: 0
        });
    };

    const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const output = viewableItems[0];
            if (output.section) {
                const index = sections.findIndex(s => s.title === output.section.title);
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
            />

            {/* Bottom Category Bar */}
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
};

const GIPHY_API_KEY = 'BsjkMBD80tAvvv4YXOP3ja5vEsuCUzPM';

const GifTab = ({ onSelect, searchQuery }: { onSelect: any, searchQuery: string }) => {
    const [gifs, setGifs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchGifs(searchQuery, 0);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const fetchGifs = async (searchTerm = '', currentOffset = 0) => {
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
                // Update offset for next fetch
                if (data.pagination) {
                    setOffset(currentOffset + 20);
                }
            }
        } catch (error) {
            console.error('Error fetching GIFs:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
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
    };

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
};

const StickerTab = ({ onSelect, searchQuery }: { onSelect: any, searchQuery: string }) => {
    const renderPack = ({ item }: { item: any }) => (
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
    );

    return (
        <FlatList
            data={STICKER_PACKS}
            renderItem={renderPack}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.scrollContent}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#121212', // Match dark theme
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#1E1E1E', // Slightly lighter header
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
        backgroundColor: '#2C2C2C', // Darker pill background
        borderRadius: 20,
        padding: 4, // Increased padding
        height: 44, // Explicit height increase if needed
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
        backgroundColor: '#404040', // Active tab background
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
        width: (Dimensions.get('window').width - 16) / 9, // 9 items per row
        height: 40, // Slightly reduced height to fit
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiText: {
        fontSize: 24, // Slightly reduced font size
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
    activeCategoryItem: {
        // Optional: underline or background
        // borderBottomWidth: 2,
        // borderBottomColor: Colors.primary,
    },
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2C',
        margin: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
        height: 40,
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
});
