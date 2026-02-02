import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { Check, X, MoreVertical } from 'lucide-react-native';
import { getAvatarById } from '../../constants/Avatars';

const MOCK_REQUESTS = [
    { id: '1', name: 'John Doe', handle: '@johndoe', avatar: getAvatarById('0'), time: '2h ago' },
    { id: '2', name: 'Jane Smith', handle: '@janesmith', avatar: getAvatarById('3'), time: '5h ago' },
    { id: '3', name: 'Mike Ross', handle: '@mikeross', avatar: getAvatarById('2'), time: '1d ago' },
];

export default function RequestsScreen() {
    const renderItem = ({ item }: { item: typeof MOCK_REQUESTS[0] }) => (
        <GlassCard style={styles.card}>
            <View style={styles.row}>
                <Avatar source={item.avatar} size={50} />
                <View style={styles.info}>
                    <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                    <ThemedText type="caption">{item.handle} • {item.time}</ThemedText>
                </View>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity style={[styles.button, styles.acceptButton]}>
                    <Check size={20} color={Colors.white} />
                    <ThemedText style={styles.buttonText}>Accept</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.declineButton]}>
                    <X size={20} color={Colors.white} />
                    <ThemedText style={styles.buttonText}>Decline</ThemedText>
                </TouchableOpacity>
            </View>
        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <ThemedText type="title" style={styles.headerTitle}>Vegarm</ThemedText>
                <TouchableOpacity onPress={() => {/* More options */ }}>
                    <MoreVertical size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>
            <FlatList
                data={MOCK_REQUESTS}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 0.5,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
        gap: 16,
    },
    card: {
        padding: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    info: {
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 12,
        gap: 6,
    },
    acceptButton: {
        backgroundColor: Colors.primary,
    },
    declineButton: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.surfaceLight,
    },
    buttonText: {
        color: Colors.white,
        fontWeight: '600',
    },
});
