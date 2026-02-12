import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import * as Linking from 'expo-linking';

interface LinkPreviewProps {
    url: string;
    isMe: boolean;
}

export const LinkPreview = ({ url, isMe }: LinkPreviewProps) => {
    const [metadata, setMetadata] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const response = await fetch(`${Config.API_URL}/chat/get_link_metadata.php?url=${encodeURIComponent(url)}`);
                const data = await response.json();
                if (response.ok) {
                    setMetadata(data);
                }
            } catch (error) {
                console.error('Error fetching link metadata:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMetadata();
    }, [url]);

    if (loading) {
        return (
            <View style={[styles.container, styles.loading, isMe && styles.myContainer]}>
                <ActivityIndicator size="small" color={isMe ? '#fff' : Colors.primary} />
            </View>
        );
    }

    if (!metadata || (!metadata.title && !metadata.image)) return null;

    const getHostname = (urlStr: string) => {
        try {
            const matches = urlStr.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
            return matches && matches[1];
        } catch (e) {
            return urlStr;
        }
    };

    return (
        <TouchableOpacity
            style={[styles.container, isMe && styles.myContainer]}
            onPress={() => Linking.openURL(url)}
            activeOpacity={0.8}
        >
            {metadata.image ? (
                <Image source={{ uri: metadata.image }} style={styles.image} resizeMode="cover" />
            ) : null}
            <View style={styles.textContainer}>
                {metadata.title ? (
                    <ThemedText type="defaultSemiBold" numberOfLines={2} style={[styles.title, isMe && styles.whiteText]}>
                        {metadata.title}
                    </ThemedText>
                ) : null}
                {metadata.description ? (
                    <ThemedText numberOfLines={2} style={[styles.description, isMe && styles.whiteTextSecondary]}>
                        {metadata.description}
                    </ThemedText>
                ) : null}
                <ThemedText numberOfLines={1} style={[styles.url, isMe && styles.whiteTextSecondary]}>
                    {getHostname(url)}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 6,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        width: '100%',
        minWidth: 200,
    },
    myContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    loading: {
        padding: 20,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: 140,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    textContainer: {
        padding: 10,
        gap: 2,
    },
    title: {
        fontSize: 14,
        color: Colors.text,
    },
    description: {
        fontSize: 12,
        color: Colors.textSecondary,
        lineHeight: 16,
    },
    url: {
        fontSize: 10,
        color: Colors.textSecondary,
        opacity: 0.7,
        marginTop: 4,
    },
    whiteText: {
        color: '#fff',
    },
    whiteTextSecondary: {
        color: '#fff',
        opacity: 0.8,
    }
});
