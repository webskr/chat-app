import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { Colors } from '../../../constants/Colors';
import { Info, AlertCircle } from 'lucide-react-native';

interface InlineScheduleGuidanceProps {
    date: Date | null;
    error: string | null;
}

export const InlineScheduleGuidance: React.FC<InlineScheduleGuidanceProps> = ({ date, error }) => {
    // Determine validity based on the provided date and error props
    const isValid = !!date && !error;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {isValid ? (
                    <Info size={16} color={Colors.primary} />
                ) : (
                    <AlertCircle size={16} color={Colors.error} />
                )}
                <ThemedText style={[styles.title, !isValid && styles.errorText]}>
                    {isValid ? "Schedule Message" : "Check Time Format"}
                </ThemedText>
            </View>

            <View style={styles.content}>
                {isValid && date ? (
                    <ThemedText style={styles.preview}>
                        Sending at: <ThemedText style={styles.timeHighlight}>{date.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</ThemedText>
                    </ThemedText>
                ) : (
                    <ThemedText style={styles.helper}>
                        {error || "Try: 5pm, tomorrow 9am, or in 10 minutes"}
                    </ThemedText>
                )}

                {!isValid && (
                    <View style={styles.examples}>
                        <ThemedText style={styles.exampleLabel}>Examples:</ThemedText>
                        <ThemedText style={styles.example}>• /schedule 5pm Hello</ThemedText>
                        <ThemedText style={styles.example}>• /schedule tomorrow 9am Meeting</ThemedText>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute', // Position absolute to float above input
        bottom: '100%',
        left: 16,
        right: 16,
        marginBottom: 8,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        zIndex: 1000,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    errorText: {
        color: Colors.error,
    },
    content: {
        paddingLeft: 24, // Indent to align with text
    },
    preview: {
        fontSize: 14,
        color: Colors.text,
    },
    timeHighlight: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    helper: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    examples: {
        marginTop: 8,
    },
    exampleLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
        marginBottom: 2,
    },
    example: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontStyle: 'italic',
    },
});
