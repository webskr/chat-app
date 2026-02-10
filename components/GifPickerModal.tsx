import React, { useState, useEffect } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator, Dimensions } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';
import { X, Search } from 'lucide-react-native';

interface GifPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectGif: (url: string) => void;
}

const TENOR_API_KEY = 'LIVDSRZULELA'; // Public Demo Key
const CLIENT_KEY = 'ChatApp';

export const GifPickerModal: React.FC<GifPickerModalProps> = ({ visible, onClose, onSelectGif }) => {
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [nextPos, setNextPos] = useState('');

    useEffect(() => {
        if (visible) {
            fetchGifs();
        } else {
            setGifs([]);
            setQuery('');
            setNextPos('');
        }
    }, [visible]);

    const fetchGifs = async (searchTerm = '') => {
        setLoading(true);
        try {
            const type = searchTerm ? 'search' : 'featured';
            // Tenor API v2
            const url = `https://tenor.googleapis.com/v2/${type}?key=${TENOR_API_KEY}&client_key=${CLIENT_KEY}&q=${searchTerm}&limit=20&pos=${nextPos}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.results) {
                if (searchTerm && query !== searchTerm) {
                    // New search
                    setGifs(data.results);
                } else {
                    // Append or initial load
                    setGifs(prev => nextPos ? [...prev, ...data.results] : data.results);
                }
                setNextPos(data.next || '');
            }
        } catch (error) {
            console.error('Error fetching GIFs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setNextPos(''); // Reset pagination for new search
        fetchGifs(query);
    };

    const handleSelect = (item: any) => {
        // Prefer tinygif for preview, or gif for sending
        // Tenor v2 structure: item.media_formats.gif.url
        const url = item.media_formats?.gif?.url || item.url;
        onSelectGif(url);
        onClose();
    };

    const renderItem = ({ item }: { item: any }) => {
        const previewUrl = item.media_formats?.tinygif?.url || item.media_formats?.gif?.url;
        const aspectRatio = (item.media_formats?.tinygif?.dims[0] || 100) / (item.media_formats?.tinygif?.dims[1] || 100);

        return (
            <TouchableOpacity onPress={() => handleSelect(item)} style={styles.gifContainer}>
                <Image
                    source={{ uri: previewUrl }}
                    style={[styles.gifImage, { aspectRatio }]}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <ThemedText style={styles.title}>Send a GIF</ThemedText>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={Colors.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search Tenor..."
                        placeholderTextColor={Colors.textSecondary}
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                </View>

                <FlatList
                    data={gifs}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.columnWrapper}
                    onEndReached={() => {
                        if (nextPos && !loading) fetchGifs(query);
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
                    contentContainerStyle={styles.listContent}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    closeButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceLight,
        margin: 16,
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
    },
    listContent: {
        padding: 8,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    gifContainer: {
        flex: 1,
        margin: 4,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#e0e0e0',
    },
    gifImage: {
        width: '100%',
        minHeight: 100,
    },
});
