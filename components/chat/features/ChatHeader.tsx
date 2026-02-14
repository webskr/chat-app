import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, MoreVertical, Trash2, Share, X, Copy } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../../components/ThemedText';
import { Avatar } from '../../../components/Avatar';
import { getAvatarById } from '../../../constants/Avatars';
import { formatChatTime } from '../../../utils/time';
import { OverflowMenu } from '../../../components/OverflowMenu';
import { ProfileModal } from '../../../components/ProfileModal';

import { Config } from '../../../constants/Config';

export const ChatHeader = ({
    id,
    otherUsername,
    avatar_id,
    avatar_url, // Added prop
    currentUser,
    targetUserProfile,
    isTyping,
    relationshipStatus,
    menuVisible,
    setMenuVisible,
    modalVisible,
    setModalVisible,
    menuItems,
    fetchRelationshipStatus,

    // Selection Mode Props
    selectionMode,
    selectedCount,
    onCancelSelection,
    onDeleteSelected,
    onForwardSelected,
    onCopySelected,
}: any) => {

    if (selectionMode) {
        return (
            <View style={[styles.header, styles.selectionHeader]}>
                <View style={styles.leftContainer}>
                    <TouchableOpacity onPress={onCancelSelection} style={styles.iconButton}>
                        <ChevronLeft size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <ThemedText type="defaultSemiBold" style={styles.selectionTitle}>
                        {selectedCount}
                    </ThemedText>
                </View>

                <View style={styles.rightContainer}>
                    <TouchableOpacity onPress={onDeleteSelected} style={styles.iconButton}>
                        <Trash2 size={22} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onCopySelected} style={styles.iconButton}>
                        <Copy size={22} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onForwardSelected} style={styles.iconButton}>
                        <Share size={22} color={Colors.text} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerInfo}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.7}
                >
                    <Avatar
                        source={
                            (String(id) === String(currentUser?.id) && currentUser?.avatar_url) ? `${Config.API_URL}/${currentUser.avatar_url}` :
                                (targetUserProfile?.avatar_url) ? `${Config.API_URL}/${targetUserProfile.avatar_url}` :
                                    (avatar_url) ? `${Config.API_URL}/${avatar_url}` :
                                        getAvatarById(targetUserProfile?.avatar_id || avatar_id || id)
                        }
                        online={!!targetUserProfile?.last_seen && (new Date().getTime() - new Date(targetUserProfile.last_seen).getTime() < 60000)}
                        size={40}
                    />
                    <View style={styles.nameContainer}>
                        <ThemedText type="defaultSemiBold">
                            {String(id) === String(currentUser?.id) ? 'Note to self' : otherUsername}
                        </ThemedText>

                        <ThemedText type="caption" style={{ color: String(id) === String(currentUser?.id) ? Colors.secondary : (isTyping ? Colors.primary : (targetUserProfile?.last_seen && (new Date().getTime() - new Date(targetUserProfile.last_seen).getTime() < 60000) ? Colors.online : Colors.textSecondary)) }}>
                            {String(id) === String(currentUser?.id)
                                ? 'Personal Space'
                                : isTyping
                                    ? 'Typing...'
                                    : targetUserProfile?.last_seen
                                        ? (new Date().getTime() - new Date(targetUserProfile.last_seen).getTime() < 60000
                                            ? 'Online'
                                            : `Last seen ${formatChatTime(targetUserProfile.last_seen)}`)
                                        : 'Recently active'}
                        </ThemedText>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton} onPress={() => setMenuVisible(true)}>
                    <MoreVertical size={24} color={Colors.text} />
                </TouchableOpacity>

                <OverflowMenu
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    items={menuItems}
                />
            </View>

            <ProfileModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                user={targetUserProfile || { id, username: otherUsername, avatar_id: avatar_id || '1' }}
                currentUser={currentUser}
                relationship={String(id) === String(currentUser?.id) ? 'self' : (relationshipStatus as any) || 'none'}
                onActionComplete={() => {
                    fetchRelationshipStatus();
                }}
            />
        </>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
        backgroundColor: Colors.background,
    },
    selectionHeader: {
        justifyContent: 'space-between',
        backgroundColor: Colors.surface, // Slightly different bg for selection mode?
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    iconButton: {
        padding: 4,
    },
    selectionTitle: {
        fontSize: 18,
    },
    backButton: {
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    nameContainer: {
        gap: 2,
    },
    moreButton: {
        padding: 4,
    },
});
