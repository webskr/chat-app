import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

interface BadgeProps {
    count: number;
}

export const Badge = ({ count }: BadgeProps) => {
    if (count <= 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.text}>
                {count > 99 ? '99+' : count}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.accent,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    text: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
