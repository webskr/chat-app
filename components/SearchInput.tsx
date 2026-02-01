import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { GlassCard } from './GlassCard';

interface SearchInputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    style?: ViewStyle;
}

export const SearchInput = ({ value, onChangeText, placeholder = "Search...", style }: SearchInputProps) => {
    return (
        <GlassCard style={(style ? [styles.container, style] : styles.container) as any} contentContainerStyle={styles.content}>
            <Search size={20} color={Colors.textSecondary} style={styles.icon} />
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={Colors.textSecondary}
                autoCorrect={false}
                autoCapitalize="none"
            />
            {value.length > 0 && (
                <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearButton}>
                    <X size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
            )}
        </GlassCard>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        marginBottom: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: 16,
        padding: 0,
    },
    clearButton: {
        padding: 4,
    },
});
