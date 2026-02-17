import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { Config } from '../constants/Config';

interface User {
    id: string;
    username: string;
    display_name?: string;
    email: string;
    avatar_id: string;
    avatar_url?: string;
    bio?: string;
    username_last_updated?: string;
    global_auto_delete_minutes?: number;
    last_seen?: string;
    privacy_last_seen?: number;
    privacy_read_receipts?: number;
    privacy_profile_visibility?: 'public' | 'private';
    show_in_world?: number;
    neon_color?: string;
    border_color?: string;
    button_color?: string;
    auto_delete_otv?: number | boolean;
    scramble_name?: number | boolean;
    links?: string; // JSON string of { label: string, url: string }[]
    is_official?: number | boolean;
}

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    updateUserProfile: (data: Partial<User>) => Promise<void>;
    reloadUser: () => Promise<void>;
    isLoading: boolean;
    unreadCount: number;
    setUnreadCount: (count: number) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                setUserState(JSON.parse(userData));
            }
        } catch (error) {
            console.error('Error loading user from storage:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const reloadUser = async () => {
        // First load from local storage to be quick
        await loadUser();

        // Then fetch fresh data if we have a user
        try {
            const currentUserStr = await AsyncStorage.getItem('user');
            if (currentUserStr) {
                const currentUser = JSON.parse(currentUserStr);
                const response = await fetch(`${Config.API_URL}/users/get_user.php?user_id=${currentUser.id}`);
                if (response.ok) {
                    const freshUser = await response.json();
                    if (freshUser && freshUser.id) {
                        await setUser(freshUser);
                    }
                }
            }
        } catch (error) {
            console.error('Error reloading user from server:', error);
        }
    };

    const setUser = async (newUser: User | null) => {
        try {
            if (newUser) {
                await AsyncStorage.setItem('user', JSON.stringify(newUser));

                // Register Device Token
                // We do this in background to not block UI
                if (Platform.OS !== 'web') {
                    registerForPushNotificationsAsync().then(token => {
                        if (token) {
                            console.log('Updating device token:', token);
                            fetch(`${Config.API_URL}/auth/update_token.php`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user_id: newUser.id, token })
                            }).catch(err => console.error("Token update failed", err));
                        }
                    }).catch(err => console.error("Token registration failed", err));
                }

            } else {
                await AsyncStorage.removeItem('user');
            }
            setUserState(newUser);
        } catch (error) {
            console.error('Error saving user to storage:', error);
        }
    };

    const updateUserProfile = async (data: Partial<User>) => {
        if (!user) return;
        const updatedUser = { ...user, ...data };
        await setUser(updatedUser);
    };

    const [unreadCount, setUnreadCount] = useState(0);

    return (
        <UserContext.Provider value={{ user, setUser, updateUserProfile, reloadUser, isLoading, unreadCount, setUnreadCount }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
