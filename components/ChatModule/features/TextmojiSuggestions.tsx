import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { Colors } from '../../../constants/Colors';
import { ALL_TEXTMOJIS } from '../../../constants/TextmojiList';
import { Flame } from 'lucide-react-native';

interface TextmojiSuggestionsProps {
    filter: string;
    onSelect: (text: string, id: string) => void;
    onClose: () => void;
}

export const TextmojiSuggestions = ({ filter, onSelect }: TextmojiSuggestionsProps) => {
    const query = filter.toLowerCase();
    
    // Filter by text, mood, or tags
    const filtered = ALL_TEXTMOJIS.filter(tm => 
        tm.text.toLowerCase().includes(query) ||
        tm.mood.toLowerCase().includes(query) ||
        tm.tags.some(t => t.toLowerCase().includes(query))
    ).slice(0, 10); // Limit to 10 for performance/UI

    if (filtered.length === 0) return null;

    return (
        <View style={styles.container}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollView}>
                {filtered.map((tm) => (
                    <TouchableOpacity
                        key={tm.id}
                        style={styles.item}
                        onPress={() => onSelect(tm.text, tm.id)}
                    >
                        <View style={styles.iconContainer}>
                           <Flame size={14} color={Colors.textSecondary} />
                        </View>
                        <View style={styles.textContainer}>
                            <ThemedText style={styles.textmojiText}>{tm.text}</ThemedText>
                            <ThemedText style={styles.moodTag}>#{tm.mood}</ThemedText>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: '100%', // Position above the input bar
        left: 16,
        right: 16,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        maxHeight: 250,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        overflow: 'hidden',
        zIndex: 9999, // Ensure it sits on top
    },
    scrollView: {
        paddingVertical: 4,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.glassBorder,
    },
    iconContainer: {
        marginRight: 10,
        opacity: 0.6,
    },
    textContainer: {
        flex: 1,
    },
    textmojiText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
    },
    moodTag: {
        fontSize: 10,
        color: Colors.textSecondary,
        marginTop: 2,
    },
});
