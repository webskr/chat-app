import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { Colors } from '../../../constants/Colors';
import { Clock, EyeOff } from 'lucide-react-native';

interface SlashCommandSuggestionsProps {
    visible: boolean;
    onSelect: (command: string) => void;
}

export const SlashCommandSuggestions: React.FC<SlashCommandSuggestionsProps> = ({ visible, onSelect }) => {
    if (!visible) return null;

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.item}
                onPress={() => onSelect('/schedule ')}
            >
                <View style={styles.iconContainer}>
                    <Clock size={20} color={Colors.primary} />
                </View>
                <View style={styles.textContainer}>
                    <ThemedText style={styles.command}>/schedule</ThemedText>
                    <ThemedText style={styles.description}>Schedule a message for later</ThemedText>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.item}
                onPress={() => onSelect('/otv ')}
            >
                <View style={styles.iconContainer}>
                    <EyeOff size={20} color={Colors.primary} />
                </View>
                <View style={styles.textContainer}>
                    <ThemedText style={styles.command}>/otv</ThemedText>
                    <ThemedText style={styles.description}>Send a one-time view message</ThemedText>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: '100%',
        left: 16,
        right: 16,
        marginBottom: 8,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: Colors.background,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    command: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    description: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
});
