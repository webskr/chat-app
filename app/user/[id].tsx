import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { UserProfileViewer } from '../../components/ChatModule/features/ProfileModule/UserProfileViewer';
import { Config } from '../../constants/Config';
import { useUser } from '../../context/UserContext';
import { Colors } from '../../constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user: currentUser } = useUser();
    const [targetUser, setTargetUser] = useState<any>(null);
    const [relationship, setRelationship] = useState<any>('none');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUserDetails();
    }, [id]);

    const fetchUserDetails = async () => {
        if (!currentUser || !id) return;
        try {
            // Fetch users (similar to how it's done in ChatDetailScreen)
            const response = await fetch(`${Config.API_URL}/users/get_users.php?user_id=${currentUser.id}`);
            if (response.ok) {
                const users = await response.json();
                const other = users.find((u: any) => String(u.id) === String(id));
                if (other) {
                    setTargetUser(other);
                    setRelationship(other.relationship_status || 'none');
                } else if (String(id) === String(currentUser.id)) {
                    setTargetUser({ ...currentUser, bio: 'Note to self' });
                    setRelationship('self');
                } else {
                    Alert.alert("Error", "User not found.");
                    router.back();
                }
            }
        } catch (error) {
            console.error("Fetch profile error:", error);
            Alert.alert("Error", "Failed to load profile.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
            <UserProfileViewer
                isPage={true}
                onClose={() => router.back()}
                user={targetUser}
                currentUser={currentUser}
                relationship={relationship}
                onActionComplete={fetchUserDetails}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
