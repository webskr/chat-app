import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';
import { LucideIcon } from 'lucide-react-native';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    message: string;
    style?: ViewStyle;
}

export const EmptyState = ({ icon: Icon, title, message, style }: EmptyStateProps) => {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.iconContainer}>
                <Icon size={48} color={Colors.textSecondary} strokeWidth={1.5} />
            </View>
            <ThemedText type="defaultSemiBold" style={styles.title}>{title}</ThemedText>
            <ThemedText style={styles.message}>{message}</ThemedText>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        opacity: 0.8,
    },
    iconContainer: {
        marginBottom: 20,
        padding: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 100,
    },
    title: {
        fontSize: 18,
        color: Colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
