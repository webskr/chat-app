import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../constants/Colors';

interface AvatarProps {
    source?: ImageSourcePropType | string | null;
    size?: number;
    online?: boolean;
    style?: StyleProp<ViewStyle>;
    fallbackComponent?: React.ReactNode;
}

export const Avatar = ({ source, size = 48, online, style, fallbackComponent }: AvatarProps) => {
    const imageSource = typeof source === 'string' ? { uri: source } : source;

    return (
        <View style={[styles.container, { width: size, height: size }, style]}>
            {imageSource ? (
                <Image
                    source={imageSource}
                    style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
                />
            ) : fallbackComponent ? (
                <View style={[styles.image, { width: size, height: size, borderRadius: size / 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}>
                    {fallbackComponent}
                </View>
            ) : null}
            {!!online && (
                <View style={[
                    styles.statusParams,
                    {
                        backgroundColor: Colors.online,
                        width: size * 0.3,
                        height: size * 0.3,
                        borderRadius: (size * 0.3) / 2
                    }
                ]} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    image: {
        backgroundColor: Colors.surface,
        borderWidth: 2,
        borderColor: Colors.background,
    },
    statusParams: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderWidth: 2,
        borderColor: Colors.background,
    },
});
