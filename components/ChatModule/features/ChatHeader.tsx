import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, MoreVertical, Trash2, Share, X, Copy, BadgeCheck, Reply } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../../components/ThemedText';
import { Avatar } from '../../../components/Avatar';
import { getAvatarById } from '../../../constants/Avatars';
import { formatChatTime } from '../../../utils/time';
import { OverflowMenu } from '../../../components/OverflowMenu';
import { GroupDefaultIcon } from '../../../components/icons/GroupDefaultIcon';

import { Config } from '../../../constants/Config';
import { styles } from './ChatHeader.styles';

export const ChatHeader = ({
    id,
    otherUsername,
    avatar_id,
    avatar_url,
    isGroup,
    currentUser,
    targetUserProfile,
    presence,
    relationshipStatus,
    menuVisible,
    setMenuVisible,
    menuItems,
    fetchRelationshipStatus,

    // Selection Mode Props
    selectionMode,
    selectedCount,
    onCancelSelection,
    onDeleteSelected,
    onForwardSelected,
    onCopySelected,
    onReplySelected,
    isOfficialParam
}: any) => {

    const isOnline = presence?.isOnline;
    const isTyping = presence?.isTyping;
    const lastActive = presence?.lastActive || targetUserProfile?.last_active || targetUserProfile?.last_seen;

    if (selectionMode) {
        return (
            <View style={[styles.header, styles.selectionHeader]}>
                <View style={styles.leftContainer}>
                    <TouchableOpacity onPress={onCancelSelection} style={styles.iconButton}>
                        <X size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <ThemedText type="defaultSemiBold" style={styles.selectionTitle}>
                        {selectedCount}
                    </ThemedText>
                </View>
                <View style={styles.rightContainer}>
                    {selectedCount === 1 && (
                        <TouchableOpacity onPress={onReplySelected} style={styles.iconButton}>
                            <Reply size={24} color={Colors.text} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onCopySelected} style={styles.iconButton}>
                        <Copy size={22} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onForwardSelected} style={styles.iconButton}>
                        <Share size={22} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDeleteSelected} style={styles.iconButton}>
                        <Trash2 size={22} color="#EF4444" />
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
                    onPress={() => {
                        if (isGroup) {
                            router.push({ pathname: '/chat/group_info', params: { id: id } });
                        } else {
                            router.push(`/user/${id}`);
                        }
                    }}
                    activeOpacity={0.7}
                >
                    <Avatar
                        source={
                            (String(id) === String(currentUser?.id) && currentUser?.avatar_url) ? `${Config.API_URL}/${currentUser.avatar_url}` :
                                (isGroup) ? (avatar_url ? `${Config.API_URL}/${avatar_url}` : undefined) :
                                    (targetUserProfile?.avatar_url) ? `${Config.API_URL}/${targetUserProfile.avatar_url}` :
                                        (avatar_url) ? `${Config.API_URL}/${avatar_url}` :
                                            getAvatarById(targetUserProfile?.avatar_id ?? avatar_id ?? id)
                        }
                        online={!isGroup && (isOnline)}
                        size={40}
                        fallbackComponent={isGroup ? <GroupDefaultIcon size={40} /> : undefined}
                    />
                    <View style={styles.nameContainer}>
                        <View style={styles.nameRow}>
                            <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.username}>
                                {String(id) === String(currentUser?.id) ? 'Note to self' : (otherUsername || targetUserProfile?.username || 'Chat')}
                            </ThemedText>
                            {(
                                targetUserProfile?.is_official == 1 || 
                                targetUserProfile?.is_official === '1' || 
                                isOfficialParam == 1 || 
                                isOfficialParam === '1' ||
                                otherUsername === 'Vegram Official' ||
                                otherUsername === 'VegramOfficial' ||
                                targetUserProfile?.username === 'VegramOfficial'
                            ) && (
                                <BadgeCheck size={16} color={Colors.officialBadgeBorder} fill={Colors.officialBadge} />
                            )}
                        </View>

                        <ThemedText type="caption" style={{ color: String(id) === String(currentUser?.id) ? Colors.secondary : (isTyping ? Colors.primary : (isOnline ? Colors.online : Colors.textSecondary)) }}>
                            {String(id) === String(currentUser?.id)
                                ? 'Personal Space'
                                : isTyping
                                    ? (isGroup && (presence as any)?.typingMembers?.length > 0
                                        ? `${(presence as any).typingMembers.length > 2
                                            ? `${(presence as any).typingMembers[0]}, ${(presence as any).typingMembers[1]} and ${(presence as any).typingMembers.length - 2} more`
                                            : (presence as any).typingMembers.join(' and ')
                                        } typing...`
                                        : 'Typing...')
                                    : isGroup
                                        ? 'Tap for group info'
                                        : (isOnline
                                            ? 'Online'
                                            : lastActive
                                                ? `Last seen ${formatChatTime(lastActive)}`
                                                : 'Recently active')}
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
        </>
    );
};


