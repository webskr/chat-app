import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { Colors } from '../../../constants/Colors';
import { Avatar } from '../../../components/Avatar';
import { getAvatarById } from '../../../constants/Avatars';
import { Config } from '../../../constants/Config';

interface MentionSuggestionsProps {
    members: any[];
    filter: string;
    onSelect: (username: string) => void;
    onClose: () => void;
}

export const MentionSuggestions = ({ members, filter, onSelect }: MentionSuggestionsProps) => {
    // Filter members based on username or display name
    // Ignore case
    const filteredMembers = members.filter(member => {
        const query = filter.toLowerCase();
        return (
            member.username.toLowerCase().includes(query) ||
            (member.display_name && member.display_name.toLowerCase().includes(query))
        );
    });

    if (filteredMembers.length === 0) return null;

    return (
        <View style={styles.container}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollView}>
                {filteredMembers.map((member) => (
                    <TouchableOpacity
                        key={member.id}
                        style={styles.item}
                        onPress={() => onSelect(member.username)}
                    >
                        <Avatar
                            source={
                                member.avatar_url
                                    ? (member.avatar_url.startsWith('http') ? member.avatar_url : `${Config.API_URL}/${member.avatar_url}`)
                                    : getAvatarById(member.avatar_id)
                            }
                            size={32}
                        />
                        <View style={styles.textContainer}>
                            <ThemedText style={styles.username}>@{member.username}</ThemedText>
                            {member.display_name && (
                                <ThemedText style={styles.displayName}>{member.display_name}</ThemedText>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: '100%', // Position above the input bar
        left: 16,
        right: 16,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        maxHeight: 200,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        overflow: 'hidden',
        zIndex: 9999, // Ensure it sits on top
    },
    scrollView: {
        paddingVertical: 4,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.glassBorder,
    },
    textContainer: {
        marginLeft: 10,
        justifyContent: 'center',
    },
    username: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    displayName: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
});
