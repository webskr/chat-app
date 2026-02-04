import React, { useState } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, MoreVertical } from 'lucide-react-native';

import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { Avatar } from '../../components/Avatar';
import { GlassCard } from '../../components/GlassCard';
import { getAvatarById } from '../../constants/Avatars';
import { ProfileModal } from '../../components/ProfileModal';
import { useUser } from '../../context/UserContext';

const MOCK_REQUESTS = [
    { id: '1', name: 'John Doe', handle: '@johndoe', avatar: getAvatarById('0'), time: '2h ago', avatar_id: '0' },
    { id: '2', name: 'Jane Smith', handle: '@janesmith', avatar: getAvatarById('3'), time: '5h ago', avatar_id: '3' },
    { id: '3', name: 'Mike Ross', handle: '@mikeross', avatar: getAvatarById('2'), time: '1d ago', avatar_id: '2' },
];

export default function RequestsScreen() {
    const { user } = useUser();
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const openProfile = (item: any) => {
        // Adapt mock info to modal expectation
        setSelectedUser({
            ...item,
            username: item.name, // Modal uses username
            bio: item.handle,    // Use handle as bio for now
            created_at: new Date().toISOString() // Mock joined date
        });
        setModalVisible(true);
    };

    const renderItem = ({ item }: { item: any }) => (
        <GlassCard style={styles.card}>
            <View style={styles.row}>
                {/* Left - Clickable for profile */}
                <TouchableOpacity
                    style={styles.userInfo}
                    onPress={() => openProfile(item)}
                    activeOpacity={0.7}
                >
                    <Avatar source={item.avatar} size={46} />

                    <View style={styles.textInfo}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1}>
                            {item.name}
                        </ThemedText>
                        <ThemedText type="caption" style={styles.meta}>
                            {item.handle} • {item.time}
                        </ThemedText>
                    </View>
                </TouchableOpacity>

                {/* Right */}
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.acceptBtn}>
                        <Check size={18} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.declineBtn}>
                        <X size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>
        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <ThemedText type="title" style={styles.headerTitle}>
                    Vegarm
                </ThemedText>

                <TouchableOpacity>
                    <MoreVertical size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* List */}
            <FlatList
                data={MOCK_REQUESTS}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
            />

            <ProfileModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                user={selectedUser}
                currentUser={user}
                relationship="request_received"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    /* Header */
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
    },

    /* List */
    list: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },

    card: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 20,
        marginBottom: 12,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },

    textInfo: {
        marginLeft: 12,
        flex: 1,
    },

    meta: {
        marginTop: 2,
        opacity: 0.6,
    },

    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    acceptBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },

    declineBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
