import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, View } from 'react-native';
import { ThemedText } from '../ThemedText';
import { Colors } from '../../constants/Colors';

export type ChatCategory = 'All' | 'Unread' | 'Favourites' | 'Groups';

interface ChatCategoriesProps {
    activeCategory: ChatCategory;
    onCategoryChange: (category: ChatCategory) => void;
}

export const ChatCategories: React.FC<ChatCategoriesProps> = ({ activeCategory, onCategoryChange }) => {
    const categories: ChatCategory[] = ['All', 'Unread', 'Favourites', 'Groups'];

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {categories.map((category) => {
                    const isActive = activeCategory === category;
                    return (
                        <TouchableOpacity
                            key={category}
                            onPress={() => onCategoryChange(category)}
                            style={[
                                styles.categoryChip,
                                isActive && styles.activeChip
                            ]}
                            activeOpacity={0.7}
                        >
                            <ThemedText
                                style={[
                                    styles.categoryText,
                                    isActive && styles.activeText
                                ]}
                            >
                                {category}
                            </ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    activeChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: Colors.primary, // Subtle green border instead of full fill
    },
    categoryText: {
        fontSize: 12, // Slimmer text
        color: Colors.textSecondary,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    activeText: {
        color: Colors.white,
        fontWeight: '700',
    },
});
