import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { GlassCard } from '../../components/GlassCard';
import { ChevronLeft, ChevronRight, FileText, Scale } from 'lucide-react-native';
import { router } from 'expo-router';

export default function PrivacySettingsScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.headerTitle}>Privacy</ThemedText>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={styles.sectionTitle}>Legal & Information</ThemedText>
                <GlassCard style={styles.card}>
                    <TouchableOpacity
                        style={styles.item}
                        onPress={() => router.push('/settings/privacy-policy')}
                    >
                        <View style={styles.itemLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                <FileText size={20} color="#3b82f6" />
                            </View>
                            <ThemedText style={styles.itemText}>Privacy Policy</ThemedText>
                        </View>
                        <ChevronRight size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                        style={styles.item}
                        onPress={() => router.push('/settings/terms')}
                    >
                        <View style={styles.itemLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                <Scale size={20} color="#10b981" />
                            </View>
                            <ThemedText style={styles.itemText}>Terms & Conditions</ThemedText>
                        </View>
                        <ChevronRight size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                        style={styles.item}
                        onPress={() => router.push('/settings/account-deletion')}
                    >
                        <View style={styles.itemLeft}>
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                <FileText size={20} color="#ef4444" />
                            </View>
                            <ThemedText style={styles.itemText}>Account Deletion</ThemedText>
                        </View>
                        <ChevronRight size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </GlassCard>
            </ScrollView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 12,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemText: {
        fontSize: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.glassBorder,
        marginLeft: 64, // Align with text
    },
});
