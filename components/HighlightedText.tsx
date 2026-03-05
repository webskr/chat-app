import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

interface HighlightedTextProps {
    text: string;
    highlight: string;
    style?: TextStyle;
    highlightStyle?: TextStyle;
    numberOfLines?: number;
}

/**
 * A component that renders text with matching parts highlighted.
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
    text,
    highlight,
    style,
    highlightStyle,
    numberOfLines
}) => {
    if (!highlight.trim()) {
        return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
    }

    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));

    return (
        <Text style={style} numberOfLines={numberOfLines}>
            {parts.map((part, i) => (
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <Text key={i} style={[styles.highlight, highlightStyle]}>
                        {part}
                    </Text>
                ) : (
                    <Text key={i}>{part}</Text>
                )
            ))}
        </Text>
    );
};

const styles = StyleSheet.create({
    highlight: {
        backgroundColor: '#FFD700', // Gold highlight
        color: '#000',
        fontWeight: 'bold',
    },
});
