import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/ThemedText';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { Config } from '../constants/Config';

// Define the colors as requested
const NEON_COLORS = [
    { id: 'emerald', name: 'Green', color: '#10B981' },
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

const getRandomNeonColor = () => {
    const randomIndex = Math.floor(Math.random() * NEON_COLORS.length);
    return NEON_COLORS[randomIndex].color;
};

export default function AppearanceScreen() {
    const { user, updateUserProfile } = useUser();

    // Use lazy initialization for stable random defaults
    const [stableDefaultColor] = useState(() => getRandomNeonColor());

    const [pendingBorderColor, setPendingBorderColor] = useState(stableDefaultColor);
    const [pendingButtonColor, setPendingButtonColor] = useState(stableDefaultColor);
    const [activeTab, setActiveTab] = useState<'border' | 'button'>('border');

    const [isAppearanceReady, setIsAppearanceReady] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync state once user data is available (only once on mount)
    useEffect(() => {
        if (user && !isAppearanceReady) {
            const border = user.border_color || stableDefaultColor;
            const button = user.button_color || stableDefaultColor;

            setPendingBorderColor(border);
            setPendingButtonColor(button);
            setIsAppearanceReady(true);
        }
    }, [user, stableDefaultColor, isAppearanceReady]);

    const handleColorSelect = (color: string) => {
        if (activeTab === 'border') {
            setPendingBorderColor(color);
        } else {
            setPendingButtonColor(color);
        }
    };

    // Show button if pending colors differ from SAVED colors (allows saving the random default)
    const hasChanges = user && (
        pendingBorderColor !== user.border_color ||
        pendingButtonColor !== user.button_color
    );

    const handleSave = async () => {
        if (!user) return;

        setIsSaving(true);
        try {
            const response = await fetch(`${Config.API_URL}/chat/update_global_chat_settings.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    border_color: pendingBorderColor,
                    button_color: pendingButtonColor
                }),
            });

            if (response.ok) {
                updateUserProfile({
                    border_color: pendingBorderColor,
                    button_color: pendingButtonColor
                });
            }
        } catch (error) {
            console.error('Error syncing appearance:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAppearanceReady) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Preview Section */}
                <ThemedText type="subtitle" style={styles.sectionTitle}>PREVIEW IN WORLD</ThemedText>
                <GlassCard style={[styles.previewCard, { borderColor: pendingBorderColor, shadowColor: pendingBorderColor }]}>
                    <View style={styles.previewRow}>
                        <View style={[styles.previewAvatar, { backgroundColor: Colors.surface }]} />
                        <View style={styles.previewContent}>
                            <View style={[styles.previewLine, { width: 100, height: 14, marginBottom: 8 }]} />
                            <View style={[styles.previewLine, { width: 60, height: 10 }]} />
                        </View>
                        {/* Add Button Preview */}
                        <View style={[
                            styles.previewAddButton,
                            { backgroundColor: pendingButtonColor }
                        ]} />
                    </View>
                </GlassCard>

                {/* Tab Switcher */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'border' && styles.activeTab]}
                        onPress={() => setActiveTab('border')}
                    >
                        <ThemedText style={[styles.tabText, activeTab === 'border' && styles.activeTabText]}>Border Color</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'button' && styles.activeTab]}
                        onPress={() => setActiveTab('button')}
                    >
                        <ThemedText style={[styles.tabText, activeTab === 'button' && styles.activeTabText]}>Button Color</ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Color Grid */}
                <View style={styles.grid}>
                    {NEON_COLORS.map((item) => {
                        const currentColor = activeTab === 'border' ? pendingBorderColor : pendingButtonColor;
                        const isSelected = currentColor === item.color;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => handleColorSelect(item.color)}
                                activeOpacity={0.8}
                                style={{ width: ITEM_WIDTH }}
                            >
                                <GlassCard style={[
                                    styles.colorCard,
                                    isSelected && {
                                        borderColor: item.color,
                                        borderWidth: 2,
                                        backgroundColor: item.color,
                                        shadowColor: item.color,
                                        shadowOpacity: 0.5,
                                        shadowRadius: 10,
                                        elevation: 5
                                    }
                                ]}>
                                    <View style={[
                                        styles.colorPreview,
                                        { borderColor: item.color },
                                        isSelected && { backgroundColor: item.color, opacity: 0.2 }
                                    ]}>
                                        <View style={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: 8,
                                            backgroundColor: item.color,
                                            opacity: 0.15
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

                {/* Save Button */}
                {hasChanges && (
                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: pendingBorderColor }]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color={Colors.white} />
                        ) : (
                            <ThemedText style={styles.saveButtonText}>Apply Changes</ThemedText>
                        )}
                    </TouchableOpacity>
                )}

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
        paddingBottom: 60, // Ensure save button isn't cut off
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
        marginBottom: 32,
    },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'space-between',
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
        width: 80,
        height: 40,
        borderRadius: 20,
        opacity: 0.5,
        alignContent: 'flex-end',
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabText: {
        color: Colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    activeTabText: {
        color: Colors.white,
        fontWeight: 'bold',
    },
    saveButton: {
        marginTop: 40,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    saveButtonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});
