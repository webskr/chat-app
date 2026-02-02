import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/ThemedText';
import { GlassCard } from '../components/GlassCard';
import { useTheme } from '../context/ThemeContext';

// Define the colors as requested
const NEON_COLORS = [
    { id: 'emerald', name: 'Emerald', color: '#10B981' },
    { id: 'blue', name: 'Blue', color: '#3B82F6' },
    { id: 'rose', name: 'Rose', color: '#F43F5E' },
    { id: 'amber', name: 'Amber', color: '#F59E0B' },
    { id: 'purple', name: 'Purple', color: '#A855F7' },
    { id: 'slate', name: 'Slate', color: '#64748B' },
    { id: 'indigo', name: 'Indigo', color: '#6366F1' },
    { id: 'cyan', name: 'Cyan', color: '#06B6D4' },
];

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 4;
const GAP = 12;
// Calculate item width based on available space: (Screen Width - Padding - Gaps) / Columns
const ITEM_WIDTH = (width - 40 - (GAP * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

export default function AppearanceScreen() {
    const { neonColor, setNeonColor } = useTheme();

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Glassy Box Color</ThemedText>

                <View style={styles.grid}>
                    {NEON_COLORS.map((item) => {
                        const isSelected = neonColor === item.color;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => setNeonColor(item.color)}
                                activeOpacity={0.8}
                                style={{ width: ITEM_WIDTH }}
                            >
                                <GlassCard style={[
                                    styles.colorCard,
                                    isSelected && { borderColor: Colors.secondary, borderWidth: 1.5, backgroundColor: 'rgba(6, 182, 212, 0.1)' }
                                ]}>
                                    <View style={[
                                        styles.colorPreview,
                                        { borderColor: item.color },
                                        isSelected && { backgroundColor: item.color, opacity: 0.2 }
                                    ]}>
                                        <View style={{
                                            width: '100%', height: '100%', borderRadius: 8,
                                            backgroundColor: item.color, opacity: 0.15
                                        }} />
                                    </View>
                                    <ThemedText style={[
                                        styles.colorName,
                                        isSelected && { color: Colors.text, fontWeight: '700' }
                                    ]}>
                                        {item.name}
                                    </ThemedText>
                                </GlassCard>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <ThemedText type="subtitle" style={[styles.sectionTitle, { marginTop: 32 }]}>PREVIEW IN WORLD</ThemedText>

                <GlassCard style={[styles.previewCard, { borderColor: neonColor }]}>
                    <View style={styles.previewRow}>
                        <View style={[styles.previewAvatar, { backgroundColor: Colors.surface }]} />
                        <View style={styles.previewContent}>
                            <View style={[styles.previewLine, { width: 100, height: 14, marginBottom: 8 }]} />
                            <View style={[styles.previewLine, { width: 60, height: 10 }]} />
                        </View>
                    </View>
                    <View style={[styles.previewAddButton, { backgroundColor: Colors.surface }]} />
                </GlassCard>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: 'bold',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
    },
    colorCard: {
        aspectRatio: 1,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    colorPreview: {
        width: 32,
        height: 32,
        borderRadius: 10,
        borderWidth: 2,
        marginBottom: 8,
        overflow: 'hidden',
    },
    colorName: {
        fontSize: 11,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    // Preview Section
    previewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1.5,
        backgroundColor: 'rgba(255,255,255,0.03)',
        minHeight: 80,
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 16,
        backgroundColor: Colors.surface,
    },
    previewContent: {
        justifyContent: 'center',
    },
    previewLine: {
        backgroundColor: Colors.surface,
        borderRadius: 6,
        opacity: 0.5,
    },
    previewAddButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        opacity: 0.5,
    },
});
